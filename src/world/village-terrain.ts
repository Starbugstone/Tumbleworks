/**
 * Procedural village ground. A plan describes its landform with a few compact
 * fields (footprint outline, plateaus, ramps, mounds, cuts, holes, paint);
 * `compileTerrain` evaluates them once on a regular grid, and both the rendered
 * mesh (`src/view/village-terrain.ts`) and `terrainHeightAt` read that same
 * grid with the same diagonal rule, so a support rests on exactly the surface
 * that is drawn. Coordinates are world x/z; y is up.
 */
export type TerrainVec2 = readonly [number, number];

export interface TerrainPalette {
  readonly grass: number;
  readonly grassAlt: number;
  readonly rock: number;
  readonly shore: number;
  readonly water: number;
  readonly cliff: number;
}

export type TerrainFeature =
  /** Raise the ground to at least `height` inside the polygon, sloping back down over `skirt` outside it. */
  | { readonly kind: 'plateau'; readonly polygon: readonly TerrainVec2[]; readonly height: number; readonly skirt?: number }
  /** Raise the ground inside the polygon to a height interpolated along the line from `from` to `to`. */
  | { readonly kind: 'ramp'; readonly polygon: readonly TerrainVec2[]; readonly from: TerrainVec2; readonly to: TerrainVec2; readonly heights: TerrainVec2 }
  /** Add a smooth elliptical bump (negative height hollows the ground). */
  | { readonly kind: 'mound'; readonly centre: TerrainVec2; readonly radii: TerrainVec2; readonly height: number }
  /** Lower the ground to at most `depth` inside the polygon, blending over `skirt` outside it. */
  | { readonly kind: 'cut'; readonly polygon: readonly TerrainVec2[]; readonly depth: number; readonly skirt?: number }
  /** Remove the land in the polygon; water at the spec's level shows through. */
  | { readonly kind: 'hole'; readonly polygon: readonly TerrainVec2[] }
  /** Paint the faces whose cell centre lies inside the polygon. */
  | { readonly kind: 'paint'; readonly polygon: readonly TerrainVec2[]; readonly color: number };

export interface VillageTerrainSpec {
  /** Render-only exact same-row flat rectangle union; physics grid stays literal. */
  readonly mergeFlatLand?: boolean;
  /** FULL-detail only: exact painted rectangles, all boundary nodes retained. */
  readonly mergePaintedFlatLand?: boolean;
  /** Grid extent in world units, centred on the origin: width along x, depth along z. */
  readonly size: TerrainVec2;
  /** Full-detail grid subdivision: columns along x, rows along z. */
  readonly cells: TerrainVec2;
  /** Ground height before any feature. */
  readonly base: number;
  /** Water surface height inside holes; must sit below the land around them. */
  readonly water: number;
  /** How far the cliff skirt drops below the land edge. */
  readonly skirtDepth: number;
  /** Landmass footprint; cells whose centre lies outside are void. */
  readonly outline: readonly TerrainVec2[];
  readonly features: readonly TerrainFeature[];
  readonly palette: TerrainPalette;
}

export type TerrainCell = 'void' | 'land' | 'water';

export interface VillageTerrain {
  readonly spec: VillageTerrainSpec;
  readonly columns: number;
  readonly rows: number;
  /** World x of column 0 and world z of row 0. */
  readonly originX: number;
  readonly originZ: number;
  readonly cellWidth: number;
  readonly cellDepth: number;
  /** Vertex heights, row-major, (columns + 1) × (rows + 1). */
  readonly heights: Float32Array;
  /** One entry per cell, row-major. */
  readonly cells: readonly TerrainCell[];
  /** Per-cell paint override (0 for none), row-major. */
  readonly paint: Uint32Array;
}

export function pointInPolygon(polygon: readonly TerrainVec2[], x: number, z: number): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, zi] = polygon[i]!; const [xj, zj] = polygon[j]!;
    if ((zi > z) !== (zj > z) && x < xi + (xj - xi) * (z - zi) / (zj - zi)) inside = !inside;
  }
  return inside;
}

