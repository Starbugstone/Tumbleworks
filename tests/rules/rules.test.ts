import { describe, expect, it } from 'vitest';
import { BOARD_1, BOARD_2 } from '../../src/sim/boards';
import { MachineRules } from '../../src/sim/rules';
import { drain, replaySettled } from './drive';
import { board, invariantChecker, packet } from './helpers';

function enterAll(rules: MachineRules): void {
  for (const id of [...rules.state.pending]) if (!rules.entered(id)) break;
}

describe('arrival-driven puzzle rules', () => {
  it.each([BOARD_1, BOARD_2])('$id numbers marbles supply by supply and packet by packet', (source) => {
    const before = structuredClone(source);
    const rules = new MachineRules(source);
    expect(rules.board).toBe(source);
    let nextId = 0;
    expect(rules.state.supplies).toEqual(source.supplies.map((supply) => supply.map(({ color, count }) => ({
      color,
      marbles: Array.from({ length: count }, () => ({ id: nextId++, color })),
    }))));
    expect(rules.state.marbles).toEqual(rules.state.supplies.flatMap((supply) =>
      supply.flatMap((value) => value.marbles.map((marble) => ({
        ...marble, status: 'in-supply', boxIndex: null, slot: null,
      }))),
    ));
    expect(rules.occupancy).toBe(0);
    expect(rules.free).toBe(source.beltCapacity);
    expect(rules.activeColor).toBe('red');
    expect(rules.activeBox).toBe(0);
    expect(rules.activeFill).toBe(0);
    expect(rules.status).toBe('playing');
    rules.release(0);
    drain(rules);
    expect(source).toEqual(before);
  });

  it('queues a complete released packet in the funnel while leaving the belt empty', () => {
    const rules = new MachineRules(BOARD_1);
    expect(rules.release(0)).toEqual({
      ok: true, supply: 0, color: 'blue', events: [],
      marbles: Array.from({ length: 6 }, (_, id) => ({ id, color: 'blue' })),
    });
    expect(rules.state.marbles.slice(0, 6).map((marble) => marble.status)).toEqual(Array(6).fill('pouring'));
    expect(rules.state.supplies[0]?.[0]?.color).toBe('red');
    expect(rules.occupancy).toBe(0);
    expect(rules.free).toBe(12);
    expect(rules.funnelCount).toBe(6);
    expect(rules.release(0)).toMatchObject({ ok: true, color: 'red', events: [] });
    expect(rules.state.pending).toEqual(Array.from({ length: 12 }, (_, id) => id));
    expect(rules.occupancy).toBe(0);
    expect(rules.status).toBe('playing');
  });

  it('accepts another dump while the belt is full and still able to drain', () => {
    const rules = new MachineRules(BOARD_1);
    rules.release(0); rules.release(0);
    enterAll(rules);
    expect(rules.occupancy).toBe(12);
    expect(rules.status).toBe('playing');
    expect(rules.release(1)).toMatchObject({ ok: true, color: 'green' });
    expect(rules.occupancy).toBe(12);
    expect(rules.funnelCount).toBe(6);
    expect(rules.entered(12)).toBe(false);
    expect(rules.status).toBe('playing');
  });

  it('admits a packet larger than belt capacity incrementally from the funnel', () => {
    const rules = new MachineRules(board([[packet('red', 8)]], Array(8).fill('red'), 2));
    expect(rules.release(0).ok).toBe(true);
    expect(rules.funnelCount).toBe(8);
    enterAll(rules);
    expect(rules.occupancy).toBe(2);
    expect(rules.funnelCount).toBe(6);
    drain(rules, invariantChecker(rules));
    expect(rules.status).toBe('won');
    expect(rules.funnelCount).toBe(0);
  });

  it('rejects empty and nonexistent supplies without changing state', () => {
    const rules = new MachineRules(BOARD_1);
    for (const supply of [-1, 2, 200, 0.5, NaN]) {
      const before = rules.snapshot();
      expect(rules.release(supply)).toEqual({ ok: false, reason: 'empty' });
      expect(rules.state).toEqual(before);
    }
    rules.release(1);
    expect(rules.release(1)).toEqual({ ok: false, reason: 'empty' });
  });

  it('entered reserves one space only for the next pouring marble and is idempotent', () => {
    const rules = new MachineRules(board([[packet('red', 2)]], ['red', 'red'], 2));
    const initial = rules.snapshot();
    rules.entered(0);
    rules.entered(-1);
    rules.entered(999);
    expect(rules.state).toEqual(initial);
    rules.release(0);
    rules.entered(0);
    expect(rules.state.marbles[0]?.status).toBe('on-belt');
    expect(rules.state.marbles[1]?.status).toBe('pouring');
    expect(rules.occupancy).toBe(1);
    expect(rules.funnelCount).toBe(1);
    const entered = rules.snapshot();
    rules.entered(0);
    expect(rules.state).toEqual(entered);
    rules.arrive(0);
    const dropping = rules.snapshot();
    rules.entered(0);
    expect(rules.state).toEqual(dropping);
    rules.captured(0);
    const captured = rules.snapshot();
    rules.entered(0);
    expect(rules.state).toEqual(captured);
  });

  it('passes unreleased, pouring, wrong-colour, unknown and already delivering marbles', () => {
    const rules = new MachineRules(board([[packet('red')], [packet('blue')]], ['red', 'blue'], 2));
    for (const id of [-1, 0, 999]) expect(rules.arrive(id)).toBe('pass');
    rules.release(0);
    expect(rules.arrive(0)).toBe('pass');
    expect(rules.occupancy).toBe(0);
    rules.release(1);
    enterAll(rules);
    const before = rules.snapshot();
    for (let lap = 0; lap < 10; lap += 1) expect(rules.arrive(1)).toBe('pass');
    expect(rules.state).toEqual(before);
    expect(rules.arrive(0)).toBe('deliver');
    expect(rules.arrive(0)).toBe('pass');
    rules.captured(0);
    expect(rules.arrive(0)).toBe('pass');
    rules.boxSwapped();
    expect(rules.arrive(1)).toBe('deliver');
  });

  it('frees capacity at arrive, before capture, and reserves a slot immediately', () => {
    const rules = new MachineRules(board([[packet('red')], [packet('blue')]], ['red', 'blue'], 1));
    rules.release(0);
    rules.entered(0);
    expect(rules.free).toBe(0);
    expect(rules.arrive(0)).toBe('deliver');
    expect(rules.state.marbles[0]).toEqual({ id: 0, color: 'red', status: 'dropping', boxIndex: 0, slot: 0 });
    expect(rules.occupancy).toBe(0);
    expect(rules.free).toBe(1);
    expect(rules.activeFill).toBe(0);
    expect(rules.release(1)).toMatchObject({ ok: true, events: [] });
    expect(rules.occupancy).toBe(0);
    expect(rules.entered(1)).toBe(true);
    expect(rules.occupancy).toBe(1);
    expect(rules.captured(0)).toEqual([{ type: 'boxFull', boxIndex: 0 }]);
    expect(rules.occupancy).toBe(1);
  });

  it('reserves at most three slots when four matches arrive, including after partial capture', () => {
    const rules = new MachineRules(board([[packet('red', 4)]], ['red', 'red'], 4, 3));
    const check = invariantChecker(rules);
    rules.release(0);
    enterAll(rules);
    for (const id of [2, 0, 1]) { expect(rules.arrive(id)).toBe('deliver'); check(); }
    expect(rules.occupancy).toBe(1);
    expect(rules.activeFill).toBe(0);
    expect(rules.arrive(3)).toBe('pass');
    expect(rules.state.marbles.slice(0, 3).map((marble) => marble.slot)).toEqual([1, 2, 0]);
    expect(rules.captured(0)).toEqual([]);
    expect(rules.activeFill).toBe(1);
    expect(rules.arrive(3)).toBe('pass');
    expect(rules.captured(2)).toEqual([]);
    expect(rules.arrive(3)).toBe('pass');
    expect(rules.captured(1)).toEqual([{ type: 'boxFull', boxIndex: 0 }]);
    expect(rules.activeFill).toBe(3);
    expect(rules.activeBox).toBe(0);
    expect(rules.state.waitingForSwap).toBe(true);
    for (let lap = 0; lap < 8; lap += 1) { expect(rules.arrive(3)).toBe('pass'); check(); }
    expect(rules.boxSwapped()).toEqual([]);
    expect(rules.activeBox).toBe(1);
    expect(rules.activeFill).toBe(0);
    expect(rules.arrive(3)).toBe('deliver');
    expect(rules.state.marbles[3]).toMatchObject({ boxIndex: 1, slot: 0 });
    expect(rules.state.marbles.slice(0, 3).every((marble) => marble.status === 'in-box' && marble.boxIndex === 0)).toBe(true);
    check();
  });

  it('makes captured idempotent and ignores every wrong status and unknown ID', () => {
    const rules = new MachineRules(board([[packet('red', 2)]], ['red'], 2, 2));
    expect(rules.captured(0)).toEqual([]);
    expect(rules.captured(999)).toEqual([]);
    rules.release(0);
    expect(rules.captured(0)).toEqual([]);
    rules.entered(0);
    expect(rules.captured(0)).toEqual([]);
    rules.arrive(0);
    expect(rules.captured(0)).toEqual([]);
    expect(rules.activeFill).toBe(1);
    const once = rules.snapshot();
    expect(rules.captured(0)).toEqual([]);
    expect(rules.state).toEqual(once);
    rules.entered(1);
    rules.arrive(1);
    expect(rules.captured(1)).toEqual([{ type: 'boxFull', boxIndex: 0 }]);
    expect(rules.captured(1)).toEqual([]);
    expect(rules.activeFill).toBe(2);
  });

  it('makes boxSwapped a no-op before full capture and after a completed swap', () => {
    const rules = new MachineRules(board([[packet('red')], [packet('blue')]], ['red', 'blue'], 2));
    const before = rules.snapshot();
    expect(rules.boxSwapped()).toEqual([]);
    expect(rules.state).toEqual(before);
    rules.release(0);
    rules.entered(0);
    rules.arrive(0);
    const dropping = rules.snapshot();
    expect(rules.boxSwapped()).toEqual([]);
    expect(rules.state).toEqual(dropping);
    rules.captured(0);
    expect(rules.boxSwapped()).toEqual([]);
    expect(rules.activeBox).toBe(1);
    const swapped = rules.snapshot();
    expect(rules.boxSwapped()).toEqual([]);
    expect(rules.state).toEqual(swapped);
  });

  it('does not jam a full belt during a drop or pending swap', () => {
    const rules = new MachineRules(board([[packet('red')], [packet('blue')], [packet('green')]], ['red', 'blue', 'green'], 1));
    rules.release(0); rules.release(1); rules.release(2);
    expect(rules.entered(0)).toBe(true);
    expect(rules.arrive(0)).toBe('deliver');
    expect(rules.entered(1)).toBe(true);
    expect(rules.free).toBe(0);
    expect(rules.status).toBe('playing');
    for (let delay = 0; delay < 10; delay += 1) expect(rules.arrive(1)).toBe('pass');
    expect(rules.captured(0)).toEqual([{ type: 'boxFull', boxIndex: 0 }]);
    expect(rules.status).toBe('playing');
    expect(rules.entered(2)).toBe(false);
    expect(rules.boxSwapped()).toEqual([]);
    expect(rules.arrive(1)).toBe('deliver');
    drain(rules);
    expect(rules.status).toBe('won');
  });

  it('defers a full-belt jam until an outstanding swap completes, emitting it once', () => {
    const rules = new MachineRules(board([[packet('red')], [packet('blue')]], ['red', 'green'], 1));
    rules.release(0); rules.release(1);
    rules.entered(0); rules.arrive(0); rules.entered(1);
    expect(rules.status).toBe('playing');
    expect(rules.captured(0)).toEqual([{ type: 'boxFull', boxIndex: 0 }]);
    expect(rules.status).toBe('playing');
    expect(rules.boxSwapped()).toEqual([{ type: 'jammed' }]);
    expect(rules.boxSwapped()).toEqual([]);
    expect(rules.status).toBe('jammed');
  });

  it('does not report a full-belt jam when an incomplete fixture has an empty belt', () => {
    const rules = new MachineRules(board([[packet('red', 2)]], ['red'], 2, 3));
    rules.release(0);
    enterAll(rules);
    rules.arrive(0);
    rules.arrive(1);
    expect(rules.captured(1)).toEqual([]);
    expect(rules.status).toBe('playing');
    expect(rules.captured(0)).toEqual([]);
    expect(rules.occupancy).toBe(0);
    expect(rules.status).toBe('playing');
    expect(rules.activeFill).toBe(2);
    expect(rules.captured(0)).toEqual([]);
  });

  it('does not win until the last capture AND its swap, emitting won exactly once', () => {
    const rules = new MachineRules(board([[packet('red')]], ['red'], 1));
    rules.release(0);
    expect(rules.status).toBe('playing');
    rules.entered(0);
    expect(rules.status).toBe('playing');
    rules.arrive(0);
    expect(rules.free).toBe(1);
    expect(rules.status).toBe('playing');
    expect(rules.captured(0)).toEqual([{ type: 'boxFull', boxIndex: 0 }]);
    expect(rules.status).toBe('playing');
    expect(rules.boxSwapped()).toEqual([{ type: 'won' }]);
    expect(rules.activeColor).toBeNull();
    expect(rules.activeBox).toBe(1);
    expect(rules.activeFill).toBe(0);
    const won = rules.snapshot();
    expect(rules.boxSwapped()).toEqual([]);
    expect(rules.captured(0)).toEqual([]);
    rules.entered(0);
    expect(rules.arrive(0)).toBe('pass');
    expect(rules.release(0)).toEqual({ ok: false, reason: 'finished' });
    expect(rules.state).toEqual(won);
  });

  it.each(['in-supply', 'pouring', 'on-belt'] as const)('never wins with residual %s marbles after the last box', (status) => {
    const rules = new MachineRules(board([[packet('red')], [packet('blue')]], ['red'], 2));
    rules.release(0);
    rules.entered(0);
    if (status !== 'in-supply') rules.release(1);
    if (status === 'on-belt') rules.entered(1);
    rules.arrive(0);
    rules.captured(0);
    expect(rules.boxSwapped()).toEqual([]);
    expect(rules.activeColor).toBeNull();
    expect(rules.status).toBe('playing');
  });

  it('jams only on actual full-belt entry and retains pending funnel marbles', () => {
    const rules = new MachineRules(BOARD_1);
    rules.release(0); rules.release(1); rules.release(0);
    expect(rules.status).toBe('playing');
    expect(rules.occupancy).toBe(0);
    enterAll(rules);
    expect(rules.status).toBe('jammed');
    expect(rules.occupancy).toBe(12);
    expect(rules.funnelCount).toBe(6);
    const jam = rules.snapshot();
    for (const marble of rules.state.marbles) {
      expect(rules.entered(marble.id)).toBe(false);
      expect(rules.arrive(marble.id)).toBe('pass');
      expect(rules.captured(marble.id)).toEqual([]);
    }
    expect(rules.boxSwapped()).toEqual([]);
    expect(rules.release(0)).toEqual({ ok: false, reason: 'finished' });
    expect(rules.state).toEqual(jam);
  });

  it('never calls a belt jam below capacity even when a malformed fixture has no matching receiver', () => {
    const rules = new MachineRules(board([[packet('blue')]], ['red']));
    expect(rules.release(0)).toMatchObject({ ok: true, events: [] });
    expect(rules.entered(0)).toBe(true);
    expect(rules.free).toBe(2);
    expect(rules.status).toBe('playing');
  });

  it('is won initially only for an entirely finished empty board', () => {
    expect(new MachineRules(board([], [])).status).toBe('won');
    expect(new MachineRules(board([], ['red'])).status).toBe('playing');
  });

  it('snapshots and restores complete deep plain JSON data, including partial captures and reservations', () => {
    const source = board([[packet('red', 6)], [packet('blue')], [packet('green')]], ['red', 'red', 'blue', 'green'], 8, 3);
    const rules = new MachineRules(source);
    rules.release(0);
    rules.entered(0);
    rules.arrive(0);
    rules.captured(0);
    rules.entered(1);
    rules.arrive(1);
    rules.entered(2);
    rules.release(1);
    const saved = rules.snapshot();
    expect(saved).toEqual(JSON.parse(JSON.stringify(saved)));
    expect(saved.marbles.map((marble) => marble.status)).toEqual([
      'in-box', 'dropping', 'on-belt', 'pouring', 'pouring', 'pouring', 'pouring', 'in-supply',
    ]);
    drain(rules);
    expect(saved.activeBox).toBe(0);
    expect(saved.activeFill).toBe(1);
    expect(saved.marbles[1]?.status).toBe('dropping');
    rules.restore(saved);
    expect(rules.snapshot()).toEqual(saved);
    expect(rules.occupancy).toBe(1);
    expect(rules.free).toBe(7);
    expect(rules.state.pending).toEqual([3, 4, 5, 6]);
    const restored = rules.snapshot();
    saved.marbles.splice(0, 1);
    saved.supplies[2]?.splice(0, 1);
    saved.activeFill = 99;
    expect(rules.state).toEqual(restored);
    const other = new MachineRules(source);
    other.restore(JSON.parse(JSON.stringify(restored)));
    drain(rules);
    drain(other);
    expect(rules.snapshot()).toEqual(other.snapshot());
    // Restore the actual full-box waiting phase as well, without recomputing it.
    const waiting = new MachineRules(board([[packet('red')]], ['red'], 1));
    waiting.release(0);
    waiting.entered(0);
    waiting.arrive(0);
    waiting.captured(0);
    const full = waiting.snapshot();
    waiting.boxSwapped();
    waiting.restore(full);
    expect(waiting.state.waitingForSwap).toBe(true);
    expect(waiting.boxSwapped()).toEqual([{ type: 'won' }]);
  });

  it('keeps nested supply packet data independent in both snapshot and restore', () => {
    const rules = new MachineRules(BOARD_1);
    const snapshot = rules.snapshot();
    const original = rules.snapshot();
    const queue = snapshot.supplies[0];
    if (!queue) throw new Error('Missing fixture supply');
    queue[0] = { color: 'green', marbles: [{ id: 900, color: 'green' }] };
    expect(rules.state).toEqual(original);
    rules.restore(original);
    original.supplies[0]?.splice(0, 1);
    expect(rules.state.supplies[0]).toHaveLength(2);
    expect(rules.release(0)).toMatchObject({
      ok: true, color: 'blue',
      marbles: Array.from({ length: 6 }, (_, id) => ({ id, color: 'blue' })),
    });
  });

  it('restores from a jam and reproduces the winning continuation with original IDs', () => {
    const rules = new MachineRules(BOARD_1);
    rules.release(0);
    drain(rules);
    const beforeJam = rules.snapshot();
    rules.release(1);
    drain(rules);
    expect(rules.status).toBe('jammed');
    const jam = rules.snapshot();
    enterAll(rules);
    rules.restore(beforeJam);
    expect(rules.status).toBe('playing');
    expect(rules.release(0)).toMatchObject({ ok: true, marbles: Array.from({ length: 6 }, (_, index) => ({ id: index + 6, color: 'red' })) });
    drain(rules);
    rules.release(1);
    drain(rules);
    expect(rules.snapshot()).toEqual(replaySettled(BOARD_1, [0, 0, 1]).snapshot());
    expect(rules.status).toBe('won');
    rules.restore(jam);
    expect(rules.status).toBe('jammed');
    expect(rules.snapshot()).toEqual(jam);
    expect(rules.release(0)).toEqual({ ok: false, reason: 'finished' });
  });
});
