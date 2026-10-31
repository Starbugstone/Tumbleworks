// Silent, deterministic 24fps evidence of actual touch input with overlapping moves.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { TUBE_BOARDS } from '../src/puzzles/levels.ts';
import { CONNECT_BOARDS } from '../src/puzzles/connect-levels.ts';
const output = 'output/current/video-frames';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto(process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180');
await page.waitForFunction(() => window.tumbleworks?.app?.runtime, undefined, { timeout: 60000 });
await page.evaluate(() => { window.tumbleworks.app.manualClock = true; });
let frames = 0;
async function frame() {
  await page.evaluate(() => window.tumbleworks.app.advance(1 / 24));
  await page.screenshot({ path: `${output}/${String(frames++).padStart(5, '0')}.jpg`, type: 'jpeg', quality: 86, scale: 'css' });
}
async function hold(seconds) { for (let i = 0; i < seconds * 24; i++) await frame(); }
async function point(id) { return page.evaluate(key => window.tumbleworks.app.debugTargets()[key], id); }
async function tap(id) { const at = await point(id); if (!at) throw Error(`Missing ${id}`); await page.touchscreen.tap(at.x, at.y); }
async function select(kind) {
  await page.locator('#levels-toggle').click();
  await page.locator(`.chip[data-kind="${kind}"]`).first().click();
  await frame();
}
const touch = await page.context().newCDPSession(page);
async function drag(from, to) {
  const a = await point(from), b = await point(to);
  await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [a] });
  for (let n = 1; n <= 4; n++) {
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * n / 4, y: a.y + (b.y - a.y) * n / 4 }] });
    await frame();
  }
  await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await frame();
}
await select('tube'); await hold(0.5);
for (const move of TUBE_BOARDS[0].solution) await drag(`tube${move.from}`, `tube${move.to}`);
await hold(0.8);
await select('tray'); await hold(0.4);
for (const id of [8, 0, 1, 9, 2, 3]) { await tap(`piece${id}`); await hold(0.08); }
await hold(0.8);
await select('connect'); await hold(0.4);
for (const id of CONNECT_BOARDS[0].solution) { await tap(`piece${id}`); await hold(0.08); }
await hold(0.8);
await select('conveyor'); await hold(0.4);
for (const id of [0, 0, 1]) { await tap(`supply${id}`); await hold(0.08); }
await hold(4);
await select('loop'); await hold(0.4);
await tap('lane0'); await hold(4);
await touch.detach();
await browser.close();
writeFileSync('output/current/video-metadata.json', JSON.stringify({ frames, fps: 24, seconds: frames / 24, errors }, null, 2));
if (errors.length) throw Error(errors.join('\n'));
console.log(JSON.stringify({ frames, seconds: frames / 24 }));
