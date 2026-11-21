import { Material, Mesh, Object3D, Vector3 } from 'three';
import type { VillageSceneryPiece } from '../world/village-plans';

export const ARTISAN_SURFACE = 8;

export function markVillageArtisan(model: Object3D, index: number): void {
  const surface = ARTISAN_SURFACE + index;
  if (surface > 255) throw new Error('The village artisan tag must fit in a byte');
  model.traverse(object => { if (object instanceof Mesh) object.userData.artisanSurface = surface; });
}

/** The baked landscape shares one shader and swing clock. Each sleeve keeps its own pivot and axis. */
export function villageArtisans(material: Material, sites: readonly VillageSceneryPiece[]) {
  const clock = { value: 0 };
  const up = new Vector3(0,1,0);
  const shoulders = sites.map(({ scale, yaw, position }) => new Vector3(.178,.55,.016).multiplyScalar(scale)
    .applyAxisAngle(up,yaw).add(new Vector3(...position)));
  const axes = sites.map(({ yaw }) => new Vector3(Math.cos(yaw),0,-Math.sin(yaw)));
  const previous = material.onBeforeCompile;
  const cacheKey = material.customProgramCacheKey.bind(material);
  const shaderKey = `${cacheKey()}-artisans-${sites.length}`;
  material.customProgramCacheKey = () => shaderKey;
  material.onBeforeCompile = (shader,renderer) => {
    previous.call(material,shader,renderer);
    shader.uniforms.uWorkBeat=clock;
    shader.uniforms.uShoulders={value:shoulders};
    shader.uniforms.uWorkAxes={value:axes};
    shader.vertexShader=shader.vertexShader.replace('#include <common>',`#include <common>
      uniform float uWorkBeat;
      uniform vec3 uShoulders[${sites.length}], uWorkAxes[${sites.length}];
      vec3 workSwing(vec3 arm, vec3 axis) {
          float angle = .53*uWorkBeat;
          return arm*cos(angle) + cross(axis,arm)*sin(angle) + axis*dot(axis,arm)*(1.-cos(angle));
      }`)
      .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        int artisan = int(terrainSurface + .5) - ${ARTISAN_SURFACE};
        if (artisan >= 0) objectNormal = workSwing(objectNormal,uWorkAxes[artisan]);`)
      .replace('#include <begin_vertex>',`#include <begin_vertex>
        if (artisan >= 0) {
          vec3 shoulder = uShoulders[artisan];
          transformed = shoulder + workSwing(transformed-shoulder,uWorkAxes[artisan]);
        }
      `);
  };
  return (seconds:number, reduced:boolean) => {clock.value=reduced?0:.5-.5*Math.cos(seconds*1.7);};
}
