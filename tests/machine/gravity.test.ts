import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it } from 'vitest';
import { PhysicsService } from '../../src/engine/physics';
import { initPhysics, Machine } from '../../src/machine/machine';
import { FUNNEL, MARBLE_RADIUS, RACEWAY } from '../../src/machine/layout';
import { BOARD_2 } from '../../src/sim/boards';

class ObservedPhysics extends PhysicsService {
  readonly bodies: RAPIER.RigidBody[] = [];
  override marble(...args: Parameters<PhysicsService['marble']>): RAPIER.RigidBody {
    const body = super.marble(...args);
    this.bodies.push(body);
    return body;
  }
}

beforeAll(initPhysics);

describe('gravity discharge onto the belt', () => {
  it('admits marbles only after a physical fall reaches the belt floor', () => {
    const observed = new ObservedPhysics();
    const machine = new Machine(BOARD_2, observed);
    const rideY = RACEWAY.floorY + MARBLE_RADIUS;
    const touchedFloor = new Set<number>();
    let floor: RAPIER.Collider | undefined;
    machine.world.forEachCollider((collider) => {
      if (Math.abs(collider.translation().y - (RACEWAY.floorY - 0.25)) < 0.001) floor = collider;
    });
    expect(floor).toBeDefined();
    let admissions = 0;
    try {
      for (const supply of [0, 0, 1, 1, 2]) expect(machine.tap(supply).ok).toBe(true);
      for (let tick = 0; machine.rules.status === 'playing' && tick < 60 * 90; tick++) {
        const before = observed.bodies.map((body, id) => {
          machine.world.contactPair(body.collider(0), floor!, (manifold) => {
            if (manifold.numSolverContacts() > 0) touchedFloor.add(id);
          });
          return { dynamic: body.isDynamic(), y: body.translation().y, status: machine.rules.state.marbles[id]?.status };
        });
        expect(machine.step().some((event) => event.type === 'recovered')).toBe(false);
        machine.rules.state.marbles.forEach((marble) => {
          const previous = before[marble.id]!;
          if (previous.status !== 'pouring' || marble.status !== 'on-belt') return;
          admissions++;
          expect(previous.dynamic, `marble ${marble.id} entered directly from a held pose`).toBe(true);
          expect(previous.y, `marble ${marble.id} entered above the landing surface`).toBeLessThanOrEqual(rideY + 0.08);
          expect(touchedFloor.has(marble.id), `marble ${marble.id} never touched the belt floor`).toBe(true);
        });
      }
      expect(admissions).toBe(30);
      expect(machine.rules.status).toBe('won');
    } finally { machine.world.free(); }
  });

  it('releases an elevated held head through several gravity ticks without admitting a whole held group', () => {
    const observed = new ObservedPhysics();
    const machine = new Machine(BOARD_2, observed);
    const rideY = RACEWAY.floorY + MARBLE_RADIUS;
    const held = new Set<number>();
    const falling = new Map<number, { startY: number; previousY: number; descendingTicks: number }>();
    let discharged = 0;
    let impacts = 0;
    try {
      for (const supply of [0, 0, 1, 1, 2]) expect(machine.tap(supply).ok).toBe(true);
      for (let tick = 0; machine.rules.status === 'playing' && tick < 60 * 90; tick++) {
        const before = observed.bodies.map((body, id) => ({
          dynamic: body.isDynamic(), y: body.translation().y, status: machine.rules.state.marbles[id]?.status,
        }));
        before.forEach((state, id) => {
          if (state.status === 'pouring' && !state.dynamic && state.y < FUNNEL.mouthY && state.y > rideY + 0.5) held.add(id);
        });
        const events = machine.step();
        impacts += events.filter((event) => event.type === 'impact').length;
        expect(events.some((event) => event.type === 'recovered')).toBe(false);
        let releasedThisTick = 0;
        let admittedHeldThisTick = 0;
        observed.bodies.forEach((body, id) => {
          const previous = before[id]!;
          const status = machine.rules.state.marbles[id]?.status;
          const y = body.translation().y;
          if (held.has(id) && !previous.dynamic && body.isDynamic()) {
            releasedThisTick++;
            falling.set(id, { startY: previous.y, previousY: y, descendingTicks: y < previous.y ? 1 : 0 });
          }
          const fall = falling.get(id);
          if (fall && previous.dynamic && status === 'pouring') {
            if (y < fall.previousY - 0.0001) fall.descendingTicks++;
            fall.previousY = y;
          }
          if (previous.status !== 'pouring' || status !== 'on-belt' || !held.has(id)) return;
          admittedHeldThisTick++;
          discharged++;
          expect(fall, `held marble ${id} skipped its physical fall`).toBeDefined();
          expect(fall!.descendingTicks).toBeGreaterThanOrEqual(3);
          expect(previous.y).toBeLessThan(fall!.startY - 0.3);
        });
        expect(releasedThisTick).toBeLessThanOrEqual(1);
        expect(admittedHeldThisTick).toBeLessThanOrEqual(1);
      }
      expect(discharged).toBeGreaterThan(0);
      expect(impacts).toBeGreaterThan(0);
      expect(machine.rules.status).toBe('won');
      expect(machine.recoveries).toEqual({ nudges: 0, teleports: 0 });
    } finally { machine.world.free(); }
  });
});
