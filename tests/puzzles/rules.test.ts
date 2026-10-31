import { describe, expect, it } from 'vitest';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { solveTube, TubeRules, validateTubeDef } from '../../src/puzzles/rules';
import type { TubeDef } from '../../src/puzzles/types';

function tubeLevel(index = 0): TubeDef {
  const board = TUBE_BOARDS[index];
  if (!board) throw new Error('Missing tube fixture');
  return board;
}

describe('tube sorting', () => {
  it.each(TUBE_BOARDS)('$id replays its authored solution without losing or recoloring marbles', (board) => {
    const before = structuredClone(board);
    const rules = new TubeRules(board);
    const colors = rules.state.tubes.flat().sort();
    for (const { from, to } of board.solution) {
      expect(rules.move(from, to).ok).toBe(true);
      expect(rules.state.tubes.flat().sort()).toEqual(colors);
      expect(rules.state.tubes.every((tube) => tube.length <= board.capacity)).toBe(true);
    }
    expect(rules.status).toBe('won');
    expect(rules.state.moves).toBe(board.solution.length);
    expect(board).toEqual(before);
  });

  it('moves the top color group and reports its lowest source and first destination slots', () => {
    const rules = new TubeRules(tubeLevel());
    expect(rules.move(0, 3)).toEqual({ ok: true, color: 'blue', from: 0, to: 3, fromSlot: 2, toSlot: 0, count: 2, completedTube: false });
    expect(rules.state.tubes[0]).toEqual(['red', 'red']);
    expect(rules.state.tubes[3]).toEqual(['blue', 'blue']);
    expect(rules.move(2, 0)).toMatchObject({ ok: true, count: 2, completedTube: true });
  });

  it('refuses invalid, empty, full, same-tube, and wrong-color moves without adding undo', () => {
    const rules = new TubeRules(tubeLevel());
    const initial = rules.snapshot();
    expect(rules.move(-1, 0)).toMatchObject({ ok: false, reason: 'invalid-tube' });
    expect(rules.move(0.5, 4)).toMatchObject({ ok: false, reason: 'invalid-tube' });
    expect(rules.move(0, NaN)).toMatchObject({ ok: false, reason: 'invalid-tube' });
    expect(rules.move(0, 0)).toMatchObject({ ok: false, reason: 'same-tube' });
    expect(rules.move(4, 3)).toMatchObject({ ok: false, reason: 'empty' });
    expect(rules.move(0, 1)).toMatchObject({ ok: false, reason: 'full' });
    expect(rules.state).toEqual(initial);
    expect(rules.canUndo).toBe(false);
    rules.move(0, 3);
    rules.move(1, 4);
    const moved = rules.snapshot();
    expect(rules.move(0, 4)).toMatchObject({ ok: false, reason: 'different-color' });
    expect(rules.state).toEqual(moved);
    rules.undo();
    expect(rules.state.moves).toBe(1);
  });

  it('restores complete state when undoing a normal move or a win', () => {
    const board = tubeLevel();
    const rules = new TubeRules(board);
    const initial = rules.snapshot();
    rules.move(0, 3);
    expect(rules.undo()).toBe(true);
    expect(rules.state).toEqual(initial);
    expect(rules.undo()).toBe(false);
    for (const move of board.solution) rules.move(move.from, move.to);
    expect(rules.status).toBe('won');
    expect(rules.move(0, 3)).toMatchObject({ ok: false, reason: 'finished' });
    expect(rules.undo()).toBe(true);
    expect(rules.status).toBe('playing');
  });

  it('recognizes a full, mixed board with no legal transfer as jammed', () => {
    const board: TubeDef = { kind: 'tube', id: 'blocked', title: 'Blocked', capacity: 2, tubes: [['red', 'blue'], ['blue', 'red']], solution: [] };
    const rules = new TubeRules(board);
    expect(rules.status).toBe('jammed');
    expect(rules.hint()).toBeNull();
  });

  it('makes the hard board’s sole spare a real decision and lets undo recover its losing opening', () => {
    const rules = new TubeRules(tubeLevel(2));
    const initial = rules.snapshot();
    expect(rules.move(1, 4).ok).toBe(true);
    expect(rules.status).toBe('jammed');
    expect(rules.hint()).toBeNull();
    expect(rules.undo()).toBe(true);
    expect(rules.state).toEqual(initial);
    expect(rules.move(0, 4).ok).toBe(true);
    expect(rules.status).toBe('playing');
    expect(rules.hint()).not.toBeNull();
  });

  it.each(TUBE_BOARDS)('$id can be solved by hints from its current state', (board) => {
    const rules = new TubeRules(board);
    const differentOpening = board.id === 'tube-2' ? { from: 3, to: 4 } : board.solution[0];
    if (differentOpening) expect(rules.move(differentOpening.from, differentOpening.to).ok).toBe(true);
    for (let i = 0; rules.status === 'playing' && i < 60; i += 1) {
      const hint = rules.hint();
      expect(hint).not.toBeNull();
      if (!hint) throw new Error('No current-state solution');
      expect(rules.move(hint.from, hint.to).ok).toBe(true);
    }
    expect(rules.status).toBe('won');
  });

  it('does not invent a hint when its bounded search runs out of work', () => {
    const rules = new TubeRules(tubeLevel(2));
    expect(solveTube(rules.board, rules.state, 0)).toBeNull();
    expect(solveTube(rules.board, rules.state, 1)).toBeNull();
    expect(rules.status).toBe('playing');
    expect(rules.state.moves).toBe(0);
  });

  it('validates external snapshots and restores them without aliasing or retained undo', () => {
    const rules = new TubeRules(tubeLevel());
    rules.move(0, 3);
    const checkpoint = rules.snapshot();
    rules.move(2, 0);
    rules.restore(JSON.parse(JSON.stringify(checkpoint)));
    expect(rules.state).toEqual(checkpoint);
    expect(rules.canUndo).toBe(false);
    checkpoint.tubes[0]?.pop();
    expect(rules.state.tubes[0]).toHaveLength(2);
    for (const invalid of [null, {}, { tubes: [['purple']], moves: 0, status: 'playing' },
      { ...rules.snapshot(), tubes: [] }, { ...rules.snapshot(), moves: -1 }, { ...rules.snapshot(), status: 'won' }]) {
      const before = rules.snapshot();
      expect(() => rules.restore(invalid)).toThrow();
      expect(rules.state).toEqual(before);
    }
  });

  it('rejects authored color totals that cannot end in one full tube per color', () => {
    expect(() => validateTubeDef({ ...tubeLevel(), capacity: 0 })).toThrow();
    expect(() => validateTubeDef({ ...tubeLevel(), tubes: [['red'], []] })).toThrow();
    expect(() => validateTubeDef({ ...tubeLevel(), tubes: [['red', 'red', 'red', 'red', 'red'], []] })).toThrow();
  });
});
