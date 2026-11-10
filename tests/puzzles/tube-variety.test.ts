import { describe, expect, it } from 'vitest';
import { checkTubeVariety } from '../../docs/models/tube-variety/check';
import { replayLog, replayOnto } from '../../src/engine/replay';
import { cloneTubeState, completedTube, moveTubeState, solveTubeSearch, tubeKey, TubeRules, validateTubeDef } from '../../src/puzzles/rules';
import type { TubeDef } from '../../src/puzzles/types';
import { TUBE_210, TUBE_211, TUBE_VARIETY_BOARDS } from '../../src/puzzles/variety-boards';
import { TUBE_VARIETY_JAMS } from './tube-variety-fixtures';

describe('Tube Sort Workshop boards', () => {
  it.each(TUBE_VARIETY_BOARDS)('$id has a shortest authored win, live hints and exact undo/replay', (board) => {
    const rules = new TubeRules(board);
    const shortest = solveTubeSearch(board, rules.state);
    expect(shortest.exhaustive).toBe(true);
    expect(shortest.moves!.length).toBeGreaterThanOrEqual(8);
    expect(shortest.moves!.length).toBeLessThanOrEqual(14);
    expect(board.solution).toHaveLength(shortest.moves!.length);
    for (const move of board.solution) {
      const before = rules.snapshot();
      const hint = rules.hint();
      expect(hint).not.toBeNull();
      expect(rules.snapshot()).toEqual(before);
      const hinted = cloneTubeState(before);
      expect(moveTubeState(board, hinted, hint!.from, hint!.to).ok).toBe(true);
      expect(solveTubeSearch(board, hinted).moves).not.toBeNull();
      expect(rules.move(move.from, move.to).ok).toBe(true);
      const after = rules.snapshot();
      expect(rules.undo()).toBe(true);
      expect(rules.snapshot()).toEqual(before);
      expect(rules.move(move.from, move.to).ok).toBe(true);
      expect(rules.snapshot()).toEqual(after);
      const restored = new TubeRules(board);
      restored.restore(after);
      expect(restored.snapshot()).toEqual(after);
    }
    expect(rules.status).toBe('won');
    const replay = JSON.parse(JSON.stringify(replayLog(board.id, rules)));
    const replayed = new TubeRules(board);
    replayOnto(replayed, replay);
    expect(replayed.fingerprint()).toBe(replay.fingerprint);
  });

  it.each(TUBE_VARIETY_BOARDS)('$id has actual losing moves, with a winning choice immediately before the trap', (board) => {
    const rules = new TubeRules(board);
    const jam = TUBE_VARIETY_JAMS[board.id]!;
    for (const move of jam.slice(0, -1)) expect(rules.move(move.from, move.to).ok).toBe(true);
    expect(solveTubeSearch(board, rules.state).moves).not.toBeNull();
    const last = jam.at(-1)!;
    expect(rules.move(last.from, last.to).ok).toBe(true);
    expect(rules.status).toBe('jammed');
    expect(rules.hint()).toBeNull();
    expect(solveTubeSearch(board, rules.state)).toMatchObject({ moves: null, exhaustive: true });
    expect(rules.undo()).toBe(true);
    expect(solveTubeSearch(board, rules.state).moves).not.toBeNull();
  });

  it('opens the spare when red finishes, and folds the cup on a later move, without the full cup unlocking anything', () => {
    const rules = new TubeRules(TUBE_210);
    for (const move of TUBE_210.solution.slice(0, 3)) rules.move(move.from, move.to);
    expect(rules.state.tubes[3]).toEqual(['blue', 'blue']);
    expect(completedTube(TUBE_210, rules.state, 3)).toBe(false);
    expect(rules.state.opened[4]).toBe(false);
    expect(rules.move(2, 0)).toMatchObject({ ok: true, completedTube: true });
    expect(rules.state).toMatchObject({ spent: [false, false, false, false, false], opened: [false, false, false, false, true] });
    for (const move of TUBE_210.solution.slice(4, -1)) expect(rules.move(move.from, move.to).ok).toBe(true);
    const before = rules.snapshot();
    expect(rules.move(3, 4)).toMatchObject({ ok: true, count: 2, completedTube: true });
    expect(rules.state).toMatchObject({ status: 'won', spent: [false, false, false, true, false] });
    expect(rules.undo()).toBe(true);
    expect(rules.snapshot()).toEqual(before);
  });

  it('never closes the cup on the move that opens the spare, anywhere in the reachable game', () => {
    // The previous board's exchange: the red pair left the cup and finished the home in one move.
    const simultaneous: TubeDef = { ...TUBE_210, tubes: [['red', 'red', 'blue', 'green'], ['green', 'blue', 'green', 'red'], ['blue', 'green', 'blue', 'red'], [], []], solution: [] };
    const both = (board: TubeDef): number => {
      const start = new TubeRules(board).snapshot();
      const seen = new Set([tubeKey(board, start)]), queue = [start];
      let count = 0;
      for (const state of queue) for (const [from] of state.tubes.entries()) for (const [to] of state.tubes.entries()) {
        const next = cloneTubeState(state);
        if (from === to || !moveTubeState(board, next, from, to).ok) continue;
        if (!state.spent[3] && next.spent[3] && !state.opened[4] && next.opened[4]) count++;
        const key = tubeKey(board, next);
        if (!seen.has(key)) { seen.add(key); queue.push(next); }
      }
      return count;
    };
    expect(both(simultaneous)).toBeGreaterThan(0);
    expect(both(TUBE_210)).toBe(0);
  });
});

