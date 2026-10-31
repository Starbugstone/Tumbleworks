import { expect, test } from '@playwright/test';
import type { App } from '../../src/view/App';
type GameWindow = Window & { tumbleworks: { app: App } };
test('Funnel Sort accepts all trays before animation and retains a bounded belt plus funnel backlog', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  const tap = async (id: string) => {
    const at = await page.evaluate(key => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[key], id);
    await page.touchscreen.tap(at!.x, at!.y);
  };
  await tap('supply0'); await tap('supply0'); await tap('supply1');
  const state = () => page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
  expect(await state()).toMatchObject({ occupancy: 0, funnel: 18, supplies: [[], []], status: 'playing' });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await state()).toMatchObject({ occupancy: 0, funnel: 12, supplies: [[], ['green']] });
  await tap('supply1');
  const result = await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    let hadBacklog = false;
    for (let tick = 0; tick < 65 * 60; tick++) {
      app.advance(1 / 60, false);
      const snapshot = app.debugState();
      if (typeof snapshot.occupancy !== 'number' || snapshot.occupancy > 12) throw new Error('Belt overflow');
      if (snapshot.occupancy > 0 && typeof snapshot.funnel === 'number' && snapshot.funnel > 0) hadBacklog = true;
      if (snapshot.status === 'won' && !snapshot.busy) break;
    }
    app.advance(0);
    return { state: app.debugState(), hadBacklog };
  });
  expect(result.hadBacklog).toBe(true);
  expect(result.state).toMatchObject({ status: 'won', funnel: 0, occupancy: 0, recoveries: { nudges: 0, teleports: 0 } });
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await tap('supply0'); await tap('supply1'); await tap('supply0');
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    for (let i = 0; i < 15 * 60; i++) app.advance(1 / 60, false);
    app.advance(0);
  });
  expect(await state()).toMatchObject({ status: 'jammed', busy: false, occupancy: 12, funnel: 6, recoveries: { nudges: 0, teleports: 0 } });
  await expect(page.locator('#card')).toBeVisible();
  expect(errors).toEqual([]);
});
