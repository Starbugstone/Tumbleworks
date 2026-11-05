import { LoopMachine } from '../src/loop/machine';
import { LoopRules } from '../src/loop/rules';
import { settleLoop } from '../src/loop/solver';
import type { LoopBoardDef } from '../src/loop/types';
import { initPhysics, Machine } from '../src/machine/machine';
import { availableTubeMoves, completedTube, tubeContainer, tubeKey, TubeRules } from '../src/puzzles/rules';
import type { TubeDef } from '../src/puzzles/types';
import { MachineRules } from '../src/sim/rules';
import { settle } from '../src/sim/solver';
import type { BoardDef } from '../src/sim/types';
import { seeded, STRONG_POLICY } from './level-policy';

export interface StrongNode {
  readonly status: string;
  readonly value: number;
  /** One entry per legal action, including equivalent destinations. */
  readonly edges: readonly number[];
}
export interface StrongGraph { node(id: number): StrongNode }
export class Exhausted extends Error {}
const TERMINAL = 1e6;
interface Value { readonly value: number; readonly work: number }

/** A memo bucket is (state, remaining depth); the path context prevents cycle-pruned values leaking between paths. */
export class StrongPlanner {
  private readonly memo = new Map<string, Map<string, Value>>();
  private memoEntries = 0;
  constructor(readonly graph: StrongGraph, readonly budget: number = STRONG_POLICY.nodeBudget) {}

  choose(id: number, depth: number, lapse: number, next: () => number, previous?: number): { index: number | null; nodes: number; exhausted: boolean; reason?: string } {
    let nodes = 0;
    const path = new Set<number>(previous === undefined ? [id] : [previous, id]);
    const charge = (work: number): void => { nodes += work; if (nodes > this.budget) throw new Exhausted('planner-nodes'); };
    const value = (at: number, remaining: number): Value => {
      const node = this.graph.node(at);
      charge(1);
      if (node.status === 'won') return { value: TERMINAL + remaining, work: 1 };
      if (node.status === 'jammed' || !node.edges.length) return { value: -TERMINAL, work: 1 };
      if (!remaining) return { value: node.value, work: 1 };
      const key = `${at}:${remaining}`;
      const context = [...path].sort((a, b) => a - b).join(',');
      const cached = this.memo.get(key)?.get(context);
      if (cached) { charge(cached.work - 1); return cached; }
      const before = nodes;
      path.add(at);
      let best = -TERMINAL;
      for (const to of node.edges) if (!path.has(to)) best = Math.max(best, value(to, remaining - 1).value);
      path.delete(at);
      const result = { value: best, work: nodes - before + 1 };
      const bucket = this.memo.get(key) ?? new Map<string, Value>();
      if (!bucket.has(context)) this.memoEntries++;
      bucket.set(context, result);
      if (this.memoEntries >= 200_000) { this.memo.clear(); this.memoEntries = bucket.size; }
      this.memo.set(key, bucket);
      return result;
    };
    try {
      const edges = this.graph.node(id).edges;
      if (!edges.length) return { index: null, nodes, exhausted: false };
      // A lapse is uniform over *all* legal actions, even a reversal or symmetric move.
      if (next() < lapse) return { index: Math.floor(next() * edges.length), nodes, exhausted: false };
      const candidates = edges.flatMap((to, index) => path.has(to) ? [] : [{ index, value: value(to, depth - 1).value }]);
      if (!candidates.length) return { index: null, nodes, exhausted: false };
      const best = Math.max(...candidates.map((entry) => entry.value));
      const tied = candidates.filter((entry) => Math.abs(entry.value - best) < 1e-9);
      return { index: tied[Math.floor(next() * tied.length)]!.index, nodes, exhausted: false };
    } catch (error) {
      if (!(error instanceof Exhausted)) throw error;
      return { index: null, nodes: Math.min(nodes, this.budget), exhausted: true, reason: error.message };
    }
  }
}

