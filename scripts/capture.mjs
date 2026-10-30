// Plays the game in a real browser and saves screenshots and a video for review.
//   docker compose run --rm e2e node scripts/capture.mjs [scenario]
import { chromium, devices } from '@playwright/test';
import { mkdirSync, readdirSync, renameSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180';
const OUT = process.env.CAPTURE_OUT ?? 'output/capture';
const scenario = process.argv[2] ?? 'full';
mkdirSync(OUT, { recursive: true });
const videoDir = join(OUT, 'video-tmp');
rmSync(videoDir, { recursive: true, force: true });

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const { viewport } = devices['Pixel 7'];
const context = await browser.newContext({
  ...devices['Pixel 7'],
  recordVideo: { dir: videoDir, size: viewport },
});
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));
page.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});

const wait = (ms) => page.waitForTimeout(ms);
const shot = (name) => page.screenshot({ path: join(OUT, `${name}.png`) });
const state = () =>
  page.evaluate(() => {
    const { sim } = window.tumbleworks.scene();
    return { status: sim.state.status, frontBox: sim.state.frontBox, occupancy: sim.occupancy, pending: sim.state.pending.length };
  });
const tap = async (name) => {
  const { x, y } = await page.evaluate((n) => window.tumbleworks.scene().debugTargets()[n], name);
  await page.touchscreen.tap(x, y);
};
const waitFor = async (predicate, timeout = 30000) => {
  const start = Date.now();
  for (;;) {
    const current = await state();
    if (predicate(current)) return current;
    if (Date.now() - start > timeout) throw new Error(`Timed out, state: ${JSON.stringify(current)}`);
    await wait(100);
  }
};

await page.goto(BASE);
await page.waitForFunction(() => window.tumbleworks?.scene()?.sim);
await wait(800);
await shot('01-start');

if (scenario === 'start') {
  // Screenshot only.
} else {
  await tap('supply0');
  await wait(450);
  await shot('02-first-release');
  await wait(1800);
  await shot('03-blue-riding');

  // The wrong choice: green fills the belt.
  await tap('supply1');
  await wait(1400);
  await shot('04-jam');
  await waitFor((s) => s.status === 'jammed');
  await wait(1300);
  await shot('05-jam-explained');

  await tap('undo');
  await wait(700);
  await shot('06-after-undo');

  // The right choice: red clears the way.
  await tap('supply0');
  await wait(1800);
  await shot('07-red-chain');
  await waitFor((s) => s.occupancy === 0, 40000);
  await shot('08-belt-clear');
  await tap('supply1');
  await wait(1300);
  await shot('09-green-riding');
  await waitFor((s) => s.status === 'won', 40000);
  await wait(1200);
  await shot('10-win');

  await tap('card');
  await wait(1200);
  await shot('11-level-2');

  // Level 2, one of its winning orders.
  const settled = () =>
    page.waitForFunction(() => {
      const { sim } = window.tumbleworks.scene();
      return sim.state.pending.length === 0 && !sim.state.belt.some((m) => m.color === sim.frontColor);
    }, undefined, { timeout: 40000 });
  for (const [index, supply] of [0, 2, 1, 0, 1].entries()) {
    await tap(`supply${supply}`);
    await wait(900);
    await shot(`12-level-2-tap-${index + 1}`);
    await settled();
    await wait(200);
  }
  await waitFor((s) => s.status === 'won', 40000);
  await wait(1200);
  await shot('13-level-2-win');
}

const summary = await state();
const video = page.video();
await context.close();
await browser.close();
if (video) {
  const path = await video.path();
  renameSync(path, join(OUT, 'playthrough.webm'));
}
rmSync(videoDir, { recursive: true, force: true });
console.log(JSON.stringify({ summary, errors, files: readdirSync(OUT) }, null, 1));
if (errors.length) process.exitCode = 1;
