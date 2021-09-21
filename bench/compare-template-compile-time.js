'use strict';

const fg = require('fast-glob');
const path = require('path');
const fs = require('fs');

const pkg = require('../package.json');

/**
  @typedef CompilerToTest

  @property {'@glimmer/component' | 'ember-source'} package
  @property {string} label
  @property {string} version;
  @property {(template: string) => void} precompile;
  @property {Array} plugins the ASTPlugin type from @glimmer/syntax
*/

/**
  Create an array of compiler functions to try out, these objects are in this format:

 @return {CompilerToTest[]}
*/
function getCompilers() {
  return Object.entries(pkg.devDependencies).reduce((memo, [label]) => {
    const compilerPkg = require(`${label}/package.json`);

    let precompile;
    let buildCompileOptions = (options) => options;

    if (compilerPkg.name === 'ember-source') {
      precompile = require(`${label}/dist/ember-template-compiler`).precompile;
    } else if (compilerPkg.name === '@glimmer/compiler') {
      precompile = require(label).precompile;

      const emberPackage = label.substring('glimmer-component'.length);

      // Use the package version if it's legit; otherwise default to using 3.28
      try {
        buildCompileOptions =
          require(`${emberPackage}/dist/ember-template-compiler`).compileOptions;
      } catch {
        // The regular 3.28 source to use for that fallback.
        const fallbackEmberSource =
          'ember-source-3-28/dist/ember-template-compiler';

        buildCompileOptions = require(fallbackEmberSource).compileOptions;
      }
    } else {
      return memo;
    }

    const compilerInfo = {
      label,
      package: compilerPkg.name,
      version: compilerPkg.version,
      precompile,
      buildCompileOptions,
    };
    memo.push(compilerInfo);

    return memo;
  }, []);
}

const compilers = getCompilers();

async function getAllTemplates() {
  const templates = await fg(['templates/**/*.hbs', '!**/node_modules/**'], {
    absolute: true,
  });

  return Promise.all(
    templates.map(async (filePath) => {
      const relativePath = path.relative(process.cwd(), filePath);

      const fileContent = await fs.promises.readFile(filePath, 'utf-8');

      return {
        filePath,
        fileContent,
        relativePath,
      };
    })
  );
}

function measure({ precompile, buildCompileOptions }, templates) {
  const start = Date.now();

  // This way we stop holding the template in memory.
  // TODO: (maybe) make sure we match what we do in the actual build pipeline
  let template;
  while ((template = templates.pop())) {
    let { relativePath, fileContent } = template;
    precompile(
      fileContent,
      buildCompileOptions({
        // common options from ember-cli-htmlbars
        //
        // https://github.com/ember-cli/ember-cli-htmlbars/blob/6b69feff73b879aa06bd402b914c5627dc5ba481/lib/template-compiler-plugin.js#L68-L83
        // https://github.com/ember-cli/ember-cli-htmlbars/blob/6b69feff73b879aa06bd402b914c5627dc5ba481/lib/colocated-broccoli-plugin.js#L126-L135
        contents: fileContent,
        moduleName: relativePath,
        parseOptions: {
          srcName: relativePath,
        },
      })
    );
  }

  return Date.now() - start;
}

const displayNameFor = (compilerInfo) =>
  `${compilerInfo.package}@${compilerInfo.version} (${compilerInfo.label})`;

(async function run() {
  /** @type {Map<string, Array<number>>} */
  const timingLogs = new Map(compilers.map((c) => [displayNameFor(c), []]));

  // Get five of each compiler to run. We'll average the results at the end.
  const compilersToRun = compilers.reduce(
    (cs, c) => cs.concat([c, c, c, c, c]),
    []
  );

  await Promise.all(
    compilersToRun.map(async (compilerInfo) => {
      const templates = await getAllTemplates();

      const timing = measure(compilerInfo, templates);
      timingLogs.get(displayNameFor(compilerInfo)).push(timing);
    })
  );

  for (let [name, timings] of timingLogs) {
    let avg = timings.reduce((sum, n) => sum + n, 0) / timings.length;
    console.log(`Average total precompile time using ${name}`, avg);
  }
})();
