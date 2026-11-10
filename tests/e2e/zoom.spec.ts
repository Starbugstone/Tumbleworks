import { expect, test } from '@playwright/test';
import type { App } from '../../src/view/App';

type GameWindow = Window & { tumbleworks: { app: App } };

// These checks cover our gesture policy, not native iOS zoom recognition.
// Real iPhone Safari must still verify rapid taps and pinches keep scale at 1.
for (const level of ['board-1', 'loop-1', 'tube-1']) {
  test(`${level}: the puzzle and picker cancel Safari gesture events`, async ({ page }) => {
    await page.goto(`/?try=${level}`);
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'game');
    await expect(page.locator('#boot')).toBeHidden();
    await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });

    const gestures = async (selector: string) => page.locator(selector).evaluate((element) =>
      ['gesturestart', 'gesturechange'].map((type) => {
        const event = new Event(type, { bubbles: true, cancelable: true });
        element.dispatchEvent(event);
        return { type, prevented: event.defaultPrevented };
      }));

    for (const selector of ['#scene', '#level-name', '#restart', '#faster']) {
      expect(await gestures(selector), selector).toEqual([
        { type: 'gesturestart', prevented: true }, { type: 'gesturechange', prevented: true },
      ]);
    }
    await page.locator('#levels-toggle').tap();
    await expect(page.locator('#levels')).toBeVisible();
    expect(await gestures('#chips')).toEqual([
      { type: 'gesturestart', prevented: true }, { type: 'gesturechange', prevented: true },
    ]);
    for (const selector of ['#scene', '#level-name']) {
      await expect(page.locator(selector)).toHaveCSS('touch-action', 'none');
    }
    for (const selector of ['#levels', '#chips']) {
      await expect(page.locator(selector)).toHaveCSS('touch-action', 'pan-y');
    }
    expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
  });
}

test('the puzzle gesture guard does not cancel gestures on the village', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
  const prevented = await page.locator('#scene').evaluate((element) =>
    ['gesturestart', 'gesturechange'].map((type) => {
      const event = new Event(type, { bubbles: true, cancelable: true });
      element.dispatchEvent(event);
      return event.defaultPrevented;
    }));
  expect(prevented).toEqual([false, false]);
});
