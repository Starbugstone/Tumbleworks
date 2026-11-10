import * as THREE from 'three';

export interface SurfaceTriangle {
  a: THREE.Vector3;
  b: THREE.Vector3;
  c: THREE.Vector3;
  normal: THREE.Vector3;
  bounds: THREE.Box3;
  mesh: THREE.Mesh;
  index: number;
}
export interface SurfaceOverlap {
  a: SurfaceTriangle;
  b: SurfaceTriangle;
  area: number;
  point: THREE.Vector3;
  polygon: THREE.Vector3[];
}

/** Capture rendered geometry, including baked/batched faces, in world space. */
export function surfaceTriangles(root: THREE.Object3D): SurfaceTriangle[] {
  root.updateWorldMatrix(true, true);
  const result: SurfaceTriangle[] = [];
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const position = object.geometry.getAttribute('position');
    const indices = object.geometry.getIndex();
    const count = indices?.count ?? position.count;
    for (let offset = 0; offset < count; offset += 3) {
      const vertices = [0, 1, 2].map(corner => new THREE.Vector3().fromBufferAttribute(position,
        indices ? indices.getX(offset + corner) : offset + corner).applyMatrix4(object.matrixWorld));
      const a = vertices[0]!, b = vertices[1]!, c = vertices[2]!;
      const normal = b.clone().sub(a).cross(c.clone().sub(a));
      if (normal.lengthSq() < 1e-20) continue;
      result.push({ a, b, c, normal: normal.normalize(), bounds: new THREE.Box3().setFromPoints(vertices), mesh: object, index: offset / 3 });
    }
  });
  return result;
}

/** Same-facing coplanar triangles must share area, not merely an edge or vertex. */
export function coplanarOverlap(a: SurfaceTriangle, b: SurfaceTriangle, tolerance = 1e-5): SurfaceOverlap | undefined {
  if (a.normal.dot(b.normal) < 1 - 1e-8 ||
    a.bounds.max.x + tolerance < b.bounds.min.x || b.bounds.max.x + tolerance < a.bounds.min.x ||
    a.bounds.max.y + tolerance < b.bounds.min.y || b.bounds.max.y + tolerance < a.bounds.min.y ||
    a.bounds.max.z + tolerance < b.bounds.min.z || b.bounds.max.z + tolerance < a.bounds.min.z) return;
  if ([b.a, b.b, b.c].some(point => Math.abs(point.clone().sub(a.a).dot(a.normal)) > tolerance)) return;
  let polygon = [a.a.clone(), a.b.clone(), a.c.clone()];
  const clip = [b.a, b.b, b.c];
  for (let edge = 0; edge < 3 && polygon.length; edge++) {
    const start = clip[edge]!, end = clip[(edge + 1) % 3]!;
    const inward = end.clone().sub(start).cross(b.normal).negate();
    const input = polygon; polygon = [];
    let previous = input.at(-1)!;
    let previousDistance = previous.clone().sub(start).dot(inward);
    for (const point of input) {
      const distance = point.clone().sub(start).dot(inward);
      if ((distance >= 0) !== (previousDistance >= 0)) {
        polygon.push(previous.clone().lerp(point, previousDistance / (previousDistance - distance)));
      }
      if (distance >= 0) polygon.push(point.clone());
      previous = point; previousDistance = distance;
    }
  }
  if (polygon.length < 3) return;
  let area = 0; const point = new THREE.Vector3();
  for (let index = 1; index < polygon.length - 1; index++) {
    const first = polygon[0]!, second = polygon[index]!, third = polygon[index + 1]!;
    const weight = second.clone().sub(first).cross(third.clone().sub(first)).length() / 2;
    area += weight; point.addScaledVector(first.clone().add(second).add(third).multiplyScalar(1 / 3), weight);
  }
  const perimeter = polygon.reduce((length, vertex, index) => length + vertex.distanceTo(polygon[(index + 1) % polygon.length]!), 0);
  // A seam thinner than the coordinate tolerance is float error, even if it has long edges.
  if (area <= tolerance * perimeter / 2) return;
  return { a, b, area, point: point.multiplyScalar(1 / area), polygon };
}

export function surfaceOverlaps(triangles: readonly SurfaceTriangle[], tolerance = 1e-5): SurfaceOverlap[] {
  const ordered = [...triangles].sort((a, b) => a.bounds.min.x - b.bounds.min.x);
  const overlaps: SurfaceOverlap[] = [];
  for (let index = 0; index < ordered.length; index++) {
    const a = ordered[index]!;
    for (let next = index + 1; next < ordered.length; next++) {
      const b = ordered[next]!;
      if (b.bounds.min.x > a.bounds.max.x + tolerance) break;
      const overlap = coplanarOverlap(a, b, tolerance);
      if (overlap) overlaps.push(overlap);
    }
  }
  return overlaps;
}
