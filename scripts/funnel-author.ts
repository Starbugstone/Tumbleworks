import { MachineRules } from '../src/sim/rules';
import { initPhysics, Machine } from '../src/machine/machine';
import { MIN_CAPACITY } from '../src/machine/layout';
import { hintConveyorSearch, settle } from '../src/sim/solver';
import { HINT_STATE_CAP } from './level-curve';
import { SHORT_TRAY, TRAY_COUNT } from '../src/sim/boards';
import { COLOR_CODE, COLORS, type BoardDef, type Color, type Packet } from '../src/sim/types';
import type { BeltShape } from '../src/engine/belt-path';

/**
 * Random Funnel Sort boards with a verified winning order and a losing one, for authoring:
 *   npx tsx scripts/funnel-author.ts            # evaluate every recipe below and print the TypeScript
 *   npx tsx scripts/funnel-author.ts stats      # one line of search statistics per recipe
 * Each recipe fixes the shape of a level; the seed is advanced until a board satisfies its bar.
 */
const PALETTE: readonly Color[] = COLORS;
const LETTER = (index: number): string => String.fromCharCode(65 + index);

export interface FunnelRecipe {
  readonly id: string;
  readonly title: string;
  readonly fr: string;
  readonly note: string;
  readonly colors: number;
  /** Trays per supply column, front to back. */
  readonly columns: readonly number[];
  /** How many of those trays are short trays of six. */
  readonly shorts: number;
  readonly docks: number;
  readonly capacity: number;
  readonly shape?: BeltShape;
  readonly seed: number;
  /** Share of complete pour orders that win: the bar for how trappy a board is. Lower is harder. */
  readonly win: readonly [number, number];
  /** Belt room above the smallest solvable capacity. */
  readonly slack: number;
  /** Column-by-column and round-robin pouring must both jam. */
  readonly naiveJams: boolean;
}

export interface FunnelReport {
  readonly recipe: FunnelRecipe;
  readonly seed: number;
  readonly board: BoardDef;
  readonly witness: string;
  readonly jam: string;
  readonly states: number;
  readonly lostShare: number;
  readonly winShare: number;
  readonly orders: number;
  readonly random: number;
  readonly hintMs: number;
  readonly marbles: number;
}

export function random(seed: number): () => number {
  let state = seed || 1;
  return () => { state = (state * 16807) % 2147483647; return state / 2147483647; };
}
export const shuffle = <T>(items: T[], next: () => number): T[] => {
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [items[i], items[j]] = [items[j]!, items[i]!]; }
  return items;
};

export function generate(recipe: FunnelRecipe, seed: number): BoardDef | null {
  const next = random(seed);
  const colors = PALETTE.slice(0, recipe.colors);
  const total = recipe.columns.reduce((a, b) => a + b, 0);
  if (total < colors.length) return null;
  const trayColors = shuffle([...colors, ...Array.from({ length: total - colors.length }, () => colors[Math.floor(next() * colors.length)]!)], next);
  const sizes = shuffle([...Array.from({ length: recipe.shorts }, () => SHORT_TRAY), ...Array.from({ length: total - recipe.shorts }, () => TRAY_COUNT)], next);
  const trays: Packet[] = trayColors.map((color, index) => ({ color, count: sizes[index]! }));
  const supplies: Packet[][] = [];
  let cursor = 0;
  for (const count of recipe.columns) { supplies.push(trays.slice(cursor, cursor + count)); cursor += count; }
  const boxes: Color[] = [];
  for (const color of colors) {
    const marbles = trays.filter((tray) => tray.color === color).reduce((sum, tray) => sum + tray.count, 0);
    for (let box = 0; box < marbles / 3; box++) boxes.push(color);
  }
  shuffle(boxes, next);
  const docks: Color[][] = Array.from({ length: recipe.docks }, (_, dock) => boxes.filter((_, index) => index % recipe.docks === dock));
  if (docks.some((queue) => !queue.length)) return null;
  const board: BoardDef = { id: recipe.id, title: recipe.title, beltCapacity: recipe.capacity, boxSize: 3, supplies, docks };
  return recipe.shape ? { ...board, trackShape: recipe.shape } : board;
}

