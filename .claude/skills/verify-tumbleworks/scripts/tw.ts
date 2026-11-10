/**
 * Drives Tumbleworks the way a player does: a phone-sized browser, real touches at the game's own
 * target points, the HUD buttons by their accessible names. Writes screenshots, state and a verdict
 * under output/current/verify/<run>/<journey>/.
 *
 * Run inside the repo's Playwright container (it reaches the dev server as game-server:5180):
 *   docker compose --profile e2e run --rm -e npm_config_cache=/app/output/.npm-cache e2e npx -y tsx@4.23.15 .claude/skills/verify-tumbleworks/scripts/tw.ts <journey> [level] [--desktop] [--run <id>]
 *
 * Journeys: doctor | win <level> | jam <level> | controls <level> | picker | map | workshop <level> | render <level> | payoff board-31
 * Use --workshop with win/jam/controls/render for the exported Workshop source rather than a bank route.
 * <level> is a stable ID (board-31, loop-41, tube-1) or a 1-based campaign number (12). A bank board outside
 * the campaign (board-202, loop-201, tube-201…) opens through the game's own development route, /?try=<id>.
 */
import { chromium, devices, type Browser, type Page } from 'playwright';
import { mkdirSync, writeFileSync, appendFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import type { Machine, MachineEvent } from '../../../../src/machine/machine';
import { CAMPAIGN } from '../../../../src/campaign';
import { TUBE_BOARDS } from '../../../../src/puzzles/levels';
import { BOARDS } from '../../../../src/sim/boards';
import { LOOP_BOARDS } from '../../../../src/loop/boards';
import { WORKSHOP_LEVELS } from '../../../../src/workshop';
import { LEVELS_PER_STOP, STOPS_PER_CHAPTER } from '../../../../src/world/progression';
import { workshopProject } from '../../../../src/world/workshop-projects';
import { TUBE_VARIETY_BOARDS } from '../../../../src/puzzles/variety-boards';
import { FUNNEL_JAMS, FUNNEL_WITNESSES, LOOP_JAMS, LOOP_WITNESSES } from '../../../../tests/witnesses';
import { VARIETY_FUNNEL_JAMS, VARIETY_FUNNEL_WITNESSES, VARIETY_LOOP_JAMS, VARIETY_LOOP_WITNESSES } from '../../../../tests/variety-witnesses';
import { TUBE_VARIETY_JAMS } from '../../../../tests/puzzles/tube-variety-fixtures';

const URL = process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180';
const args = process.argv.slice(2);
const flag = (name: string): boolean => args.includes(`--${name}`);
const option = (name: string): string | undefined => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const positional = args.filter((arg, index) => !arg.startsWith('--') && !args[index - 1]?.startsWith('--run'));
const [journey = 'doctor', levelArg] = positional;
const run = option('run') ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
if (!/^[a-zA-Z0-9_-]+$/.test(run)) throw new Error('Run IDs use only letters, digits, underscores and hyphens');

type State = Record<string, unknown> & { screen: 'map' | 'game' | 'workshop' | 'film'; source: 'campaign' | 'workshop'; levelIndex: number; levelId: string; kind: string; status: string; busy: boolean; settling?: boolean; speed: number; gameFingerprint: string };
type Point = { x: number; y: number };
type GameWindow = { tumbleworks?: { app: {
  manualClock: boolean; runtime: { game: { fingerprint(): string }; render(alpha: number, seconds: number): void };
  advance(seconds: number, draw?: boolean): boolean;
  debugState(): State; debugTargets(): Record<string, Point>;
  stage: { renderer: { info: { render: { calls: number; triangles: number }; programs: unknown[] }; getPixelRatio(): number } };
} } };

const failures: string[] = [];
let dir = '';
let step = 0;

function check(ok: boolean, what: string): void {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${what}`);
  if (!ok) failures.push(what);
}

/** A level to drive: a campaign level (chosen in the picker) or a bank board (opened with ?try=). */
interface Target { readonly id: string; readonly kind: 'conveyor' | 'loop' | 'tube'; readonly index: number | null; readonly source: 'campaign' | 'bank' | 'workshop' }

function target(arg: string | undefined): Target {
  if (!arg) throw new Error(`${journey} needs a level: a stable ID such as board-31, or a campaign number`);
  if (flag('workshop') || journey === 'workshop') {
    const level = WORKSHOP_LEVELS.find(level => level.id === arg);
    if (!level) throw new Error(`No exported Workshop level ${arg}; use a stable ID from WORKSHOP_LEVELS`);
    return { id: level.id, kind: level.kind as Target['kind'], index: null, source: 'workshop' };
  }
  const index = /^\d+$/.test(arg) ? Number(arg) - 1 : CAMPAIGN.findIndex((level) => level.id === arg);
  const level = CAMPAIGN[index];
  if (level) return { id: level.id, kind: level.kind as Target['kind'], index, source: 'campaign' };
  const kind = BOARDS.some((board) => board.id === arg) ? 'conveyor' : LOOP_BOARDS.some((board) => board.id === arg) ? 'loop'
    : TUBE_BOARDS.some((board) => board.id === arg) ? 'tube' : null;
  if (!kind || /^\d+$/.test(arg)) throw new Error(`No level ${arg}: neither in the ${CAMPAIGN.length}-level campaign nor in a bank`);
  return { id: arg, kind, index: null, source: 'bank' };
}

const state = (page: Page): Promise<State> => page.evaluate(() => {
  const { app } = (window as unknown as GameWindow).tumbleworks!;
  return { ...app.debugState(), gameFingerprint: app.runtime.game.fingerprint() };
});

/** Screenshot plus the rule state at that moment: the action and its result, not only the last screen. */
async function evidence(page: Page, label: string): Promise<State> {
  const now = await state(page);
  const name = `${String(++step).padStart(2, '0')}-${label}`;
  await page.screenshot({ path: `${dir}/${name}.png` });
  appendFileSync(`${dir}/steps.jsonl`, `${JSON.stringify({ step: name, ...now })}\n`);
  return now;
}

/** Runs real ticks (the same path as a display frame) until the board rests, then draws once. */
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => {
    const { app } = (window as unknown as GameWindow).tumbleworks!;
    for (let tick = 0; tick < 60 * 90; tick++) {
      const now = app.debugState();
      if (!now.busy && !now.settling) { app.advance(0); return; }
      app.advance(1 / 60, false);
    }
    throw new Error(`The board did not come to rest: ${JSON.stringify(app.debugState())}`);
  });
}

/** A real touch at a board target's projected screen point; retried only if the board did not react at all. */
async function tap(page: Page, target: string, settleAfter = true): Promise<void> {
  await touchReady(page);
  const point = await page.evaluate((id) => (window as unknown as GameWindow).tumbleworks!.app.debugTargets()[id], target);
  if (!point) throw new Error(`No target ${target} on this board`);
  const reaction = (s: State) => JSON.stringify([s.gameFingerprint, s['selected'], s.busy, s.status]);
  for (let attempt = 0; attempt < 3; attempt++) {
    const before = reaction(await state(page));
    await page.touchscreen.tap(point.x, point.y);
    if (reaction(await state(page)) !== before) break;
  }
  if (settleAfter) await settle(page);
}

/** The transition canvas intercepts touches until its fade ends. */
async function touchReady(page: Page): Promise<void> {
  await page.locator('#journey-transition').waitFor({ state: 'hidden' });
}

async function enterGame(page: Page): Promise<void> {
  if ((await state(page)).screen === 'game') return;
  if ((await state(page)).screen !== 'map') throw new Error('Gameplay entry requires the village map');
  await page.locator('canvas[data-world-scene="ready"]').waitFor({ state: 'visible', timeout: 120_000 });
  await page.locator('.map-stop:not(:disabled)').first().tap();
  await page.waitForFunction(() => (window as unknown as GameWindow).tumbleworks!.app.debugState().screen === 'game');
  await touchReady(page);
}

async function completedIds(page: Page): Promise<string[]> {
  return page.evaluate(() => {
    const stored: unknown = JSON.parse(localStorage.getItem('tumbleworks.progress.v1') ?? '{}');
    if (!stored || typeof stored !== 'object' || !('completed' in stored) || !Array.isArray(stored.completed)) return [];
    return stored.completed.filter((id): id is string => typeof id === 'string');
  });
}

async function open(browser: Browser, level?: Target, fixtureProjectId?: string): Promise<Page> {
  const context = await browser.newContext(flag('desktop') ? { viewport: { width: 1365, height: 900 }, hasTouch: true }
    : { ...devices['Pixel 7'], viewport: { width: 375, height: 690 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => failures.push(`page error: ${error.message}`));
  // Disposable campaign milestone fixture for ordinary project gameplay/presentation only.
  // The dedicated boundary spec must prove unlocking from actual play without this fixture.
  const projectId = fixtureProjectId ?? (level?.source === 'workshop' ? level.id : undefined);
  if (projectId) {
    const project = workshopProject(projectId);
    if (!project) throw new Error(`No project milestone for ${projectId}`);
    const count = (project.chapter * STOPS_PER_CHAPTER + project.stops) * LEVELS_PER_STOP;
    if (count > CAMPAIGN.length) throw new Error(`Project ${projectId} needs unregistered campaign levels`);
    const completed = CAMPAIGN.slice(0, count).map(item => item.id);
    await page.addInitScript(ids => {
      if (!localStorage.getItem('tumbleworks.progress.v1')) {
        localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed: ids }));
      }
    }, completed);
    writeFileSync(`${dir}/fixture.json`, JSON.stringify({ kind: 'campaign-milestone-only', projectId,
      chapter: project.chapter, localBuiltStops: project.stops, completed,
      purpose: 'Disposable ordinary-gameplay fixture; not unlock proof; no Workshop completion seeded' }, null, 2));
  }
  await page.goto(level?.source === 'workshop' ? `${URL}/?workshop=${level.id}`
    : level?.source === 'bank' ? `${URL}/?try=${level.id}` : URL);
  await page.waitForFunction(() => Boolean((window as unknown as GameWindow).tumbleworks?.app?.runtime), undefined, { timeout: 90_000, polling: 250 });
  // Software rendering draws a frame in a quarter of a second; time moves through advance() instead.
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks!.app.manualClock = true; });
  if (level?.index != null) await choose(page, level.index);
  else if (level) {
    const now = await state(page);
    if (now.levelId !== level.id || now.screen !== 'game' || now.source !== (level.source === 'workshop' ? 'workshop' : 'campaign')) {
      throw new Error(`${level.source} route did not open ${level.id}: ${JSON.stringify(now)}`);
    }
    check(true, `${level.source} route opened ${level.id} in gameplay`);
  }
  await touchReady(page);
  return page;
}

/** Waits out the picker's pop-in: it opens from 80% scale, and a chip clicked mid-pop can move from under the click. */
async function pickerSettled(page: Page): Promise<void> {
  await page.locator('#levels').evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
}

/** The level picker, as a player opens it: the level pill, then the level's chip. */
async function choose(page: Page, index: number): Promise<void> {
  await enterGame(page);
  if (await page.locator('#levels').isHidden()) await page.locator('#levels-toggle').click();
  await pickerSettled(page);
  await page.locator(`.chip[data-level="${index}"]`).click();
  await page.waitForFunction((wanted) => {
    const now = (window as unknown as GameWindow).tumbleworks!.app.debugState();
    return now.screen === 'game' && now.source === 'campaign' && now.levelIndex === wanted;
  }, index);
  await touchReady(page);
  await settle(page);
  check((await state(page)).levelIndex === index, `the picker opened ${CAMPAIGN[index]!.id}`);
}

function order(level: Target, kind: 'win' | 'jam'): string[] {
  const letters = (table: Record<string, string>, prefix: string) => [...(table[level.id] ?? '')].map((letter) => `${prefix}${letter.charCodeAt(0) - 65}`);
  if (level.kind === 'conveyor') return letters(kind === 'win' ? { ...FUNNEL_WITNESSES, ...VARIETY_FUNNEL_WITNESSES }
    : { ...FUNNEL_JAMS, ...VARIETY_FUNNEL_JAMS }, 'supply');
  if (level.kind === 'loop') return letters(kind === 'win' ? { ...LOOP_WITNESSES, ...VARIETY_LOOP_WITNESSES }
    : { ...LOOP_JAMS, ...VARIETY_LOOP_JAMS }, 'lane');
  const moves = kind === 'jam' ? TUBE_VARIETY_JAMS[level.id] ?? []
    : [...TUBE_BOARDS, ...TUBE_VARIETY_BOARDS].find((board) => board.id === level.id)?.solution ?? [];
  return moves.flatMap((move) => [`tube${move.from}`, `tube${move.to}`]);
}

const journeys: Record<string, (browser: Browser) => Promise<void>> = {
  async doctor(browser) {
    const response = await fetch(URL).catch((error: Error) => error);
    check(!(response instanceof Error) && response.status === 200, `${URL} answers`);
    const page = await open(browser);
    const now = await evidence(page, 'boot');
    check(await page.locator('#boot').isHidden(), 'the boot message cleared');
    check(now.screen === 'map' && await page.locator('#world').isVisible(), 'normal boot shows the village map');
    await enterGame(page);
    await evidence(page, 'entered-first-stop');
    await page.locator('#levels-toggle').click();
    check(await page.locator('.chip').count() === CAMPAIGN.length, `the picker lists all ${CAMPAIGN.length} levels`);
    console.log(JSON.stringify({ url: URL, level: now.levelId, kind: now.kind, status: now.status, campaign: CAMPAIGN.length }));
  },

  async win(browser) {
    const level = target(levelArg);
    const page = await open(browser, level);
    const campaignIds = new Set(CAMPAIGN.map(item => item.id));
    const campaignBefore = (await completedIds(page)).filter(id => campaignIds.has(id));
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    await touchReady(page);
    await evidence(page, 'start');
    const taps = order(level, 'win');
    check(taps.length > 0, `${level.id} has an authored winning order`);
    for (const [n, target] of taps.entries()) {
      await tap(page, target);
      if (n === 0 || n === taps.length - 1 || n % 4 === 0) await evidence(page, `tap-${n + 1}-${target}`);
    }
    const end = await evidence(page, 'won');
    check(end.status === 'won', `${level.id} is won (status ${end.status})`);
    await page.waitForTimeout(600);
    const completed = await completedIds(page);
    const stopStart = level.index === null ? null : Math.floor(level.index / 3) * 3;
    const stopDone = stopStart === null || CAMPAIGN.slice(stopStart, stopStart + 3).every(item => completed.includes(item.id));
    if (level.source === 'workshop') {
      check((await state(page)).source === 'workshop', 'the win stays in the Workshop source');
      check(await page.getByRole('button', { name: 'Back to workshop', exact: true }).isVisible(), 'the win offers Back to workshop');
      check(JSON.stringify(completed.filter(id => campaignIds.has(id))) === JSON.stringify(campaignBefore), 'the Workshop win leaves campaign completion unchanged');
    } else if (stopDone) {
      check((await state(page)).screen === 'map', 'a finished stop returns to the map without crossing into another stop');
      check(await page.locator('#card').isHidden(), 'the round return clears the ending card');
    } else {
      check(await page.locator('#card').isVisible(), 'the ending card is up');
      check(await page.getByRole('button', { name: 'Next level', exact: true }).isVisible(), 'the card offers Next level within this stop');
    }
    await evidence(page, 'win-destination');
    check(completed.includes(level.id), `completion of ${level.id} is stored`);
    if (level.source === 'workshop') {
      await page.getByRole('button', { name: 'Back to workshop', exact: true }).tap();
      check((await state(page)).screen === 'workshop', 'the win action returns to the Workshop chooser');
      check(await page.locator(`[data-workshop="${level.id}"] .wv-workshop-check`).textContent() === '✓', 'the chooser marks this Workshop puzzle completed');
      await evidence(page, 'back-to-workshop');
    }
    await page.reload();
    await page.waitForFunction(() => Boolean((window as unknown as GameWindow).tumbleworks?.app?.runtime), undefined, { timeout: 90_000, polling: 250 });
    await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks!.app.manualClock = true; });
    if (level.index !== null) await enterGame(page);
    await page.locator('#levels-toggle').click();
    await pickerSettled(page);
    if (level.source === 'workshop') {
      await page.locator('#map-open').tap();
      await touchReady(page);
      await page.locator('#world-workshop').tap();
      check(await page.locator(`[data-workshop="${level.id}"] .wv-workshop-check`).textContent() === '✓', 'its Workshop chooser badge survives reload');
      check((await completedIds(page)).includes(level.id), 'Workshop completion remains stored after reload');
      await evidence(page, 'workshop-after-reload');
    } else {
      check(await page.locator(`.chip[data-level="${end.levelIndex}"]`).textContent() === '✓', 'its chip shows ✓ after a reload');
      await evidence(page, 'picker-after-reload');
    }
  },

  async jam(browser) {
    const level = target(levelArg);
    const taps = order(level, 'jam');
    if (!taps.length) { check(false, `${level.id} has no authored losing order (classic Tube Sort and the first two Loop Sort tutorials have none)`); return; }
    const page = await open(browser, level);
    for (const target of taps) await tap(page, target);
    const end = await evidence(page, 'jammed');
    check(end.status === 'jammed', `${level.id} jams (status ${end.status})`);
    check(await page.locator('#card').isVisible(), 'the jam card explains it');
    check(await page.locator('#undo').getAttribute('class').then((c) => Boolean(c?.includes('attention'))), 'Undo asks for attention');
    await page.getByRole('button', { name: 'Keep looking', exact: true }).click().catch(() => undefined);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await settle(page);
    const after = await evidence(page, 'after-undo');
    check(after.status === 'playing', `Undo brings it back to playing (status ${after.status})`);
  },

  async controls(browser) {
    const level = target(levelArg);
    const page = await open(browser, level);
    const first = order(level, 'win').slice(0, level.kind === 'tube' ? 2 : 1);
    if (!first.length) throw new Error(`${level.id} has no authored opening move for controls`);
    // Loading and picking may advance the running belt. Restart under the stopped clock gives tick zero.
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    const initial = await evidence(page, 'initial');
    check(await page.getByRole('button', { name: 'Undo', exact: true }).isDisabled(), 'Undo is disabled before any move');
    for (const target of first.slice(0, -1)) await tap(page, target, false);
    const before = await evidence(page, 'before-action');
    check(before.gameFingerprint === initial.gameFingerprint, 'selecting a source leaves the initial game state unchanged');
    await tap(page, first.at(-1)!, false);
    const accepted = await evidence(page, 'accepted-action');
    check(accepted.gameFingerprint !== before.gameFingerprint, 'the accepted action changes the game before any tick');
    check(await page.getByRole('button', { name: 'Undo', exact: true }).isEnabled(), 'the action can be undone');
    await settle(page);
    await evidence(page, 'after-move');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    // Read immediately: even a single belt tick would change the restored machine fingerprint.
    const undone = await evidence(page, 'after-undo');
    check(undone.gameFingerprint === before.gameFingerprint, 'Undo restores the complete pre-action game state');
    await page.getByRole('button', { name: 'Hint', exact: true }).click();
    await evidence(page, 'hint');
    check(await page.locator('#focus-ring').isVisible() || await page.locator('#message').isVisible(), 'Hint points at a piece or explains');
    const fast = page.getByRole('button', { name: 'Fast forward ×3 (hold)' });
    const box = (await fast.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    check((await state(page)).speed === 3 && await fast.getAttribute('aria-pressed') === 'true', 'holding ×3 runs at triple speed');
    await page.mouse.up();
    check((await state(page)).speed === 1, 'letting go returns to normal speed');
    for (const target of first) await tap(page, target, false);
    const movedAgain = await evidence(page, 'accepted-before-restart');
    check(movedAgain.gameFingerprint !== initial.gameFingerprint, 'the game has changed before Restart');
    await settle(page);
    await evidence(page, 'before-restart');
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    const restarted = await evidence(page, 'after-restart');
    check(restarted.gameFingerprint === initial.gameFingerprint && restarted.levelId === initial.levelId,
      'Restart restores the same level and complete initial game state');
    const mute = page.getByRole('button', { name: 'Sound', exact: true });
    await mute.click();
    check(await mute.getAttribute('aria-pressed') === 'true', 'Sound toggles off');
    await mute.click();
  },

  async picker(browser) {
    const page = await open(browser);
    await enterGame(page);
    await page.locator('#levels-toggle').click();
    await evidence(page, 'picker-open');
    check(await page.locator('.chip').count() === CAMPAIGN.length, `all ${CAMPAIGN.length} levels are listed`);
    check((await page.locator('#patterns').locator('span').count()) >= 7, 'the pattern legend lists every colour');
    const before = await state(page);
    await page.locator('#language-fr').click();
    check(await page.getByRole('button', { name: 'Annuler', exact: true }).count() === 1, 'French relabels the controls');
    await evidence(page, 'french');
    await page.locator('#language-en').click();
    check((await state(page)).gameFingerprint === before.gameFingerprint, 'changing language preserves the complete puzzle state');
    await pickerSettled(page);
    await page.locator('.chip[data-level="2"]').click();
    await settle(page);
    check((await state(page)).levelIndex === 2, 'a chip opens its level');
    await evidence(page, 'chosen');
  },

  async map(browser) {
    const page = await open(browser);
    check((await state(page)).screen === 'map', 'a fresh save boots to the map');
    check(await page.locator('.map-stop[data-round="0"]').isEnabled(), 'the first construction stop is available');
    check(await page.locator('.map-stop[data-round="1"]').isDisabled(), 'the next stop is locked');
    await evidence(page, 'new-valley');
    await enterGame(page);
    for (const index of [0, 1, 2]) {
      const level = target(String(index + 1));
      check((await state(page)).levelId === level.id, `the stop enters ${level.id}`);
      await page.getByRole('button', { name: 'Restart', exact: true }).click();
      const taps = order(level, 'win');
      if (!taps.length) throw new Error(`No winning order for ${level.id}`);
      for (const piece of taps) await tap(page, piece);
      check((await state(page)).status === 'won', `${level.id} wins inside the stop`);
      await evidence(page, `won-${level.id}`);
      if (index < 2) {
        await page.getByRole('button', { name: 'Next level', exact: true }).tap();
        await touchReady(page);
      }
    }
    await page.waitForFunction(() => (window as unknown as GameWindow).tumbleworks!.app.debugState().screen === 'map');
    check(await page.locator('.map-stop[data-round="0"]').getAttribute('data-status') === 'built', 'all three completions build the first stop');
    check(await page.locator('.map-stop[data-round="1"]').isEnabled(), 'the next stop opens for an explicit tap');
    const resting = await state(page);
    await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks!.app.advance(1); });
    check((await state(page)).gameFingerprint === resting.gameFingerprint, 'the map does not advance the puzzle behind it');
    await evidence(page, 'constructed-stop');
    await page.reload();
    await page.waitForFunction(() => (window as unknown as GameWindow).tumbleworks?.app?.debugState().screen === 'map', undefined, { timeout: 90_000 });
    check(await page.locator('.map-stop[data-round="0"]').getAttribute('data-status') === 'built', 'the built stop survives reload');
    await page.locator('.map-stop[data-round="1"]').tap();
    await touchReady(page);
    check((await state(page)).levelId === CAMPAIGN[3]!.id, 'tapping the next stop enters its first puzzle');
    await evidence(page, 'entered-next-stop');
  },

  async workshop(browser) {
    const level = target(levelArg);
    const page = await open(browser, undefined, level.id);
    const completedBefore = await completedIds(page);
    await page.locator('#world-workshop').tap();
    check((await state(page)).screen === 'workshop', 'the map footer opens Workshop');
    const chooser = page.getByRole('navigation', { name: 'Workshop puzzles', exact: true });
    check(await chooser.locator('.wv-experiment').count() === WORKSHOP_LEVELS.length, 'the chooser lists every exported Workshop puzzle');
    await evidence(page, 'workshop-chooser');
    await chooser.locator(`[data-workshop="${level.id}"]`).tap();
    await touchReady(page);
    const now = await evidence(page, 'workshop-game');
    check(now.levelId === level.id && now.source === 'workshop' && now.screen === 'game', 'a real chooser touch opens the exact Workshop source and stable ID');
    await page.locator('#levels-toggle').tap();
    await pickerSettled(page);
    await page.locator('#map-open').tap();
    check((await state(page)).screen === 'map', 'Valley map returns from Workshop to the village');
    check(JSON.stringify(await completedIds(page)) === JSON.stringify(completedBefore),
      'browsing Workshop leaves the campaign milestone fixture unchanged');
    await evidence(page, 'workshop-return-to-map');
  },

  async payoff(browser) {
    const level = target(levelArg);
    if (level.id !== 'board-31') throw new Error('The payoff reference journey uses board-31');
    const page = await open(browser, level);
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    for (const column of [0, 0, 1, 1]) await tap(page, `supply${column}`, false);
    await page.evaluate(() => {
      type Capture = Extract<MachineEvent, { type: 'captured' }>;
      const target = window as unknown as GameWindow & { payoffCaptures?: Capture[] };
      target.payoffCaptures = [];
      const machine = (target.tumbleworks!.app.runtime as unknown as { machine: Machine }).machine;
      const step = machine.step.bind(machine);
      machine.step = () => {
        const events = step();
        target.payoffCaptures!.push(...events.filter((e): e is Capture => e.type === 'captured' && e.dock === 1 && e.box === 0));
        return events;
      };
    });
    for (let arrival = 1; arrival <= 3; arrival++) {
      const fill = await page.evaluate(wanted => {
        const target = window as unknown as GameWindow & { payoffCaptures: { fill: number }[] };
        const { app } = target.tumbleworks!;
        for (let tick = 0; tick < 1800 && target.payoffCaptures.length < wanted; tick++) app.advance(1 / 60, false);
        app.runtime.render(1, 1 / 60);
        return target.payoffCaptures.at(-1)?.fill;
      }, arrival);
      check(fill === arrival, `arrival ${arrival} reaches the reference box`);
      await evidence(page, ['first-left', 'second-right', 'third-middle'][arrival - 1]!);
    }
    await page.evaluate(() => {
      const { app } = (window as unknown as GameWindow).tumbleworks!;
      for (let tick = 0; tick < 8; tick++) app.advance(1 / 60);
    });
    await evidence(page, 'departing-with-next-box-ready');
  },

  async render(browser) {
    const level = target(levelArg);
    const page = await open(browser, level);
    const first = order(level, 'win').slice(0, 3);
    for (const target of first) await tap(page, target);
    const info = await page.evaluate(() => {
      const { app } = (window as unknown as GameWindow).tumbleworks!;
      // Taps have settled. Render without a simulation tick, including a still Tube Sort board.
      app.runtime.render(0, 0);
      const { render, programs } = app.stage.renderer.info;
      const now = app.debugState();
      return { evidence: 'settled-scene-census', busy: now.busy, settling: now.settling ?? false,
        drawCalls: render.calls, triangles: render.triangles, programs: programs.length, pixelRatio: app.stage.renderer.getPixelRatio() };
    });
    await evidence(page, 'settled-scene');
    writeFileSync(`${dir}/render.json`, JSON.stringify(info, null, 2));
    console.log(JSON.stringify(info));
    check(!info.busy && !info.settling, 'the scene is settled');
    check(info.drawCalls > 0, 'the settled scene drew');
  },
};

const run_ = journeys[journey];
if (!run_) { console.error(`Unknown journey ${journey}. Journeys: ${Object.keys(journeys).join(', ')}`); process.exit(2); }
const baseDir = `output/current/verify/${run}/${journey}${levelArg ? `-${levelArg}` : ''}${flag('workshop') ? '-workshop' : ''}${flag('desktop') ? '-desktop' : ''}`;
dir = baseDir;
for (let attempt = 2; existsSync(dir); attempt++) dir = `${baseDir}-attempt-${attempt}`;
mkdirSync(dir, { recursive: true });
writeFileSync(`${dir}/source.json`, JSON.stringify({ startedAt: new Date().toISOString(), url: URL,
  command: process.argv.slice(2), head: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
  workingTree: execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }) }, null, 2));
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try { await run_(browser); } catch (error) { failures.push(`stopped: ${(error as Error).message}`); console.log(`FAIL stopped: ${(error as Error).message}`); }
await browser.close();
writeFileSync(`${dir}/result.json`, JSON.stringify({ journey, level: levelArg ?? null, run,
  evidenceKind: journey === 'render' ? 'settled-scene-census' : 'functional-journey',
  ok: failures.length === 0, failures }, null, 2));
console.log(`${failures.length ? 'FAILED' : 'OK'} ${journey}${levelArg ? ` ${levelArg}` : ''}: evidence in ${dir}`);
process.exit(failures.length ? 1 : 0);
