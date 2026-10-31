import { beforeAll, describe, expect, it } from 'vitest';
import { initPhysics, Machine, type Pose } from '../../src/machine/machine';
import { BOARD_1, BOARD_2 } from '../../src/sim/boards';

beforeAll(initPhysics);

function poses(machine: Machine): Pose[] {
  return machine.marbleIds.map((id) => {
    const pose: Pose = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
    machine.readMarble(id, pose);
    return pose;
  });
}
function tick(machine: Machine): void {
  const events = machine.step();
  expect(events.some((event) => event.type === 'recovered')).toBe(false);
  expect(machine.rules.occupancy).toBeLessThanOrEqual(machine.board.beltCapacity);
  expect(poses(machine).every((pose) => Object.values(pose).every(Number.isFinite))).toBe(true);
}

describe('physical funnel reservoir', () => {
  it('settles sequential pours through the final box swap before reporting idle', () => {
    const machine = new Machine(BOARD_1);
    try {
      for (const supply of [0, 0, 1]) {
        expect(machine.tap(supply).ok).toBe(true);
        for (let i = 0; i < 60 * 65; i++) {
          const matching = machine.rules.state.marbles.some((marble) => marble.status === 'on-belt' && marble.color === machine.rules.activeColor);
          if (!machine.transferring && !matching) break;
          machine.step();
        }
      }
      expect(machine.rules.status).toBe('won');
      expect(machine.rules.state.waitingForSwap).toBe(false);
    } finally { machine.world.free(); }
  });

  it.each([0, 15, 45])('accepts the full winning burst with %s-tick gaps and drains without recovery', (gap) => {
    const machine = new Machine(BOARD_2);
    let hadBeltWithBacklog = false;
    try {
      for (const supply of [0, 0, 1, 1, 2]) {
        expect(machine.tap(supply).ok).toBe(true);
        for (let i = 0; i < gap; i += 1) tick(machine);
      }
      for (let i = 0; machine.rules.status === 'playing' && i < 60 * 60; i += 1) {
        tick(machine);
        if (machine.rules.occupancy > 0 && machine.rules.funnelCount > 0) hadBeltWithBacklog = true;
      }
      expect(hadBeltWithBacklog).toBe(true);
      expect(machine.rules.status).toBe('won');
      expect(machine.rules.funnelCount).toBe(0);
      expect(machine.recoveries).toEqual({ nudges: 0, teleports: 0 });
    } finally { machine.world.free(); }
  }, 60_000);

  it('starts different supply trays tipping together rather than serializing their pours', () => {
    const machine = new Machine(BOARD_1);
    try {
      expect(machine.tap(0).ok).toBe(true);
      expect(machine.tap(1).ok).toBe(true);
      for (let i = 0; i < 15; i += 1) tick(machine);
      const fronts = machine.readTrays().filter((tray) => tray.key === 0 || tray.key === 12);
      expect(fronts).toHaveLength(2);
      expect(fronts.every((tray) => tray.angle > 0)).toBe(true);
    } finally { machine.world.free(); }
  });

  it('restores complete pending and physical state when undoing a dump during a backlog', () => {
    const machine = new Machine(BOARD_2);
    try {
      for (const supply of [0, 0, 1, 1]) expect(machine.tap(supply).ok).toBe(true);
      for (let i = 0; i < 65; i += 1) tick(machine);
      const before = { rules: machine.rules.snapshot(), poses: poses(machine), trays: machine.readTrays(), tick: machine.tick };
      expect(machine.rules.funnelCount).toBeGreaterThan(0);
      expect(machine.tap(2).ok).toBe(true);
      for (let i = 0; i < 120; i += 1) tick(machine);
      expect(machine.undo()).toBe(true);
      expect(machine.rules.snapshot()).toEqual(before.rules);
      expect(poses(machine)).toEqual(before.poses);
      expect(machine.readTrays()).toEqual(before.trays);
      expect(machine.tick).toBe(before.tick);
      expect(machine.tap(2).ok).toBe(true);
      for (let i = 0; machine.rules.status === 'playing' && i < 60 * 60; i += 1) tick(machine);
      expect(machine.rules.status).toBe('won');
      expect(machine.recoveries).toEqual({ nudges: 0, teleports: 0 });
    } finally { machine.world.free(); }
  }, 60_000);

  it('keeps matching queued marbles in the funnel when a genuinely full belt jams, without rescue', () => {
    const machine = new Machine(BOARD_1);
    try {
      for (const supply of [0, 1, 0]) expect(machine.tap(supply).ok).toBe(true);
      for (let i = 0; i < 60 * 12; i += 1) tick(machine);
      expect(machine.rules.status).toBe('jammed');
      expect(machine.rules.occupancy).toBe(12);
      expect(machine.rules.funnelCount).toBe(6);
      expect(machine.transferring).toBe(false);
      expect(machine.recoveries).toEqual({ nudges: 0, teleports: 0 });
      const belt = machine.beltDistance;
      tick(machine);
      expect(machine.beltDistance).not.toBe(belt);
    } finally { machine.world.free(); }
  }, 60_000);
});