function clone(rules: MachineRules): MachineRules {
  const copy = new MachineRules(rules.board);
  copy.restore(rules.snapshot());
  return copy;
}

/** Marbles of a colour are interchangeable, so the state is the trays left, the funnel queue, the belt load and the boxes. */
function stateKey(rules: MachineRules): string {
  const state = rules.state;
  const belt: Record<string, number> = {};
  for (const marble of state.marbles) if (marble.status === 'on-belt') belt[marble.color] = (belt[marble.color] ?? 0) + 1;
  const pending = state.pending.map((id) => COLOR_CODE[state.marbles[id]!.color]).join('');
  const boxes = state.dockNext.map((box, dock) => `${box}:${rules.reserved(dock, box)}`).join(',');
  return `${state.supplies.map((queue) => queue.length).join(',')}|${boxes}|${JSON.stringify(belt)}|${pending}`;
}

export interface Search {
  readonly solvable: boolean;
  readonly witness: string | null;
  readonly jam: string | null;
  readonly states: number;
  readonly lost: number;
  /** Complete pour orders and how many of them win: the share a player who taps at random would win. */
  readonly orders: number;
  readonly winning: number;
  /** The first winning orders found, for trying against the physical machine. */
  readonly witnesses: readonly string[];
  /** Probability that a player pouring uniformly at random among the columns wins. */
  readonly random: number;
}
interface Node { readonly win: boolean; readonly orders: number; readonly winning: number; readonly random: number }

/** Exhaustive over distinct settled states, with the first winning and first losing orders and order counts. */
export function search(board: BoardDef, limit = 400_000): Search {
  const memo = new Map<string, Node>();
  let witness: string | null = null;
  const witnesses: string[] = [];
  let jam: string | null = null;
  let lost = 0;
  let overflow = false;
  const walk = (rules: MachineRules, path: string): Node => {
    if (rules.status === 'won') { witness ??= path; if (witnesses.length < 12) witnesses.push(path); return { win: true, orders: 1, winning: 1, random: 1 }; }
    if (rules.status === 'jammed') { jam ??= path; return { win: false, orders: 1, winning: 0, random: 0 }; }
    const key = stateKey(rules);
    const known = memo.get(key);
    if (known) return known;
    if (memo.size >= limit) { overflow = true; return { win: false, orders: 1, winning: 0, random: 0 }; }
    let win = false;
    let orders = 0;
    let winning = 0;
    let random = 0;
    let choices = 0;
    for (let supply = 0; supply < board.supplies.length; supply++) {
      const branch = clone(rules);
      if (!branch.release(supply).ok) continue;
      if (!settle(branch)) throw new Error(`Unsettled state after ${path}${LETTER(supply)}`);
      const child = walk(branch, path + LETTER(supply));
      win ||= child.win;
      orders += child.orders;
      winning += child.winning;
      random += child.random;
      choices++;
    }
    const node = { win, orders, winning, random: choices ? random / choices : 0 };
    memo.set(key, node);
    if (!win) lost++;
    return node;
  };
  const start = new MachineRules(board);
  settle(start);
  const root = walk(start, '');
  return { solvable: root.win && !overflow, witness, witnesses, jam, states: memo.size, lost, orders: root.orders, winning: root.winning, random: root.random };
}

/** The smallest belt that still has a winning order; room never hurts a winning order, so this is monotone. */
/**
 * The floor is the smallest track of that shape that still draws cleanly. The track is sized to the capacity,
 * so every capacity at or above it fills its belt with no gaps.
 */
export const floorFor = (shape: BeltShape | undefined): number => MIN_CAPACITY[shape ?? 'oval'];
export function tighten(board: BoardDef, floor = floorFor(board.trackShape)): BoardDef {
  let low = floor;
  let high = board.beltCapacity;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (search({ ...board, beltCapacity: middle }).solvable) high = middle; else low = middle + 1;
  }
  return { ...board, beltCapacity: high };
}

