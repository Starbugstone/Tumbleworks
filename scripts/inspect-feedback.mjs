import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const out = 'output/current';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true });
const errors = { page: [], console: [], network: [] };
page.on('pageerror', error => errors.page.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.console.push(message.text()); });
page.on('requestfailed', request => errors.network.push(`${request.url()}: ${request.failure()?.errorText}`));
page.on('response', response => { if (response.status() >= 400) errors.network.push(`${response.status()} ${response.url()}`); });
await page.goto(process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180');
await page.waitForFunction(() => window.tumbleworks?.app?.runtime, undefined, { timeout: 60000 });
await page.evaluate(() => { window.tumbleworks.app.manualClock = true; });
async function capture(index, name) {
  await page.locator('#levels-toggle').click();
  await page.locator(`.chip[data-level="${index}"]`).click();
  await page.evaluate(() => window.tumbleworks.app.advance(0));
  await page.screenshot({ path: `${out}/${name}-level${index + 1}.png`, scale: 'css' });
  console.log(name, index + 1);
}
// The campaign decides what to capture: every level, then the first level of each gameplay type.
await page.locator('#levels-toggle').click();
const kinds = await page.locator('.chip').evaluateAll((chips) => chips.map((chip) => chip.dataset.kind));
await page.locator('#levels-toggle').click();
const firsts = [...new Set(kinds)].map((kind) => kinds.indexOf(kind));
for (let index = 0; index < kinds.length; index++) await capture(index, 'phone');
const grayscale = await page.addStyleTag({ content: '#scene {filter:grayscale(1)}' });
for (const index of firsts) await capture(index, 'gray');
await grayscale.evaluate(element => element.remove());
await page.setViewportSize({ width: 1365, height: 900 });
for (const index of firsts) await capture(index, 'desktop');
writeFileSync(`${out}/browser-diagnostics.json`, JSON.stringify(errors, null, 2));
await browser.close();
if (Object.values(errors).some(values => values.length)) throw new Error(JSON.stringify(errors));
