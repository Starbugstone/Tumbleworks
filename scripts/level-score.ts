import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { LoopMachine } from '../src/loop/machine';
import { LoopRules } from '../src/loop/rules';
import { hintLoopSearch, settleLoop } from '../src/loop/solver';
import type { LoopBoardDef } from '../src/loop/types';
import { initPhysics, Machine } from '../src/machine/machine';
import { availableTubeMoves, solveTubeSearch, TubeRules } from '../src/puzzles/rules';
import type { TubeDef } from '../src/puzzles/types';
import { MachineRules } from '../src/sim/rules';
import { hintConveyorSearch, settle } from '../src/sim/solver';
import { COLOR_CODE, COLORS, type BoardDef, type Color } from '../src/sim/types';
import { naiveOrders, play as playFunnelOrder, playMachine as playFunnel, search as searchFunnel, tighten as tightenFunnel } from './funnel-author';
import { chooseF1, funnelRating, hashBoard, loopRating, multiTapFailure, tubeRating, type ScoreRow } from './level-curve';
import { laneByLane, playMachine as playLoop, roundRobin, search as searchLoop, tighten as tightenLoop } from './loop-author';
import { reachableTubeStates } from './tube-author';

/**
 * Scores a board with fixed seeds and no clocks, so a result is a function of board, player and seed.
 *   npx tsx scripts/level-score.ts score <ids...>        one JSON per board in SCORE_DIR, skipped when already scored for this board
 *   npx tsx scripts/level-score.ts merge                 folds them into tests/levelling/scores.json
 * Every player sees only the board, plays seeded and never undoes. Definitions and sample sizes are in docs/levelling.md.
 */
export const SCORE_DIR = process.env['SCORE_DIR'] ?? 'output/current/levelling/first-stretch/scores';
export const TABLE_PATH = 'tests/levelling/scores.json';
export const LIMIT_TICKS = 60 * 240;
const LAPSE = 0.15;
const SETTLED = 1e6;

export const seeded = (seed: number): (() => number) => {
  let state = (seed * 7919 + 17) % 2147483646 + 1;
  return () => { state = (state * 16807) % 2147483647; return state / 2147483647; };
};

export type FunnelPlayer = 'patient1' | 'patient2' | 'burst2' | 'burst3' | 'brisk' | 'spam' | 'cheese';
export type LoopPlayer = 'patient1' | 'patient2' | 'burst2' | 'burst3' | 'mixed' | 'mixedBrisk' | 'single' | 'spam';
export interface GameResult {
  readonly status: string;
  readonly seconds: number;
  readonly recoveries: number;
  /** The game as a replay, for keeping a recorded multi-tap win. */
  readonly steps: number;
  readonly actions: readonly (readonly [number, number])[];
}
const tapsOf = (actions: readonly { readonly step: number; readonly type: string; readonly at?: number }[]): [number, number][] =>
  actions.flatMap((action) => (action.type === 'tap' ? [[action.step, action.at!] as [number, number]] : []));

