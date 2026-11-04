import { expect, test, type Page } from '@playwright/test';
import type { App } from '../../src/view/App';
type GameWindow = Window & { tumbleworks: { app: App } };

const tap = async (page: Page, id: string) => {
  const at = await page.evaluate((key) => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[key], id);
  await page.touchscreen.tap(at!.x, at!.y);
};
const advance = async (page: Page, ticks: number) => page.evaluate((count) => {
  const app = (window as unknown as GameWindow).tumbleworks.app;
  for (let tick = 0; tick < count; tick++) app.advance(1 / 60, false);
  app.advance(0);
}, ticks);
const state = async (page: Page) => page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());

test.use({ viewport: { width: 375, height: 690 }, deviceScaleFactor: 1 });
for (const id of [200, 201, 202]) test(`Loop Sort feature ${id}: phone input, undo and readable cards`, async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto(`/?try=loop-${id}`);
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  await advance(page, 1);
  const numbers = await page.locator('.lr-number').evaluateAll((els) => els.map((el) => ({ font: parseFloat(getComputedStyle(el).fontSize), clipped: el.scrollWidth > el.clientWidth + 1 })));
  expect(numbers.length).toBeGreaterThan(4);
  expect(numbers.every((number) => number.font >= 12 && !number.clipped)).toBe(true);
  if (id === 200) {
    const before = await state(page);
    await tap(page, 'lane0');
    expect((await state(page)).pending).toBe(before.pending);
    await expect(page.locator('#message')).toContainText('lane 2 first');
    expect(await page.locator('.lr-latch').count()).toBe(1);
    await expect(page.locator('.lr-latch b')).toHaveText('2');
    await tap(page, 'lane1'); await advance(page, 300);
    await tap(page, 'lane1'); await advance(page, 360);
    expect(await page.locator('.lr-latch').count()).toBe(0);
    await tap(page, 'undo');
    expect(await page.locator('.lr-latch').count()).toBe(1);
    await page.locator('#levels-toggle').click();
    await page.locator('#language-fr').click();
    await page.locator('#levels-toggle').click();
    await tap(page, 'lane0');
    await expect(page.locator('#message')).toContainText('Terminez d’abord');
  } else if (id === 201) {
    await expect(page.locator('.lr-card.now:not(.leaving)[data-lane="0"] .lr-number').first()).toContainText('67');
    await tap(page, 'lane0'); await advance(page, 180);
    await tap(page, 'lane0'); await advance(page, 360);
    await expect(page.locator('.lr-card.now:not(.leaving)[data-lane="0"]')).toHaveAttribute('data-truck', '1');
    await tap(page, 'undo');
    await expect(page.locator('.lr-card.now:not(.leaving)[data-lane="0"]')).toHaveAttribute('data-truck', '0');
  } else {
    await tap(page, 'hint');
    await expect(page.locator('#message')).toContainText('trucks 1 and 2');
    await tap(page, 'lane1');
    const first = await state(page);
    expect(first.pending).toBeGreaterThanOrEqual(12);
    expect(first.unloading).toEqual(['pouring', 'pouring', null]);
    await tap(page, 'lane0');
    expect((await state(page)).pending).toBe(first.pending);
    await tap(page, 'undo');
    expect((await state(page)).pending).toBe(0);
    await tap(page, 'lane0');
    expect((await state(page)).pending).toBe(first.pending);
  }
  await page.setViewportSize({ width: 1280, height: 800 });
  await advance(page, 1);
  const desktop = await page.locator('.lr-number').evaluateAll((els) => els.map((el) => ({ font: parseFloat(getComputedStyle(el).fontSize), clipped: el.scrollWidth > el.clientWidth + 1 })));
  expect(desktop.every((number) => number.font >= 12 && !number.clipped)).toBe(true);
  expect(errors).toEqual([]);
});
