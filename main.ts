// Solmar City — make.fun gta6-01 entry point (Node 22, standard library only).
//
// This program hands the game in. It takes the static game/ folder and the
// screenshots/ folder sitting next to this file, copies both into the
// output directory, and writes dossier.json there using the vendored
// make.fun library, which summarises the game for the judge.
//
// The output directory comes from MAKEFUN_OUTPUT_DIR, falling back to
// /output (the grader's directory). Run it locally like this:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// and serve the game itself with `node serve.ts`, then open
// http://localhost:8080 to play it in a desktop browser.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const repoRoot = fileURLToPath(new URL('.', import.meta.url));
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';
const gameOut = join(outputDir, 'game');
const shotsOut = join(outputDir, 'screenshots');

// Count plain files and their bytes under a directory, recursively.
function countTree(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      const child = countTree(path);
      files += child.files;
      bytes += child.bytes;
    } else if (entry.isFile()) {
      files += 1;
      bytes += statSync(path).size;
    }
  }
  return { files, bytes };
}

mkdirSync(outputDir, { recursive: true });
cpSync(join(repoRoot, 'game'), gameOut, { recursive: true });
mkdirSync(shotsOut, { recursive: true });
if (existsSync(join(repoRoot, 'screenshots'))) {
  cpSync(join(repoRoot, 'screenshots'), shotsOut, { recursive: true });
}

// The caps are the scorer's own limits: at most 4 screenshots of 256 KiB
// each, at most 993 files / 48 MiB in game/, paths under 1000 bytes, and
// the dossier text capped at 160 KiB. An entry over a cap is refused,
// so the build refuses it here first.
writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);

const gameTotals = countTree(gameOut);
const dossierPath = join(outputDir, 'dossier.json');
const dossierBytes = statSync(dossierPath).size;
const shotCount = existsSync(shotsOut)
  ? readdirSync(shotsOut).filter((name) => !name.startsWith('.')).length
  : 0;
console.log(
  `Hand-in: game ${gameTotals.files} files, ${gameTotals.bytes} bytes; screenshots ${shotCount}; dossier ${dossierBytes} bytes`,
);
