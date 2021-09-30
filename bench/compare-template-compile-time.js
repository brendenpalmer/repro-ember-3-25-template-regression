import { readFile, mkdir, rm } from 'fs/promises';
import execa from 'execa';
import { getCompilers, timestamp } from './utils.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SUBPROCESS_PATH = join(__dirname, 'measure-compilation.js');
const OUTPUT_BASE_DIR = join(__dirname, '..', '_data', 'timings');

const compilers = getCompilers();

const displayNameFor = (compilerInfo) =>
  `${compilerInfo.package}@${compilerInfo.version} (${compilerInfo.label})`;

(async function run() {
  // per-run output directory
  let outputDir = join(OUTPUT_BASE_DIR, timestamp());
  await mkdir(outputDir, { recursive: true });

  /** @type {Map<string, Array<number>>} */
  const timingLogs = new Map(compilers.map((c) => [displayNameFor(c), []]));

  // Get five of each compiler to run. We'll average the results at the end.
  /** @type {Array<[import('./utils.js').CompilerToTest, number]>} */
  const compilersToRun = compilers.reduce(
    (cs, c) =>
      cs.concat([
        [c, 1],
        [c, 2],
        [c, 3],
        [c, 4],
        [c, 5],
      ]),
    []
  );

  await Promise.all(
    compilersToRun.map(async ([compilerInfo, runCountForCompiler]) => {
      let outputFileName = `${compilerInfo.label}-${runCountForCompiler}.txt`;
      let outputPath = join(outputDir, outputFileName);

      try {
        await execa(process.execPath, [
          SUBPROCESS_PATH,
          compilerInfo.label,
          outputPath,
        ]);
      } catch (e) {
        console.error('failed execa-ing', e);
      }

      let timingContents;
      try {
        timingContents = await readFile(outputPath, {
          encoding: 'utf-8',
        });
      } catch (e) {
        console.error('failed reading output', e);
      }

      const timing = parseFloat(timingContents.trim());
      timingLogs.get(displayNameFor(compilerInfo)).push(timing);
    })
  );

  // Build a little "table"
  console.log('| variant | average | min | max | ');
  console.log('| ------- | ------- | --- | --- | ');
  for (let [name, timings] of timingLogs) {
    let avg = timings.reduce((sum, n) => sum + n, 0) / timings.length;
    let min = Math.min(...timings);
    let max = Math.max(...timings);
    console.log(`| ${name} | ${avg} | ${min} | ${max} |`);
  }
})();
