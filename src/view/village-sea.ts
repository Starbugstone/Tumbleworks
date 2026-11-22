import * as THREE from 'three';
import { DEEP_SEA } from '../engine/stage';
import { sunny } from './village-terrain';
import { causticTexture } from './arcade';
import { terrainHeightAt, type TerrainVec2, type VillageTerrain } from '../world/village-terrain';

const OPEN_WATER = 18;
const SHELF_WIDTH = 2.6;
// Padding includes the shelf, the full fade and a band of solid deep texels for bilinear sampling.
const SHORE_MARGIN = OPEN_WATER + SHELF_WIDTH + 1.5;

/** Bake a scanline in world coordinates. Negative distances are on the land side of the polygon. */
function shoreRow(polygon: readonly TerrainVec2[], xs: Float64Array, z: number, out: Float64Array): void {
  out.fill(Infinity);
  const crossings: number[] = [];
  for (let i = 0, previous = polygon.length - 1; i < polygon.length; previous = i++) {
    const [ax, az] = polygon[i]!, [bx, bz] = polygon[previous]!;
    const dx = bx - ax, dz = bz - az, lengthSquared = dx * dx + dz * dz;
    const fromZ = z - az;
    if ((az > z) !== (bz > z)) crossings.push(ax + dx * fromZ / dz);
    for (let column = 0; column < xs.length; column++) {
      const fromX = xs[column]! - ax;
      const t = lengthSquared ? Math.max(0, Math.min(1, (fromX * dx + fromZ * dz) / lengthSquared)) : 0;
      const xGap = fromX - dx * t, zGap = fromZ - dz * t;
      out[column] = Math.min(out[column]!, xGap * xGap + zGap * zGap);
    }
  }
  crossings.sort((a, b) => a - b);
  let crossed = 0;
  for (let column = 0; column < xs.length; column++) {
    while (crossed < crossings.length && xs[column]! >= crossings[crossed]!) crossed++;
    out[column] = Math.sqrt(out[column]!) * (crossed % 2 ? -1 : 1);
  }
}

export function bakeVillageShore(level: number, terrain: VillageTerrain, harbour: boolean): { field: THREE.DataTexture; span: number } {
  const size = harbour ? 256 : 128;
  const span = Math.max(...terrain.spec.size) + 2 * SHORE_MARGIN;
  const data = new Uint8Array(size * size * 4);
  const coordinates = Float64Array.from({ length: size }, (_, i) => ((i + .5) / size - .5) * span);
  const coast = new Float64Array(size);
  const inlets = terrain.spec.features.flatMap(f => f.kind === 'hole' ? [{ polygon: f.polygon, row: new Float64Array(size) }] : []);
  for (let z = 0; z < size; z++) {
    const wz = coordinates[z]!;
    shoreRow(terrain.spec.outline, coordinates, wz, coast);
    for (const inlet of inlets) shoreRow(inlet.polygon, coordinates, wz, inlet.row);
    for (let x = 0; x < size; x++) {
      const i = (z * size + x) * 4;
      let distance = coast[x]!;
      if (harbour) {
        for (const inlet of inlets) distance = Math.max(distance, -inlet.row[x]!);
        distance = Math.max(0, distance + 1.15);
        const bed = terrainHeightAt(terrain, coordinates[x]!, wz);
        data[i + 1] = bed === undefined ? 255 : Math.round(255 * THREE.MathUtils.clamp((level - bed) / .28, 0, 1));
      } else if (distance < 0) {
        distance = 0;
        for (const inlet of inlets) if (inlet.row[x]! < 0) distance = Math.max(distance, 1.3 + .7 * Math.min(4, -inlet.row[x]!));
      } else {
        distance = Math.max(0, distance - SHELF_WIDTH);
      }
      data[i] = Math.min(255, Math.round(distance / OPEN_WATER * 255));
      data[i + 3] = 255;
    }
  }
  const field = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  field.minFilter = field.magFilter = THREE.LinearFilter;
  field.needsUpdate = true;
  return { field, span };
}

