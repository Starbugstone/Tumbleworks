import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { App } from '../../src/view/App';
import type { Machine } from '../../src/machine/machine';
import { initPhysics } from '../../src/machine/machine';
import { TUBE_VARIETY_BOARDS } from '../../src/puzzles/variety-boards';
import { TUBE_VARIETY_JAMS } from '../puzzles/tube-variety-fixtures';
import { VARIETY_FUNNEL_JAMS, VARIETY_FUNNEL_WITNESSES, VARIETY_LOOP_JAMS, VARIETY_LOOP_WITNESSES } from '../variety-witnesses';
import { replayed } from '../replay-target';
import { CAMPAIGN } from '../../src/campaign';
import { WORKSHOP_PROJECTS } from '../../src/world/workshop-projects';

type GameWindow = Window & { tumbleworks: { app: App } };
const out = process.env.TUMBLEWORKS_VARIETY_OUTPUT ?? 'output/current/gameplay-variety/browser';
const ids = ['board-210', 'board-211', 'board-212', 'loop-210', 'loop-211', 'tube-210', 'tube-211'];
const state = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
const fingerprint = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.runtime.game.fingerprint());
async function advance(page: Page, ticks = 1) {
  await page.evaluate((count) => { const app = (window as unknown as GameWindow).tumbleworks.app; for (let n = 0; n < count; n++) app.advance(1 / 60, false); app.advance(0); }, ticks);
}
async function settle(page: Page) {
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    for (let n = 0; n < 60 * 100; n++) {
      const s = app.debugState();
      if (!s.busy && !s.settling) { app.advance(0); return; }
      app.advance(1 / 60, false);
    }
    throw new Error(`Workshop did not settle: ${JSON.stringify(app.debugState())}`);
  });
}
async function point(page: Page, key: string) {
  const at = await page.evaluate(id => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[id], key);
  expect(at, key).toBeDefined(); expect(at!.x).toBeGreaterThan(0); expect(at!.x).toBeLessThan(page.viewportSize()!.width);
  expect(at!.y).toBeGreaterThan(35); expect(at!.y).toBeLessThan(page.viewportSize()!.height - 65);
  return at!;
}
async function tap(page: Page, key: string) { const at = await point(page, key); await page.touchscreen.tap(at.x, at.y); }
async function move(page: Page, from: number, to: number) { await tap(page, `tube${from}`); await tap(page, `tube${to}`); }
/**
 * Atelier gates are live: a disposable save completes exactly the registered campaign stops a project's milestone needs
 * (chapters before it, then its threshold). This opens the project for presentation checks only; it is not proof that
 * real play unlocks it, which tests/e2e/workshop-projects.spec.ts covers. Workshop completion itself is never seeded.
 */
