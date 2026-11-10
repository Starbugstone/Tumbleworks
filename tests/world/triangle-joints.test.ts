import { Box3, Mesh, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { trackCrossings } from './village-geometry';
import type { SurfaceTriangle } from './surface-overlap';

function surface(points: readonly [readonly number[], readonly number[], readonly number[]], name: string): SurfaceTriangle {
  const [a, b, c] = points.map(point => new Vector3(point[0], point[1], point[2])) as [Vector3, Vector3, Vector3];
  const mesh = new Mesh(); mesh.name = name;
  return { a, b, c, mesh, index: 0, bounds: new Box3().setFromPoints([a, b, c]), normal: b.clone().sub(a).cross(c.clone().sub(a)).normalize() };
}
const floor = () => surface([[-1, 0, -1], [0, 0, -1], [0, 0, 1]], 'floor');
const wall = (x: number) => surface([[x, -1, -.5], [x, 1, -.5], [x, 0, .5]], 'catch-wall');

it('accepts a perpendicular wall joining the exact floor boundary', () => {
  expect(trackCrossings([floor()], [wall(0)])).toEqual([]);
});

it('rejects the same wall moved through the floor interior', () => {
  expect(trackCrossings([floor()], [wall(-.1)]).length).toBeGreaterThan(0);
});

it('accepts triangles whose plane cuts meet only at a shared endpoint', () => {
  const a = surface([[-1, -1, 0], [0, -1, 0], [0, 1, 0]], 'floor-edge');
  const b = surface([[0, 0, -1], [0, 0, 1], [1, 0, 0]], 'wall-edge');
  expect(trackCrossings([a], [b])).toEqual([]);
});