interface RulesGraph<S, A> extends StrongGraph {
  readonly start: number;
  readonly size: number;
  add(state: S): number;
  action(id: number, index: number): A;
  solvable(id: number): boolean | null;
}
interface Adapter<S, A> {
  key(state: S): string;
  describe(state: S): { status: string; value: number };
  moves(state: S): readonly A[];
  after(state: S, action: A): S;
}
/** Lazily expands legal rules. The oracle is diagnostic only and never supplies policy values. */
function rulesGraph<S, A>(start: S, adapter: Adapter<S, A>, cap: number = STRONG_POLICY.graphBudget): RulesGraph<S, A> {
  const states: (S | undefined)[] = [];
  const keys = new Map<string, number>();
  const nodes = new Map<number, StrongNode>();
  const actions = new Map<number, readonly A[]>();
  const known = new Map<number, boolean>();
  const graph: RulesGraph<S, A> = {
    start: 0,
    get size() { return states.length; },
    add(state) {
      const key = adapter.key(state);
      const found = keys.get(key);
      if (found !== undefined) return found;
      if (states.length >= cap) throw new Exhausted('graph-states');
      const id = states.length;
      keys.set(key, id); states.push(state);
      return id;
    },
    node(id) {
      const cached = nodes.get(id);
      if (cached) return cached;
      const state = states[id]!;
      const description = adapter.describe(state);
      const moves = description.status === 'playing' ? adapter.moves(state) : [];
      const edges = moves.map((move) => graph.add(adapter.after(state, move)));
      actions.set(id, moves);
      const node = { ...description, edges };
      nodes.set(id, node);
      // Once expanded, its immutable edges/value replace the potentially large marble snapshot.
      states[id] = undefined;
      return node;
    },
    action(id, index) { graph.node(id); return actions.get(id)![index]!; },
    solvable(id) {
      const cached = known.get(id);
      if (cached !== undefined) return cached;
      const queue = [id];
      const parents = new Map<number, number | null>([[id, null]]);
      try {
        for (let at = 0; at < queue.length; at++) {
          const current = queue[at]!;
          const node = graph.node(current);
          if (node.status === 'won' || known.get(current) === true) {
            let cursor: number | null = current;
            while (cursor !== null) { known.set(cursor, true); cursor = parents.get(cursor) ?? null; }
            return true;
          }
          if (known.get(current) === false) continue;
          for (const to of node.edges) if (!parents.has(to)) {
            if (parents.size >= STRONG_POLICY.oracleBudget) return null;
            parents.set(to, current); queue.push(to);
          }
        }
        // A whole reachable component with no winning exit is a proof, including cyclic silent losses.
        for (const at of queue) known.set(at, false);
        return false;
      } catch (error) { if (error instanceof Exhausted) return null; throw error; }
    },
  };
  graph.add(start);
  return graph;
}

/** Finished box assignments never influence another rule transition; active marble identity still does. */
export function funnelStrongKey(state: ReturnType<MachineRules['snapshot']>): string {
  const statuses = { 'in-supply': 's', pouring: 'p', 'on-belt': 'b', dropping: 'd', 'in-box': 'i' } as const;
  const reserved = state.dockNext.map((box, dock) => state.marbles.filter((marble) => marble.dock === dock && marble.box === box).length);
  return JSON.stringify([state.status, state.supplies.map((queue) => queue.length), state.pending,
    [...state.released].sort((a,b) => a-b), state.sealsOpen, state.dockNext, reserved, state.marbles.map((marble) => statuses[marble.status]).join('')]);
}