// ---- Funnel Sort ----
const cloneFunnel = (rules: MachineRules): MachineRules => { const copy = new MachineRules(rules.board); copy.restore(rules.snapshot()); return copy; };
function funnelValue(rules: MachineRules, tray: number): number {
  if (rules.status === 'won') return SETTLED;
  if (rules.status === 'jammed') return -SETTLED;
  const delivered = rules.state.marbles.filter((marble) => marble.status === 'in-box' || marble.status === 'dropping').length;
  return delivered / tray - 2 * (rules.occupancy + rules.funnelCount) / rules.board.beltCapacity;
}
function funnelForecast(from: MachineRules, column: number, depth: number, tray: number): number {
  const first = cloneFunnel(from);
  if (!first.release(column).ok) return -Infinity;
  settle(first);
  if (depth === 1 || first.status !== 'playing') return funnelValue(first, tray);
  let best = -Infinity;
  for (let next = 0; next < first.board.supplies.length; next++) {
    const second = cloneFunnel(first);
    if (!second.release(next).ok) continue;
    settle(second);
    best = Math.max(best, funnelValue(second, tray));
  }
  return best === -Infinity ? funnelValue(first, tray) : best;
}
function funnelPlan(rules: MachineRules, depth: number, tray: number, next: () => number): number | null {
  const open = rules.state.supplies.flatMap((queue, index) => (queue[0] ? [index] : []));
  if (!open.length) return null;
  if (next() < LAPSE) return open[Math.floor(next() * open.length)]!;
  const scored = open.map((column) => ({ column, score: funnelForecast(rules, column, depth, tray) }));
  const best = Math.max(...scored.map((entry) => entry.score));
  const tied = scored.filter((entry) => Math.abs(entry.score - best) < 1e-9);
  return tied[Math.floor(next() * tied.length)]!.column;
}
function funnelCrude(machine: Machine, player: FunnelPlayer, tick: number, next: () => number): number | null {
  const rules = machine.rules;
  const open = rules.state.supplies.flatMap((queue, index) => (queue[0] ? [index] : []));
  if (!open.length) return null;
  const pick = (from: readonly number[]): number => from[Math.floor(next() * from.length)]!;
  if (player === 'brisk') return rules.funnelCount === 0 && tick % 10 === 0 ? pick(open) : null;
  if (player === 'spam') return tick % 30 === 0 ? pick(open) : null;
  // Cheese: pour a wanted tray; pour an extra tray whenever nothing on the belt can be delivered and the belt has room.
  const wanted = new Set(rules.board.docks.map((_, dock) => rules.dockColor(dock)));
  const useful = open.filter((index) => wanted.has(rules.state.supplies[index]![0]!.color));
  if (tick % 45 !== 0) return null;
  if (useful.length && rules.funnelCount <= 18) return pick(useful);
  if (!rules.canDrain() && rules.free > 0) return pick(open);
  return rules.funnelCount === 0 ? pick(open) : null;
}
export function funnelGame(board: BoardDef, player: FunnelPlayer, seed: number): GameResult {
  const machine = new Machine(board);
  const next = seeded(seed);
  const trays = board.supplies.flat();
  const tray = trays.reduce((sum, packet) => sum + packet.count, 0) / trays.length;
  const depth = player.endsWith('1') ? 1 : 2;
  const burstSize = player.startsWith('burst') ? Number(player[5]) : 0;
  let inBurst = 0;
  let cooldown = 0;
  let tick = 0;
  for (; tick < LIMIT_TICKS; tick++) {
    machine.step();
    const rules = machine.rules;
    if (rules.status !== 'playing') break;
    if (player === 'brisk' || player === 'spam' || player === 'cheese') {
      const column = funnelCrude(machine, player, tick, next);
      if (column !== null) machine.tap(column);
      continue;
    }
    let act = false;
    if (burstSize) {
      // k taps 0.2 s apart, then watch until the pile has gone through or nothing can drain, at least 0.75 s.
      if (inBurst > 0) { if (tick % 12 === 0) { act = true; inBurst -= 1; if (!inBurst) cooldown = 45; } }
      else if (cooldown > 0) cooldown -= 1;
      else if (rules.funnelCount === 0 || (!rules.canDrain() && rules.free > 0)) { act = true; inBurst = burstSize - 1; if (!inBurst) cooldown = 45; }
    } else act = tick % 10 === 0 && !machine.transferring && !rules.canDrain() && rules.funnelCount === 0;
    if (!act) continue;
    const column = funnelPlan(rules, depth, tray, next);
    if (column !== null) machine.tap(column);
  }
  const { nudges, teleports, bounces } = machine.recoveries;
  const result = { status: machine.rules.status, seconds: tick / 60, recoveries: nudges + teleports + bounces, steps: machine.steps, actions: tapsOf(machine.actions) };
  machine.world.free();
  return result;
}

// ---- Loop Sort ----
const cloneLoop = (rules: LoopRules): LoopRules => { const copy = new LoopRules(rules.board); copy.restore(rules.snapshot()); return copy; };
function loopValue(rules: LoopRules, trucks: number, extras0: number): number {
  if (rules.status === 'won') return SETTLED;
  if (rules.status === 'jammed') return -SETTLED;
  const left = rules.state.lanes.flat();
  const cleared = trucks - left.length;
  const home = left.reduce((sum, truck) => sum + (truck.segments.at(-1)?.marbles.length ?? 0), 0) / rules.board.truckCapacity + cleared;
  const extras = left.reduce((sum, truck) => sum + truck.segments.length - 1, 0);
  return 2 * cleared + home + 0.5 * (extras0 - extras) - 2 * (rules.occupancy + rules.pending) / rules.board.loopCapacity;
}
function loopForecast(from: LoopRules, lane: number, depth: number, trucks: number, extras: number): number {
  const first = cloneLoop(from);
  if (!first.tap(lane).ok) return -Infinity;
  settleLoop(first);
  if (depth === 1 || first.status !== 'playing') return loopValue(first, trucks, extras);
  let best = -Infinity;
  for (let next = 0; next < first.board.lanes.length; next++) {
    const second = cloneLoop(first);
    if (!second.tap(next).ok) continue;
    settleLoop(second);
    best = Math.max(best, loopValue(second, trucks, extras));
  }
  return best === -Infinity ? loopValue(first, trucks, extras) : best;
}
function openLanes(rules: LoopRules): number[] {
  const out: number[] = [];
  for (let lane = 0; lane < rules.board.lanes.length; lane++) {
    const truck = rules.front(lane);
    if (truck && !truck.unloading.length && truck.segments.length >= 2) out.push(lane);
  }
  return out;
}
/**
 * The share of turns the mixed players burst on, with 2 or 3 taps. `mixed` is the planner of F1 otherwise: one tap, then wait
 * for it to settle, also before a burst. `mixedBrisk` keeps the burst player's pace on its other turns: once the pour has left
 * the truck and at least 0.75 s has gone, whatever is still to be absorbed. `single` is that pace with no bursts at all, which
 * separates what bursting costs from what not waiting costs.
 */
