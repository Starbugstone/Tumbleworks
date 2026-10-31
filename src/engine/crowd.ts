import * as THREE from 'three';
import type { Color } from '../sim/types';
import { crowdMaterial } from '../view/art';

interface Slot { readonly color: Color; readonly index: number }

/** Many plain glossy marbles, one draw per colour; only visible instances reach the GPU. */
export class MarbleCrowd {
  private readonly meshes = new Map<Color, THREE.InstancedMesh>();
  private readonly slots = new Map<number, Slot>();
  private readonly written = new Map<Color, number>();
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
    if (!mesh || index >= mesh.instanceMatrix.count) throw new Error(`No room for another ${color} marble`);
    this.used.set(color, index + 1);
    this.slots.set(id, { color, index });
  }

  set(id: number, x: number, y: number, z: number, qx: number, qy: number, qz: number, qw: number, scale = 1): void {
    const slot = this.slots.get(id);
    const mesh = slot && this.meshes.get(slot.color);
    if (!slot || !mesh || scale <= 0.001) return;
    this.dummy.position.set(x, y, z);
    this.dummy.quaternion.set(qx, qy, qz, qw);
    this.dummy.scale.setScalar(scale);
    this.dummy.updateMatrix();
    const index = this.written.get(slot.color) ?? 0;
    mesh.setMatrixAt(index, this.dummy.matrix);
    this.written.set(slot.color, index + 1);
  }

  /** Commit one complete frame of poses, packing out hidden marbles without changing actor IDs. */
  commit(): void {
    for (const [color, mesh] of this.meshes) {
      mesh.count = this.written.get(color) ?? 0;
      mesh.instanceMatrix.needsUpdate = true;
    }
    this.written.clear();
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