/** Play a fixed order, skipping empty columns, until it ends or runs out. */
export function play(board: BoardDef, order: readonly number[]): 'won' | 'jammed' | 'playing' {
  const rules = new MachineRules(board);
  settle(rules);
  for (const supply of order) {
    if (rules.status !== 'playing') break;
    if (!rules.release(supply).ok) continue;
    settle(rules);
  }
  return rules.status;
}
export function naiveOrders(board: BoardDef): number[][] {
  const columns = board.supplies.length;
  const depth = Math.max(...board.supplies.map((queue) => queue.length));
  const columnMajor = board.supplies.flatMap((queue, index) => queue.map(() => index));
  const roundRobin = Array.from({ length: depth }, () => Array.from({ length: columns }, (_, index) => index)).flat();
  return [columnMajor, roundRobin, [...columnMajor].reverse()];
}

let physics: Promise<void> | null = null;
/**
 * The real machine with a brisk player who taps the next tray as soon as the funnel is empty, like the
 * machine tests and soak. Marbles still circulating then share the belt with the new tray, so boxes can
 * fill in a different order from the settled model; a witness has to win this way too.
 */
export async function playMachine(board: BoardDef, order: string, limitSeconds = 150, patient = false): Promise<{ status: string; clean: boolean; seconds: number }> {
  await (physics ??= initPhysics());
  const machine = new Machine(board);
  const taps = [...order].map((letter) => letter.charCodeAt(0) - 65);
  let next = 0;
  for (let tick = 0; tick < 60 * limitSeconds; tick++) {
    machine.step();
    if (machine.rules.status !== 'playing' && !machine.transferring) break;
    const tap = taps[next];
    // The browser journey waits until nothing is moving and nothing on the belt can be delivered; the tests only for an empty funnel.
    const calm = patient ? !machine.transferring && !machine.rules.canDrain() : machine.rules.funnelCount === 0 && tick % 10 === 0;
    if (tap !== undefined && calm && machine.tap(tap).ok) next += 1;
  }
  const { nudges, teleports, bounces } = machine.recoveries;
  const result = { status: machine.rules.status, clean: nudges + teleports + bounces === 0 && !machine.transferring, seconds: machine.tick / 60 };
  machine.world.free();
  return result;
}

/** A witness has to win for both kinds of player the checks emulate. */
export async function winsEitherWay(board: BoardDef, order: string): Promise<boolean> {
  for (const patient of [false, true]) {
    const outcome = await playMachine(board, order, 150, patient);
    if (outcome.status !== 'won' || !outcome.clean) return false;
  }
  return true;
}

export async function author(recipe: FunnelRecipe, attempts = 400): Promise<FunnelReport> {
  for (let seed = recipe.seed; seed < recipe.seed + attempts; seed++) {
    const loose = generate(recipe, seed);
    if (!loose || !search(loose).solvable) continue;
    const board = { ...loose, beltCapacity: Math.min(recipe.capacity, tighten(loose).beltCapacity + recipe.slack) };
    const result = search(board);
    if (!result.solvable || !result.witness || !result.jam) continue;
    const lostShare = result.lost / result.states;
    const winShare = result.winning / result.orders;
    if (winShare < recipe.win[0] || winShare > recipe.win[1]) continue;
    if (recipe.naiveJams && naiveOrders(board).some((order) => play(board, order) !== 'jammed')) continue;
    const started = Date.now();
    const hint = hintConveyorSearch(new MachineRules(board));
    // Printed for information. The gate counts states, so the same seed cannot flip with machine load.
    const hintMs = Date.now() - started;
    if (hint.supply === null || hint.states > HINT_STATE_CAP.funnel) continue;
    let witness: string | null = null;
    for (const candidate of result.witnesses) {
      if (await winsEitherWay(board, candidate)) { witness = candidate; break; }
    }
    if (!witness) continue;
    const marbles = board.supplies.flat().reduce((sum, tray) => sum + tray.count, 0);
    return { recipe, seed, board, witness, jam: result.jam, states: result.states, lostShare, winShare, orders: result.orders, random: result.random, hintMs, marbles };
  }
  throw new Error(`No board for ${recipe.id} within ${attempts} seeds`);
}

