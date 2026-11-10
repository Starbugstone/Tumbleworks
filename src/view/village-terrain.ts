import * as THREE from 'three';
import{mergePaintedFlatLand}from'./village-painted-land';
import{mergeFlatLand,type LandFace}from'./village-flat-land';
import { cellDiagonal, compileTerrain, type VillageTerrain, type VillageTerrainSpec } from '../world/village-terrain';

export type VillageTerrainDetail = 'full' | 'overview';
/** The wider-world miniature samples every landform on the same coarse grid. */
export const OVERVIEW_CELLS = [8, 8] as const;

interface Sink { positions: number[]; colors: number[] }
const scratch = new THREE.Color();
function face(sink: Sink, color: number, ...points: readonly (readonly [number, number, number])[]): void {
  scratch.setHex(color);
  for (const point of points) { sink.positions.push(point[0], point[1], point[2]); sink.colors.push(scratch.r, scratch.g, scratch.b); }
}

function faceColor(terrain: VillageTerrain, column: number, row: number, corners: readonly number[]): number {
  const { palette, water } = terrain.spec;
  const painted = terrain.paint[row * terrain.columns + column]!;
  if (painted) return painted;
  const rise = Math.max(...corners) - Math.min(...corners);
  if (rise / Math.min(terrain.cellWidth, terrain.cellDepth) > 0.75) return palette.rock;
  const mean = corners.reduce((sum, value) => sum + value, 0) / corners.length;
  if (mean < water + 0.45) return palette.shore;
  return (column * 7 + row * 13) % 5 === 0 ? palette.grassAlt : palette.grass;
}

/**
 * One flat-shaded geometry per landform: land triangles following `cellDiagonal`,
 * water sheets in holes, and cliff skirts wherever land or water meets the void.
 */