function funnelGraph(board: BoardDef) {
  const rules = new MachineRules(board);
  const tray = board.supplies.flat().reduce((n, packet) => n + packet.count, 0) / board.supplies.flat().length;
  settle(rules);
  return rulesGraph(rules.snapshot(), {
    // Preserve active identity/order without retaining the history of which finished box took each marble.
    key: funnelStrongKey,
    describe(state) {
      rules.restore(state);
      return { status: rules.status, value: state.marbles.filter((m) => m.status === 'in-box' || m.status === 'dropping').length / tray - 2 * (rules.occupancy + rules.funnelCount) / board.beltCapacity };
    },
    moves: (state) => { rules.restore(state); return rules.actions(); },
    after(state, action) {
      rules.restore(state); rules.release(action);
      if (!settle(rules)) throw new Exhausted('settle');
      return rules.snapshot();
    },
  });
}
function loopGraph(board: LoopBoardDef) {
  const rules = new LoopRules(board);
  const trucks = board.lanes.flat().length;
  const extras0 = board.lanes.flat().reduce((n, truck) => n + truck.segments.length - 1, 0);
  settleLoop(rules);
  return rulesGraph(rules.snapshot(), {
    key: (state) => JSON.stringify(state),
    describe(state) {
      rules.restore(state);
      const left = state.lanes.flat();
      const cleared = trucks - left.length;
      const home = left.reduce((n, truck) => n + (truck.segments.at(-1)?.marbles.length ?? 0) / truck.capacity, 0) + cleared;
      const extras = left.reduce((n, truck) => n + truck.segments.length - 1, 0);
      return { status: rules.status, value: 2 * cleared + home + 0.5 * (extras0 - extras) - 2 * (rules.occupancy + rules.pending) / board.loopCapacity };
    },
    moves: (state) => { rules.restore(state); return rules.actions(); },
    after(state, action) {
      rules.restore(state); rules.tap(action);
      if (!settleLoop(rules)) throw new Exhausted('settle');
      return rules.snapshot();
    },
  });
}
export function strongTubeGraph(board: TubeDef) {
  const rules = new TubeRules(board);
  const runs = (tubes: readonly (readonly string[])[]) => tubes.reduce((n, tube) => n + tube.filter((color, at) => !at || color !== tube[at - 1]).length, 0);
  const initial = runs(board.tubes);
  return rulesGraph(rules.snapshot(), {
    // Exact quotient by interchangeable tubes; duplicate actions retain their probability mass.
    key: (state) => tubeKey(board, state),
    describe(state) {
      const full = state.tubes.filter((_, index) => completedTube(board, state, index)).length;
      const empty = state.tubes.filter((tube, index) => !tube.length && !state.spent[index] && (tubeContainer(board, index).role !== 'capped' || state.opened[index])).length;
      return { status: state.status, value: initial - runs(state.tubes) + 2 * full + 0.5 * empty };
    },
    moves: (state) => availableTubeMoves(board, state),
    after(state, action) { rules.restore(state); rules.move(action.from, action.to); return rules.snapshot(); },
  }, 40_000);
}

export type StrongOutcome = 'won' | 'terminal-jam' | 'silent-loss' | 'exhausted';
export interface StrongRun {
  readonly outcome: StrongOutcome;
  readonly reason?: string;
  readonly actions: number;
  readonly firstIrreversible: number | null;
  readonly oracleExhausted: boolean;
  readonly nodes: number;
  readonly recoveries: number;
}
export interface StrongPart {
  readonly depth: number;
  readonly lapse: number;
  readonly n: number;
  /** Null if any trial exhausted: a censored sample must not masquerade as measured difficulty. */
  readonly failure: number | null;
  readonly failureBounds: readonly [number, number];
  readonly won: number;
  readonly terminalJam: number;
  readonly silentLoss: number;
  readonly exhausted: number;
  readonly reasons: Readonly<Record<string, number>>;
  readonly firstIrreversible: { readonly mean: number | null; readonly byAction: Readonly<Record<string, number>>; readonly unknown: number };
  readonly nodes: number;
  readonly recoveries: number;
  /** Conveyor proxy mismatch: a real win after the settled oracle declared the position lost. */
  readonly wonAfterProxyLoss: number;
}
export interface StrongMeasurement {
  readonly H: number | null;
  readonly zeroLapse: number | null;
  readonly parts: readonly StrongPart[];
}
export interface StrongScore {
  /** Machine patient H for conveyors; exact graph H for Tube Sort. */
  readonly H: number | null;
  readonly settled: StrongMeasurement;
  readonly machine?: Readonly<Record<StrongTiming, StrongMeasurement>>;
  readonly policy: typeof STRONG_POLICY;
  readonly diagnosis: 'exact' | 'settled-proxy';
}
export type StrongTiming = 'patient' | 'burst2' | 'burst3';