export const MIXED_BURST_SHARE = 0.25;
export function loopGame(board: LoopBoardDef, player: LoopPlayer, seed: number): GameResult {
  const machine = new LoopMachine(board);
  const next = seeded(seed);
  const trucks = board.lanes.flat().length;
  const extras = board.lanes.flat().reduce((sum, truck) => sum + truck.segments.length - 1, 0);
  const depth = player.endsWith('1') ? 1 : 2;
  const turnBased = player.startsWith('burst') || player === 'mixedBrisk' || player === 'single' || player === 'mixed';
  const waitsToSettle = player === 'mixed';
  const fixedBurst = player.startsWith('burst') ? Number(player[5]) : 1;
  let inBurst = 0;
  let cooldown = 0;
  let tick = 0;
  for (; tick < LIMIT_TICKS; tick++) {
    machine.step();
    const rules = machine.rules;
    if (rules.status !== 'playing') break;
    const open = openLanes(rules);
    if (turnBased && inBurst > 0 && tick % 12 === 0 && !open.length) { inBurst = 0; cooldown = 45; }
    if (cooldown > 0) cooldown -= 1;
    if (!open.length) continue;
    let act = false;
    if (turnBased) {
      if (inBurst > 0) { if (tick % 12 === 0) { act = true; inBurst -= 1; if (!inBurst) cooldown = 45; } }
      else if (cooldown === 0 && (waitsToSettle ? tick % 10 === 0 && !machine.transferring && !rules.canDrain() && rules.pending === 0 : rules.pending === 0 || (!rules.canDrain() && rules.free > 0))) {
        act = true;
        const taps = player === 'mixed' || player === 'mixedBrisk' ? (next() < MIXED_BURST_SHARE ? (next() < 0.5 ? 2 : 3) : 1) : fixedBurst;
        inBurst = taps - 1;
        if (!inBurst) cooldown = 45;
      }
    } else if (player === 'spam') act = tick % 30 === 0;
    else act = tick % 10 === 0 && !machine.transferring && !rules.canDrain() && rules.pending === 0;
    if (!act) continue;
    let lane: number;
    if (player === 'spam' || next() < LAPSE) lane = open[Math.floor(next() * open.length)]!;
    else {
      const scored = open.map((candidate) => ({ candidate, score: loopForecast(rules, candidate, depth, trucks, extras) }));
      const best = Math.max(...scored.map((entry) => entry.score));
      const tied = scored.filter((entry) => Math.abs(entry.score - best) < 1e-9);
      lane = tied[Math.floor(next() * tied.length)]!.candidate;
    }
    machine.tap(lane);
  }
  return { status: machine.rules.status, seconds: tick / 60, recoveries: 0, steps: machine.steps, actions: tapsOf(machine.actions) };
}

// ---- The settled graph: exact planners and its shape ----
interface GraphNode { readonly status: string; readonly value: number; readonly edges: number[] }
const utility = (node: GraphNode): number => (node.status === 'won' ? SETTLED : node.status === 'jammed' || !node.edges.length ? -SETTLED : node.value);
function policy(nodes: readonly GraphNode[], depth: number): number[][] {
  return nodes.map((node, id) => node.edges.map((to) => {
    const child = nodes[to]!;
    if (depth === 1 || child.status !== 'playing') return utility(child);
    const follow = child.edges.filter((after) => after !== id && after !== to);
    return follow.length ? Math.max(...follow.map((after) => utility(nodes[after]!))) : -SETTLED;
  }));
}
function weights(nodes: readonly GraphNode[], scores: number[][], id: number, history: readonly number[]): { to: number; p: number }[] {
  const choices = nodes[id]!.edges.map((to, index) => ({ to, index })).filter(({ to }) => to !== id && !history.includes(to));
  if (!choices.length) return [];
  const best = Math.max(...choices.map(({ index }) => scores[id]![index]!));
  const tied = choices.filter(({ index }) => Math.abs(scores[id]![index]! - best) < 1e-9).length;
  return choices.map(({ to, index }) => ({ to, p: LAPSE / choices.length + (Math.abs(scores[id]![index]! - best) < 1e-9 ? (1 - LAPSE) / tied : 0) }));
}
function exactWin(nodes: readonly GraphNode[], scores: number[][]): number {
  const memo = new Map<number, number>();
  const visit = (id: number): number => {
    const node = nodes[id]!;
    if (node.status === 'won') return 1;
    if (node.status === 'jammed' || !node.edges.length) return 0;
    const known = memo.get(id);
    if (known !== undefined) return known;
    memo.set(id, 0);
    const value = weights(nodes, scores, id, []).reduce((sum, edge) => sum + edge.p * visit(edge.to), 0);
    memo.set(id, value);
    return value;
  };
  return visit(0);
}
function sampledWin(nodes: readonly GraphNode[], scores: number[][], cap: number, games: number, seed: number): number {
  let state = seed;
  const next = (): number => { state = (state * 16807) % 2147483647; return state / 2147483647; };
  let wins = 0;
  for (let game = 0; game < games; game++) {
    let id = 0;
    const memory = [id];
    for (let used = 0; used < cap && nodes[id]!.status === 'playing'; used++) {
      const options = weights(nodes, scores, id, memory);
      if (!options.length) break;
      let roll = next();
      let chosen = options.at(-1)!.to;
      for (const option of options) { roll -= option.p; if (roll <= 0) { chosen = option.to; break; } }
      id = chosen;
      memory.push(id);
      if (memory.length > 12) memory.shift();
    }
    if (nodes[id]!.status === 'won') wins += 1;
  }
  return wins / games;
}
export interface GraphShape { readonly states: number; readonly solvable: boolean; readonly lostShare: number; readonly risk: number; readonly traps: number; readonly silent: number; readonly horizon: number }
function shapeOf(nodes: readonly GraphNode[]): GraphShape {
  const parents: number[][] = nodes.map(() => []);
  nodes.forEach((node, id) => node.edges.forEach((to) => parents[to]!.push(id)));
  const alive = new Set<number>();
  const stack: number[] = [];
  nodes.forEach((node, id) => { if (node.status === 'won') { alive.add(id); stack.push(id); } });
  while (stack.length) for (const parent of parents[stack.pop()!]!) if (!alive.has(parent)) { alive.add(parent); stack.push(parent); }
  const distance = new Map<number, number>();
  const queue: number[] = [];
  nodes.forEach((node, id) => { if (!node.edges.length && !alive.has(id)) { distance.set(id, 0); queue.push(id); } });
  for (let at = 0; at < queue.length; at++) for (const parent of parents[queue[at]!]!) if (!alive.has(parent) && !distance.has(parent)) { distance.set(parent, distance.get(queue[at]!)! + 1); queue.push(parent); }
  let risk = 0;
  let traps = 0;
  let silent = 0;
  let horizon = -1;
  nodes.forEach((node, id) => {
    const edges = [...new Set(node.edges)];
    if (alive.has(id) && edges.length && node.status === 'playing') {
      const safe = edges.filter((to) => alive.has(to)).length;
      if (safe < edges.length) {
        risk += 1;
        if (safe === 1) traps += 1;
        for (const to of edges) if (!alive.has(to) && distance.has(to)) horizon = Math.max(horizon, distance.get(to)!);
      }
    } else if (!alive.has(id) && edges.length) silent += 1;
  });
  return { states: nodes.length, solvable: alive.has(0), lostShare: 1 - alive.size / nodes.length, risk, traps, silent, horizon };
}
const sum = (values: readonly number[]): number => values.reduce((total, value) => total + value, 0);

