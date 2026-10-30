import { it, beforeAll, expect } from 'vitest';
import { Machine, initPhysics, type Pose } from '../../src/machine/machine';
import { BOARD_1, BOARD_2 } from '../../src/sim/boards';

// Docker: MACHINE_PROBE=1 PROBE_BOARD=2 PROBE_ORDER=CABAB PROBE_SEED=977 npx vitest run tests/machine/probe
beforeAll(initPhysics);
it.skipIf(!process.env.MACHINE_PROBE)('diagnose delivery timing and recoveries', { timeout: 300_000 }, () => {
  const board = process.env.PROBE_BOARD === '2' ? BOARD_2 : BOARD_1;
  const order = process.env.PROBE_ORDER ?? 'AAB';
  const machine = new Machine(board);
  let state = Number(process.env.PROBE_SEED ?? 977) >>> 0;
  const random = (): number => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  let next = 0;
  let wait = Math.floor(random() * 60);
  const pose: Pose = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 0 };
  const previous = new Map<number, Pose>();
  try {
    for (let tick = 0; tick < 60 * 120; tick++) {
      for (const event of machine.step()) {
        if (event.type === 'impact') continue;
        console.log((tick / 60).toFixed(2), event, event.type === 'recovered' ? { from: previous.get(event.marbleId), why: machine.lastRecovery } : '');
      }
      if (machine.rules.status !== 'playing') break;
      const tap = order[next];
      if (tap && --wait <= 0) {
        if (machine.tap(tap.charCodeAt(0) - 65).ok) {
          console.log((tick / 60).toFixed(2), 'tap', tap);
          next++;
          wait = Math.floor(random() * 90);
        } else wait = 10;
      }
      for (const id of machine.marbleIds) {
        machine.readMarble(id, pose);
        previous.set(id, { ...pose });
      }
    }
    console.log('result', machine.rules.status, machine.tick / 60, machine.recoveries);
    expect(machine.recoveries.teleports).toBe(0);
  } finally {
    machine.world.free();
  }
});
