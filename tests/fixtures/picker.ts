import { expect, type Page } from '@playwright/test';

/**
 * Opens a level from the level picker, as a player does, and waits until that level is the one loaded.
 * The picker pops open from 80% scale. Under a loaded machine Playwright can find a chip steady and then
 * click where it was a moment earlier, so the click lands beside it and the old level stays: wait for the
 * pop to finish first, and fail on the level actually loaded rather than on a later, stranger check.
 */
export async function chooseLevel(page: Page, index: number, pausedUiClock = false): Promise<void> {
  const picker = page.locator('#levels');
  if (await picker.isHidden()) await page.locator('#levels-toggle').click();
  await expect(picker).toBeVisible();
  await picker.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
  await page.locator(`.chip[data-level="${index}"]`).click();
  if (pausedUiClock) await page.clock.runFor(320);
  await expect.poll(() => page.evaluate(() => (window as unknown as { tumbleworks: { app: { boardIndex: number } } }).tumbleworks.app.boardIndex), {
    message: `the picker opened level ${index + 1}`,
  }).toBe(index);
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'game');
  await expect(page.locator('#journey-transition')).toBeHidden();
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
