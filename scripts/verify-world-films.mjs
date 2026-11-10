import { createHash } from 'node:crypto';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';

const chapters = process.argv.slice(2).map(Number);
const records = [];
for (const chapter of chapters.length ? chapters : [1, 2, 3, 4, 5, 6]) {
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 12) throw new Error('Supply chapter numbers 1–12');
  const path = `public/films/valley-${chapter}.mp4`;
  const bytes = await readFile(path);
  const result = spawnSync(process.env.FFMPEG ?? 'ffmpeg', ['-hide_banner', '-nostats', '-i', path, '-map', '0:v:0', '-progress', 'pipe:1', '-f', 'null', '-'], { encoding: 'utf8', maxBuffer: 1_000_000 });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path}: decoder failed: ${result.stderr}`);
  const frames = Number([...result.stdout.matchAll(/^frame=(\d+)$/gm)].at(-1)?.[1]);
  const duration = Number([...result.stdout.matchAll(/^out_time_us=(\d+)$/gm)].at(-1)?.[1]) / 1_000_000;
  const expected = chapter === 1 ? 11 : 13.5;
  if (frames !== expected * 24 || Math.abs(duration - expected) > 0.05 || !result.stderr.includes('540x960') || !result.stderr.includes('h264')) throw new Error(`${path}: unexpected format, frame count or duration`);
  records.push({ chapter, path, bytes: bytes.length, sha256: createHash('sha256').update(bytes).digest('hex'), codec: 'h264', width: 540, height: 960, fps: 24, frames, durationSeconds: duration, decoded: true });
}
await mkdir('output/current/world-films', { recursive: true });
await writeFile('output/current/world-films/manifest.json', `${JSON.stringify(records, null, 2)}\n`);
console.log(`Decoded ${records.length} portrait films; ${records.reduce((sum, record) => sum + record.frames, 0)} frames, ${records.reduce((sum, record) => sum + record.bytes, 0)} bytes. No live-phone performance claim.`);