function funnelGraph(board: BoardDef): GraphNode[] {
  const snapshots: ReturnType<MachineRules['snapshot']>[] = [];
  const nodes: (GraphNode & { edges: number[] })[] = [];
  const index = new Map<string, number>();
  const tray = sum(board.supplies.flat().map((packet) => packet.count)) / board.supplies.flat().length;
  const add = (rules: MachineRules): number => {
    const state = rules.state;
    const belt: Record<string, number> = {};
    for (const marble of state.marbles) if (marble.status === 'on-belt') belt[marble.color] = (belt[marble.color] ?? 0) + 1;
    const key = `${state.supplies.map((queue) => queue.length).join()}|${state.dockNext.map((box, dock) => `${box}:${rules.reserved(dock, box)}`).join()}|${JSON.stringify(belt)}|${state.pending.map((id) => COLOR_CODE[state.marbles[id]!.color]).join('')}`;
    const known = index.get(key);
    if (known !== undefined) return known;
    const id = nodes.length;
    index.set(key, id);
    snapshots.push(rules.snapshot());
    const delivered = state.marbles.filter((marble) => marble.status === 'in-box' || marble.status === 'dropping').length;
    nodes.push({ status: rules.status, value: delivered / tray - 2 * (rules.occupancy + rules.funnelCount) / board.beltCapacity, edges: [] });
    return id;
  };
  const rules = new MachineRules(board);
  settle(rules);
  add(rules);
  for (let id = 0; id < nodes.length; id++) {
    if (nodes[id]!.status !== 'playing') continue;
    for (let column = 0; column < board.supplies.length; column++) {
      rules.restore(snapshots[id]!);
      if (!rules.release(column).ok) continue;
      settle(rules);
      nodes[id]!.edges.push(add(rules));
    }
  }
  return nodes;
}
export function loopOrderKey(state: LoopRules['state']): string {
  const loop: Record<string, number> = {};
  for (const marble of state.marbles) if (marble.status === 'on-loop') loop[marble.color] = (loop[marble.color] ?? 0) + 1;
  return `${state.lanes.map((queue) => queue.map((truck) => truck.segments.map((segment) => `${COLOR_CODE[segment.color]}${segment.marbles.length}`).join('.') + (truck.unloading.length ? `u${truck.unloading.length}` : '')).join('/')).join('|')}#${JSON.stringify(loop)}`;
}
export function loopGraphKey(rules: LoopRules): string {
  return `${rules.state.lanes.map((queue) => queue.map((truck) => `${truck.index}:${truck.segments.map((segment) => `${COLOR_CODE[segment.color]}${segment.marbles.length}`).join('.')}u${truck.unloading.length}`).join('/')).join('|')}#${COLORS.map((color) => rules.state.marbles.filter((marble) => marble.status === 'on-loop' && marble.color === color).length).join()}`;
}
function loopGraph(board: LoopBoardDef): GraphNode[] {
  const snapshots: ReturnType<LoopRules['snapshot']>[] = [];
  const nodes: (GraphNode & { edges: number[] })[] = [];
  const index = new Map<string, number>();
  const trucks = board.lanes.flat().length;
  const extras0 = sum(board.lanes.flat().map((truck) => truck.segments.length - 1));
  const add = (rules: LoopRules): number => {
    const key = loopGraphKey(rules);
    const known = index.get(key);
    if (known !== undefined) return known;
    const id = nodes.length;
    index.set(key, id);
    snapshots.push(rules.snapshot());
    const left = rules.state.lanes.flat();
    const cleared = trucks - left.length;
    const home = sum(left.map((truck) => truck.segments.at(-1)!.marbles.length)) / board.truckCapacity + cleared;
    const extras = sum(left.map((truck) => truck.segments.length - 1));
    nodes.push({ status: rules.status, value: 2 * cleared + home + 0.5 * (extras0 - extras) - 2 * (rules.occupancy + rules.pending) / board.loopCapacity, edges: [] });
    return id;
  };
  const rules = new LoopRules(board);
  settleLoop(rules);
  add(rules);
  for (let id = 0; id < nodes.length; id++) {
    if (nodes[id]!.status !== 'playing') continue;
    for (let lane = 0; lane < board.lanes.length; lane++) {
      rules.restore(snapshots[id]!);
      if (!rules.tap(lane).ok) continue;
      settleLoop(rules);
      nodes[id]!.edges.push(add(rules));
    }
  }
  return nodes;
}
export interface SettledScore { readonly F1: number; readonly shape: GraphShape }
const settledFrom = (nodes: readonly GraphNode[]): SettledScore => {
  const p1 = exactWin(nodes, policy(nodes, 1));
  const p2 = exactWin(nodes, policy(nodes, 2));
  return { F1: 100 * (1 - (p1 + p2) / 2), shape: shapeOf(nodes) };
};
export const settledFunnel = (board: BoardDef): SettledScore => settledFrom(funnelGraph(board));
export const settledLoop = (board: LoopBoardDef): SettledScore => settledFrom(loopGraph(board));

