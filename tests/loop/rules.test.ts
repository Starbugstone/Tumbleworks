import { QUEUED_LOOP as LOOP_1, CONGESTED_LOOP as LOOP_2 } from './fixtures';
import { describe, expect, it } from 'vitest';
import { LOOP_BOARDS } from '../../src/loop/boards';
import { LoopRules } from '../../src/loop/rules';
import { hintLoop, loopTree, settleLoop } from '../../src/loop/solver';
import type { LoopBoardDef } from '../../src/loop/types';
import { LOOP_JAMS, LOOP_WITNESSES } from '../witnesses';

const play = (board: LoopBoardDef, order: string): LoopRules => {
  const rules = new LoopRules(board);
  expect(settleLoop(rules)).toBe(true);
  for (const letter of order) {
    expect(rules.tap(letter.charCodeAt(0) - 65).ok, `${board.id} tap ${letter}`).toBe(true);
    expect(settleLoop(rules)).toBe(true);
  }
  return rules;
};

describe('Loop Sort rules', () => {
  it('rejects boards whose trucks cannot all end up full of one colour', () => {
    expect(() => new LoopRules({ ...LOOP_1, loop: [{ color: 'red', count: 12 }] })).toThrow(/red|yellow/);
    expect(() => new LoopRules({ ...LOOP_1, truckCapacity: 20 })).toThrow(/carries|cannot/);
    expect(() => new LoopRules({ ...LOOP_1, loopCapacity: 6 })).toThrow(/over loop capacity/);
    const split = LOOP_1.lanes.map((lane, index) => index ? lane : lane.map((truck, at) => at ? truck : ({ segments: [{ color: truck.segments[0]!.color, count: 2 }, { color: truck.segments[0]!.color, count: truck.segments[0]!.count - 2 }, ...truck.segments.slice(1)] })));
    expect(() => new LoopRules({ ...LOOP_1, lanes: split })).toThrow(/adjacent segments/);
  });

  it('trucks take their loop-end colour automatically and fill from the loop', () => {
    const rules = new LoopRules(LOOP_1);
    expect(rules.occupancy).toBe(12);
    expect(rules.wants(0)).toBeNull();
    expect(rules.wants(1)).toBe('yellow');
    const yellow = rules.state.marbles.find((marble) => marble.color === 'yellow' && marble.status === 'on-loop')!;
    expect(rules.pass(yellow.id, 0)).toEqual({ result: 'pass' });
    expect(rules.pass(yellow.id, 1)).toMatchObject({ result: 'absorb', truck: 0, fill: 13 });
    expect(rules.pass(yellow.id, 1)).toEqual({ result: 'pass' });
    expect(rules.occupancy).toBe(11);
    rules.captured(yellow.id);
    expect(rules.state.marbles[yellow.id]?.status).toBe('in-truck');
  });

  it('clears the line when a truck is full of one colour and rolls the next truck up', () => {
    const rules = new LoopRules(LOOP_1);
    expect(settleLoop(rules)).toBe(true);
    expect(rules.state.lanes[1]?.[0]?.index).toBe(1);
    expect(rules.front(1)?.segments.map((segment) => segment.color)).toEqual(['blue', 'red']);
    expect(rules.occupancy).toBe(0);
    expect(rules.status).toBe('playing');
  });

  it('only pours a truck with something behind its loop-end segment, and never while it is pouring', () => {
    const rules = new LoopRules(LOOP_1);
    settleLoop(rules);
    expect(rules.tap(1)).toMatchObject({ ok: true, color: 'blue' });
    expect(rules.tap(1)).toEqual({ ok: false, reason: 'busy' });
    expect(rules.pending).toBe(8);
    for (let i = 0; i < 8; i++) expect(rules.entered(1)).not.toBeNull();
    expect(rules.entered(1)).toBeNull();
    expect(rules.tap(1)).toEqual({ ok: false, reason: 'single' });
    expect(rules.tap(7)).toEqual({ ok: false, reason: 'empty' });
    expect(rules.wants(1)).toBe('red');
  });

  it('pauses a pour at loop capacity and jams only when nothing on the loop has a home', () => {
    const rules = play(LOOP_2, '');
    expect(rules.tap(1).ok).toBe(true);
    settleLoop(rules);
    expect(rules.status).toBe('jammed');
    expect(rules.occupancy).toBe(LOOP_2.loopCapacity);
    expect(rules.tap(0)).toEqual({ ok: false, reason: 'finished' });
  });

  it('plays every witness to a win, every authored jam to a jam, and snapshots restore', () => {
    for (const board of LOOP_BOARDS) {
      const won = play(board, LOOP_WITNESSES[board.id] ?? '');
      expect(won.status, board.id).toBe('won');
      expect(won.state.marbles.every((marble) => marble.status === 'in-truck')).toBe(true);
      const jam = LOOP_JAMS[board.id];
      if (jam) expect(play(board, jam).status, board.id).toBe('jammed');
    }
    const rules = new LoopRules(LOOP_1);
    settleLoop(rules);
    const before = rules.snapshot();
    rules.tap(1);
    rules.restore(before);
    expect(rules.pending).toBe(0);
    expect(rules.front(1)?.segments.length).toBe(2);
  });

  it('has the authored mix of wins and jams', () => {
    expect(loopTree(new LoopRules(LOOP_1))).toMatchObject({ wins: 2, jams: 0 });
    expect(loopTree(new LoopRules(LOOP_2))).toMatchObject({ wins: 2, jams: 1 });
  });
});

describe('Loop Sort hints', () => {
  it('recommends a verified lane without touching the live state, and declines when lost or out of budget', () => {
    const rules = new LoopRules(LOOP_2);
    settleLoop(rules);
    const snapshot = JSON.stringify(rules.snapshot());
    expect(hintLoop(rules)).toBe(0);
    expect(JSON.stringify(rules.snapshot())).toBe(snapshot);
    expect(hintLoop(play(LOOP_2, 'B'))).toBeNull();
    expect(hintLoop(new LoopRules(LOOP_2), 1)).toBeNull();
  });
});
