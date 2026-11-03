import { LoopRules } from '../src/loop/rules';
import { LoopMachine } from '../src/loop/machine';
import { hintLoopSearch, settleLoop } from '../src/loop/solver';
import { HINT_STATE_CAP, LOOP_MAX_SEGMENTS } from './level-curve';
import { TRUCK_CAPACITY } from '../src/loop/boards';
import type { LoopBoardDef, TruckDef } from '../src/loop/types';
import { COLOR_CODE, COLORS, type Color, type Packet } from '../src/sim/types';
import type { BeltShape } from '../src/engine/belt-path';
import { random, shuffle } from './funnel-author';

/**
 * Random Loop Sort boards with a verified winning tap order and a losing one, for authoring:
 *   npx tsx scripts/loop-author.ts            # evaluate every recipe below and print the TypeScript
 *   npx tsx scripts/loop-author.ts stats      # one line of search statistics per recipe
 */
const PALETTE: readonly Color[] = COLORS;
const LETTER = (index: number): string => String.fromCharCode(65 + index);

export interface LoopRecipe {
  readonly id: string;
  readonly title: string;
  readonly fr: string;
  readonly note: string;
  readonly colors: number;
  /** Trucks per lane, front first. */
  readonly lanes: readonly number[];
  /** Most segments a truck carries; the deepest fixes its colour. */
  readonly segments: 2 | 3;
  /** Most marbles the loop may hold; the author then tightens it to the least solvable capacity plus `slack` (four by default). */
  readonly capacity: number;
  readonly slack?: number;
  /** Most marbles circulating at the start. */
  readonly ringMax: number;
  readonly shape?: BeltShape;
  readonly seed: number;
  /** Share of complete tap orders that win. Lower is harder. */
  readonly win: readonly [number, number];
  /** Pouring one lane dry at a time and tapping lanes in turn must both end in a jam. */
  readonly naiveJams: boolean;
}