const quote = (color: Color): string => `'${color}'`;
export function emitBoard(report: FunnelReport): string {
  const { board, recipe } = report;
  const name = `BOARD_${board.id.split('-')[1]}`;
  const supplies = board.supplies.map((queue) => queue.every((tray) => tray.count === TRAY_COUNT)
    ? `trays(${queue.map((tray) => quote(tray.color)).join(', ')})`
    : `[${queue.map((tray) => tray.count === TRAY_COUNT ? `tray(${quote(tray.color)})` : `tray(${quote(tray.color)}, SHORT_TRAY)`).join(', ')}]`).join(', ');
  const order: Color[] = [];
  const longest = Math.max(...board.docks.map((queue) => queue.length));
  for (let row = 0; row < longest; row++) for (const queue of board.docks) if (queue[row]) order.push(queue[row]!);
  const base = `board('${board.id}', '${board.title.replace(/'/g, '\\\'')}', ${board.beltCapacity},\n  [${supplies}],\n  docks(${board.docks.length}, ${order.map(quote).join(', ')}))`;
  const body = board.trackShape ? `{ ...${base}, trackShape: '${board.trackShape}' }` : base;
  return `/** ${recipe.note} */\nexport const ${name}: BoardDef = ${body};`;
}

export const FUNNEL_RECIPES: readonly FunnelRecipe[] = [
  // Boards 3 to 11 keep their titles and shapes; they are re-rolled here for a tighter belt and fewer winning orders.
  { id: 'board-3', title: 'Behind the lines', fr: 'Derrière les lignes', note: 'Seven trays and four docks; every column hides a colour the docks want behind one they do not.', colors: 4, columns: [3, 2, 2], shorts: 0, docks: 4, capacity: 18, seed: 1, win: [0.2, 0.45], slack: 4, naiveJams: true },
  { id: 'board-4', title: 'Two wrongs', fr: 'Deux erreurs', note: 'Nine trays; the belt forgives one wrong tray, never two.', colors: 4, columns: [3, 3, 3], shorts: 0, docks: 4, capacity: 18, seed: 1, win: [0.2, 0.4], slack: 3, naiveJams: true },
  { id: 'board-5', title: 'The long way round', fr: 'Le grand détour', note: 'Twelve trays, four columns, four docks: a long flowing level with real traps.', colors: 4, columns: [3, 3, 3, 3], shorts: 0, docks: 4, capacity: 18, seed: 1, win: [0.15, 0.35], slack: 3, naiveJams: true },
  { id: 'board-6', title: 'First bridge', fr: 'Le premier pont', note: 'The first figure eight: seven trays, two docks, and a longer belt that fills up all the same.', colors: 4, columns: [3, 2, 2], shorts: 0, docks: 2, capacity: 28, shape: 'eight', seed: 1, win: [0.2, 0.7], slack: 0, naiveJams: true },
  { id: 'board-7', title: 'The wide crossing', fr: 'La grande traversée', note: 'Seven trays over the wide crossing.', colors: 4, columns: [3, 2, 2], shorts: 0, docks: 3, capacity: 32, shape: 'wide-eight', seed: 1, win: [0.15, 0.5], slack: 0, naiveJams: true },
  { id: 'board-8', title: 'Orange arrives', fr: 'L’orange arrive', note: 'Orange arrives: five colours, three columns, eight trays, four docks.', colors: 5, columns: [3, 3, 2], shorts: 0, docks: 4, capacity: 18, seed: 1, win: [0.15, 0.35], slack: 3, naiveJams: true },
  { id: 'board-9', title: 'Short pours', fr: 'Petits versements', note: 'Short trays of six mix with full trays: a cheap pour is tempting, but every dock still wants three boxes.', colors: 5, columns: [3, 3, 2, 3], shorts: 5, docks: 4, capacity: 15, seed: 1, win: [0.1, 0.3], slack: 2, naiveJams: true },
  { id: 'board-10', title: 'Five in the eight', fr: 'Cinq couleurs en huit', note: 'Five colours over the bridge: nine trays on a tight belt.', colors: 5, columns: [3, 3, 3], shorts: 0, docks: 3, capacity: 28, shape: 'eight', seed: 1, win: [0.1, 0.45], slack: 0, naiveJams: true },
  { id: 'board-11', title: 'The grand tour', fr: 'Le grand tour', note: 'Twelve trays, five colours and the wide crossing.', colors: 5, columns: [3, 3, 3, 3], shorts: 0, docks: 3, capacity: 32, shape: 'wide-eight', seed: 1, win: [0.08, 0.4], slack: 0, naiveJams: true },
  { id: 'board-12', title: 'Two tall stacks', fr: 'Deux hautes piles', note: 'Five colours from only two columns: every pour is a commitment three trays deep.', colors: 5, columns: [3, 3], shorts: 0, docks: 4, capacity: 15, seed: 1, win: [0.1, 0.3], slack: 2, naiveJams: true },
  { id: 'board-13', title: 'Tight belt', fr: 'Tapis serré', note: 'Four colours and a belt with no slack: one wrong tray is one too many.', colors: 4, columns: [2, 2, 2], shorts: 0, docks: 3, capacity: 14, seed: 1, win: [0.1, 0.3], slack: 0, naiveJams: true },
  { id: 'board-14', title: 'Uneven stacks', fr: 'Piles inégales', note: 'Columns of one, two and three trays; the short columns run out while the long ones are still blocking.', colors: 5, columns: [3, 1, 2, 3], shorts: 0, docks: 4, capacity: 18, seed: 1, win: [0.08, 0.3], slack: 2, naiveJams: true },
  { id: 'board-15', title: 'Short and sweet', fr: 'Court et doux', note: 'Half the trays are short: four columns of two, cheap pours, and docks that still want three boxes.', colors: 4, columns: [2, 2, 2, 2], shorts: 4, docks: 3, capacity: 15, seed: 1, win: [0.08, 0.2], slack: 2, naiveJams: true },
  { id: 'board-16', title: 'Short crossing', fr: 'Petite traversée', note: 'Over the bridge with three short trays in the mix.', colors: 5, columns: [3, 2, 3], shorts: 3, docks: 2, capacity: 28, shape: 'eight', seed: 1, win: [0.08, 0.4], slack: 0, naiveJams: true },
  { id: 'board-17', title: 'Narrow neck', fr: 'Goulot étroit', note: 'Three columns, three docks and no belt to spare: the tightest Funnel Sort board.', colors: 5, columns: [2, 2, 2], shorts: 0, docks: 3, capacity: 14, seed: 1, win: [0.08, 0.3], slack: 0, naiveJams: true },
  { id: 'board-18', title: 'Wide and tight', fr: 'Large et serré', note: 'The wide crossing with two docks: most of the belt is always waiting.', colors: 5, columns: [3, 3, 3], shorts: 0, docks: 2, capacity: 32, shape: 'wide-eight', seed: 1, win: [0.08, 0.35], slack: 0, naiveJams: true },
  { id: 'board-19', title: 'Three by four', fr: 'Trois sur quatre', note: 'Four colours, four columns of three.', colors: 4, columns: [3, 3, 3, 3], shorts: 0, docks: 4, capacity: 16, seed: 1, win: [0.08, 0.25], slack: 2, naiveJams: true },
  { id: 'board-20', title: 'Mixed measures', fr: 'Mesures mélangées', note: 'Four short trays among ten, over the wide crossing.', colors: 5, columns: [2, 3, 2, 3], shorts: 4, docks: 2, capacity: 32, shape: 'wide-eight', seed: 1, win: [0.05, 0.35], slack: 0, naiveJams: true },
  { id: 'board-21', title: 'Colour pairs', fr: 'Paires de couleurs', note: 'Four colours, nine trays: each colour comes in pairs that must not meet on the belt.', colors: 4, columns: [3, 3, 3], shorts: 0, docks: 4, capacity: 15, seed: 1, win: [0.05, 0.2], slack: 1, naiveJams: true },
  { id: 'board-22', title: 'The squeeze', fr: 'La compression', note: 'Eight trays, five colours, a belt with nothing to spare.', colors: 5, columns: [2, 2, 2, 2], shorts: 0, docks: 4, capacity: 14, seed: 1, win: [0.05, 0.2], slack: 0, naiveJams: true },
  { id: 'board-23', title: 'Thirteen trays', fr: 'Treize plateaux', note: 'One column goes four deep over the bridge.', colors: 5, columns: [4, 3, 3, 3], shorts: 0, docks: 3, capacity: 28, shape: 'eight', seed: 1, win: [0.05, 0.3], slack: 0, naiveJams: true },
  { id: 'board-24', title: 'Full house', fr: 'Maison pleine', note: 'Twelve trays on the oval, five colours.', colors: 5, columns: [3, 3, 3, 3], shorts: 0, docks: 4, capacity: 18, seed: 1, win: [0.05, 0.2], slack: 1, naiveJams: true },
  { id: 'board-25', title: 'Short eight', fr: 'Huit en petit', note: 'Five short trays among nine on the bridge.', colors: 5, columns: [3, 3, 3], shorts: 5, docks: 2, capacity: 26, shape: 'eight', seed: 1, win: [0.05, 0.3], slack: 0, naiveJams: true },
  { id: 'board-26', title: 'Deep stacks', fr: 'Piles profondes', note: 'Two columns of four and a short third: ten trays, most of them blocking three more.', colors: 5, columns: [4, 4, 2], shorts: 0, docks: 4, capacity: 15, seed: 1, win: [0.05, 0.2], slack: 1, naiveJams: true },
  { id: 'board-27', title: 'Three docks, five colours', fr: 'Trois quais, cinq couleurs', note: 'Only three docks for five colours: two colours are always waiting their turn.', colors: 5, columns: [3, 3, 3], shorts: 0, docks: 3, capacity: 18, seed: 1, win: [0.05, 0.2], slack: 1, naiveJams: true },
  { id: 'board-28', title: 'Fourteen trays', fr: 'Quatorze plateaux', note: 'The biggest pour so far: fourteen trays over the bridge.', colors: 5, columns: [4, 3, 4, 3], shorts: 0, docks: 2, capacity: 28, shape: 'eight', seed: 1, win: [0.05, 0.3], slack: 0, naiveJams: true },
  { id: 'board-29', title: 'Short measures, wide belt', fr: 'Petites mesures, grand tapis', note: 'Six short trays among twelve on the wide crossing.', colors: 5, columns: [3, 3, 3, 3], shorts: 6, docks: 2, capacity: 30, shape: 'wide-eight', seed: 1, win: [0.05, 0.3], slack: 0, naiveJams: true },
  { id: 'board-30', title: 'Grand finale', fr: 'Grand final', note: 'Fourteen trays, four deep in two columns, on the wide crossing.', colors: 5, columns: [4, 4, 3, 3], shorts: 2, docks: 2, capacity: 32, shape: 'wide-eight', seed: 1, win: [0.04, 0.25], slack: 0, naiveJams: true },
];

