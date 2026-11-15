// Frostline — the entry program for make.fun's threejs-fps-02 bounty.
// Node 22, standard library only. It hands the game in: game/ and
// screenshots/ are copied from beside this file into the output
// directory, and /output/dossier.json is written with the vendored
// make.fun library, which is the dossier the judge reads.
//
// Run it outside the grader with MAKEFUN_OUTPUT_DIR:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the game locally first with `node serve.ts` and open
// http://localhost:8080 to play it.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-threejs.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps (reference/gate.json in the kit): 4 screenshots at
// most, each at most 256 KiB; game/ at most 993 files and 48 MiB. Refuse
// early, in plain words, instead of handing in an entry the gate would
// refuse.
const shotsDir = join(here, 'screenshots');
const shots = existsSync(shotsDir) ? readdirSync(shotsDir).filter((f) => !f.startsWith('.')) : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`need 3 or 4 screenshots, found ${shots.length}`);
}
for (const shot of shots) {
  const size = statSync(join(shotsDir, shot)).size;
  if (size > 262144) throw new Error(`screenshot ${shot} is ${size} bytes, over the 256 KiB cap`);
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
cpSync(shotsDir, join(out, 'screenshots'), { recursive: true });

writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  }),
);

console.log(`Frostline handed in: ${shots.length} screenshots, dossier written to ${join(out, 'dossier.json')}`);
