// Records a smooth video on machines without a GPU. The game is advanced one frame at a time and
// each frame is saved as an image, so slow rendering can't affect the timing.
//   docker compose exec -T dev sh scripts/snapshot.sh
//   docker compose --profile e2e run --rm e2e node scripts/capture-video.mjs
//   ffmpeg -framerate 30 -i output/frames/%05d.jpg -vf format=yuv420p -c:v libx264 -crf 22 output/capture/video.mp4
import { chromium, devices } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.CAPTURE_URL ?? 'http://game-server:5181';
const OUT = 'output/frames';
const FRAME_SECONDS = 1 / 30;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ ...devices['Pixel 7'], deviceScaleFactor: 1.5 });
const page = await context.newPage();
page.on('pageerror', (error) => {
  throw error;
});
await page.goto(BASE);
await page.waitForFunction(() => window.tumbleworks?.app?.machine, undefined, { timeout: 60000 });
await page.evaluate(() => {
  window.tumbleworks.app.manualClock = true;
});

let frame = 0;
const step = async () => {
  await page.evaluate((seconds) => window.tumbleworks.app.advance(seconds), FRAME_SECONDS);
  await page.screenshot({ path: join(OUT, `${String(frame).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 88, scale: 'css' });
  frame += 1;
};
const hold = async (seconds) => {
  for (let i = 0; i < seconds / FRAME_SECONDS; i++) await step();
};
const tap = async (name) => {
  const { x, y } = await page.evaluate((n) => window.tumbleworks.app.debugTargets()[n], name);
  await page.touchscreen.tap(x, y);
  await step();
};
const until = async (check, limitSeconds = 60) => {
  for (let i = 0; i < limitSeconds / FRAME_SECONDS; i++) {
    if (await page.evaluate(check)) return;
    await step();
  }
  throw new Error(`Timed out on ${check}`);
};
const settled = () => {
  const { rules } = window.tumbleworks.app.machine;
  return !rules.state.marbles.some(
    (m) => m.status === 'pouring' || m.status === 'dropping' || (m.status === 'on-belt' && m.color === rules.activeColor),
  );
};
const status = (value) => `window.tumbleworks.app.machine.rules.status === '${value}'`;

await hold(1.2);
await tap('supply0');
await hold(3.6);
await tap('supply1');
await until(status('jammed'));
await hold(3.4);
await tap('undo');
await hold(1.2);
await tap('supply0');
await hold(1);
await until(settled);
await hold(0.4);
await tap('supply1');
await until(status('won'));
await hold(2.4);
await tap('card');
await hold(1);
for (const supply of [0, 2, 1, 0, 1]) {
  await tap(`supply${supply}`);
  await hold(1);
  await until(settled);
  await hold(0.2);
}
await until(status('won'));
await hold(2.4);

const recoveries = await page.evaluate(() => window.tumbleworks.app.machine.recoveries);
console.log(JSON.stringify({ frames: frame, seconds: frame * FRAME_SECONDS, recoveries }));
await browser.close();