export function distanceToPolygon(polygon: readonly TerrainVec2[], x: number, z: number): number {
  let best = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [ax, az] = polygon[i]!; const [bx, bz] = polygon[j]!;
    const dx = bx - ax, dz = bz - az, length = dx * dx + dz * dz;
    const t = length > 0 ? Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / length)) : 0;
    best = Math.min(best, Math.hypot(x - ax - dx * t, z - az - dz * t));
  }
  return best;
}

const smooth = (t: number): number => { const u = Math.max(0, Math.min(1, t)); return u * u * (3 - 2 * u); };

/** Pure evaluation of the authored height field at a world point, before gridding. */
export function terrainFieldHeight(spec: VillageTerrainSpec, x: number, z: number): number {
  let height = spec.base;
  for (const feature of spec.features) {
    switch (feature.kind) {
      case 'plateau': {
        const inside = pointInPolygon(feature.polygon, x, z);
        const skirt = feature.skirt ?? 0;
        if (inside) height = Math.max(height, feature.height);
        else if (skirt > 0) {
          const distance = distanceToPolygon(feature.polygon, x, z);
          if (distance < skirt) height = Math.max(height, height + (feature.height - height) * (1 - smooth(distance / skirt)));
        }
        break;
      }
      case 'ramp': {
        if (!pointInPolygon(feature.polygon, x, z)) break;
        const dx = feature.to[0] - feature.from[0], dz = feature.to[1] - feature.from[1];
        const length = dx * dx + dz * dz;
        const t = length > 0 ? Math.max(0, Math.min(1, ((x - feature.from[0]) * dx + (z - feature.from[1]) * dz) / length)) : 0;
        height = Math.max(height, feature.heights[0] + (feature.heights[1] - feature.heights[0]) * t);
        break;
      }
      case 'mound': {
        const nx = (x - feature.centre[0]) / feature.radii[0], nz = (z - feature.centre[1]) / feature.radii[1];
        const d = Math.sqrt(nx * nx + nz * nz);
        if (d < 1) { const w = Math.cos(d * Math.PI / 2); height += feature.height * w * w; }
        break;
      }
      case 'cut': {
        const inside = pointInPolygon(feature.polygon, x, z);
        const skirt = feature.skirt ?? 0;
        if (inside) height = Math.min(height, feature.depth);
        else if (skirt > 0) {
          const distance = distanceToPolygon(feature.polygon, x, z);
          if (distance < skirt) height = Math.min(height, height + (feature.depth - height) * (1 - smooth(distance / skirt)));
        }
        break;
      }
      case 'hole': case 'paint': break;
    }
  }
  return height;
}

function classify(spec: VillageTerrainSpec, x: number, z: number): TerrainCell {
  if (!pointInPolygon(spec.outline, x, z)) return 'void';
  for (const feature of spec.features) if (feature.kind === 'hole' && pointInPolygon(feature.polygon, x, z)) return 'water';
  return 'land';
}

function validate(spec: VillageTerrainSpec, cells: TerrainVec2): void {
  const finite = (...values: number[]): boolean => values.every(value => Number.isFinite(value));
  if (!finite(spec.size[0], spec.size[1], spec.base, spec.water, spec.skirtDepth) || spec.size[0] <= 0 || spec.size[1] <= 0) throw new Error('Terrain size and levels must be finite and positive');
  if (!Number.isInteger(cells[0]) || !Number.isInteger(cells[1]) || cells[0] < 1 || cells[1] < 1) throw new Error('Terrain grid needs whole positive cell counts');
  if (spec.outline.length < 3) throw new Error('Terrain outline needs at least three points');
  if (spec.skirtDepth <= 0) throw new Error('Terrain skirt depth must be positive');
  for (const feature of spec.features) {
    if ('polygon' in feature && feature.polygon.length < 3) throw new Error(`Terrain ${feature.kind} needs a polygon`);
    if (feature.kind === 'mound' && (feature.radii[0] <= 0 || feature.radii[1] <= 0)) throw new Error('Terrain mound radii must be positive');
  }
}