export function villageTerrainGeometry(source: VillageTerrain | VillageTerrainSpec, detail: VillageTerrainDetail = 'full'): THREE.BufferGeometry {
  const spec = 'spec' in source ? source.spec : source;
  const terrain = detail === 'overview' ? compileTerrain(spec, OVERVIEW_CELLS) : 'spec' in source ? source : compileTerrain(spec);
  const { columns, rows, originX, originZ, cellWidth, cellDepth, heights } = terrain;
  const stride = columns + 1;
  const sink: Sink = { positions: [], colors: [] };
  const landFaces:LandFace[]=[];
  const vertex = (column: number, row: number, y = heights[row * stride + column]!): [number, number, number] =>
    [originX + column * cellWidth, y, originZ + row * cellDepth];
  const kind = (column: number, row: number) => column < 0 || row < 0 || column >= columns || row >= rows ? 'void' : terrain.cells[row * columns + column]!;
  const skirtBottom = spec.base - spec.skirtDepth;
  for (let row = 0; row < rows; row++) for (let column = 0; column < columns; column++) {
    const cell = kind(column, row);
    if (cell === 'void') continue;
    const corners = [heights[row * stride + column]!, heights[row * stride + column + 1]!, heights[(row + 1) * stride + column + 1]!, heights[(row + 1) * stride + column]!];
    if (cell === 'land') {
      landFaces.push({row,column,start:sink.positions.length/3});
      const color = faceColor(terrain, column, row, corners);
      const v00 = vertex(column, row), v10 = vertex(column + 1, row), v01 = vertex(column, row + 1), v11 = vertex(column + 1, row + 1);
      if (cellDiagonal(column, row) === 'main') { face(sink, color, v00, v11, v10); face(sink, color, v00, v01, v11); }
      else { face(sink, color, v00, v01, v10); face(sink, color, v10, v01, v11); }
    } else {
      const w = spec.water;
      face(sink, spec.palette.water, vertex(column, row, w), vertex(column + 1, row + 1, w), vertex(column + 1, row, w));
      face(sink, spec.palette.water, vertex(column, row, w), vertex(column, row + 1, w), vertex(column + 1, row + 1, w));
    }
    // Skirts: each side whose neighbour is lower ground kind (land → water/void, water → void).
    const sides: readonly { neighbour: 'void' | 'land' | 'water'; a: [number, number]; b: [number, number] }[] = [
      { neighbour: kind(column, row - 1), a: [column + 1, row], b: [column, row] },
      { neighbour: kind(column + 1, row), a: [column + 1, row + 1], b: [column + 1, row] },
      { neighbour: kind(column, row + 1), a: [column, row + 1], b: [column + 1, row + 1] },
      { neighbour: kind(column - 1, row), a: [column, row], b: [column, row + 1] },
    ];
    for (const side of sides) {
      if (side.neighbour === cell || (cell === 'water' && side.neighbour === 'land')) continue;
      const top = cell === 'water' ? spec.water : undefined;
      const bottom = side.neighbour === 'void' ? skirtBottom : spec.water - 0.5;
      const a = vertex(side.a[0], side.a[1], top), b = vertex(side.b[0], side.b[1], top);
      // Lean the foot slightly inward so the cliff reads as a volume, not a curtain.
      const lean = 0.12 * Math.min(cellWidth, cellDepth);
      const inward = [-(b[2] - a[2]), b[0] - a[0]] as const; const length = Math.hypot(inward[0], inward[1]) || 1;
      const foot = (p: [number, number, number]): [number, number, number] => [p[0] - inward[0] / length * lean, bottom, p[2] - inward[1] / length * lean];
      const color = side.neighbour === 'void' ? spec.palette.cliff : spec.palette.rock;
      face(sink, color, a, b, foot(b)); face(sink, color, a, foot(b), foot(a));
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(sink.positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(sink.colors, 3));
  geometry.computeVertexNormals(); geometry.computeBoundingSphere();
  let result:THREE.BufferGeometry=geometry;
  try{
    if(spec.mergeFlatLand)result=mergeFlatLand(geometry,terrain,landFaces);
    if(detail==='full'&&spec.mergePaintedFlatLand){const painted=mergePaintedFlatLand(geometry,result,terrain,landFaces);if(painted!==result&&result!==geometry)result.dispose();result=painted;}
  }catch(error){if(result!==geometry)result.dispose();geometry.dispose();throw error;}
  const removed=new Set<number>(),replaced=new Map<number,number>(),landStarts=new Set(landFaces.flatMap(f=>[f.start,f.start+3]));
  for(const run of result.userData.flatLandRuns??[]){replaced.set(run.sourceStarts[0],2);for(const at of run.sourceStarts.slice(1))removed.add(at);}
  for(const rect of result.userData.paintedLandRectangles??[]){replaced.set(rect.sourceStarts[0],rect.triangleCount);for(const at of rect.sourceStarts.slice(1))removed.add(at);}
  const land:number[]=[];let output=0;for(let i=0;i<geometry.getAttribute('position').count;){if(removed.has(i)){i+=6;continue;}const count=replaced.get(i);if(count!==undefined){for(let j=0;j<count;j++)land.push(output++);i+=6;}else{if(landStarts.has(i))land.push(output);output++;i+=3;}}
  if(output*3!==result.getAttribute('position').count)throw new Error('Terrain ownership lineage mismatch');terrainOwnership.set(result,{terrain,land:Object.freeze(land),prefixVertices:output*3});
  if(result!==geometry)geometry.dispose();return result;
}

/** The caller owns the returned mesh's geometry; the material is borrowed. */
export function createVillageTerrain(source: VillageTerrain | VillageTerrainSpec, material: THREE.Material, detail: VillageTerrainDetail = 'full'): THREE.Mesh {
  const mesh = new THREE.Mesh(villageTerrainGeometry(source, detail), material);
  mesh.name = detail === 'overview' ? 'village-terrain-overview' : 'village-terrain';
  mesh.receiveShadow = false;
  return mesh;
}

/** Constructor-only producer provenance. userData/upward normals cannot issue it. */
interface TerrainOwnership{readonly terrain:VillageTerrain;readonly land:readonly number[];readonly prefixVertices:number}
const terrainOwnership=new WeakMap<THREE.BufferGeometry,TerrainOwnership>();
const bakedTerrain=new WeakMap<THREE.Mesh,TerrainOwnership&{geometry:THREE.BufferGeometry;fields:Readonly<Record<string,Float32Array>>}>();
export function bindNativeTerrain(source:THREE.BufferGeometry,actual:THREE.Mesh):void{const proof=terrainOwnership.get(source);if(!proof||source.index||actual.geometry.index)throw new Error('Actual producer-owned nonindexed terrain required');const p=actual.geometry.getAttribute('position'),q=source.getAttribute('position');if(p.count<proof.prefixVertices)throw new Error('Baked terrain prefix is missing');for(let i=0;i<proof.prefixVertices;i++)for(let k=0;k<3;k++)if(p.getComponent(i,k)!==q.getComponent(i,k))throw new Error('Baked terrain prefix changed');bakedTerrain.set(actual,{...proof,geometry:actual.geometry,fields:Object.fromEntries(['position','normal','color'].map(name=>[name,new Float32Array(actual.geometry.getAttribute(name).array.slice(0,proof.prefixVertices*3))]))});}
export function nativeTerrainOwnership(actual:THREE.Mesh){const proof=bakedTerrain.get(actual);if(!proof||actual.geometry!==proof.geometry||actual.geometry.index)throw new Error('WorldScene actual baked terrain ownership missing');for(const[name,field]of Object.entries(proof.fields)){const p=actual.geometry.getAttribute(name);if(!p||p.itemSize!==3||p.count<proof.prefixVertices)throw new Error('Trusted actual land attribute missing');for(let i=0;i<field.length;i++)if(!Object.is(p.array[i],field[i]))throw new Error('Trusted actual land buffer mutated: '+name);}return{terrain:proof.terrain,land:proof.land,prefixVertices:proof.prefixVertices};}
