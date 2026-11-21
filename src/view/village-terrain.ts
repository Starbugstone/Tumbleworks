import * as THREE from 'three';
import{mergePaintedFlatLand}from'./village-painted-land';
import{mergeFlatLand,type LandFace}from'./village-flat-land';
import { cellDiagonal, compileTerrain, type TerrainPalette, type VillageTerrain, type VillageTerrainSpec } from '../world/village-terrain';

const moorUrl = new URL('./textures/harbour-moor.webp', import.meta.url).href;

export type VillageTerrainDetail = 'full' | 'overview';
/** The wider-world miniature samples every landform on the same coarse grid. */
export const OVERVIEW_CELLS = [8, 8] as const;

interface Sink { positions: number[]; colors: number[] }
export const TERRAIN_SURFACE = { turf: 1, plot: 2, bank: 3, cliff: 4, basin: 5 } as const;
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
    const moor = terrainGrain(material);
    const cargo = new THREE.Vector3(0,-100,0);
    material.userData.filmCargo = cargo;
    const contour = material.onBeforeCompile;
    material.onBeforeCompile = (shader, renderer) => {
      contour.call(material, shader, renderer);
      shader.uniforms.uMoor = { value: moor };
      shader.uniforms.uFilmCargo = { value: cargo };
      shader.uniforms.uGrass = { value: harbourGrass };
      shader.uniforms.uStrand = { value: sunny(0xe4c899, new THREE.Color()) };
      shader.uniforms.uQuayA = { value: sunny(0xcfc4a2, new THREE.Color()) };
      shader.uniforms.uQuayB = { value: sunny(0xbfb79b, new THREE.Color()) };
      terrainCoordinates(shader);
      shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
        uniform sampler2D uMoor;
        uniform vec3 uGrass, uStrand, uQuayA, uQuayB, uFilmCargo;`)
        .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
          vec2 shoreXZ=vTerrainPosition.xz;
          float ground=min(min(distance(vColor.rgb,uGrass),distance(vColor.rgb,uStrand)),
                           min(distance(vColor.rgb,uQuayA),distance(vColor.rgb,uQuayB)));
          // Slate and fired-clay roofs keep their tiles at travelling-camera scale.
          bool tile = distance(vColor.rgb,vec3(.57758,.14126,.06848)) < .003 ||
                      distance(vColor.rgb,vec3(.37626,.07619,.04374)) < .007 ||
                      distance(vColor.rgb,vec3(.06663,.13563,.18782)) < .007 ||
                      distance(vColor.rgb,vec3(.42327,.06663,.03071)) < .008 ||
                      distance(vColor.rgb,vec3(.03071,.09990,.13563)) < .008 ||
                      distance(vColor.rgb,vec3(.48515,.10702,.06301)) < .016 ||
                      distance(vColor.rgb,vec3(.07036,.13287,.18116)) < .016 ||
                      distance(vColor.rgb,vec3(.07619,.07421,.09084)) < .012 ||
                      distance(vColor.rgb,vec3(.28315,.17465,.08866)) < .015;
          if (tile) {
            vec2 uv=vec2(shoreXZ.x*3.6+shoreXZ.y*.3,(vTerrainPosition.y+shoreXZ.y*.16)*6.);
            uv.x += .5*mod(floor(uv.y),2.);
            vec2 cell=fract(uv), px=max(fwidth(uv),vec2(.009));
            float joint=max(1.-smoothstep(.025,.025+px.x,min(cell.x,1.-cell.x)),1.-smoothstep(.06,.06+px.y,cell.y));
            float grain=texture2D(uMoor,shoreXZ*.29).g;
            diffuseColor.rgb *= .88+.19*cell.y+.31*grain-.32*joint;
          }
          if (distance(vColor.rgb,vec3(.065,.185,.065)) < .002) {
            float leaves=texture2D(uMoor,shoreXZ*1.9+vTerrainPosition.y*.42).g;
            diffuseColor.rgb *= .74+1.12*leaves;
          }
          if (ground < .007) {
            // Meadow and shale use their own grain directions. Vertical faces have a true elevation coordinate.
            vec2 rockUv=vec2(dot(shoreXZ,vec2(.73,.67)),vTerrainPosition.y);
            float broad=texture2D(uMoor,shoreXZ*.094+vec2(.17,.33)).g;
            float grass=texture2D(uMoor,mat2(.75,.66,-.66,.75)*shoreXZ*.83).g;
            float rockGrain=texture2D(uMoor,rockUv*vec2(.34,.69)).g;
            float beach=smoothstep(.10,.96,vTerrainPosition.y+broad*.22);
            vec3 turf=mix(vec3(.12,.224,.102),vec3(.32,.37,.15),clamp(.21+broad*.95,0.,1.));
            turf*=.81+.45*smoothstep(.035,.42,grass);
            vec3 sand=mix(vec3(.36,.313,.217),vec3(.71,.57,.35),smoothstep(-.16,.55,vTerrainPosition.y));
            sand*=.90+.18*broad;
            float phase=vTerrainPosition.y*1.53+shoreXZ.x*.18+shoreXZ.y*.11+rockGrain*1.14
                        +.51*sin(shoreXZ.y*.77+shoreXZ.x*.48+vTerrainPosition.y*.62);
            float ledge=abs(fract(phase)-.52);
            float seam=1.-smoothstep(.035,.10+fwidth(phase),ledge);
            vec3 shale=mix(vec3(.20,.244,.235),vec3(.40,.366,.263),smoothstep(.1,.54,rockGrain));
            shale*=.97+.065*fract(phase)-.15*seam*smoothstep(.07,.42,broad+.6*rockGrain);
            float scree=smoothstep(.46,1.29,vGrade+(broad-.20)*.43);
            diffuseColor.rgb=mix(mix(sand,turf,beach),shale,scree*beach);
            // The front doors of the two upper rows face one lane, which widens at the fish market.
            float bend=cos((shoreXZ.x+4.93)*.335);
            float street=max(abs(shoreXZ.y+9.88+.55*bend*bend)-.47,abs(shoreXZ.x+.44)-8.97);
            float west=max(abs(shoreXZ.x+8.74+.48*sin((shoreXZ.y+2.)*.36))-.36,abs(shoreXZ.y-.80)-11.10);
            float market=(length((shoreXZ-vec2(5.03,-8.98))/vec2(2.72,1.48))-1.)*1.25;
            float quay=(length((shoreXZ-vec2(-7.27,11.94))/vec2(1.77,2.14))-1.)*1.55;
            float walk=min(min(street,west),min(market,quay));
            vec2 pave=shoreXZ*vec2(2.55,3.3);
            pave.x+=.50*mod(floor(pave.y),2.);
            vec2 joints=abs(fract(pave)-.5),px=max(fwidth(pave),.002);
            float mortar=max(smoothstep(.44-px.x,.50,joints.x),smoothstep(.44-px.y,.50,joints.y));
            vec3 path=mix(vec3(.54,.439,.30),vec3(.35,.31,.23),mortar)*(.97+.10*broad);
            float onPath=(1.-smoothstep(-.06,.08,walk+(grass-.2)*.1))*beach*(1.-smoothstep(.33,1.,vGrade));
            diffuseColor.rgb=mix(diffuseColor.rgb,path,onPath);
          } else if (vTerrainSurface >= 2.5 && vTerrainSurface < 4.5) {
            // Continue the hand-painted stroke down the exposed cliff and over the built beach.
            vec2 faceUv=vec2(dot(shoreXZ,vec2(.73,.67)),vTerrainPosition.y);
            float grain=texture2D(uMoor,vTerrainSurface>3.5 ? faceUv*vec2(.41,1.12) : shoreXZ*.77).g;
            diffuseColor.rgb*=.88+.38*grain;
          }`)
        .replace('#include <opaque_fragment>', `
          // A rolling sphere casts a close contact shadow directly onto the moving channel.
          vec3 toRuby = vTerrainPosition - uFilmCargo;
          float contact = (1.-smoothstep(.05,.47,length(toRuby.xz+vec2(.04,-.03))))
                          *smoothstep(.08,.20,-toRuby.y)*(1.-smoothstep(.34,.54,-toRuby.y));
          outgoingLight *= 1.-.37*contact;
          // Lantern glass is self-lit even with the sun behind the tower.
          if (length(vTerrainPosition.xz-vec2(1.5,-10.)) < .57 && vTerrainPosition.y > 7.075 && vTerrainPosition.y < 7.59) {
            outgoingLight += vec3(2.7,1.34,.31) * (.35+.65*smoothstep(.05,.3,vColor.r));
          }
          #include <opaque_fragment>`);
    };
  }
  material.customProgramCacheKey = () => harbourGrass ? 'harbour-promenade' : 'rock-contour';
  material.needsUpdate = true;
}

