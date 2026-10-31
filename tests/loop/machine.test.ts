import { describe, expect, it } from 'vitest';
import { LOOP_1, LOOP_BOARDS } from '../../src/loop/boards';
import { bays, RoundedTrack } from '../../src/loop/layout';
import { LoopMachine, type UnitPose } from '../../src/loop/machine';
import type { LoopBoardDef } from '../../src/loop/types';
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

  it('puts up to three lanes in front and splits more into two rows', () => {
    expect(bays(3).map((bay) => bay.row)).toEqual(['front', 'front', 'front']);
    expect(bays(4).map((bay) => bay.row)).toEqual(['back', 'back', 'front', 'front']);
    expect(bays(5).filter((bay) => bay.row === 'back')).toHaveLength(3);
  });
});

describe('the Loop Sort machine agrees with the rules', () => {
  for (const board of LOOP_BOARDS) {
    it(`${board.id}: the witness wins through the scripted loop within capacity`, { timeout: 120_000 }, () => {
      const machine = play(board, LOOP_WITNESSES[board.id] ?? '');
      expect(machine.rules.status).toBe('won');
      expect(machine.transferring).toBe(false);
      expect(machine.rules.occupancy).toBe(0);
    });
  }

  it('sizes units so a full loop looks full: capacity units close the ring with no visible gap', () => {
    for (const board of LOOP_BOARDS) {
      const machine = new LoopMachine(board);
      expect(machine.unitSpacing * board.loopCapacity).toBeCloseTo(machine.track.length, 6);
      expect(machine.marblesPerUnit % 3).toBe(0);
    }
    const full = LOOP_BOARDS[1]!;
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
    const machine = play(LOOP_BOARDS[1]!, LOOP_JAMS['loop-2'] ?? '');
    expect(machine.rules.status).toBe('jammed');
    expect(machine.rules.occupancy).toBe(LOOP_BOARDS[1]!.loopCapacity);
    expect(machine.transferring).toBe(false);
  });

  it('undo during a pour restores the rules and every unit, and the next tap is accepted at once', () => {
    const machine = new LoopMachine(LOOP_1);
    for (let tick = 0; tick < 60 * 8; tick++) machine.step();
    expect(machine.rules.occupancy).toBe(0);
    const before = JSON.stringify(machine.rules.snapshot());
    expect(machine.tap(1).ok).toBe(true);
    for (let tick = 0; tick < 20; tick++) machine.step();
    expect(machine.rules.occupancy + machine.rules.pending).toBe(8);
    expect(machine.undo()).toBe(true);
    expect(JSON.stringify(machine.rules.snapshot())).toBe(before);
    expect(machine.transferring).toBe(false);
    expect(machine.tap(0).ok).toBe(true);
    expect(machine.tap(1).ok).toBe(true);
  });
});
