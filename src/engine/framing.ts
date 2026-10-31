import * as THREE from 'three';
import type { Point3 } from './physics';

/** Fit projected 3D bounds inside the same HUD-safe viewport for every gameplay. */
export function frameBoard(camera: THREE.PerspectiveCamera, width: number, height: number,
  points: readonly Point3[], direction: THREE.Vector3): void {
  const compact = height < 600 && width > 600;
  const phone = width <= 600;
  const top = compact ? 56 : phone ? 52 : 64;
  const bottom = compact ? 64 : phone ? 80 : 92;
  const safeWidth = Math.max(120, width - (phone ? 12 : 28));
  const safeHeight = Math.max(160, height - top - bottom);
  const forward = direction.clone().normalize();
  const right = new THREE.Vector3().crossVectors(new THREE.Vector3(0, 1, 0), forward).normalize();
  const up = new THREE.Vector3().crossVectors(forward, right);
  const projected = points.map((point) => {
    const v = new THREE.Vector3(point.x, point.y, point.z);
    return { x: v.dot(right), y: v.dot(up), z: v.dot(forward) };
  });
  const mid = (key: 'x' | 'y' | 'z'): number => (Math.min(...projected.map((p) => p[key])) + Math.max(...projected.map((p) => p[key]))) / 2;
  const cx = mid('x'), cy = mid('y'), cz = mid('z');
  camera.aspect = width / height;
  const tanY = Math.tan(THREE.MathUtils.degToRad(camera.fov) / 2);
  const tanX = tanY * camera.aspect;
  // Fit the actual perspective silhouette, then centre it in the playable viewport.
  // Centring world-space bounds leaves a large gap above deep portrait boards.
  const silhouette = (distance: number) => {
    const px = projected.map((p) => (p.x - cx) / ((distance + cz - p.z) * tanX));
    const py = projected.map((p) => (p.y - cy) / ((distance + cz - p.z) * tanY));
    return { left: Math.min(...px), right: Math.max(...px), bottom: Math.min(...py), top: Math.max(...py) };
  };
  let low = Math.max(...projected.map((p) => p.z - cz)) + camera.near + 0.1;
  let high = low + 200;
  for (let i = 0; i < 48; i++) {
    const distance = (low + high) / 2;
    const bounds = silhouette(distance);
    if ((bounds.right - bounds.left) * width / 2 > safeWidth || (bounds.top - bounds.bottom) * height / 2 > safeHeight) low = distance;
    else high = distance;
  }
  const distance = high * (phone ? 1.015 : 1.035);
  const bounds = silhouette(distance);
  const target = right.multiplyScalar(cx).addScaledVector(up, cy).addScaledVector(forward, cz);
  camera.clearViewOffset();
  camera.position.copy(target).addScaledVector(forward, distance);
  camera.lookAt(target);
  camera.setViewOffset(width, height, (bounds.left + bounds.right) * width / 4,
    (bottom - top) / 2 - (bounds.top + bounds.bottom) * height / 4, width, height);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

export function boxCorners(box: THREE.Box3): Point3[] {
  const points: Point3[] = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push({ x, y, z });
  return points;
}
