#!/usr/bin/env node
// Fails the build when the first download grows past its ceiling. Counts what a player's phone fetches
// before the first frame, gzipped: the page, the scripts and styles it links, the Latin font files
// those styles use, and any WASM. Fredoka's Hebrew and Latin-extended files only load for text the
// game never shows. Raise the ceiling on purpose, with the new baseline recorded in docs/verification.md.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';

export const FIRST_DOWNLOAD_BUDGET = Number(process.env.TUMBLEWORKS_BUDGET_BYTES ?? 2_000_000);

const directory = process.argv[2] ?? 'dist';
const page = readFileSync(join(directory, 'index.html'));
const linked = [...page.toString().matchAll(/(?:href|src)="\/?(assets\/[^"]+\.(?:js|css))"/g)].map((match) => match[1]);
if (!linked.some((file) => file.endsWith('.js'))) throw new Error(`${directory}/index.html links no script: the budget would measure nothing`);
const fonts = readdirSync(join(directory, 'assets')).filter((file) => /-latin-\d+-normal-[^.]+\.woff2$/.test(file) || file.endsWith('.wasm')).map((file) => `assets/${file}`);

let total = gzipSync(page, { level: 9 }).length;
for (const file of [...linked, ...fonts]) total += gzipSync(readFileSync(join(directory, file)), { level: 9 }).length;

const summary = `${(total / 1_000_000).toFixed(3)} MB gzipped of ${(FIRST_DOWNLOAD_BUDGET / 1_000_000).toFixed(3)} MB (${linked.length + fonts.length + 1} files)`;
if (total > FIRST_DOWNLOAD_BUDGET) {
  console.error(`First download over budget: ${summary}`);
  process.exit(1);
}
console.log(`First download: ${summary}`);
