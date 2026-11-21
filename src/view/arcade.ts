import * as THREE from 'three';
import { candy } from '../engine/candy';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Point3 } from '../engine/physics';
import { boardBackdrop } from './yard-backdrop';
import { boardCounter } from './board-counter';

/** Inked enamel wells, laminated beech cut edges, and bronze at working joints. */
export const ARCADE = { deck: 0x4b5567, edge: 0x23283e, track: 0x26283a, lane: 0x354059, rim: 0xe9c181, ground: 0x758d94, cyan: 0x99c5ba, gold: 0xb98650, trim: 0x805739, shell: 0xc69a65 } as const;

/** A rectangle with round corners, drawn in x-y; laid flat, shape y becomes world -z. */
export function roundRect(target: THREE.Shape | THREE.Path, halfWidth: number, halfDepth: number, corner: number): void {
  target.moveTo(-halfWidth + corner, -halfDepth);
  target.lineTo(halfWidth - corner, -halfDepth);
  target.absarc(halfWidth - corner, -halfDepth + corner, corner, -Math.PI / 2, 0, false);
  target.lineTo(halfWidth, halfDepth - corner);
  target.absarc(halfWidth - corner, halfDepth - corner, corner, 0, Math.PI / 2, false);
  target.lineTo(-halfWidth + corner, halfDepth);
  target.absarc(-halfWidth + corner, halfDepth - corner, corner, Math.PI / 2, Math.PI, false);
  target.lineTo(-halfWidth, -halfDepth + corner);
  target.absarc(-halfWidth + corner, -halfDepth + corner, corner, Math.PI, Math.PI * 1.5, false);
}

/** Paints a whole part one colour, so parts in different colours can be fused into a single draw. */
export function tinted(geometry: THREE.BufferGeometry, hex: number): THREE.BufferGeometry {
  const flat = geometry.index ? geometry.toNonIndexed() : geometry;
  if (flat !== geometry) geometry.dispose();
  const color = new THREE.Color(hex), count = flat.getAttribute('position').count;
  const values = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) color.toArray(values, index * 3);
  flat.setAttribute('color', new THREE.BufferAttribute(values, 3));
  return flat;
}
/** Fuses tinted parts into one geometry and frees the parts. */
export function fuse(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  for (const part of parts) for (const name of Object.keys(part.attributes)) if (!['position', 'normal', 'color'].includes(name)) part.deleteAttribute(name);
  const fused = mergeGeometries(parts);
  for (const part of parts) part.dispose();
  if (!fused) throw new Error('Toy parts could not be fused');
  return fused;
}
/** The one glossy plastic every fused toy body is moulded in; its colours come from the parts. */
export const bodyPlastic = (): THREE.MeshStandardMaterial =>
  candy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.43, metalness: 0, envMapIntensity: 1.5 }), true);

/** A slab with round corners and a rolled edge, its top face at `top`. */
export function plate(halfWidth: number, halfDepth: number, top: number, height: number, corner: number, bevel: number, hex: number, centerZ = 0): THREE.BufferGeometry {
  const outline = new THREE.Shape();
  roundRect(outline, halfWidth, halfDepth, Math.min(corner, halfWidth, halfDepth));
  const geometry = new THREE.ExtrudeGeometry(outline, { depth: height - bevel * 2, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 3, curveSegments: 6 });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, top - height + bevel, centerZ);
  return tinted(geometry, hex);
}

/**
 * The toy's timber lip, narrow dark moulding and enamel deck. The deck's top is at y = 0. Returned as tinted parts,
 * so a scene fuses them with its own wells and towers into one draw.
 */
