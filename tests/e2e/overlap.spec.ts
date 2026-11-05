import { expect, test } from '@playwright/test';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import type { App } from '../../src/view/App';
import { CAMPAIGN } from '../../src/campaign';
import { chooseLevel } from '../fixtures/picker';
type GameWindow = Window & { tumbleworks: { app: App } };
test('tubes accept subsequent moves before earlier animation finishes', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  for (const id of ['tube-1']) {
    await chooseLevel(page, CAMPAIGN.findIndex((level) => level.id === id));
    const actions = TUBE_BOARDS[0]!.solution.flatMap((move) => [`tube${move.from}`, `tube${move.to}`]);
    for (const target of actions) {
      const point = await page.evaluate((key) => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[key], target);
      expect(point).toBeTruthy();
      await page.touchscreen.tap(point!.x, point!.y);
    }
    const snapshot = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
    expect(snapshot).toMatchObject({ status: 'won', busy: true, moves: TUBE_BOARDS[0]!.solution.length });
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState())).toMatchObject({ status: 'playing', busy: false });
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
  }
});
