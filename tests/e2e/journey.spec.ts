import { expect, test, type Page } from '@playwright/test';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { availableTubeMoves, TubeRules } from '../../src/puzzles/rules';
import type { App } from '../../src/view/App';
import { CAMPAIGN } from '../../src/campaign';
import { FUNNEL_WITNESSES, LOOP_JAMS, LOOP_WITNESSES } from '../witnesses';

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
  // Under a loaded machine a synthetic touch can fail to register; retry only when the board did not react at all.
  const reaction = (snapshot: Record<string, unknown>) => JSON.stringify([snapshot['busy'], snapshot['status'], snapshot['pending'], snapshot['occupancy'], snapshot['moves'], snapshot['selected']]);
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = reaction(await state(page));
    await page.touchscreen.tap(point.x, point.y);
    if (reaction(await state(page)) !== before) break;
    const why = await page.evaluate(({ x, y, id }) => {
      const app = (window as unknown as GameWindow).tumbleworks.app;
      const under = document.elementFromPoint(x, y);
      return JSON.stringify({ picked: app.runtime.pick(x, y), under: under ? `${under.tagName}#${under.id}` : null, target: app.debugTargets()[id], state: app.debugState() });
    }, { x: point.x, y: point.y, id: target });
    console.log(`tap on ${target} did not register (attempt ${attempt + 1}): ${why}`);
  }
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

/** Ninety levels take too long for one worker, so the campaign is played in slices that run in parallel. */
const SLICES = 3;
const sliceBounds = (slice: number): [number, number] => {
  const size = Math.ceil(CAMPAIGN.length / SLICES);
  return [slice * size, Math.min(CAMPAIGN.length, (slice + 1) * size)];
};

test.describe('the whole campaign completes through real touch input', () => {
  test.describe.configure({ mode: 'parallel' });
  for (let slice = 0; slice < SLICES; slice++) {
    const [first, last] = sliceBounds(slice);
    test(`levels ${first + 1} to ${last} complete and record their progress`, async ({ page }) => {
      test.setTimeout(1_500_000);
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('/');
      await ready(page);
      await page.locator('#levels-toggle').click();
      await expect(page.locator('.chip')).toHaveCount(CAMPAIGN.length);
      await page.locator('#levels-toggle').click();
      if (first > 0) await select(page, first);
      for (let index = first; index < last; index++) {
        expect((await state(page)).levelIndex).toBe(index);
        // A level may start with trucks loading from the ring or marbles settling: let it come to rest before the first tap.
        await settle(page);
        await page.screenshot({ path: `output/current/campaign-level${index + 1}.png` });
        await solve(page, index);
        await expect(page.locator(`.chip[data-level="${index}"]`)).toHaveText('✓');
        await expect(page.locator('#card')).toBeVisible();
        if (index < CAMPAIGN.length - 1) await page.getByRole('button', { name: 'Next level', exact: true }).click();
      }
      if (last === CAMPAIGN.length) await expect(page.locator('#card-title')).toHaveText('Workshop complete!');
      await page.reload();
      await ready(page);
      await page.locator('#levels-toggle').click();
      const chips = await page.locator('.chip').allTextContents();
      expect(chips.slice(first, last)).toEqual(Array(last - first).fill('✓'));
      expect(chips.filter((text) => text === '✓')).toHaveLength(last - first);
      expect(errors).toEqual([]);
    });
  }
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

  const jammable = CAMPAIGN.find((level) => level.kind === 'loop' && LOOP_JAMS[level.id]);
  if (!jammable) throw new Error('No Loop Sort level in the campaign has a losing order');
  await select(page, levelIndex(jammable.id));
  for (const letter of LOOP_JAMS[jammable.id] ?? '') await tap(page, `lane${letter.charCodeAt(0) - 65}`);
  expect((await state(page)).status).toBe('jammed');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect((await state(page)).status).toBe('playing');

  // The first Tube Sort board that can be jammed in one move, found from the rules rather than hard-coded.
  const trap = TUBE_BOARDS.filter((board) => CAMPAIGN.some((level) => level.id === board.id)).flatMap((board) => availableTubeMoves(board, { tubes: board.tubes.map((tube) => [...tube]) })
    .filter((move) => { const rules = new TubeRules(board); return rules.move(move.from, move.to).ok && rules.status === 'jammed'; })
    .map((move) => ({ id: board.id, move })))[0];
  if (!trap) throw new Error('No Tube Sort board jams in one move');
  await select(page, levelIndex(trap.id));
  await tap(page, `tube${trap.move.from}`);
  await tap(page, `tube${trap.move.to}`);
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
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await ready(page);
  for (const viewport of [{ width: 1365, height: 900 }, { width: 320, height: 700 }]) {
    await page.setViewportSize(viewport);
    for (const { id } of CAMPAIGN) {
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
