import * as THREE from 'three';
import type { Color } from '../sim/types';
import { glassMaterial, marbleMaterial, twistGeometry, twistMaterial } from '../view/art';

export interface MarbleEntity {
  readonly color: Color;
  readonly mesh: THREE.Mesh;
  readonly twist: THREE.Mesh;
}

/** One resource owner for marbles in every gameplay. Geometry is unit-sized, then scaled. */
export class MarbleFactory {
  private readonly sphere = new THREE.SphereGeometry(1, 28, 20);
  private readonly inside = twistGeometry(0.88);
  private readonly shells = new Map<Color, THREE.MeshPhysicalMaterial>();
  private readonly solids = new Map<Color, THREE.MeshPhysicalMaterial>();
  private readonly twists = new Map<Color, THREE.MeshStandardMaterial>();
  private readonly entities = new Set<MarbleEntity>();
  private clear = true;

  private material(color: Color): THREE.MeshPhysicalMaterial {
    const cache = this.clear ? this.shells : this.solids;
    let result = cache.get(color);
    if (!result) {
      result = this.clear ? glassMaterial(color) : marbleMaterial(color);
      cache.set(color, result);
    }
    return result;
  }

  create(color: Color, radius: number): MarbleEntity {
    let inner = this.twists.get(color);
    if (!inner) {
      inner = twistMaterial(color);
      this.twists.set(color, inner);
    }
    const mesh = new THREE.Mesh(this.sphere, this.material(color));
    mesh.scale.setScalar(radius);
    mesh.castShadow = true;
    const twist = new THREE.Mesh(this.inside, inner);
    twist.visible = this.clear;
    mesh.add(twist);
    const entity = { color, mesh, twist };
    this.entities.add(entity);
    return entity;
  }

  release(entity: MarbleEntity): void {
    entity.mesh.removeFromParent();
    this.entities.delete(entity);
  }

  useSolidGlass(): boolean {
    if (!this.clear) return false;
    this.clear = false;
    for (const entity of this.entities) {
      entity.mesh.material = this.material(entity.color);
      entity.twist.visible = false;
    }
    return true;
  }

  get count(): number { return this.entities.size; }
}
