import { beforeAll, expect, it } from 'vitest';
import { Machine, initPhysics } from '../../src/machine/machine';
import { BOX, MARBLE_RADIUS, dockX } from '../../src/machine/layout';
import { DECK_TOP, MARBLE_RADIUS as LOOP_MARBLE_RADIUS, TRUCK, TUB } from '../../src/loop/layout';
import { LoopMachine } from '../../src/loop/machine';
import type { BoardDef } from '../../src/sim/types';
import type { LoopBoardDef } from '../../src/loop/types';

beforeAll(initPhysics);

it('retains the actual winning box and its three original cargo actors after ordinary boxes have dispatched', () => {
  const board: BoardDef = {
    id: 'final-box', title: '', boxSize: 3, beltCapacity: 14,
    supplies: [[{ color: 'red', count: 6 }]], docks: [['red', 'red']],
  };
  const machine = new Machine(board);
  expect(machine.tap(0).ok).toBe(true);
  let ordinary = 0;
  for (let n = 0; n < 1800; n++) {
    const events = machine.step();
    ordinary += events.filter(e => e.type === 'boxGone' && machine.rules.status === 'playing').length;
    if (machine.rules.status === 'won' && !machine.transferring) break;
  }
  expect(ordinary).toBeGreaterThan(0);
  const boxes = machine.readBoxes().filter(b => b.visible);
  expect(boxes).toHaveLength(1);
  const held = boxes[0]!;
  expect(held).toMatchObject({ retained: true, docked: false, departure: null, fill: 3, y: 0, scale: 1, z: BOX.z });
  const cargo = machine.rules.state.marbles.filter(m => m.dock === held.dock && m.box === held.index);
  expect(cargo).toHaveLength(3);
  for (const marble of cargo) {
    const pose = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
    machine.readMarble(marble.id, pose);
    expect(pose.y).toBeCloseTo(BOX.floorThickness + MARBLE_RADIUS);
    expect(Math.abs(pose.x - dockX(held.dock, board.docks.length))).toBeLessThanOrEqual(BOX.slotSpacing + .001);
    expect(pose.z).toBe(BOX.z);
  }
});

it('receives Loop cargo inside the bed, retains the original full lorry and pays for each finish once', () => {
  const board: LoopBoardDef = {
    id: 'final-truck', title: '', truckCapacity: 3, loopCapacity: 12,
    lanes: [[{ segments: [{ color: 'red', count: 2 }] }], [{ segments: [{ color: 'blue', count: 1 }] }]],
    loop: [{ color: 'red', count: 1 }, { color: 'blue', count: 2 }],
  };
  const machine = new LoopMachine(board);
  const poses = Array.from({ length: machine.marblesPerUnit }, () => ({ x: 0, y: 0, z: 0, roll: 0, visible: false, flight: 0 }));
  let seatedFiles = 0;
  let ordinary = 0;
  let final: string[] = [];
  for (let n = 0; n < 1800; n++) {
    const events = machine.step();
    for (const marble of machine.rules.state.marbles) {
      if (marble.truck === null || marble.lane === null) continue;
      machine.readUnit(marble.id, poses);
      const row = poses.slice(0, 3);
      if (!row.every(p => p.visible && p.flight > .85)) continue;
      const center = machine.bays[marble.lane]!.x;
      const mouth = machine.mouthZ(marble.lane);
      for (const p of row) {
        expect(Math.abs(p.x - center) + LOOP_MARBLE_RADIUS).toBeLessThan(TRUCK.bedWidth / 2 - .08);
        expect(p.y - LOOP_MARBLE_RADIUS).toBeGreaterThanOrEqual(DECK_TOP + TRUCK.bedHeight + TUB.cargo - .001);
        expect(p.z - mouth).toBeGreaterThan(.1);
        expect(p.z - mouth + LOOP_MARBLE_RADIUS).toBeLessThan(machine.bedLength(marble.lane, marble.truck));
      }
      for (let i = 0; i < row.length; i++) {
        const p = row[i]!;
        for (const other of row.slice(i + 1)) {
          expect(Math.hypot(p.x - other.x, p.y - other.y, p.z - other.z)).toBeGreaterThan(2 * LOOP_MARBLE_RADIUS);
        }
      }
      seatedFiles++;
    }
    const completed = events.filter(e => e.type === 'complete');
    if (completed.length) final = completed.map(e => e.lane + ':' + e.truck);
    ordinary += events.filter(e => e.type === 'gone').length;
    if (machine.rules.status === 'won' && !machine.transferring) break;
  }
  expect(seatedFiles).toBeGreaterThan(0);
  expect(ordinary).toBeGreaterThan(0);
  expect(final.length).toBeGreaterThan(0);
  const trucks = machine.readTrucks().filter(t => t.visible);
  expect(trucks.map(t => t.lane + ':' + t.index)).toEqual(final);
  for (const truck of trucks) {
    expect(truck).toMatchObject({ retained: true, departing: false, docked: false, scale: 1, y: DECK_TOP });
    expect(truck.blocks).toEqual([{ color: truck.finalColor, units: truck.capacity, pouring: false }]);
    expect(truck.z).toBe(machine.mouthZ(truck.lane) + truck.bedLength / 2);
  }
  for (let i = 0; i < 80; i++) expect(machine.step().filter(e => e.type === 'complete')).toEqual([]);
});
