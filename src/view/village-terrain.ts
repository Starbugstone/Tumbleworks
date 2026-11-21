import * as THREE from 'three';
import{mergePaintedFlatLand}from'./village-painted-land';
import{mergeFlatLand,type LandFace}from'./village-flat-land';
import { cellDiagonal, compileTerrain, type VillageTerrain, type VillageTerrainSpec } from '../world/village-terrain';

const moorUrl = new URL('./textures/harbour-moor.webp', import.meta.url).href;

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
  if (harbourGrass && typeof Image !== 'undefined') {
    const moor = new THREE.TextureLoader().load(moorUrl);
    moor.wrapS = moor.wrapT = THREE.RepeatWrapping;
    moor.colorSpace = THREE.SRGBColorSpace;
    material.addEventListener('dispose', () => moor.dispose());
    const contour = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      contour.call(material, shader, renderer);
      shader.uniforms.uMoor = { value: moor };
      shader.uniforms.uGrass = { value: harbourGrass };
      shader.uniforms.uStrand = { value: sunny(0xe4c899, new THREE.Color()) };
      shader.uniforms.uQuayA = { value: sunny(0xcfc4a2, new THREE.Color()) };
      shader.uniforms.uQuayB = { value: sunny(0xbfb79b, new THREE.Color()) };
      shader.vertexShader = shader.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vHarbour;')
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvHarbour = (modelMatrix * vec4(position, 1.0)).xyz;');
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        uniform sampler2D uMoor;
        uniform vec3 uGrass, uStrand, uQuayA, uQuayB;
        varying vec3 vHarbour;`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          vec2 shoreXZ=vHarbour.xz;
          float ground=min(min(distance(vColor.rgb,uGrass),distance(vColor.rgb,uStrand)),
                           min(distance(vColor.rgb,uQuayA),distance(vColor.rgb,uQuayB)));
          // The Blender kit uses distinct paints for slate and fired-clay roofs.
          bool tile = distance(vColor.rgb,vec3(.57758,.14126,.06848)) < .003 ||
                      distance(vColor.rgb,vec3(.37626,.07619,.04374)) < .007 ||
                      distance(vColor.rgb,vec3(.06663,.13563,.18782)) < .007;
          if (tile) {
            vec2 uv=vec2(shoreXZ.x*3.6+shoreXZ.y*.3,(vHarbour.y+shoreXZ.y*.16)*6.);
            uv.x += .5*mod(floor(uv.y),2.);
            vec2 cell=fract(uv), px=max(fwidth(uv),vec2(.009));
            float joint=max(1.-smoothstep(.025,.025+px.x,min(cell.x,1.-cell.x)),1.-smoothstep(.06,.06+px.y,cell.y));
            float grain=texture2D(uMoor,shoreXZ*.29).g;
            diffuseColor.rgb *= .88+.19*cell.y+.31*grain-.32*joint;
          }
          if (distance(vColor.rgb,vec3(.065,.185,.065)) < .002) {
            float leaves=texture2D(uMoor,shoreXZ*1.9+vHarbour.y*.42).g;
            diffuseColor.rgb *= .74+1.12*leaves;
          }
          if (ground < .007) {
            vec3 print=texture2D(uMoor,shoreXZ*.115 + vec2(.17,.33)).rgb;
            float grain=dot(print,vec3(.25,.59,.16));
            float dune=smoothstep(.23,.94,vHarbour.y+(grain-.27)*.46);
            vec3 turf=print*vec3(.72,1.12,1.02)+vec3(.045,.085,.049);
            vec3 sand=mix(vec3(.37,.32,.22),vec3(.77,.64,.43),smoothstep(-.12,.32,vHarbour.y));
            sand*=.85+.48*grain;
            float scree=smoothstep(.46,1.35,vGrade+(grain-.25)*.76);
            vec3 shale=mix(vec3(.23,.265,.258),vec3(.51,.48,.40),clamp(grain*2.,0.,1.));
            diffuseColor.rgb=mix(mix(sand,turf,dune),shale,scree*dune);
            float walk=min(max(abs(shoreXZ.y+8.1+.41*sin(shoreXZ.x*.48))-.34,abs(shoreXZ.x)-8.15),
                           max(abs(shoreXZ.x+7.25+.55*sin(shoreXZ.y*.39))-.27,abs(shoreXZ.y-1.7)-10.));
            diffuseColor.rgb=mix(diffuseColor.rgb,sand*.88,(1.-smoothstep(-.11,.12,walk+(grain-.25)*.28))*dune);
          }`)
        .replace('#include <opaque_fragment>', `
          // Lantern glass is self-lit even with the sun behind the tower.
          if (length(vHarbour.xz-vec2(1.5,-10.)) < .50 && vHarbour.y > 7.075 && vHarbour.y < 7.59) {
            outgoingLight += vec3(1.45,.68,.13) * smoothstep(.06,.31,vColor.r);
          }
          #include <opaque_fragment>`);
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
  if (spec.beachWidth) {
    // Adjacent land triangles share the slope of the height field. Skirts retain
    // their outward normals, and the collision mesh remains the exact land surface.
    const pos = result.getAttribute('position'), normals = result.getAttribute('normal');
    const n = new THREE.Vector3();
    for (const tri of land) for (let i = tri * 3; i < tri * 3 + 3; i++) {
      const c = Math.round((pos.getX(i) - originX) / cellWidth), r = Math.round((pos.getZ(i) - originZ) / cellDepth);
      const left = Math.max(0,c-1), right = Math.min(columns,c+1), back = Math.max(0,r-1), front = Math.min(rows,r+1);
      const dx = (heights[r*stride+right]! - heights[r*stride+left]!) / ((right-left)*cellWidth);
      const dz = (heights[front*stride+c]! - heights[back*stride+c]!) / ((front-back)*cellDepth);
      n.set(-dx,1,-dz).normalize();
      normals.setXYZ(i,n.x,n.y,n.z);
    }
  }
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
