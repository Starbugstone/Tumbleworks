import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { villagePort } from '../../src/world/village-plan';
import { VillageRollingRun } from '../../src/world/village-rolling';
import { VillageRotor } from '../../src/world/village-motion';
import { verticalLoop } from '../../src/world/villages/author';
import { HIGH_GLASSWORKS } from '../../src/world/villages/high-glassworks';

it('preserves distance, energy and timing when a descending run is subdivided', () => {
  const a = villagePort([0, 2, 0]), b = villagePort([4, 0, 0]), middle = villagePort([1, 1.5, 0]);
  const original = new VillageRollingRun([{ stop: 9, kind: 'contact', points: [a, b] }], 2);
  const split = new VillageRollingRun([{ stop: 9, kind: 'contact', points: [a, middle] },
    { stop: 8, kind: 'connector', points: [middle, b] }], 2);
  expect(split.duration).toBeCloseTo(original.duration, 12);
  const left = new Vector3(), right = new Vector3();
  for (const fraction of [0, .1, .4, .8, 1]) {
    original.sample(original.duration * fraction, left);
    split.sample(split.duration * fraction, right);
    expect(left.distanceTo(right)).toBeLessThan(1e-12);
    expect(.7 * original.speed ** 2 + 9.81 * left.y).toBeCloseTo(.7 * 4 + 9.81 * 2, 10);
  }
});

it('rejects flat departure from rest and an unpowered climb rather than inventing momentum', () => {
  expect(() => new VillageRollingRun([{ stop: 9, kind: 'contact', points: [villagePort([0, 0, 0]), villagePort([2, 0, 0])] }], 0)).toThrow('No physical departure');
  expect(() => new VillageRollingRun([{ stop: 9, kind: 'contact', points: [villagePort([0, 0, 0]), villagePort([2, 4, 0])] }], 1)).toThrow('Insufficient rolling energy');
});

it('rejects an inverted loop with height energy but insufficient contact reaction', () => {
  const points = verticalLoop([0, 0, 0], 4, 0, 144);
  // Crest is reachable, but almost no kinetic energy remains to press into its rail.
  const speed = Math.sqrt(2 * 9.81 * 4 / 1.4 + .1);
  const span = { stop: 4, kind: 'contact' as const, points };
  expect(() => new VillageRollingRun([span], speed)).toThrow(/support|traction/);
  expect(() => new VillageRollingRun([{ ...span, requireSupportReaction: true }], speed)).toThrow(/support|traction/);
  expect(() => new VillageRollingRun([{ ...span, requireSupportReaction: true }], 10)).not.toThrow();
});

it('checks the actual Glassworks loop instead of a guessed circular bypass', () => {
  const mechanism = HIGH_GLASSWORKS.plan.stations.find(station => station.stop === 4)!.mechanism;
  if (mechanism.kind !== 'loop') throw new Error('Glassworks loop missing');
  const span = { stop: 4, kind: 'contact' as const, points: mechanism.points, requireSupportReaction: true };
  const minY = Math.min(...mechanism.points.map(point => point.position[1]));
  const maxY = Math.max(...mechanism.points.map(point => point.position[1]));
  const justReach = Math.sqrt(2 * 9.81 * (maxY - minY) / 1.4 + .1);
  expect(() => new VillageRollingRun([span], justReach)).toThrow(/support|traction/);
  // This is a validator fixture, not a release-energy assignment to the live plan.
  expect(() => new VillageRollingRun([span], 12)).not.toThrow();
});

it('coasts a contact-driven rotor for several turns and stops in finite time', () => {
  const rotor = new VillageRotor({ contact: 2, joules: .1, inertia: .0005, dragTorque: .002 });
  expect(rotor.angle(1)).toBe(0); expect(rotor.speed(1)).toBe(0);
  expect(rotor.turns).toBeGreaterThan(4);
  expect(rotor.angle(rotor.end)).toBeCloseTo(rotor.turns * 2 * Math.PI, 12);
  expect(rotor.speed(rotor.end + 1)).toBe(0);
  expect(rotor.angle(100)).toBe(rotor.angle(rotor.end));
  const saved = rotor.angle(3); rotor.angle(8); rotor.angle(1);
  expect(rotor.angle(3)).toBe(saved);
});
