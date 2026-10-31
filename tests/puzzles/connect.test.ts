import { describe, expect, it } from 'vitest';
import { ConnectRules, type ConnectDef } from '../../src/puzzles/connect';
import { CONNECT_BOARDS } from '../../src/puzzles/connect-levels';

describe('Connected Match (separate from the original Tray Match)', () => {
  it.each(CONNECT_BOARDS)('$id has a winning authored solution and atomic group undo', (board) => {
    const rules = new ConnectRules(board);
    let cleared = 0;
    for (const id of board.solution) {
      const before = rules.snapshot();
      const group = rules.pick(id);
      expect(group?.length).toBeGreaterThanOrEqual(3);
      cleared += group!.length;
      expect(rules.state.columns.flat().length + cleared).toBe(board.columns.flat().length);
      const after = rules.snapshot();
      expect(rules.undo()).toBe(true);
      expect(rules.snapshot()).toEqual(before);
      rules.pick(id);
      expect(rules.snapshot()).toEqual(after);
    }
    expect(rules.status).toBe('won');
    expect(rules.state.columns.flat()).toHaveLength(0);
  });

  it.each([[0, [6, 0, 5, 12]], [1, [1, 3, 0, 15]], [2, [2, 1, 6, 16, 21, 17]]] as const)('board %i has an actual legal losing order', (index, loss) => {
    const rules = new ConnectRules(CONNECT_BOARDS[index]!);
    for (const id of loss) expect(rules.pick(id)).not.toBeNull();
    expect(rules.status).toBe('jammed');
    expect(rules.state.columns.flat().length).toBeGreaterThan(0);
    expect(rules.undo()).toBe(true);
    expect(rules.status).toBe('playing');
  });

  it('disconnected and diagonal marbles cannot be collected into a match', () => {
    const board: ConnectDef = { id: 'diagonal', title: '', maxMoves: 3, solution: [],
      columns: [['red', 'blue', 'red'], ['blue', 'red', 'blue'], ['red', 'blue', 'red'], ['green', 'green', 'green']] };
    const rules = new ConnectRules(board);
    const before = rules.snapshot();
    for (const id of [0, 2, 4, 6, 8]) { expect(rules.group(id)).toHaveLength(1); expect(rules.pick(id)).toBeNull(); }
    expect(rules.snapshot()).toEqual(before);
    expect(rules.canUndo).toBe(false);
    expect(rules.pick(9)).toEqual([9, 10, 11]);
    expect(rules.status).toBe('jammed');
  });

  it('a clear compacts columns and joins a previously disconnected group', () => {
    const rules = new ConnectRules(CONNECT_BOARDS[0]!);
    const before = rules.snapshot();
    expect(rules.group(4)).toHaveLength(1);
    rules.pick(0);
    rules.pick(5);
    rules.pick(12);
    expect(rules.group(4).length).toBeGreaterThanOrEqual(3);
    expect(rules.state.columns).not.toEqual(before.columns);
  });

  it('the move limit is real and clearing the final group on the last move wins', () => {
    const board = CONNECT_BOARDS[1]!;
    const rules = new ConnectRules(board);
    for (const id of [15, 1, 19, 10, 3]) expect(rules.pick(id)).not.toBeNull();
    expect(rules.snapshot()).toMatchObject({ moves: 5, status: 'jammed' });
    expect(rules.pick(0)).toBeNull();
    const winning = new ConnectRules(board);
    for (const id of board.solution) winning.pick(id);
    expect(winning.snapshot()).toMatchObject({ moves: board.maxMoves, status: 'won' });
  });

  it.each(CONNECT_BOARDS)('$id hints solve the current state without mutating it', (board) => {
    const rules = new ConnectRules(board);
    rules.pick(board.solution[0]!);
    const before = rules.snapshot();
    expect(rules.hint(0)).toBeNull();
    expect(rules.snapshot()).toEqual(before);
    while (rules.status === 'playing') {
      const id = rules.hint();
      expect(id).not.toBeNull();
      expect(rules.pick(id!)).not.toBeNull();
    }
    expect(rules.status).toBe('won');
  });

  it('snapshots reject duplicate IDs, cross-column moves and invalid status; copies stay isolated', () => {
    const rules = new ConnectRules(CONNECT_BOARDS[0]!);
    const initial = rules.snapshot();
    const copy = rules.snapshot(); copy.columns[0]?.pop();
    expect(rules.snapshot()).toEqual(initial);
    for (const invalid of [null, {}, { ...initial, columns: [[0, 0], [], [], []] }, { ...initial, columns: [[4], [], [], []] }, { ...initial, status: 'won' }, { ...initial, moves: -1 }]) expect(() => rules.restore(invalid)).toThrow();
    rules.pick(0); const changed = rules.snapshot();
    rules.restore(initial); expect(rules.snapshot()).toEqual(initial);
    rules.restore(changed); expect(rules.snapshot()).toEqual(changed);
  });
});