if (process.argv[1]?.endsWith('funnel-author.ts')) {
  const mode = process.argv[2] ?? 'emit';
  const only = process.argv.slice(3);
  const reports: FunnelReport[] = [];
  for (const recipe of FUNNEL_RECIPES.filter((candidate) => !only.length || only.includes(candidate.id))) {
    const started = Date.now();
    const report = await author(recipe);
    reports.push(report);
    console.error(`${recipe.id} seed ${report.seed} cap ${report.board.beltCapacity} marbles ${report.marbles} orders ${report.orders} win ${(report.winShare * 100).toFixed(0)}% random ${(report.random * 100).toFixed(1)}% lost-states ${(report.lostShare * 100).toFixed(0)}% hint ${report.hintMs}ms witness ${report.witness} jam ${report.jam} (${Date.now() - started}ms)`);
  }
  if (mode === 'emit') {
    console.log(reports.map(emitBoard).join('\n'));
    console.log(`\n// witnesses\n${reports.map((r) => `'${r.board.id}': '${r.witness}'`).join(', ')}`);
    console.log(`// jams\n${reports.map((r) => `'${r.board.id}': '${r.jam}'`).join(', ')}`);
    console.log(`// french\n${reports.map((r) => `'${r.board.id}': '${r.recipe.fr.replace(/'/g, '’')}'`).join(', ')}`);
  }
}
