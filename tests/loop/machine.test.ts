import { QUEUED_LOOP as LOOP_1, CONGESTED_LOOP } from './fixtures';
import { describe, expect, it } from 'vitest';
import { LOOP_BOARDS } from '../../src/loop/boards';
import { bays, bedSpans, DECK_TOP, RoundedTrack, sharePercent, TRUCK } from '../../src/loop/layout';
import { LoopMachine, type UnitPose } from '../../src/loop/machine';
import type { LoopBoardDef } from '../../src/loop/types';
import { hintLoop } from '../../src/loop/solver';
import { LOOP_JAMS, LOOP_WITNESSES } from '../witnesses';

/** Taps the next lane once the loop has stopped changing, like a patient player. */
function play(board: LoopBoardDef, order: string, limitSeconds = 200): LoopMachine {
  const machine = new LoopMachine(board);
  const taps = [...order].map((letter) => letter.charCodeAt(0) - 65);
  let next = 0;
  for (let tick = 0; tick < 60 * limitSeconds; tick++) {
    machine.step();
    if (machine.rules.status !== 'playing' && !machine.transferring) break;
    const tap = taps[next];
    if (tap !== undefined && machine.rules.pending === 0 && !machine.rules.canDrain() && tick % 10 === 0 && machine.tap(tap).ok) next += 1;
  }
  return machine;
}

describe('the rounded loop track', () => {
  it('maps distance to position and back all the way round', () => {
    const track = new RoundedTrack(3, 4, 1.2);
    for (let d = 0; d < track.length; d += 0.37) {
      const p = track.point(d);
      const back = track.nearest(p.x, p.z);
      expect(Math.abs(((back.distance - d + track.length / 2) % track.length) - track.length / 2)).toBeLessThan(1e-6);
      expect(Math.abs(back.lateral)).toBeLessThan(1e-6);
      expect(Math.hypot(p.tx, p.tz)).toBeCloseTo(1, 6);
    }
    expect(track.nearest(0, -4.5).lateral).toBeCloseTo(0.5, 6);
    expect(track.nearest(3.4, 0).lateral).toBeCloseTo(0.4, 6);
  });

  it('stands every lane in one row of columns under the belt, in lane order', () => {
    for (const lanes of [2, 3, 4, 5]) {
      const xs = bays(lanes).map((bay) => bay.x);
      expect(xs).toEqual([...xs].sort((a, b) => a - b));
      expect(xs.reduce((sum, x) => sum + x, 0)).toBeCloseTo(0, 6);
    }
  });
});

