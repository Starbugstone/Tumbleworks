import { beforeAll, describe, expect, it } from 'vitest';
import { Machine, initPhysics, type Pose } from '../../src/machine/machine';
import { BOARD_1, BOARD_2 } from '../../src/sim/boards';
import type { BoardDef } from '../../src/sim/types';

const TICKS_PER_SECOND = 60;

function prng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Outcome {
  readonly status: string;
  readonly seconds: number;
  readonly nudges: number;
  readonly teleports: number;
}

function marblePoses(machine: Machine): Pose[] {
  return machine.marbleIds.map((id) => {
    const pose = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 0 };
    machine.readMarble(id, pose);
    expect(Object.values(pose).every(Number.isFinite)).toBe(true);
    return pose;
  });
}

function checkpoint(machine: Machine) {
  const handles: { body: number; colliders: number[] }[] = [];
  machine.world.forEachRigidBody((body) => {
    handles.push({ body: body.handle, colliders: Array.from({ length: body.numColliders() }, (_, i) => body.collider(i).handle) });
  });
  return {
    tick: machine.tick,
    rules: machine.rules.snapshot(),
    recoveries: { ...machine.recoveries },
    poses: marblePoses(machine),
    trays: machine.readTrays(),
    boxes: machine.board.boxes.map((_, index) => machine.readBoxX(index)),
    handles,
  };
}

function checkRestored(machine: Machine, saved: ReturnType<typeof checkpoint>): void {
  expect(machine.tick).toBe(saved.tick);
  expect(machine.rules.snapshot()).toEqual(saved.rules);
  expect(machine.recoveries).toEqual(saved.recoveries);
  expect(marblePoses(machine)).toEqual(saved.poses);
  expect(machine.readTrays()).toEqual(saved.trays);
  expect(machine.board.boxes.map((_, index) => machine.readBoxX(index))).toEqual(saved.boxes);
  for (const { body: handle, colliders } of saved.handles) {
    const body = machine.world.getRigidBody(handle);
    expect(body?.isValid()).toBe(true);
    expect(body.numColliders()).toBe(colliders.length);
    for (const [i, collider] of colliders.entries()) {
      expect(body.collider(i).handle).toBe(collider);
      expect(machine.world.getCollider(collider)?.isValid()).toBe(true);
    }
  }
}

/** Plays the taps with real physics. Each tap waits until accepted, at a randomly varied moment. */
function play(board: BoardDef, order: string, seed: number, withUndo: boolean): Outcome {
  const machine = new Machine(board);
  const random = prng(seed);
  const taps = [...order].map((letter) => letter.charCodeAt(0) - 65);
  let next = 0;
  let wait = Math.floor(random() * 60);
  let undone = false;
  let elapsed = 0;
  // Count recovery events even on the speculative branch that undo discards.
  const recoveries = { nudges: 0, teleports: 0 };
  const step = (): void => {
    for (const event of machine.step()) {
      if (event.type === 'recovered') {
        recoveries[event.how === 'nudge' ? 'nudges' : 'teleports']++;
        if (process.env.SOAK_DIAG) console.log(board.id, order, seed, event, machine.lastRecovery);
      }
    }
    elapsed++;
  };
  try {
    for (; elapsed < 120 * TICKS_PER_SECOND;) {
      step();
      if (machine.rules.status !== 'playing') break;
      const tap = taps[next];
      if (tap !== undefined && --wait <= 0) {
        const saved = withUndo && next === 1 && !undone ? checkpoint(machine) : null;
        const result = machine.tap(tap);
        if (result.ok) {
          if (saved) {
            for (let ticks = 5 + Math.floor(random() * 150); ticks > 0; ticks--) step();
            expect(machine.canUndo).toBe(true);
            expect(machine.undo()).toBe(true);
            checkRestored(machine, saved);
            step(); // Uses every tray and marble handle in the restored world.
            marblePoses(machine);
            undone = true;
            wait = 1 + Math.floor(random() * 60);
          } else {
            next++;
            wait = withUndo && next === 1 ? 60 + Math.floor(random() * 120) : Math.floor(random() * 90);
          }
        } else {
          wait = 10;
        }
      }
    }
    if (withUndo) expect(undone).toBe(true);
    return { status: machine.rules.status, seconds: elapsed / TICKS_PER_SECOND, ...recoveries };
  } finally {
    machine.world.free();
  }
}

