import * as THREE from 'three';
import type { Color } from '../sim/types';
import { marbleMaterial } from '../view/art';

export interface MarbleEntity {
  readonly color: Color;
  readonly mesh: THREE.Mesh;
}

/** One resource owner for marbles in every gameplay. Geometry is unit-sized, then scaled. */
export class MarbleFactory {
  private readonly sphere = new THREE.SphereGeometry(1, 28, 20);
  private readonly solids = new Map<Color, THREE.MeshPhysicalMaterial>();
  private readonly entities = new Set<MarbleEntity>();

  private material(color: Color): THREE.MeshPhysicalMaterial {
    const cache = this.solids;
    let result = cache.get(color);
    if (!result) {
      result = marbleMaterial(color);
      cache.set(color, result);
    }
    return result;
  }

  create(color: Color, radius: number): MarbleEntity {
    const mesh = new THREE.Mesh(this.sphere, this.material(color));
    mesh.scale.setScalar(radius);
    mesh.castShadow = true;
    const entity = { color, mesh };
    this.entities.add(entity);
    return entity;
  }

  release(entity: MarbleEntity): void {
    entity.mesh.removeFromParent();
    this.entities.delete(entity);
  }

  get count(): number { return this.entities.size; }

}
