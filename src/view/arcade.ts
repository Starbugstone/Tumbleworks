import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Point3 } from '../engine/physics';

export const ARCADE = { deck: 0x164558, edge: 0x0d2338, track: 0x203747, cyan: 0x66ffe3, gold: 0xffc857 } as const;
const ink = '#102338';

function texture(width: number, height: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Arcade artwork needs a canvas');
  draw(ctx);
  const map = new THREE.CanvasTexture(canvas);
  map.colorSpace = THREE.SRGBColorSpace;
  return map;
}

export function stencil(text: string, width: number, height: number, color = '#b3e6e0'): THREE.Mesh {
  const map = texture(512, 128, (ctx) => {
    ctx.fillStyle = color;
    ctx.font = '900 74px "Trebuchet MS", sans-serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(text, 256, 68, 490);
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, toneMapped: false }));
  mesh.rotation.x = -Math.PI / 2;
  return mesh;
}

/** A small arcade loading yard, owned and disposed with its scene. No extra lights or render passes. */
export class ArcadeYard {
  readonly group = new THREE.Group();
  private readonly bulbs: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();

  constructor(parent: THREE.Object3D, halfWidth: number, back: number, front: number) {
    parent.add(this.group);
    const center = (back + front) / 2;
    const depth = front - back;
    const material = new THREE.MeshStandardMaterial({ color: ARCADE.edge, roughness: 0.68 });
    const add = (w: number, h: number, d: number, x: number, y: number, z: number, mat: THREE.Material = material): THREE.Mesh => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      mesh.position.set(x, y, z); mesh.receiveShadow = true;
      this.group.add(mesh); return mesh;
    };
    const map = texture(512, 512, (ctx) => {
      ctx.fillStyle = '#101d30'; ctx.fillRect(0, 0, 512, 512);
      ctx.strokeStyle = '#21364c'; ctx.lineWidth = 2;
      for (let i = 0; i < 512; i += 64) {
        ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 512); ctx.moveTo(0, i); ctx.lineTo(512, i); ctx.stroke();
      }
      ctx.fillStyle = '#345166';
      for (let x = 0; x < 512; x += 128) for (let y = 0; y < 512; y += 128) ctx.fillRect(x - 3, y - 3, 6, 6);
    });
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(16, 16);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map, roughness: 0.9 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -1.15, center); floor.receiveShadow = true;
    this.group.add(floor);
    const trim = new THREE.MeshBasicMaterial({ color: ARCADE.cyan, toneMapped: false });
    const gold = new THREE.MeshStandardMaterial({ color: ARCADE.gold, roughness: 0.4 });
    for (const side of [-1, 1]) {
      add(0.15, 0.14, depth - 0.25, side * (halfWidth - 0.08), -0.53, center, trim);
      // Low side bumpers and inset amber hazard stripes frame, rather than cover, the play area.
      for (const z of [back + 0.3, front - 0.3]) {
        add(0.38, 0.65, 0.6, side * (halfWidth - 0.15), -0.1, z);
        add(0.4, 0.09, 0.48, side * (halfWidth - 0.15), 0.25, z, gold);
      }
      for (let z = back + 1; z < front - 0.6; z += 0.55) {
        const stripe = add(0.22, 0.02, 0.25, side * (halfWidth - 0.28), 0.015, z, gold);
        stripe.rotation.y = 0.4;
      }
      // Machinery on the ground beyond the edges gives the toy a place in the world.
      for (let i = 0; i < 3; i++) {
        add(0.6, 0.6 + i * 0.14, 0.85, side * (halfWidth + 1.5), -0.82 + i * 0.07, back + 1.3 + i * 1.05);
        add(0.62, 0.08, 0.8, side * (halfWidth + 1.5), -0.5 + i * 0.14, back + 1.3 + i * 1.05, gold);
      }
    }
    this.bulbs = new THREE.InstancedMesh(new THREE.BoxGeometry(0.13, 0.09, 0.16), new THREE.MeshBasicMaterial({ color: 0x488a91, toneMapped: false }), 36);
    for (let i = 0; i < 36; i++) {
      const side = i < 18 ? -1 : 1;
      this.dummy.position.set(side * (halfWidth - 0.08), 0.04, back + 0.8 + (i % 18) / 17 * (depth - 1.6));
      this.dummy.updateMatrix(); this.bulbs.setMatrixAt(i, this.dummy.matrix);
    }
    this.group.add(this.bulbs);
    // Repeated trim shares a draw call per material, rather than one per stripe or bumper.
    const batches = new Map<THREE.Material, THREE.Mesh<THREE.BufferGeometry, THREE.Material>[]>();
    for (const child of this.group.children) {
      if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh || Array.isArray(child.material)) continue;
      const meshes = batches.get(child.material) ?? [];
      meshes.push(child); batches.set(child.material, meshes);
    }
    for (const [material, meshes] of batches) {
      if (meshes.length < 2) continue;
      const parts = meshes.map((mesh) => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
      const merged = mergeGeometries(parts);
      for (const part of parts) part.dispose();
      if (!merged) continue;
      for (const mesh of meshes) { mesh.geometry.dispose(); mesh.removeFromParent(); }
      const mesh = new THREE.Mesh(merged, material); mesh.receiveShadow = true; this.group.add(mesh);
    }
  }

  dispose(): void {
    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.InstancedMesh) object.dispose();
      geometries.add(object.geometry);
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    });
    for (const geometry of geometries) geometry.dispose();
    for (const material of materials) {
      if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
      material.dispose();
    }
    this.group.removeFromParent();
  }
}

