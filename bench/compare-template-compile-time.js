import { compileTemplates, getCompilers, getAllTemplates } from './utils.js';

const compilers = getCompilers();

const displayNameFor = (compilerInfo) =>
  `${compilerInfo.package}@${compilerInfo.version} (${compilerInfo.label})`;

function measure(compilerInfo, templates) {
  const start = Date.now();
  compileTemplates(compilerInfo, templates);
  return Date.now() - start;
}

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
