import { PHONE, DESKTOP } from '../fixtures/viewports';
import { expect, test } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';
import { LOOP_BOARDS } from '../../src/loop/boards';
import { placeLane, rosterLayout } from '../../src/loop/roster-layout';
import { LOOP_JAMS, LOOP_WITNESSES } from '../witnesses';
import type { App } from '../../src/view/App';
import { chooseLevel } from '../fixtures/picker';
type GameWindow = Window & { tumbleworks: { app: App } };

test('Loop Sort explains a refused tap: a full loop, a pour in progress, or a one-color truck', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime), undefined, { timeout: 60000 });
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  await chooseLevel(page, CAMPAIGN.findIndex((level) => level.id === 'loop-1'));
  const tap = async (id: string) => {
    const at = await page.evaluate((key) => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[key], id);
    if (!at) throw new Error(`No target ${id}`);
    await page.touchscreen.tap(at.x, at.y);
  };
  // Introductory levels have room: the second tap explains that the pour is already running.
  await tap('lane0');
  await tap('lane0');
  await expect(page.locator('#message')).toHaveText('Still pouring.');
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState().unloading)).toEqual(['pouring', null]);
  await expect(page.locator('#board-controls button').first()).toHaveText(/Unloading/);
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    for (let tick = 0; tick < 300; tick++) app.advance(1 / 60, false);
    app.advance(0);
  });
  await tap('lane0');
  await expect(page.locator('#message')).toContainText('one color');
  // Traffic pressure remains on later boards. The authored losing pours leave a visible paused tailboard.
  await chooseLevel(page, CAMPAIGN.findIndex((level) => level.id === FULL_LOOP_LEVEL));
  for (const target of [...(LOOP_JAMS[FULL_LOOP_LEVEL] ?? '')].map((letter) => `lane${letter.charCodeAt(0) - 65}`)) {
    await tap(target);
    await page.evaluate(() => {
      const app = (window as unknown as GameWindow).tumbleworks.app;
      for (let tick = 0; tick < 5400; tick++) {
        app.advance(1 / 60, false);
        const state = app.debugState();
        if (!state.busy && !state.settling) break;
      }
      app.advance(0);
    });
  }
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState().status)).toBe('jammed');
  await expect(page.locator('#board-controls')).toContainText('Unloading paused');
  expect(errors).toEqual([]);
});

const QUEUED_LEVEL = 'loop-42';
/** Its losing order fills the loop with a pour still waiting, so the tailboard shows the pause. */
const FULL_LOOP_LEVEL = 'loop-39';
const loopIndex = (id: string): number => CAMPAIGN.findIndex((level) => level.id === id);
/** Card content per lorry as the layout counts it: its stretches, plus one when it has free room. */
const linesOf = (board: (typeof LOOP_BOARDS)[number]): number[][] => board.lanes.map((line) => line.map((truck) => truck.segments.length + (truck.segments.reduce((sum, segment) => sum + segment.count, 0) < (truck.capacity ?? board.truckCapacity) ? 1 : 0)));
/** Lorries that fold behind the +n tile at a size: lanes four or more deep, on the player's phone. */
const foldedAt = (board: (typeof LOOP_BOARDS)[number], width: number, height: number): number[] => {
  const lines = linesOf(board);
  const layout = rosterLayout(lines, width, height);
  return lines.map((line) => { const from = placeLane(line, layout).foldedFrom; return from === null ? 0 : line.length - from; });
};
/** The Loop Sort levels in the campaign; a level outside it has no chip to open. */
const CAMPAIGN_LOOPS = LOOP_BOARDS.filter((board) => loopIndex(board.id) >= 0);
interface QueueBound { lane: number; slot: number; visible: boolean; left: number; right: number; top: number; bottom: number }
interface LoadState { shares: { color: string; percent: number }[]; freePercent: number }
const openGame = async (page: import('@playwright/test').Page) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime), undefined, { timeout: 60000 });
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
};
const openLevel = async (page: import('@playwright/test').Page, index: number) => {
  await chooseLevel(page, index);
  await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.advance(1 / 60));
};

test('at the player\'s phone size every number on every lorry on every level is readable and nothing clips', async ({ page }) => {
  test.setTimeout(300_000);
  await openGame(page);
  await page.setViewportSize(PHONE);
  for (const board of CAMPAIGN_LOOPS) {
    await openLevel(page, loopIndex(board.id));
    const seen = await page.evaluate(() => { const state = (window as unknown as GameWindow).tumbleworks.app.debugState() as unknown as { printedNumbers: { font: number; clipped: boolean; text: string; lane: number }[]; dockedCardHeight: number }; return { numbers: state.printedNumbers, height: state.dockedCardHeight, words: [...document.querySelectorAll('.lr')].map((el) => el.textContent ?? '').join('').replace(/[0-9%+\s]/g, '') }; });
    // Lorries folded behind the +n tile print their numbers when the tile opens, not on the cards.
    const folded = foldedAt(board, 375, 690);
    const stretches = board.lanes.reduce((sum, line, lane) => sum + line.slice(0, line.length - folded[lane]!).reduce((inner, truck) => inner + truck.segments.length, 0), 0);
    expect(seen.numbers.length, board.id).toBeGreaterThanOrEqual(stretches);
    expect(seen.words, `${board.id} prints no words`).toBe('');
    expect(seen.height, board.id).toBeGreaterThanOrEqual(40);
    for (const number of seen.numbers) {
      expect(number.font, `${board.id} lane ${number.lane} ${number.text}`).toBeGreaterThanOrEqual(11);
      expect(number.clipped, `${board.id} lane ${number.lane} ${number.text}`).toBe(false);
    }
  }
});