export function summarizeStrong(runs: readonly StrongRun[], depth: number, lapse: number): StrongPart {
  const count = (outcome: StrongOutcome) => runs.filter((run) => run.outcome === outcome).length;
  const failed = count('terminal-jam') + count('silent-loss');
  const exhausted = count('exhausted');
  const mistakes = runs.flatMap((run) => run.firstIrreversible === null ? [] : [run.firstIrreversible]);
  const byAction: Record<string, number> = {};
  const reasons: Record<string, number> = {};
  for (const at of mistakes) byAction[at] = (byAction[at] ?? 0) + 1;
  for (const run of runs) if (run.reason) reasons[run.reason] = (reasons[run.reason] ?? 0) + 1;
  return {
    depth, lapse, n: runs.length, failure: exhausted || !runs.length ? null : 100 * failed / runs.length,
    failureBounds: runs.length ? [100 * failed / runs.length, 100 * (failed + exhausted) / runs.length] : [0, 100],
    won: count('won'), terminalJam: count('terminal-jam'), silentLoss: count('silent-loss'), exhausted, reasons,
    firstIrreversible: { mean: mistakes.length ? mistakes.reduce((a, b) => a + b, 0) / mistakes.length : null, byAction, unknown: runs.filter((run) => run.oracleExhausted).length },
    wonAfterProxyLoss: runs.filter((run) => run.outcome === 'won' && run.firstIrreversible !== null).length,
    nodes: runs.reduce((n, run) => n + run.nodes, 0), recoveries: runs.reduce((n, run) => n + run.recoveries, 0),
  };
}
function measurement(play: (depth: number, lapse: number, seed: number) => StrongRun, seeds: readonly number[]): StrongMeasurement {
  const parts = STRONG_POLICY.depths.flatMap((depth) => [STRONG_POLICY.lapse, 0].map((lapse) => summarizeStrong(seeds.map((seed) => play(depth, lapse, seed)), depth, lapse)));
  const mean = (lapse: number) => {
    const selected = parts.filter((part) => part.lapse === lapse);
    return selected.some((part) => part.failure === null) ? null : selected.reduce((n, part) => n + part.failure!, 0) / selected.length;
  };
  return { H: mean(STRONG_POLICY.lapse), zeroLapse: mean(0), parts };
}
function diagnosis<S, A>(graph: RulesGraph<S, A>) {
  let firstIrreversible: number | null = null;
  let oracleExhausted = false;
  let before = graph.solvable(graph.start);
  if (before === false) firstIrreversible = 0;
  if (before === null) oracleExhausted = true;
  return {
    observe(id: number, action: number) {
      const after = graph.solvable(id);
      if (after === null) oracleExhausted = true;
      if (before === true && after === false && firstIrreversible === null && !oracleExhausted) firstIrreversible = action;
      before = after;
    },
    result: () => ({ firstIrreversible, oracleExhausted }),
  };
}
function settledRun<S, A>(graph: RulesGraph<S, A>, planner: StrongPlanner, depth: number, lapse: number, seed: number): StrongRun {
  const next = seeded(seed);
  const diagnostic = diagnosis(graph);
  let id = graph.start;
  let previous: number | undefined;
  let nodes = 0;
  let actions = 0;
  const finish = (outcome: StrongOutcome, reason?: string): StrongRun => ({ outcome, reason, actions, nodes, recoveries: 0, ...diagnostic.result() });
  try {
    for (; actions < STRONG_POLICY.actions;) {
      const node = graph.node(id);
      if (node.status === 'won') return finish('won');
      if (node.status === 'jammed') return finish('terminal-jam');
      if (!node.edges.length) return finish('silent-loss');
      if (graph.solvable(id) === false) return finish('silent-loss');
      const choice = planner.choose(id, depth, lapse, next, previous);
      nodes += choice.nodes;
      if (choice.exhausted) return finish('exhausted', choice.reason);
      if (choice.index === null) return graph.solvable(id) === false ? finish('silent-loss') : finish('exhausted', 'cycle-pruning');
      previous = id;
      id = node.edges[choice.index]!;
      actions++;
      diagnostic.observe(id, actions);
    }
    // Even a proven lost state at an action cap remains censored, rather than inflating H.
    return finish('exhausted', 'action-limit');
  } catch (error) { if (error instanceof Exhausted) return finish('exhausted', error.message); throw error; }
}

