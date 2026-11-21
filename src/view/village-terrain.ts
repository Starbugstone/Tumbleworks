import * as THREE from 'three';
import{mergePaintedFlatLand}from'./village-painted-land';
import{mergeFlatLand,type LandFace}from'./village-flat-land';
import { cellDiagonal, compileTerrain, type VillageTerrain, type VillageTerrainSpec } from '../world/village-terrain';

export type VillageTerrainDetail = 'full' | 'overview';
/** The wider-world miniature samples every landform on the same coarse grid. */
export const OVERVIEW_CELLS = [8, 8] as const;

interface Sink { positions: number[]; colors: number[] }
const scratch = new THREE.Color();
const hsl = { h: 0, s: 0, l: 0 };
/**
 * The authored land palettes are dusty. The valley is drawn as a sunny toy, so each colour keeps its hue
 * and its lightness and gains saturation; equal authored colours stay equal, which the land merging needs.
 */
export function sunny(color: number, target: THREE.Color): THREE.Color {
  target.setHex(color).getHSL(hsl);
  return target.setHSL(hsl.h, Math.min(1, hsl.s * 1.9 + 0.06), Math.min(1, hsl.l * 1.04));
}
function face(sink: Sink, color: number, ...points: readonly (readonly [number, number, number])[]): void {
  sunny(color, scratch);
  for (const point of points) { sink.positions.push(point[0], point[1], point[2]); sink.colors.push(scratch.r, scratch.g, scratch.b); }
}

/** A cell's ground colour before any rock: its paint, low shore or grass. */
function groundColor(terrain: VillageTerrain, column: number, row: number, corners: readonly number[]): number {
  const { palette, water } = terrain.spec;
  const painted = terrain.paint[row * terrain.columns + column]!;
  if (painted) return painted;
  const mean = corners.reduce((sum, value) => sum + value, 0) / corners.length;
  if (mean < water + 0.45) return palette.shore;
  return palette.grass;
}
function faceColor(terrain: VillageTerrain, column: number, row: number, corners: readonly number[]): number {
  if (terrain.paint[row * terrain.columns + column]) return groundColor(terrain, column, row, corners);
  const rise = Math.max(...corners) - Math.min(...corners);
  if (rise / Math.min(terrain.cellWidth, terrain.cellDepth) > 0.75) return terrain.spec.palette.rock;
  return groundColor(terrain, column, row, corners);
}
/** Ground at least this steep (rise over run) is drawn as rock where the contour shader runs. */
export const ROCK_GRADE = 0.75;
/** Height-field steepness at a grid vertex, by central differences (one-sided at the border). */
function grade(terrain: VillageTerrain, column: number, row: number): number {
  const { columns, rows, heights, cellWidth, cellDepth } = terrain, stride = columns + 1;
  const h = (c: number, r: number) => heights[Math.min(rows, Math.max(0, r)) * stride + Math.min(columns, Math.max(0, c))]!;
  const c0 = Math.max(0, column - 1), c1 = Math.min(columns, column + 1), r0 = Math.max(0, row - 1), r1 = Math.min(rows, row + 1);
  return Math.hypot((h(c1, row) - h(c0, row)) / ((c1 - c0) * cellWidth), (h(column, r1) - h(column, r0)) / ((r1 - r0) * cellDepth));
}

/**
 * Draw rock wherever a slope's interpolated grade reaches ROCK_GRADE, with an anti-aliased edge. The rock
 * line follows the slope's contour across the triangles instead of stepping cell by cell; geometry,
 * triangle count and the land's ownership are untouched. Meshes without a `grade` attribute read 0.
 */
export function rockContour(material: THREE.Material, rock: THREE.Color, harbourGrass?: THREE.Color): void {
  const uniform = { value: rock.clone() };
  material.onBeforeCompile = shader => {
    shader.uniforms['uRock'] = uniform;
    shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nattribute float grade;\nvarying float vGrade;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvGrade = grade;');
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRock;\nvarying float vGrade;')
      .replace('#include <color_fragment>', `#include <color_fragment>
      float rockEdge = max(fwidth(vGrade), 1e-4);
      diffuseColor.rgb = mix(diffuseColor.rgb, uRock, smoothstep(${ROCK_GRADE.toFixed(4)} - rockEdge, ${ROCK_GRADE.toFixed(4)} + rockEdge, vGrade));`);
  };
  if (harbourGrass) {
    const contour = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      contour.call(material, shader, renderer);
      shader.uniforms.uHarbourGrass = { value: harbourGrass };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec2 vQuay;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvQuay = (modelMatrix * vec4(position, 1.0)).xz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uHarbourGrass; varying vec2 vQuay;')
        .replace('#include <color_fragment>', `#include <color_fragment>
          if (distance(vColor.rgb, uHarbourGrass) < .007) {
            float promenade = min(max(abs(vQuay.y + 8.15) - .57, abs(vQuay.x) - 8.5),
                                  max(abs(vQuay.x + 7.55) - .47, abs(vQuay.y - 1.8) - 10.5));
            float row = floor(vQuay.y / .42);
            vec2 cell = fract(vec2(vQuay.x / .85 + mod(row, 2.0) * .5, vQuay.y / .42));
            vec2 border = min(cell, 1.0 - cell);
            float mortar = 1.0 - smoothstep(.01, .09, min(border.x, border.y));
            vec3 paving = mix(vec3(.59,.47,.34), vec3(.38,.34,.29), mortar);
            diffuseColor.rgb = mix(diffuseColor.rgb, paving, 1.0 - smoothstep(-.065,.025,promenade));
          }`);
    };
  }
  material.customProgramCacheKey = () => harbourGrass ? 'harbour-promenade' : 'rock-contour';
  material.needsUpdate = true;
}

