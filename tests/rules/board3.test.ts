import { describe, expect, it } from 'vitest';
import { BOARD_1, BOARD_2, BOARD_3, BOARDS } from '../../src/sim/boards';
import { MachineRules } from '../../src/sim/rules';
import { hintConveyor } from '../../src/sim/solver';
import { drain, enumerate, replaySettled } from './drive';
import { colorCounts, invariantChecker } from './helpers';

const BOARD_3_SOLUTION = [0, 0, 2, 1, 2, 1, 0];

describe('hard conveyor board', () => {
  it('adds a third board without changing the earlier board identities', () => {
    expect(BOARDS).toEqual([BOARD_1, BOARD_2, BOARD_3]);
    expect(BOARD_3.id).toBe('board-3');
  });

  it('conserves all 42 marbles through the authored winning release order', () => {
    const before = structuredClone(BOARD_3);
    const rules = new MachineRules(BOARD_3);
    const check = invariantChecker(rules);
    const colors = rules.state.marbles.map((marble) => marble.color);
    expect(colors).toHaveLength(42);
    expect(colorCounts(colors)).toEqual({ red: 12, blue: 12, green: 6, yellow: 12 });
    expect(BOARD_3.boxes).toHaveLength(14);
    for (const supply of BOARD_3_SOLUTION) {
      expect(rules.release(supply).ok).toBe(true);
      check();
      drain(rules, check);
    }
    expect(rules.status).toBe('won');
    expect(rules.state.marbles.every((marble) => marble.status === 'in-box')).toBe(true);
    expect(BOARD_3).toEqual(before);
  });

  it('has both winning and jamming branches, including a tempting wrong second release', () => {
    const tree = enumerate(BOARD_3);
    expect(tree.wins).toContain('AACBCBA');
    expect(tree.wins).toHaveLength(19);
    expect(tree.jams).toHaveLength(23);
    expect(tree.wins.some((sequence) => sequence.startsWith('B'))).toBe(false);
    expect(tree.jams).toContain('AB');
    expect(replaySettled(BOARD_3, [0, 1]).status).toBe('jammed');
  });
});

describe('current-state conveyor hints', () => {
  it.each(BOARDS)('$id is completed by following verified hints', (board) => {
    const rules = new MachineRules(board);
    const check = invariantChecker(rules);
    const packets = board.supplies.reduce((count, supply) => count + supply.length, 0);
    for (let release = 0; rules.status === 'playing' && release < packets; release += 1) {
      const before = rules.snapshot();
      const hint = hintConveyor(rules);
      expect(rules.state).toEqual(before);
      expect(hint).not.toBeNull();
      if (hint === null) throw new Error('Expected a verified continuation');
      expect(rules.release(hint).ok).toBe(true);
      drain(rules, check);
    }
    expect(rules.status).toBe('won');
    expect(hintConveyor(rules)).toBeNull();
  });

  it('finds a continuation after a non-initial opening and does not mutate its snapshot', () => {
    const rules = replaySettled(BOARD_3, [0, 0, 0]);
    const before = rules.snapshot();
    expect(hintConveyor(rules)).toBe(1);
    expect(rules.state).toEqual(before);
    const hint = hintConveyor(rules);
    if (hint === null) throw new Error('Expected a useful release');
    expect(rules.release(hint).ok).toBe(true);
    drain(rules);
    expect(rules.status).toBe('playing');
  });

  it('settles pouring marbles on its clone without touching live pouring or partial delivery', () => {
    const rules = new MachineRules(BOARD_1);
    rules.release(0);
    const pouring = rules.snapshot();
    expect(hintConveyor(rules)).toBe(0);
    expect(rules.state).toEqual(pouring);
    rules.release(0);
    for (const marble of rules.state.marbles) if (marble.status === 'pouring') rules.entered(marble.id);
    rules.arrive(6);
    const dropping = rules.snapshot();
    expect(hintConveyor(rules)).toBeNull();
    expect(rules.state).toEqual(dropping);
    rules.captured(6);
    const captured = rules.snapshot();
    hintConveyor(rules);
    expect(rules.state).toEqual(captured);
  });

  it('never recommends a packet that cannot fit until outstanding deliveries finish', () => {
    const rules = new MachineRules(BOARD_3);
    rules.release(0); rules.release(0);
    expect(rules.free).toBe(0);
    expect(rules.status).toBe('playing');
    expect(hintConveyor(rules)).toBeNull();
    drain(rules);
    const next = hintConveyor(rules);
    expect(next).not.toBeNull();
    if (next === null) throw new Error('Expected a release after delivery');
    expect(rules.release(next).ok).toBe(true);
  });

  it('returns no unverified answer after a jam or exhausted search budget', () => {
    expect(hintConveyor(replaySettled(BOARD_3, [0, 1]))).toBeNull();
    const rules = new MachineRules(BOARD_3);
    const before = rules.snapshot();
    expect(hintConveyor(rules, 0)).toBeNull();
    expect(hintConveyor(rules, 1)).toBeNull();
    expect(rules.state).toEqual(before);
    expect(rules.status).toBe('playing');
  });
});
