import { expect, test, type Page } from '@playwright/test';
import { TUBE_BOARDS, TRAY_BOARDS } from '../../src/puzzles/levels';
import type { App } from '../../src/view/App';

type GameWindow = Window & { tumbleworks: { app: App } };
const getApp = () => (window as unknown as GameWindow).tumbleworks.app;
const state = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime), undefined, { timeout: 60000 });
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
}

/** Real game ticks with rendering only at the end; this is functional verification, not an FPS benchmark. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    for (let tick = 0; tick < 60 * 65; tick++) {
      const snapshot = app.debugState();
      if (!snapshot.busy && !snapshot.settling) { app.advance(0); return; }
      app.advance(1 / 60, false);
    }
    throw new Error(`Level did not settle: ${JSON.stringify(app.debugState())}`);
  });
}

async function tap(page: Page, target: string): Promise<void> {
  const point = await page.evaluate((id) => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[id], target);
  if (!point) throw new Error(`No target ${target}`);
  const size = page.viewportSize();
  expect(point.x, `${target} inside viewport`).toBeGreaterThan(0);
  expect(point.x).toBeLessThan(size?.width ?? 0);
  expect(point.y).toBeGreaterThan(0);
  expect(point.y).toBeLessThan(size?.height ?? 0);
  await page.touchscreen.tap(point.x, point.y);
  await settle(page);
}

async function select(page: Page, index: number): Promise<void> {
  await page.locator(`.chip[data-level="${index}"]`).click();
  await settle(page);
  expect((await state(page)).levelIndex).toBe(index);
}

async function solve(page: Page, index: number): Promise<void> {
  const difficulty = Math.floor(index / 3);
  switch (index % 3) {
    case 0:
      for (const supply of [[0, 0, 1], [0, 0, 1, 1, 2], [0, 0, 2, 1, 2, 1, 0]][difficulty] ?? []) await tap(page, `supply${supply}`);
      break;
    case 1:
      for (const move of TUBE_BOARDS[difficulty]?.solution ?? []) {
        await tap(page, `tube${move.from}`);
        await tap(page, `tube${move.to}`);
      }
      break;
    case 2:
      for (const piece of TRAY_BOARDS[difficulty]?.solution ?? []) await tap(page, `piece${piece}`);
      break;
  }
  expect(await state(page)).toMatchObject({ status: 'won', busy: false });
}

test('all nine levels complete through real touch input and share campaign progression', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await ready(page);
  await expect(page.locator('.chip')).toHaveCount(9);
  for (let index = 0; index < 9; index++) {
    expect((await state(page)).levelIndex).toBe(index);
    await page.screenshot({ path: `output/poc9/campaign-level${index + 1}.png` });
    await solve(page, index);
    await expect(page.locator(`.chip[data-level="${index}"]`)).toHaveText('✓');
    await expect(page.locator('#card')).toBeVisible();
    if (index < 8) await page.getByRole('button', { name: 'Next level', exact: true }).click();
  }
  await expect(page.locator('#card-title')).toHaveText('Workshop complete!');
  await page.reload();
  await ready(page);
  await expect(page.locator('.chip')).toHaveText(Array(9).fill('✓'));
  expect(errors).toEqual([]);
});

test('each ruleset recovers from a real jam through the shared undo button', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await tap(page, 'supply0');
  await tap(page, 'supply1');
  expect((await state(page)).status).toBe('jammed');
  await expect(page.locator('#card')).toBeVisible();
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await state(page)).status).toBe('playing');
  await expect(page.locator('#card')).toBeHidden();

  await select(page, 7);
  await tap(page, 'tube1');
  await tap(page, 'tube4');
  expect((await state(page)).status).toBe('jammed');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await state(page)).toMatchObject({ status: 'playing', moves: 0 });

  await select(page, 2);
  for (const piece of [8, 0, 9, 2, 10, 4, 11]) await tap(page, `piece${piece}`);
  expect(await state(page)).toMatchObject({ status: 'jammed', moves: 7 });
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await state(page)).toMatchObject({ status: 'playing', moves: 6 });
  await tap(page, 'piece1');
  expect(await state(page)).toMatchObject({ status: 'playing', moves: 7 });
  expect((await state(page)).rack).toHaveLength(4);
});

test('hints explain current board actions without playing them; restart resets the board', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  for (const index of [0, 1, 2]) {
    await select(page, index);
    const before = await state(page);
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    await expect(page.locator('#message')).toBeVisible();
    await expect(page.locator('#focus-ring')).toBeVisible();
    expect(await state(page)).toEqual(before);
  }
  await tap(page, 'piece8');
  expect((await state(page)).moves).toBe(1);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  expect(await state(page)).toMatchObject({ moves: 0, rack: [] });
  await page.getByRole('button', { name: 'Sound', exact: true }).click();
  await page.reload();
  await ready(page);
  expect((await state(page)).levelId).toBe('tray-1');
  await expect(page.getByRole('button', { name: 'Sound', exact: true })).toHaveClass(/muted/);
});

test('desktop and narrow-phone boards keep targets and controls inside the viewport', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await ready(page);
  for (const viewport of [{ width: 1365, height: 900 }, { width: 320, height: 700 }]) {
    await page.setViewportSize(viewport);
    for (const index of [0, 1, 2, 6, 7, 8]) {
      await select(page, index);
      const targets = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugTargets());
      for (const [key, point] of Object.entries(targets)) {
        if (key === 'card') continue;
        expect(point.x, `${index} ${key}`).toBeGreaterThan(0);
        expect(point.x).toBeLessThan(viewport.width);
        expect(point.y).toBeGreaterThan(0);
        expect(point.y).toBeLessThan(viewport.height);
      }
      await page.screenshot({ path: `output/poc9/${viewport.width}-level${index + 1}.png` });
    }
    await select(page, 1);
    await solve(page, 1);
  }
  expect(errors).toEqual([]);
});

test('storage write failure still records completion and allows the next level in the session', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'setItem', { value() { throw new DOMException('Quota exceeded', 'QuotaExceededError'); } });
  });
  await page.goto('/');
  await ready(page);
  await select(page, 1);
  await solve(page, 1);
  await expect(page.locator('.chip[data-level="1"]')).toHaveText('✓');
  await page.getByRole('button', { name: 'Next level', exact: true }).click();
  expect((await state(page)).levelId).toBe('tray-1');
  await expect(page.locator('.chip[data-level="1"]')).toHaveText('✓');
});

test('keyboard board selection works after clicking the level navigator', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await select(page, 1);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  expect((await state(page)).selected).toBe(0);
  for (let i=0;i<3;i++) await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Enter');
  await settle(page);
  expect(await state(page)).toMatchObject({ moves: 1, selected: null });
  await page.keyboard.press('u');
  expect((await state(page)).moves).toBe(0);
  await page.keyboard.press('h');
  await expect(page.locator('#message')).toBeVisible();
});
