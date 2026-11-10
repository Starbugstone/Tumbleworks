import * as THREE from 'three';
import { describe, expect, it, vi } from 'vitest';
import { WorldAssets } from '../../src/view/world-assets';
import { WorldRube } from '../../src/view/world-rube';
import { createRubeSample, RUBE_RADIUS } from '../../src/world/rube-sequence';
import { coplanarOverlap, surfaceOverlaps, surfaceTriangles, type SurfaceOverlap, type SurfaceTriangle } from './surface-overlap';

function rig() {
  const prototype = WorldRube.prototype as unknown as { merge(group: THREE.Group): void };
  // Batching transforms vertices but loses the primitive names needed to diagnose a joint.
  const batching = vi.spyOn(prototype, 'merge').mockImplementation(() => undefined);
  const assets = new WorldAssets(), material = new THREE.MeshBasicMaterial({ vertexColors: true });
  let machine: WorldRube;
  try { machine = new WorldRube(assets.anchors, assets, material); }
  finally { batching.mockRestore(); }
  const scene = new THREE.Scene(); scene.add(...machine.groups);
  return { machine, scene, dispose: () => { machine.dispose(); assets.dispose(); material.dispose(); } };
}

function exposed(overlap: SurfaceOverlap, surfaces: readonly SurfaceTriangle[]): boolean {
  const probes = [overlap.point, ...overlap.polygon.map(vertex => vertex.clone().lerp(overlap.point, 0.05))];
  return probes.some(point => {
    const ray = new THREE.Ray(point.clone().addScaledVector(overlap.a.normal, 0.0001), overlap.a.normal);
    return !surfaces.some(surface => {
      const hit = ray.intersectTriangle(surface.a, surface.b, surface.c, false, new THREE.Vector3());
      return hit !== null && hit.distanceTo(ray.origin) > 0.0001;
    });
  });
}

function source(surface: SurfaceTriangle): string {
  const mesh = surface.mesh;
  return `${mesh.parent?.name || mesh.parent?.parent?.name}/${mesh.name || mesh.geometry.type}@${mesh.position.toArray().map(value => value.toFixed(3)).join(',')}:${surface.index}`;
}

