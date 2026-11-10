import { expect, it } from 'vitest';
import { Triangle, Vector3 } from 'three';
import { villageChannelGeometry } from '../../src/view/machine-primitives';
import { straight, turn } from '../../src/world/villages/author';
import type { VillageProfile } from '../../src/world/village-plan';

it.each<VillageProfile>(['plank','terracotta','timber','twinrail','girder','steel'])('removes only redundant straight extrusion cuts for %s', profile => {
  const frames = straight([0, 4, 0], [3, 3, 1], 16);
  const compact = villageChannelGeometry(frames, profile);
  const reference = frames.slice(1).map((frame, i) => villageChannelGeometry([frames[i]!, frame], profile));
  const triangles = (geometry: typeof compact) => {
    const positions = geometry.getAttribute('position'), index = geometry.getIndex()!;
    return Array.from({ length: index.count / 3 }, (_, i) => new Triangle(
      ...[0,1,2].map(j => new Vector3().fromBufferAttribute(positions, index.getX(i * 3 + j))) as [Vector3,Vector3,Vector3]));
  };
  const before = reference.flatMap(triangles), after = triangles(compact), nearest = new Vector3();
  expect(after.length).toBe(before.length / 16);
  expect(after.reduce((sum, triangle) => sum + triangle.getArea(), 0)).toBeCloseTo(before.reduce((sum, triangle) => sum + triangle.getArea(), 0), 5);
  for (const [source, target] of [[before, after], [after, before]]) for (const triangle of source!) {
    for (const point of [triangle.a, triangle.b, triangle.c, triangle.getMidpoint(new Vector3())]) {
      expect(Math.min(...target!.map(other => other.closestPointToPoint(point, nearest).distanceTo(point)))).toBeLessThan(1e-6);
    }
  }
  compact.dispose(); reference.forEach(geometry => geometry.dispose());
  const curved = turn([0,4,0], 2, 0, Math.PI, -.5, 16), curve = villageChannelGeometry(curved, profile);
  const one = villageChannelGeometry(curved.slice(0,2), profile);
  expect(curve.getIndex()!.count).toBe(one.getIndex()!.count * 16);
  curve.dispose(); one.dispose();
});
