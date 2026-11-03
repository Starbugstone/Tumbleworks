// Records a short gameplay video at the player's phone size, frame by frame on the game's own clock, so motion is smooth
// whatever the renderer's speed. Frames go to output/current/videos/<name>/; encode them with scripts/encode-video.sh.
//   docker compose --profile e2e run --rm e2e node scripts/record-video.mjs <name> <query> <seconds> <tap,tap,...> [gap]
// <query> opens the level, e.g. "try=tube-60" for a bank board or "level=12" for a campaign index.
// Taps are debug target IDs (supply0, lane1, tube3, ...), one every <gap> seconds (default 1.2) after a one-second look.
import { mkdirSync, rmSync } from 'node:fs';
import { chromium, devices } from 'playwright';

const [name = 'clip', query = '', secondsArg = '15', tapsArg = '', gapArg = '1.2'] = process.argv.slice(2);
const FPS = 30;
const seconds = Number(secondsArg);
const gap = Number(gapArg);
const taps = tapsArg.split(',').filter(Boolean);
const out = `output/current/videos/${name}`;
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const url = process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 375, height: 690 }, deviceScaleFactor: 2 });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (error) => errors.push(error.message));
await page.addInitScript(() => localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed: [], current: null, muted: true })));
const level = new URLSearchParams(query).get('level');
await page.goto(`${url}/${level === null && query ? `?${query}` : ''}`);
await page.waitForFunction(() => Boolean(window.tumbleworks?.app?.runtime), undefined, { timeout: 90000 });
await page.evaluate(() => { window.tumbleworks.app.manualClock = true; });
if (level !== null) {
  await page.locator('#levels-toggle').click();
  await page.locator(`.chip[data-level="${level}"]`).click();
}
// Guides and toasts belong to onboarding, not to a demonstration of the rule.
await page.addStyleTag({ content: '#guide-pointer, #instruction, #guide { display: none !important; }' });
let next = 0;
for (let frame = 0; frame < seconds * FPS; frame++) {
  const time = frame / FPS;
  if (next < taps.length && time >= 1 + next * gap) {
    const target = taps[next++];
    const point = await page.evaluate((id) => window.tumbleworks.app.debugTargets()[id], target);
    if (!point) throw new Error(`No target ${target}`);
    await page.touchscreen.tap(point.x, point.y);
  }
  await page.evaluate(() => window.tumbleworks.app.advance(1 / 30));
  await page.screenshot({ path: `${out}/f${String(frame).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 88 });
}
const status = await page.evaluate(() => window.tumbleworks.app.debugState().status);
console.log(JSON.stringify({ name, frames: seconds * FPS, taps: next, status, errors }));
await browser.close();
