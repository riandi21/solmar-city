// main.ts — Solmar City hand-in entrypoint (Node 22, standard library only).
// Copies game/ and screenshots/ from beside this file into the output
// directory (/output, or $MAKEFUN_OUTPUT_DIR when set) and writes
// /output/dossier.json with buildDossier from the vendored make.fun library.
// Prints the hand-in line (game file count and bytes, screenshot count)
// and exits 0.

import { cp, mkdir, readdir, stat, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(process.env.MAKEFUN_OUTPUT_DIR || '/output');

async function walk(dir: string, base: string, out: { files: string[]; bytes: number }): Promise<void> {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(full, base, out);
    } else if (entry.isFile()) {
      const info = await stat(full);
      out.files.push(full.slice(base.length + 1));
      out.bytes += info.size;
    }
  }
}

async function countJpegs(dir: string): Promise<number> {
  let n = 0;
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.isFile() && /\.jpe?g$/i.test(entry.name)) n++;
      if (entry.isDirectory()) n += await countJpegs(join(dir, entry.name));
    }
  } catch {
    // Missing screenshots/ is not fatal: the dossier just records zero.
  }
  return n;
}

async function main(): Promise<void> {
  await mkdir(outDir, { recursive: true });
  const gameDir = join(here, 'game');
  const shotsDir = join(here, 'screenshots');

  await cp(gameDir, join(outDir, 'game'), { recursive: true });
  try {
    await cp(shotsDir, join(outDir, 'screenshots'), { recursive: true });
  } catch {
    await mkdir(join(outDir, 'screenshots'), { recursive: true });
  }

  const gameStats = { files: [] as string[], bytes: 0 };
  await walk(gameDir, gameDir, gameStats);
  gameStats.files.sort();
  const shotCount = await countJpegs(shotsDir);

  const dossier = buildDossier(outDir, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
  });
  await writeFile(join(outDir, 'dossier.json'), dossier, 'utf8');

  console.log(`Solmar City handed in: ${gameStats.files.length} game files (${gameStats.bytes} bytes), ${shotCount} screenshots -> ${outDir}`);
}

main().then(
  () => process.exit(0),
  (err: unknown) => {
    console.error('Hand-in failed:', err);
    process.exit(1);
  },
);
