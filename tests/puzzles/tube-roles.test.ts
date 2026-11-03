import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { TubeRules, tubeKey, solveTubeSearch, validateTubeDef } from '../../src/puzzles/rules';
import type { TubeDef } from '../../src/puzzles/types';

const capped: TubeDef = {
  kind: 'tube', id: 'cap-test', title: 'Cap', capacity: 2,
  tubes: [['red', 'blue'], ['blue', 'red'], [], []], solution: [],
  containers: [{ role: 'ordinary', capacity: 2 }, { role: 'ordinary', capacity: 2 },
    { role: 'ordinary', capacity: 2 }, { role: 'capped', capacity: 2, opensOn: 'red' }],
};

describe('Tube Sort container commitments', () => {
  it('opens a cap in the completing transition, retains the latch and undoes it', () => {
    const rules = new TubeRules(capped);
    expect(rules.move(0, 3)).toEqual({ ok: false, reason: 'capped' });
    rules.move(0, 2);
    const before = rules.snapshot();
    expect(rules.move(1, 0).ok).toBe(true);
    expect(rules.state.opened[3]).toBe(true);
    expect(rules.undo()).toBe(true);
    expect(rules.state).toEqual(before);
    rules.move(1, 0);
    expect(rules.move(0, 3).ok).toBe(true);
    expect(rules.state.opened[3]).toBe(true);
  });

  it('keeps equal contents with different latches distinct, unlike the old key', () => {
    const rules = new TubeRules(capped);
    const open = rules.snapshot(); open.opened[3] = true;
    const old = (state: typeof open) => state.tubes.map((tube) => tube.join(',')).sort().join('|');
    expect(old(open)).toBe(old(rules.state));
    expect(tubeKey(capped, open)).not.toBe(tubeKey(capped, rules.state));
    expect(solveTubeSearch(capped, rules.state, 1).exhaustive).toBe(false);
  });

  it('checks container references and conservation', () => {
    expect(() => validateTubeDef({ ...capped, containers: [] })).toThrow();
    expect(() => validateTubeDef({ ...capped, containers: capped.containers!.map((c) => c.role === 'capped' ? { ...c, opensOn: 'green' } : c) })).toThrow();
  });
});

import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { availableTubeMoves, cloneTubeState, moveTubeState, tubeContainer, completedTube } from '../../src/puzzles/rules';
import { replayLog } from '../../src/engine/replay';
import { replayed } from '../replay-target';
import { findRuleTrap, reachableTubeStates, withTubeRule, author } from '../../scripts/tube-author';
import { scoreTube } from '../../scripts/level-score';
import { hashBoard } from '../../scripts/level-curve';

const lessons = TUBE_BOARDS.filter((b) => ['tube-200', 'tube-201'].includes(b.id));
const cup = lessons.find((b) => b.id === 'tube-201')!;

it('closes a cup only on nonempty to empty, includes it in fingerprint, and undo reopens it', () => {
  const rules = new TubeRules(cup);
  const fresh = rules.snapshot();
  const spent = rules.snapshot(); spent.spent[4] = true;
  expect(spent.tubes).toEqual(fresh.tubes);
  expect(tubeKey(cup, spent)).not.toBe(tubeKey(cup, fresh));
  const initialPrint = rules.fingerprint();
  rules.restore(spent);
  expect(rules.fingerprint()).not.toBe(initialPrint);
  expect(rules.move(0, 4)).toEqual({ ok: false, reason: 'spent' });
  rules.restore(fresh);
  rules.move(0, 4);
  const filled = rules.snapshot();
  rules.move(4, 3);
  expect(rules.state.spent[4]).toBe(true);
  expect(rules.undo()).toBe(true);
  expect(rules.state).toEqual(filled);
  expect(rules.state.spent[4]).toBe(false);
});

it('never counts a full cup as a completed colour or a victory home', () => {
  const rules = new TubeRules(cup);
  rules.move(2, 4); // two red marbles fill the two-place cup
  expect(rules.state.tubes[4]).toHaveLength(2);
  expect(completedTube(cup, rules.state, 4)).toBe(false);
  expect(rules.status).toBe('playing');
});

