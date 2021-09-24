import inspector from 'inspector';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
import fg from 'fast-glob';

const require = createRequire(import.meta.url);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readJSON(path) {
  return JSON.parse(fs.readFileSync(path, { encoding: 'utf-8' }));
}

let pkg = readJSON(path.join(__dirname, '..', 'package.json'));

export function compileTemplates(
  { precompile, buildCompileOptions },
  templates
) {
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
}

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
export function getCompilers() {
  return Object.entries(pkg.devDependencies).reduce((memo, [label]) => {
    const compilerPkg = require(`${label}/package.json`);

    let precompile;
    let buildCompileOptions = (options) => options;

    if (compilerPkg.name === 'ember-source') {
      precompile = require(`${label}/dist/ember-template-compiler`).precompile;
    } else if (compilerPkg.name === '@glimmer/compiler') {
      precompile = require(label).precompile;

      buildCompileOptions = compileOptionsFor(label, buildCompileOptions);
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

function compileOptionsFor(label, buildCompileOptions) {
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
  return buildCompileOptions;
}

export async function getAllTemplates() {
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

const session = new inspector.Session();
session.connect();

let file;
// uses whatever the "current" file is
session.on('HeapProfiler.addHeapSnapshotChunk', (m) => {
  fs.writeSync(file, m.params.chunk);
});

export function takeHeapSnapshot(path) {
  file = fs.openSync(path, 'w');

  return new Promise((resolve, reject) => {
    session.post('HeapProfiler.takeHeapSnapshot', null, (err, r) => {
      fs.closeSync(file);

      if (err) {
        reject(err);
      }

      resolve(r);
    });
  });
}

export async function startProfile() {
  return new Promise((resolve, reject) => {
    session.post('Profiler.enable', (err) => {
      if (err) {
        return reject(err);
      }

      session.post('Profiler.start', (err) => {
        if (err) {
          return reject(err);
        }

        resolve();
      });
    });
  });
}

export function endProfile() {
  return new Promise((resolve, reject) => {
    session.post('Profiler.stop', (err, { profile }) => {
      if (err) {
        return reject(err);
      }

      resolve(profile);
    });
  });
}