export interface LoopReport {
  readonly recipe: LoopRecipe;
  readonly seed: number;
  readonly board: LoopBoardDef;
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

interface Built { readonly home: Color; segments: { color: Color; count: number }[] }
const load = (truck: Built): number => truck.segments.reduce((sum, segment) => sum + segment.count, 0);
const evens = (low: number, high: number): number[] => { const out: number[] = []; for (let n = Math.ceil(low / 2) * 2; n <= high; n += 2) out.push(n); return out; };
const pick = <T>(items: readonly T[], next: () => number): T => items[Math.floor(next() * items.length)]!;

/**
 * Build a board backwards from its solved state, so a forward solution exists by construction.
 * Every reverse step mirrors a legal pour and the absorptions that follow it:
 *  - un-leave: a finished truck comes back to the front of its lane, full of its colour;
 *  - A: marbles leave a front truck's loop-end segment for a new top segment on another front truck
 *       (forward: that truck pours them and the first truck takes them straight back in);
 *  - E: as A, but the receiving truck first drops part of its own top colour onto the loop
 *       (forward: it pours, the first truck takes that in, then it absorbs what was waiting for it);
 *  - B: a colour waiting on the loop becomes a new top segment on a front truck (forward: pour and wait);
 *  - C: a front truck drops part of its top onto the loop and takes a waiting colour as its new top
 *       (forward: it pours that colour, then absorbs what was waiting).
 * Between steps the loop never holds a colour a front truck wants, as in every settled position of the rules.
 */
export let lastReason = '';
export let lastState = '';
export function generate(recipe: LoopRecipe, seed: number): LoopBoardDef | null {
  const next = random(seed);
  lastReason = '';
  const colors = PALETTE.slice(0, recipe.colors);
  const count = recipe.lanes.reduce((a, b) => a + b, 0);
  if (count < colors.length) return null;
  const homes = shuffle([...colors, ...Array.from({ length: count - colors.length }, () => pick(colors, next))], next);
  const queues: Built[][] = recipe.lanes.map(() => []);
  const pending = recipe.lanes.map((size, lane) => homes.slice(recipe.lanes.slice(0, lane).reduce((a, b) => a + b, 0)).slice(0, size));
  const loop = new Map<Color, number>();
  const onLoop = (): number => [...loop.values()].reduce((a, b) => a + b, 0);
  let peak = 0;
  const fronts = (): Built[] => queues.map((queue) => queue[0]).filter((truck): truck is Built => Boolean(truck));
  const worked = (truck: Built): boolean => truck.segments.length > 1 || load(truck) < TRUCK_CAPACITY;
  const wantedElsewhere = (color: Color, except: Built): boolean => fronts().some((truck) => truck !== except && truck.segments[0]!.color === color);
  const unleave = (lane: number): Built => {
    const home = pending[lane]!.pop()!;
    const truck: Built = { home, segments: [{ color: home, count: TRUCK_CAPACITY }] };
    queues[lane]!.unshift(truck);
    return truck;
  };
  const minKeep = (truck: Built): number => truck.segments.length === 1 ? 2 : 0;
  /** Drop k of a truck's top colour onto the loop; only when no other front truck wants that colour. */
  const drop = (truck: Built, k: number): void => {
    const top = truck.segments[0]!;
    top.count -= k;
    if (top.count === 0) truck.segments.shift();
    loop.set(top.color, (loop.get(top.color) ?? 0) + k);
  };
  // B: a whole colour waiting on the loop becomes the top segment of a front truck that does not want it.
  const take = (only?: Built): boolean => {
    const options = (only ? [only] : fronts()).flatMap((truck) => [...loop.entries()].filter(([color, k]) => k > 0 && truck.segments[0]!.color !== color && truck.segments.length < recipe.segments && load(truck) + k <= TRUCK_CAPACITY).map(([color, k]) => ({ truck, color, k })));
    if (!options.length) return false;
    const { truck, color, k } = pick(options, next);
    loop.delete(color);
    truck.segments.unshift({ color, count: k });
    peak = Math.max(peak, onLoop() + k);
    return true;
  };
  // A/E: k marbles of the giver's top colour become a new top segment on the receiver, which may first
  // drop part of its own top onto the loop to make room (E); the giver then often takes that drop back (B).
  const canDrop = (to: Built): boolean => !wantedElsewhere(to.segments[0]!.color, to) && to.segments[0]!.count - minKeep(to) >= 2;
  let relaxed = 0;
  const canReceive = (to: Built, color: Color, allowDrop: boolean): boolean => to.segments[0]!.color !== color && to.segments.length < recipe.segments + relaxed
    && (load(to) + 2 <= TRUCK_CAPACITY || (allowDrop && canDrop(to)));
  const exchange = (from: Built, to: Built, allowDrop: boolean): boolean => {
    const top = from.segments[0]!;
    if (from === to || top.count - 2 < 2 || !canReceive(to, top.color, allowDrop)) return false;
    const room = TRUCK_CAPACITY - load(to);
    const dropping = allowDrop && canDrop(to) && (room < 2 || next() < 0.35);
    const spare = recipe.capacity - onLoop();
    // With a drop of d marbles, the give k needs k <= room + d, d <= k and k + d <= spare.
    // A drop that removes the receiver's whole top must not expose a segment of the incoming colour.
    const dropsFor = (k: number): number[] => evens(Math.max(2, k - room), Math.min(to.segments[0]!.count - minKeep(to), k, spare - k))
      .filter((d) => d < to.segments[0]!.count || to.segments[1]?.color !== top.color);
    const all = evens(2, Math.min(top.count - 2, spare, dropping ? room + to.segments[0]!.count - minKeep(to) : room))
      .filter((k) => !dropping || dropsFor(k).length > 0);
    const sizes = all.filter((k) => k >= 4).length ? all.filter((k) => k >= 4) : all;
    if (!sizes.length) return false;
    const k = pick(sizes, next);
    if (dropping) drop(to, pick(dropsFor(k), next));
    top.count -= k;
    to.segments.unshift({ color: top.color, count: k });
    peak = Math.max(peak, onLoop() + k);
    if (dropping && next() < 0.7) take(from);
    return true;
  };
  const give = (from: Built, allowDrop: boolean): boolean => shuffle(fronts().filter((to) => to !== from), next).some((to) => exchange(from, to, allowDrop));
  const receive = (to: Built, allowDrop: boolean): boolean => shuffle(fronts().filter((from) => from !== to), next).some((from) => exchange(from, to, allowDrop));
  // C: a front truck drops part of its top onto the loop and takes a whole waiting colour as its new top.
  const swap = (only?: Built): boolean => {
    const candidates = (only ? [only] : fronts()).flatMap((truck) => {
      const top = truck.segments[0]!;
      if (wantedElsewhere(top.color, truck) || truck.segments.length >= recipe.segments) return [];
      return [...loop.entries()].filter(([color, n]) => n > 0 && color !== top.color).map(([color, n]) => ({ truck, color, n }));
    });
    if (!candidates.length) return false;
    const { truck, color, n } = pick(candidates, next);
    const top = truck.segments[0]!;
    // Taking the whole top must not leave the incoming colour against a segment of the same colour.
    const sizes = evens(Math.max(2, n - (TRUCK_CAPACITY - load(truck))), Math.min(top.count - minKeep(truck), recipe.capacity - onLoop()))
      .filter((k) => k < top.count || truck.segments[1]?.color !== color);
    if (!sizes.length) return false;
    const k = pick(sizes, next);
    drop(truck, k);
    loop.delete(color);
    truck.segments.unshift({ color, count: n });
    peak = Math.max(peak, onLoop() + n);
    return true;
  };
  // A-merge: k marbles of a truck's top join the same-colour top segment of another front truck
  // (forward: that truck pours the bigger segment and this one takes back what it needs).
  const merge = (from: Built): boolean => {
    const top = from.segments[0]!;
    const targets = shuffle(fronts().filter((to) => to !== from && to.segments[0]!.color === top.color && load(to) + 2 <= TRUCK_CAPACITY), next);
    const to = targets[0];
    if (!to) return false;
    const sizes = evens(2, Math.min(top.count - minKeep(from), TRUCK_CAPACITY - load(to), recipe.capacity - onLoop()));
    if (!sizes.length) return false;
    const k = pick(sizes, next);
    top.count -= k;
    if (top.count === 0) from.segments.shift();
    to.segments[0]!.count += k;
    peak = Math.max(peak, onLoop() + to.segments[0]!.count);
    return true;
  };
  /** A fresh truck is full of its colour: it must hand some out, take a top segment, or both. */
  const work = (truck: Built): boolean => {
    const options = shuffle([() => give(truck, true), () => receive(truck, true), () => swap(truck), () => merge(truck)], next);
    if (options.some((option) => option())) return true;
    // Last resort: one truck may carry a segment more than the recipe asks for.
    relaxed = 1;
    const result = give(truck, true) || receive(truck, true);
    relaxed = 0;
    return result;
  };
  // Two lanes whose last trucks differ in colour open first; the other lanes open as the construction goes on.
  const order = shuffle(queues.map((_, lane) => lane), next);
  const second = order.slice(1).find((lane) => pending[lane]!.at(-1) !== pending[order[0]!]!.at(-1)) ?? order[1]!;
  if (pending[second]!.at(-1) === pending[order[0]!]!.at(-1)) {
    // Only same-coloured trucks would open: swap one of them with any differently coloured truck in the queues.
    const first = pending[order[0]!]!.at(-1)!;
    const spot = pending.flatMap((queue, lane) => queue.map((home, index) => ({ lane, index, home }))).find((entry) => entry.home !== first);
    if (!spot) return null;
    const queue = pending[second]!;
    [pending[spot.lane]![spot.index], queue[queue.length - 1]] = [queue[queue.length - 1]!, spot.home];
  }
  unleave(order[0]!);
  unleave(second);
  for (const truck of shuffle(fronts(), next)) if (!worked(truck) && !work(truck)) { lastReason = 'first'; lastState = JSON.stringify({ fresh: truck, fronts: fronts().map((t) => t.segments.map((g) => `${COLOR_CODE[g.color]}${g.count}`).join('.')), loop: [...loop.entries()], pending }); return null; }
  const target = count * (recipe.segments - 1) * (0.55 + 0.35 * next());
  for (let step = 0; step < 600; step++) {
    const segments = queues.flat().reduce((sum, truck) => sum + truck.segments.length - 1, 0);
    if (segments >= target && pending.every((queue) => !queue.length)) break;
    const roll = next();
    const lanes = pending.map((queue, lane) => queue.length && (!queues[lane]!.length || worked(queues[lane]![0]!)) ? lane : -1).filter((lane) => lane >= 0);
    if (lanes.length && roll < 0.5) {
      const truck = unleave(pick(lanes, next));
      if (!work(truck)) {
        // A stuck truck may need a partner from another lane; open one and try again.
        const others = pending.map((queue, other) => queue.length && (!queues[other]!.length || worked(queues[other]![0]!)) ? other : -1).filter((other) => other >= 0 && queues[other]![0] !== truck);
        if (others.length) { const partner = unleave(pick(others, next)); if (!work(partner) && !work(truck)) { lastReason = 'unleave'; return null; } if (!worked(truck) && !work(truck)) { lastReason = 'unleave'; return null; } }
      }
      if (!worked(truck)) { lastReason = 'unleave'; lastState = JSON.stringify({ fresh: truck, fronts: fronts().map((t) => t.segments.map((g) => `${COLOR_CODE[g.color]}${g.count}`).join('.')), loop: [...loop.entries()], pending }); return null; }
    } else if (onLoop() > recipe.ringMax && roll < 0.8) { if (!take()) swap(); }
    else if (roll < 0.65) give(pick(fronts(), next), next() < 0.3);
    else if (roll < 0.8) { if (!swap()) take(); }
    else if (roll < 0.9) merge(pick(fronts(), next));
    else if (!take()) receive(pick(fronts(), next), false);
  }
  if (pending.some((queue) => queue.length)) { lastReason = 'pending'; return null; }
  if (queues.flat().some((truck) => !worked(truck))) { lastReason = 'unworked'; return null; }
  if (queues.flat().some((truck) => truck.segments.some((segment, index) => index > 0 && segment.color === truck.segments[index - 1]!.color))) { lastReason = 'adjacent'; return null; }
  if (onLoop() > recipe.ringMax) { lastReason = `ring ${onLoop()}`; return null; }
  if (peak > recipe.capacity) { lastReason = `peak ${peak}`; return null; }
  const lanes: TruckDef[][] = queues.map((queue) => queue.map((truck) => ({ segments: truck.segments.map((segment) => ({ ...segment })) })));
  const ring: Packet[] = shuffle([...loop.entries()].filter(([, n]) => n > 0), next).map(([color, count]) => ({ color, count }));
  const board: LoopBoardDef = { id: recipe.id, title: recipe.title, loopCapacity: recipe.capacity, truckCapacity: TRUCK_CAPACITY, lanes, loop: ring };
  return recipe.shape ? { ...board, trackShape: recipe.shape } : board;
}

function clone(rules: LoopRules): LoopRules {
  const copy = new LoopRules(rules.board);
  copy.restore(rules.snapshot());
  return copy;
}
export function stateKey(rules: LoopRules): string {
  const state = rules.state;
  const loop: Record<string, number> = {};
  for (const marble of state.marbles) if (marble.status === 'on-loop') loop[marble.color] = (loop[marble.color] ?? 0) + 1;
  const lanes = state.lanes.map((queue) => queue.map((truck) => truck.segments.map((segment) => `${COLOR_CODE[segment.color]}${segment.marbles.length}`).join('.') + (truck.unloading.length ? `u${truck.unloading.length}` : '')).join('/')).join('|');
  return `${lanes}#${JSON.stringify(loop)}`;
}

export interface Search {
  readonly solvable: boolean;
  readonly witness: string | null;
  readonly jam: string | null;
  readonly states: number;
  readonly lost: number;
  /** Complete tap orders and how many of them win. */
  readonly orders: number;
  readonly winning: number;
  /** The first winning orders found, for trying against the scripted machine. */
  readonly witnesses: readonly string[];
  /** Probability that a player tapping uniformly at random among legal lanes wins. */
  readonly random: number;
}
interface Node { readonly win: boolean; readonly orders: number; readonly winning: number; readonly random: number }
export function search(board: LoopBoardDef, limit = 300_000): Search {
  const memo = new Map<string, Node>();
  const open = new Set<string>();
  let witness: string | null = null;
  const witnesses: string[] = [];
  let jam: string | null = null;
  let lost = 0;
  let overflow = false;
  const walk = (rules: LoopRules, path: string): Node => {
    if (rules.status === 'won') { witness ??= path; if (witnesses.length < 12) witnesses.push(path); return { win: true, orders: 1, winning: 1, random: 1 }; }
    if (rules.status === 'jammed') { jam ??= path; return { win: false, orders: 1, winning: 0, random: 0 }; }
    const key = stateKey(rules);
    const known = memo.get(key);
    if (known) return known;
    if (open.has(key)) return { win: false, orders: 0, winning: 0, random: 0 };
    if (memo.size >= limit) { overflow = true; return { win: false, orders: 1, winning: 0, random: 0 }; }
    open.add(key);
    let win = false;
    let orders = 0;
    let winning = 0;
    let random = 0;
    let choices = 0;
    for (let lane = 0; lane < board.lanes.length; lane++) {
      const branch = clone(rules);
      if (!branch.tap(lane).ok) continue;
      if (!settleLoop(branch)) throw new Error(`Unsettled after ${path}${LETTER(lane)}`);
      const child = walk(branch, path + LETTER(lane));
      win ||= child.win;
      orders += child.orders;
      winning += child.winning;
      random += child.random;
      choices++;
    }
    open.delete(key);
    const node = { win, orders, winning, random: choices ? random / choices : 0 };
    memo.set(key, node);
    if (!win) lost++;
    return node;
  };
  const start = new LoopRules(board);
  settleLoop(start);
  const root = walk(start, '');
  return { solvable: root.win && !overflow, witness, witnesses, jam, states: memo.size, lost, orders: root.orders, winning: root.winning, random: root.random };
}

type Status = 'won' | 'jammed' | 'playing';
export function laneByLane(board: LoopBoardDef): Status {
  const rules = new LoopRules(board);
  settleLoop(rules);
  for (let tapped = true; tapped && rules.status === 'playing';) {
    tapped = false;
    for (let lane = 0; lane < board.lanes.length && rules.status === 'playing'; lane++) {
      while (rules.status === 'playing' && rules.tap(lane).ok) { settleLoop(rules); tapped = true; }
    }
  }
  return rules.status;
}
export function roundRobin(board: LoopBoardDef): Status {
  const rules = new LoopRules(board);
  settleLoop(rules);
  for (let idle = 0, lane = 0; idle < board.lanes.length && rules.status === 'playing'; lane = (lane + 1) % board.lanes.length) {
    if (rules.tap(lane).ok) { settleLoop(rules); idle = 0; } else idle++;
  }
  return rules.status;
}

/** The least loop capacity that keeps the board solvable; room never hurts a winning order, so this is monotone. */
export function tighten(board: LoopBoardDef, floor = 20): LoopBoardDef {
  const ring = board.loop.reduce((sum, entry) => sum + entry.count, 0);
  let low = Math.max(floor, ring + 2 + ((ring + 2) % 2));
  let high = board.loopCapacity;
  while (low < high) {
    const middle = Math.floor((low + high) / 2 / 2) * 2;
    let ok = false;
    try { ok = search({ ...board, loopCapacity: middle }).solvable; } catch { ok = false; }
    if (ok) high = middle; else low = middle + 2;
  }
  return { ...board, loopCapacity: high };
}

/**
 * The scripted machine with the tests' patient player, who taps once the loop has stopped changing.
 * Marbles are absorbed where they pass, not in lane order as the settled model assumes, so a witness
 * has to win here as well, and inside the time the machine tests allow.
 */
export function playMachine(board: LoopBoardDef, order: string, limitSeconds = 185, patient = false): { status: string; done: boolean; seconds: number } {
  const machine = new LoopMachine(board);
  const taps = [...order].map((letter) => letter.charCodeAt(0) - 65);
  let next = 0;
  for (let tick = 0; tick < 60 * limitSeconds; tick++) {
    machine.step();
    if (machine.rules.status !== 'playing' && !machine.transferring) break;
    const tap = taps[next];
    // The browser journey waits for every truck and unit to come to rest; the unit tests only for the pour to finish.
    const calm = patient ? !machine.transferring && !machine.rules.canDrain() : machine.rules.pending === 0 && !machine.rules.canDrain() && tick % 10 === 0;
    if (tap !== undefined && calm && machine.tap(tap).ok) next += 1;
  }
  return { status: machine.rules.status, done: !machine.transferring, seconds: machine.tick / 60 };
}
/** A witness has to win for both kinds of player the checks emulate. */
export function winsEitherWay(board: LoopBoardDef, order: string): boolean {
  return [false, true].every((patient) => { const outcome = playMachine(board, order, 185, patient); return outcome.status === 'won' && outcome.done; });
}

export function author(recipe: LoopRecipe, attempts = 1500): LoopReport {
  // SEED_START lets several searches of one recipe run side by side from different starting seeds.
  const first = Number(process.env['SEED_START'] ?? recipe.seed);
  for (let seed = first; seed < first + attempts; seed++) {
    const loose = generate(recipe, seed);
    if (!loose) continue;
    // `segments: 3` can relax to a fourth segment when a truck is stuck; no such truck ships.
    if (loose.lanes.flat().some((truck) => truck.segments.length > LOOP_MAX_SEGMENTS)) continue;
    let probe: Search;
    try { probe = search(loose); } catch { continue; }
    if (!probe.solvable) continue;
    const tight = tighten(loose);
    const board = { ...tight, loopCapacity: Math.min(recipe.capacity, tight.loopCapacity + (recipe.slack ?? 4)) };
    let result: Search;
    try { result = search(board); } catch { continue; }
    if (!result.solvable || !result.witness || !result.jam) continue;
    const lostShare = result.lost / result.states;
    const winShare = result.winning / result.orders;
    if (winShare < recipe.win[0] || winShare > recipe.win[1]) continue;
    if (recipe.naiveJams && (laneByLane(board) !== 'jammed' || roundRobin(board) !== 'jammed')) continue;
    const started = Date.now();
    const hint = hintLoopSearch(new LoopRules(board));
    // Printed for information. The gate counts states, so the same seed cannot flip with machine load.
    const hintMs = Date.now() - started;
    if (hint.lane === null || hint.states > HINT_STATE_CAP.loop) continue;
    let witness: string | null = null;
    for (const candidate of result.witnesses) {
      if (winsEitherWay(board, candidate)) { witness = candidate; break; }
    }
    if (!witness) continue;
    const marbles = board.lanes.flat().length * TRUCK_CAPACITY;
    return { recipe, seed, board, witness, jam: result.jam, states: result.states, lostShare, winShare, orders: result.orders, random: result.random, hintMs, marbles };
  }
  throw new Error(`No board for ${recipe.id} within ${attempts} seeds`);
}

export function emitBoard(report: LoopReport): string {
  const { board, recipe } = report;
  const name = `LOOP_${board.id.split('-')[1]}`;
  const seg = (packet: Packet): string => `seg('${packet.color}', ${packet.count})`;
  const lanes = board.lanes.map((queue) => `[${queue.map((truck) => `truck(${truck.segments.map(seg).join(', ')})`).join(', ')}]`).join(', ');
  const base = `board('${board.id}', '${board.title.replace(/'/g, '\\\'')}', ${board.loopCapacity},\n  [${lanes}],\n  ring(${board.loop.map(seg).join(', ')}))`;
  const body = board.trackShape ? `{ ...${base}, trackShape: '${board.trackShape}' }` : base;
  return `/** ${recipe.note} */\nexport const ${name}: LoopBoardDef = ${body};`;
}

export const LOOP_RECIPES: readonly LoopRecipe[] = [
  // Boards 6 to 11 keep their titles and shapes; they are re-rolled here so that tapping in turn no longer wins
  // and the two bridge boards stop repeating boards 4 and 5. The win bands tighten down the bank.
  { id: 'loop-6', title: 'Truck bridge', fr: 'Le pont des camions', note: 'The first bridge for the trucks: four lanes, six trucks, four colours.', colors: 4, lanes: [2, 2, 1, 1], segments: 3, capacity: 32, ringMax: 16, shape: 'eight', seed: 1, win: [0.3, 0.5], naiveJams: true },
  { id: 'loop-7', title: 'Eight in motion', fr: 'Huit en mouvement', note: 'Eight trucks on the wide crossing.', colors: 4, lanes: [2, 2, 2, 2], segments: 3, capacity: 56, ringMax: 24, shape: 'wide-eight', seed: 1, win: [0.2, 0.4], naiveJams: true },
  { id: 'loop-8', title: 'Orange arrives', fr: 'L’orange arrive', note: 'Orange arrives on the loop: four lanes, six trucks, five colours.', colors: 5, lanes: [2, 2, 1, 1], segments: 3, capacity: 32, ringMax: 14, seed: 1, win: [0.25, 0.45], naiveJams: true },
  { id: 'loop-9', title: 'Five lanes', fr: 'Cinq voies', note: 'Five lanes in two rows, eight trucks, five colours.', colors: 5, lanes: [2, 2, 1, 2, 1], segments: 3, capacity: 40, ringMax: 18, seed: 1, win: [0.1, 0.35], naiveJams: true },
  { id: 'loop-10', title: 'Orange bridge', fr: 'Le pont orange', note: 'Seven trucks over the bridge with orange in the mix.', colors: 5, lanes: [2, 2, 2, 1], segments: 3, capacity: 42, ringMax: 18, shape: 'eight', seed: 1, win: [0.12, 0.3], naiveJams: true },
  { id: 'loop-11', title: 'Rush hour', fr: 'Heure de pointe', note: 'Eight trucks, five colours, the wide crossing: rush hour.', colors: 5, lanes: [2, 2, 2, 2], segments: 3, capacity: 56, ringMax: 24, shape: 'wide-eight', seed: 1, win: [0.1, 0.25], naiveJams: true },
  { id: 'loop-12', title: 'Two lanes, deep queues', fr: 'Deux voies, longues files', note: 'Six trucks in only two lanes: what is behind matters more than what is in front.', colors: 4, lanes: [3, 3], segments: 3, capacity: 28, ringMax: 14, seed: 1, win: [0.05, 0.5], naiveJams: true },
  { id: 'loop-13', title: 'Three-colour squeeze', fr: 'Trois couleurs à l’étroit', note: 'Three colours, six trucks, three segments each and a small loop.', colors: 3, lanes: [2, 2, 2], segments: 3, capacity: 22, ringMax: 10, seed: 1, win: [0.08, 0.3], naiveJams: true },
  { id: 'loop-14', title: 'Triple decks', fr: 'Triples charges', note: 'Eight trucks carrying up to three colours each.', colors: 5, lanes: [2, 2, 2, 2], segments: 3, capacity: 36, ringMax: 16, seed: 1, win: [0.08, 0.3], naiveJams: true },
  { id: 'loop-15', title: 'Five lanes, one each', fr: 'Cinq voies, un camion', note: 'Five trucks in five lanes with nothing behind them: the whole puzzle is on the loop.', colors: 5, lanes: [1, 1, 1, 1, 1], segments: 3, capacity: 30, ringMax: 24, seed: 1, win: [0.08, 0.3], naiveJams: true },
  { id: 'loop-16', title: 'Nine over the bridge', fr: 'Neuf sur le pont', note: 'Nine trucks over the bridge with five colours.', colors: 5, lanes: [3, 2, 2, 2], segments: 3, capacity: 42, ringMax: 20, shape: 'eight', seed: 1, win: [0.08, 0.28], naiveJams: true },
  { id: 'loop-17', title: 'Half loads', fr: 'Demi-charges', note: 'Half the trucks arrive half full, so the loop starts crowded.', colors: 4, lanes: [2, 2, 2], segments: 3, capacity: 32, ringMax: 30, seed: 1, win: [0.08, 0.28], naiveJams: true },
  { id: 'loop-18', title: 'Ten trucks', fr: 'Dix camions', note: 'Five lanes, ten trucks, five colours.', colors: 5, lanes: [2, 2, 2, 2, 2], segments: 3, capacity: 48, ringMax: 24, seed: 1, win: [0.08, 0.25], naiveJams: true },
  { id: 'loop-19', title: 'Narrow ring', fr: 'Anneau étroit', note: 'Seven trucks and a loop with little room.', colors: 5, lanes: [2, 2, 1, 2], segments: 3, capacity: 24, ringMax: 10, slack: 2, seed: 1, win: [0.06, 0.25], naiveJams: true },
  { id: 'loop-20', title: 'Wide crossing, three deep', fr: 'Grande traversée, trois de fond', note: 'Ten trucks on the wide crossing, three deep in two lanes.', colors: 5, lanes: [3, 3, 2, 2], segments: 3, capacity: 56, ringMax: 24, shape: 'wide-eight', seed: 1, win: [0.05, 0.22], naiveJams: true },
  { id: 'loop-21', title: 'Crowded start', fr: 'Départ encombré', note: 'The loop begins nearly full; the first pour has to be the right one.', colors: 4, lanes: [2, 2, 2, 2], segments: 3, capacity: 30, ringMax: 26, seed: 1, win: [0.05, 0.35], naiveJams: true },
  { id: 'loop-22', title: 'Three lanes, three deep', fr: 'Trois voies, trois de fond', note: 'Nine trucks queue three deep in three lanes.', colors: 5, lanes: [3, 3, 3], segments: 3, capacity: 30, ringMax: 14, seed: 1, win: [0.05, 0.22], naiveJams: true },
  { id: 'loop-23', title: 'Tight eight', fr: 'Huit serré', note: 'Eight trucks over the bridge with a small loop.', colors: 5, lanes: [2, 2, 2, 2], segments: 3, capacity: 32, ringMax: 14, shape: 'eight', slack: 2, seed: 1, win: [0.05, 0.22], naiveJams: true },
  { id: 'loop-24', title: 'Three lanes, four colours', fr: 'Trois voies, quatre couleurs', note: 'Seven trucks in three lanes, four colours and little room on the loop.', colors: 4, lanes: [3, 2, 2], segments: 3, capacity: 28, ringMax: 12, seed: 1, win: [0.05, 0.25], naiveJams: true },
  { id: 'loop-25', title: 'Five lanes, nine trucks', fr: 'Cinq voies, neuf camions', note: 'Five lanes with one short queue.', colors: 5, lanes: [2, 2, 2, 1, 2], segments: 3, capacity: 40, ringMax: 18, seed: 1, win: [0.05, 0.28], naiveJams: true },
  { id: 'loop-26', title: 'Wide squeeze', fr: 'Grande traversée serrée', note: 'The wide crossing with a small loop.', colors: 5, lanes: [2, 2, 2, 2], segments: 3, capacity: 36, ringMax: 16, shape: 'wide-eight', slack: 2, seed: 500, win: [0.04, 0.18], naiveJams: true },
  { id: 'loop-27', title: 'Ten on the oval', fr: 'Dix sur l’ovale', note: 'Ten trucks in four lanes on the oval.', colors: 5, lanes: [3, 2, 3, 2], segments: 3, capacity: 48, ringMax: 22, seed: 6070, win: [0.04, 0.18], naiveJams: true },
  { id: 'loop-28', title: 'Three colours, three segments', fr: 'Trois couleurs, trois charges', note: 'Only three colours but eight trucks of three segments each.', colors: 3, lanes: [2, 2, 2, 2], segments: 3, capacity: 28, ringMax: 14, seed: 1, win: [0.04, 0.18], naiveJams: true },
  { id: 'loop-29', title: 'Rush hour eight', fr: 'Heure de pointe en huit', note: 'Ten trucks over the bridge.', colors: 5, lanes: [3, 2, 3, 2], segments: 3, capacity: 48, ringMax: 22, shape: 'eight', seed: 600, win: [0.04, 0.18], naiveJams: true },
  { id: 'loop-30', title: 'Grand finale', fr: 'Grand final', note: 'Ten trucks, five lanes, five colours on the wide crossing.', colors: 5, lanes: [2, 2, 2, 2, 2], segments: 3, capacity: 56, ringMax: 24, shape: 'wide-eight', seed: 3050, win: [0.04, 0.16], naiveJams: true },
];

if (process.argv[1]?.endsWith('loop-author.ts')) {
  const mode = process.argv[2] ?? 'emit';
  const only = process.argv.slice(3);
  const reports: LoopReport[] = [];
  for (const recipe of LOOP_RECIPES.filter((candidate) => !only.length || only.includes(candidate.id))) {
    const started = Date.now();
    const report = author(recipe);
    reports.push(report);
    console.error(`${recipe.id} seed ${report.seed} cap ${report.board.loopCapacity} marbles ${report.marbles} orders ${report.orders} win ${(report.winShare * 100).toFixed(0)}% random ${(report.random * 100).toFixed(1)}% lost-states ${(report.lostShare * 100).toFixed(0)}% hint ${report.hintMs}ms witness ${report.witness} jam ${report.jam} (${Date.now() - started}ms)`);
  }
  if (mode === 'emit') {
    console.log(reports.map(emitBoard).join('\n'));
    console.log(`\n// witnesses\n${reports.map((r) => `'${r.board.id}': '${r.witness}'`).join(', ')}`);
    console.log(`// jams\n${reports.map((r) => `'${r.board.id}': '${r.jam}'`).join(', ')}`);
    console.log(`// french\n${reports.map((r) => `'${r.board.id}': '${r.recipe.fr.replace(/'/g, '’')}'`).join(', ')}`);
  }
}
