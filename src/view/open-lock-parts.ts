import { ExtrudeGeometry, Shape, Vector2 } from 'three';

/** The tine and its guide use the same nominal end plane. The journal supports
 * the opposite force; the follower supplies a moment without net translation.
 */
export const OPEN_FOLLOWER_HALF = .02;
export function openFollowerGeometry() {
  // Closed-fork x/z outline. Rz(-pi/2) puts its tine under the guide at y=-.075.
  const outline = [[.02, -.81], [.095, -.81], [.095, -.87], [.075, -.87], [.075, -.84], [.02, -.84]];
  const geometry = new ExtrudeGeometry(new Shape(outline.map(([x,z]) => new Vector2(x!,z!))),
    { depth: 2 * OPEN_FOLLOWER_HALF, steps: 1, bevelEnabled: false });
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) p.setXYZ(i, p.getX(i), p.getZ(i) - OPEN_FOLLOWER_HALF, p.getY(i));
  // Swapping the extrusion axes reverses winding.
  const indices: number[] = [];
  for (let i = 0; i < p.count; i += 3) indices.push(i, i + 2, i + 1);
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

export function openGuideGeometry(first: number, last: number) {
  if (!(last - first > OPEN_FOLLOWER_HALF)) throw new Error('Open guide requires a real capture stroke');
  const outline = [[first-.045,-.035],[last+.045,-.035],[last+.045,-.055],
    [last-OPEN_FOLLOWER_HALF,-.055],[last-OPEN_FOLLOWER_HALF,-.075],[first-.045,-.075]];
  return new ExtrudeGeometry(new Shape(outline.map(([x,y]) => new Vector2(x!,y!))),
    { depth: .07, steps: 1, bevelEnabled: false }).translate(0, 0, -.92);
}