type MaterialShader = Parameters<THREE.Material['onBeforeCompile']>[0];
function terrainCoordinates(shader: MaterialShader): void {
  shader.vertexShader = shader.vertexShader.replace('#include <common>', `#include <common>
    attribute float terrainSurface;
    varying float vTerrainSurface;
    varying vec3 vTerrainPosition;`)
    .replace('#include <begin_vertex>', `#include <begin_vertex>
    vTerrainSurface = terrainSurface;
    vTerrainPosition = (modelMatrix * vec4(position, 1.0)).xyz;`);
  shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
    varying float vTerrainSurface;
    varying vec3 vTerrainPosition;`);
}

function terrainGrain(material: THREE.Material): THREE.Texture {
  const texture = new THREE.TextureLoader().load(moorUrl);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  material.addEventListener('dispose', () => texture.dispose());
  return texture;
}

/** Paint profiles belong to the landform. All use the same mipmapped brush and the existing solid ground. */
const inlandFinish = [
  // Glasshouse Gardens. The two planted terraces have raised dark rows; the middle is compact pale gravel.
  `if (plot) {
    float crops = step(vColor.r, vColor.g*.96);
    float rows = terrainRows(p.x*1.7 + .12*grain);
    vec3 planted = mix(vec3(.055,.082,.022),vec3(.162,.248,.070),rows)*(.78+.47*broad);
    vec3 gravel = vec3(.43,.353,.235)*(.87+.34*grain);
    land = mix(gravel,planted,crops);
  }
  float sill = (1.-smoothstep(1.45,1.82,abs(p.x-8.1)))*smoothstep(12.5,13.0,p.y);
  land = mix(land,vec3(.36,.326,.253)*(.87+.28*grain-.13*stoneJoints(p*1.9)),sill);`,
  // Willow Mill. Broad ochre meadows flank the river; the surveyed mill and warehouse yards are worn clay.
  `float field = 1.-smoothstep(1.30,2.3,abs(p.x+8.9+.52*sin(p.y*.25)));
  field *= smoothstep(-12.,-9.5,p.y)*(1.-smoothstep(6.5,10.,p.y));
  land = mix(land,vec3(.28,.215,.086)*(.83+.43*grain),max(plot ? .84 : 0.,field*.82));`,
  // Clockmakers' Hill. A pale curved footpath follows the shoulder around the summit.
  `vec2 slope = vec2((p.x+.37)*.91,(p.y+3.6)*.78);
  float turn = atan(slope.y,slope.x+.001);
  float shoulder = abs(length(slope)-9.0-.65*sin(turn*2.+.2)-.39*sin(turn*3.+.55));
  float path = (1.-smoothstep(.45,.72+grain*.20,shoulder))*smoothstep(-12.,-9.0,p.y);
  float higher = y+.28*(broad-.24);
  float terraces = (smoothstep(1.38,1.85,higher)+smoothstep(2.30,2.71,higher))*.28;
  land = mix(land,vec3(.365,.344,.277)*(.85+.25*grain),terraces);
  land = mix(land,vec3(.48,.436,.343)*(.89+.29*grain-.14*stoneJoints(p*1.8)),path);`,
  // Cloud Bridge. Light scrub tops the bridgeheads; cool rubble remains visible in the cleft.
  `float scrub = smoothstep(.15,.40,broad+.16*grain);
  land = mix(land,vec3(.24,.284,.145)*(.87+.28*grain),scrub*.33);
  land = mix(land,vec3(.245,.252,.217)*(.81+.42*grain),plot ? .74 : 0.);
  float lots = min(length((p-vec2(8.6,-6.2))*vec2(.27,.23)),length((p-vec2(-7.7,9.6))*vec2(.28,.22)));
  land = mix(land,vec3(.295,.264,.194)*(.91+.22*grain),(1.-smoothstep(.56,1.12,lots))*.58);`,
  // High Glassworks. Pale cobbled work yards sit in pockets amid the ash and exposed cinders.
  `float kilnYards = min(yardEdge(p-vec2(-8.7,-11.7),vec2(3.35,2.2)),yardEdge(p-vec2(6.9,-11.8),vec2(3.6,2.2)));
  float packingYards = min(yardEdge(p-vec2(1.9,-6.2),vec2(2.8,1.55)),yardEdge(p-vec2(4.5,-.1),vec2(1.75,1.55)));
  float entries = min(yardEdge(p-vec2(-7.7,-9.5),vec2(1.15,.62)),yardEdge(p-vec2(3.1,-4.65),vec2(1.2,.57)));
  float apron = 1.-smoothstep(-.06,.17,min(kilnYards,min(packingYards,entries))+(broad-.25)*.14);
  float paving = stoneJoints(p*vec2(1.66,2.15));
  vec3 cobbles = vec3(.385,.354,.301)*(.83+.39*grain-.16*paving);
  land = mix(land,cobbles,apron);`,
] as const;

/** Illustrate only geometry marked as terrain. Other pieces can share this material and its cached draw. */
export function illustrateInlandTerrain(material: THREE.Material, terrain: VillageTerrainSpec, chapter: number): void {
  rockContour(material, sunny(terrain.palette.rock, new THREE.Color()));
  const finish = inlandFinish[chapter - 1];
  if (!finish || typeof Image === 'undefined') return;
  const grain = terrainGrain(material), contour = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    contour.call(material, shader, renderer);
    shader.uniforms.uTerrainGrain = { value: grain };
    shader.uniforms.uTurf = { value: new THREE.Color(terrain.palette.grass) };
    shader.uniforms.uTurfAlt = { value: new THREE.Color(terrain.palette.grassAlt) };
    shader.uniforms.uStone = { value: new THREE.Color(terrain.palette.rock) };
    shader.uniforms.uWaterline = { value: terrain.water };
    terrainCoordinates(shader);
    shader.fragmentShader = shader.fragmentShader.replace('#include <common>', `#include <common>
      uniform sampler2D uTerrainGrain;
      uniform vec3 uTurf, uTurfAlt, uStone;
      uniform float uWaterline;
      float terrainRows(float phase) {
        float ridge = smoothstep(-.48,.64,cos(phase*6.283185));
        return mix(ridge,.5,smoothstep(.14,.52,fwidth(phase)));
      }
      float stoneJoints(vec2 uv) {
        uv.x += .5*mod(floor(uv.y),2.);
        vec2 px=max(fwidth(uv),vec2(.006)), joints=abs(fract(uv)-.5);
        float mortar=max(smoothstep(.44-px.x,.50,joints.x),smoothstep(.44-px.y,.50,joints.y));
        return mortar*(1.-smoothstep(.18,.54,max(px.x,px.y)));
      }
      float yardEdge(vec2 fromCentre, vec2 halfSize) {
        vec2 d = abs(fromCentre)-halfSize;
        return max(max(d.x,d.y),(d.x+d.y+.60)*.7071);
      }`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
        if (vTerrainSurface > .5 && vTerrainSurface < 5.5) {
          vec2 p = vTerrainPosition.xz;
          float y = vTerrainPosition.y;
          bool plot = vTerrainSurface > 1.5 && vTerrainSurface < 2.5;
          bool bank = vTerrainSurface > 2.5;
          bool cliff = vTerrainSurface > 3.5 && vTerrainSurface < 4.5;
          float broad = texture2D(uTerrainGrain,p*.105+vec2(.19,.37)).g;
          float stone = cliff ? 1. : smoothstep(.48,1.17,vGrade+(broad-.24)*.56);
          vec2 shale = vec2(dot(p,vec2(.83,.56)),y*1.66);
          vec2 grainUv = mix(mat2(.75,.66,-.66,.75)*p*.82,shale*vec2(.56,.66),stone);
          float grain = texture2D(uTerrainGrain,grainUv).g;
          vec3 land = mix(uTurf,uTurfAlt,smoothstep(.05,.42,broad))*(.78+.56*grain);
          if (!bank) { ${finish} }
          float seam = terrainRows(y*1.49 + p.x*.18 + p.y*.11 + broad*.95);
          float seamContrast = ${chapter === 2 ? '.25' : chapter === 4 ? '.57' : '1.'};
          vec3 rock = (cliff ? vColor.rgb*.79 : uStone)*(.86+.31*grain+.20*(seam-.5)*seamContrast);
          land = mix(land,rock,stone);
          if (bank && !cliff) {
            float strata = smoothstep(.60,1.52,y-uWaterline);
            land = vColor.rgb*(.77+.41*grain+.13*broad)*mix(1.,.91+.24*(seam-.5)*seamContrast,strata);
          }
          ${chapter === 2 ? `
          if (bank) {
            float damp = 1.-smoothstep(.19,.88,y-uWaterline);
            land = mix(land,vec3(.26,.239,.200)*(.86+.29*grain),damp*.40);
          }
          ` : ''}
          ${chapter === 1 ? `
          if (vTerrainSurface > 4.5) {
            vec3 face = cross(dFdx(vTerrainPosition),dFdy(vTerrainPosition));
            float along = abs(face.x)>abs(face.z) ? p.y : p.x;
            float joints = stoneJoints(vec2(along*2.45,y*4.4));
            float coping = smoothstep(.72,.85,y-uWaterline);
            vec3 masonry = mix(vec3(.275,.240,.183),vec3(.48,.422,.322),coping);
            land = masonry*(.86+.33*grain-.27*joints);
          }
          ` : ''}
          ${chapter === 4 ? `
          if (!bank) {
            float drift = .36*sin(p.y*.32)+.65*(broad-.25);
            float hollow = 1.-smoothstep(.40,2.38,abs(p.x+.31+drift));
            float ends = smoothstep(-13.6,-8.4,p.y)*(1.-smoothstep(7.4,13.3,p.y+drift));
            float wisps = .50+.42*broad+.08*sin(p.y*.47+p.x*.73+broad*3.4);
            float mist = hollow*ends*(1.-smoothstep(-.85,.04,y))*wisps;
            land = mix(land,vec3(.282,.341,.367),mist);
          }
          ` : ''}
          float wet = 1.-smoothstep(.04,.48,y-uWaterline);
          diffuseColor.rgb = land*(1.-wet*.19);
        }`);
  };
  material.customProgramCacheKey = () => `inland-terrain-${chapter}`;
}

