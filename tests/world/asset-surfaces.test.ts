import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { expect, it } from 'vitest';
import { registerWorldKit, WorldKitAssets } from '../../src/view/world-kit';
import { createProjectReward } from '../../src/view/project-rewards';
import { WorkshopBuilding } from '../../src/view/workshop-building';
import { WORKSHOP_BUILDING } from '../../src/world/workshop-building';
import { exposedOverlaps } from './village-geometry';
import { surfaceTriangles } from './surface-overlap';

function kit() {
  registerWorldKit(readFileSync(process.env.ASSET_KIT_PATH ?? 'assets/world-3d/kit-runtime.json', 'utf8'));
  return new WorldKitAssets();
}
function overlaps(group: THREE.Object3D) {
  return exposedOverlaps(surfaceTriangles(group)).map(({ a, b, area, point }) => ({
    first: `${a.mesh.parent?.name}/${a.mesh.name}/${a.index}`,
    second: `${b.mesh.parent?.name}/${b.mesh.name}/${b.index}`, area, at: point.toArray(),
  }));
}

for (const model of ['house-a', 'house-b', 'tree-a', 'mill', 'clock', 'greenhouse', 'bridge', 'boat', 'glassworks',
  'mechanism-wheel', 'mechanism-seesaw', 'mechanism-channel', 'mechanism-funnel', 'mechanism-gear', 'warehouse', 'willow']) {
  it(`${model}: authored faces do not expose the same surface twice, including same-colour joints`, () => {
    const assets = kit(), material = new THREE.MeshBasicMaterial();
    try { expect(overlaps(assets.model(model, material))).toEqual([]); }
    finally { assets.dispose(); material.dispose(); }
  });
}
for (const reward of ['gantry', 'bells', 'waterwheel', 'cistern', 'gate', 'windmill', 'terrace'] as const) {
  it(`${reward}: the actual earned composition has no exposed coincident faces between parts`, () => {
    const assets = kit(), material = new THREE.MeshBasicMaterial();
    try { expect(overlaps(createProjectReward(reward, assets, material))).toEqual([]); }
    finally { assets.dispose(); material.dispose(); }
  });
}

it('rejects the overlapping hammer boxes and preserves their silhouette as one surface throughout both swings', () => {
  const material = new THREE.MeshBasicMaterial(), building = new WorkshopBuilding(material, { pivot: { x: 0, y: 0, z: 0 }, yaw: 0, scale: 1 });
  const { drop, thickness } = WORKSHOP_BUILDING;
  const broken = new THREE.Group();
  broken.add(new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.25, 0.025).rotateZ(-0.35).translate(-0.015, -drop - 0.025, thickness / 2 + 0.014), material),
    new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.085, 0.025).rotateZ(-0.35).translate(0.025, -drop + 0.095, thickness / 2 + 0.014), material));
  try {
    expect(overlaps(broken).length).toBeGreaterThan(0);
    const cream = new THREE.Color(0xffedca);
    const repaired = surfaceTriangles(building.sign).filter(surface => {
      const geometry = surface.mesh.geometry, colors = geometry.getAttribute('color');
      const vertex = geometry.index?.getX(surface.index * 3) ?? surface.index * 3;
      return Math.abs(colors.getX(vertex) - cream.r) < 1e-6 && Math.abs(colors.getY(vertex) - cream.g) < 1e-6;
    });
    const before = surfaceTriangles(broken);
    // Front/back coverage must be the exact union of the original head and handle.
    const hit = new THREE.Vector3();
    for (const side of [-1, 1]) for (let row = 0; row <= 40; row++) for (let column = 0; column <= 40; column++) {
      const ray = new THREE.Ray(new THREE.Vector3(-0.2 + column * 0.01, -drop - 0.22 + row * 0.01, side), new THREE.Vector3(0, 0, -side));
      const covered = (faces: typeof before) => faces.some(face => ray.intersectTriangle(face.a, face.b, face.c, false, hit) !== null);
      expect(covered(repaired)).toBe(covered(before));
    }
    for (const reduced of [false, true]) for (const seconds of [-0.07, 0, 0.09, 0.14, 0.3, 0.44, 0.6, 0.89]) {
      building.apply(seconds, 0, reduced);
      expect(overlaps(building.sign)).toEqual([]);
      expect(surfaceTriangles(building.sign).length).toBeLessThanOrEqual(120);
    }
    expect(building.sign.name).toBe('workshop-hammer-sign');
  } finally {
    broken.traverse(object => { if (object instanceof THREE.Mesh) object.geometry.dispose(); });
    building.dispose(); material.dispose();
  }
});
