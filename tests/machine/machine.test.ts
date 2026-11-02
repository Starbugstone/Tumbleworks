import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics, Machine } from '../../src/machine/machine';
import { BOARD_1, BOARD_6, BOARDS } from '../../src/sim/boards';
import { MARBLE_RADIUS, MIN_CAPACITY, RIDE_Y, RIDER_SPACING, TRACK } from '../../src/machine/layout';
import type { BoardDef } from '../../src/sim/types';
import { FUNNEL_JAMS as JAMS, FUNNEL_WITNESSES as WITNESSES } from '../witnesses';

beforeAll(initPhysics);

/** Taps the next tray as soon as the funnel is empty, like a player who never waits for the belt. */
function play(board: BoardDef, order: string, limitSeconds = 150): Machine {
  const machine = new Machine(board);
  const taps = [...order].map((letter) => letter.charCodeAt(0) - 65);
  let next = 0;
  for (let tick = 0; tick < 60 * limitSeconds; tick++) {
    machine.step();
    if (machine.rules.status !== 'playing' && !machine.transferring) break;
    const tap = taps[next];
    if (tap !== undefined && machine.rules.funnelCount === 0 && tick % 10 === 0 && machine.tap(tap).ok) next += 1;
  }
  return machine;
}

describe('the physical machine agrees with the rules', () => {
  it('carries marbles over and under the eight crossing without swapping branches', () => {
    const machine = new Machine(BOARD_6);
    machine.tap(0);
    const heights: number[] = [];
    const pose = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
    for (let tick = 0; tick < 60 * 15; tick++) {
      machine.step();
      for (const marble of machine.rules.state.marbles) {
        if (marble.status !== 'on-belt') continue;
        machine.readMarble(marble.id, pose);
        if (Math.abs(pose.x) < 0.25 && Math.abs(pose.z - TRACK.centerZ) < 0.25) heights.push(pose.y);
      }
    }
    expect(Math.min(...heights)).toBeCloseTo(RIDE_Y, 1);
    expect(Math.max(...heights)).toBeGreaterThan(RIDE_Y + 2);
    expect(heights.every((y) => y < RIDE_Y + 0.2 || y > RIDE_Y + 1.8)).toBe(true);
    expect(machine.recoveries).toEqual({ nudges: 0, teleports: 0, bounces: 0 });
    machine.world.free();
  });
  for (const board of BOARDS) {
    it(`${board.id}: the witness wins through real pours with no rescues`, { timeout: 120_000 }, () => {
      const machine = play(board, WITNESSES[board.id] ?? '');
      expect(machine.rules.status).toBe('won');
      expect(machine.recoveries, machine.lastRecovery).toEqual({ nudges: 0, teleports: 0, bounces: 0 });
      expect(machine.transferring).toBe(false);
      machine.world.free();
    });
  }

  it('admits marbles single file with full spacing and never slides a landing along the belt', { timeout: 60_000 }, () => {
    const machine = new Machine(BOARD_1);
    const pose = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
    const belt = machine.track;
    const entry = belt.point(machine.entryDistance);
    const firstSeen = new Map<number, { tick: number; along: number; belt: number }>();
    let closest = Infinity;
    let worstSlide = 0;
    let farthestLanding = 0;
    for (let tick = 0; tick < 60 * 25; tick++) {
      machine.step();
      if (tick === 0) machine.tap(0);
      if (tick === 12) machine.tap(1);
      if (tick === 24) machine.tap(0);
      const riders: { id: number; along: number }[] = [];
      for (const marble of machine.rules.state.marbles) {
        if (marble.status !== 'on-belt') continue;
        machine.readMarble(marble.id, pose);
        if (Math.abs(pose.y - RIDE_Y) > 0.02) continue;
        const along = belt.nearest(pose.x, pose.z).distance;
        riders.push({ id: marble.id, along });
        const seen = firstSeen.get(marble.id);
        if (!seen) {
          firstSeen.set(marble.id, { tick, along, belt: machine.beltDistance });
          farthestLanding = Math.max(farthestLanding, Math.hypot(pose.x - entry.x, pose.z - entry.z));
        } else if (tick - seen.tick <= 12) {
          // Riding means moving with the belt: any extra travel is a slide along it.
          const travelled = ((along - seen.along) % belt.length + belt.length) % belt.length;
          const carried = ((machine.beltDistance - seen.belt) % belt.length + belt.length) % belt.length;
          const slide = ((travelled - carried) % belt.length + belt.length) % belt.length;
          worstSlide = Math.max(worstSlide, Math.min(slide, belt.length - slide));
        }
      }
      for (let i = 0; i < riders.length; i++) for (let j = i + 1; j < riders.length; j++) {
        const gap = Math.abs(((riders[i]!.along - riders[j]!.along) % belt.length + belt.length * 1.5) % belt.length - belt.length / 2);
        closest = Math.min(closest, gap);
      }
    }
    expect(firstSeen.size).toBeGreaterThanOrEqual(15);
    expect(farthestLanding).toBeLessThan(0.3);
    expect(worstSlide).toBeLessThan(0.2);
    expect(closest).toBeGreaterThanOrEqual(MARBLE_RADIUS * 2);
    expect(machine.recoveries).toEqual({ nudges: 0, teleports: 0, bounces: 0 });
    machine.world.free();
  });

  describe('a full belt is visibly full', () => {
    it('sizes every track so its capacity slots close the loop with marbles nearly touching', () => {
      for (const board of BOARDS) {
        const machine = new Machine(board);
        expect(board.beltCapacity, board.id).toBeGreaterThanOrEqual(MIN_CAPACITY[board.trackShape ?? 'oval']);
        expect(machine.slotPitch, board.id).toBeGreaterThanOrEqual(RIDER_SPACING);
        expect(machine.slotPitch, board.id).toBeLessThan(MARBLE_RADIUS * 2 * 1.12);
        machine.world.free();
      }
    });

    for (const board of BOARDS) {
      it(`${board.id}: a jammed belt holds every slot, evenly spaced and never overlapping`, { timeout: 120_000 }, () => {
        const machine = play(board, JAMS[board.id] ?? '');
        expect(machine.rules.status).toBe('jammed');
        expect(machine.rules.occupancy).toBe(board.beltCapacity);
        const pose = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
        const riders = machine.rules.state.marbles.filter((marble) => marble.status === 'on-belt').map((marble) => {
          machine.readMarble(marble.id, pose);
          return { ...pose };
        });
        for (let i = 0; i < riders.length; i++) for (let j = i + 1; j < riders.length; j++) {
          const a = riders[i]!, b = riders[j]!;
          expect(Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z)).toBeGreaterThan(MARBLE_RADIUS * 2 * 0.97);
        }
        const offsets = machine.riderOffsets().sort((a, b) => a - b);
        expect(offsets).toHaveLength(board.beltCapacity);
        offsets.forEach((offset, index) => expect(offset).toBeCloseTo(index * machine.slotPitch, 6));
        expect(machine.recoveries).toEqual({ nudges: 0, teleports: 0, bounces: 0 });
        machine.world.free();
      });
    }
  });

  it('the authored jam really jams, keeps the overflow in the funnel and is never counted on the belt', { timeout: 60_000 }, () => {
    const machine = play(BOARD_1, JAMS['board-1'] ?? '');
    expect(machine.rules.status).toBe('jammed');
    expect(machine.rules.occupancy).toBe(BOARD_1.beltCapacity);
    expect(machine.rules.funnelCount).toBe(3);
    expect(machine.transferring).toBe(false);
    machine.world.free();
  });

  it('never exceeds belt capacity and stays quick for a brisk player', { timeout: 60_000 }, () => {
    const machine = new Machine(BOARD_1);
    const taps = [0, 0, 1];
    let next = 0;
    let most = 0;
    for (let tick = 0; tick < 60 * 40; tick++) {
      machine.step();
      most = Math.max(most, machine.rules.occupancy);
      if (machine.rules.status === 'won' && !machine.transferring) break;
      const tap = taps[next];
      if (tap !== undefined && tick % 30 === 0 && machine.tap(tap).ok) next += 1;
    }
    expect(machine.rules.status).toBe('won');
    expect(most).toBeLessThanOrEqual(BOARD_1.beltCapacity);
    expect(machine.tick / 60).toBeLessThan(22);
    machine.world.free();
  });

  it('undo during a pour restores the rules, the physics world and the animation control', { timeout: 60_000 }, () => {
    const machine = new Machine(BOARD_1);
    for (let tick = 0; tick < 30; tick++) machine.step();
    const before = JSON.stringify(machine.rules.snapshot());
    machine.tap(0);
    for (let tick = 0; tick < 45; tick++) machine.step();
    expect(machine.rules.occupancy + machine.rules.funnelCount).toBe(9);
    expect(machine.undo()).toBe(true);
    expect(JSON.stringify(machine.rules.snapshot())).toBe(before);
    expect(machine.transferring).toBe(false);
    expect(machine.canUndo).toBe(false);
    for (let tick = 0; tick < 60; tick++) machine.step();
    expect(machine.rules.occupancy).toBe(0);
    expect(machine.recoveries).toEqual({ nudges: 0, teleports: 0, bounces: 0 });
    machine.world.free();
  });
});