it.each(lessons)('$id has a proven rule-specific trap and a winning continuation', (board) => {
  const trap = findRuleTrap(board);
  expect(trap).not.toBeNull();
  const rules = new TubeRules(board);
  for (const m of trap!.prefix) expect(rules.move(m.from, m.to).ok).toBe(true);
  expect(solveTubeSearch(board, rules.state).moves).not.toBeNull();
  rules.move(trap!.move.from, trap!.move.to);
  expect(solveTubeSearch(board, rules.state)).toMatchObject({ moves: null, exhaustive: true });
  const relaxed = cloneTubeState(rules.state); relaxed.status = 'playing';
  relaxed.opened = relaxed.opened.map((v, i) => tubeContainer(board, i).role === 'capped' || v);
  relaxed.spent.fill(false);
  for (const m of trap!.rescue) expect(moveTubeState(board, relaxed, m.from, m.to).ok).toBe(true);
  expect(relaxed.status).toBe('won');
  expect(scoreTube(board)?.graphStates).toBe(reachableTubeStates(board));
});

it.each(lessons)('$id replays the actual commitment, including undo', (board) => {
  const rules = new TubeRules(board);
  const moves = board.id === 'tube-200'
    ? [...board.solution.slice(0, 4), { from: 1, to: 4 }, board.solution[4]!]
    : [{ from: 0, to: 4 }, { from: 0, to: 3 }, { from: 1, to: 3 }, { from: 2, to: 1 }, { from: 4, to: 1 }, { from: 0, to: 2 }];
  for (const m of moves) {
    expect(rules.move(m.from, m.to).ok).toBe(true);
    const after = rules.snapshot();
    expect(rules.undo()).toBe(true);
    expect(rules.move(m.from, m.to).ok).toBe(true);
    expect(rules.state).toEqual(after);
  }
  expect(rules.status).toBe('won');
  expect(board.id === 'tube-200' ? rules.state.opened[4] : rules.state.spent[4]).toBe(true);
  expect(replayed(JSON.parse(JSON.stringify(replayLog(board.id, rules)))).fingerprint()).toBe(rules.fingerprint());
});

it.each(lessons)('$id agrees with a graph that never merges tube identities', (board) => {
  const rawKey = (state: ReturnType<TubeRules['snapshot']>) => JSON.stringify([state.tubes, state.opened, state.spent]);
  const start = new TubeRules(board).state;
  const nodes = [{ state: start, parents: [] as number[] }];
  const seen = new Map([[rawKey(start), 0]]);
  const canonical = new Set<string>();
  for (let id = 0; id < nodes.length; id++) {
    const state = nodes[id]!.state;
    canonical.add(tubeKey(board, state));
    for (let from = 0; from < state.tubes.length; from++) for (let to = 0; to < state.tubes.length; to++) {
      const after = cloneTubeState(state);
      const beforePrint = JSON.stringify(after);
      const result = moveTubeState(board, after, from, to);
      if (!result.ok) { expect(JSON.stringify(after)).toBe(beforePrint); continue; }
      expect(after.tubes.flat().sort()).toEqual(board.tubes.flat().sort());
      after.tubes.forEach((tube, i) => {
        expect(tube.length).toBeLessThanOrEqual(tubeContainer(board, i).capacity);
        if (state.opened[i]) expect(after.opened[i]).toBe(true);
        if (state.spent[i]) expect(after.spent[i]).toBe(true);
        if (after.spent[i]) expect(tube.length).toBe(0);
      });
      let index = seen.get(rawKey(after));
      if (index === undefined) { index = nodes.length; seen.set(rawKey(after), index); nodes.push({ state: after, parents: [] }); }
      nodes[index]!.parents.push(id);
    }
  }
  const wins = new Set(nodes.flatMap((n, i) => n.state.status === 'won' ? [i] : []));
  const work = [...wins];
  for (const i of work) for (const p of nodes[i]!.parents) if (!wins.has(p)) { wins.add(p); work.push(p); }
  const checked = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const state = nodes[i]!.state;
    const key = tubeKey(board, state);
    if (checked.has(key)) continue;
    checked.add(key);
    const solved = solveTubeSearch(board, state);
    expect(solved.exhaustive).toBe(true);
    expect(solved.moves !== null).toBe(wins.has(i));
    for (const m of solved.moves ?? []) expect(moveTubeState(board, state, m.from, m.to).ok).toBe(true);
  }
  expect(canonical.size).toBe(reachableTubeStates(board));
}, 30_000);