export function hull(halfWidth: number, halfDepth: number, centerZ: number, corner = 0.5, railed = true): THREE.BufferGeometry[] {
  // A raised rail runs round the deck like the lip of a tray: seen from above it is what gives the
  // flat top its depth.
  const ring = new THREE.Shape(), hole = new THREE.Path(), RAIL = 0.12, lip = 0.025, out = railed ? 0.13 : 0.06;
  roundRect(ring, halfWidth - 0.03, halfDepth - 0.03, corner);
  roundRect(hole, halfWidth - RAIL, halfDepth - RAIL, Math.max(0.05, corner - RAIL));
  ring.holes.push(hole);
  const rail = new THREE.ExtrudeGeometry(ring, { depth: 0.13 - lip, bevelEnabled: true, bevelThickness: lip, bevelSize: lip, bevelOffset: -lip, bevelSegments: 2, curveSegments: 6 });
  rail.rotateX(-Math.PI / 2);
  rail.translate(0, 0, centerZ);
  return [
    plate(halfWidth + out, halfDepth + out, -0.1, 0.52, corner + out, Math.min(0.16, out * 0.6), ARCADE.shell, centerZ),
    plate(halfWidth + 0.035, halfDepth + 0.035, -0.04, 0.3, corner + 0.07, 0.03, ARCADE.trim, centerZ),
    plate(halfWidth, halfDepth, 0, 0.5, corner, 0.1, ARCADE.deck, centerZ),
    ...(railed ? [tinted(rail, ARCADE.rim)] : (rail.dispose(), [])),
  ];
}

const CAUSTIC_SIZE = 128;
let causticPixels: Uint8Array<ArrayBuffer> | undefined;

/** Cell walls of a wrapped Voronoi pattern: sampled twice against itself it gives the light net on a shallow sea bed. */
function makeCausticPixels() {
  const SIZE = CAUSTIC_SIZE, POINTS = 18;
  const seeds = Array.from({ length: POINTS }, (_, index) => [(index * 0.618034 + 0.13) % 1 * SIZE, (index * 0.381966 * 3.7 + 0.41) % 1 * SIZE] as const);
  const data = new Uint8Array(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    let first = Infinity, second = Infinity;
    for (const [sx, sy] of seeds) {
      let dx = Math.abs(x - sx), dy = Math.abs(y - sy);
      if (dx > SIZE / 2) dx = SIZE - dx;
      if (dy > SIZE / 2) dy = SIZE - dy;
      const distance = Math.hypot(dx, dy);
      if (distance < first) { second = first; first = distance; } else if (distance < second) second = distance;
    }
    const edge = Math.max(0, 1 - (second - first) / 7);
    data.fill(Math.round(edge * edge * 255), (y * SIZE + x) * 4, (y * SIZE + x) * 4 + 4);
  }
  return data;
}

export function causticTexture(): THREE.DataTexture {
  causticPixels ??= makeCausticPixels();
  const map = new THREE.DataTexture(causticPixels.slice(), CAUSTIC_SIZE, CAUSTIC_SIZE, THREE.RGBAFormat);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.minFilter = THREE.LinearMipmapLinearFilter; map.magFilter = THREE.LinearFilter; map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

/** A workshop surface at the feet of the machine, with the island beyond its edge. */
export class ArcadeYard {
  readonly group = new THREE.Group();
  private readonly time = { value: 0 };
  private readonly surround: THREE.Texture;
  private readonly still: boolean;
  readonly corners: readonly Point3[];

  constructor(parent: THREE.Object3D, halfWidth: number, back: number, front: number, top: number) {
    const backdrop = boardBackdrop();
    this.still = backdrop.kind === 'land' || matchMedia('(prefers-reduced-motion: reduce)').matches;
    const counter = boardCounter(halfWidth, back, front, top, backdrop, this.time);
    this.surround = counter.surround;
    this.group.add(counter.mesh);
    parent.add(this.group);
    this.corners = [-1, 1].flatMap(side => [back, front].map(z => ({
      x: side * (halfWidth - .7), y: Math.max(top + .2, .4), z: z + (z === back ? .7 : -.7),
    })));
  }

  step(seconds: number): void { if (!this.still) this.time.value += seconds; }

  dispose(): void {
    this.surround.dispose();
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

