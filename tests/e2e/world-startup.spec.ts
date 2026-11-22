import { expect, test } from '@playwright/test';

test('boot skips an unseen canvas capture while later visible transitions still capture', async ({ page }) => {
  await page.addInitScript(() => {
    const captures: { bootHidden: boolean; screen?: string }[] = [];
    Object.assign(window, { startupCaptures: captures });
    const draw = CanvasRenderingContext2D.prototype.drawImage;
    CanvasRenderingContext2D.prototype.drawImage = function (...args: unknown[]) {
      if (this.canvas.id === 'journey-transition') captures.push({
        bootHidden: Boolean(document.getElementById('boot')?.hidden), screen: document.body.dataset['screen'],
      });
      return Reflect.apply(draw, this, args);
    };
  });
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 120_000 });
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
  const captures = () => page.evaluate(() => (window as unknown as { startupCaptures: { bootHidden: boolean }[] }).startupCaptures);
  expect(await captures()).toEqual([]);
  await page.locator('#journey-transition').waitFor({ state: 'hidden' });
  await page.locator('.wv-play').tap();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'game');
  expect((await captures()).length).toBeGreaterThan(0);
  expect((await captures()).every(row => row.bootHidden)).toBe(true);
});


test('offers Retry during a stalled boot and retries the same campaign URL', async ({ page }) => {
  await page.clock.install();
  const main = /\/(?:src\/main\.ts|assets\/main-[^/]+\.js)(?:\?.*)?$/;
  let requested = 0;
  let release!: () => void;
  const stalled = new Promise<void>(resolve => { release = resolve; });
  await page.route(main, async route => {
    requested++;
    await stalled;
    await route.abort().catch(() => {});
  });
  try {
    await page.goto('/?diagnostics=1', {waitUntil:'domcontentloaded'});
    await expect.poll(() => requested).toBe(1);
    const retry = page.locator('#boot-retry');
    await expect(retry).toBeHidden();
    await page.clock.fastForward(15_000);
    await expect(retry).toBeVisible();
    await expect(page.locator('#boot-message')).toHaveText('Still loading. You can wait or start over.');
    await retry.tap();
    await expect.poll(() => requested).toBe(2);
    await expect(page).toHaveURL(/\/\?diagnostics=1$/);
  } finally {
    release();
  }
});