const WINS_1 = ['AAB'];
const JAMS_1 = ['AB', 'BA'];
const WINS_2 = ['AABBC', 'ABABC', 'BABAC', 'CABAB', 'BBAAC', 'ACBAB'];

beforeAll(initPhysics);

const RUNS = Number(process.env.SOAK_RUNS ?? 8);

function summarise(label: string, outcomes: readonly Outcome[]): void {
  const seconds = outcomes.map((outcome) => outcome.seconds);
  const sum = (key: 'nudges' | 'teleports'): number => outcomes.reduce((total, outcome) => total + outcome[key], 0);
  console.log(
    `${label}: runs=${outcomes.length} seconds min=${Math.min(...seconds).toFixed(1)} max=${Math.max(...seconds).toFixed(1)} nudges=${sum('nudges')} teleports=${sum('teleports')}`,
  );
}

describe('the physical machine agrees with the rules', () => {
  for (const withUndo of [false, true]) {
    for (const [name, board, orders, expected] of [
      ['board 1 wins', BOARD_1, WINS_1, 'won'],
      ['board 1 jams', BOARD_1, JAMS_1, 'jammed'],
      ['board 2 wins', BOARD_2, WINS_2, 'won'],
    ] as const) {
      it(`${name}${withUndo ? ' with undo' : ''}`, { timeout: 600_000 }, () => {
        const outcomes: Outcome[] = [];
        for (const order of orders) {
          for (let seed = 1; seed <= RUNS; seed++) {
            const outcome = play(board, order, seed * 977, withUndo);
            outcomes.push(outcome);
            expect({ order, seed, status: outcome.status }).toEqual({ order, seed, status: expected });
            expect({ order, seed, teleports: outcome.teleports }).toEqual({ order, seed, teleports: 0 });
            expect(outcome.nudges, `${order}, seed ${seed}`).toBeLessThanOrEqual(1);
          }
        }
        summarise(`${name}${withUndo ? ' with undo' : ''}`, outcomes);
        // A single isolated nudge is tolerated, persistent dependence on rescue is not.
        expect(outcomes.reduce((total, outcome) => total + outcome.nudges, 0)).toBeLessThanOrEqual(Math.floor(outcomes.length / 4));
      });
    }
  }
});

it('undo restores captured marbles and a box already moving away', () => {
  const machine = new Machine(BOARD_1);
  const step = (): ReturnType<Machine['step']> => {
    const events = machine.step();
    expect(events.some((event) => event.type === 'recovered')).toBe(false);
    return events;
  };
  try {
    expect(machine.tap(0).ok).toBe(true);
    for (let i = 0; i < 90; i++) step();
    expect(machine.tap(0).ok).toBe(true);
    let full = false;
    for (let i = 0; i < 60 * 60 && !full; i++) {
      full = step().some((event) => event.type === 'boxFull' && event.boxIndex === 1);
    }
    expect(full).toBe(true);
    for (let i = 0; i < 15; i++) step();
    expect(machine.readBoxX(1)).toBeLessThan(0);
    expect(machine.activeBoxForView).toBe(1);
    const saved = checkpoint(machine);
    expect(machine.tap(1).ok).toBe(true);
    const branchTicks = 1 + Math.floor(prng(411)() * 150);
    for (let i = 0; i < branchTicks; i++) step();
    expect(machine.undo()).toBe(true);
    checkRestored(machine, saved);
    step();
    expect(machine.tap(1).ok).toBe(true);
    for (let i = 0; i < 60 * 60 && machine.rules.status === 'playing'; i++) step();
    expect(machine.rules.status).toBe('won');
    expect(machine.recoveries).toEqual({ nudges: 0, teleports: 0 });
    marblePoses(machine);
  } finally {
    machine.world.free();
  }
});