it('preserves all classic definitions and hashes and keys only interchangeable ordinary homes together', () => {
  const classic = TUBE_BOARDS.find((b) => b.id === 'tube-1')!;
  expect(classic.containers).toBeUndefined();
  // Adding roles must not move a classic board's hash: it still matches the row stored before the rules existed.
  const stored = (JSON.parse(readFileSync('tests/levelling/scores.json', 'utf8')) as { id: string; hash: string }[]).find((row) => row.id === 'tube-1');
  expect(hashBoard(classic)).toBe(stored?.hash);
  const rules = new TubeRules(cup);
  const swapped = rules.snapshot();
  [swapped.tubes[0], swapped.tubes[4]] = [swapped.tubes[4]!, swapped.tubes[0]!];
  expect(tubeKey(cup, swapped)).not.toBe(tubeKey(cup, rules.state));
  [swapped.tubes[0], swapped.tubes[4]] = [swapped.tubes[4]!, swapped.tubes[0]!];
  [swapped.tubes[0], swapped.tubes[1]] = [swapped.tubes[1]!, swapped.tubes[0]!];
  expect(tubeKey(cup, swapped)).toBe(tubeKey(cup, rules.state));
});

it('authors the two rules with their trap proofs', () => {
  for (const role of ['capped', 'cup'] as const) {
    const rule = role === 'cup' ? { role } : { role, color: 'red' as const };
    const report = author(3, 4, 2, 3, 1, [3, 12], 1, rule);
    expect(report.trap).toBeDefined();
    expect(report.containers).toEqual(withTubeRule({ ...cup, containers: undefined }, rule).containers);
  }
});

it('keeps rejected actions, history and replay unchanged for capped and spent destinations', () => {
  for (const board of lessons) {
    const rules = new TubeRules(board);
    if (board.id === 'tube-201') { rules.move(0, 4); rules.move(4, 0); }
    const before = rules.snapshot(); const print = rules.fingerprint(); const actions = [...rules.actions]; const undo = rules.canUndo;
    expect(rules.move(0, 4).ok).toBe(false);
    expect(rules.snapshot()).toEqual(before); expect(rules.fingerprint()).toBe(print);
    expect(rules.actions).toEqual(actions); expect(rules.canUndo).toBe(undo);
    const hint = rules.hint();
    expect(hint?.to).not.toBe(4);
  }
});

it('does not unlock a cap from a full two-place cup', () => {
  const board: TubeDef = {
    ...capped, tubes: [...capped.tubes, []],
    containers: [...capped.containers!.map(c => c.role === 'capped' ? { ...c, opensOn: 'blue' as const } : c), { role: 'cup', capacity: 2 }],
  };
  const rules = new TubeRules(board);
  rules.move(0, 4); rules.move(1, 2); rules.move(1, 4);
  expect(rules.state.tubes[4]).toEqual(['blue', 'blue']);
  expect(rules.state.opened[3]).toBe(false);
  expect(rules.move(4, 1).ok).toBe(true);
  expect(rules.state.opened[3]).toBe(true);
  expect(rules.state.spent[4]).toBe(true);
  expect(rules.undo()).toBe(true);
  expect(rules.state.opened[3]).toBe(false);
  expect(rules.state.spent[4]).toBe(false);
});

it('rejects forged commitment snapshots without mutating the live game', () => {
  const rules = new TubeRules(cup);
  const fresh = rules.snapshot();
  for (const snapshot of [
    { ...fresh, spent: [] }, { ...fresh, opened: [1, false, false, false, false] },
    { ...fresh, spent: [true, false, false, false, false] },
  ]) { expect(() => rules.restore(snapshot)).toThrow(); expect(rules.snapshot()).toEqual(fresh); }
});