describe('the Loop Sort machine agrees with the rules', () => {
  for (const board of LOOP_BOARDS.slice(0, 2)) {
    it(`${board.id}: the introductory exchange never waits for belt capacity`, () => {
      const machine = new LoopMachine(board);
      expect(machine.rules.occupancy).toBe(0);
      for (let lane = 0; lane < board.lanes.length; lane++) expect(machine.tap(lane).ok).toBe(true);
      let idle = 0, longestIdle = 0;
      for (let tick = 0; tick < 60 * 12; tick++) {
        const events = machine.step();
        if (machine.rules.pending) {
          expect(machine.rules.free).toBeGreaterThan(0);
          idle = events.some((event) => event.type === 'enter' || event.type === 'absorb') ? 0 : idle + 1;
          longestIdle = Math.max(longestIdle, idle);
        }
        if (machine.rules.status === 'won' && !machine.transferring) break;
      }
      expect(machine.rules.status).toBe('won');
      expect(longestIdle / 60).toBeLessThan(0.5);
    });
  }
  for (const board of LOOP_BOARDS) {
    it(`${board.id}: the witness wins through the scripted loop within capacity`, { timeout: 120_000 }, () => {
      const machine = play(board, LOOP_WITNESSES[board.id] ?? '');
      expect(machine.rules.status).toBe('won');
      expect(machine.transferring).toBe(false);
      expect(machine.rules.occupancy).toBe(0);
    });
  }

  it('keeps the authored final colour for pouring, leaving and replacement trucks', () => {
    const machine = new LoopMachine(LOOP_1);
    const targets = () => machine.readTrucks().map(({ lane, index, finalColor }) => ({ lane, index, finalColor }));
    const expected = [
      { lane: 0, index: 0, finalColor: 'blue' },
      { lane: 1, index: 0, finalColor: 'yellow' },
      { lane: 1, index: 1, finalColor: 'red' },
    ];
    expect(targets()).toEqual(expected);
    expect(machine.tap(0).ok).toBe(true);
    expect(machine.readTrucks().find((truck) => truck.lane === 0)?.unloading).toBe('waiting');
    let replacement = false;
    for (let tick = 0; tick < 900; tick++) {
      machine.step();
      expect(targets()).toEqual(expected);
      replacement ||= machine.readTrucks().some((truck) => truck.lane === 1 && truck.index === 1 && truck.docked);
    }
    expect(replacement).toBe(true);
    expect(machine.undo()).toBe(true);
    expect(targets()).toEqual(expected);
    expect(machine.readTrucks().find((truck) => truck.lane === 1 && truck.docked)?.finalColor).toBe('yellow');
  });

  it('dispatches above the deck and shrinks away before disappearing', { timeout: 300_000 }, () => {
    for (const board of LOOP_BOARDS) {
      const machine = new LoopMachine(board);
      const taps = [...(LOOP_WITNESSES[board.id] ?? '')].map((letter) => letter.charCodeAt(0) - 65);
      const lastVisible = new Map<string, number>();
      const finished = new Set<string>();
      let next = 0;
      for (let tick = 0; tick < 60 * 200; tick++) {
        machine.step();
        for (const truck of machine.readTrucks()) {
          const key = `${truck.lane}:${truck.index}`;
          if (truck.departing) {
            expect(truck.y).toBeGreaterThanOrEqual(DECK_TOP);
            lastVisible.set(key, truck.scale);
          } else if (!truck.visible && lastVisible.has(key) && !finished.has(key)) {
            expect(lastVisible.get(key)).toBeLessThan(0.02);
            finished.add(key);
          }
        }
        if (machine.rules.status !== 'playing' && !machine.transferring) break;
        const lane = taps[next];
        if (lane !== undefined && machine.rules.pending === 0 && !machine.rules.canDrain() && tick % 10 === 0 && machine.tap(lane).ok) next++;
      }
      expect(finished.size).toBe(board.lanes.reduce((sum, lane) => sum + lane.length, 0));
    }
  });

  it('sizes units so a full loop looks full: capacity units close the ring with no visible gap', () => {
    for (const board of LOOP_BOARDS) {
      const machine = new LoopMachine(board);
      expect(machine.unitSpacing * board.loopCapacity).toBeCloseTo(machine.track.length, 6);
      expect(machine.marblesPerUnit % 3).toBe(0);
    }
    const full = CONGESTED_LOOP;
    expect(full.loop.reduce((sum, entry) => sum + entry.count, 0)).toBe(full.loopCapacity);
    const machine = new LoopMachine(full);
    const poses: UnitPose[] = Array.from({ length: machine.marblesPerUnit }, () => ({ x: 0, y: 0, z: 0, roll: 0, visible: false }));
    const centres = machine.rules.state.marbles.filter((marble) => marble.status === 'on-loop').map((marble) => {
      machine.readUnit(marble.id, poses);
      const middle = poses[Math.floor(machine.marblesPerUnit / 2)]!;
      return machine.track.nearest(middle.x, middle.z).distance;
    }).sort((a, b) => a - b);
    const gaps = centres.map((distance, index) => ((centres[(index + 1) % centres.length]! - distance) + machine.track.length) % machine.track.length);
    expect(Math.max(...gaps)).toBeLessThan(machine.unitSpacing * 1.5);
  });

  it('the authored jam really jams and the pour that caused it stays paused in the truck', { timeout: 60_000 }, () => {
    const machine = play(LOOP_BOARDS[2]!, LOOP_JAMS['loop-3'] ?? '');
    expect(machine.rules.status).toBe('jammed');
    expect(machine.rules.occupancy).toBe(LOOP_BOARDS[2]!.loopCapacity);
    expect(machine.transferring).toBe(false);
  });

  it('undo during a pour restores the rules and every unit, and the next tap is accepted at once', () => {
    const machine = new LoopMachine(LOOP_1);
    for (let tick = 0; tick < 60 * 8; tick++) machine.step();
    expect(machine.rules.occupancy).toBe(0);
    const before = JSON.stringify(machine.rules.snapshot());
    const trucksBefore = machine.readTrucks();
    expect(machine.tap(1).ok).toBe(true);
    for (let tick = 0; tick < 20; tick++) machine.step();
    expect(machine.rules.occupancy + machine.rules.pending).toBe(8);
    expect(machine.undo()).toBe(true);
    expect(JSON.stringify(machine.rules.snapshot())).toBe(before);
    expect(machine.readTrucks()).toEqual(trucksBefore);
    expect(machine.transferring).toBe(false);
    expect(machine.tap(0).ok).toBe(true);
    expect(machine.tap(1).ok).toBe(true);
  });
});