const milestoneIds = (id: string): string[] => {
  const project = WORKSHOP_PROJECTS.find((entry) => entry.id === id);
  if (!project) throw new Error(`No Atelier project ${id}`);
  return CAMPAIGN.slice(0, (project.chapter * 10 + project.stops) * 3).map((level) => level.id);
};
async function seedMilestone(page: Page, id: string): Promise<string[]> {
  const ids = milestoneIds(id);
  await page.addInitScript(({ ids, first }) => {
    if (!localStorage.getItem('tumbleworks.progress.v1')) localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed: ids, current: first, muted: true }));
    if (!localStorage.getItem('tumbleworks.valley.v1')) localStorage.setItem('tumbleworks.valley.v1', JSON.stringify({ seen: [], chapter: 0 }));
  }, { ids, first: CAMPAIGN[0]!.id });
  return ids;
}
/** The chooser is ready once its screen is set, the journey curtain has faded and the project's card exists. */
async function workshopReady(page: Page, id: string) {
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'workshop');
  await expect(page.locator('#journey-transition')).toBeHidden();
  await expect(page.locator(`.wv-experiment[data-workshop="${id}"]`)).toBeVisible();
}
async function capture(page: Page, id: string, name: string) {
  await page.screenshot({ path: `${out}/${id}-${name}.png` });
  writeFileSync(`${out}/${id}-${name}.json`, JSON.stringify({ state: await state(page), fingerprint: await fingerprint(page) }, null, 2));
}
async function ready(page: Page, id: string) {
  await page.waitForFunction(expected => (window as unknown as Partial<GameWindow>).tumbleworks?.app?.debugState().levelId === expected, id);
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  await page.waitForTimeout(350);
  await page.locator('#restart').click();
  expect(await state(page)).toMatchObject({ screen: 'game', source: 'workshop', levelId: id });
}
async function play(page: Page, id: string, jam = false) {
  if (id.startsWith('tube')) {
    const board = TUBE_VARIETY_BOARDS.find(b => b.id === id)!;
    for (const action of jam ? TUBE_VARIETY_JAMS[id]! : board.solution) { await move(page, action.from, action.to); await settle(page); }
  } else {
    const funnel = id.startsWith('board');
    const order = (funnel ? jam ? VARIETY_FUNNEL_JAMS : VARIETY_FUNNEL_WITNESSES : jam ? VARIETY_LOOP_JAMS : VARIETY_LOOP_WITNESSES)[id]!;
    await settle(page);
    for (const letter of order) { await tap(page, `${funnel ? 'supply' : 'lane'}${letter.charCodeAt(0) - 65}`); await settle(page); }
  }
}
async function cancelledTouch(page: Page, key: string) {
  const at = await point(page, key), before = await fingerprint(page), input = await page.context().newCDPSession(page);
  await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: at.x, y: at.y, id: 7 }] });
  await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: 370, y: 400, id: 7 }] });
  await input.send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] });
  expect(await fingerprint(page)).toBe(before); await input.detach();
}
async function causalMoment(page: Page, id: string) {
  if (id === 'board-210') {
    const initial = await fingerprint(page); await tap(page, 'supply1'); expect(await fingerprint(page)).toBe(initial);
    await tap(page, 'supply0'); await tap(page, 'supply2'); await advance(page); await tap(page, 'supply1');
    expect((await state(page)).released).toEqual([0, 2, 1]); await capture(page, id, 'shelf-open');
    await page.locator('#undo').click(); await page.locator('#undo').click(); await page.locator('#undo').click();
    expect(await fingerprint(page)).toBe(initial);
  } else if (id === 'board-211') {
    await tap(page, 'supply4'); await settle(page); await tap(page, 'supply5'); await settle(page);
    expect((await state(page)).sealsOpen).toEqual([true]);
    const before = await fingerprint(page); await tap(page, 'supply2');
    expect((await state(page)).released).toEqual([4, 5, 0, 2]);
    expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugTargets()['supply0'])).toBeUndefined();
    await advance(page, 8); await capture(page, id, 'pair-and-open-seal');
    await page.locator('#undo').click(); expect(await fingerprint(page)).toBe(before);
  } else if (id === 'board-212') {
    await tap(page, 'supply0'); await settle(page); await tap(page, 'supply0'); await settle(page);
    const held = await page.evaluate(() => { const game = (window as unknown as GameWindow).tumbleworks.app.runtime.game as Machine; return { next: game.rules.state.dockNext, boxes: game.readBoxes() }; });
    expect(held.next).toEqual([0, 0]); expect(held.boxes.find(b => b.dock === 1 && b.index === 0)).toMatchObject({ fill: 3, docked: true, departure: null });
    await capture(page, id, 'partner-waits'); const before = await fingerprint(page); await tap(page, 'supply2');
    const joint = await page.evaluate(() => {
      const app = (window as unknown as GameWindow).tumbleworks.app, game = app.runtime.game as Machine;
      for (let n = 0; n < 2400; n++) { app.advance(1 / 60, false); const pair = game.readBoxes().filter(b => b.index === 0); if (pair.some(b => b.departure !== null)) { for (let k = 0; k < 5; k++) app.advance(1 / 60, false); app.advance(0); return pair; } }
      throw new Error('Shared pallet never departed');
    });
    expect(joint.every(b => b.fill === 3)).toBe(true); expect(joint[0]!.departure).toBe(joint[1]!.departure);
    await capture(page, id, 'joint-pop'); await page.locator('#undo').click(); expect(await fingerprint(page)).toBe(before);
  } else if (id === 'loop-210') {
    const initial = await fingerprint(page); await tap(page, 'lane1'); expect(await fingerprint(page)).toBe(initial);
    await expect(page.locator('.lr-latch b')).toHaveText('1');
    for (const lane of [0, 2]) { await tap(page, `lane${lane}`); await settle(page); }
    await expect(page.locator('.lr-latch')).toHaveCount(0); await capture(page, id, 'short-unlocks-long');
    await page.locator('#undo').click(); await expect(page.locator('.lr-latch')).toHaveCount(1);
  } else if (id === 'loop-211') {
    await settle(page); const initial = await fingerprint(page);
    // Each docked linked card carries a link chip naming its partner's lane.
    await expect(page.locator('.lr-card.now .lr-link')).toHaveText(['2', '1']);
    await tap(page, 'lane1');
    expect((await state(page)).unloading).toEqual(['pouring', 'pouring', null]);
    // A tap on the partner while the pair pours says what is really happening, whichever truck is tapped.
    const paired = await fingerprint(page); await tap(page, 'lane0'); expect(await fingerprint(page)).toBe(paired);
    await expect(page.locator('#message')).toHaveText(/Still pouring|The loop is full/);
    await advance(page, 6); await capture(page, id, 'unequal-linked-pour');
    await page.locator('#undo').click(); expect(await fingerprint(page)).toBe(initial);
  } else if (id === 'tube-210') {
    await tap(page, 'tube4'); expect((await state(page)).moves).toBe(0);
    for (const action of TUBE_VARIETY_BOARDS[0]!.solution.slice(0, 3)) { await move(page, action.from, action.to); await settle(page); }
    // Finishing red opens the spare while the cup keeps its blues; the cup folds on the next, separate move.
    const initial = await fingerprint(page), from = await point(page, 'tube2'), to = await point(page, 'tube0');
    const input = await page.context().newCDPSession(page);
    const drag = async () => {
      await input.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: from.x, y: from.y, id: 8 }] });
      await input.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: to.x, y: to.y, id: 8 }] });
      await input.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    await drag(); expect(await state(page)).toMatchObject({ moves: 4, spent: [false, false, false, false, false], opened: [false, false, false, false, true] });
    await advance(page, 7); await capture(page, id, 'spare-opens');
    await page.locator('#undo').click(); expect(await fingerprint(page)).toBe(initial);
    await drag(); await settle(page); await move(page, 3, 4);
    expect(await state(page)).toMatchObject({ moves: 5, status: 'playing', spent: [false, false, false, true, false], opened: [false, false, false, false, true] });
    await settle(page); await capture(page, id, 'cup-folds-later'); await input.detach();
  } else {
    // Four reds filling a short home do not count; red's plaque over the tall home pulses on that move instead.
    const plaquePulse = () => page.evaluate(() => (((window as unknown as GameWindow).tumbleworks.app.runtime as unknown as { view: { plaques: { pulse: number }[] } }).view.plaques).map((plaque) => plaque.pulse));
    expect(await plaquePulse()).toEqual([0]);
    let pulsed = false;
    for (const action of TUBE_VARIETY_BOARDS[1]!.solution.slice(0, 7)) {
      await move(page, action.from, action.to);
      pulsed ||= (await plaquePulse())[0]! > 0;
      await settle(page);
    }
    expect(pulsed).toBe(true);
    expect((await state(page)).tubes).toEqual(expect.arrayContaining([['red', 'red', 'red', 'red']]));
    await expect(page.locator('#load')).toHaveText(/0\s*\/\s*3/); await capture(page, id, 'short-home-incomplete');
  }
}