/** Bounded, reusable completion stamps: a readable pop at the actual loading point. */
export class ArcadePop {
  private readonly map: THREE.CanvasTexture;
  private readonly stamps: { sprite: THREE.Sprite; ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; age: number; y: number }[];
  private cursor = 0;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(parent: THREE.Object3D, word: string) {
    this.map = texture(512, 160, (ctx) => {
      ctx.fillStyle = '#ffd363'; ctx.strokeStyle = ink; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.roundRect(10, 15, 492, 130, 32); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ink; ctx.font = '900 78px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(word, 256, 85, 458);
    });
    this.stamps = Array.from({ length: 4 }, () => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.map, depthTest: false, depthWrite: false, toneMapped: false }));
      sprite.renderOrder = 10;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), new THREE.MeshBasicMaterial({ color: ARCADE.gold, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      parent.add(sprite, ring); sprite.visible = ring.visible = false;
      return { sprite, ring, age: 1, y: 0 };
    });
  }

  burst(at: Point3): void {
    const stamp = this.stamps[this.cursor++ % this.stamps.length]!;
    stamp.age = 0; stamp.y = at.y;
    stamp.sprite.position.set(at.x, at.y, at.z);
    stamp.ring.position.set(at.x, at.y - 0.35, at.z);
    this.draw(stamp);
  }
  step(seconds: number): void { for (const stamp of this.stamps) { stamp.age = Math.min(1, stamp.age + seconds / 0.85); this.draw(stamp); } }
  private draw(stamp: typeof this.stamps[number]): void {
    const t = stamp.age;
    stamp.sprite.visible = t < 1;
    stamp.ring.visible = t < 0.7 && !this.reducedMotion;
    const pop = this.reducedMotion ? 1 : Math.min(1, t * 9) + Math.sin(Math.min(1, t * 3) * Math.PI) * 0.12;
    stamp.sprite.scale.set(2.2 * pop, 0.69 * pop, 1);
    stamp.sprite.position.y = stamp.y + (this.reducedMotion ? 0 : t * 0.8);
    stamp.sprite.material.opacity = Math.min(1, (1 - t) * 4);
    stamp.ring.scale.setScalar(0.5 + t * 1.5);
    stamp.ring.material.opacity = Math.max(0, 0.8 - t * 1.15);
  }
  clear(): void { for (const stamp of this.stamps) { stamp.age = 1; this.draw(stamp); } }
  dispose(): void {
    for (const { sprite, ring } of this.stamps) {
      sprite.removeFromParent(); sprite.material.dispose();
      ring.removeFromParent(); ring.geometry.dispose(); ring.material.dispose();
    }
    this.map.dispose();
  }
}
