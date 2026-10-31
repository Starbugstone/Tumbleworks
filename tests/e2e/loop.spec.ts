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
  // Introductory levels have room: the second tap explains that the pour is already running.
  await tap('lane0');
  await tap('lane0');
  await expect(page.locator('#message')).toHaveText('Still pouring.');
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState().unloading)).toEqual(['pouring', null]);
  await expect(page.locator('#board-controls button').first()).toHaveText(/Unloading/);
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    for (let tick = 0; tick < 300; tick++) app.advance(1 / 60, false);
    app.advance(0);
  });
  await tap('lane0');
  await expect(page.locator('#message')).toContainText('one color');
  // Traffic pressure remains on later boards. The authored losing pours leave a visible paused tailboard.
  await page.locator('#levels-toggle').click();
  await page.locator(`.chip[data-level="${CAMPAIGN.findIndex((level) => level.id === 'loop-3')}"]`).click();
  for (const target of ['lane0', 'lane1']) {
    await tap(target);
    await page.evaluate(() => {
      const app = (window as unknown as GameWindow).tumbleworks.app;
      for (let tick = 0; tick < 5400; tick++) {
        app.advance(1 / 60, false);
        const state = app.debugState();
        if (!state.busy && !state.settling) break;
      }
      app.advance(0);
    });
  }
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState().status)).toBe('jammed');
  await expect(page.locator('#board-controls')).toContainText('Unloading paused');
  expect(errors).toEqual([]);
});