interface MachineTrace {
  decision?: number;
  after?: number;
  children?: Map<number, MachineTrace>;
  result?: StrongRun;
}
/** Physics and timing are deterministic given the taps. Reuse an observed trace only after re-running every seeded decision. */
function cachedMachineMeasurement<S>(graph: RulesGraph<S, number>, planner: StrongPlanner, seeds: readonly number[], play: (depth: number, lapse: number, seed: number, trace: MachineTrace) => StrongRun): StrongMeasurement {
  const trace: MachineTrace = {};
  return measurement((depth, lapse, seed) => {
    const next = seeded(seed);
    const diagnostic = diagnosis(graph);
    let cursor: MachineTrace | undefined = trace;
    let nodes = 0;
    let actions = 0;
    while (cursor) {
      if (cursor.result) return { ...cursor.result, nodes, ...diagnostic.result() };
      if (cursor.decision === undefined) break;
      const choice = planner.choose(cursor.decision, depth, lapse, next);
      nodes += choice.nodes;
      if (choice.exhausted || choice.index === null) break;
      cursor = cursor.children?.get(choice.index);
      if (cursor?.after !== undefined) diagnostic.observe(cursor.after, ++actions);
    }
    return play(depth, lapse, seed, trace);
  }, seeds);
}

interface ConveyorMachine<S> {
  step(): void;
  tap(at: number): { readonly ok: boolean };
  readonly transferring: boolean;
  readonly rules: { readonly status: string; readonly free: number; canDrain(): boolean; snapshot(): S };
}
function machineRun<S>(machine: ConveyorMachine<S>, graph: RulesGraph<S, number>, planner: StrongPlanner, pending: () => number, openCount: (() => number) | null, project: (state: S) => S, timing: StrongTiming, depth: number, lapse: number, seed: number, trace: MachineTrace, recoveries: () => number = () => 0): StrongRun {
  const next = seeded(seed);
  const diagnostic = diagnosis(graph);
  let cursor = trace;
  let inBurst = 0;
  let cooldown = 0;
  let actions = 0;
  let nodes = 0;
  const finish = (outcome: StrongOutcome, reason?: string): StrongRun => {
    const result = { outcome, reason, actions, nodes, recoveries: recoveries(), ...diagnostic.result() };
    if (outcome !== 'exhausted' || reason === 'tick-limit') cursor.result = result;
    return result;
  };
  try {
    for (let tick = 0; tick < STRONG_POLICY.ticks; tick++) {
      machine.step();
      const rules = machine.rules;
      if (rules.status === 'won') return finish('won');
      if (rules.status === 'jammed') return finish('terminal-jam');
      let act = false;
      if (timing === 'patient') act = tick % 10 === 0 && !machine.transferring && !rules.canDrain() && pending() === 0;
      else if (openCount) {
        // Match loopGame's cooldown and interruption behavior, including a blocked mid-burst tap.
        const open = openCount();
        if (inBurst > 0 && tick % 12 === 0 && !open) { inBurst = 0; cooldown = 45; }
        if (cooldown > 0) cooldown--;
        if (!open) {
          if (!machine.transferring && !rules.canDrain() && pending() === 0) return finish('silent-loss');
          continue;
        }
        if (inBurst > 0) { if (tick % 12 === 0) { act = true; if (!--inBurst) cooldown = 45; } }
        else if (!cooldown && (pending() === 0 || (!rules.canDrain() && rules.free > 0))) { act = true; inBurst = timing === 'burst2' ? 1 : 2; }
      } else {
        if (inBurst > 0) { if (tick % 12 === 0) { act = true; if (!--inBurst) cooldown = 45; } }
        else if (cooldown > 0) cooldown--;
        else if (pending() === 0 || (!rules.canDrain() && rules.free > 0)) { act = true; inBurst = timing === 'burst2' ? 1 : 2; }
      }
      if (!act) continue;
      const id = graph.add(rules.snapshot());
      const choice = planner.choose(id, depth, lapse, next);
      nodes += choice.nodes;
      if (choice.exhausted) return finish('exhausted', choice.reason);
      if (choice.index === null) {
        if (!machine.transferring && !rules.canDrain() && pending() === 0 && !graph.node(id).edges.length) return finish('silent-loss');
        continue;
      }
      if (actions >= STRONG_POLICY.actions) return finish('exhausted', 'action-limit');
      cursor.decision = id;
      cursor.children ??= new Map();
      const child: MachineTrace = cursor.children.get(choice.index) ?? {};
      cursor.children.set(choice.index, child);
      cursor = child;
      if (!machine.tap(graph.action(id, choice.index)).ok) throw new Error('Planner chose an illegal tap');
      actions++;
      // Project the actual post-tap state, never the predicted successor, for the diagnostic.
      cursor.after = graph.add(project(rules.snapshot()));
      diagnostic.observe(cursor.after, actions);
    }
    return finish('exhausted', 'tick-limit');
  } catch (error) { if (error instanceof Exhausted) return finish('exhausted', error.message); throw error; }
}

