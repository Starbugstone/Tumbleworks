import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, hasTouch: true });
const errors = [];
page.on('pageerror', e => errors.push(e.message));
await page.goto(process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180');
await page.waitForFunction(() => window.tumbleworks?.app?.runtime);
const select = async index => {
  await page.locator('#levels-toggle').click();
  await page.locator(`.chip[data-level="${index}"]`).click();
  await page.evaluate(() => window.tumbleworks.app.advance(0));
};
const stats = () => page.evaluate(() => {
  const { renderer } = window.tumbleworks.app.stage;
  return { ...renderer.info.memory, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles };
});
await select(12);
const busyLorries = await stats();
const tick = await page.evaluate(() => window.tumbleworks.app.debugState().tick);
const at = await page.evaluate(() => window.tumbleworks.app.debugTargets().lane0);
await page.touchscreen.tap(at.x, at.y);
await page.waitForFunction(start => window.tumbleworks.app.debugState().tick > start + 90, tick);
const afterTap = await page.evaluate(() => window.tumbleworks.app.debugState());
await page.getByRole('button', { name: 'Undo', exact: true }).click();
await page.evaluate(() => { window.tumbleworks.app.manualClock = true; });
const resources = [];
for (let round = 0; round < 4; round++) {
  for (const level of [2, 0, 12]) await select(level);
  resources.push(await stats());
}
await browser.close();
const report = { busyLorries, afterTap, resources, errors, note: 'Real browser clock and input; SwiftShader is not phone FPS evidence.' };
mkdirSync('output/current', { recursive: true });
writeFileSync('output/current/polish-live.json', JSON.stringify(report, null, 2));
console.log(JSON.stringify(report));
if (errors.length) throw new Error(errors.join('\n'));

const warm = resources[0];
if (resources.some(({ geometries, textures }) => geometries !== warm.geometries || textures !== warm.textures)) throw new Error('Scene resources grow across level changes');
