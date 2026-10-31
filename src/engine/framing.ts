import * as THREE from 'three';
import type { Point3 } from './physics';

/** Fit projected 3D bounds inside the same HUD-safe viewport for every gameplay. */
export function frameBoard(camera: THREE.PerspectiveCamera, width: number, height: number,
  points: readonly Point3[], direction: THREE.Vector3): void {
  const compact = height < 600 && width > 600;
  const top = compact ? 56 : 64;
  const bottom = compact ? 64 : 92;
  const safeWidth = Math.max(120, width - 28);
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
  let distance = 2;
  for (const p of projected) {
    distance = Math.max(distance,
      p.z - cz + Math.abs(p.x - cx) / tanX * width / safeWidth,
      p.z - cz + Math.abs(p.y - cy) / tanY * height / safeHeight);
  }
  const target = right.multiplyScalar(cx).addScaledVector(up, cy).addScaledVector(forward, cz);
  camera.clearViewOffset();
  camera.position.copy(target).addScaledVector(forward, distance * 1.035);
  camera.lookAt(target);
  camera.setViewOffset(width, height, 0, (bottom - top) / 2, width, height);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld();
}

export function boxCorners(box: THREE.Box3): Point3[] {
  const points: Point3[] = [];
  for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push({ x, y, z });
  return points;
}
