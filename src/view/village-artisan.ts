import { Material, Vector3 } from 'three';
import type { VillageSceneryPiece } from '../world/village-plans';

/** The tagged sleeve, hand and tool share a shoulder pivot even after the landscape is batched. */
export function villageArtisan(material: Material, site: VillageSceneryPiece) {
  const clock = {value:0};
  const pivot = new Vector3(.178,.55,.016).multiplyScalar(site.scale)
    .applyAxisAngle(new Vector3(0,1,0),site.yaw).add(new Vector3(...site.position));
  const axis = new Vector3(Math.cos(site.yaw),0,-Math.sin(site.yaw));
  const previous = material.onBeforeCompile;
  material.onBeforeCompile = (shader,renderer) => {
    previous.call(material,shader,renderer);
    shader.uniforms.uWorkBeat=clock;
    shader.uniforms.uShoulder={value:pivot};
    shader.uniforms.uWorkAxis={value:axis};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      uniform float uWorkBeat; uniform vec3 uShoulder, uWorkAxis;`)
      .replace('#include <project_vertex>',`
        if(terrainSurface > 7.5) {
          vec3 arm = transformed-uShoulder;
          float angle = .53*uWorkBeat;
          transformed = uShoulder + arm*cos(angle) + cross(uWorkAxis,arm)*sin(angle)
            + uWorkAxis*dot(uWorkAxis,arm)*(1.-cos(angle));
        }
        #include <project_vertex>`);
  };
  return (seconds:number, reduced:boolean) => {clock.value=reduced?0:.5-.5*Math.cos(seconds*1.7);};
}
