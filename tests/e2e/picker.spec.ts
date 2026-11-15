import { expect, test, type Page } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import type { App } from '../../src/view/App';
import { chooseLevel, enterGame, openMenuSettings } from '../fixtures/picker';

type GameWindow = Window & { tumbleworks: { app: App } };
const state = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());

async function open(page: Page, progress: { completed: string[]; current: string }): Promise<void> {
  await page.addInitScript((saved) => localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ ...saved, muted: true })), progress);
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime), undefined, { timeout: 60000 });
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  await enterGame(page);
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    for (let tick = 0; tick < 60 * 30; tick++) {
      const snapshot = app.debugState();
      if (!snapshot['busy'] && !snapshot['settling']) { app.advance(0); return; }
      app.advance(1 / 60, false);
    }
  });
}

async function tap(page: Page, target: string): Promise<void> {
  const point = await page.evaluate((id) => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[id], target);
  if (!point) throw new Error(`No target ${target}`);
  await page.touchscreen.tap(point.x, point.y);
  await settle(page);
}

test('the menu shows only the three named levels of the current round without scrolling', async ({ page }) => {
  await open(page, { completed: [CAMPAIGN[0]!.id, CAMPAIGN[1]!.id], current: CAMPAIGN[0]!.id });
  await page.locator('#levels-toggle').click();
  await expect(page.locator('.chip')).toHaveCount(3);
  await expect(page.locator('.level-game')).toHaveText(['Funnel Sort', 'Loop Sort', 'Tube Sort']);
  await expect(page.locator('#map-open')).toBeVisible();
  await expect(page.locator('#language')).toBeHidden();
  const size = await page.locator('#levels').evaluate(el => ({ height: el.clientHeight, scroll: el.scrollHeight }));
  expect(size.height).toBeLessThan(330);
  expect(size.scroll).toBe(size.height);
});

test('the next map stop resumes its first unfinished game', async ({ page }) => {
  const start = CAMPAIGN.findIndex((level) => level.kind === 'tube');
  const level = CAMPAIGN[start]!;
  await open(page, { completed: [CAMPAIGN[0]!.id, CAMPAIGN[1]!.id, CAMPAIGN[start + 1]!.id, CAMPAIGN[start + 2]!.id], current: level.id });
  expect((await state(page))['levelIndex']).toBe(start);
  for (const move of TUBE_BOARDS.find((board) => board.id === level.id)!.solution) {
    await tap(page, `tube${move.from}`);
    await tap(page, `tube${move.to}`);
  }
  expect((await state(page))['status']).toBe('won');
  await page.evaluate(() => { const app = (window as unknown as GameWindow).tumbleworks.app; for (let tick = 0; tick < 60; tick++) app.advance(1 / 60); });
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
  await page.locator('.map-stop[data-round="1"]').click();
  await settle(page);
  expect((await state(page))['levelIndex']).toBe(start + 3);
});


test('a late round shows its actual levels and keeps completed names readable in French', async ({ page }) => {
  await open(page, { completed: CAMPAIGN.slice(0, 77).map(level => level.id), current: CAMPAIGN[77]!.id });
  await page.locator('#levels-toggle').tap();
  await expect(page.locator('.chip')).toHaveCount(3);
  expect(await page.locator('.chip').evaluateAll(rows => rows.map(row => row.getAttribute('data-level')))).toEqual(['75', '76', '77']);
  await expect(page.locator('.chip.completed')).toHaveCount(2);
  await expect(page.locator('.chip.active')).toHaveAttribute('data-level', '77');
  await page.screenshot({ path: 'output/current/menu-round26-en.png' });
  await openMenuSettings(page);
  await page.locator('#language-fr').tap();
  await page.locator('#menu-back').tap();
  await expect(page.locator('#map-open')).toContainText('Retour au village');
  await expect(page.locator('.level-game')).toHaveText(['Funnel Sort', 'Loop Sort', 'Tube Sort']);
  const bounds = await page.locator('.chip').evaluateAll(rows => rows.map(row => ({ height: row.clientHeight, clipped: row.scrollWidth > row.clientWidth })));
  expect(bounds.every(row => row.height >= 60 && !row.clipped)).toBe(true);
  await page.screenshot({ path: 'output/current/menu-round26-fr.png' });
  await page.locator('.chip[data-level="76"]').tap();
  expect((await state(page))['levelIndex']).toBe(76);
  await expect(page.locator('#levels')).toBeHidden();
});

test('current level, outside touch, Escape and keyboard focus dismiss safely without changing the puzzle', async ({ page }) => {
  await open(page, { completed: [], current: CAMPAIGN[2]!.id });
  await tap(page, 'tube0');
  const before = await state(page);
  await page.keyboard.down('f');
  await page.locator('#levels-toggle').tap();
  expect((await state(page))['speed']).toBe(1);
  await page.keyboard.up('f');
  await page.locator('.chip.active').tap();
  expect(await state(page)).toEqual(before);
  await page.locator('#levels-toggle').tap();
  await page.keyboard.press('Tab');
  await expect(page.locator('.chip').first()).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#map-open')).toBeFocused();
  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('.chip').last()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#levels-toggle')).toBeFocused();
  await expect(page.locator('#levels')).toBeHidden();
  await page.locator('#levels-toggle').tap();
  // The touch lands over a live tube behind the backdrop, below the compact panel.
  const target = await page.evaluate(() => Object.values((window as unknown as GameWindow).tumbleworks.app.runtime.targets()).sort((a, b) => b.y - a.y)[0]);
  if (!target) throw new Error('Missing tube');
  expect(target.y).toBeGreaterThan((await page.locator('#levels').boundingBox())!.y + (await page.locator('#levels').boundingBox())!.height);
  await page.touchscreen.tap(target.x, target.y);
  await expect(page.locator('#levels')).toBeHidden();
  expect(await state(page)).toEqual(before);
});

test('returning from an older round opens that round’s village', async ({ page }) => {
  await open(page, { completed: CAMPAIGN.slice(0, 60).map(level => level.id), current: CAMPAIGN[60]!.id });
  await chooseLevel(page, 2);
  await page.locator('#levels-toggle').tap();
  await page.locator('#map-open').tap();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
  expect((await state(page))['worldChapter']).toBe(0);
  await page.locator('#levels-toggle').tap();
  await expect(page.locator('#map-open')).toBeHidden();
  await expect(page.locator('.chip')).toHaveCount(3);
});

test('an unregistered trial has one actual level, without fabricated campaign neighbours', async ({ page }) => {
  await page.goto('/?try=tube-210');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 90_000 });
  await page.locator('#levels-toggle').tap();
  await expect(page.locator('.chip')).toHaveCount(1);
  await expect(page.locator('.level-game')).toHaveText('Tube Sort');
  await expect(page.locator('#menu-round')).toHaveText('Trial level');
});
