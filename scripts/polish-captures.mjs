import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const output = 'output/current/polish';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [];
for (const [name, viewport] of [['phone', { width: 390, height: 844 }], ['narrow', { width: 320, height: 700 }], ['desktop', { width: 1365, height: 900 }]]) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1, hasTouch: true });
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180');
  await page.waitForFunction(() => window.tumbleworks?.app?.runtime);
  await page.evaluate(() => { window.tumbleworks.app.manualClock = true; });
  for (const [level, target] of [[0, 'supply0'], [1, 'lane0'], [2, 'tube0'], [12, 'lane0']]) {
    await page.locator('#levels-toggle').click();
    await page.locator(`.chip[data-level="${level}"]`).click();
    await page.evaluate(() => window.tumbleworks.app.advance(0));
    await page.screenshot({ path: `${output}/${name}-${level}.png` });
    if (name === 'phone') {
      await page.locator('#scene').evaluate(el => { el.style.filter = 'grayscale(1)'; });
      await page.screenshot({ path: `${output}/gray-${level}.png` });
      await page.locator('#scene').evaluate(el => { el.style.filter = ''; });
      const at = await page.evaluate(key => window.tumbleworks.app.debugTargets()[key], target);
      await page.touchscreen.tap(at.x, at.y);
      if (level === 2) {
        const to = await page.evaluate(() => window.tumbleworks.app.debugTargets().tube3);
        await page.touchscreen.tap(to.x, to.y);
      }
      await page.evaluate(() => { for (let i = 0; i < 5; i++) window.tumbleworks.app.advance(1 / 60, i === 4); });
      await page.screenshot({ path: `${output}/action-${level}.png` });
    }
  }
  await page.close();
}
await browser.close();
writeFileSync(`${output}/errors.json`, JSON.stringify(errors));
if (errors.length) throw new Error(errors.join('\n'));
