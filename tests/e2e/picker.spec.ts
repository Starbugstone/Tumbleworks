import { expect, test, type Page } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import type { App } from '../../src/view/App';
import { chooseLevel, enterGame } from '../fixtures/picker';

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

test('the level picker groups levels into chapters with their completion counts', async ({ page }) => {
  await open(page, { completed: [CAMPAIGN[0]!.id, CAMPAIGN[1]!.id], current: CAMPAIGN[0]!.id });
  await page.locator('#levels-toggle').click();
  const chapters = page.locator('#chips .chapter');
  await expect(chapters).toHaveCount(Math.ceil(CAMPAIGN.length / 30));
  await expect(chapters.first()).toHaveText(`Levels 1–${Math.min(30, CAMPAIGN.length)} · 2/${Math.min(30, CAMPAIGN.length)}`);
  // A level in a later chapter is reachable by scrolling the list, and opens like any other.
  const last = CAMPAIGN.length - 1;
  await chooseLevel(page, last);
  await settle(page);
  expect((await state(page))['levelIndex']).toBe(last);
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
