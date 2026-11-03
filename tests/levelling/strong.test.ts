import { describe, expect, it, vi } from 'vitest';
import { hashBoard } from '../../scripts/level-curve';
import { SCORE_POLICY, scorePolicy, seeded } from '../../scripts/level-policy';
import { StrongPlanner, strongTube, strongTubeGraph, summarizeStrong, type StrongNode, type StrongRun } from '../../scripts/level-strong';
import { scoreTube } from '../../scripts/level-score';
import * as tubeAuthor from '../../scripts/tube-author';
import * as tubeRules from '../../src/puzzles/rules';
import { LOOP_BOARDS } from '../../src/loop/boards';
import { LoopMachine } from '../../src/loop/machine';
import { strongLoop } from '../../scripts/level-strong';
import { TUBE_BOARDS } from '../../src/puzzles/levels';

const graphOf = (nodes: readonly StrongNode[]) => ({ node: (id: number) => nodes[id]! });
const node = (edges: number[], value = 0, status = 'playing'): StrongNode => ({ edges, value, status });
// The tempting corridor is irreversible at move one, but the jam is five moves away.
const trap = graphOf([
  node([1, 6]), node([2], 10), node([3], 10), node([4], 10), node([5], 10), node([], 0, 'jammed'),
  node([7]), node([8]), node([9]), node([10]), node([11]), node([], 0, 'won'),
]);
const playTrap = (depth: number) => {
  const planner = new StrongPlanner(trap);
  const next = seeded(1);
  let at = 0;
  for (let step = 0; step < 10 && trap.node(at).status === 'playing'; step++) {
    const choice = planner.choose(at, depth, 0, next);
    expect(choice.exhausted).toBe(false);
    at = trap.node(at).edges[choice.index!]!;
  }
  return trap.node(at).status;
};

describe('strong planner', () => {
  it('depth 6 wins the small trap that depth 4 enters', () => {
    expect(playTrap(4)).toBe('jammed');
    expect(playTrap(6)).toBe('won');
  });
  it('censors node-budget exits, even with a warm cache', () => {
    const planner = new StrongPlanner(trap, 1);
    expect(planner.choose(0, 6, 0, seeded(1))).toMatchObject({ exhausted: true, index: null });
    expect(planner.choose(0, 6, 0, seeded(1))).toMatchObject({ exhausted: true, index: null });
    const run: StrongRun = { outcome: 'exhausted', reason: 'planner-nodes', actions: 0, firstIrreversible: null, oracleExhausted: false, nodes: 1, recoveries: 0 };
    expect(summarizeStrong([run], 6, 0.03)).toMatchObject({ failure: null, exhausted: 1, silentLoss: 0, terminalJam: 0, failureBounds: [0, 100] });
  });
  it('is deterministic for a fixed seed, independent of cache warmth', () => {
    const graph = graphOf([node([1, 2, 3]), node([], 0, 'won'), node([], 0, 'won'), node([], 0, 'won')]);
    const choices = (planner: StrongPlanner) => {
      const next = seeded(42);
      return Array.from({ length: 100 }, () => planner.choose(0, 6, 0.03, next));
    };
    const warm = new StrongPlanner(graph);
    const first = choices(warm);
    expect(choices(warm)).toEqual(first);
    expect(choices(new StrongPlanner(graph))).toEqual(first);
  });
  it('prunes reversals and current-path cycles without poisoning another context', () => {
    const graph = graphOf([node([1, 2]), node([0, 3]), node([1]), node([], 0, 'won')]);
    const planner = new StrongPlanner(graph);
    expect(planner.choose(1, 6, 0, seeded(1), 3).index).toBe(0);
    expect(planner.choose(1, 6, 0, seeded(1), 0).index).toBe(1);
    expect(planner.choose(0, 6, 0, seeded(1))).toEqual(new StrongPlanner(graph).choose(0, 6, 0, seeded(1)));
  });
  it('lapses uniformly over legal actions including a pruned reversal', () => {
    const graph = graphOf([node([0, 1, 2]), node([], 0, 'won'), node([], 0, 'jammed')]);
    const planner = new StrongPlanner(graph);
    for (let index = 0; index < 3; index++) {
      const draws = [0, (index + 0.5) / 3];
      expect(planner.choose(0, 6, 0.03, () => draws.shift()!).index).toBe(index);
    }
  });
  it('uses Tube Sort rules with an exact, separate solvability diagnostic', () => {
    const board = { kind: 'tube' as const, id: 'fixture', title: 'Fixture', capacity: 2, tubes: [['red', 'blue'], ['blue', 'red'], []] as const, solution: [] };
    const graph = strongTubeGraph(board);
    expect(graph.solvable(0)).toBe(true);
    expect(graph.node(0).edges).toHaveLength(2);
    const result = strongTube(board, [1, 2, 3]);
    expect(result.H).toBe(0);
    expect(result.settled.parts.every((part) => part.exhausted === 0)).toBe(true);
  });
  it('reuses deterministic machine traces while preserving every seeded trial', () => {
    const step = vi.spyOn(LoopMachine.prototype, 'step');
    try {
      const one = strongLoop(LOOP_BOARDS[0]!, [1]);
      const calls = step.mock.calls.length;
      step.mockClear();
      const twice = strongLoop(LOOP_BOARDS[0]!, [1, 1]);
      expect(step.mock.calls.length).toBe(calls);
      for (const timing of ['patient', 'burst2', 'burst3'] as const) {
        expect(twice.machine![timing].H).toBe(one.machine![timing].H);
        expect(twice.machine![timing].parts.map((p) => p.won)).toEqual(one.machine![timing].parts.map((p) => 2 * p.won));
      }
    } finally { step.mockRestore(); }
  });
  it('stops scoreTube immediately when the reachable graph is capped', () => {
    const count = vi.spyOn(tubeAuthor, 'reachableTubeStates').mockReturnValue(40_001);
    const solve = vi.spyOn(tubeRules, 'solveTubeSearch');
    try {
      expect(scoreTube(TUBE_BOARDS[0]!)).toBeNull();
      expect(solve).not.toHaveBeenCalled();
    } finally { count.mockRestore(); solve.mockRestore(); }
  });
});

describe('scorer identity', () => {
  const board = TUBE_BOARDS[0]!;
  it('ignores ID, title, solution and property insertion order', () => {
    expect(hashBoard({ ...board, id: 'another-id', title: 'Renamed', solution: [] })).toBe(hashBoard(board));
    expect(hashBoard(Object.fromEntries(Object.entries(board).reverse()))).toBe(hashBoard(board));
  });
  it('invalidates changed rules, scorer version, policy and seeds', () => {
    const hash = hashBoard(board);
    expect(hashBoard(board, scorePolicy())).toBe(hash);
    expect(hashBoard(board, scorePolicy({ funnelGames: 200 }))).not.toBe(hash);
    expect(hashBoard({ ...board, capacity: board.capacity + 1 })).not.toBe(hash);
    expect(hashBoard(board, { ...SCORE_POLICY, version: 'next' })).not.toBe(hash);
    expect(hashBoard(board, { ...SCORE_POLICY, strong: { ...SCORE_POLICY.strong, lapse: 0.04 } })).not.toBe(hash);
    expect(hashBoard(board, { ...SCORE_POLICY, strong: { ...SCORE_POLICY.strong, seeds: [999] } })).not.toBe(hash);
  });
});
