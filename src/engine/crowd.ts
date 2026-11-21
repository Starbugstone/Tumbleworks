import * as THREE from 'three';
import type { Color } from '../sim/types';
import { COLORS, crowdMaterial } from '../view/art';

/** All visible marbles share one draw, with the same paint in linear colour space as an individual marble. */
export class MarbleCrowd {
  private readonly mesh: THREE.InstancedMesh<THREE.SphereGeometry, THREE.MeshPhysicalMaterial>;
  private readonly room: Map<Color, number>;
  private readonly paints = new Map<Color, THREE.Color>();
  private readonly actors = new Map<number, THREE.Color>();
  private readonly matrix = new THREE.Matrix4();
  private readonly position = new THREE.Vector3();
  private readonly rotation = new THREE.Quaternion();
  private readonly size = new THREE.Vector3();
  private readonly forward = new THREE.Vector3(0, 0, 1);
  private readonly heading = new THREE.Vector3();
  private written = 0;

  constructor(parent: THREE.Object3D, counts: ReadonlyMap<Color, number>, readonly radius: number) {
    this.room = new Map(counts);
    let capacity = 0;
    for (const [color, count] of counts) {
      capacity += count;
      this.paints.set(color, new THREE.Color(COLORS[color].hex));
    }
    // Loop traffic is drawn in rows of tiny marbles. Keep the denser sphere on the larger Funnel pieces.
    const segments = radius <= .17 ? 12 : 16;
    this.mesh = new THREE.InstancedMesh(new THREE.SphereGeometry(radius, segments, segments * .75), crowdMaterial(), capacity);
    this.mesh.count = 0;
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Allocate the attribute before the stage precompiles the instanced shader, including for an empty loop.
    this.mesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacity * 3), 3).setUsage(THREE.DynamicDrawUsage);
    parent.add(this.mesh);
  }

  add(id: number, color: Color): void {
    const remaining = this.room.get(color) ?? 0;
    const paint = this.paints.get(color);
    if (!paint || remaining <= 0) throw new Error(`No room for another ${color} marble`);
    this.room.set(color, remaining - 1);
    this.actors.set(id, paint);
  }

  private write(paint: THREE.Color, x: number, y: number, z: number): void {
    this.matrix.compose(this.position.set(x, y, z), this.rotation, this.size);
    this.mesh.setMatrixAt(this.written, this.matrix);
    this.mesh.setColorAt(this.written, paint);
    this.written++;
  }

  set(id: number, x: number, y: number, z: number, qx: number, qy: number, qz: number, qw: number, scale = 1, tall = scale): void {
    if (scale <= .001) return;
    const paint = this.actors.get(id);
    if (!paint) return;
    this.rotation.set(qx, qy, qz, qw);
    this.size.set(scale, tall, scale);
    this.write(paint, x, y, z);
  }

  /** Draw a flying marble a little longer along its direction of travel. */
  setStretched(id: number, x: number, y: number, z: number, dx: number, dy: number, dz: number, along = 1.1, across = .95): void {
    const paint = this.actors.get(id);
    if (!paint) return;
    this.rotation.setFromUnitVectors(this.forward, this.heading.set(dx, dy, dz).normalize());
    this.size.set(across, across, along);
    this.write(paint, x, y, z);
  }

  commit(): void {
    this.mesh.count = this.written;
    if (this.written) {
      for (const attribute of [this.mesh.instanceMatrix, this.mesh.instanceColor!]) {
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(0, this.written * attribute.itemSize);
        attribute.needsUpdate = true;
      }
    }
    this.written = 0;
  }

  get count(): number { return this.actors.size; }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.material.dispose();
    this.mesh.geometry.dispose();
    this.mesh.dispose();
    this.actors.clear();
  }
}
