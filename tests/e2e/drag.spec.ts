import { expect, test, type Page } from '@playwright/test';
import type { App } from '../../src/view/App';
import { CAMPAIGN } from '../../src/campaign';

type GameWindow = Window & { tumbleworks: { app: App } };
const state = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
async function drag(page: Page, from: string, to: string | null, cancel = false) {
  const points = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugTargets());
  const start = points[from]!;
  const end = to ? points[to]! : { x: 5, y: 190 };
  const session = await page.context().newCDPSession(page);
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: start.x, y: start.y }] });
  for (let step = 1; step <= 8; step++) await session.send('Input.dispatchTouchEvent', {
    type: 'touchMove', touchPoints: [{ x: start.x + (end.x - start.x) * step / 8, y: start.y + (end.y - start.y) * step / 8 }],
  });
  await session.send('Input.dispatchTouchEvent', { type: cancel ? 'touchCancel' : 'touchEnd', touchPoints: [] });
  await session.detach();
}
test('touch dragging transfers a whole top group quickly and cancellation changes nothing', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  await page.locator('#levels-toggle').click();
  await page.locator(`.chip[data-level="${CAMPAIGN.findIndex((level) => level.id === 'tube-1')}"]`).click();
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  const before = await state(page);
  await drag(page, 'tube0', 'tube3', true);
  expect(await state(page)).toEqual(before);
  await drag(page, 'tube0', null);
  expect(await state(page)).toEqual(before);
  await drag(page, 'tube0', 'tube1'); // wrong top pattern
  expect(await state(page)).toEqual(before);
  await drag(page, 'tube0', 'tube3');
  expect(await state(page)).toMatchObject({ moves: 1, tubes: [['red', 'red'], ['blue', 'blue', 'green', 'green'], ['green', 'green', 'red', 'red'], ['blue', 'blue'], []] });
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    for (let i = 0; i < 35; i++) app.advance(1 / 60, false);
    app.advance(0);
  });
  expect((await state(page)).busy).toBe(false);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await state(page)).toEqual(before);
});
