import { chromium } from 'playwright';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const output = process.env.WORLD_RUBE_CAPTURE_OUTPUT ?? 'output/current/world-3d/motion-review';
const frames = process.env.WORLD_RUBE_CAPTURE_FRAMES === '1';
const sources = ['src/view/world-scene.ts', 'src/view/world-rube.ts', 'src/view/world-film-camera.ts', 'src/world/rube-sequence.ts', 'src/view/world.ts',
  'src/view/workshop-building.ts', 'src/world/workshop-building.ts', 'src/view/world-film.ts', 'assets/world-3d/kit-runtime.json', 'assets/world-3d/terrain-runtime.json'];
const hashes = async () => Object.fromEntries(await Promise.all(sources.map(async path => [path, createHash('sha256').update(await readFile(path)).digest('hex')])));
const before = await hashes();
await mkdir(output, { recursive: true });
if (frames) await mkdir(`${output}/frames`, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 690 }, deviceScaleFactor: 1, hasTouch: true });
  const page = await context.newPage(), errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const ready = async () => {
    await page.locator('#boot').waitFor({ state: 'hidden', timeout: 120_000 });
    await page.locator('#journey-transition').waitFor({ state: 'hidden' });
  };
  await page.goto(process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180'); await ready();
  const seeded = await page.evaluate(() => {
    const chapter = window.tumbleworks.app.world.progress.chapters[0];
    const completed = chapter.stops.flatMap(stop => stop.levels.map(level => level.id));
    completed.push('board-210', 'board-212');
    localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed, current: chapter.stops[0].levels[0].id, muted: true }));
    return completed;
  });
  await page.reload(); await ready();
  await page.getByRole('button', { name: 'Previous location', exact: true }).tap();
  await page.evaluate(() => { window.tumbleworks.app.manualClock = true; });
  await page.screenshot({ path: `${output}/built-village.png` });
  const start = await page.evaluate(() => {
    const app = window.tumbleworks.app;
    return { fingerprint: app.runtime.game.fingerprint(), steps: app.runtime.game.steps, quality: app.stage.renderer.getPixelRatio(), buffer: [app.stage.canvas.width, app.stage.canvas.height] };
  });
  await page.getByRole('button', { name: 'Watch your machine' }).tap();
  const duration = await page.evaluate(() => window.tumbleworks.app.world.playback.duration);
  const shots = new Map([[2.2, 'cradle'], [4.4, 'spiral'], [6.5, 'loop-one'], [8.3, 'top'], [9.1, 'gate'], [9.6, 'workshop'], [10.2, 'seesaw-cup'], [10.9, 'throw'], [13.3, 'loop-two'], [15.3, 'bucket'], [17.9, 'zigzag'], [20.3, 'funnel'], [22.6, 'bell']].map(([time, name]) => [Math.round(time * 24), name]));
  for (let frame = 0; frame < duration * 24; frame++) {
    const encoded = await page.evaluate(({ delta, encode }) => {
      const app = window.tumbleworks.app;
      app.advance(delta);
      return encode ? app.stage.canvas.toDataURL('image/png').split(',')[1] : null;
    }, { delta: frame === 0 ? 0 : 1 / 24, encode: frames });
    if (frames) await writeFile(`${output}/frames/${String(frame).padStart(4, '0')}.png`, Buffer.from(encoded, 'base64'));
    if (shots.has(frame)) await page.screenshot({ path: `${output}/phone-${shots.get(frame)}.png` });
  }
  const end = await page.evaluate(() => {
    const app = window.tumbleworks.app;
    return { fingerprint: app.runtime.game.fingerprint(), steps: app.runtime.game.steps, quality: app.stage.renderer.getPixelRatio(), buffer: [app.stage.canvas.width, app.stage.canvas.height] };
  });
  const after = await hashes();
  const report = { evidenceKind: 'authored-24fps-presentation-fixture', physicalPhonePerformance: false, sourceBefore: before, sourceAfter: after, sourceUnchanged: JSON.stringify(before) === JSON.stringify(after), seededPresentationCompletions: seeded, claimedGameplayWins: 0, duration, frames: Math.ceil(duration * 24), start, end, errors };
  await writeFile(`${output}/capture.json`, `${JSON.stringify(report, null, 2)}\n`);
  if (errors.length || JSON.stringify(start) !== JSON.stringify(end) || !report.sourceUnchanged) throw new Error('Capture changed gameplay, quality or sources, or reported a browser error');
  await page.locator('#film-skip').tap(); await ready();
  await context.close();
  console.log(JSON.stringify({ output, frames: report.frames, errors }));
} finally { await browser.close(); }
