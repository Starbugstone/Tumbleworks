import { describe, expect, it } from 'vitest';
import { BOARD_1, BOARD_2, BOARDS } from '../../src/sim/boards';
import { MachineRules } from '../../src/sim/rules';
import { hintConveyor, releaseTree, settle } from '../../src/sim/solver';
import type { BoardDef } from '../../src/sim/types';
import { FUNNEL_JAMS as JAMS, FUNNEL_NO_JAM, FUNNEL_WITNESSES as WITNESSES } from '../witnesses';

const play = (board: BoardDef, order: string): MachineRules => {
  const rules = new MachineRules(board);
  for (const letter of order) {
    expect(rules.release(letter.charCodeAt(0) - 65).ok).toBe(true);
    expect(settle(rules)).toBe(true);
  }
  return rules;
};

describe('Funnel Sort rules', () => {
  it('rejects boards whose marbles do not match their boxes', () => {
    expect(() => new MachineRules({ ...BOARD_1, docks: [['red', 'blue']] })).toThrow(/red|blue|green/);
    expect(() => new MachineRules({ ...BOARD_1, beltCapacity: 0 })).toThrow(/empty machine/);
  });

  it('queues a whole tray in the funnel, feeds the belt one by one, and refuses entry at capacity', () => {
    const rules = new MachineRules(BOARD_1);
    const release = rules.release(0);
    if (!release.ok) throw new Error('release failed');
    expect(release.color).toBe('blue');
    expect(rules.funnelCount).toBe(9);
    expect(rules.occupancy).toBe(0);
    expect(rules.release(5)).toEqual({ ok: false, reason: 'empty' });
    // Any waiting marble may enter: the physical pile decides the order.
    expect(rules.entered(release.marbles[4]!.id)).toBe(true);
    expect(rules.entered(release.marbles[4]!.id)).toBe(false);
    for (const marble of release.marbles) rules.entered(marble.id);
    expect(rules.occupancy).toBe(9);
    rules.release(0);
    for (const id of [...rules.state.pending]) rules.entered(id);
    expect(rules.occupancy).toBe(BOARD_1.beltCapacity);
    expect(rules.funnelCount).toBe(3);
    expect(rules.status).toBe('playing');
  });

  it('delivers only at a dock that wants the colour, reserves slots and moves the dock queue on at the third', () => {
    const rules = new MachineRules(BOARD_1);
    rules.release(0); rules.release(0);
    for (const id of [...rules.state.pending]) rules.entered(id);
    const red = rules.state.marbles.filter((m) => m.color === 'red' && m.status === 'on-belt');
    const blue = rules.state.marbles.filter((m) => m.color === 'blue' && m.status === 'on-belt');
    expect(rules.arrive(blue[0]!.id, 0)).toEqual({ result: 'pass' });
    expect(rules.arrive(red[0]!.id, 99)).toEqual({ result: 'pass' });
    const first = rules.arrive(red[0]!.id, 1);
    expect(first).toMatchObject({ result: 'deliver', box: 0, slot: 0 });
    expect(rules.arrive(red[0]!.id, 1)).toEqual({ result: 'pass' });
    expect(rules.arrive(red[1]!.id, 1)).toMatchObject({ result: 'deliver', slot: 1 });
    const third = rules.arrive(red[2]!.id, 1);
    expect(third).toMatchObject({ result: 'deliver', slot: 2, events: [{ type: 'boxFull', dock: 1, box: 0 }] });
    expect(rules.dockColor(1)).toBe('blue');
    expect(rules.arrive(red[3]!.id, 1)).toEqual({ result: 'pass' });
    expect(rules.reserved(1, 0)).toBe(3);
    expect(rules.boxFill(1, 0)).toBe(0);
    expect(rules.captured(red[0]!.id)).toEqual([]);
    expect(rules.captured(red[0]!.id)).toEqual([]);
    expect(rules.boxFill(1, 0)).toBe(1);
    expect(rules.free).toBe(BOARD_1.beltCapacity - 15 + 3);
  });

  it('jams only when the belt is full and nothing on it can drain, and retains the funnel', () => {
    const rules = play(BOARD_1, 'A');
    expect(rules.occupancy).toBe(9);
    rules.release(1);
    expect(rules.status).toBe('playing');
    expect(settle(rules)).toBe(true);
    expect(rules.status).toBe('jammed');
    expect(rules.occupancy).toBe(15);
    expect(rules.funnelCount).toBe(3);
    expect(rules.release(0)).toEqual({ ok: false, reason: 'finished' });
  });

  it('wins only once every marble rests in a box, and undo snapshots restore everything', () => {
    const rules = play(BOARD_1, 'AA');
    const before = rules.snapshot();
    rules.release(1);
    settle(rules);
    expect(rules.status).toBe('won');
    expect(rules.state.marbles.every((m) => m.status === 'in-box')).toBe(true);
    rules.restore(before);
    expect(rules.status).toBe('playing');
    expect(rules.state.supplies[1]?.length).toBe(1);
    before.pending.push(99);
    expect(rules.state.pending).toEqual([]);
  });

  it('plays every authored witness to a win and every authored jam to a jam', () => {
    for (const board of BOARDS) {
      expect(play(board, WITNESSES[board.id] ?? '').status, board.id).toBe('won');
      if (!FUNNEL_NO_JAM.includes(board.id)) expect(play(board, JAMS[board.id] ?? '').status, board.id).toBe('jammed');
    }
  });

  it('has exactly one winning order on board 1 and a mix on board 2', () => {
    expect(releaseTree(new MachineRules(BOARD_1))).toEqual({ wins: 1, jams: 2, win: 'AAB', jam: 'AB' });
    expect(releaseTree(new MachineRules(BOARD_2))).toMatchObject({ wins: 3, jams: 7 });
  });
});

describe('Funnel Sort hints', () => {
  it('recommends only a verified continuation and never mutates the live state', () => {
    const rules = new MachineRules(BOARD_1);
    const snapshot = JSON.stringify(rules.snapshot());
    expect(hintConveyor(rules)).toBe(0);
    expect(JSON.stringify(rules.snapshot())).toBe(snapshot);
    rules.release(0);
    expect(hintConveyor(rules)).toBe(0);
    rules.release(0);
    expect(hintConveyor(rules)).toBe(1);
  });

  it('returns null after a jam, from a lost position, or when its budget runs out', () => {
    expect(hintConveyor(play(BOARD_1, 'AB'))).toBeNull();
    const lost = new MachineRules(BOARD_1);
    lost.release(1);
    expect(hintConveyor(lost)).toBeNull();
    expect(hintConveyor(new MachineRules(BOARD_2), 1)).toBeNull();
    expect(hintConveyor(new MachineRules(BOARD_2), 0)).toBeNull();
  });
});
