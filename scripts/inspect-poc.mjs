import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'output/poc9';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errors = [];
const consoleErrors = [];
const networkErrors = [];
page.on('pageerror', e => errors.push(e.message));
page.on('console', m => { if (m.type() === 'error') consoleErrors.push(m.text()); });
page.on('requestfailed', r => networkErrors.push(`${r.url()}: ${r.failure()?.errorText}`));
page.on('response', r => { if (r.status() >= 400) networkErrors.push(`${r.status()} ${r.url()}`); });
await page.goto(process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180');
await page.waitForFunction(() => window.tumbleworks?.app?.runtime, undefined, { timeout: 60000 });
await page.evaluate(() => { window.tumbleworks.app.manualClock = true; });
for (const [name, width, height] of [['phone',390,844],['desktop',1365,900]]) {
  await page.setViewportSize({ width, height });
  for (const index of (name === 'phone' ? [0,1,2,3,4,5,6,7,8] : [0,1,2])) {
    await page.locator(`.chip[data-level="${index}"]`).click();
    await page.evaluate(() => window.tumbleworks.app.advance(1/60));
    await page.screenshot({ path: `${out}/${name}-level${index+1}.jpg`, type: 'jpeg', quality: 84, scale: 'css' });
    console.log(name,index+1,JSON.stringify(await page.evaluate(() => window.tumbleworks.app.debugState())));
  }
}
writeFileSync(`${out}/initial-errors.json`,JSON.stringify({ pageErrors: errors, consoleErrors, networkErrors },null,2));
console.log('browser diagnostics:',JSON.stringify({ pageErrors: errors, consoleErrors, networkErrors }));
if (errors.length || consoleErrors.length || networkErrors.length) throw new Error('Browser diagnostics failed');
await browser.close();
