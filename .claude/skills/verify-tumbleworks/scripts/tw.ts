/**
 * Drives Tumbleworks the way a player does: a phone-sized browser, real touches at the game's own
 * target points, the HUD buttons by their accessible names. Writes screenshots, state and a verdict
 * under output/current/verify/<run>/<journey>/.
 *
 * Run inside the repo's Playwright container (it reaches the dev server as game-server:5180):
 *   docker compose --profile e2e run --rm -e npm_config_cache=/app/output/.npm-cache e2e npx -y tsx@4.23.15 .claude/skills/verify-tumbleworks/scripts/tw.ts <journey> [level] [--desktop] [--run <id>]
 *
 * Journeys: doctor | win <level> | jam <level> | controls <level> | picker | render <level>
 * <level> is a stable ID (board-31, loop-41, tube-1) or a 1-based campaign number (12). A bank board outside
 * the campaign (board-200, loop-201, tube-200…) opens through the game's own development route, /?try=<id>.
 */
import { chromium, devices, type Browser, type Page } from 'playwright';
import { mkdirSync, writeFileSync, appendFileSync } from 'node:fs';
import { CAMPAIGN } from '../../../../src/campaign';
import { TUBE_BOARDS } from '../../../../src/puzzles/levels';
import { BOARDS } from '../../../../src/sim/boards';
import { LOOP_BOARDS } from '../../../../src/loop/boards';
import { FUNNEL_JAMS, FUNNEL_WITNESSES, LOOP_JAMS, LOOP_WITNESSES } from '../../../../tests/witnesses';

const URL = process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180';
const args = process.argv.slice(2);
const flag = (name: string): boolean => args.includes(`--${name}`);
const option = (name: string): string | undefined => { const at = args.indexOf(`--${name}`); return at >= 0 ? args[at + 1] : undefined; };
const positional = args.filter((arg, index) => !arg.startsWith('--') && !args[index - 1]?.startsWith('--run'));
const [journey = 'doctor', levelArg] = positional;
const run = option('run') ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

type State = Record<string, unknown> & { levelIndex: number; levelId: string; kind: string; status: string; busy: boolean; settling?: boolean; speed: number; gameFingerprint: string };
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
interface Target { readonly id: string; readonly kind: 'conveyor' | 'loop' | 'tube'; readonly index: number | null }

function target(arg: string | undefined): Target {
  if (!arg) throw new Error(`${journey} needs a level: a stable ID such as board-31, or a campaign number`);
  const index = /^\d+$/.test(arg) ? Number(arg) - 1 : CAMPAIGN.findIndex((level) => level.id === arg);
  const level = CAMPAIGN[index];
  if (level) return { id: level.id, kind: level.kind as Target['kind'], index };
  const kind = BOARDS.some((board) => board.id === arg) ? 'conveyor' : LOOP_BOARDS.some((board) => board.id === arg) ? 'loop'
    : TUBE_BOARDS.some((board) => board.id === arg) ? 'tube' : null;
  if (!kind || /^\d+$/.test(arg)) throw new Error(`No level ${arg}: neither in the ${CAMPAIGN.length}-level campaign nor in a bank`);
  return { id: arg, kind, index: null };
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

async function open(browser: Browser, level?: Target): Promise<Page> {
  const context = await browser.newContext(flag('desktop') ? { viewport: { width: 1365, height: 900 }, hasTouch: true }
    : { ...devices['Pixel 7'], viewport: { width: 375, height: 690 } });
  const page = await context.newPage();
  page.on('pageerror', (error) => failures.push(`page error: ${error.message}`));
  await page.goto(level && level.index === null ? `${URL}/?try=${level.id}` : URL);
  await page.waitForFunction(() => Boolean((window as unknown as GameWindow).tumbleworks?.app?.runtime), undefined, { timeout: 90_000, polling: 250 });
  // Software rendering draws a frame in a quarter of a second; time moves through advance() instead.
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks!.app.manualClock = true; });
  if (level?.index != null) await choose(page, level.index);
  else if (level) check((await state(page)).levelId === level.id, `?try=${level.id} opened the bank board`);
  return page;
}

/** Waits out the picker's pop-in: it opens from 80% scale, and a chip clicked mid-pop can move from under the click. */
async function pickerSettled(page: Page): Promise<void> {
  await page.locator('#levels').evaluate((element) => Promise.all(element.getAnimations().map((animation) => animation.finished)));
}

