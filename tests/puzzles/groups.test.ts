import { describe, expect, it } from 'vitest';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { solveTube, tubeContainer, TubeRules } from '../../src/puzzles/rules';
import type { TubeDef } from '../../src/puzzles/types';

const grouped: TubeDef = {
  kind: 'tube', id: 'group-fixture', title: 'Group fixture', capacity: 4,
  tubes: [['red', 'blue', 'blue', 'blue'], ['blue'], ['red', 'red', 'red'], []], solution: [],
};

describe('grouped tube transfers', () => {
  it('moves the complete contiguous top-color block in one action', () => {
    const rules = new TubeRules(grouped);
    expect(rules.move(0, 3)).toEqual({
      ok: true, color: 'blue', from: 0, to: 3, fromSlot: 1, toSlot: 0, count: 3, completedTube: false,
    });
    expect(rules.state.tubes).toEqual([['red'], ['blue'], ['red', 'red', 'red'], ['blue', 'blue', 'blue']]);
    expect(rules.state.moves).toBe(1);
  });

  it('transfers only the part that fits and reports the lowest slot actually moved', () => {
    const board: TubeDef = {
      kind: 'tube', id: 'partial-fit', title: 'Partial fit', capacity: 4,
      tubes: [['blue', 'red', 'red', 'red'], ['green', 'red'], ['blue', 'blue', 'blue'], ['green', 'green', 'green'], []],
      solution: [],
    };
    const rules = new TubeRules(board);
    const initial = rules.snapshot();
    expect(rules.move(0, 1)).toEqual({
      ok: true, color: 'red', from: 0, to: 1, fromSlot: 2, toSlot: 2, count: 2, completedTube: false,
    });
    expect(rules.state.tubes[0]).toEqual(['blue', 'red']);
    expect(rules.state.tubes[1]).toEqual(['green', 'red', 'red', 'red']);
    expect(rules.state.tubes.flat().sort()).toEqual(initial.tubes.flat().sort());
    expect(rules.state.moves).toBe(1);
    expect(rules.undo()).toBe(true);
    expect(rules.state).toEqual(initial);
  });

  it('does not pull a matching color through an intervening color', () => {
    const rules = new TubeRules({ ...grouped, tubes: [['blue', 'red', 'blue', 'blue'], ['blue'], ['red', 'red', 'red'], []] });
    expect(rules.move(0, 3)).toMatchObject({ ok: true, count: 2, fromSlot: 2 });
    expect(rules.state.tubes[0]).toEqual(['blue', 'red']);
    expect(rules.state.tubes[3]).toEqual(['blue', 'blue']);
  });

  it('undo reverses an entire group, and a rejected transfer does not add history', () => {
    const rules = new TubeRules(grouped);
    const initial = rules.snapshot();
    expect(rules.move(0, 3)).toMatchObject({ ok: true, count: 3 });
    const moved = rules.snapshot();
    expect(rules.move(0, 3)).toEqual({ ok: false, reason: 'different-color' });
    expect(rules.state).toEqual(moved);
    expect(rules.undo()).toBe(true);
    expect(rules.state).toEqual(initial);
    expect(rules.canUndo).toBe(false);
    expect(rules.undo()).toBe(false);
  });

  it('can complete a matching destination with the whole transferred group', () => {
    const rules = new TubeRules(grouped);
    expect(rules.move(0, 1)).toEqual({
      ok: true, color: 'blue', from: 0, to: 1, fromSlot: 1, toSlot: 1, count: 3, completedTube: true,
    });
    expect(rules.state.tubes[1]).toEqual(['blue', 'blue', 'blue', 'blue']);
    expect(rules.state.moves).toBe(1);
  });

  it.each(TUBE_BOARDS)('$id has a grouped solution and current-state hints preserve conservation', (board) => {
    const rules = new TubeRules(board);
    const colors = rules.state.tubes.flat().sort();
    expect(solveTube(board, rules.state)?.length).toBe(board.solution.length);
    const first = board.solution[0];
    if (!first) throw new Error('Missing opening');
    expect(rules.move(first.from, first.to).ok).toBe(true);
    for (let move = 1; rules.status === 'playing' && move < 40; move += 1) {
      const beforeHint = rules.snapshot();
      const hint = rules.hint();
      expect(rules.state).toEqual(beforeHint);
      if (!hint) throw new Error('Expected a verified grouped continuation');
      const result = rules.move(hint.from, hint.to);
      expect(result.ok).toBe(true);
      if (result.ok) expect(result.count).toBeGreaterThanOrEqual(1);
      expect(rules.state.tubes.flat().sort()).toEqual(colors);
      expect(rules.state.tubes.every((tube, index) => tube.length <= tubeContainer(board, index).capacity)).toBe(true);
    }
    expect(rules.status).toBe('won');
  });
});