/** Grid the field once. `cells` overrides the spec's subdivision (the overview samples 8 × 8). */
export function compileTerrain(spec: VillageTerrainSpec, cells: TerrainVec2 = spec.cells): VillageTerrain {
  validate(spec, cells);
  const [columns, rows] = cells;
  const cellWidth = spec.size[0] / columns, cellDepth = spec.size[1] / rows;
  const originX = -spec.size[0] / 2, originZ = -spec.size[1] / 2;
  const heights = new Float32Array((columns + 1) * (rows + 1));
  for (let row = 0; row <= rows; row++) for (let column = 0; column <= columns; column++) {
    heights[row * (columns + 1) + column] = terrainFieldHeight(spec, originX + column * cellWidth, originZ + row * cellDepth);
  }
  const kinds: TerrainCell[] = []; const paint = new Uint32Array(columns * rows);
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const x = originX + (column + 0.5) * cellWidth, z = originZ + (row + 0.5) * cellDepth;
    const kind = classify(spec, x, z); kinds.push(kind);
    if (kind === 'land') for (const feature of spec.features) if (feature.kind === 'paint' && pointInPolygon(feature.polygon, x, z)) paint[row * columns + column] = feature.color;
    if (kind === 'water') for (let dz = 0; dz <= 1; dz++) for (let dx = 0; dx <= 1; dx++) {
      if (heights[(row + dz) * (columns + 1) + column + dx]! <= spec.water) throw new Error(`Terrain water at (${x.toFixed(1)}, ${z.toFixed(1)}) is not below its banks`);
    }
  }
  return { spec, columns, rows, originX, originZ, cellWidth, cellDepth, heights, cells: kinds, paint };
}

/** Cells alternate their diagonal so the surface has no directional grain. */
export function cellDiagonal(column: number, row: number): 'main' | 'anti' { return (column + row) % 2 === 0 ? 'main' : 'anti'; }

export function terrainCellAt(terrain: VillageTerrain, x: number, z: number): { column: number; row: number } | undefined {
  const fx = (x - terrain.originX) / terrain.cellWidth, fz = (z - terrain.originZ) / terrain.cellDepth;
  if (!Number.isFinite(fx) || !Number.isFinite(fz) || fx < 0 || fz < 0 || fx >= terrain.columns || fz >= terrain.rows) return undefined;
  return { column: Math.floor(fx), row: Math.floor(fz) };
}

export function terrainOccupancy(terrain: VillageTerrain, x: number, z: number): TerrainCell {
  const cell = terrainCellAt(terrain, x, z);
  return cell ? terrain.cells[cell.row * terrain.columns + cell.column]! : 'void';
}

/**
 * Height of the drawn land surface, or undefined over water and off the landmass.
 * Interpolates the exact triangle the mesh draws for that point.
 */
export function terrainHeightAt(terrain: VillageTerrain, x: number, z: number): number | undefined {
  const cell = terrainCellAt(terrain, x, z);
  if (!cell || terrain.cells[cell.row * terrain.columns + cell.column] !== 'land') return undefined;
  const { column, row } = cell; const stride = terrain.columns + 1;
  const h00 = terrain.heights[row * stride + column]!, h10 = terrain.heights[row * stride + column + 1]!;
  const h01 = terrain.heights[(row + 1) * stride + column]!, h11 = terrain.heights[(row + 1) * stride + column + 1]!;
  const u = (x - terrain.originX) / terrain.cellWidth - column, v = (z - terrain.originZ) / terrain.cellDepth - row;
  if (cellDiagonal(column, row) === 'main') {
    // Triangles (00, 10, 11) and (00, 11, 01), split along the 00→11 diagonal.
    return u >= v ? h00 + (h10 - h00) * u + (h11 - h10) * v : h00 + (h11 - h01) * u + (h01 - h00) * v;
  }
  // Triangles (00, 10, 01) and (10, 11, 01), split along the 10→01 diagonal.
  return u + v <= 1 ? h00 + (h10 - h00) * u + (h01 - h00) * v : h11 + (h01 - h11) * (1 - u) + (h10 - h11) * (1 - v);
}

/** World position of a grid vertex; the mesh builder and tests share it. */
export function terrainVertex(terrain: VillageTerrain, column: number, row: number): [number, number, number] {
  return [terrain.originX + column * terrain.cellWidth, terrain.heights[row * (terrain.columns + 1) + column]!, terrain.originZ + row * terrain.cellDepth];
}
