import { expect, test } from '@playwright/test';
import type { App } from '../../src/view/App';
type GameWindow = Window & { tumbleworks: { app: App } };

test('Funnel Sort accepts every crate before animation, keeps the overflow in the funnel, and jams honestly', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime), undefined, { timeout: 60000 });
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  const state = () => page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
  // The belt runs from the moment the page loads, and a slow boot runs fewer real frames before the clock stops.
  // Crates poured together mix in the pile by design, so where the belt stands decides a few of these games:
  // from 151 start ticks, red-red-green poured at once jams from 4. Restarting with the clock stopped starts
  // every run from tick 0.
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  expect(await state()).toMatchObject({ levelId: 'board-1', tick: 0 });
  const tap = async (id: string) => {
    const at = await page.evaluate((key) => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[key], id);
    if (!at) throw new Error(`No target ${id}`);
    await page.touchscreen.tap(at.x, at.y);
  };
  const advance = (ticks: number) => page.evaluate((count) => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    for (let tick = 0; tick < count; tick++) app.advance(1 / 60, tick === count - 1);
  }, ticks);

  // Three taps in a row are all accepted immediately; nothing has reached the belt yet.
  await tap('supply0'); await tap('supply0'); await tap('supply1');
  expect(await state()).toMatchObject({ occupancy: 0, funnel: 27, supplies: [[], []], status: 'playing' });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await state()).toMatchObject({ occupancy: 0, funnel: 18, supplies: [[], ['green']] });
  await tap('supply1');
  const run = await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    let backlog = false;
    let most = 0;
    for (let tick = 0; tick < 90 * 60; tick++) {
      app.advance(1 / 60, false);
      const snapshot = app.debugState();
      const occupancy = Number(snapshot.occupancy);
      most = Math.max(most, occupancy);
      if (occupancy > 0 && Number(snapshot.funnel) > 0) backlog = true;
      if (snapshot.status === 'won' && !snapshot.busy) break;
    }
    app.advance(0);
    return { state: app.debugState(), backlog, most };
  });
  expect(run.backlog).toBe(true);
  expect(run.most).toBeLessThanOrEqual(15);
  expect(run.state).toMatchObject({ status: 'won', funnel: 0, occupancy: 0, recoveries: { nudges: 0, teleports: 0, bounces: 0 } });

  // Green before red fills the belt with two colours no dock wants: a real jam, with the rest still in the funnel.
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await tap('supply0'); await tap('supply1');
  await advance(25 * 60);
  expect(await state()).toMatchObject({ status: 'jammed', busy: false, occupancy: 15, funnel: 3, recoveries: { nudges: 0, teleports: 0, bounces: 0 } });
  await expect(page.locator('#card')).toBeVisible();
  await expect(page.locator('#card-body')).toContainText('belt is full');
  expect(errors).toEqual([]);
});
