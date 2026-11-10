import { allocateGuideWrench } from './guide-wrench';
import { Triangle, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { carriageGuideParts } from '../../src/view/carriage-guide-parts';
import { CarriageBrake, assertGuideContacts } from '../../src/world/village-carriage-guide';
import { assertCarryGovernor, solveCarryTiming } from '../../src/world/village-carry';
import { GLASSHOUSE_GARDENS } from '../../src/world/villages/glasshouse-gardens';

it.each([9, 5, 1])('guide %i supplies transverse force and every moment by compressive actual contacts', stop => {
  const station = GLASSHOUSE_GARDENS.plan.stations.find(s => s.stop === stop)!;
  const brake = CarriageBrake.enrol(station, 'terracotta')!, parts = carriageGuideParts(station, 'terracotta')!;
  try {
    const mesh = parts.caliper, p = mesh.getAttribute('position'), index = mesh.index;
    const triangles: Triangle[] = [];
    for (let i = 0; i < (index?.count ?? p.count); i += 3) triangles.push(new Triangle(...[0, 1, 2].map(j =>
      new Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j).applyMatrix4(parts.frame)) as [Vector3, Vector3, Vector3]));
    const t = new Vector3(...brake.tangent), n = new Vector3(...brake.normal), b = new Vector3(...brake.across), point = new Vector3();
    for (const requested of [[0, 0, 0], [1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1], [.31, -.0066, .04]] as const) {
      const force = n.clone().multiplyScalar(.961).addScaledVector(b, -.17);
      const solution = allocateGuideWrench(brake, force.toArray(), requested), sum = new Vector3(), moment = new Vector3();
      for (const reaction of solution.reactions) {
        expect(reaction.magnitude).toBeGreaterThanOrEqual(0);
        const f = new Vector3(...reaction.normal).multiplyScalar(reaction.magnitude), offset = new Vector3(...reaction.offset);
        sum.add(f); moment.add(new Vector3().crossVectors(offset, f));
        const actual = offset.clone().add(parts.origin);
        const distance = Math.min(...triangles.map(triangle => triangle.closestPointToPoint(actual, point).distanceTo(actual)));
        expect(distance, 'load lies on an actual jaw patch').toBeLessThan(1e-6);
      }
      expect(sum.distanceTo(force)).toBeLessThan(64 * Number.EPSILON * Math.max(1, sum.length()));
      expect(moment.distanceTo(new Vector3(...requested))).toBeLessThan(64 * Number.EPSILON * Math.max(1, moment.length()));
      expect(Math.abs(sum.dot(t))).toBeLessThan(64 * Number.EPSILON);
    }
    expect(() => allocateGuideWrench(brake, t.toArray(), [0, 0, 0])).toThrow(/axial/);
    expect(() => allocateGuideWrench(brake, [NaN, 0, 0], [0, 0, 0])).toThrow(/finite/);
  } finally { parts.caliper.dispose(); parts.rail?.dispose(); }
});

it('rejects a separated actual upper jaw and a name-only governor', () => {
  const station = GLASSHOUSE_GARDENS.plan.stations.find(s => s.stop === 9)!;
  const parts = carriageGuideParts(station, 'terracotta')!;
  try {
    const p = parts.caliper.getAttribute('position'), inverse = parts.frame.clone().invert(), point = new Vector3();
    for (let i = 0; i < p.count; i++) {
      point.fromBufferAttribute(p, i).applyMatrix4(parts.frame);
      if (point.clone().sub(parts.origin).dot(parts.normal) > .055) {
        point.addScaledVector(parts.normal, .01).applyMatrix4(inverse); p.setXYZ(i, point.x, point.y, point.z);
      }
    }
    expect(() => assertGuideContacts(9, parts)).toThrow(/guide-contact/);
    const timing = solveCarryTiming(9, .104, [1.4, -.5, 0], 3, 3.096438694214876, .4, 5);
    const fake = { stop: 9, capacity: 5, supports: () => true } as unknown as CarriageBrake;
    expect(() => assertCarryGovernor(9, timing.receipt, fake)).toThrow(/carry-governor/);
    const real = CarriageBrake.enrol(station, 'terracotta')!;
    expect(() => assertCarryGovernor(9, timing.receipt, real)).not.toThrow();
    expect(() => assertCarryGovernor(5, timing.receipt, real)).toThrow(/carry-governor/);
  } finally { parts.caliper.dispose(); parts.rail?.dispose(); }
});
