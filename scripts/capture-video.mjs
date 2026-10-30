// A silent, deterministic 24 fps playthrough: all three introductory boards, then harder-board previews.
// docker compose --profile e2e run --rm e2e node scripts/capture-video.mjs
// ffmpeg -framerate 24 -i output/poc9/video-frames/%05d.jpg -c:v libx264 -pix_fmt yuv420p -crf 22 -movflags +faststart output/poc9/tumbleworks-nine-levels.mp4
import { chromium } from '@playwright/test';
import { TUBE_BOARDS, TRAY_BOARDS } from '../src/puzzles/levels.ts';
import { mkdirSync, writeFileSync } from 'node:fs';

const output = 'output/poc9/video-frames';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errors = [];
page.on('pageerror', error => errors.push(error.message));
await page.goto(process.env.CAPTURE_URL ?? 'http://game-server:5180');
await page.waitForFunction(() => window.tumbleworks?.app?.runtime, undefined, { timeout: 60000 });
await page.evaluate(() => { window.tumbleworks.app.manualClock = true; });
let frame = 0;
const step = async () => {
  await page.evaluate(() => window.tumbleworks.app.advance(1/24));
  await page.screenshot({ path: `${output}/${String(frame++).padStart(5,'0')}.jpg`, type: 'jpeg', quality: 88, scale: 'css' });
};
const hold = async seconds => { for (let n=0; n<Math.ceil(seconds*24); n++) await step(); };
const settled = async () => {
  for(let n=0;n<65*24;n++) {
    const done = await page.evaluate(() => { const s=window.tumbleworks.app.debugState(); return !s.busy&&!s.settling; });
    if(done) return;
    await step();
  }
  throw Error('Capture did not settle');
};
const tap = async id => {
  const target = await page.evaluate(key => window.tumbleworks.app.debugTargets()[key],id);
  if(!target) throw Error(`Missing ${id}`);
  await page.touchscreen.tap(target.x,target.y);
  await step();
};
const next = async () => {
  await page.locator('#card[data-kind="win"]').waitFor();
  await hold(.7);
  await page.locator('#card-action').click();
  await step();
  await hold(.7);
};
await hold(.8);
for(const id of [0,0,1]) { await tap(`supply${id}`); await settled(); await hold(.12); }
await next();
for(const move of TUBE_BOARDS[0].solution) {
  await tap(`tube${move.from}`); await hold(.1); await tap(`tube${move.to}`); await settled(); await hold(.08);
}
await next();
for(const id of TRAY_BOARDS[0].solution) { await tap(`piece${id}`); await settled(); await hold(.08); }
await page.locator('#card[data-kind="win"]').waitFor();
await hold(.8);
for(const index of [3,4,5,6,7,8]) {
  await page.locator(`.chip[data-level="${index}"]`).click();
  await step();
  await hold(.8);
}
if(errors.length) throw Error(errors.join('\n'));
writeFileSync('output/poc9/video-metadata.json',JSON.stringify({frames:frame,fps:24,seconds:frame/24,errors},null,2));
console.log(JSON.stringify({frames:frame,seconds:frame/24,errors}));
await browser.close();
