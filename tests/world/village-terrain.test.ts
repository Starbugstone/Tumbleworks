import { MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { compileTerrain, terrainHeightAt, terrainOccupancy, type VillageTerrainSpec } from '../../src/world/village-terrain';
import { createVillageTerrain } from '../../src/view/village-terrain';

const square = [[-4, -4], [4, -4], [4, 4], [-4, 4]] as const;
const spec: VillageTerrainSpec = {
  size: [8, 8], cells: [8, 8], base: 1, water: 0, skirtDepth: 2, outline: square,
  features: [{ kind: 'mound', centre: [-1, -1], radii: [4, 3], height: 3 },
    { kind: 'hole', polygon: [[1, 1], [3, 1], [3, 3], [1, 3]] }],
  palette: { grass: 0x789773, grassAlt: 0x819f7b, rock: 0x777466, shore: 0xb1a077, water: 0x739eaa, cliff: 0x6c7061 },
};

it('queries the actual rendered triangle on both grid diagonals, rather than the ungridded height field', () => {
  const terrain = compileTerrain(spec), material = new MeshBasicMaterial(), mesh = createVillageTerrain(terrain, material);
  const ray = new Raycaster(new Vector3(), new Vector3(0, -1, 0)); mesh.updateMatrixWorld(true);
  try {
    let samples = 0;
    for (let row = 0; row < terrain.rows; row++) for (let column = 0; column < terrain.columns; column++) {
      for (const [u, v] of [[0.2, 0.3], [0.8, 0.7], [0.2, 0.8], [0.8, 0.2]]) {
        const x = terrain.originX + (column + u!) * terrain.cellWidth;
        const z = terrain.originZ + (row + v!) * terrain.cellDepth;
        ray.ray.origin.set(x, 20, z);
        const hit = ray.intersectObject(mesh)[0]?.point.y;
        if (terrainOccupancy(terrain, x, z) === 'land') {
          expect(hit).toBeDefined(); expect(terrainHeightAt(terrain, x, z)).toBeCloseTo(hit!, 6); samples++;
        } else {
          expect(hit).toBeCloseTo(spec.water, 6); expect(terrainHeightAt(terrain, x, z)).toBeUndefined();
        }
      }
    }
    expect(samples).toBeGreaterThan(200);
    for (const [x, z] of [[-5, 0], [0, 5], [NaN, 0]]) {
      expect(terrainHeightAt(terrain, x!, z!)).toBeUndefined(); expect(terrainOccupancy(terrain, x!, z!)).toBe('void');
    }
  } finally { mesh.geometry.dispose(); material.dispose(); }
});

it('keeps the overview coarse while retaining real holes, height and independent geometry ownership', () => {
  const terrain = compileTerrain(spec), material = new MeshBasicMaterial();
  const full = createVillageTerrain(terrain, material), overview = createVillageTerrain(terrain, material, 'overview');
  try {
    expect(full.geometry).not.toBe(overview.geometry);
    expect(overview.geometry.getAttribute('position').count).toBeLessThan(2000);
    expect(overview.geometry.getAttribute('normal').count).toBe(overview.geometry.getAttribute('position').count);
    expect(terrainHeightAt(terrain, 2, 2)).toBeUndefined();
    expect(terrainHeightAt(terrain, -1, -1)).toBeGreaterThan(3);
  } finally { full.geometry.dispose(); overview.geometry.dispose(); material.dispose(); }
});

it.each([0, 1, 2, 3, 4, 5])('faces every chapter %i cliff skirt outward, so the single-sided land never shows the sea through it', async chapter => {
  const { villageScenePlan } = await import('../../src/world/village-plans');
  const terrain = compileTerrain(villageScenePlan(chapter).terrain), material = new MeshBasicMaterial();
  const mesh = createVillageTerrain(terrain, material, 'full', true), p = mesh.geometry.getAttribute('position');
  const rank = { void: 0, water: 1, land: 2 } as const, wrong: number[][] = [];
  let walls = 0;
  for (let i = 0; i < p.count; i += 3) {
    const [a, b, c] = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(p, i + j)) as [Vector3, Vector3, Vector3];
    const n = new Vector3().crossVectors(b.clone().sub(a), c.clone().sub(a)).normalize();
    if (Math.abs(n.y) > 1e-6) continue;
    walls++;
    const centre = a.clone().add(b).add(c).divideScalar(3), step = terrain.cellWidth / 2;
    const front = terrainOccupancy(terrain, centre.x + n.x * step, centre.z + n.z * step), back = terrainOccupancy(terrain, centre.x - n.x * step, centre.z - n.z * step);
    if (rank[front] >= rank[back]) wrong.push([centre.x, centre.z, n.x, n.z].map(v => +v.toFixed(2)));
  }
  expect(walls).toBeGreaterThan(100);
  expect(wrong).toEqual([]);
  mesh.geometry.dispose(); material.dispose();
});
