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
      float swellPhase=2.3*sin(vSea.x*.32+vSea.y*.21-uTime*.25)+1.7*cos(vSea.y*.39-vSea.x*.2);
      vec2 ripple = vec2(sin(vSea.x*1.8 + vSea.y*.74 + uTime*1.15+swellPhase), sin(vSea.y*3.1-vSea.x*.8-uTime*1.38+swellPhase*.83));
      vec2 fine = vec2(sin(vSea.x*5.3-vSea.y*3.5+uTime*1.7),cos(vSea.y*6.4+vSea.x*2.8-uTime*2.1));
      vec3 normalWater = normalize(vec3(ripple.x*.095+fine.x*.037, 1., ripple.y*.11+fine.y*.043));
      vec3 viewWater = normalize(cameraPosition-vec3(vSea.x, 0., vSea.y));
      vec3 reflected = reflect(-viewWater,normalWater);
      float fresnel = .06+.46*pow(1.-max(0.,dot(viewWater,normalWater)),3.);
      vec3 bedColor = mix(vec3(.46,.56,.36),vec3(.075,.44,.39),smoothstep(0.,1.45,distance));
      vec3 tidal = mix(bedColor,vec3(.012,.235,.27),smoothstep(1.,7.,distance));
      tidal=mix(tidal,vec3(.012,.095,.16),smoothstep(4.,16.,distance));
      float shallowBed = texture2D(uShore,clamp(fieldUv,0.,1.)).g;
      tidal += vec3(.29,.37,.18)*net*(1.-smoothstep(1.,6.,distance))*(.4+.6*shallowBed);
      vec3 sky = mix(vec3(.18,.42,.52),vec3(.65,.82,.83),clamp(1.-reflected.y,0.,1.));
      water = mix(tidal,sky,fresnel);
      vec3 sunDir=normalize(vec3(-.38,.81,-.49));
      float solar = max(dot(reflected,sunDir),0.);
      water+=vec3(1.,.86,.59)*(.17*pow(solar,18.)+.56*pow(solar,110.));
      float breaker=.34+.18*sin(uTime*.86+vSea.y*.5+a*2.)+.08*ripple.x;
      float lace=1.-smoothstep(.035,.20,abs(distance-breaker));
      water=mix(water,vec3(.83,.91,.83),lace*(.25+.47*b)*(1.-smoothstep(.1,.7,fwidth(distance))));
      water=mix(water,vec3(.255,.450,.56),1.-smoothstep(.10,.33,viewWater.y));
      vec2 fromBoat=vSea-uLaunch.xy;
      vec2 course=vec2(sin(uLaunch.z),cos(uLaunch.z));
      float behind=-dot(fromBoat,course), width=abs(dot(fromBoat,vec2(course.y,-course.x)));
      float wakeLine=1.-smoothstep(.04,.22,abs(width-.24*behind));
      water=mix(water,vec3(.72,.88,.81),wakeLine*uLaunch.w*smoothstep(.65,1.25,behind)*(1.-smoothstep(1.4,5.5,behind))*(.45+.26*b));
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