const inlandPalettes: readonly (readonly [number, number, number, number, number])[] = [
  [0x788551, 0x88965b, 0x9c8f73, 0xc5b693, 0x786f5e],
  [0x748653, 0x929c58, 0x8d7b62, 0xc2ae83, 0x736854],
  [0x7b8667, 0x929971, 0x989082, 0xc0b292, 0x777364],
  [0x82917a, 0xa8ae8d, 0x8e8b7d, 0xb6b39e, 0x716e63],
  [0x5f665e, 0x787770, 0x6d6661, 0xb0a292, 0x5e5550],
];

export function villageSurfacePalette(palette: TerrainPalette, chapter: number): TerrainPalette {
  if (chapter === 0) return { ...palette, grass: 0x82a397, grassAlt: 0x82a397, cliff: 0x626f74, rock: 0x869492, shore: 0xe4c899 };
  const inland = inlandPalettes[chapter - 1];
  if (!inland) return palette;
  const [grass, grassAlt, rock, shore, cliff] = inland;
  return { ...palette, grass, grassAlt, rock, shore, cliff };
}

/** The ground colour of a land cell's top, so level dressing beside it can continue the same ground. */
export function landFaceColour(terrain: VillageTerrain, column: number, row: number, target: THREE.Color): THREE.Color {
  const stride = terrain.columns + 1, h = terrain.heights;
  const corners = [h[row * stride + column]!, h[row * stride + column + 1]!, h[(row + 1) * stride + column + 1]!, h[(row + 1) * stride + column]!];
  return target.setHex(groundColor(terrain, column, row, corners));
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
  const skirtStarts = new Set<number>();
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
      if (spec.rockContour) {
        const start = sink.positions.length / 3;
        skirtStarts.add(start); skirtStarts.add(start + 3);
      }
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
  const removed=new Set<number>(),replaced=new Map<number,number>();
  for(const run of result.userData.flatLandRuns??[]){replaced.set(run.sourceStarts[0],2);for(const at of run.sourceStarts.slice(1))removed.add(at);}
  for(const rect of result.userData.paintedLandRectangles??[]){replaced.set(rect.sourceStarts[0],rect.triangleCount);for(const at of rect.sourceStarts.slice(1))removed.add(at);}
  const landStarts = new Map<number, number>();
  for (const { row, column, start } of landFaces) {
    const surface = terrain.paint[row * columns + column] ? TERRAIN_SURFACE.plot : TERRAIN_SURFACE.turf;
    landStarts.set(start, surface); landStarts.set(start + 3, surface);
  }
  const land: number[] = [], surface = new Uint8Array(result.getAttribute('position').count);
  let output = 0;
  for (let i = 0; i < geometry.getAttribute('position').count;) {
    if (removed.has(i)) { i += 6; continue; }
    const replacement = replaced.get(i);
    const top = landStarts.get(i);
    const type = top ?? (skirtStarts.has(i) ? TERRAIN_SURFACE.cliff : 0);
    const count = replacement ?? 1;
    if (type) surface.fill(type, output * 3, (output + count) * 3);
    for (let j = 0; top && j < count; j++) land.push(output + j);
    output += count;
    i += replacement !== undefined ? 6 : 3;
  }
  if (output * 3 !== surface.length) throw new Error('Terrain ownership lineage mismatch');
  terrainOwnership.set(result, { terrain, land: Object.freeze(land), prefixVertices: output * 3 });
  if (spec.rockContour) {
    result.setAttribute('grade', new THREE.Float32BufferAttribute(slopeGrades(result, terrain, land), 1));
    result.setAttribute('terrainSurface', new THREE.BufferAttribute(surface, 1));
  }
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