export interface TubeScore { readonly F1: number; readonly moves: number; readonly shape: GraphShape; readonly graphStates: number; readonly hintStates: number }
export function scoreTube(board: TubeDef): TubeScore | null {
  const graphStates = reachableTubeStates(board);
  const { moves, states: hintStates } = solveTubeSearch(board, { tubes: board.tubes.map((tube) => [...tube]), moves: 0, status: 'playing' });
  if (!moves) return null;
  const snapshots: ReturnType<TubeRules['snapshot']>[] = [];
  const nodes: (GraphNode & { edges: number[] })[] = [];
  const index = new Map<string, number>();
  const runs = (tubes: readonly (readonly string[])[]): number => sum(tubes.map((tube) => tube.filter((color, at) => at === 0 || color !== tube[at - 1]).length));
  const runs0 = runs(board.tubes);
  const add = (rules: TubeRules): number => {
    const key = rules.state.tubes.map((tube) => tube.join(',')).sort().join('|');
    const known = index.get(key);
    if (known !== undefined) return known;
    const id = nodes.length;
    index.set(key, id);
    snapshots.push(rules.snapshot());
    const tubes = rules.state.tubes;
    const full = tubes.filter((tube) => tube.length === board.capacity && tube.every((color) => color === tube[0])).length;
    const empty = tubes.filter((tube) => !tube.length).length;
    nodes.push({ status: rules.status, value: runs0 - runs(tubes) + 2 * full + 0.5 * empty, edges: [] });
    return id;
  };
  const rules = new TubeRules(board);
  add(rules);
  for (let id = 0; id < nodes.length; id++) {
    if (nodes[id]!.status !== 'playing') continue;
    for (const move of availableTubeMoves(board, snapshots[id]!)) {
      rules.state = structuredClone(snapshots[id]!);
      rules.move(move.from, move.to);
      nodes[id]!.edges.push(add(rules));
    }
  }
  const cap = 2 * moves.length + 6;
  const p1 = sampledWin(nodes, policy(nodes, 1), cap, 1000, 12345);
  const p2 = sampledWin(nodes, policy(nodes, 2), cap, 1000, 54321);
  return { F1: 100 * (1 - (p1 + p2) / 2), moves: moves.length, shape: shapeOf(nodes), graphStates, hintStates };
}

