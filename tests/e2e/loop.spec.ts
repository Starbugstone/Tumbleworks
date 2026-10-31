import { expect, test } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';
import type { App } from '../../src/view/App';
type GameWindow = Window & { tumbleworks: { app: App } };

test('Loop Sort explains a refused tap: a full loop, a pour in progress, or a one-color truck', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime), undefined, { timeout: 60000 });
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  await page.locator('#levels-toggle').click();
  await page.locator(`.chip[data-level="${CAMPAIGN.findIndex((level) => level.id === 'loop-1')}"]`).click();
  const tap = async (id: string) => {
    const at = await page.evaluate((key) => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[key], id);
    if (!at) throw new Error(`No target ${id}`);
    await page.touchscreen.tap(at.x, at.y);
  };
  // The level opens with the loop exactly full, so the first pour has to wait for the yellow truck.
  await tap('lane0');
  await tap('lane0');
  await expect(page.locator('#message')).toContainText('The loop is full');
  const running = await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    for (let tick = 0; tick < 600; tick++) {
      app.advance(1 / 60, false);
      const state = app.debugState();
      if (Number(state.pending) > 0 && Number(state.occupancy) < 12) return true;
    }
    return false;
  });
  expect(running).toBe(true);
  await tap('lane0');
  await expect(page.locator('#message')).toHaveText('Still pouring.');
  await tap('lane1');
  await expect(page.locator('#message')).toContainText('one color');
  expect(errors).toEqual([]);
});