export function strongTube(board: TubeDef, seeds: readonly number[] = STRONG_POLICY.tubeSeeds): StrongScore {
  const graph = strongTubeGraph(board);
  const planner = new StrongPlanner(graph);
  const settled = measurement((depth, lapse, seed) => settledRun(graph, planner, depth, lapse, seed), seeds);
  return { H: settled.H, settled, policy: { ...STRONG_POLICY, tubeSeeds: [...seeds] }, diagnosis: 'exact' };
}
export function strongLoop(board: LoopBoardDef, seeds: readonly number[] = STRONG_POLICY.seeds): StrongScore {
  const graph = loopGraph(board);
  const planner = new StrongPlanner(graph);
  const settled = measurement((depth, lapse, seed) => settledRun(graph, planner, depth, lapse, seed), seeds);
  const run = (timing: StrongTiming) => cachedMachineMeasurement(graph, planner, seeds, (depth, lapse, seed, trace) => {
    const machine = new LoopMachine(board);
    return machineRun(machine, graph, planner, () => machine.rules.pending, () => machine.rules.actions().length, (state) => { const copy = new LoopRules(board); copy.restore(state); if (!settleLoop(copy)) throw new Exhausted('settle'); return copy.snapshot(); }, timing, depth, lapse, seed, trace);
  });
  const machine = { patient: run('patient'), burst2: run('burst2'), burst3: run('burst3') };
  return { H: machine.patient.H, settled, machine, policy: { ...STRONG_POLICY, seeds: [...seeds] }, diagnosis: 'settled-proxy' };
}
export async function strongFunnel(board: BoardDef, seeds: readonly number[] = STRONG_POLICY.seeds): Promise<StrongScore> {
  await initPhysics();
  const graph = funnelGraph(board);
  const planner = new StrongPlanner(graph);
  const settled = measurement((depth, lapse, seed) => settledRun(graph, planner, depth, lapse, seed), seeds);
  const run = (timing: StrongTiming) => cachedMachineMeasurement(graph, planner, seeds, (depth, lapse, seed, trace) => {
    const machine = new Machine(board);
    try {
      return machineRun(machine, graph, planner, () => machine.rules.funnelCount, null, (state) => { const copy = new MachineRules(board); copy.restore(state); if (!settle(copy)) throw new Exhausted('settle'); return copy.snapshot(); }, timing, depth, lapse, seed, trace, () => { const { nudges, teleports, bounces } = machine.recoveries; return nudges + teleports + bounces; });
    } finally { machine.world.free(); }
  });
  const machine = { patient: run('patient'), burst2: run('burst2'), burst3: run('burst3') };
  return { H: machine.patient.H, settled, machine, policy: { ...STRONG_POLICY, seeds: [...seeds] }, diagnosis: 'settled-proxy' };
}