// ---- Witness checks on the machines ----
const delays = (next: () => number): number => Math.floor(next() * 90);
/** The stored order, each tap a seeded 0 to 1.5 s after the player's calm moment. */
export function funnelJitter(board: BoardDef, order: string, runs = 20): number {
  const taps = [...order].map((letter) => letter.charCodeAt(0) - 65);
  let wins = 0;
  for (let run = 1; run <= runs; run++) {
    const machine = new Machine(board);
    const next = seeded(run);
    let at = 0;
    let wait = delays(next);
    for (let tick = 0; tick < 60 * 200; tick++) {
      machine.step();
      if (machine.rules.status !== 'playing') break;
      if (machine.transferring || machine.rules.canDrain() || at >= taps.length) continue;
      if (wait > 0) { wait -= 1; continue; }
      if (machine.tap(taps[at]!).ok) { at += 1; wait = delays(next); }
    }
    if (machine.rules.status === 'won') wins += 1;
    machine.world.free();
  }
  return wins / runs;
}
export function loopJitter(board: LoopBoardDef, order: string, runs = 20): number {
  const taps = [...order].map((letter) => letter.charCodeAt(0) - 65);
  let wins = 0;
  for (let run = 1; run <= runs; run++) {
    const machine = new LoopMachine(board);
    const next = seeded(run);
    let at = 0;
    let wait = delays(next);
    for (let tick = 0; tick < 60 * 240; tick++) {
      machine.step();
      if (machine.rules.status !== 'playing') break;
      if (machine.transferring || machine.rules.canDrain() || at >= taps.length) continue;
      if (wait > 0) { wait -= 1; continue; }
      if (machine.tap(taps[at]!).ok) { at += 1; wait = delays(next); }
    }
    if (machine.rules.status === 'won') wins += 1;
  }
  return wins / runs;
}

interface Choices<S> { readonly start: S; readonly count: number; status(state: S): string; key(state: S): string; act(state: S, choice: number): S | null }
/** Winning orders sampled uniformly from every winning order the settled rules have. */
function sampleWinningOrders<S>(game: Choices<S>, wanted: number): string[] {
  const memo = new Map<string, number>();
  const open = new Set<string>();
  const wins = (state: S): number => {
    const status = game.status(state);
    if (status === 'won') return 1;
    if (status === 'jammed') return 0;
    const key = game.key(state);
    const known = memo.get(key);
    if (known !== undefined) return known;
    if (open.has(key)) return 0;
    open.add(key);
    let total = 0;
    for (let choice = 0; choice < game.count; choice++) { const after = game.act(state, choice); if (after !== null) total += wins(after); }
    open.delete(key);
    memo.set(key, total);
    return total;
  };
  if (wins(game.start) === 0) return [];
  const next = seeded(4242);
  const orders: string[] = [];
  for (let order = 0; order < wanted; order++) {
    let state = game.start;
    let path = '';
    while (game.status(state) !== 'won') {
      const options = Array.from({ length: game.count }, (_, choice) => ({ choice, after: game.act(state, choice) })).flatMap(({ choice, after }) => (after === null ? [] : [{ choice, after, weight: wins(after) }]));
      let roll = next() * sum(options.map((option) => option.weight));
      let pick = options.at(-1)!;
      for (const option of options) { roll -= option.weight; if (roll <= 0 && option.weight > 0) { pick = option; break; } }
      path += String.fromCharCode(65 + pick.choice);
      state = pick.after;
    }
    orders.push(path);
  }
  return orders;
}
function funnelOrders(board: BoardDef, wanted: number): string[] {
  const start = new MachineRules(board);
  settle(start);
  const rules = new MachineRules(board);
  return sampleWinningOrders({
    start: start.snapshot(), count: board.supplies.length,
    status: (state) => state.status,
    key: (state) => { rules.restore(state); const belt: Record<string, number> = {}; for (const marble of state.marbles) if (marble.status === 'on-belt') belt[marble.color] = (belt[marble.color] ?? 0) + 1; return `${state.supplies.map((queue) => queue.length).join()}|${state.dockNext.map((box, dock) => `${box}:${rules.reserved(dock, box)}`).join()}|${JSON.stringify(belt)}|${state.pending.map((id) => COLOR_CODE[state.marbles[id]!.color]).join('')}`; },
    act: (state, choice) => { rules.restore(state); if (!rules.release(choice).ok) return null; settle(rules); return rules.snapshot(); },
  }, wanted);
}
function loopOrders(board: LoopBoardDef, wanted: number): string[] {
  const start = new LoopRules(board);
  settleLoop(start);
  const rules = new LoopRules(board);
  return sampleWinningOrders({
    start: start.snapshot(), count: board.lanes.length,
    status: (state) => state.status,
    key: loopOrderKey,
    act: (state, choice) => { rules.restore(state); if (!rules.tap(choice).ok) return null; settleLoop(rules); return rules.snapshot(); },
  }, wanted);
}
export async function funnelShare(board: BoardDef, wanted = 12): Promise<{ brisk: number; patient: number; orders: number }> {
  const orders = funnelOrders(board, wanted);
  let brisk = 0;
  let patient = 0;
  for (const order of orders) {
    if ((await playFunnel(board, order, 150, false)).status === 'won') brisk += 1;
    if ((await playFunnel(board, order, 150, true)).status === 'won') patient += 1;
  }
  return { brisk: brisk / orders.length, patient: patient / orders.length, orders: orders.length };
}
export function loopShare(board: LoopBoardDef, wanted = 12): { brisk: number; patient: number; orders: number } {
  const orders = loopOrders(board, wanted);
  let brisk = 0;
  let patient = 0;
  for (const order of orders) {
    if (playLoop(board, order, 185, false).status === 'won') brisk += 1;
    if (playLoop(board, order, 185, true).status === 'won') patient += 1;
  }
  return { brisk: brisk / orders.length, patient: patient / orders.length, orders: orders.length };
}