describe('mixed-height final homes', () => {
  it('does not complete four of six reds in a short home, and then moves all four together to win', () => {
    const rules = new TubeRules(TUBE_211);
    for (const move of TUBE_211.solution.slice(0, 7)) rules.move(move.from, move.to);
    expect(rules.state.tubes[3]).toEqual(['red', 'red', 'red', 'red']);
    expect(completedTube(TUBE_211, rules.state, 3)).toBe(false);
    expect(rules.status).toBe('playing');
    for (const move of TUBE_211.solution.slice(7, 9)) rules.move(move.from, move.to);
    expect(rules.move(3, 0)).toMatchObject({ ok: true, count: 4, completedTube: true });
    expect(rules.status).toBe('won');
    expect(rules.state.tubes[0]).toEqual(Array(6).fill('red'));
  });

  it('never opens a red cap from four reds in a short home, including after restore', () => {
    const board: TubeDef = {
      ...TUBE_211, tubes: [...TUBE_211.tubes, []],
      containers: [...TUBE_211.containers!, { role: 'capped', capacity: 4, opensOn: 'red' }],
    };
    const rules = new TubeRules(board);
    for (const move of board.solution.slice(0, 7)) rules.move(move.from, move.to);
    expect(rules.state.opened[4]).toBe(false);
    const restored = new TubeRules(board);
    restored.restore(rules.snapshot());
    expect(restored.state.opened[4]).toBe(false);
    for (const move of board.solution.slice(7)) restored.move(move.from, move.to);
    expect(restored.state.opened[4]).toBe(true);
    expect(restored.status).toBe('won');
    const initialPartial: TubeDef = { ...board, tubes: [['red', 'red'], ['blue', 'blue', 'blue', 'blue'], ['green', 'green', 'green', 'green'], ['red', 'red', 'red', 'red'], []] };
    expect(new TubeRules(initialPartial).state.opened[4]).toBe(false);
  });

  it('requires distinct final homes matching the whole count of each colour', () => {
    expect(() => validateTubeDef(TUBE_211)).not.toThrow();
    expect(() => validateTubeDef({ ...TUBE_211, colorCapacities: undefined })).toThrow('Ordinary homes');
    expect(() => validateTubeDef({ ...TUBE_211, colorCapacities: { red: 4 } })).toThrow('exactly one full home');
    expect(() => validateTubeDef({ ...TUBE_211, colorCapacities: { red: 6, yellow: 4 } })).toThrow('per-colour');
    const missingTall: TubeDef = {
      ...TUBE_211, tubes: [['red', 'red', 'blue', 'green'], ['green', 'red', 'blue', 'red'], ['blue', 'green', 'green', 'red'], ['red', 'blue']],
      containers: Array.from({ length: 4 }, () => ({ role: 'ordinary', capacity: 4 })),
    };
    expect(() => validateTubeDef(missingTall)).toThrow('distinct home');
    const tooFewShort: TubeDef = { ...TUBE_211, containers: [6, 6, 6, 4].map(capacity => ({ role: 'ordinary', capacity })) };
    expect(() => validateTubeDef(tooFewShort)).toThrow('distinct home');
  });

  it('keeps capacities in symmetry keys while merging only equal-size ordinary homes', () => {
    const rules = new TubeRules(TUBE_211);
    for (const move of TUBE_211.solution.slice(0, 4)) rules.move(move.from, move.to);
    const differentSize = rules.snapshot();
    [differentSize.tubes[0], differentSize.tubes[3]] = [differentSize.tubes[3]!, differentSize.tubes[0]!];
    const oldKey = (state: typeof differentSize) => state.tubes.map(t => t.join(',')).sort().join('|');
    expect(oldKey(differentSize)).toBe(oldKey(rules.state));
    expect(tubeKey(TUBE_211, differentSize)).not.toBe(tubeKey(TUBE_211, rules.state));
    const sameSize = rules.snapshot();
    [sameSize.tubes[1], sameSize.tubes[2]] = [sameSize.tubes[2]!, sameSize.tubes[1]!];
    expect(tubeKey(TUBE_211, sameSize)).toBe(tubeKey(TUBE_211, rules.state));
  });

  it('tries empty homes of different capacities independently in search', () => {
    const board: TubeDef = {
      kind: 'tube', id: 'empty-home-capacity', title: 'Empty homes', capacity: 4, colorCapacities: { red: 6 },
      tubes: [['red', 'red'], ['red', 'red', 'red', 'red'], [], [], ['blue', 'blue', 'blue', 'blue']],
      containers: [4, 4, 4, 6, 4].map(capacity => ({ role: 'ordinary', capacity })), solution: [],
    };
    const rules = new TubeRules(board);
    const solution = solveTubeSearch(board, rules.state);
    expect(solution.moves).toHaveLength(2);
    for (const move of solution.moves!) expect(rules.move(move.from, move.to).ok).toBe(true);
    expect(rules.status).toBe('won');
  });
});

describe('bounded Tube Sort commitment model', () => {
  it.each(TUBE_VARIETY_BOARDS)('$id preserves invariants throughout its ordered reachable graph', (board) => {
    const checked = checkTubeVariety(board);
    expect(checked.states).toBeGreaterThan(checked.canonical);
    expect(checked.edges).toBeGreaterThan(0);
    if (board.id === 'tube-210') { expect(checked.openings).toBeGreaterThan(0); expect(checked.closings).toBeGreaterThan(0); }
    else expect(checked.partialHomes).toBeGreaterThan(0);
  });

  it('catches local-only completion, reusable-cup and cup-unlocks-cap mutations', () => {
    expect(() => checkTubeVariety(TUBE_211, 'local-completion')).toThrow('Only a complete colour');
    expect(() => checkTubeVariety(TUBE_210, 'reusable-cup')).toThrow('Emptying the cup must spend it');
    expect(() => checkTubeVariety(TUBE_210, 'cup-unlocks-cap')).toThrow('Only a full colour home');
  });
});
