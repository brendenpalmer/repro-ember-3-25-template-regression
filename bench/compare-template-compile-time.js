'use strict';

const fg = require('fast-glob');
const fs = require('fs');

const {
  precompile: precompile_3_24,
} = require('ember-source-3-24/dist/ember-template-compiler');

const {
  precompile: precompile_3_25,
} = require('ember-source-3-25/dist/ember-template-compiler');

async function getAllTemplates() {
  const templates = await fg(['templates/**/*.hbs', '!**/node_modules/**'], {
    absolute: true,
  });

  return Promise.all(
    templates.map((filePath) =>
      fs.promises.readFile(filePath, 'utf-8').then((fileContent) => ({
        filePath,
        fileContent,
      }))
    )
  );
}

function measure({ precompile, templates }) {
  const start = Date.now();

  templates.forEach(({ fileContent }) => {
    precompile(fileContent);
  });

  return Date.now() - start;
}

(async function run() {
  console.log('Getting all templates in templates/');
  const templates = await getAllTemplates();
  console.log(`Found ${templates.length} templates`);

  console.log('Measuring precompile time using `ember-source@3.24`');
  const timing_3_24 = measure({ precompile: precompile_3_24, templates });

  console.log('Measuring precompile time using `ember-source@3.25`');
  const timing_3_25 = measure({ precompile: precompile_3_25, templates });

  console.log('Total precompile time using `ember-source@3.24`', timing_3_24);
  console.log('Total precompile time using `ember-source@3.25`', timing_3_25);
})();