// ---- Tallies ----
export interface Tally { readonly win: number; readonly n: number; readonly recoveries: number; readonly seconds: number | null; readonly first: string; readonly fast: GameResult | null }
export function tally(play: (seed: number) => GameResult, games: number, keepWin = false): Tally {
  let wins = 0;
  let recoveries = 0;
  let seconds = 0;
  let first = '';
  let fast: GameResult | null = null;
  for (let seed = 1; seed <= games; seed++) {
    const game = play(seed);
    const won = game.status === 'won';
    if (won) { wins += 1; seconds += game.seconds; if (keepWin) fast ??= game; }
    recoveries += game.recoveries;
    if (seed <= 6) first += won ? 'W' : 'L';
  }
  return { win: wins / games, n: games, recoveries, seconds: wins ? seconds / wins : null, first, fast };
}
export const winsOf = (players: Readonly<Record<string, Tally>>): ScoreRow['wins'] => Object.fromEntries(Object.entries(players).map(([name, entry]) => [name, { win: entry.win, n: entry.n, recoveries: entry.recoveries }]));

export interface ScoredFile {
  readonly row: ScoreRow;
  /** A recorded multi-tap win, replayable on the real machine. */
  readonly fast: { readonly steps: number; readonly actions: readonly (readonly [number, number])[] } | null;
  readonly board: unknown;
  readonly extra?: Readonly<Record<string, unknown>>;
}

/** Players already tallied are reused, so an author's screening games are not played twice. */
export async function scoreFunnel(board: BoardDef, witness: string | undefined, games = 60, machineGames = 60, known: Readonly<Record<string, Tally>> = {}): Promise<ScoredFile> {
  await initPhysics();
  const settled = settledFunnel(board);
  const found = searchFunnel(board);
  const play = (player: FunnelPlayer) => (seed: number): GameResult => funnelGame(board, player, seed);
  const players: Record<string, Tally> = { ...known };
  players['burst2'] ??= tally(play('burst2'), games, true);
  players['burst3'] ??= tally(play('burst3'), games, true);
  players['cheese'] ??= tally(play('cheese'), games);
  players['spam'] ??= tally(play('spam'), games);
  players['brisk'] ??= tally(play('brisk'), games);
  let F1machine: number | null = null;
  if (machineGames > 0) {
    players['patient1'] ??= tally(play('patient1'), machineGames);
    players['patient2'] ??= tally(play('patient2'), machineGames);
    F1machine = 100 * (1 - (players['patient1'].win + players['patient2'].win) / 2);
  }
  const F1 = chooseF1(settled.F1, F1machine);
  const order = witness ?? found.witness ?? '';
  const naive = naiveOrders(board).map((taps) => playFunnelOrder(board, taps) === 'jammed');
  const share = await funnelShare(board);
  const fast = players['burst2'].fast ?? players['burst3'].fast;
  const row: ScoreRow = {
    id: board.id, game: 'funnel', hash: hashBoard(board), A: order.length, F1, F1settled: settled.F1, F1machine,
    FM: multiTapFailure(players['burst2'].win, players['burst3'].win),
    S: funnelRating(F1, players['burst2'].win, players['burst3'].win, players['cheese'].win),
    states: settled.shape.states, risk: settled.shape.risk, lostShare: settled.shape.lostShare, silent: settled.shape.silent,
    hintStates: hintConveyorSearch(new MachineRules(board)).states, wins: winsOf(players), probe: players['burst2'].first,
    hasJam: Boolean(found.jam), naiveJams: naive.filter(Boolean).length, naiveOrders: naive.length,
    witnessWins: (await playFunnel(board, order, 150, false)).status === 'won' && (await playFunnel(board, order, 150, true)).status === 'won',
    jitter: funnelJitter(board, order), shareBrisk: share.brisk, sharePatient: share.patient, shareOrders: share.orders,
    fastWitness: Boolean(fast), capacity: board.beltCapacity, tight: tightenFunnel(board).beltCapacity,
  };
  return { row, fast: fast ? { steps: fast.steps, actions: fast.actions } : null, board, extra: { W: found.winning / found.orders, P: found.random, witness: order } };
}

