// Records a smooth video on machines without a GPU. The game is advanced one frame at a time and
// each frame is saved as an image, so slow rendering can't affect the timing.
//   docker compose --profile e2e run --rm e2e node scripts/capture-video.mjs
//   ffmpeg -framerate 30 -i output/frames/%05d.jpg -vf format=yuv420p -c:v libx264 -crf 22 output/capture/video.mp4
import { chromium, devices } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const BASE = process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180';
const OUT = 'output/frames';
const FRAME_MS = 1000 / 30;
rmSync(OUT, { recursive: true, force: true });
mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const context = await browser.newContext({ ...devices['Pixel 7'] });
const page = await context.newPage();
page.on('pageerror', (error) => {
  throw error;
});
await page.goto(BASE);
await page.waitForFunction(() => window.tumbleworks?.scene()?.sim);
await page.evaluate(() => {
  const { game, scene } = window.tumbleworks;
  game.loop.sleep();
  window.captureTime = performance.now();
  scene().fixedStepping = true;
});

let frame = 0;
const step = async () => {
  await page.evaluate((ms) => {
    const { game, scene } = window.tumbleworks;
    scene().fixedStepping = true;
    window.captureTime += ms;
    game.step(window.captureTime, ms);
  }, FRAME_MS);
  await page.screenshot({ path: join(OUT, `${String(frame).padStart(5, '0')}.jpg`), type: 'jpeg', quality: 88, scale: 'css' });
  frame += 1;
};
const hold = async (ms) => {
  for (let i = 0; i < ms / FRAME_MS; i++) await step();
};
const tap = async (name) => {
  const { x, y } = await page.evaluate((n) => window.tumbleworks.scene().debugTargets()[n], name);
  await page.touchscreen.tap(x, y);
  await step();
};
const until = async (check, limitMs = 40000) => {
  for (let i = 0; i < limitMs / FRAME_MS; i++) {
    if (await page.evaluate(check)) return;
    await step();
  }
  throw new Error(`Timed out on ${check}`);
};
const settled = () => {
  const { sim } = window.tumbleworks.scene();
  return sim.state.pending.length === 0 && !sim.state.belt.some((m) => m.color === sim.frontColor);
};
const status = (value) => `window.tumbleworks.scene().sim.state.status === '${value}'`;

await hold(1500);
await tap('supply0');
await hold(3200);
await tap('supply1');
await until(`window.tumbleworks.scene().sim.state.pending.length === 0`);
await hold(2600);
await tap('undo');
await hold(1300);
await tap('supply0');
await until(settled);
await hold(500);
await tap('supply1');
await until(status('won'));
await hold(2600);
await tap('card');
await hold(1400);
for (const supply of [0, 2, 1, 0, 1]) {
  await tap(`supply${supply}`);
  await hold(600);
  await until(settled);
  await hold(250);
}
await until(status('won'));
await hold(2600);

console.log(JSON.stringify({ frames: frame, seconds: frame * (FRAME_MS / 1000) }));
await browser.close();