describe('solid lift surfaces', () => {
  it('distinguishes shared edges and opposing joint faces from same-facing overlap', () => {
    const mesh = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([
      0, 0, 0, 1, 0, 0, 0, 1, 0,
      1, 0, 0, 1, 1, 0, 0, 1, 0,
      0, 0, 0, 0, 1, 0, 1, 0, 0,
      0.1, 0.1, 0, 0.8, 0.1, 0, 0.1, 0.8, 0,
    ], 3)), new THREE.MeshBasicMaterial());
    try {
      const triangles = surfaceTriangles(mesh);
      expect(coplanarOverlap(triangles[0]!, triangles[1]!)).toBeUndefined();
      expect(coplanarOverlap(triangles[0]!, triangles[2]!)).toBeUndefined();
      expect(coplanarOverlap(triangles[0]!, triangles[3]!)?.area).toBeCloseTo(0.245, 6);
    } finally { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose(); }
  });

  it.each([false, true])('has no exposed coincident faces on the bucket wheel or catapult (reduced motion %s)', reducedMotion => {
    const { machine, scene, dispose } = rig();
    try {
      const failures: { time: number; a: string; b: string; area: number; point: number[] }[] = [];
      for (const [name, stop, start, end] of [['rube-bucket-wheel', 3, 14.7, 16.3], ['rube-catapult', 5, 10.1, 11.6]] as const) {
        const movingMeshes = new Set<THREE.Mesh>();
        scene.getObjectByName(name)!.traverse(object => { if (object instanceof THREE.Mesh) movingMeshes.add(object); });
        for (let frame = 0; frame <= Math.round((end - start) * 30); frame++) {
          const time = start + frame / 30; machine.apply(time, reducedMotion); scene.updateMatrixWorld(true);
          const surfaces = surfaceTriangles(machine.groups[stop]!);
          for (const overlap of surfaceOverlaps(surfaces)) if ((movingMeshes.has(overlap.a.mesh) || movingMeshes.has(overlap.b.mesh)) && exposed(overlap, surfaces)) {
            failures.push({ time, a: source(overlap.a), b: source(overlap.b), area: overlap.area, point: overlap.point.toArray() });
          }
          // One bad pose is sufficient evidence; still inspect both independent mechanisms.
          if (failures.some(failure => failure.time === time)) break;
        }
      }
      expect(failures.length, JSON.stringify(failures.slice(0, 10), null, 2)).toBe(0);
    } finally { dispose(); }
  });

  it('gives fixed receiving cups and each bucket handoff one exposed floor', () => {
    const { machine, scene, dispose } = rig();
    try {
      const failures: { time: number; a: string; b: string; area: number }[] = [];
      for (const time of [9.56, 11.3, 14.7, 16, 16.3]) {
        machine.apply(time); scene.updateMatrixWorld(true);
        const surfaces = surfaceTriangles(scene);
        const floors = surfaces.filter(surface => surface.mesh.geometry instanceof THREE.CylinderGeometry &&
          surface.mesh.parent?.children.some(child => child instanceof THREE.Mesh && child.geometry instanceof THREE.TorusGeometry) &&
          surface.normal.dot(new THREE.Vector3(0, 1, 0).applyQuaternion(surface.mesh.getWorldQuaternion(new THREE.Quaternion()))) > 0.9999);
        for (const floor of floors) for (const other of surfaces) {
          if (!other.mesh.name.startsWith('rube-track-')) continue;
          const overlap = coplanarOverlap(floor, other);
          if (overlap && exposed(overlap, surfaces)) failures.push({ time, a: source(floor), b: source(other), area: overlap.area });
        }
      }
      const joints = new Map<string, number>();
      failures.forEach(failure => {
        const key = `${failure.a.split(':')[0]} / ${failure.b.split(':')[0]}`;
        joints.set(key, (joints.get(key) ?? 0) + 1);
      });
      expect(failures.length, JSON.stringify([...joints], null, 2)).toBe(0);
    } finally { dispose(); }
  });

  it.each([false, true])('keeps the unchanged marble contact on actual support through lift travel (reduced motion %s)', reducedMotion => {
    const { machine, scene, dispose } = rig();
    const sample = createRubeSample(), ray = new THREE.Raycaster();
    try {
      const failures: number[] = [];
      for (const [start, end] of [[8.45, 9.3], [10.1, 10.6], [11.3, 11.85], [14.4, 16.3]] as const) {
        for (let frame = 0; frame <= Math.round((end - start) * 120); frame++) {
          const time = start + frame / 120;
          machine.apply(time, reducedMotion); machine.route.sample(time, sample); scene.updateMatrixWorld(true);
          if (sample.kind === 'flight') continue;
          ray.set(new THREE.Vector3(sample.x, sample.y, sample.z), new THREE.Vector3(-sample.nx, -sample.ny, -sample.nz));
          ray.near = RUBE_RADIUS - 0.002; ray.far = RUBE_RADIUS + 0.002;
          const hit = ray.intersectObjects([...machine.groups], true)[0];
          if (!hit) failures.push(time);
        }
      }
      expect(failures.length, JSON.stringify(failures.slice(0, 10))).toBe(0);
    } finally { dispose(); }
  });

  it('joins the full usable width to both actual twelve-sided bucket discs', () => {
    const { machine, scene, dispose } = rig();
    try {
      const anchor = machine.route.anchors[3]!;
      for (const time of [14.7, 16]) {
        machine.apply(time); scene.updateMatrixWorld(true);
        const floor = anchor.y + (time === 14.7 ? 0.3 : 2.4);
        for (const across of [-0.319, -0.24, -0.12, 0, 0.12, 0.24, 0.319]) {
          for (let forward = -0.45; forward <= -0.001; forward += 0.005) {
            const ray = new THREE.Raycaster(new THREE.Vector3(anchor.x + forward, floor + 0.1, anchor.z + 0.55 + across), new THREE.Vector3(0, -1, 0), 0.098, 0.102);
            expect(ray.intersectObject(machine.groups[3]!, true).length, `joint ${time}, x=${forward}, across=${across}`).toBeGreaterThan(0);
          }
        }
      }
    } finally { dispose(); }
  });
});