describe('the waiting line', () => {
  it('numbers every waiting lorry in line on every level, and only the docked one appears on the toy', () => {
    for (const board of LOOP_BOARDS) {
      const machine = new LoopMachine(board);
      for (const truck of machine.readTrucks()) {
        expect(truck.queueSlot).toBe(truck.index === 0 ? null : truck.index - 1);
        expect(truck.visible).toBe(truck.index === 0);
      }
    }
  });

  it('brings the next lorry into the bay as the finished one lifts away', () => {
    const machine = new LoopMachine(LOOP_1);
    const docked = machine.mouthZ(1) + TRUCK.bedLength / 2;
    const read = () => machine.readTrucks().find((truck) => truck.lane === 1 && truck.index === 1)!;
    expect(read().queueSlot).toBe(0);
    let lifted = 0;
    for (let tick = 0; tick < 900 && !read().docked; tick++) {
      machine.step();
      const leaving = machine.readTrucks().find((candidate) => candidate.lane === 1 && candidate.departing);
      if (leaving) lifted = Math.max(lifted, leaving.y - DECK_TOP);
    }
    expect(lifted).toBeGreaterThan(0);
    const settled = read();
    expect(settled).toMatchObject({ docked: true, visible: true, scale: 1, queueSlot: null });
    expect(settled.z).toBeCloseTo(docked, 6);
  });

  it('keeps every stretch of a bed long enough for its number, and the bed exactly full', () => {
    for (const units of [[2, 2, 20], [2, 2, 2, 18], [2, 4, 6, 8, 4], [24], [12, 12], [1, 23]]) {
      const spans = bedSpans(units, 24, TRUCK.bedLength, 0.36);
      expect(spans.reduce((sum, span) => sum + span, 0)).toBeCloseTo(TRUCK.bedLength, 6);
      spans.forEach((span, index) => expect(span).toBeGreaterThanOrEqual(0.36 * Math.min(1, units[index]!) - 1e-9));
    }
    expect(bedSpans([0, 24], 24, 3.6, 0.36)).toEqual([0, 3.6]);
  });

  it('closes the line up as lorries leave, and undo puts a lorry back in its place', { timeout: 60_000 }, () => {
    const board = LOOP_BOARDS.find((candidate) => candidate.id === 'loop-12')!;
    const machine = new LoopMachine(board);
    const slots = () => machine.readTrucks().filter((truck) => truck.queueSlot !== null).map(({ lane, index, queueSlot }) => ({ lane, index, queueSlot }));
    const taps = [...(LOOP_WITNESSES[board.id] ?? '')].map((letter) => letter.charCodeAt(0) - 65);
    const start = slots();
    let beforeTap = start, next = 0, changed = false;
    for (let tick = 0; tick < 60 * 200 && !changed; tick++) {
      machine.step();
      const now = slots();
      changed = now.length < start.length;
      for (const lane of board.lanes.keys()) {
        const line = now.filter((truck) => truck.lane === lane);
        expect(line.map((truck) => truck.queueSlot)).toEqual(line.map((_, slot) => slot));
      }
      const tap = taps[next];
      if (!changed && tap !== undefined && machine.rules.pending === 0 && !machine.rules.canDrain() && tick % 10 === 0) {
        beforeTap = now;
        if (machine.tap(tap).ok) next += 1;
      }
    }
    expect(changed).toBe(true);
    expect(machine.undo()).toBe(true);
    expect(slots()).toEqual(beforeTap);
  });

  it('prints each colour as a whole percentage of the bed, and what is free', () => {
    expect([1, 2, 6, 12, 24].map((units) => sharePercent(units, 24))).toEqual([4, 8, 25, 50, 100]);
    const machine = new LoopMachine(LOOP_1);
    const load = (lane: number, index: number) => machine.loadOf(machine.readTrucks().find((truck) => truck.lane === lane && truck.index === index)!.blocks);
    expect(load(1, 0)).toEqual({ shares: [{ color: 'yellow', percent: 50 }], freePercent: 50 });
    expect(load(1, 1)).toEqual({ shares: [{ color: 'blue', percent: 33 }, { color: 'red', percent: 67 }], freePercent: 0 });
    for (const board of LOOP_BOARDS) {
      const boardMachine = new LoopMachine(board);
      for (const truck of boardMachine.readTrucks()) {
        const { shares, freePercent } = boardMachine.loadOf(truck.blocks);
        expect(shares.map((share) => share.color)).toEqual(truck.blocks.map((block) => block.color));
        // Plain rounding is off by at most half a point a stretch.
        const total = shares.reduce((sum, share) => sum + share.percent, freePercent);
        expect(Math.abs(total - 100)).toBeLessThanOrEqual((shares.length + 1) / 2);
      }
    }
  });

  it('counts a pouring block down and the free room up', () => {
    // The first level starts with an empty loop, so a pour leaves at once.
    const machine = new LoopMachine(LOOP_BOARDS[0]!);
    const load = () => machine.loadOf(machine.readTrucks().find((truck) => truck.lane === 0)!.blocks);
    expect(load()).toEqual({ shares: [{ color: 'red', percent: 33 }, { color: 'blue', percent: 67 }], freePercent: 0 });
    expect(machine.tap(0).ok).toBe(true);
    for (let tick = 0; tick < 12; tick++) machine.step();
    const pouring = load();
    expect(pouring.shares[0]!.percent).toBeLessThan(33);
    expect(pouring.freePercent).toBeGreaterThan(0);
    expect(pouring.shares[1]).toEqual({ color: 'blue', percent: 67 });
  });
});