test.use({ viewport: { width: 375, height: 690 }, deviceScaleFactor: 1, video: { mode: 'on', size: { width: 375, height: 690 } } });
test.beforeAll(async () => { mkdirSync(out, { recursive: true }); await initPhysics(); });
for (const id of ids) test(`${id} Workshop real input, causal rules, undo, jam and win`, async ({ page }) => {
  test.setTimeout(360_000);
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  const seeded = await seedMilestone(page, id);
  await page.goto('/'); await page.locator('#world-workshop').click();
  await workshopReady(page, id);
  await page.locator(`.wv-experiment[data-workshop="${id}"]`).click(); await ready(page, id);
  await page.goto(`/?workshop=${id}`); await ready(page, id);
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('tumbleworks.progress.v1')!));
  const films = await page.evaluate(() => localStorage.getItem('tumbleworks.valley.v1'));
  await capture(page, id, 'initial');
  await page.addStyleTag({ content: 'canvas { filter: grayscale(1); }' }); await capture(page, id, 'gray');
  await page.addStyleTag({ content: 'canvas { filter: none; }' });
  await cancelledTouch(page, id.startsWith('tube') ? 'tube0' : id.startsWith('loop') ? 'lane0' : 'supply0');
  await causalMoment(page, id);
  await page.locator('#restart').click(); await play(page, id, true);
  expect((await state(page)).status).toBe('jammed'); await capture(page, id, 'jam');
  await page.locator('#undo').click(); expect((await state(page)).status).toBe('playing');
  await page.locator('#restart').click(); await page.locator('#hint').click(); await expect(page.locator('#message')).not.toBeEmpty();
  await play(page, id); expect((await state(page)).status).toBe('won');
  const log = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.replay());
  const restored = replayed(log); expect(restored.fingerprint()).toBe(log.fingerprint);
  if ('world' in restored) (restored as Machine).world.free();
  writeFileSync(`${out}/${id}-win-replay.json`, JSON.stringify(log));
  await capture(page, id, 'won');
  await page.getByRole('button', { name: 'Back to workshop', exact: true }).click();
  await workshopReady(page, id);
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('tumbleworks.progress.v1')!));
  expect(after.current).toBe(saved.current); expect(after.completed).toEqual([...saved.completed, id]);
  expect(await page.evaluate(() => localStorage.getItem('tumbleworks.valley.v1'))).toBe(films);
  await expect(page.locator(`.wv-experiment[data-workshop="${id}"]`)).toHaveAttribute('data-status', 'completed');
  expect(new URL(page.url()).searchParams.has('workshop')).toBe(false);
  await page.reload();
  await page.locator('#world-workshop').click();
  await workshopReady(page, id);
  await expect(page.locator(`.wv-experiment[data-workshop="${id}"]`)).toHaveAttribute('data-status', 'completed');
  await page.locator(`.wv-experiment[data-workshop="${id}"]`).click(); await ready(page, id);
  await page.locator('#levels-toggle').click(); await expect(page.locator('.chip').filter({ hasText: /^✓$/ })).toHaveCount(seeded.length); await page.locator('#levels-toggle').click();
  await page.setViewportSize({ width: 1280, height: 800 }); await advance(page); await capture(page, id, 'desktop');
  if (id.startsWith('loop')) {
    const numbers = await page.locator('.lr-number').evaluateAll(els => els.map(el => ({ font: parseFloat(getComputedStyle(el).fontSize), clipped: el.scrollWidth > el.clientWidth + 1 })));
    expect(numbers.every(n => n.font >= 12 && !n.clipped)).toBe(true);
  }
  expect(errors).toEqual([]);
});
