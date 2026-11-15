import * as THREE from 'three';
import { DEEP_SEA } from '../engine/stage';
import { sunny } from './village-terrain';
import { causticTexture } from './arcade';
import { distanceToPolygon, pointInPolygon, type VillageTerrain } from '../world/village-terrain';

/** One opaque surface continues through the harbour. The shore field is baked once, never evaluated per frame. */
export function villageSea(level: number, shore: number, terrain?: VillageTerrain): THREE.Mesh {
  const geometry = new THREE.PlaneGeometry(384, 384); geometry.rotateX(-Math.PI / 2);
  const material = new THREE.MeshBasicMaterial({ color: sunny(shore,new THREE.Color()), fog: false, toneMapped: false });
  const sea = new THREE.Mesh(geometry,material);sea.name='village-sea';sea.position.y=level;
  if (!terrain) { material.color.set(DEEP_SEA); return sea; }
  const size=128, span=Math.max(...terrain.spec.size)+32, data=new Uint8Array(size*size*4);
  for(let z=0;z<size;z++)for(let x=0;x<size;x++){
    const wx=((x+.5)/size-.5)*span,wz=((z+.5)/size-.5)*span;
    const inside=pointInPolygon(terrain.spec.outline,wx,wz);
    let distance=inside?0:Math.max(0,distanceToPolygon(terrain.spec.outline,wx,wz)-2.6);
    if(inside)for(const f of terrain.spec.features)if(f.kind==='hole'&&pointInPolygon(f.polygon,wx,wz))distance=Math.min(4,distanceToPolygon(f.polygon,wx,wz));
    const i=(z*size+x)*4;data[i]=Math.min(255,Math.round(distance/18*255));data[i+3]=255;
  }
  const field=new THREE.DataTexture(data,size,size,THREE.RGBAFormat);field.minFilter=field.magFilter=THREE.LinearFilter;field.needsUpdate=true;
  const caustic=causticTexture(),time={value:0};
  material.color.set(0xffffff);
  material.onBeforeCompile=shader=>{
    shader.uniforms['uShore']={value:field};shader.uniforms['uFieldSpan']={value:span};shader.uniforms['uCaustic']={value:caustic};shader.uniforms['uTime']=time;
    shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying vec2 vSea;').replace('#include <begin_vertex>','#include <begin_vertex>\nvSea = position.xz;');
    shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying vec2 vSea; uniform sampler2D uShore; uniform sampler2D uCaustic; uniform float uTime; uniform float uFieldSpan;')
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
