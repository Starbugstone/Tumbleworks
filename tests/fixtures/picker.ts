import { expect, type Page } from '@playwright/test';
import type { App } from '../../src/view/App';

/**
 * Set up an arbitrary campaign board for gameplay fixtures, then exercise its real menu row.
 * Campaign navigation is tested through village stops; the player menu has only the current triple.
 */
export async function chooseLevel(page: Page, index: number, pausedUiClock = false): Promise<void> {
  const picker = page.locator('#levels');
  if (await picker.isHidden()) await page.locator('#levels-toggle').click();
  if (await page.locator(`.chip[data-level="${index}"]`).count() === 0) {
    await page.evaluate(selected => {
      const app = (window as unknown as { tumbleworks: { app: App } }).tumbleworks.app;
      app['loadBoard'](selected, 'campaign');
    }, index);
    if (pausedUiClock) await page.clock.runFor(320);
    await page.locator('#levels-toggle').click();
  }
  await expect(picker).toBeVisible();
  if (pausedUiClock) await page.clock.runFor(200);
  await picker.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
  await page.locator(`.chip[data-level="${index}"]`).click();
  if (pausedUiClock) await page.clock.runFor(320);
  await expect.poll(() => page.evaluate(() => (window as unknown as { tumbleworks: { app: { boardIndex: number } } }).tumbleworks.app.boardIndex), {
    message: `the picker opened level ${index + 1}`,
  }).toBe(index);
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'game');
  await expect(page.locator('#journey-transition')).toBeHidden();
}

/** Settings are secondary to village and round navigation. */
export async function openMenuSettings(page: Page): Promise<void> {
  if (await page.locator('#levels').isHidden()) await page.locator('#levels-toggle').click();
  if (await page.locator('#menu-secondary').isHidden()) await page.locator('#menu-settings').click();
}

/** Existing gameplay tests enter the saved board through real UI; production uses the map's first stop. */
export async function enterGame(page: Page, pausedUiClock = false): Promise<void> {
  await expect(page.locator('#boot')).toBeHidden({ timeout: 90_000 });
  // Boot can reveal the map through a UI fade before this helper opens the picker.
  if (pausedUiClock) await page.clock.runFor(320);
  if (await page.locator('body').getAttribute('data-screen') === 'map') {
    const selected = await page.evaluate(() => (window as unknown as { tumbleworks?: { app: { boardIndex: number } } }).tumbleworks?.app.boardIndex);
    if (selected !== undefined) await chooseLevel(page, selected, pausedUiClock);
    else { await page.locator('.map-stop[aria-current="step"]').click(); if (pausedUiClock) await page.clock.runFor(320); }
  }
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'game');
  await expect(page.locator('#journey-transition')).toBeHidden();
}