test('every Loop Sort level keeps its lorry cards on screen and clear of the controls', async ({ page }) => {
  test.setTimeout(900_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openGame(page);
  for (const viewport of [PHONE, DESKTOP]) {
    await page.setViewportSize(viewport);
    for (const board of CAMPAIGN_LOOPS) {
      await openLevel(page, loopIndex(board.id));
      const seen = await page.evaluate(() => {
        const app = (window as unknown as GameWindow).tumbleworks.app;
        const state = app.debugState() as { queues: unknown[][]; queueBounds: QueueBound[] };
        const rect = (id: string) => document.getElementById(id)!.getBoundingClientRect();
        const folded = [...document.querySelectorAll('.lr-fold:not([hidden])')].reduce((sum, tile) => sum + Number((tile.textContent ?? '+0').slice(1)), 0);
        return { queues: state.queues.map((line) => line.length), bounds: state.queueBounds, folded, top: rect('levels-toggle').bottom, bottom: rect('restart').top };
      });
      const where = `${board.id} at ${viewport.width}x${viewport.height}`;
      expect(seen.queues, where).toEqual(board.lanes.map((line) => line.length - 1));
      expect(seen.bounds.length + seen.folded, where).toBe(board.lanes.reduce((sum, line) => sum + line.length - 1, 0));
      if (viewport.width === 375) expect(seen.folded, where).toBe(foldedAt(board, 375, 690).reduce((sum, count) => sum + count, 0));
      for (const bound of seen.bounds) {
        const name = `${where}, lane ${bound.lane} place ${bound.slot}`;
        expect(bound.visible, name).toBe(true);
        expect(bound.left, name).toBeGreaterThanOrEqual(0);
        expect(bound.right, name).toBeLessThanOrEqual(viewport.width);
        expect(bound.top, name).toBeGreaterThanOrEqual(seen.top);
        expect(bound.bottom, name).toBeLessThanOrEqual(seen.bottom);
      }
    }
  }
  expect(errors).toEqual([]);
});

test('a level with queued lorries shows what is coming and how full each lorry is, through real taps, undo and a language change', async ({ page }) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await openGame(page);
  await openLevel(page, loopIndex(QUEUED_LEVEL));
  const board = LOOP_BOARDS.find((candidate) => candidate.id === QUEUED_LEVEL)!;
  const percents = (segments: readonly { color: string; count: number }[]) => segments.map((segment) => ({ color: segment.color, percent: Math.round(segment.count / board.truckCapacity * 100) }));
  const state = () => page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState() as { loads: LoadState[]; queues: (LoadState & { finalColor: string })[][]; status: string });
  const start = await state();
  const waiting = board.lanes[0]![1]!;
  expect(start.queues[0]?.[0]).toEqual({ finalColor: waiting.segments.at(-1)!.color, shares: percents(waiting.segments), freePercent: 0 });
  await expect(page.locator('#board-controls button').first()).toContainText('Next truck finishes with');
  await expect(page.locator('#board-controls button').first()).toContainText(`${percents(waiting.segments).at(-1)!.percent}%`);

  const before = JSON.stringify(start.queues);
  const taps = [...(LOOP_WITNESSES[QUEUED_LEVEL] ?? '')].map((letter) => letter.charCodeAt(0) - 65);
  let replaced = false;
  for (const lane of taps) {
    const at = await page.evaluate((key) => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[key], `lane${lane}`);
    await page.touchscreen.tap(at!.x, at!.y);
    replaced = await page.evaluate((queues) => {
      const app = (window as unknown as GameWindow).tumbleworks.app;
      for (let tick = 0; tick < 5400; tick++) {
        app.advance(1 / 60, false);
        const current = app.debugState() as { queues: unknown; busy: boolean; settling: boolean };
        if (JSON.stringify(current.queues) !== queues) return true;
        if (!current.busy && !current.settling) break;
      }
      return false;
    }, before);
    if (replaced) break;
  }
  expect(replaced).toBe(true);
  const moved = await state();
  expect(moved.queues.flat().length).toBe(start.queues.flat().length - 1);

  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(JSON.stringify((await state()).queues)).toBe(before);

  // Manifests are printed once per lorry, so a language change has to reprint them without restarting the puzzle.
  await page.locator('#levels-toggle').click();
  await page.locator('#language-fr').click();
  await page.locator('#levels-toggle').click();
  await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.advance(1 / 60));
  await expect(page.locator('#board-controls button').first()).toContainText('Le camion suivant termine avec');
  expect(JSON.stringify((await state()).queues)).toBe(before);
  expect(errors).toEqual([]);
});

