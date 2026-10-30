import { describe, expect, it } from 'vitest';
import { BOARD_1 } from '../../src/sim/boards';
import { ConveyorSim, DEFAULT_CONFIG } from '../../src/sim/conveyor';
import { settle } from './enumerate';
import { board, FAST_CONFIG, invariantChecker, packet, tick } from './helpers';

describe('conveyor rules', () => {
  it('uses the agreed default timing, gates and sampling positions', () => {
    expect(DEFAULT_CONFIG).toEqual({ beltPositions: 24, entryPosition: 0, deliveryPosition: 12, ticksPerStep: 8 });
    const sim = new ConveyorSim(BOARD_1);
    expect(sim.board).toBe(BOARD_1);
    expect(sim.config).toEqual(DEFAULT_CONFIG);
    expect(sim.frontColor).toBe('red');
    expect(sim.occupancy).toBe(0);
    expect(sim.free).toBe(12);
    expect(sim.canUndo).toBe(false);
  });

  it('reserves a complete packet immediately, including all pending marbles', () => {
    const sim = new ConveyorSim(BOARD_1);
    expect(sim.release(0)).toMatchObject({ ok: true, supply: 0, color: 'blue', events: [] });
    expect(sim.state.pending).toHaveLength(6);
    expect(sim.state.belt).toHaveLength(0);
    expect(sim.occupancy).toBe(6);
    expect(sim.free).toBe(6);
    expect(sim.release(0)).toMatchObject({ ok: true, color: 'red', events: [] });
    expect(sim.occupancy).toBe(12);
    expect(sim.free).toBe(0);
    expect(sim.state.status).toBe('playing');
  });

  it('reports the whole packet size and canDrain for a blocked release without mutating state', () => {
    const sim = new ConveyorSim(BOARD_1);
    sim.release(0);
    sim.release(0);
    const before = structuredClone(sim.state);
    expect(sim.release(1)).toEqual({ ok: false, reason: 'no-space', needed: 6, free: 0, canDrain: true });
    expect(sim.state).toEqual(before);
    expect(sim.undo()).toBe(true);
    expect(sim.state.pending).toHaveLength(6);
    expect(sim.undo()).toBe(true);
    expect(sim.undo()).toBe(false);
  });

  it('reports canDrain false when a smaller front packet fits but existing marbles cannot deliver', () => {
    const sim = new ConveyorSim(board(
      [[packet('blue', 2)], [packet('green', 2)], [packet('red')]],
      ['red', 'blue', 'blue', 'green', 'green'],
    ));
    sim.release(0);
    expect(sim.release(1)).toEqual({ ok: false, reason: 'no-space', needed: 2, free: 1, canDrain: false });
    expect(sim.state.status).toBe('playing');
    expect(sim.release(2).ok).toBe(true);
  });

  it('detects deliverable belt marbles as well as pending marbles in canDrain', () => {
    const sim = new ConveyorSim(board([[packet('red', 2)], [packet('blue')]], ['red', 'red', 'blue'], 2), FAST_CONFIG);
    sim.release(0);
    expect(sim.release(1)).toMatchObject({ reason: 'no-space', canDrain: true });
    tick(sim, 2 * FAST_CONFIG.ticksPerStep);
    expect(sim.state.pending).toHaveLength(0);
    expect(sim.state.belt).toHaveLength(2);
    expect(sim.release(1)).toMatchObject({ reason: 'no-space', canDrain: true });
  });

  it('rejects an empty or nonexistent supply without creating an undo point', () => {
    const sim = new ConveyorSim(BOARD_1);
    const before = structuredClone(sim.state);
    expect(sim.release(2)).toEqual({ ok: false, reason: 'empty' });
    expect(sim.release(-1)).toEqual({ ok: false, reason: 'empty' });
    expect(sim.state).toEqual(before);
    expect(sim.canUndo).toBe(false);
    sim.release(1);
    expect(sim.release(1)).toEqual({ ok: false, reason: 'empty' });
    expect(sim.undo()).toBe(true);
    expect(sim.undo()).toBe(false);
  });

  it('enters on the first step after release and advances only on complete steps', () => {
    const sim = new ConveyorSim(BOARD_1);
    tick(sim, 3);
    sim.release(0);
    expect(tick(sim, 4)).toEqual([]);
    expect(sim.state).toMatchObject({ tick: 7, stepTick: 7, belt: [] });
    expect(sim.tick()).toEqual([{ type: 'entered', marbleId: 0, position: 0 }]);
    expect(sim.state).toMatchObject({ tick: 8, stepTick: 0, belt: [{ id: 0, color: 'blue', position: 0 }] });
    expect(tick(sim, 7)).toEqual([]);
    expect(sim.state.belt[0]?.position).toBe(0);
    expect(sim.tick()).toEqual([{ type: 'entered', marbleId: 1, position: 0 }]);
    expect(sim.state.belt[0]?.position).toBe(1);
  });

  it('enters packets and marbles in FIFO order with stable supply-first IDs', () => {
    const sim = new ConveyorSim(BOARD_1);
    const blue = sim.release(0);
    const red = sim.release(0);
    expect(blue).toMatchObject({ marbles: Array.from({ length: 6 }, (_, id) => ({ id, color: 'blue' })) });
    expect(red).toMatchObject({ marbles: Array.from({ length: 6 }, (_, offset) => ({ id: offset + 6, color: 'red' })) });
    const events = tick(sim, 12 * DEFAULT_CONFIG.ticksPerStep);
    expect(events.filter((event) => event.type === 'entered').map((event) => event.marbleId)).toEqual(
      Array.from({ length: 12 }, (_, id) => id),
    );
    expect(sim.state.supplies[1]?.[0]?.marbles.map((marble) => marble.id)).toEqual([12, 13, 14, 15, 16, 17]);
  });

  it('wraps positions and leaves a waiting marble pending when entry is occupied', () => {
    const sim = new ConveyorSim(board(
      [[packet('blue', 3)], [packet('red')]], ['red', 'blue', 'blue', 'blue'], 4,
    ), { beltPositions: 2, entryPosition: 0, deliveryPosition: 1, ticksPerStep: 1 });
    const check = invariantChecker(sim);
    sim.release(0);
    check();
    tick(sim, 2);
    expect(sim.state.belt).toEqual([{ id: 0, color: 'blue', position: 1 }, { id: 1, color: 'blue', position: 0 }]);
    expect(sim.state.pending.map((marble) => marble.id)).toEqual([2]);
    expect(sim.tick()).toEqual([]);
    expect(sim.state.belt).toEqual([{ id: 0, color: 'blue', position: 0 }, { id: 1, color: 'blue', position: 1 }]);
    expect(sim.state.pending.map((marble) => marble.id)).toEqual([2]);
    for (let index = 0; index < 20; index += 1) {
      sim.tick();
      check();
      expect(new Set(sim.state.belt.map((marble) => marble.position)).size).toBe(sim.state.belt.length);
      expect(sim.state.pending).toHaveLength(1);
    }
  });

  it('delivers before entry when the two gates share a position', () => {
    const sim = new ConveyorSim(board([[packet('red', 3)]], ['red', 'red', 'red']), {
      beltPositions: 2, entryPosition: 0, deliveryPosition: 0, ticksPerStep: 1,
    });
    sim.release(0);
    tick(sim, 2);
    expect(sim.tick()).toEqual([
      { type: 'delivered', marbleId: 0, boxIndex: 0, slot: 0 },
      { type: 'boxFilled', boxIndex: 0 },
      { type: 'entered', marbleId: 2, position: 0 },
    ]);
  });

  it('lets the wrong colour circulate until its own box becomes active', () => {
    const sim = new ConveyorSim(board([[packet('blue')], [packet('red')]], ['red', 'blue'], 2), FAST_CONFIG);
    sim.release(0);
    expect(tick(sim, 3 * FAST_CONFIG.beltPositions * FAST_CONFIG.ticksPerStep).some((event) => event.type === 'delivered')).toBe(false);
    expect(sim.state.frontBox).toBe(0);
    expect(sim.state.belt.map((marble) => marble.id)).toEqual([0]);
    sim.release(1);
    const events: ReturnType<ConveyorSim['tick']> = [];
    settle(sim, (stepEvents) => events.push(...stepEvents));
    expect(events.filter((event) => event.type === 'delivered')).toEqual([
      { type: 'delivered', marbleId: 1, boxIndex: 0, slot: 0 },
      { type: 'delivered', marbleId: 0, boxIndex: 1, slot: 0 },
    ]);
    expect(sim.state.status).toBe('won');
  });

  it('advances a filled box and clears its fill immediately, with ordered zero-based events', () => {
    const sim = new ConveyorSim(board([[packet('red', 2)], [packet('blue', 2)]], ['red', 'blue'], 2, 2), FAST_CONFIG);
    sim.release(0);
    tick(sim, 4 * FAST_CONFIG.ticksPerStep);
    expect(sim.state).toMatchObject({ frontBox: 0, frontBoxFill: 1 });
    expect(sim.frontColor).toBe('red');
    expect(tick(sim, FAST_CONFIG.ticksPerStep)).toEqual([
      { type: 'delivered', marbleId: 1, boxIndex: 0, slot: 1 },
      { type: 'boxFilled', boxIndex: 0 },
    ]);
    expect(sim.state).toMatchObject({ frontBox: 1, frontBoxFill: 0 });
    expect(sim.frontColor).toBe('blue');
    sim.release(1);
    settle(sim);
    expect(sim.state).toMatchObject({ frontBox: 2, frontBoxFill: 0, status: 'won' });
    expect(sim.frontColor).toBeNull();
  });

  it('restores the full pre-release state, including IDs, box progress and belt phase', () => {
    const sim = new ConveyorSim(board(
      [[packet('red', 2)], [packet('blue', 2)], [packet('green', 2)]], ['red', 'blue', 'green'], 6, 2,
    ), FAST_CONFIG);
    const initial = structuredClone(sim.state);
    sim.release(0);
    tick(sim, 4 * FAST_CONFIG.ticksPerStep + 1);
    expect(sim.state).toMatchObject({ frontBoxFill: 1, stepTick: 1 });
    const before = structuredClone(sim.state);
    const release = sim.release(1);
    tick(sim, 5 * FAST_CONFIG.ticksPerStep);
    expect(sim.undo()).toBe(true);
    expect(sim.state).toEqual(before);
    expect(sim.release(1)).toEqual(release);
    expect(sim.undo()).toBe(true);
    expect(sim.state).toEqual(before);
    expect(sim.undo()).toBe(true);
    expect(sim.state).toEqual(initial);
    expect(sim.canUndo).toBe(false);
  });

  it('has no tick undo points and restores time to the last release snapshot', () => {
    const sim = new ConveyorSim(BOARD_1);
    tick(sim, 37);
    expect(sim.undo()).toBe(false);
    const before = structuredClone(sim.state);
    sim.release(0);
    tick(sim, 200);
    expect(sim.undo()).toBe(true);
    expect(sim.state).toEqual(before);
    expect(sim.undo()).toBe(false);
  });

  it('emits a jam once at release, still feeds and moves the belt, and allows undo', () => {
    const sim = new ConveyorSim(BOARD_1);
    sim.release(0);
    tick(sim, 3);
    const before = structuredClone(sim.state);
    expect(sim.release(1)).toMatchObject({ ok: true, events: [{ type: 'jammed' }] });
    expect(sim.state.status).toBe('jammed');
    expect(sim.canUndo).toBe(true);
    const events = tick(sim, 12 * DEFAULT_CONFIG.ticksPerStep);
    expect(events.filter((event) => event.type === 'entered')).toHaveLength(12);
    expect(events.some((event) => event.type === 'jammed' || event.type === 'won' || event.type === 'delivered')).toBe(false);
    const positions = sim.state.belt.map((marble) => marble.position);
    tick(sim, DEFAULT_CONFIG.ticksPerStep);
    expect(sim.state.belt.map((marble) => marble.position)).toEqual(positions.map((position) => (position + 1) % 24));
    expect(sim.state.status).toBe('jammed');
    const ended = structuredClone(sim.state);
    expect(sim.release(0)).toEqual({ ok: false, reason: 'finished' });
    expect(sim.state).toEqual(ended);
    expect(sim.undo()).toBe(true);
    expect(sim.state).toEqual(before);
  });

  it('jams when all supplies are empty and remaining marbles cannot deliver, even below capacity', () => {
    const sim = new ConveyorSim(board([[packet('blue')]], ['red'], 3), FAST_CONFIG);
    expect(sim.release(0)).toMatchObject({ ok: true, events: [{ type: 'jammed' }] });
    expect(sim.free).toBe(2);
    settle(sim);
    expect(sim.state).toMatchObject({ status: 'jammed', pending: [], frontBox: 0, frontBoxFill: 0 });
    expect(sim.state.belt).toHaveLength(1);
  });

  it('re-evaluates status after a delivery exhausts the only matching colour', () => {
    const sim = new ConveyorSim(board([[packet('red'), packet('blue')]], ['red', 'green', 'blue'], 2), FAST_CONFIG);
    expect(sim.release(0)).toMatchObject({ ok: true, events: [] });
    expect(sim.release(0)).toMatchObject({ ok: true, events: [] });
    expect(sim.state.status).toBe('playing');
    expect(tick(sim, 4 * FAST_CONFIG.ticksPerStep)).toEqual([
      { type: 'entered', marbleId: 0, position: 0 },
      { type: 'entered', marbleId: 1, position: 0 },
      { type: 'delivered', marbleId: 0, boxIndex: 0, slot: 0 },
      { type: 'boxFilled', boxIndex: 0 },
      { type: 'jammed' },
    ]);
    expect(sim.state).toMatchObject({ status: 'jammed', frontBox: 1, frontBoxFill: 0 });
    expect(tick(sim, 100).every((event) => event.type === 'entered')).toBe(true);
  });

  it('does not mistake a temporarily full belt with deliverable marbles for a jam', () => {
    const sim = new ConveyorSim(BOARD_1);
    sim.release(0);
    settle(sim);
    expect(sim.release(0)).toMatchObject({ ok: true, events: [] });
    expect(sim.occupancy).toBe(12);
    expect(sim.free).toBe(0);
    expect(sim.state.status).toBe('playing');
    expect(sim.release(1)).toMatchObject({ ok: false, reason: 'no-space', canDrain: true });
    settle(sim);
    expect(sim.state).toMatchObject({ frontBox: 4, frontBoxFill: 0, status: 'playing' });
    expect(sim.occupancy).toBe(0);
    expect(sim.release(1).ok).toBe(true);
    settle(sim);
    expect(sim.state.status).toBe('won');
  });

  it('wins only after all supplies, pending marbles, belt and boxes are finished, and disables undo', () => {
    const sim = new ConveyorSim(board([[packet('red')]], ['red'], 1), FAST_CONFIG);
    sim.release(0);
    expect(sim.state.status).toBe('playing');
    expect(sim.canUndo).toBe(true);
    expect(tick(sim, 3 * FAST_CONFIG.ticksPerStep)).toEqual([{ type: 'entered', marbleId: 0, position: 0 }]);
    expect(sim.state.status).toBe('playing');
    expect(tick(sim, FAST_CONFIG.ticksPerStep)).toEqual([
      { type: 'delivered', marbleId: 0, boxIndex: 0, slot: 0 },
      { type: 'boxFilled', boxIndex: 0 },
      { type: 'won' },
    ]);
    expect(sim.canUndo).toBe(false);
    const before = structuredClone(sim.state);
    expect(sim.undo()).toBe(false);
    expect(sim.state).toEqual(before);
    expect(sim.release(0)).toEqual({ ok: false, reason: 'finished' });
    expect(tick(sim, 101)).toEqual([]);
    expect(sim.state).toEqual({ ...before, tick: before.tick + 101, stepTick: 1 });
  });

  it('does not win merely because all boxes have been filled', () => {
    const sim = new ConveyorSim(board([[packet('red')], [packet('blue')]], ['red'], 2), FAST_CONFIG);
    sim.release(0);
    settle(sim);
    expect(sim.frontColor).toBeNull();
    expect(sim.state.status).toBe('playing');
    expect(sim.release(1)).toMatchObject({ ok: true, events: [{ type: 'jammed' }] });
    settle(sim);
    expect(sim.occupancy).toBe(1);
    expect(sim.state.status).toBe('jammed');
  });

  it('resets a jam and all undo history to the original IDs and phase without changing board data', () => {
    const source = structuredClone(BOARD_1);
    const sim = new ConveyorSim(source);
    const initial = structuredClone(sim.state);
    sim.release(0);
    sim.release(1);
    tick(sim, 99);
    sim.reset();
    expect(sim.state).toEqual(initial);
    expect(sim.canUndo).toBe(false);
    expect(sim.undo()).toBe(false);
    expect(source).toEqual(BOARD_1);
    expect(sim.release(0)).toMatchObject({ marbles: initial.supplies[0]?.[0]?.marbles });
  });
});
