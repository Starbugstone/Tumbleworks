import { chromium, devices } from 'playwright';
const url = process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180';
const level = Number(process.argv[2] ?? 0);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const shots = [];
for (const [name, options] of [['phone', devices['Pixel 7']], ['desktop', { viewport: { width: 1365, height: 900 } }]]) {
  const context = await browser.newContext(options);
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(url);
  await page.waitForFunction(() => Boolean(window.tumbleworks?.app?.runtime), undefined, { timeout: 90000 });
  await page.evaluate(() => { window.tumbleworks.app.manualClock = true; });
  await page.locator('#levels-toggle').click();
  await page.locator(`.chip[data-level="${level}"]`).click();
  await page.evaluate(() => window.tumbleworks.app.advance(1 / 60));
  await page.screenshot({ path: `output/current/peek/${name}-${level}-a-start.png` });
  if (name === 'phone') {
    const tap = async (id) => { const at = await page.evaluate((k) => window.tumbleworks.app.debugTargets()[k], id); await page.touchscreen.tap(at.x, at.y); };
    const advance = async (ticks) => page.evaluate((n) => { for (let i = 0; i < n; i++) window.tumbleworks.app.advance(1 / 60, i === n - 1); }, ticks);
    const keys = Object.keys(await page.evaluate(() => window.tumbleworks.app.debugTargets())).filter((k) => /^(supply|lane)\d+$/.test(k));
    await tap(keys[0]); await advance(28);
    await page.screenshot({ path: `output/current/peek/${name}-${level}-b-pour.png` });
    await advance(70);
    await page.screenshot({ path: `output/current/peek/${name}-${level}-c-belt.png` });
    await tap(keys[1] ?? keys[0]); await advance(120);
    await page.screenshot({ path: `output/current/peek/${name}-${level}-d-second.png` });
    await advance(400);
    await page.screenshot({ path: `output/current/peek/${name}-${level}-e-later.png` });
    console.log(JSON.stringify(await page.evaluate(() => window.tumbleworks.app.debugState())));
  }
  console.log(name, 'errors', errors);
  await context.close();
}
await browser.close();
