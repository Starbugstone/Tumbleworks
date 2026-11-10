// Uncompacted per-triangle reference for surface-equivalence regressions.
import * as THREE from 'three';
import {villageChannelGeometry} from '../../../src/view/machine-primitives';
import type {VillagePort,VillageProfile,VillageVec3} from '../../../src/world/village-plan';
const vec=(p:VillageVec3):THREE.Vector3=>new THREE.Vector3(...p);
/** A bearing cap whose roof is clipped from the rendered underside triangles. */
export function villageBearingCap(points: readonly VillagePort[], profile: VillageProfile, frame: VillagePort,
  centre: VillageVec3, halfLength = 0.13, halfWidth = 0.56): THREE.BufferGeometry {
  const source = villageChannelGeometry(points, profile), sourcePositions = source.getAttribute('position'), index = source.getIndex()!;
  const yaw = Math.atan2(-frame.tangent[2], frame.tangent[0]);
  const toLocal = new THREE.Matrix4().makeRotationY(-yaw).multiply(new THREE.Matrix4().makeTranslation(-centre[0], 0, -centre[2]));
  const toWorld = toLocal.clone().invert(), roof: THREE.Vector3[][] = [];
  const up = vec(frame.normal).transformDirection(toLocal);
  const bounds = [[0, -halfLength, 1], [0, halfLength, -1], [2, -halfWidth, 1], [2, halfWidth, -1]] as const;
  for (let i = 0; i < index.count; i += 3) {
    let polygon = [0, 1, 2].map(offset => new THREE.Vector3().fromBufferAttribute(sourcePositions, index.getX(i + offset)).applyMatrix4(toLocal));
    const normal = new THREE.Vector3().subVectors(polygon[1]!, polygon[0]!).cross(new THREE.Vector3().subVectors(polygon[2]!, polygon[0]!)).normalize();
    if (normal.dot(up) > -0.1 || normal.y >= -0.05) continue;
    for (const [axis, limit, sign] of bounds) {
      const clipped: THREE.Vector3[] = [];
      for (let j = 0; j < polygon.length; j++) {
        const a = polygon[j]!, b = polygon[(j + 1) % polygon.length]!;
        const da = (a.getComponent(axis) - limit) * sign, db = (b.getComponent(axis) - limit) * sign;
        if (da >= 0) clipped.push(a);
        if ((da >= 0) !== (db >= 0)) clipped.push(a.clone().lerp(b, da / (da - db)));
      }
      polygon = clipped;
    }
    if (polygon.length >= 3) roof.push(polygon);
  }
  source.dispose();
  if (!roof.length) throw new Error('Bearing cap has no rendered underside contact');
  const bottom = Math.min(...roof.flat().map(p => p.y)) - 0.12;
  const values: number[] = [], edges = new Map<string, { a: THREE.Vector3; b: THREE.Vector3; count: number }>();
  const key = (p: THREE.Vector3): string => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`;
  const face = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): void => {
    for (const p of [a, b, c]) values.push(...p.clone().applyMatrix4(toWorld).toArray());
  };
  const foot = (p: THREE.Vector3): THREE.Vector3 => new THREE.Vector3(p.x, bottom, p.z);
  for (const polygon of roof) {
    for (let i = 1; i < polygon.length - 1; i++) {
      face(polygon[0]!, polygon[i + 1]!, polygon[i]!);
      face(foot(polygon[0]!), foot(polygon[i]!), foot(polygon[i + 1]!));
    }
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
      const id = [key(a), key(b)].sort().join('/'), existing = edges.get(id);
      if (existing) existing.count++; else edges.set(id, { a, b, count: 1 });
    }
  }
  for (const { a, b, count } of edges.values()) if (count === 1) {
    face(a, b, foot(a)); face(b, foot(b), foot(a));
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3)); geometry.computeVertexNormals(); geometry.computeBoundingBox();
  return geometry;
}
