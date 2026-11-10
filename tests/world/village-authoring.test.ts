import { expect, it } from 'vitest';
import { villageArc } from '../../src/view/machine-primitives';
import { turn } from '../../src/world/villages/author';

it('keeps horizontal floors upright and rise correctly signed for either angular handedness', () => {
  for (const z of [-1, 1]) for (const sweep of [-Math.PI, Math.PI]) for (const rise of [-0.6, 0.6]) {
    const points = villageArc([1, 4, 2], 2, 0, sweep, [1, 0, 0], [0, 0, z], rise, 32);
    expect(points.at(-1)!.position[1] - points[0]!.position[1]).toBeCloseTo(rise, 10);
    for (const point of points) {
      expect(point.normal[1]).toBeGreaterThan(0.99);
      expect(point.normal.reduce((sum, value, axis) => sum + value * point.tangent[axis]!, 0)).toBeCloseTo(0, 10);
    }
  }
  const authored = turn([0, 3, 0], 2, 0, Math.PI / 2, -0.6);
  expect(authored[0]!.position).toEqual([2, 3, 0]);
  expect(authored.at(-1)!.position[2]).toBeCloseTo(-2, 10);
  expect(authored.at(-1)!.position[1]).toBeCloseTo(2.4, 10);
  const expectedUp = Math.PI / Math.hypot(Math.PI, 0.6);
  for (const point of authored) expect(point.normal[1]).toBeCloseTo(expectedUp, 10);
});
