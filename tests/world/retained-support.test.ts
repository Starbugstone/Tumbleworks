import { Box3, BoxGeometry, Mesh, Ray, Vector3, type BufferGeometry } from 'three';
import { expect, it } from 'vitest';
import { postBraceGeometry, slotLegGeometry } from '../../src/view/retained-support';
import { surfaceTriangles } from './surface-overlap';

function checkUnion(geometry: BufferGeometry, originals: readonly BufferGeometry[]) {
  const boxes = originals.map(g => { g.computeBoundingBox(); return g.boundingBox!.clone(); });
  const bounds = boxes.reduce((b, box) => b.union(box), new Box3()), centre = bounds.getCenter(new Vector3());
  // Primitive construction and the union each pack coordinates to Float32.
  // Only cells narrower than that storage uncertainty are indeterminate;
  // nominal faces and every wider cell still have to match in both directions.
  const magnitude = Math.max(1, ...bounds.min.toArray().map(Math.abs), ...bounds.max.toArray().map(Math.abs));
  const storageBand = 4 * 2 ** -24 * magnitude;
  const actual = surfaceTriangles(new Mesh(geometry)), hit = new Vector3(), ray = new Ray();
  for (const axis of [0, 1, 2] as const) {
    const others = [0, 1, 2].filter(a => a !== axis) as (0 | 1 | 2)[];
    const cuts = others.map(a => {
      const values = [...new Set(boxes.flatMap(box => [box.min.getComponent(a), box.max.getComponent(a)]))].sort((a, b) => a - b);
      return [...values.slice(1).flatMap((v, i) => v - values[i]! > storageBand ? [(v + values[i]!) / 2] : []), bounds.min.getComponent(a) - .01, bounds.max.getComponent(a) + .01];
    });
    for (const a of cuts[0]!) for (const b of cuts[1]!) for (const sign of [-1, 1]) {
      const origin = centre.clone().setComponent(others[0]!, a).setComponent(others[1]!, b)
        .setComponent(axis, sign < 0 ? bounds.max.getComponent(axis) + 1 : bounds.min.getComponent(axis) - 1);
      const direction = new Vector3().setComponent(axis, sign); ray.set(origin, direction);
      let expected = Infinity, distance = Infinity, normal: Vector3 | undefined;
      for (const box of boxes) if (ray.intersectBox(box, hit)) expected = Math.min(expected, hit.distanceTo(origin));
      for (const triangle of actual) if (ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, hit)) {
        const d = hit.distanceTo(origin); if (d < distance) { distance = d; normal = triangle.normal; }
      }
      if (expected === Infinity) expect(distance).toBe(Infinity);
      else { expect(Math.abs(expected - distance), JSON.stringify({ origin: origin.toArray(), direction: direction.toArray(), expected, distance })).toBeLessThan(1e-6); expect(normal!.dot(direction)).toBeLessThan(-.99999); }
    }
  }
  const signedVolume = (g: BufferGeometry) => {
    const p = g.getAttribute('position'), index = g.index, a = new Vector3(), b = new Vector3(), c = new Vector3(); let v = 0;
    for (let i = 0; i < (index?.count ?? p.count); i += 3) {
      a.fromBufferAttribute(p, index ? index.getX(i) : i); b.fromBufferAttribute(p, index ? index.getX(i + 1) : i + 1); c.fromBufferAttribute(p, index ? index.getX(i + 2) : i + 2);
      v += a.dot(b.cross(c)) / 6;
    } return v;
  };
  expect(signedVolume(geometry)).toBeCloseTo(originals.reduce((v, g) => v + signedVolume(g), 0), 7);
}
it.each([[-.2, -1], [.75, 1]])('slot union preserves boundary, outward normals and volume at %s', (last, side) => {
  const geometry = slotLegGeometry(last!, side!);
  const original = [new BoxGeometry(.02, .68, .04).translate(last! + .045, .305, side! * .9),
    new BoxGeometry(.02, .59, .04).translate(last! - .045, .35, side! * .9), new BoxGeometry(.11, .02, .04).translate(last!, .655, side! * .9)];
  try { checkUnion(geometry, original); } finally { geometry.dispose(); original.forEach(g => g.dispose()); }
});
it('post/brace union preserves the flat-foot boundary and refuses a nonplanar foot', () => {
  const geometry = postBraceGeometry(0, .6, 0, .12, () => 2, () => 0)!;
  const original = [new BoxGeometry(.12, 1.9, .12).translate(0, .95, 0), new BoxGeometry(.12, .1, .72).translate(0, 1.95, .3)];
  try {
    checkUnion(geometry, original);
    const changed = geometry.clone().translate(.001, 0, 0);
    try { expect(() => checkUnion(changed, original)).toThrow(); } finally { changed.dispose(); }
    expect(postBraceGeometry(0, .6, 0, .12, () => 2, (x, z) => x * z)).toBeUndefined();
    expect(postBraceGeometry(0, .6, 0, .12, () => 2, () => undefined)).toBeUndefined();
  } finally { geometry.dispose(); original.forEach(g => g.dispose()); }
});
