// Solmar City v4 — main.ts (W4)
// Entrypoint for the make.fun hand-in. It copies game/ and screenshots/
// from this repo into the output directory (MAKEFUN_OUTPUT_DIR, else
// /output), then writes /output/dossier.json with the kit's buildDossier.
// Node 22, standard library only — no build step, no install.
//
// My own hand-in flow, written fresh for v4: stage the tree first, then
// let the kit measure exactly what was staged, so the dossier can never
// disagree with the files that were actually handed in.

import { buildDossier } from './vendor/makefun-game.ts';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// The repo root is the directory holding this file; the output directory
// is the env var when set, /output otherwise.
const repoRoot = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

function countTree(dir: string): { files: number; bytes: number } {
  let files = 0;
  let bytes = 0;
  const walk = (d: string): void => {
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name);
      if (entry.isDirectory()) walk(p);
      else if (entry.isFile()) {
        files += 1;
        bytes += statSync(p).size;
      }
    }
  };
  walk(dir);
  return { files, bytes };
}

function main(): void {
  mkdirSync(outDir, { recursive: true });

  // Stage a clean copy: wipe any previous game/ + screenshots/ first so
  // stale files from an older hand-in can never leak into this one.
  for (const name of ['game', 'screenshots']) {
    const target = join(outDir, name);
    if (existsSync(target)) rmSync(target, { recursive: true, force: true });
    const source = join(repoRoot, name);
    if (!existsSync(source)) throw new Error(`missing ${name}/ in ${repoRoot}`);
    cpSync(source, target, { recursive: true });
  }

  // The kit's dossier is the source of truth for what was handed in.
  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  writeFileSync(join(outDir, 'dossier.json'), dossier);

  // Real counts, measured from what was actually staged.
  const game = countTree(join(outDir, 'game'));
  const shots = readdirSync(join(outDir, 'screenshots')).filter((f) => {
    const p = join(outDir, 'screenshots', f);
    return statSync(p).isFile() && /\.(png|jpe?g)$/i.test(f);
  });
  const shotBytes = shots.reduce((n, f) => n + statSync(join(outDir, 'screenshots', f)).size, 0);
  console.log(
    `Solmar City v4 handed in: ${game.files} game files, ${game.bytes} bytes, ${shots.length} screenshots (${shotBytes} bytes)`,
  );
}

main();
