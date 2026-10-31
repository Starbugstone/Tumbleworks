import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics, Machine } from '../../src/machine/machine';
import { BOARD_1, BOARDS } from '../../src/sim/boards';
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
