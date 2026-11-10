import { expect, test } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';
import type { App } from '../../src/view/App';
import { chooseLevel } from '../fixtures/picker';

type GameWindow = Window & { tumbleworks: { app: App } };
interface TruckView {
  lane: number;
  docked: boolean;
  capacity: number;
  bedLength: number;
  scale: number;
}

test.use({ viewport: { width: 375, height: 690 }, deviceScaleFactor: 1 });

test('the short-truck lesson keeps a half bed, readable shares and a working touch target', async ({ page }) => {
  const index = CAMPAIGN.findIndex((level) => level.id === 'loop-95');
  await page.goto(index < 0 ? '/?try=loop-95' : '/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  if (index >= 0) await chooseLevel(page, index);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  const before = await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    app.advance(0);
    return { state: app.debugState(), target: app.debugTargets()['lane0'], fingerprint: app.runtime.game.fingerprint() };
  });
  expect(before.state.levelId).toBe('loop-95');
  const trucks = (before.state.trucks as TruckView[]).filter((truck) => truck.docked);
  const short = trucks.find((truck) => truck.lane === 0)!;
  const full = trucks.find((truck) => truck.lane === 1)!;
  expect(short.capacity).toBe(12);
  expect(full.capacity).toBe(24);
  expect(short.bedLength).toBeCloseTo(full.bedLength / 2);
  expect(short.scale).toBe(full.scale);
  const card = page.locator('.lr-card.now:not(.leaving)[data-lane="0"]');
  await expect(card).toHaveAttribute('data-truck', '0');
  await expect(card.locator('.lr-number').first()).toHaveText('50%');
  const numbers = await card.locator('.lr-number').evaluateAll((elements) => elements.map((element) => ({
    font: parseFloat(getComputedStyle(element).fontSize), clipped: element.scrollWidth > element.clientWidth + 1,
  })));
  expect(numbers.every((number) => number.font >= 12 && !number.clipped)).toBe(true);
  expect(before.target!.x).toBeGreaterThan(24);
  expect(before.target!.x).toBeLessThan(351);
  expect(before.target!.y).toBeGreaterThan(44);
  expect(before.target!.y).toBeLessThan(622);
  await page.touchscreen.tap(before.target!.x, before.target!.y);
  const after = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.runtime.game.fingerprint());
  expect(after).not.toBe(before.fingerprint);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.runtime.game.fingerprint())).toBe(before.fingerprint);
});
