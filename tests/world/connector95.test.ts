import { expect, it } from 'vitest';
import { Box3, Mesh, MeshBasicMaterial, Vector3 } from 'three';
import { GLASSHOUSE_GARDENS, gradedCrest } from '../../src/world/villages/glasshouse-gardens';
import { villageChannelGeometry } from '../../src/view/machine-primitives';
import { surfaceTriangles, type SurfaceTriangle } from './surface-overlap';
import { triangleCrossing, trackCrossings, exposedOverlaps } from './village-geometry';
import { ORIGINAL_FOLD, ORIGINAL_INTERIOR_X } from './connector95-before';
const plan = GLASSHOUSE_GARDENS.plan, from = plan.stations.find(s => s.stop === 5)!.exit, to = plan.stations.find(s => s.stop === 4)!.entry, link = plan.connectors.find(c => c.from === 5 && c.to === 4)!;
it('preserves the old native fold while the actual65-ring selected connector is embedded', () => {
  const triangles = ORIGINAL_FOLD.map(vertices => { const [a, b, c] = vertices.map(p => new Vector3(...p)) as [Vector3, Vector3, Vector3]; return { a, b, c, normal: b.clone().sub(a).cross(c.clone().sub(a)).normalize(), bounds: new Box3().setFromPoints([a, b, c]), mesh: new Mesh(), index: -1 } satisfies SurfaceTriangle; });
  expect(triangleCrossing(triangles[0]!, triangles[1]!)).toBe(true);
  const geometry = villageChannelGeometry(link.points, plan.profile), material = new MeshBasicMaterial();
  try { const raw = surfaceTriangles(new Mesh(geometry, material)); expect(geometry.getAttribute('position').count).toBe(780); expect(geometry.index!.count / 3).toBe(1536); expect(trackCrossings(raw, raw)).toEqual([]); expect(exposedOverlaps(raw)).toEqual([]); }
  finally { geometry.dispose(); material.dispose(); }
});
it('uses actual dock objects and retains the exact original interior x evaluation', () => {
  expect(link.points[0]).toBe(from); expect(link.points[64]).toBe(to);
  for (let i = 1; i < 64; i++) expect(Object.is(link.points[i]!.position[0], ORIGINAL_INTERIOR_X[i - 1])).toBe(true);
});
it('rejects off-plane, banked, reversed, invalid and mismatched-width docks without a physics tolerance change', () => {
  const bank = { ...from, normal: [from.normal[0] * Math.sqrt(.99), from.normal[1] * Math.sqrt(.99), .1] as const };
  for (const call of [() => gradedCrest(bank, to, .2), () => gradedCrest(from, { ...to, position: [to.position[0], to.position[1], to.position[2] + .1] }, .2), () => gradedCrest(to, from, .2), () => gradedCrest(from, to, 0), () => gradedCrest(from, to, 1), () => gradedCrest(from, { ...to, width: .9 }, .2)]) expect(call).toThrow(/Graded crest/);
});
