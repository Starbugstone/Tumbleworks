#!/usr/bin/env node
// Fails the build when the first download grows past its ceiling. Counts what a player's phone fetches
// before the first frame, gzipped: the page, the scripts and styles it links, the Latin font files
// those styles use, any WASM, and the sound bank even though it loads on the first gesture.
// Fredoka's Hebrew and Latin-extended files only load for text the game never shows.
// The authorized Blender-world increase is recorded in docs/performance/world-3d-baseline.json.
import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';

export const FIRST_DOWNLOAD_BUDGET = Number(process.env.TUMBLEWORKS_BUDGET_BYTES ?? 2_125_000);
const AUDIO_BUDGET = 45_000;
const WORLD_GEOMETRY_BUDGET = 120_000;
const WORLD_PREVIEW_BUDGET = 100_000;
const repository = fileURLToPath(new URL('../', import.meta.url));

// Geometry is already embedded in the linked JavaScript. This independent guard must not
// add it to first-download bytes a second time. Preview PNGs are optional transfers.
export function checkWorldAssets(worldAssetDirectory) {
  let geometryBytes = 0;
  for (const name of ['terrain-runtime.json', 'kit-runtime.json']) {
    const path = join(worldAssetDirectory, name);
    let bytes;
    try { bytes = readFileSync(path); }
    catch { throw new Error(`Missing required world runtime asset: ${path}`); }
    geometryBytes += gzipSync(bytes, { level: 9 }).length;
  }
  if (geometryBytes > WORLD_GEOMETRY_BUDGET) throw new Error(`World geometry over budget: ${geometryBytes} bytes of ${WORLD_GEOMETRY_BUDGET}`);
  const previews = resolve(worldAssetDirectory, '../../public/models/projects');
  function pngBytes(directory) {
    let entries;
    try { entries = readdirSync(directory, { withFileTypes: true }); }
    catch (error) { if (error.code === 'ENOENT') return 0; throw error; }
    return entries.reduce((sum, entry) => sum + (entry.isDirectory()
      ? pngBytes(join(directory, entry.name))
      : /\.png$/i.test(entry.name) ? readFileSync(join(directory, entry.name)).length : 0), 0);
  }
  const previewBytes = pngBytes(previews);
  if (previewBytes > WORLD_PREVIEW_BUDGET) throw new Error(`World previews over budget: ${previewBytes} bytes of ${WORLD_PREVIEW_BUDGET}`);
  console.log(`World assets: geometry ${geometryBytes}/${WORLD_GEOMETRY_BUDGET} gzip bytes; previews ${previewBytes}/${WORLD_PREVIEW_BUDGET} bytes`);
}

try {
  checkWorldAssets(process.env.TUMBLEWORKS_WORLD_ASSET_DIRECTORY ?? join(repository, 'assets/world-3d'));
} catch (error) {
  console.error(error.message);
  process.exit(1);
}

const directory = process.argv[2] ?? 'dist';
const page = readFileSync(join(directory, 'index.html'));
const linked = [...page.toString().matchAll(/(?:href|src)="\/?(assets\/[^"]+\.(?:js|css))"/g)].map((match) => match[1]);
if (!linked.some((file) => file.endsWith('.js'))) throw new Error(`${directory}/index.html links no script: the budget would measure nothing`);
const fonts = readdirSync(join(directory, 'assets')).filter((file) => /-latin-\d+-normal-[^.]+\.woff2$/.test(file) || file.endsWith('.wasm')).map((file) => `assets/${file}`);
// The support-check worker loads with the first village map: Little Harbour is a new player's first village.
// Vite bundles the worker with its own dependency closure into this one file; count all of it.
const workers = readdirSync(join(directory, 'assets')).filter((file) => /^static-proof\.worker-[\w-]+\.js$/.test(file)).map((file) => `assets/${file}`);
if (workers.length !== 1) throw new Error(`${directory}/assets must hold exactly one support-check worker, found ${workers.length}`);
if (/\bimport\s*(?:[({'"*]|[\w$]+\s*(?:,|from\b))|\bimportScripts\s*\(|\bexport\s*(?:\*[^;]*|\{[^}]*\})\s*from\s*['"]/.test(readFileSync(join(directory, workers[0]), 'utf8'))) throw new Error('The support-check worker must be self-contained so the budget counts its whole closure');
const sounds = readdirSync(join(directory, 'assets')).filter((file) => /\.(mp3|ogg|opus|wav|m4a|aac)$/i.test(file)).map((file) => `assets/${file}`);
// Media is already compressed; count its actual transfer bytes rather than assuming server gzip savings.
const audioBytes = sounds.reduce((sum, file) => sum + readFileSync(join(directory, file)).length, 0);
if (audioBytes > AUDIO_BUDGET) {
  console.error(`Audio over budget: ${audioBytes} bytes of ${AUDIO_BUDGET}`);
  process.exit(1);
}

let total = gzipSync(page, { level: 9 }).length;
for (const file of [...linked, ...fonts, ...workers]) total += gzipSync(readFileSync(join(directory, file)), { level: 9 }).length;
total += audioBytes;

const summary = `${(total / 1_000_000).toFixed(3)} MB of ${(FIRST_DOWNLOAD_BUDGET / 1_000_000).toFixed(3)} MB (${linked.length + fonts.length + workers.length + sounds.length + 1} files; audio ${audioBytes}/${AUDIO_BUDGET} bytes)`;
if (total > FIRST_DOWNLOAD_BUDGET) {
  console.error(`First download over budget: ${summary}`);
  process.exit(1);
}
console.log(`First download: ${summary}`);
