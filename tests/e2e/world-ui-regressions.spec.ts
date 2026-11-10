import { expect, test } from '@playwright/test';

test('an unseen tutorial keeps its tap hand inside the puzzle, including after a Workshop visit', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 120_000 });
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
  await expect(page.locator('#journey-transition')).toBeHidden();
  await expect(page.locator('#guide-pointer')).toBeHidden();

  await page.locator('#world-workshop').tap();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'workshop');
  await expect(page.locator('#journey-transition')).toBeHidden();
  await expect(page.locator('#guide-pointer')).toBeHidden();
  await expect(page.locator('#instruction')).toBeHidden();

  await page.getByRole('button', { name: 'Back to the village' }).tap();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
  await expect(page.locator('#journey-transition')).toBeHidden();
  await expect(page.locator('#guide-pointer')).toBeHidden();

  await page.getByRole('button', { name: 'Play next level' }).tap();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'game');
  await expect(page.locator('#journey-transition')).toBeHidden();
  await expect(page.locator('#guide-pointer')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Skip guide', exact: true })).toBeVisible();
});