export function scoreLoop(board: LoopBoardDef, witness: string | undefined, games = 200): ScoredFile {
  const settled = settledLoop(board);
  const found = searchLoop(board);
  const play = (player: LoopPlayer) => (seed: number): GameResult => loopGame(board, player, seed);
  const players: Record<string, Tally> = {};
  for (const player of ['burst2', 'burst3'] as const) players[player] = tally(play(player), games, true);
  players['mixed'] = tally(play('mixed'), games, true);
  for (const player of ['mixedBrisk', 'single', 'spam', 'patient1', 'patient2'] as const) players[player] = tally(play(player), games);
  const F1machine = 100 * (1 - (players['patient1']!.win + players['patient2']!.win) / 2);
  const F1 = chooseF1(settled.F1, F1machine);
  const FM = multiTapFailure(players['burst2']!.win, players['burst3']!.win);
  const order = witness ?? found.witness ?? '';
  const naive = [laneByLane(board) === 'jammed', roundRobin(board) === 'jammed'];
  const share = loopShare(board);
  // A recorded win with taps inside one pour: an every-turn burst if one won, else the occasional-burst player's.
  const fast = players['burst2']!.fast ?? players['burst3']!.fast ?? players['mixed']!.fast;
  const both = [false, true].every((patient) => { const game = playLoop(board, order, 185, patient); return game.status === 'won' && game.done; });
  const row: ScoreRow = {
    id: board.id, game: 'loop', hash: hashBoard(board), A: order.length, F1, F1settled: settled.F1, F1machine, FM, S: loopRating(F1, FM),
    states: settled.shape.states, risk: settled.shape.risk, lostShare: settled.shape.lostShare, silent: settled.shape.silent,
    hintStates: hintLoopSearch(new LoopRules(board)).states, wins: winsOf(players), probe: players['burst2']!.first,
    hasJam: Boolean(found.jam), naiveJams: naive.filter(Boolean).length, naiveOrders: naive.length, witnessWins: both,
    jitter: loopJitter(board, order), shareBrisk: share.brisk, sharePatient: share.patient, shareOrders: share.orders, fastWitness: Boolean(fast),
    maxSegments: Math.max(...board.lanes.flat().map((truck) => truck.segments.length)), ringUnits: sum(board.loop.map((packet) => packet.count)),
    capacity: board.loopCapacity, tight: tightenLoop(board).loopCapacity,
  };
  return { row, fast: fast ? { steps: fast.steps, actions: fast.actions } : null, board, extra: { W: found.winning / found.orders, P: found.random, witness: order } };
}

export function scoreTubeRow(board: TubeDef): ScoredFile {
  const score = scoreTube(board);
  if (!score) throw new Error(`${board.id} has no solution within the hint's budget`);
  const S = tubeRating(score.F1, score.moves);
  const row: ScoreRow = {
    id: board.id, game: 'tube', hash: hashBoard(board), A: score.moves, F1: score.F1, F1settled: score.F1, F1machine: null, FM: score.F1, S,
    states: score.shape.states, risk: score.shape.risk, lostShare: score.shape.lostShare, silent: score.shape.silent, hintStates: score.hintStates, wins: {}, graphStates: score.graphStates,
  };
  return { row, fast: null, board };
}

if (process.argv[1]?.endsWith('level-score.ts')) {
  const [mode = 'score', ...ids] = process.argv.slice(2);
  mkdirSync(SCORE_DIR, { recursive: true });
  if (mode === 'merge') {
    // Tube Sort's S is a formula of stored figures, so a changed formula takes effect without a re-score.
    const rows = readdirSync(SCORE_DIR).filter((file) => file.endsWith('.json')).map((file) => (JSON.parse(readFileSync(`${SCORE_DIR}/${file}`, 'utf8')) as ScoredFile).row)
      .map((row) => (row.game === 'tube' ? { ...row, S: tubeRating(row.F1, row.A) } : row));
    const order = (id: string): number => ['board', 'loop', 'tube'].indexOf(id.split('-')[0]!) * 1000 + Number(id.split('-')[1]);
    const sorted = rows.sort((a, b) => order(a.id) - order(b.id));
    writeFileSync(TABLE_PATH, `[\n${sorted.map((row) => JSON.stringify(row)).join(',\n')}\n]\n`);
    console.log(`${sorted.length} rows`);
  } else {
    const { BOARDS } = await import('../src/sim/boards');
    const { LOOP_BOARDS } = await import('../src/loop/boards');
    const { TUBE_BOARDS } = await import('../src/puzzles/levels');
    const { FUNNEL_WITNESSES, LOOP_WITNESSES } = await import('../tests/witnesses');
    const games = Number(process.env['GAMES'] ?? 0) || undefined;
    const machineGames = process.env['MACHINE_GAMES'] === undefined ? 60 : Number(process.env['MACHINE_GAMES']);
    for (const id of ids) {
      const file = `${SCORE_DIR}/${id}.json`;
      const started = Date.now();
      const funnel = BOARDS.find((board) => board.id === id);
      const loop = LOOP_BOARDS.find((board) => board.id === id);
      const tube = TUBE_BOARDS.find((board) => board.id === id);
      const board = funnel ?? loop ?? tube;
      if (!board) throw new Error(`No level ${id}`);
      try {
        const existing = JSON.parse(readFileSync(file, 'utf8')) as ScoredFile;
        if (existing.row.hash === hashBoard(board) && !process.env['FORCE']) { console.error(id, 'already scored'); continue; }
      } catch { /* not scored yet */ }
      const scored = funnel ? await scoreFunnel(funnel, FUNNEL_WITNESSES[id], games, machineGames) : loop ? scoreLoop(loop, LOOP_WITNESSES[id], games) : scoreTubeRow(tube!);
      writeFileSync(file, JSON.stringify(scored));
      const { row } = scored;
      console.error(id, `${Math.round((Date.now() - started) / 1000)}s`, `A ${row.A} F1 ${row.F1.toFixed(1)} FM ${row.FM.toFixed(1)} S ${row.S.toFixed(1)} hint ${row.hintStates} risk ${row.risk}`, Object.entries(row.wins).map(([name, entry]) => `${name} ${entry.win.toFixed(2)}`).join(' '));
    }
  }
}
