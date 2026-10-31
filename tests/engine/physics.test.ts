import RAPIER from '@dimforge/rapier3d-compat';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { FALLING_GROUPS, FIXED_SECONDS, MarbleDrop, PhysicsService, PLACED_GROUPS } from '../../src/engine/physics';

const physics = new PhysicsService();
beforeAll(() => physics.init());

describe('shared marble physics', () => {
  it('reuses initialization and creates worlds with the same fixed clock and requested gravity', () => {
    expect(physics.init()).toBe(physics.init());
    const world = physics.createWorld(12);
    try {
      expect(FIXED_SECONDS).toBe(1 / 60);
      expect(world.timestep).toBeCloseTo(FIXED_SECONDS, 7);
      expect(world.gravity).toEqual({ x: 0, y: -12, z: 0 });
    } finally { world.free(); }
  });

  it('constructs the requested sphere radius; placed marbles are kinematic and still block falling ones', () => {
    const world = physics.createWorld();
    try {
      const at = { x: 1, y: 4, z: -2 };
      const falling = physics.marble(world, 0.42, at, true, 0.35);
      const placed = physics.marble(world, 0.7, { x: -2, y: 4, z: 1 });
      expect(falling.bodyType()).toBe(RAPIER.RigidBodyType.Dynamic);
      expect(placed.bodyType()).toBe(RAPIER.RigidBodyType.KinematicPositionBased);
      expect(falling.collider(0).radius()).toBeCloseTo(0.42, 6);
      expect(placed.collider(0).radius()).toBeCloseTo(0.7, 6);
      expect(falling.collider(0).restitution()).toBeCloseTo(0.35, 6);
      expect(falling.collider(0).collisionGroups()).toBe(FALLING_GROUPS);
      expect(placed.collider(0).collisionGroups()).toBe(PLACED_GROUPS);
      expect(falling.mass()).toBeCloseTo(1, 5);
      for (let tick = 0; tick < 10; tick += 1) world.step();
      expect(falling.translation().y).toBeLessThan(at.y);
      expect(placed.translation().y).toBeCloseTo(at.y, 6);
      placed.setNextKinematicTranslation({ x: -1, y: 5, z: 2 });
      world.step();
      expect(placed.translation()).toMatchObject({ x: -1, y: 5, z: 2 });
    } finally { world.free(); }
  });

  it.each([0.25, 0.8, 4.2])('a %sm drop really contacts its landing surface and settles without crossing it', (height) => {
    const target = { x: 1.25, y: 2.5, z: -0.75 };
    const drop = new MarbleDrop(physics, target, 0.4, height);
    let contacted = false;
    let ticks = 0;
    try {
      for (; !drop.done && ticks < 120; ticks += 1) {
        const point = drop.step();
        expect(Object.values(point).every(Number.isFinite)).toBe(true);
        expect(point.y).toBeGreaterThanOrEqual(target.y - 0.025);
        drop.world.forEachRigidBody((body) => {
          if (!body.isDynamic()) return;
          expect(body.translation().y).toBeGreaterThanOrEqual(target.y - 0.025);
          drop.world.contactPairsWith(body.collider(0), () => { contacted = true; });
        });
      }
      expect(contacted).toBe(true);
      expect(drop.done).toBe(true);
      expect(ticks).toBeLessThan(120);
      expect(drop.step()).toEqual(target);
      drop.world.forEachRigidBody((body) => {
        if (!body.isDynamic()) return;
        expect(body.translation().y).toBeCloseTo(target.y, 1);
        expect(Math.abs(body.linvel().y)).toBeLessThan(0.4);
      });
    } finally { drop.dispose(); }
  });

  it('releases the world owned by a reusable drop when disposed', () => {
    const drop = new MarbleDrop(physics, { x: 0, y: 1, z: 0 }, 0.4);
    const free = vi.spyOn(drop.world, 'free');
    drop.dispose();
    expect(free).toHaveBeenCalledOnce();
    free.mockRestore();
  });
});
