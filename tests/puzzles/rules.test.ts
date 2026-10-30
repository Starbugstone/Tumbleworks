import { describe, expect, it } from 'vitest';
import { TRAY_BOARDS, TUBE_BOARDS } from '../../src/puzzles/levels';
import { availableTrayPieces, solveTray, solveTube, TrayRules, TubeRules, validateTrayDef, validateTubeDef } from '../../src/puzzles/rules';
import type { TrayDef, TubeDef } from '../../src/puzzles/types';

function tubeLevel(index = 0): TubeDef {
  const board = TUBE_BOARDS[index];
  if (!board) throw new Error('Missing tube fixture');
  return board;
}

function trayLevel(index = 0): TrayDef {
  const board = TRAY_BOARDS[index];
  if (!board) throw new Error('Missing tray fixture');
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

  it('moves only the top marble and reports its source and destination slots', () => {
    const rules = new TubeRules(tubeLevel());
    expect(rules.move(0, 3)).toEqual({ ok: true, color: 'blue', from: 0, to: 3, fromSlot: 3, toSlot: 0, completedTube: false });
    expect(rules.state.tubes[0]).toEqual(['red', 'red', 'blue']);
    expect(rules.state.tubes[3]).toEqual(['blue']);
    rules.move(0, 3);
    rules.move(2, 0);
    expect(rules.move(2, 0)).toMatchObject({ ok: true, completedTube: true });
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
    rules.move(0, 3);
    rules.restore(JSON.parse(JSON.stringify(checkpoint)));
    expect(rules.state).toEqual(checkpoint);
    expect(rules.canUndo).toBe(false);
    checkpoint.tubes[0]?.pop();
    expect(rules.state.tubes[0]).toHaveLength(3);
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

describe('tray matching', () => {
  it.each(TRAY_BOARDS)('$id replays its authored solution and conserves every piece', (board) => {
    const before = structuredClone(board);
    const rules = new TrayRules(board);
    const cleared = new Set<number>();
    for (const id of board.solution) {
      const result = rules.pick(id);
      expect(result.ok).toBe(true);
      if (result.ok) {
        for (const clearedId of result.clearedIds) {
          expect(cleared.has(clearedId)).toBe(false);
          cleared.add(clearedId);
        }
      }
      const occupied = [...rules.state.remaining, ...rules.state.rack, ...cleared];
      expect(new Set(occupied).size).toBe(board.pieces.length);
      expect(occupied).toHaveLength(board.pieces.length);
      expect(rules.state.rack.length).toBeLessThan(board.rackCapacity);
    }
    expect(rules.status).toBe('won');
    expect(rules.state.remaining).toEqual([]);
    expect(rules.state.rack).toEqual([]);
    expect(rules.state.moves).toBe(board.pieces.length);
    expect(board).toEqual(before);
  });

  it('only exposes a covered piece once every blocker is gone', () => {
    const rules = new TrayRules(trayLevel());
    expect(availableTrayPieces(rules.board, rules.state)).toEqual([8, 9, 10, 11]);
    const initial = rules.snapshot();
    expect(rules.pick(0)).toEqual({ ok: false, reason: 'covered' });
    expect(rules.state).toEqual(initial);
    expect(rules.canUndo).toBe(false);
    rules.pick(8);
    expect(rules.available).toContain(0);
    expect(rules.available).toContain(1);
    expect(rules.pick(8)).toEqual({ ok: false, reason: 'removed' });
    expect(rules.pick(NaN)).toEqual({ ok: false, reason: 'invalid-piece' });
    expect(rules.pick(999)).toEqual({ ok: false, reason: 'invalid-piece' });
    rules.undo();
    expect(rules.state).toEqual(initial);
  });

  it('clears a triple selected into the seventh slot before checking for a full rack', () => {
    const rules = new TrayRules(trayLevel());
    for (const id of [8, 0, 9, 2, 10, 4]) expect(rules.pick(id).ok).toBe(true);
    expect(rules.state.rack).toHaveLength(6);
    expect(rules.pick(1)).toEqual({ ok: true, color: 'red', clearedIds: [8, 0, 1] });
    expect(rules.state.rack).toEqual([9, 2, 10, 4]);
    expect(rules.status).toBe('playing');
    rules.undo();
    expect(rules.state.rack).toEqual([8, 0, 9, 2, 10, 4]);
    expect(rules.state.remaining).toContain(1);
  });

  it.each([
    { board: trayLevel(), trace: [8, 0, 9, 2, 10, 4, 11] },
    { board: trayLevel(1), trace: [12, 0, 1, 13, 2, 14, 4] },
    { board: trayLevel(2), trace: [16, 0, 1, 17, 2, 18, 4] },
  ])('$board.id has a genuine overflow choice that undo recovers', ({ board, trace }) => {
    const rules = new TrayRules(board);
    for (const id of trace) expect(rules.pick(id).ok).toBe(true);
    expect(rules.status).toBe('jammed');
    expect(rules.state.rack).toHaveLength(7);
    expect(rules.pick(board.solution[0] ?? -1)).toEqual({ ok: false, reason: 'finished' });
    expect(rules.hint()).toBeNull();
    expect(rules.undo()).toBe(true);
    expect(rules.status).toBe('playing');
    expect(rules.state.rack).toHaveLength(6);
  });

  it.each(TRAY_BOARDS)('$id provides winning hints after an alternate opening', (board) => {
    const rules = new TrayRules(board);
    const opening = [...board.pieces].reverse().find((piece) => piece.blockedBy.length === 0);
    if (!opening) throw new Error('Missing selectable piece');
    rules.pick(opening.id);
    for (let i = 0; rules.status === 'playing' && i < board.pieces.length; i += 1) {
      const hint = rules.hint();
      expect(hint).not.toBeNull();
      if (hint === null) throw new Error('No current-state solution');
      expect(rules.available).toContain(hint);
      expect(rules.pick(hint).ok).toBe(true);
    }
    expect(rules.status).toBe('won');
  });

  it('never changes gameplay state when a hint search reaches its budget', () => {
    const rules = new TrayRules(trayLevel(2));
    const before = rules.snapshot();
    expect(solveTray(rules.board, rules.state, 0)).toBeNull();
    expect(solveTray(rules.board, rules.state, 1)).toBeNull();
    expect(rules.state).toEqual(before);
  });

  it('validates saved identities, covered-piece removals, matches, and completion', () => {
    const rules = new TrayRules(trayLevel());
    rules.pick(8); rules.pick(0); rules.pick(1);
    const checkpoint = rules.snapshot();
    rules.pick(9);
    rules.restore(JSON.parse(JSON.stringify(checkpoint)));
    expect(rules.state).toEqual(checkpoint);
    expect(rules.canUndo).toBe(false);
    checkpoint.remaining.length = 0;
    expect(rules.state.remaining).toHaveLength(9);
    const invalid = [
      null, {}, { ...rules.snapshot(), rack: [999] }, { ...rules.snapshot(), rack: [9] },
      { remaining: trayLevel().pieces.map((piece) => piece.id).filter((id) => id !== 0), rack: [0], moves: 1, status: 'playing' },
      { ...rules.snapshot(), moves: 0 }, { ...rules.snapshot(), status: 'won' },
    ];
    for (const value of invalid) {
      const before = rules.snapshot();
      expect(() => rules.restore(value)).toThrow();
      expect(rules.state).toEqual(before);
    }
  });

  it('rejects bad IDs, missing blockers, cover cycles, and incomplete triples', () => {
    const source = trayLevel();
    const first = source.pieces[0];
    if (!first) throw new Error('Missing fixture piece');
    expect(() => validateTrayDef({ ...source, pieces: [...source.pieces, first] })).toThrow();
    expect(() => validateTrayDef({ ...source, pieces: source.pieces.map((piece) => piece.id === 0 ? { ...piece, blockedBy: [999] } : piece) })).toThrow();
    expect(() => validateTrayDef({ ...source, pieces: source.pieces.map((piece) => piece.id === 8 ? { ...piece, blockedBy: [0] } : piece) })).toThrow();
    expect(() => validateTrayDef({ ...source, pieces: source.pieces.slice(1) })).toThrow();
  });
});
