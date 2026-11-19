// Solmar City, a gta6-01 entry (Node 22, standard library only): an original
// sun-soaked coastal open-world crime game, built as plain static files a
// desktop browser loads offline (game/index.html and its ES modules, three.js
// vendored under game/vendor, no network request). The program hands it in:
// it copies game/ and screenshots/ from beside this file to /output and
// writes /output/dossier.json, the summary the judge reads, with the
// vendored make.fun library.
//
// The story: Rico Vega, a driver-for-hire, owes $5,000 to Madame Coral.
// Twelve missions take him from stealing his first car, through the
// Dourado gang war, to the Harbor War finale at the lighthouse. Around
// the story sits a living city: traffic and pedestrians, police chases
// with flanking cars, spike strips and a helicopter at 4 stars, a day /
// night cycle with street lamps and headlights, an Old Town quarter with
// a cathedral and a working lighthouse, street races, hidden packages,
// taxi fares, shops and a safehouse, fists / pistol / SMG / shotgun /
// rifle combat, NOS boost, a four-station synth car radio, a HUD with a
// minimap, district labels and mission tracking, and local saves.
//
// Serve it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader's container, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The hand-in refuses to run on a broken entry instead of submitting one:
// the game folder, the entry page, the vendored three.js and at least one
// screenshot must all exist, and every screenshot must fit the scorer's
// 256 KiB cap. The checks that need the live site (competition still
// open, the sealed transcript) run at submission time, not here.

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// The scorer's caps (reference/gate.json): only text_max_bytes shapes the
// bytes; the others refuse an entry the scorer would refuse — more than
// 4 screenshots or one over 256 KiB; more than 993 files in game/ or
// 48 MiB of game files in all; or a path under game/ over 1000 bytes.
const DOSSIER_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};
const SCREENSHOT_MAX_BYTES = DOSSIER_CAPS.screenshots.max_bytes;
const SCREENSHOT_MAX_COUNT = DOSSIER_CAPS.screenshots.max;
const GAME_MAX_BYTES = DOSSIER_CAPS.game_max_bytes;
const GAME_MAX_FILES = DOSSIER_CAPS.game_max_files;

/** Every file under `dir`, recursively, as paths relative to `dir`. */
function listFilesRecursive(dir, base = dir) {
  const found = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...listFilesRecursive(full, base));
    else if (entry.isFile()) found.push(full.slice(base.length + 1));
  }
  return found;
}

/** Total bytes of the files listed by listFilesRecursive. */
function totalBytes(dir, files) {
  let total = 0;
  for (const file of files) total += statSync(join(dir, file)).size;
  return total;
}

/**
 * Refuse to hand in a broken entry: the game folder, the entry page,
 * the vendored three.js, and the screenshots must all be present and
 * inside the scorer's caps. A missing piece throws with a plain
 * sentence saying which one, so a bad build fails loudly here instead
 * of silently submitting an empty game.
 */
function validateEntry() {
  const gameDir = join(here, 'game');
  const indexHtml = join(gameDir, 'index.html');
  if (!existsSync(indexHtml)) {
    throw new Error(
      'Solmar City hand-in failed: game/index.html is missing — the game folder is not complete, so there is nothing to submit.',
    );
  }
  const three = join(gameDir, 'vendor', 'three.module.min.js');
  if (!existsSync(three)) {
    throw new Error(
      'Solmar City hand-in failed: game/vendor/three.module.min.js is missing — the vendored three.js is required for offline play.',
    );
  }
  const gameFiles = listFilesRecursive(gameDir);
  if (gameFiles.length > GAME_MAX_FILES) {
    throw new Error(
      `Solmar City hand-in failed: game/ holds ${gameFiles.length} files, over the scorer's cap of ${GAME_MAX_FILES}.`,
    );
  }
  const gameBytes = totalBytes(gameDir, gameFiles);
  if (gameBytes > GAME_MAX_BYTES) {
    throw new Error(
      `Solmar City hand-in failed: game/ is ${gameBytes} bytes, over the scorer's cap of ${GAME_MAX_BYTES}.`,
    );
  }
  const shotsDir = join(here, 'screenshots');
  if (!existsSync(shotsDir)) {
    throw new Error(
      'Solmar City hand-in failed: screenshots/ is missing — the entry needs at least one screenshot.',
    );
  }
  const shots = readdirSync(shotsDir).filter((name) => /\.(jpe?g|png|webp)$/i.test(name));
  if (shots.length === 0) {
    throw new Error(
      'Solmar City hand-in failed: screenshots/ holds no images — the entry needs at least one screenshot.',
    );
  }
  if (shots.length > SCREENSHOT_MAX_COUNT) {
    throw new Error(
      `Solmar City hand-in failed: ${shots.length} screenshots, over the scorer's cap of ${SCREENSHOT_MAX_COUNT}.`,
    );
  }
  for (const shot of shots) {
    const size = statSync(join(shotsDir, shot)).size;
    if (size > SCREENSHOT_MAX_BYTES) {
      throw new Error(
        `Solmar City hand-in failed: screenshots/${shot} is ${size} bytes, over the 256 KiB cap.`,
      );
    }
  }
  return { gameFiles: gameFiles.length, gameBytes, shots: shots.length };
}

/** Copy the entry into the output folder and write the judge's dossier. */
function handIn() {
  const stats = validateEntry();
  mkdirSync(out, { recursive: true });
  cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
  mkdirSync(join(out, 'screenshots'), { recursive: true });
  if (existsSync(join(here, 'screenshots'))) {
    cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
  }
  writeFileSync(join(out, 'dossier.json'), buildDossier(out, DOSSIER_CAPS));
  return stats;
}

// `--check-only` validates the entry without writing anything: the
// screenshot and game-folder caps, the vendored three.js, the entry
// page. It is the fast gate for a build script — a non-zero exit means
// the entry would be refused at submission time.
const checkOnly = process.argv.includes('--check-only');
if (checkOnly) {
  const stats = validateEntry();
  console.log(
    `Solmar City v3 checks out: ${stats.gameFiles} game files (${stats.gameBytes} bytes), ` +
    `${stats.shots} screenshots — nothing written.`,
  );
} else {
  const stats = handIn();
  console.log(
    `Solmar City v3 handed in: ${stats.gameFiles} game files (${stats.gameBytes} bytes), ` +
    `${stats.shots} screenshots -> ${out}`,
  );
}
