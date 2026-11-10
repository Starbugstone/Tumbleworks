import { enterGame } from '../fixtures/picker';
import { expect, test } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';

/**
 * CI runs this against the real hosting build under Apache, as the last deploy gate; the full
 * suite runs it on the dev server. Production has no debug hook, so it finds its tap target
 * through the guide's hand, which sits on a real crate on a first visit.
 */
test('the site boots, draws the toy and takes a real tap', async ({ page }) => {
  const problems: string[] = [];
  page.on('pageerror', (error) => problems.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') problems.push(message.text()); });
  page.on('response', (response) => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`); });

  await page.goto('/');
  await enterGame(page);
  await expect(page.locator('#boot')).toBeHidden({ timeout: 60_000 });
  await expect(page.locator('#level-name')).not.toBeEmpty();

  // At this viewport an undrawn canvas under the HUD is about 100 KB and the lit board about 800 KB.
  expect((await page.locator('#scene').screenshot()).length).toBeGreaterThan(300_000);

  const pointer = page.locator('#guide-pointer');
  await expect(pointer).toBeVisible();
  const instruction = await page.locator('#guide-text').textContent();
  const target = await pointer.evaluate((element) => ({ x: parseFloat(element.style.left), y: parseFloat(element.style.top) }));
  await page.touchscreen.tap(target.x, target.y);
  await expect(page.locator('#guide-text')).not.toHaveText(instruction ?? '', { timeout: 30_000 });

  await page.locator('#levels-toggle').click();
  await expect(page.locator('.chip')).toHaveCount(CAMPAIGN.length);
  expect(problems).toEqual([]);
});
