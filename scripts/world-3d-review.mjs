import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const out = process.env.WORLD_REVIEW_OUTPUT ?? 'output/current/world-3d/browser';
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const context = await browser.newContext({ viewport: { width: 375, height: 690 }, deviceScaleFactor: 1, hasTouch: true });
  const page = await context.newPage(); const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180');
  await page.waitForFunction(() => window.tumbleworks?.app);
  await page.locator('#boot').waitFor({ state: 'hidden' });
  await page.locator('#journey-transition').waitFor({ state: 'hidden' });
  await page.screenshot({ path: `${out}/phone-start.png` });
  await page.getByRole('button', { name: 'The valley', exact: true }).click();
  await page.screenshot({ path: `${out}/phone-world.png` });
  await page.getByRole('button', { name: 'Back to the village' }).click();
  // Complete projection is a presentation fixture; no gameplay win is claimed here.
  await page.evaluate(() => {
    const app = window.tumbleworks.app;
    const progress = app.world.progress;
    const chapter = progress.chapters[0];
    const stops = chapter.stops.map(stop => ({ ...stop, completed: 3, status: 'built' }));
    const updated = { ...progress, chapters: [{ ...chapter, stops, complete: true }, ...progress.chapters.slice(1)], stops: [...stops, ...progress.stops.slice(10)] };
    app.world.show(updated, 0);
  });
  await page.screenshot({ path: `${out}/phone-built.png` });
  await page.getByRole('button', { name: 'Watch your machine' }).click();
  await page.evaluate(() => {
    const app = window.tumbleworks.app; app.manualClock = true;
    for (let i = 0; i < 180; i++) app.advance(1 / 60);
  });
  await page.screenshot({ path: `${out}/phone-run.png` });
  await page.locator('#film-skip').click();
  await page.locator('#journey-transition').waitFor({ state: 'hidden' });
  console.log(JSON.stringify({ errors, out }));
  if (errors.length) throw new Error(errors.join('\n'));
  await context.close();
} finally { await browser.close(); }
