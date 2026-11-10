import * as THREE from 'three';
import { RUBE_RADIUS } from '../../src/world/rube-sequence';

export interface TrackTriangle { triangle: THREE.Triangle; bounds: THREE.Box3; name: string }
const tolerance = 0.002;

// Finite segment/segment distance, including skew edges whose nearest points are interior.
export function segmentDistanceSquared(p: THREE.Vector3, q: THREE.Vector3, a: THREE.Vector3, b: THREE.Vector3) {
  const d = q.clone().sub(p), e = b.clone().sub(a), r = p.clone().sub(a);
  const dd = d.dot(d), ee = e.dot(e), er = e.dot(r), dr = d.dot(r), de = d.dot(e);
  let u = 0, v = 0;
  if (dd <= 1e-16 && ee <= 1e-16) return p.distanceToSquared(a);
  if (dd <= 1e-16) v = THREE.MathUtils.clamp(er / ee, 0, 1);
  else if (ee <= 1e-16) u = THREE.MathUtils.clamp(-dr / dd, 0, 1);
  else {
    const denominator = dd * ee - de * de;
    u = denominator > 1e-16 ? THREE.MathUtils.clamp((de * er - dr * ee) / denominator, 0, 1) : 0;
    v = (de * u + er) / ee;
    if (v < 0) { v = 0; u = THREE.MathUtils.clamp(-dr / dd, 0, 1); }
    else if (v > 1) { v = 1; u = THREE.MathUtils.clamp((de - dr) / dd, 0, 1); }
  }
  return r.addScaledVector(d, u).addScaledVector(e, -v).lengthSq();
}

export function capsulePenetrations(start: THREE.Vector3, end: THREE.Vector3, surfaces: readonly TrackTriangle[], radius = RUBE_RADIUS) {
  const bounds = new THREE.Box3().setFromPoints([start, end]);
  const direction = end.clone().sub(start), length = direction.length();
  const ray = new THREE.Ray(start, length > 0 ? direction.divideScalar(length) : new THREE.Vector3(1, 0, 0));
  const hit = new THREE.Vector3(), closest = new THREE.Vector3();
  let minimumSquared = radius ** 2, name = '';
  for (const surface of surfaces) {
    // Each triangle's cached bound is already expanded by the sphere radius.
    if (!bounds.intersectsBox(surface.bounds)) continue;
    const triangle = surface.triangle;
    let distanceSquared: number;
    const intersection = length > 0 && ray.intersectTriangle(triangle.a, triangle.b, triangle.c, false, hit);
    if (intersection && hit.distanceToSquared(start) <= length * length) distanceSquared = 0;
    else {
      triangle.closestPointToPoint(start, closest); distanceSquared = start.distanceToSquared(closest);
      triangle.closestPointToPoint(end, closest); distanceSquared = Math.min(distanceSquared, end.distanceToSquared(closest),
        segmentDistanceSquared(start, end, triangle.a, triangle.b), segmentDistanceSquared(start, end, triangle.b, triangle.c),
        segmentDistanceSquared(start, end, triangle.c, triangle.a));
    }
    if (distanceSquared < minimumSquared) { minimumSquared = distanceSquared; name = surface.name; }
  }
  return minimumSquared < (radius - tolerance) ** 2 ? { distance: Math.sqrt(minimumSquared), surface: name } : null;
}

