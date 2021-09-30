import { mkdirSync, writeFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  compileTemplates,
  getCompilers,
  getAllTemplates,
  startProfile,
  endProfile,
  timestamp,
} from './utils.js';

const INTERESTING = [
  'glimmer-compiler-experiment',
  'glimmer-compiler-ember-source-3-24',
];

let compilersToRun = getCompilers().filter(({ label }) =>
  INTERESTING.includes(label)
);

(async function run() {
  mkdirSync('cpu-profiles', { recursive: true });

  // Sequencing is intentional. Don't want interference!
  for (let compiler of compilersToRun) {
    let templates = await getAllTemplates();

    await startProfile();
    compileTemplates(compiler, templates);
    let profile = await endProfile();

    writeFileSync(
      path.join(
        __dirname,
        '..',
        `cpu-profiles/${timestamp()}-${compiler.label}.cpuprofile`
      ),
      JSON.stringify(profile),
      { encoding: 'utf-8' }
    );
  }
})();
