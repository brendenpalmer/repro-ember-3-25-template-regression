import { writeFile } from 'fs/promises';
import { getCompiler, compileTemplates, getAllTemplates } from './utils.js';

/**
 *
 * @param {import('./utils').CompilerToTest} compilerInfo
 * @param {string[]} templates
 * @returns
 */
function measure(compilerInfo, templates) {
  const start = Date.now();
  compileTemplates(compilerInfo, templates);
  return Date.now() - start;
}

async function main() {
  let compilerLabel = process.argv[2];
  let compiler = getCompiler(compilerLabel);
  let templates = await getAllTemplates();

  let timing = measure(compiler, templates);
  let outputFile = process.argv[3];

  try {
    await writeFile(outputFile, timing.toString(), { encoding: 'utf-8' });
  } catch (e) {
    console.error('Could not write file:', e);
  }
}

main();
