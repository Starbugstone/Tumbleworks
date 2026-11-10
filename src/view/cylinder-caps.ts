import { CylinderGeometry, Vector3 } from 'three';

/** Retriangulate only the flat polygon caps. Side vertices/indices and every
 * attribute stay intact. Called by the renderer after mass integration.
 */
export function compactCylinderCaps(geometry: CylinderGeometry): void {
  const { radialSegments: n, openEnded, thetaLength } = geometry.parameters;
  if (openEnded || thetaLength !== 2 * Math.PI || n < 3 || !geometry.index) return;
  const positions = geometry.getAttribute('position'), uv = geometry.getAttribute('uv'), normals = geometry.getAttribute('normal');
  const before = geometry.index, indices: number[] = [], groups: typeof geometry.groups = [];
  const a = new Vector3(), b = new Vector3(), c = new Vector3(), normal = new Vector3();
  for (const group of geometry.groups) {
    const start = indices.length;
    if (group.materialIndex === 0 || group.count !== n * 3) {
      for (let i = group.start; i < group.start + group.count; i++) indices.push(before.getX(i));
    } else {
      const rim: number[] = [];
      for (let i = group.start; i < group.start + group.count; i += 3) {
        const triangle = [before.getX(i), before.getX(i + 1), before.getX(i + 2)];
        const edge = triangle.filter(vertex => uv.getX(vertex) !== .5 || uv.getY(vertex) !== .5);
        if (edge.length !== 2) throw new Error('Cylinder cap no longer has the declared centre fan');
        rim.push(edge[0]!);
      }
      for (let i = 1; i + 1 < rim.length; i++) {
        const x = rim[0]!, y = rim[i]!, z = rim[i + 1]!;
        a.fromBufferAttribute(positions, x); b.fromBufferAttribute(positions, y).sub(a); c.fromBufferAttribute(positions, z).sub(a);
        normal.fromBufferAttribute(normals, x);
        if (b.cross(c).dot(normal) > 0) indices.push(x, y, z); else indices.push(x, z, y);
      }
    }
    groups.push({ ...group, start, count: indices.length - start });
  }
  geometry.setIndex(indices); geometry.clearGroups();
  for (const group of groups) geometry.addGroup(group.start, group.count, group.materialIndex);
}
