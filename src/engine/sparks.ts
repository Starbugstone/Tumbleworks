import * as THREE from 'three';
import type { Point3 } from './physics';

const CAPACITY = 96;
const LIFETIME = 0.46;

/** Small completion sparks, pooled across a board and cleared whenever presentation jumps. */
export class Sparks {
  private readonly mesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ toneMapped: false }), CAPACITY,
  );
  private readonly particles = Array.from({ length: CAPACITY }, () => ({
    age: LIFETIME, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0,
  }));
  private readonly dummy = new THREE.Object3D();
  private readonly color = new THREE.Color();
  private cursor = 0;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(parent: THREE.Object3D) {
    this.mesh.frustumCulled = false;
    parent.add(this.mesh);
    this.clear();
  }

  burst(at: Point3, color: number, count = 12): void {
    if (this.reducedMotion) return;
    for (let i = 0; i < Math.min(count, CAPACITY); i++) {
      const index = this.cursor++ % CAPACITY;
      const angle = i * Math.PI * 2 / count;
      const speed = 1.5 + (i % 3) * 0.45;
      Object.assign(this.particles[index]!, { age: 0, x: at.x, y: at.y, z: at.z,
        vx: Math.cos(angle) * speed, vy: 2.4 + (i % 4) * 0.4, vz: Math.sin(angle) * speed });
      this.mesh.setColorAt(index, this.color.setHex(i % 3 === 0 ? 0xfff8d5 : color));
    }
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.draw();
  }

  step(seconds: number): void {
    if (!this.mesh.visible) return;
    for (const p of this.particles) {
      if (p.age >= LIFETIME) continue;
      p.age += seconds;
      p.x += p.vx * seconds;
      p.y += p.vy * seconds;
      p.z += p.vz * seconds;
      p.vy -= 9 * seconds;
    }
    this.draw();
  }

  private draw(): void {
    this.mesh.visible = this.particles.some((p) => p.age < LIFETIME);
    this.particles.forEach((p, index) => {
      const size = Math.max(0, 1 - p.age / LIFETIME) * 0.12;
      this.dummy.position.set(p.x, p.y, p.z);
      this.dummy.rotation.set(p.age * 7, index, p.age * 11);
      this.dummy.scale.set(size, size * 0.45, size);
      this.dummy.updateMatrix();
      this.mesh.setMatrixAt(index, this.dummy.matrix);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  clear(): void {
    for (const p of this.particles) p.age = LIFETIME;
    this.draw();
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.mesh.dispose();
    this.mesh.geometry.dispose();
    this.mesh.material.dispose();
  }
}
