import * as THREE from 'three';
import type { Color } from '../sim/types';
import { crowdMaterial } from '../view/art';

interface Slot { readonly color: Color; readonly index: number }

/**
 * Many marbles, one draw call per colour. The pattern is baked into each colour's surface map,
 * so it rotates with the marble like every other marble in the workshop.
 */
export class MarbleCrowd {
  private readonly meshes = new Map<Color, THREE.InstancedMesh>();
  private readonly slots = new Map<number, Slot>();
  private readonly used = new Map<Color, number>();
  private readonly dummy = new THREE.Object3D();
  private readonly geometry: THREE.SphereGeometry;

  constructor(parent: THREE.Object3D, counts: ReadonlyMap<Color, number>, readonly radius: number) {
    this.geometry = new THREE.SphereGeometry(radius, 22, 16);
    for (const [color, count] of counts) {
      if (count === 0) continue;
      const mesh = new THREE.InstancedMesh(this.geometry, crowdMaterial(color), count);
      mesh.castShadow = true;
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.dummy.position.set(0, -100, 0);
      this.dummy.scale.setScalar(0.0001);
      this.dummy.updateMatrix();
      for (let index = 0; index < count; index++) mesh.setMatrixAt(index, this.dummy.matrix);
      parent.add(mesh);
      this.meshes.set(color, mesh);
      this.used.set(color, 0);
    }
  }

  add(id: number, color: Color): void {
    const mesh = this.meshes.get(color);
    const index = this.used.get(color) ?? 0;
    if (!mesh || index >= mesh.count) throw new Error(`No room for another ${color} marble`);
    this.used.set(color, index + 1);
    this.slots.set(id, { color, index });
  }

  set(id: number, x: number, y: number, z: number, qx: number, qy: number, qz: number, qw: number, scale = 1): void {
    const slot = this.slots.get(id);
    const mesh = slot && this.meshes.get(slot.color);
    if (!slot || !mesh) return;
    this.dummy.position.set(x, y, z);
    this.dummy.quaternion.set(qx, qy, qz, qw);
    this.dummy.scale.setScalar(scale);
    this.dummy.updateMatrix();
    mesh.setMatrixAt(slot.index, this.dummy.matrix);
  }

  commit(): void {
    for (const mesh of this.meshes.values()) mesh.instanceMatrix.needsUpdate = true;
  }

  get count(): number { return this.slots.size; }

  dispose(): void {
    for (const mesh of this.meshes.values()) {
      mesh.removeFromParent();
      (mesh.material as THREE.Material).dispose();
      mesh.dispose();
    }
    this.geometry.dispose();
    this.meshes.clear();
    this.slots.clear();
  }
}
