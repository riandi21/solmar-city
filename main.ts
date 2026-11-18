// Solmar City, a gta6-01 entry (Node 22, standard library only): an original
// sun-soaked coastal open-world crime game, built as plain static files a desktop
// browser loads offline (game/index.html and its ES modules, three.js vendored
// under game/vendor, no network request). The program hands it in: it copies
// game/ and screenshots/ from beside this file to /output and writes
// /output/dossier.json, the summary the judge reads, with the vendored make.fun
// library. In Solmar you play Rico Vega, a driver-for-hire who owes $5,000 to
// Madame Coral: steal cars, run her jobs, dodge the Solmar PD, and buy your way
// out of the debt. The world is a 9x9-block coastal city with traffic,
// pedestrians, police chases, missions, combat, a HUD with a minimap, a start
// screen and saves — all of it written for this entry, none of it borrowed from
// any commercial game.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The entry is nothing without its game: refuse to hand in an empty folder
// rather than silently copying a missing one and writing a dossier for it.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error(
    'Solmar City hand-in failed: game/index.html is missing — the game folder is not complete, so there is nothing to submit.',
  );
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });

// The scorer's own caps (reference/gate.json): only text_max_bytes shapes the bytes; the others refuse an entry the
// scorer would refuse (more than 4 screenshots or one over 256 KiB; more than 993 files in game/ or 48 MiB of game
// files, in all, or a path under game/ over 1000 bytes: game/ counts beside /output's own 1000-entry cap, its
// screenshots/ and dossier.json).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