/** One opaque surface continues through all inlets, with coverage beyond the village camera's far plane. */
export function villageSea(level: number, shore: number, terrain?: VillageTerrain, wake?: THREE.Vector4): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(1024, 1024); geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: DEEP_SEA, fog: false, toneMapped: false });
  const sea = new THREE.Mesh(geometry, material); sea.name = 'village-sea'; sea.position.y = level;
  if (!terrain) return sea;
  const { field, span } = bakeVillageShore(level, terrain, !!wake);
  const caustic=causticTexture(),time={value:0};
  material.color.set(0xffffff);
  material.customProgramCacheKey = () => wake ? 'harbour-water' : 'village-water';
  material.onBeforeCompile=shader=>{
    shader.uniforms['uLaunch'] = {value: wake ?? new THREE.Vector4()};
    shader.uniforms['uShore']={value:field};shader.uniforms['uFieldSpan']={value:span};shader.uniforms['uCaustic']={value:caustic};shader.uniforms['uTime']=time;
    shader.uniforms.uShoreTint = { value: sunny(shore, new THREE.Color()) };
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vSea;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSea = position.xz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vSea; uniform sampler2D uShore; uniform sampler2D uCaustic; uniform float uTime; uniform float uFieldSpan; uniform vec4 uLaunch; uniform vec3 uShoreTint;')
      .replace('#include <color_fragment>',/* glsl */`
      vec2 fieldUv = vSea / uFieldSpan + .5;
      vec4 shoreField = texture2D(uShore, clamp(fieldUv, 0.0, 1.0));
      float distance = shoreField.r * ${OPEN_WATER}.0;
      vec3 deep = vec3(${new THREE.Color(DEEP_SEA).toArray().map(value=>value.toFixed(6)).join(',')});
      vec3 water = deep;
      if (distance < ${OPEN_WATER}.0 || ${wake ? 'true' : 'false'}) {
      float a = texture2D(uCaustic, vSea * .25 + vec2(uTime*.009, uTime*.004)).r;
      ${wake ? `
      float b = texture2D(uCaustic, vSea * .31 + vec2(-uTime*.006, uTime*.005) + .37).r;
      float net = min(a,b);
      // Long bands of shelter break up the short wind chop. Rotated, warped samples have no common repeat in the shot.
      vec2 drift=vec2(uTime*.035,-uTime*.016);
      float band=sin(vSea.x*.17+vSea.y*.13)+.6*sin(vSea.y*.31-vSea.x*.23+uTime*.048);
      vec2 broadUv=vSea*.019+vec2(band*.021,-band*.028);
      float wind=texture2D(uCaustic,broadUv+drift*.12).r;
      vec2 warped=vSea+vec2(1.8*sin(vSea.y*.21+wind)+wind*1.3,2.2*cos(vSea.x*.16-band));
      float wave=sin(warped.y*1.85+warped.x*.93+uTime*.8+wind);
      float crossing=sin(warped.x*2.65-warped.y*.63-uTime*.96+band);
      float shelter=smoothstep(-1.1,1.2,band+wind);
      vec3 normalWater=normalize(vec3(.055*crossing+.031*wave,1.,.073*wave+.018*crossing));
      vec3 viewWater=normalize(cameraPosition-vec3(vSea.x,0.,vSea.y));
      vec3 reflected=reflect(-viewWater,normalWater);
      float fresnel=.055+.31*pow(1.-max(0.,dot(viewWater,normalWater)),3.);
      vec3 tidal=mix(vec3(.37,.51,.35),vec3(.045,.395,.33),smoothstep(0.,1.55,distance));
      tidal=mix(tidal,vec3(.014,.22,.25),smoothstep(1.2,6.8,distance));
      tidal=mix(tidal,vec3(.012,.095,.14),smoothstep(4.,16.,distance));
      tidal*=.91+.15*shelter;
      float shallowBed=shoreField.g;
      tidal+=vec3(.10,.16,.105)*net*(1.-smoothstep(.5,4.,distance))*(.45+.55*shallowBed);
      vec3 sky=mix(vec3(.15,.36,.48),vec3(.54,.72,.75),clamp(1.-reflected.y,0.,1.));
      water=mix(tidal,sky,fresnel);
      float light=max(dot(reflected,normalize(vec3(-.38,.81,-.49))),0.);
      float crest=smoothstep(.62,.98,wave+.13*crossing);
      float broken=texture2D(uCaustic,mat2(.8,-.6,.6,.8)*warped*.105+drift*.2).r;
      water+=vec3(.75,.83,.65)*(.12*pow(light,20.)+.25*pow(light,90.)*crest*broken*shelter);
      float breaker=.34+.15*sin(uTime*.75+vSea.y*.46+wind*2.)+.12*broken;
      float lace=1.-smoothstep(.025,.15,abs(distance-breaker));
      water=mix(water,vec3(.76,.87,.76),lace*(.27+.49*broken)*(1.-smoothstep(.1,.7,fwidth(distance))));
      water=mix(water,vec3(.02,.13,.175),.54*smoothstep(4.,16.,distance));
      water=mix(water,vec3(.255,.450,.56),1.-smoothstep(.10,.33,viewWater.y));
      vec2 fromBoat=vSea-uLaunch.xy;
      vec2 course=vec2(sin(uLaunch.z),cos(uLaunch.z));
      float behind=-dot(fromBoat,course), across=dot(fromBoat,vec2(course.y,-course.x));
      float age=max(0.,behind-.72), width=.27+.18*age;
      float churn=smoothstep(.12,.58,broken*.72+b*.38+.11*sin(behind*8.+uTime*1.2));
      float wash=(1.-smoothstep(width*.08,width,abs(across+.11*sin(behind*2.3+uTime*.42))))*(.3+.7*churn);
      float feather=1.-smoothstep(.02,.16,abs(abs(across)-width-(broken-.3)*.27));
      float wakeFade=smoothstep(.7,1.25,behind)*(1.-smoothstep(1.4,3.9,behind));
      water=mix(water,vec3(.62,.8,.72),uLaunch.w*wakeFade*(.70*wash+.22*feather*churn));
      vec2 lampRay=vSea-vec2(1.5,-10.);
      float lampAngle=uTime*.27;
      float shaft=pow(max(0.,dot(normalize(lampRay+.0001),vec2(cos(lampAngle),sin(lampAngle)))),75.);
      water+=vec3(.13,.092,.033)*shaft*(1.-smoothstep(3.,22.,length(lampRay)))*(.45+.55*a);
      ` : `
      vec3 shallow = mix(vec3(.107,.45,.37),uShoreTint,.30);
      vec3 lagoon = mix(vec3(.028,.245,.317),uShoreTint,.22);
      water = mix(shallow,lagoon,smoothstep(0.,5.0,distance));
      water = mix(water,deep,smoothstep(4.,${OPEN_WATER}.0,distance));
      water += vec3(.31,.43,.37) * a * .085 * (1.-smoothstep(1.8,8.,distance));
      float foam = (1.-smoothstep(.06,.64,distance)) * (.27+.31*a);
      water = mix(water,vec3(.68,.83,.77),foam*.37);
      `}
      }
      diffuseColor.rgb=water;
      `);
  };
  sea.userData['seaTime']=time;
  material.addEventListener('dispose',()=>{field.dispose();caustic.dispose();});
  return sea;
}
export function advanceVillageSea(sea: THREE.Mesh, seconds: number): void {
  const time: { value: number } | undefined=sea.userData['seaTime'];if(time)time.value+=seconds;
}
