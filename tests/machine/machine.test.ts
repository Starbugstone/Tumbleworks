import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics, Machine } from '../../src/machine/machine';
import { BOARD_1, BOARD_6, BOARDS } from '../../src/sim/boards';
import { RIDE_Y, TRACK } from '../../src/machine/layout';
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
