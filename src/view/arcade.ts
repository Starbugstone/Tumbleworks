import * as THREE from 'three';
import type { Point3 } from '../engine/physics';
import { onLocaleChange } from '../preferences';

export const ARCADE = { deck: 0x164558, edge: 0x0d2338, track: 0x1c3140, lane: 0x1b5066, cyan: 0x66ffe3, gold: 0xffc857 } as const;
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

/** The ground under the toy: a soft pool of light that fades to the backdrop. No props, no grid. */
export class ArcadeYard {
  readonly group = new THREE.Group();

  constructor(parent: THREE.Object3D, _halfWidth: number, back: number, front: number) {
    parent.add(this.group);
    const center = (back + front) / 2;
    const map = texture(512, 512, (ctx) => {
      const glow = ctx.createRadialGradient(256, 256, 20, 256, 256, 250);
      glow.addColorStop(0, '#1a2f4c');
      glow.addColorStop(0.55, '#111f36');
      glow.addColorStop(1, '#0b172b');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, 512, 512);
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 90), new THREE.MeshStandardMaterial({ map, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, -1.15, center); floor.receiveShadow = true;
    this.group.add(floor);
  }

  dispose(): void {
    this.group.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
        material.dispose();
      }
    });
    this.group.removeFromParent();
  }
}

/** Bounded, reusable completion stamps: a readable pop at the actual loading point. */
export class ArcadePop {
  private map: THREE.CanvasTexture;
  private readonly unlisten: () => void;
  private readonly stamps: { sprite: THREE.Sprite; ring: THREE.Mesh<THREE.RingGeometry, THREE.MeshBasicMaterial>; age: number; y: number }[];
  private cursor = 0;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  constructor(parent: THREE.Object3D, word: () => string) {
    const paint = (ctx: CanvasRenderingContext2D): void => {
      ctx.fillStyle = '#ffd363'; ctx.strokeStyle = ink; ctx.lineWidth = 12;
      ctx.beginPath(); ctx.roundRect(10, 15, 492, 130, 32); ctx.fill(); ctx.stroke();
      ctx.fillStyle = ink; ctx.font = '900 78px "Trebuchet MS", sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(word(), 256, 85, 458);
    };
    this.map = texture(512, 160, paint);
    this.stamps = Array.from({ length: 4 }, () => {
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.map, depthTest: false, depthWrite: false, toneMapped: false }));
      sprite.renderOrder = 10;
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 32), new THREE.MeshBasicMaterial({ color: ARCADE.gold, transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2;
      parent.add(sprite, ring); sprite.visible = ring.visible = false;
      return { sprite, ring, age: 1, y: 0 };
    });
    this.unlisten = onLocaleChange(() => {
      const previous = this.map;
      this.map = texture(512, 160, paint);
      for (const { sprite } of this.stamps) sprite.material.map = this.map;
      previous.dispose();
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
    this.unlisten();
    for (const { sprite, ring } of this.stamps) {
      sprite.removeFromParent(); sprite.material.dispose();
      ring.removeFromParent(); ring.geometry.dispose(); ring.material.dispose();
    }
    this.map.dispose();
  }
}