test('the ivory card pours, a waiting card answers without pouring, and a card moves up when the lorry ahead leaves', async ({ page }) => {
  test.setTimeout(180_000);
  await openGame(page);
  await page.setViewportSize(PHONE);
  await openLevel(page, loopIndex(QUEUED_LEVEL));
  const state = () => page.evaluate(() => { const { occupancy, pending, lanes } = (window as unknown as GameWindow).tumbleworks.app.debugState() as Record<string, unknown>; return JSON.stringify({ occupancy, pending, lanes }); });
  const centre = (selector: string) => page.evaluate((query) => { const r = document.querySelector(query)!.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, selector);
  const before = await state();
  const waiting = await centre('.lr-card.waiting[data-lane="0"]');
  await page.touchscreen.tap(waiting.x, waiting.y);
  await expect(page.locator('#focus-ring')).toBeVisible();
  expect(await state()).toBe(before);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeDisabled();
  // The card that was waiting is the same element after it moves up, so it slides rather than being swapped.
  await page.evaluate(() => { const card = document.querySelector('.lr-card.waiting[data-lane="0"]') as HTMLElement & { marked?: boolean }; card.marked = true; });
  const now = await centre('.lr-card.now[data-lane="0"]');
  await page.touchscreen.tap(now.x, now.y);
  await expect.poll(state).not.toBe(before);
  const taps = [...(LOOP_WITNESSES[QUEUED_LEVEL] ?? '')].map((letter) => letter.charCodeAt(0) - 65).slice(1);
  let moved = false;
  for (const lane of [-1, ...taps]) {
    if (lane >= 0) { const at = await page.evaluate((key) => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[key], `lane${lane}`); await page.touchscreen.tap(at!.x, at!.y); }
    moved = await page.evaluate(() => { const app = (window as unknown as GameWindow).tumbleworks.app; for (let tick = 0; tick < 5400; tick++) { app.advance(1 / 60, false); const card = [...document.querySelectorAll('.lr-card.now[data-lane="0"]')].find((el) => (el as HTMLElement & { marked?: boolean }).marked); if (card) return true; const current = app.debugState() as { busy: boolean; settling: boolean }; if (!current.busy && !current.settling) break; } return false; });
    if (moved) break;
  }
  expect(moved).toBe(true);
});

// loop-58 has a lane four deep, the first campaign level whose back lorries fold on the player's phone.
test('a lorry folded behind a +n tile shows its numbers on one tap', async ({ page }) => {
  await openGame(page);
  await page.setViewportSize(PHONE);
  await openLevel(page, loopIndex('loop-58'));
  const tile = page.locator('.lr-fold:not([hidden])').first();
  await expect(tile).toBeVisible();
  const box = (await tile.boundingBox())!;
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.lr-peek .lr-number').first()).toBeVisible();
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('.lr-peek')).toHaveCount(0);
  // A tap on the open panel closes it and never reaches the lorry underneath.
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  const panel = (await page.locator('.lr-peek').boundingBox())!;
  const before = await page.evaluate(() => { const { pending, occupancy, lanes } = (window as unknown as GameWindow).tumbleworks.app.debugState() as Record<string, unknown>; return JSON.stringify({ pending, occupancy, lanes }); });
  for (const spot of [0.25, 0.5, 0.75]) {
    await page.touchscreen.tap(panel.x + panel.width * spot, panel.y + panel.height / 2);
    await expect(page.locator('.lr-peek')).toHaveCount(0);
    expect(await page.evaluate(() => { const { pending, occupancy, lanes } = (window as unknown as GameWindow).tumbleworks.app.debugState() as Record<string, unknown>; return JSON.stringify({ pending, occupancy, lanes }); })).toBe(before);
    await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
    await expect(page.locator('.lr-peek')).toHaveCount(1);
  }
});

test('all three games release GPU resources between levels', async ({ page }) => {
  test.setTimeout(180_000);
  await openGame(page);
  const stats = () => page.evaluate(() => {
    const { memory, programs } = (window as unknown as GameWindow).tumbleworks.app.stage.renderer.info;
    return { geometries: memory.geometries, textures: memory.textures, programs: programs?.length };
  });
  const rounds = [];
  for (let round = 0; round < 3; round++) {
    for (const id of ['board-57', 'loop-45', 'tube-67', 'loop-39']) await openLevel(page, CAMPAIGN.findIndex((level) => level.id === id));
    rounds.push(await stats());
  }
  expect(rounds[1]).toEqual(rounds[0]);
  expect(rounds[2]).toEqual(rounds[0]);
});
