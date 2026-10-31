import { expect, test } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';
import type { App } from '../../src/view/App';

type GameWindow = Window & { tumbleworks: { app: App } };

test('retired matching levels fall back safely without losing sorting progress or sound preference', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('tumbleworks.progress.v1')) localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({
      current: 'tray-2', completed: ['tray-1', 'connect-1', 'tube-1', 'loop-2'], muted: true,
    }));
  });
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState())).toMatchObject({ levelId: 'board-1' });
  await expect(page.getByRole('button', { name: 'Sound', exact: true })).toHaveClass(/muted/);
  await page.locator('#levels-toggle').click();
  await expect(page.locator('.chip')).toHaveCount(13);
  for (const id of ['tube-1', 'loop-2']) {
    await expect(page.locator(`.chip[data-level="${CAMPAIGN.findIndex((level) => level.id === id)}"]`)).toHaveText('✓');
  }
  await expect(page.locator('#levels')).not.toContainText(/Tray Match|Connected Match/);
});

test('lorry final-colour markers survive a pour and undo while the exposed colour changes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  await page.locator('#levels-toggle').click();
  await page.locator(`.chip[data-level="${CAMPAIGN.findIndex((level) => level.id === 'loop-1')}"]`).click();
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    for (let i = 0; i < 480; i++) app.advance(1 / 60, false);
    app.advance(0);
  });
  const before = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
  expect(before.finalColors).toEqual(['blue', 'red']);
  const at = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugTargets()['lane0']);
  if (!at) throw new Error('Missing lorry');
  await page.touchscreen.tap(at.x, at.y);
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    for (let i = 0; i < 15; i++) app.advance(1 / 60, false);
    app.advance(0);
  });
  const during = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
  expect(during.finalColors).toEqual(before.finalColors);
  expect(during.lanes).not.toEqual(before.lanes);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const undone = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
  expect(undone.finalColors).toEqual(before.finalColors);
  expect(undone.lanes).toEqual(before.lanes);
  expect(errors).toEqual([]);
});
