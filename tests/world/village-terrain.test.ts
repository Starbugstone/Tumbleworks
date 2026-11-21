import { MeshBasicMaterial, Raycaster, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { compileTerrain, terrainFieldHeight, terrainHeightAt, terrainOccupancy, type VillageTerrainSpec } from '../../src/world/village-terrain';
import { createVillageTerrain } from '../../src/view/village-terrain';
import { bakeVillageShore, villageSea } from '../../src/view/village-sea';
import { villageScenePlan } from '../../src/world/village-plans';

const square = [[-4, -4], [4, -4], [4, 4], [-4, 4]] as const;
const spec: VillageTerrainSpec = {
  size: [8, 8], cells: [8, 8], base: 1, water: 0, skirtDepth: 2, outline: square,
  features: [{ kind: 'mound', centre: [-1, -1], radii: [4, 3], height: 3 },
    { kind: 'hole', polygon: [[1, 1], [3, 1], [3, 3], [1, 3]] }],
  palette: { grass: 0x789773, grassAlt: 0x819f7b, rock: 0x777466, shore: 0xb1a077, water: 0x739eaa, cliff: 0x6c7061 },
};

it('preserves every grid height across overlapping skirts, inlets and building aprons', () => {
  const diamond = [[-1.5, 0], [0, -.75], [1, .25], [.25, 1.5]] as const;
  const authored: VillageTerrainSpec = {
    ...spec, beachWidth: 1.25, cells: [37, 41],
    features: [...spec.features,
      { kind: 'plateau', polygon: diamond, height: 3.3, skirt: .6 },
      { kind: 'cut', polygon: diamond, depth: .49, skirt: 1.2 }],
    buildingPads: [{outline: diamond, height: .8, apron: .4}, {outline: square, height: .4, apron: .35}],
  };
  const actual = compileTerrain(authored);
  const expected = Float32Array.from(actual.heights, (_, i) => {
    const x = actual.originX + (i % (actual.columns + 1)) * actual.cellWidth;
    const z = actual.originZ + Math.floor(i / (actual.columns + 1)) * actual.cellDepth;
    return terrainFieldHeight(authored, x, z);
  });
  expect(actual.heights).toEqual(expected);
});

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

it.each([0, 1, 2, 3, 4, 5])('faces every chapter %i cliff skirt outward, so the single-sided land never shows the sea through it', chapter => {
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

it.each([0, 1, 2, 3, 4, 5])('draws chapter %i rock along each slope contour, never along a cell edge between two slopes', async chapter => {
  const { ROCK_GRADE } = await import('../../src/view/village-terrain');
  const base = compileTerrain(villageScenePlan(chapter).terrain), terrain = { ...base, spec: { ...base.spec, rockContour: true } }, material = new MeshBasicMaterial();
  const mesh = createVillageTerrain(terrain, material, 'full', true), p = mesh.geometry.getAttribute('position'), g = mesh.geometry.getAttribute('grade');
  const byCell = new Map<number, number[]>();
  for (let t = 0; t < p.count / 3; t++) {
    const ys = [0, 1, 2].map(j => p.getY(t * 3 + j)), cx = [0, 1, 2].reduce((s, j) => s + p.getX(t * 3 + j), 0) / 3, cz = [0, 1, 2].reduce((s, j) => s + p.getZ(t * 3 + j), 0) / 3;
    if (Math.abs(ys[0]! - ys[1]!) + Math.abs(ys[1]! - ys[2]!) < 1e-9 && ![0, 1, 2].some(j => g.getX(t * 3 + j))) continue;
    const c = Math.floor((cx - terrain.originX) / terrain.cellWidth), r = Math.floor((cz - terrain.originZ) / terrain.cellDepth), id = r * terrain.columns + c;
    if (terrain.cells[id] !== 'land' || terrain.paint[id]) continue;
    byCell.set(id, [...byCell.get(id) ?? [], t]);
  }
  // The shader's rock decision at a point, from the grade interpolated inside the cell's triangle there.
  const rockAt = (id: number, x: number, z: number) => {
    for (const t of byCell.get(id) ?? []) {
      const [a, b, c] = [0, 1, 2].map(j => [p.getX(t * 3 + j), p.getZ(t * 3 + j), g.getX(t * 3 + j)] as const) as unknown as [readonly number[], readonly number[], readonly number[]];
      const d = (b[1]! - c[1]!) * (a[0]! - c[0]!) + (c[0]! - b[0]!) * (a[1]! - c[1]!), u = ((b[1]! - c[1]!) * (x - c[0]!) + (c[0]! - b[0]!) * (z - c[1]!)) / d, v = ((c[1]! - a[1]!) * (x - c[0]!) + (a[0]! - c[0]!) * (z - c[1]!)) / d;
      if (u >= -1e-9 && v >= -1e-9 && u + v <= 1 + 1e-9) { const grade = u * a[2]! + v * b[2]! + (1 - u - v) * c[2]!; return Math.abs(grade - ROCK_GRADE) < 1e-3 ? undefined : grade >= ROCK_GRADE; }
    }
    return undefined;
  };
  const seams: number[][] = [];let shared = 0;
  for (const id of byCell.keys()) {
    const c = id % terrain.columns, r = Math.floor(id / terrain.columns);
    for (const [dc, dr] of [[1, 0], [0, 1]] as const) {
      const other = (r + dr) * terrain.columns + c + dc; if (!byCell.has(other) || c + dc >= terrain.columns) continue;
      for (const s of [.2, .5, .8]) {
        const x = terrain.originX + (c + (dc ? 1 : s)) * terrain.cellWidth, z = terrain.originZ + (r + (dr ? 1 : s)) * terrain.cellDepth;
        const here = rockAt(id, x, z), there = rockAt(other, x, z); if (here === undefined || there === undefined) continue;
        shared++; if (here !== there) seams.push([x, z].map(v => +v.toFixed(2)));
      }
    }
  }
  if (chapter === 3) expect(shared).toBeGreaterThan(200);
  expect(seams).toEqual([]);
  mesh.geometry.dispose(); material.dispose();
});

it.each([1, 2, 3, 4, 5])('fades chapter %i to open water before every edge of its shore field', chapter => {
  const terrain = compileTerrain(villageScenePlan(chapter).terrain);
  const { field } = bakeVillageShore(terrain.spec.water, terrain, false);
  try {
    const { data, width, height } = field.image;
    if (!(data instanceof Uint8Array)) throw new Error('Expected the baked shore byte field');
    const distance = (x: number, y: number) => data[(y * width + x) * 4];
    for (let x = 0; x < width; x++) {
      expect(distance(x, 0)).toBe(255);
      expect(distance(x, height - 1)).toBe(255);
    }
    for (let y = 0; y < height; y++) {
      expect(distance(0, y)).toBe(255);
      expect(distance(width - 1, y)).toBe(255);
    }
    expect(distance(width / 2, height / 2)).toBeLessThan(255);
  } finally {
    field.dispose();
  }
});

it('fills a low camera ray all the way through its distant visible water', () => {
  const sea = villageSea(0, 0x4d93a3);
  const ray = new Raycaster(new Vector3(0, 2, -7), new Vector3(0, -.0096, 1).normalize(), 0, 220);
  sea.updateMatrixWorld(true);
  try {
    expect(ray.intersectObject(sea)[0]?.point.z).toBeCloseTo(201.33, 2);
  } finally {
    sea.geometry.dispose();
    const materials = Array.isArray(sea.material) ? sea.material : [sea.material];
    materials.forEach(material => material.dispose());
  }
});
