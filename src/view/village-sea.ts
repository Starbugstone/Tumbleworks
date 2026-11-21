import * as THREE from 'three';
import { DEEP_SEA } from '../engine/stage';
import { sunny } from './village-terrain';
import { causticTexture } from './arcade';
import { distanceToPolygon, pointInPolygon, terrainHeightAt, type VillageTerrain } from '../world/village-terrain';

/** One opaque surface continues through the harbour. The shore field is baked once, never evaluated per frame. */
export function villageSea(level: number, shore: number, terrain?: VillageTerrain, wake?: THREE.Vector4): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(384, 384); geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: sunny(shore,new THREE.Color()), fog: false, toneMapped: false });
  const sea = new THREE.Mesh(geometry,material);sea.name='village-sea';sea.position.y=level;
  if (!terrain) { material.color.set(DEEP_SEA); return sea; }
  const size=wake ? 256 : 128, span=Math.max(...terrain.spec.size)+32, data=new Uint8Array(size*size*4);
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
    const wx=((x+.5)/size-.5)*span,wz=((z+.5)/size-.5)*span;
    const inside=pointInPolygon(terrain.spec.outline,wx,wz);
    let distance=inside?0:Math.max(0,distanceToPolygon(terrain.spec.outline,wx,wz)-2.6);
    if(inside)for(const f of terrain.spec.features)if(f.kind==='hole'&&pointInPolygon(f.polygon,wx,wz))distance=Math.min(4,distanceToPolygon(f.polygon,wx,wz));
    const i=(z*size+x)*4;
    if (wake) {
      // Signed shoreline distance keeps foam parallel to the winding coves.
      distance = distanceToPolygon(terrain.spec.outline,wx,wz) * (inside ? -1 : 1);
      for (const f of terrain.spec.features) if (f.kind === 'hole') {
        const d = distanceToPolygon(f.polygon,wx,wz);
        distance = Math.max(distance,pointInPolygon(f.polygon,wx,wz) ? d : -d);
      }
      const bed = terrainHeightAt(terrain, wx, wz);
      data[i+1] = bed === undefined ? 255 : Math.round(255 * THREE.MathUtils.clamp((level - bed) / .28, 0, 1));
      distance = Math.max(0,distance + 1.15);
    }
    data[i]=Math.min(255,Math.round(distance/18*255));data[i+3]=255;
  }
  const field=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);field.minFilter=field.magFilter=THREE.LinearFilter;field.needsUpdate=true;
  const caustic=causticTexture(),time={value:0};
  material.color.set(0xffffff);
  material.onBeforeCompile=shader=>{
    shader.uniforms['uLaunch'] = {value: wake ?? new THREE.Vector4()};
    shader.uniforms['uShore']={value:field};shader.uniforms['uFieldSpan']={value:span};shader.uniforms['uCaustic']={value:caustic};shader.uniforms['uTime']=time;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vSea;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSea = position.xz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vSea; uniform sampler2D uShore; uniform sampler2D uCaustic; uniform float uTime; uniform float uFieldSpan; uniform vec4 uLaunch;')
      .replace('#include <color_fragment>',/* glsl */`
      vec2 fieldUv = vSea / uFieldSpan + .5;
      float distance = texture2D(uShore, clamp(fieldUv, 0.0, 1.0)).r * 18.0;
      float outside = step(.5, max(abs(fieldUv.x-.5),abs(fieldUv.y-.5)));
      distance += smoothstep(.36,.5,max(abs(fieldUv.x-.5),abs(fieldUv.y-.5)))*18.0;
      distance = mix(distance,18.0,outside);
      float a = texture2D(uCaustic, vSea * .25 + vec2(uTime*.009, uTime*.004)).r;
      float b = texture2D(uCaustic, vSea * .31 + vec2(-uTime*.006, uTime*.005) + .37).r;
      vec3 shallow = vec3(.17,.68,.58);
      vec3 lagoon = vec3(.015,.40,.49);
      vec3 deep = vec3(${new THREE.Color(DEEP_SEA).toArray().map(value=>value.toFixed(6)).join(',')});
      vec3 water = mix(shallow,lagoon,smoothstep(0.0,5.0,distance));
      water = mix(water,deep,smoothstep(4.0,18.0,distance));
      float net = min(a,b);
      water += vec3(.40,.55,.39) * net * .13 * (1.0-smoothstep(2.0,10.0,distance));
      float swell=sin(vSea.x*2.1+vSea.y*1.3+uTime*.6+a*.8);
      water += vec3(.025,.065,.08)*pow(max(0.0,swell),24.0)*.06*(1.0-smoothstep(10.0,18.0,distance));
      float foam=(1.0-smoothstep(.05,.5,distance))*(.4+.35*a);
      water=mix(water,vec3(.73,.88,.77),foam*.38);
      ${wake ? `
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
      float shallowBed=texture2D(uShore,clamp(fieldUv,0.,1.)).g;
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
      ` : ''}
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
