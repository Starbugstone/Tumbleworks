import { expect, type Page } from '@playwright/test';

/**
 * Opens a level from the level picker, as a player does, and waits until that level is the one loaded.
 * The picker pops open from 80% scale. Under a loaded machine Playwright can find a chip steady and then
 * click where it was a moment earlier, so the click lands beside it and the old level stays: wait for the
 * pop to finish first, and fail on the level actually loaded rather than on a later, stranger check.
 */
export async function chooseLevel(page: Page, index: number): Promise<void> {
  const picker = page.locator('#levels');
  if (await picker.isHidden()) await page.locator('#levels-toggle').click();
  await expect(picker).toBeVisible();
  await picker.evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
  await page.locator(`.chip[data-level="${index}"]`).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as { tumbleworks: { app: { boardIndex: number } } }).tumbleworks.app.boardIndex), {
    message: `the picker opened level ${index + 1}`,
  }).toBe(index);
}