/** The level picker, as a player opens it: the level pill, then the level's chip. */
async function choose(page: Page, index: number): Promise<void> {
  await page.locator('#levels-toggle').click();
  await pickerSettled(page);
  await page.locator(`.chip[data-level="${index}"]`).click();
  await settle(page);
  check((await state(page)).levelIndex === index, `the picker opened ${CAMPAIGN[index]!.id}`);
}

function order(level: Target, kind: 'win' | 'jam'): string[] {
  const letters = (table: Record<string, string>, prefix: string) => [...(table[level.id] ?? '')].map((letter) => `${prefix}${letter.charCodeAt(0) - 65}`);
  if (level.kind === 'conveyor') return letters(kind === 'win' ? FUNNEL_WITNESSES : FUNNEL_JAMS, 'supply');
  if (level.kind === 'loop') return letters(kind === 'win' ? LOOP_WITNESSES : LOOP_JAMS, 'lane');
  if (kind === 'jam') return [];
  return (TUBE_BOARDS.find((board) => board.id === level.id)?.solution ?? []).flatMap((move) => [`tube${move.from}`, `tube${move.to}`]);
}

const journeys: Record<string, (browser: Browser) => Promise<void>> = {
  async doctor(browser) {
    const response = await fetch(URL).catch((error: Error) => error);
    check(!(response instanceof Error) && response.status === 200, `${URL} answers`);
    const page = await open(browser);
    const now = await evidence(page, 'boot');
    check(await page.locator('#boot').isHidden(), 'the boot message cleared');
    await page.locator('#levels-toggle').click();
    check(await page.locator('.chip').count() === CAMPAIGN.length, `the picker lists all ${CAMPAIGN.length} levels`);
    console.log(JSON.stringify({ url: URL, level: now.levelId, kind: now.kind, status: now.status, campaign: CAMPAIGN.length }));
  },

  async win(browser) {
    const level = target(levelArg);
    const page = await open(browser, level);
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
    check(await page.locator('#card').isVisible(), 'the ending card is up');
    check(await page.getByRole('button', { name: 'Next level', exact: true }).isVisible(), 'the card offers Next level');
    await evidence(page, 'card');
    const saved = await page.evaluate(() => localStorage.getItem('tumbleworks.progress.v1'));
    check(Boolean(saved?.includes(`"${level.id}"`)), `completion of ${level.id} is stored`);
    await page.reload();
    await page.waitForFunction(() => Boolean((window as unknown as GameWindow).tumbleworks?.app?.runtime), undefined, { timeout: 90_000, polling: 250 });
    await page.locator('#levels-toggle').click();
    check(await page.locator(`.chip[data-level="${end.levelIndex}"]`).textContent() === '✓', 'its chip shows ✓ after a reload');
    await evidence(page, 'picker-after-reload');
  },

  async jam(browser) {
    const level = target(levelArg);
    const taps = order(level, 'jam');
    if (!taps.length) { check(false, `${level.id} has no authored losing order (Tube Sort and the first two Loop Sort levels have none)`); return; }
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
    await page.locator('#levels-toggle').click();
    await evidence(page, 'picker-open');
    check(await page.locator('.chip').count() === CAMPAIGN.length, `all ${CAMPAIGN.length} levels are listed`);
    check((await page.locator('#patterns').locator('span').count()) >= 7, 'the pattern legend lists every colour');
    await page.locator('#language-fr').click();
    check(await page.getByRole('button', { name: 'Annuler', exact: true }).count() === 1, 'French relabels the controls');
    await evidence(page, 'french');
    await page.locator('#language-en').click();
    await pickerSettled(page);
    await page.locator('.chip[data-level="2"]').click();
    await settle(page);
    check((await state(page)).levelIndex === 2, 'a chip opens its level');
    await evidence(page, 'chosen');
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
dir = `output/current/verify/${run}/${journey}${levelArg ? `-${levelArg}` : ''}${flag('desktop') ? '-desktop' : ''}`;
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try { await run_(browser); } catch (error) { failures.push(`stopped: ${(error as Error).message}`); console.log(`FAIL stopped: ${(error as Error).message}`); }
await browser.close();
writeFileSync(`${dir}/result.json`, JSON.stringify({ journey, level: levelArg ?? null, run,
  evidenceKind: journey === 'render' ? 'settled-scene-census' : 'functional-journey',
  ok: failures.length === 0, failures }, null, 2));
console.log(`${failures.length ? 'FAILED' : 'OK'} ${journey}${levelArg ? ` ${levelArg}` : ''}: evidence in ${dir}`);
process.exit(failures.length ? 1 : 0);
