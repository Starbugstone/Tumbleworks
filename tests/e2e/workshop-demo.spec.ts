import { expect, test } from '@playwright/test';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { PLAY_ORDER } from '../../src/campaign';

test.use({ viewport: { width: 375, height: 690 }, deviceScaleFactor: 1 });

test('the Wi-Fi demo opens the registered boards and keeps a win in the demo save', async ({ page }) => {
  const original = JSON.stringify({ current: 'board-1', completed: [], muted: true });
  await page.addInitScript(value => {
    if (localStorage.getItem('tumbleworks.progress.v1') === null) localStorage.setItem('tumbleworks.progress.v1', value);
  }, original);
  await page.goto('/demo.html');
  await page.getByRole('link', { name: 'All levels' }).tap();
  const levels = Object.values(PLAY_ORDER).flat().length;
  await expect(page.locator('#chips .chip')).toHaveCount(levels, { timeout: 60_000 });
  await expect(page.locator('#chips [aria-disabled="true"]')).toHaveCount(0);
  await page.locator('#chips .chip').last().tap();
  await expect(page.locator('#level-name')).toContainText(String(levels));
  await page.locator('#levels-toggle').tap();
  await page.locator('#map-open').tap();
  await expect(page.getByRole('link', { name: 'Tube Sort' })).toBeVisible();

  await page.goto('/?demo=tube-1');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 60_000 });
  const tubes = [[106,155], [255,155], [104,319], [261,319], [182,499]] as const;
  const lesson = TUBE_BOARDS.find(board => board.id === 'tube-1')!;
  for (const move of lesson.solution) {
    for (const index of [move.from, move.to]) {
      const [x, y] = tubes[index]!;
      await page.touchscreen.tap(x, y);
    }
  }
  await expect.poll(() => page.evaluate(() => JSON.parse(localStorage.getItem('tumbleworks.progress.v1.demo') ?? '{}').completed), { timeout: 30_000 }).toContain('tube-1');
  expect(await page.evaluate(() => localStorage.getItem('tumbleworks.progress.v1'))).toBe(original);
  await page.getByRole('button', { name: 'Back to demos' }).tap();
  await expect(page.getByRole('link', { name: 'Little Harbour' })).toBeVisible();
});
