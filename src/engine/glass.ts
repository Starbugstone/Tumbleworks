import * as THREE from 'three';

/**
 * Clear plastic seen from both sides. Three draws a double-sided transparent material in two passes and
 * flags the material for a shader rebuild before each one, on every frame. Two fixed one-sided meshes draw
 * the same picture without that cost: the back one is created first, so at equal depth it sorts first, as
 * three's own back-then-front passes do. Flat glass shows one side at a time and needs a single pass.
 */
export class Glass<T extends THREE.Material = THREE.Material> {
  readonly back: T;
  readonly front: T;
  /** For flat pieces only: one double-sided pass is the same picture when no pixel sees both faces. */
  readonly flat: T;

  constructor(material: T) {
    this.front = material;
    this.back = material.clone() as T;
    this.flat = material.clone() as T;
    this.front.side = THREE.FrontSide;
    this.back.side = THREE.BackSide;
    this.flat.side = THREE.DoubleSide;
    this.flat.forceSinglePass = true;
  }

  mesh(geometry: THREE.BufferGeometry, renderOrder = 0): THREE.Group {
    const group = new THREE.Group();
    for (const material of [this.back, this.front]) {
      const mesh = new THREE.Mesh(geometry, material);
      mesh.renderOrder = renderOrder;
      group.add(mesh);
    }
    return group;
  }
}