/** The ground colour of a land cell's top, so level dressing beside it can continue the same ground. */
export function landFaceColour(terrain: VillageTerrain, column: number, row: number, target: THREE.Color): THREE.Color {
  const stride = terrain.columns + 1, h = terrain.heights;
  const corners = [h[row * stride + column]!, h[row * stride + column + 1]!, h[(row + 1) * stride + column + 1]!, h[(row + 1) * stride + column]!];
  return sunny(groundColor(terrain, column, row, corners), target);
}

/**
 * One flat-shaded geometry per landform: land triangles following `cellDiagonal`,
 * water sheets in holes, and cliff skirts wherever land or water meets the void.
 */
export function villageTerrainGeometry(source: VillageTerrain | VillageTerrainSpec, detail: VillageTerrainDetail = 'full', continuousSea = false): THREE.BufferGeometry {
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
      // With a rock contour the shader draws rock where the slope's own grade crosses ROCK_GRADE, so the
      // cell keeps its ground colour; otherwise a steep cell is rock as a whole.
      const color = spec.rockContour ? groundColor(terrain, column, row, corners) : faceColor(terrain, column, row, corners);
      const v00 = vertex(column, row), v10 = vertex(column + 1, row), v01 = vertex(column, row + 1), v11 = vertex(column + 1, row + 1);
      if (cellDiagonal(column, row) === 'main') { face(sink, color, v00, v11, v10); face(sink, color, v00, v01, v11); }
      else { face(sink, color, v00, v01, v10); face(sink, color, v10, v01, v11); }
    } else if (!continuousSea) {
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
      // Straight down into the sea. A foot leaning inward opened a wedge at every outside corner, where
      // neighbouring walls lean different ways, and the backdrop showed through as a dark spike.
      const lean = 0;
      const inward = [-(b[2] - a[2]), b[0] - a[0]] as const; const length = Math.hypot(inward[0], inward[1]) || 1;
      const foot = (p: [number, number, number]): [number, number, number] => [p[0] - inward[0] / length * lean, bottom, p[2] - inward[1] / length * lean];
      const color = side.neighbour === 'void' ? spec.palette.cliff : spec.palette.rock;
      // Wound to face the lower side. The village material is single-sided: a wall facing into its own
      // land is culled from outside, and the lagoon showed through the island wherever no beach hid it.
      face(sink, color, a, foot(b), b); face(sink, color, a, foot(a), foot(b));
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
  if(spec.rockContour)result.setAttribute('grade',new THREE.Float32BufferAttribute(slopeGrades(result,terrain,land),1));
  if(result!==geometry)geometry.dispose();return result;
}

/**
 * Per-vertex grade for every sloped, unpainted land triangle; 0 elsewhere (level or painted land, cliffs).
 * Each triangle owns its vertices, so a level cell beside a slope stays ground right up to its rim.
 */
function slopeGrades(geometry:THREE.BufferGeometry,terrain:VillageTerrain,land:readonly number[]):Float32Array{
  const p=geometry.getAttribute('position'),out=new Float32Array(p.count);
  const column=(x:number)=>Math.round((x-terrain.originX)/terrain.cellWidth),row=(z:number)=>Math.round((z-terrain.originZ)/terrain.cellDepth);
  for(const triangle of land){
    const ids=[0,1,2].map(j=>triangle*3+j),ys=ids.map(i=>p.getY(i));
    if(ys.every(y=>y===ys[0]))continue;
    const cx=ids.reduce((sum,i)=>sum+p.getX(i),0)/3,cz=ids.reduce((sum,i)=>sum+p.getZ(i),0)/3;
    const c=Math.floor((cx-terrain.originX)/terrain.cellWidth),r=Math.floor((cz-terrain.originZ)/terrain.cellDepth);
    if(terrain.paint[r*terrain.columns+c])continue;
    for(const i of ids)out[i]=grade(terrain,column(p.getX(i)),row(p.getZ(i)));
  }
  return out;
}

/** The caller owns the returned mesh's geometry; the material is borrowed. */
export function createVillageTerrain(source: VillageTerrain | VillageTerrainSpec, material: THREE.Material, detail: VillageTerrainDetail = 'full', continuousSea = false): THREE.Mesh {
  const mesh = new THREE.Mesh(villageTerrainGeometry(source, detail, continuousSea), material);
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
