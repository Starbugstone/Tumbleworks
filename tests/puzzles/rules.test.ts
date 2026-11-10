import { describe, expect, it } from 'vitest';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { availableTubeMoves, solveTube, TubeRules, validateTubeDef, tubeContainer } from '../../src/puzzles/rules';
import type { TubeDef, TubeState } from '../../src/puzzles/types';

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
      expect(rules.state.tubes.every((tube, index) => tube.length <= tubeContainer(board, index).capacity)).toBe(true);
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

  it('a one-spare board can be jammed in one move, hints say so, and undo recovers the losing opening', () => {
    // Found from the rules rather than hard-coded, so re-rolled boards keep this check honest.
    const trap = TUBE_BOARDS.flatMap((board) => availableTubeMoves(board, new TubeRules(board).state)
      .filter((move) => { const probe = new TubeRules(board); return probe.move(move.from, move.to).ok && probe.status === 'jammed'; })
      .map((move) => ({ board, move })))[0];
    if (!trap) throw new Error('No Tube Sort board jams in one move');
    const rules = new TubeRules(trap.board);
    const initial = rules.snapshot();
    expect(rules.move(trap.move.from, trap.move.to).ok).toBe(true);
    expect(rules.status).toBe('jammed');
    expect(rules.hint()).toBeNull();
    expect(rules.undo()).toBe(true);
    expect(rules.state).toEqual(initial);
    const opening = trap.board.solution[0];
    if (!opening) throw new Error('Trap board has no solution');
    expect(rules.move(opening.from, opening.to).ok).toBe(true);
    expect(rules.status).toBe('playing');
    expect(rules.hint()).not.toBeNull();
  });

  it.each(TUBE_BOARDS)('$id can be solved by hints from its current state', (board) => {
    const rules = new TubeRules(board);
    // Open with a legal move that is not the authored one when one still leads to a win, so the hint has to think.
    const fresh = (): TubeState => new TubeRules(board).snapshot();
    const differentOpening = availableTubeMoves(board, fresh()).find((move) => {
      if (move.from === board.solution[0]?.from && move.to === board.solution[0]?.to) return false;
      const trial = new TubeRules(board);
      return trial.move(move.from, move.to).ok && solveTube(board, trial.state) !== null;
    }) ?? board.solution[0];
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