describe('the rules and the machine tell the same story', () => {
  // Marbles have to meet lanes in the order the rule model takes them, or a rule-correct order can lose in play.
  it('takes marbles along the mouths in lane order on every oval', () => {
    for (const board of LOOP_BOARDS.filter((candidate) => !candidate.trackShape || candidate.trackShape === 'oval')) {
      const machine = new LoopMachine(board);
      const mouths = board.lanes.map((_, lane) => machine.track.nearest(machine.bays[lane]!.x, -machine.track.halfDepth).distance);
      expect(mouths).toEqual([...mouths].sort((a, b) => a - b));
    }
  });

  for (const board of LOOP_BOARDS) {
    it(`${board.id}: following the hint to the end wins`, { timeout: 120_000 }, () => {
      const machine = new LoopMachine(board);
      for (let tick = 0; tick < 60 * 400; tick++) {
        machine.step();
        if (machine.rules.status !== 'playing' && !machine.transferring) break;
        if (machine.rules.pending !== 0 || machine.rules.canDrain() || tick % 10) continue;
        const lane = hintLoop(machine.rules);
        if (lane !== null) machine.tap(lane);
      }
      expect(machine.rules.status).toBe('won');
    });
  }

  for (const [id, order] of Object.entries(LOOP_JAMS)) {
    it(`${id}: the authored losing order really jams in the machine`, { timeout: 120_000 }, () => {
      const machine = play(LOOP_BOARDS.find((board) => board.id === id)!, order);
      expect(machine.rules.status).toBe('jammed');
    });
  }
});
