import { expect, test, type Page } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import type { App } from '../../src/view/App';
import type { ColourGame } from '../fixtures/seven-colours';

// TUMBLEWORKS_URL=http://127.0.0.1:5191 npx playwright test tests/e2e/colours.spec.ts
// Fixtures are loaded by Vite only in this test, through the existing development app hook.
type GameWindow = Window & { tumbleworks: { app: App } };
const folder = 'output/current/colours';
const advance = async (page: Page, ticks: number) => page.evaluate((count) => {
  const app = (window as unknown as GameWindow).tumbleworks.app;
  for (let tick = 0; tick < count; tick++) app.advance(1 / 60, tick === count - 1);
}, ticks);
const tap = async (page: Page, target: string) => {
  const at = await page.evaluate((key) => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[key], target);
  expect(at, target).toBeTruthy();
  await page.touchscreen.tap(at!.x, at!.y);
};
const capture = async (page: Page, name: string) => {
  for (const mode of ['colour', 'grayscale']) {
    // Filter the final composed page, including WebGL and DOM, without changing materials.
    await page.evaluate((gray) => { document.documentElement.style.filter = gray ? 'grayscale(1)' : ''; }, mode === 'grayscale');
    await page.screenshot({ path: `${folder}/${name}-${mode}.png` });
  }
  await page.evaluate(() => { document.documentElement.style.filter = ''; });
};

test('seven colours on real boards, cargo, tube rails and the picker at 375×690', async ({ page }) => {
  test.setTimeout(600_000);
  await mkdir(folder, { recursive: true });
  await page.setViewportSize({ width: 375, height: 690 });
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('requestfailed', (request) => errors.push(`${request.url()}: ${request.failure()?.errorText}`));
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as GameWindow).tumbleworks?.app?.runtime));
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  // Use a non-onboarding level of the same kind so the ordinary HUD and controls remain real.
  for (const [kind, level] of [['funnel', 3], ['loop', 4], ['tube', 5]] as const) {
    await page.locator('#levels-toggle').click();
    await page.locator(`.chip[data-level="${level}"]`).click();
    await page.evaluate(async (game: ColourGame) => {
      const path = '/tests/fixtures/seven-colours.ts';
      const { installColours } = await import(/* @vite-ignore */ path);
      installColours((window as unknown as GameWindow).tumbleworks.app, game);
    }, kind);
    await capture(page, kind);
    if (kind === 'funnel') {
      await tap(page, 'supply0'); await advance(page, 140);
      await tap(page, 'supply1'); await advance(page, 350);
      expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.runtime.canUndo)).toBe(true);
      await capture(page, 'funnel-belt');
    } else if (kind === 'loop') {
      await tap(page, 'lane0'); await advance(page, 35);
      await capture(page, 'loop-pour');
    } else {
      await tap(page, 'tube5'); await tap(page, 'tube7'); await advance(page, 30);
      const state = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.runtime.inspect());
      expect(state['moves']).toBe(1);
      await capture(page, 'tube-white-transfer');
    }
    await page.locator('#undo').click();
    await advance(page, 1);
    expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.runtime.status)).toBe('playing');
  }
  await page.locator('#levels-toggle').click();
  await page.locator('#patterns').scrollIntoViewIfNeeded();
  await expect(page.locator('#patterns > span')).toHaveCount(7);
  await expect(page.locator('#patterns')).toContainText('Dots = black');
  await expect(page.locator('#patterns')).toContainText('Heart = white');
  await capture(page, 'legend');
  await page.locator('#language-fr').click();
  await expect(page.locator('#patterns')).toContainText('Points = noir');
  await expect(page.locator('#patterns')).toContainText('Cœur = blanc');
  await capture(page, 'legend-fr');
  expect(errors).toEqual([]);
});

test('seven-colour boards fit the existing desktop layout', async ({ page }) => {
  test.setTimeout(600_000);
  await mkdir(folder, { recursive: true });
  await page.setViewportSize({ width: 1365, height: 900 });
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as GameWindow).tumbleworks?.app?.runtime));
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  for (const [kind, level] of [['funnel', 3], ['loop', 4], ['tube', 5]] as const) {
    await page.locator('#levels-toggle').click();
    await page.locator(`.chip[data-level="${level}"]`).click();
    await page.evaluate(async (game: ColourGame) => {
      const path = '/tests/fixtures/seven-colours.ts';
      const { installColours } = await import(/* @vite-ignore */ path);
      installColours((window as unknown as GameWindow).tumbleworks.app, game);
    }, kind);
    const targets = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.runtime.targets());
    for (const at of Object.values(targets)) {
      expect(at.x).toBeGreaterThan(0); expect(at.x).toBeLessThan(1365);
      expect(at.y).toBeGreaterThan(44); expect(at.y).toBeLessThan(832);
    }
    await capture(page, `desktop-${kind}`);
  }
});
