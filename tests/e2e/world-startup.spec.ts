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
