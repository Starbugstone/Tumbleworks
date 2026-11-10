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
