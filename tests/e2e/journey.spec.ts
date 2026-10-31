import { expect, test, type Page } from '@playwright/test';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import type { App } from '../../src/view/App';
import { CAMPAIGN } from '../../src/campaign';
import { FUNNEL_WITNESSES, LOOP_WITNESSES } from '../witnesses';

type GameWindow = Window & { tumbleworks: { app: App } };
const state = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());

async function ready(page: Page): Promise<void> {
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime), undefined, { timeout: 60000 });
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
}

/** Real game ticks with rendering only at the end; this is functional verification, not an FPS benchmark. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    for (let tick = 0; tick < 60 * 90; tick++) {
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

const levelIndex = (id: string): number => {
  const index = CAMPAIGN.findIndex((level) => level.id === id);
  if (index < 0) throw new Error(`No campaign level ${id}`);
  return index;
};

async function select(page: Page, index: number): Promise<void> {
  await page.getByRole('button', { name: /Loop Sort|Funnel Sort|Tube Sort/ }).first().click();
  await page.locator(`.chip[data-level="${index}"]`).click();
  await settle(page);
  expect((await state(page)).levelIndex).toBe(index);
}

async function solve(page: Page, index: number): Promise<void> {
  const level = CAMPAIGN[index];
  if (!level) throw new Error(`No level ${index}`);
  const bank = (ids: readonly { id: string }[]) => ids.findIndex((board) => board.id === level.id);
  switch (level.kind) {
    case 'conveyor':
      for (const letter of FUNNEL_WITNESSES[level.id] ?? '') await tap(page, `supply${letter.charCodeAt(0) - 65}`);
      break;
    case 'loop':
      for (const letter of LOOP_WITNESSES[level.id] ?? '') await tap(page, `lane${letter.charCodeAt(0) - 65}`);
      break;
    case 'tube':
      for (const move of TUBE_BOARDS[bank(TUBE_BOARDS)]?.solution ?? []) {
        await tap(page, `tube${move.from}`);
        await tap(page, `tube${move.to}`);
      }
      break;
    default: throw new Error(`No solver for ${level.kind}`);
  }
  expect(await state(page)).toMatchObject({ status: 'won', busy: false });
}

test('all levels complete through real touch input and share campaign progression', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await ready(page);
  await page.locator('#levels-toggle').click();
  await expect(page.locator('.chip')).toHaveCount(CAMPAIGN.length);
  await page.locator('#levels-toggle').click();
  for (let index = 0; index < CAMPAIGN.length; index++) {
    expect((await state(page)).levelIndex).toBe(index);
    await page.screenshot({ path: `output/current/campaign-level${index + 1}.png` });
    await solve(page, index);
    await expect(page.locator(`.chip[data-level="${index}"]`)).toHaveText('✓');
    await expect(page.locator('#card')).toBeVisible();
    if (index < CAMPAIGN.length - 1) await page.getByRole('button', { name: 'Next level', exact: true }).click();
  }
  await expect(page.locator('#card-title')).toHaveText('Workshop complete!');
  await page.reload();
  await ready(page);
  await page.locator('#levels-toggle').click();
  await expect(page.locator('.chip')).toHaveText(Array(CAMPAIGN.length).fill('✓'));
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

  await select(page, levelIndex('loop-2'));
  await tap(page, 'lane1');
  expect((await state(page)).status).toBe('jammed');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await state(page)).status).toBe('playing');

  await select(page, levelIndex('tube-3'));
  await tap(page, 'tube1');
  await tap(page, 'tube4');
  expect((await state(page)).status).toBe('jammed');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await state(page)).toMatchObject({ status: 'playing', moves: 0 });


});

test('hints explain current board actions without playing them; restart resets the board', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  for (const id of ['board-1', 'loop-1', 'tube-1']) {
    await select(page, levelIndex(id));
    const before = await state(page);
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    await expect(page.locator('#message')).toBeVisible();
    await expect(page.locator('#focus-ring')).toBeVisible();
    expect(await state(page)).toEqual(before);
  }
  await select(page, levelIndex('tube-1'));
  await tap(page, 'tube0');
  await tap(page, 'tube3');
  expect((await state(page)).moves).toBe(1);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  expect(await state(page)).toMatchObject({ moves: 0, selected: null });
  await page.getByRole('button', { name: 'Sound', exact: true }).click();
  await page.reload();
  await ready(page);
  expect((await state(page)).levelId).toBe('tube-1');
  await expect(page.getByRole('button', { name: 'Sound', exact: true })).toHaveClass(/muted/);
});

test('desktop and narrow-phone boards keep targets and controls inside the viewport', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await ready(page);
  for (const viewport of [{ width: 1365, height: 900 }, { width: 320, height: 700 }]) {
    await page.setViewportSize(viewport);
    for (const id of ['board-1', 'loop-1', 'tube-1', 'board-3', 'loop-4', 'tube-3', 'board-5', 'loop-5']) {
      const index = levelIndex(id);
      await select(page, index);
      const targets = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugTargets());
      for (const [key, point] of Object.entries(targets)) {
        if (key === 'card') continue;
        expect(point.x, `${index} ${key}`).toBeGreaterThan(0);
        expect(point.x).toBeLessThan(viewport.width);
        expect(point.y).toBeGreaterThan(0);
        expect(point.y).toBeLessThan(viewport.height);
      }
      await page.screenshot({ path: `output/current/${viewport.width}-level${index + 1}.png` });
    }
    await select(page, levelIndex('tube-1'));
    await solve(page, levelIndex('tube-1'));
  }
  expect(errors).toEqual([]);
});

test('storage write failure still records completion and allows the next level in the session', async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(Storage.prototype, 'setItem', { value() { throw new DOMException('Quota exceeded', 'QuotaExceededError'); } });
  });
  await page.goto('/');
  await ready(page);
  const tube = levelIndex('tube-1');
  await select(page, tube);
  await solve(page, tube);
  await expect(page.locator(`.chip[data-level="${tube}"]`)).toHaveText('✓');
  await page.getByRole('button', { name: 'Next level', exact: true }).click();
  expect((await state(page)).levelId).toBe(CAMPAIGN[tube + 1]?.id);
  await expect(page.locator(`.chip[data-level="${tube}"]`)).toHaveText('✓');
});

test('keyboard board selection works after clicking the level navigator', async ({ page }) => {
  await page.goto('/');
  await ready(page);
  await select(page, levelIndex('tube-1'));
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
