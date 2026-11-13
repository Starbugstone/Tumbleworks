import * as THREE from 'three';
import { candy } from '../engine/candy';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Point3 } from '../engine/physics';

/**
 * Indigo and violet under every toy: a hue none of the seven cargo colours uses, kept dark so yellow, orange
 * and white stand well clear of it. Rims are the light step, so edges catch the eye and fields stay quiet.
 */
export const ARCADE = { deck: 0x56316f, edge: 0x2e1846, track: 0x1c0f2e, lane: 0x3b2152, rim: 0xf8eedb, ground: 0x0e5578, cyan: 0x66ffe3, gold: 0xf0b93a, trim: 0xf0b93a, shell: 0xfbf3e3 } as const;

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
  candy(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.14, metalness: 0, envMapIntensity: 1.5 }), true);

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
 * The toy's body, as stacked mouldings: a dark hull that sits in the water, a cream band, and the violet
 * deck with a rolled edge that catches the key light. The deck's top is at y = 0. Returned as tinted parts,
 * so a scene fuses them with its own wells and towers into one draw.
 */
export function hull(halfWidth: number, halfDepth: number, centerZ: number, corner = 0.5, railed = true): THREE.BufferGeometry[] {
  // A raised lilac rail runs round the deck like the lip of a tray: seen from above it is what gives the
  // flat top its depth.
  const ring = new THREE.Shape(), hole = new THREE.Path(), RAIL = 0.22, lip = 0.035, out = railed ? 0.34 : 0.14;
  roundRect(ring, halfWidth - 0.03, halfDepth - 0.03, corner);
  roundRect(hole, halfWidth - RAIL, halfDepth - RAIL, Math.max(0.05, corner - RAIL));
  ring.holes.push(hole);
  const rail = new THREE.ExtrudeGeometry(ring, { depth: 0.13 - lip, bevelEnabled: true, bevelThickness: lip, bevelSize: lip, bevelOffset: -lip, bevelSegments: 2, curveSegments: 6 });
  rail.rotateX(-Math.PI / 2);
  rail.translate(0, 0, centerZ);
  return [
    // A thick ivory shell with a deep rolled edge, then a thin gold step, then the deck: three clean levels.
    plate(halfWidth + out, halfDepth + out, -0.1, 0.9, corner + out, Math.min(0.16, out * 0.6), ARCADE.shell, centerZ),
    plate(halfWidth + 0.07, halfDepth + 0.07, -0.04, 0.3, corner + 0.07, 0.03, ARCADE.trim, centerZ),
    plate(halfWidth, halfDepth, 0, 0.5, corner, 0.1, ARCADE.deck, centerZ),
    ...(railed ? [tinted(rail, ARCADE.rim)] : (rail.dispose(), [])),
  ];
}

const WATER_LEVEL = -1.15;
const SPAN = 72;

/** Cell walls of a wrapped Voronoi pattern: sampled twice against itself it gives the light net on a shallow sea bed. */
function causticTexture(): THREE.DataTexture {
  const SIZE = 128, POINTS = 18;
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
  const map = new THREE.DataTexture(data, SIZE, SIZE, THREE.RGBAFormat);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.minFilter = THREE.LinearMipmapLinearFilter; map.magFilter = THREE.LinearFilter; map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

/** A low-poly islet: sand, a green cap and, on the larger ones, a leaning palm. */
function islet(x: number, z: number, radius: number, turn: number): THREE.BufferGeometry[] {
  const parts: THREE.BufferGeometry[] = [];
  const put = (geometry: THREE.BufferGeometry, hex: number, matrix: THREE.Matrix4): void => { parts.push(tinted(geometry.applyMatrix4(matrix), hex)); };
  const place = new THREE.Matrix4(), at = new THREE.Vector3(), spin = new THREE.Quaternion(), size = new THREE.Vector3();
  put(new THREE.SphereGeometry(1, 9, 5, 0, Math.PI * 2, 0, Math.PI / 2), 0xf6e2ad,
    place.compose(at.set(x, WATER_LEVEL - 0.02, z), spin.setFromEuler(new THREE.Euler(0, turn, 0)), size.set(radius, radius * 0.24, radius * 0.82)));
  put(new THREE.SphereGeometry(1, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), 0x52b867,
    place.compose(at.set(x - 0.1, WATER_LEVEL + radius * 0.1, z - 0.1), spin, size.set(radius * 0.62, radius * 0.3, radius * 0.52)));
  if (radius < 1.8) return parts;
  const lean = new THREE.Euler(0.22 * Math.cos(turn), turn, 0.22 * Math.sin(turn));
  const crown = new THREE.Vector3(0, 1.5, 0).applyEuler(lean).add(at.set(x + 0.2, WATER_LEVEL + radius * 0.3, z + 0.1));
  put(new THREE.CylinderGeometry(0.06, 0.1, 1.5, 5).translate(0, 0.75, 0), 0x9a6a3c,
    place.compose(at.set(x + 0.2, WATER_LEVEL + radius * 0.3, z + 0.1), spin.setFromEuler(lean), size.set(1, 1, 1)));
  for (let leaf = 0; leaf < 6; leaf++) {
    const around = leaf / 6 * Math.PI * 2 + turn;
    put(new THREE.ConeGeometry(0.2, 0.95, 4).translate(0, 0.47, 0), leaf % 2 ? 0x2f9552 : 0x3fae5e,
      place.compose(crown, spin.setFromEuler(new THREE.Euler(0, -around, -1.95, 'YXZ')), size.set(1, 1, 0.3)));
  }
  return parts;
}

/**
 * The world around the toy: a shallow sunlit lagoon with low islets out toward the corners of the screen.
 * The water is one plane whose light net drifts slowly and whose foam laps the hull; it moves only while the
 * board itself is being drawn, so a resting board still costs nothing. It stays mid-dark and blue: cargo
 * never rests on it, but yellow, orange and white crates are seen against it.
 */
export class ArcadeYard {
  readonly group = new THREE.Group();
  private readonly time = { value: 0 };
  private readonly caustic = causticTexture();
  private readonly still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** Just inside the hull's four corners, where the end-of-level fountains stand. */
  readonly corners: readonly Point3[];

  constructor(parent: THREE.Object3D, halfWidth: number, back: number, front: number) {
    this.corners = [-1, 1].flatMap((side) => [back, front].map((z) => ({ x: side * (halfWidth - 0.7), y: 0.4, z: z + (z === back ? 0.7 : -0.7) })));
    parent.add(this.group);
    const center = (back + front) / 2, depth = (front - back) / 2;
    const SIZE = 256;
    const map = texture(SIZE, SIZE, (ctx) => {
      const sea = ctx.createRadialGradient(SIZE / 2, SIZE / 2, SIZE * 0.05, SIZE / 2, SIZE / 2, SIZE * 0.62);
      sea.addColorStop(0, '#2eaabd');
      sea.addColorStop(0.3, '#1f8fae');
      sea.addColorStop(0.62, '#16749b');
      sea.addColorStop(1, '#0e5578');
      ctx.fillStyle = sea; ctx.fillRect(0, 0, SIZE, SIZE);
    });
    const water = new THREE.MeshStandardMaterial({ map, roughness: 0.4, envMapIntensity: 0.7 });
    const board = new THREE.Vector4(halfWidth + 0.2, depth + 0.2, 0.7, 0);
    water.onBeforeCompile = (shader) => {
      shader.uniforms['uTime'] = this.time;
      shader.uniforms['uCaustic'] = { value: this.caustic };
      shader.uniforms['uBoard'] = { value: board };
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform sampler2D uCaustic;\nuniform vec4 uBoard;')
        .replace('#include <map_fragment>', /* glsl */`#include <map_fragment>
          vec2 sea = (vMapUv - 0.5) * ${SPAN.toFixed(1)};
          sea.y = -sea.y;
          float netA = texture2D(uCaustic, sea * 0.07 + vec2(uTime * 0.011, uTime * 0.007)).r;
          float netB = texture2D(uCaustic, sea * 0.1 - vec2(uTime * 0.009, -uTime * 0.006) + 0.37).r;
          float net = min(netA, netB);
          diffuseColor.rgb += vec3(0.5, 0.82, 0.9) * net * 0.3;
          vec2 edge = abs(sea) - uBoard.xy + uBoard.z;
          float shore = length(max(edge, 0.0)) + min(max(edge.x, edge.y), 0.0) - uBoard.z;
          float lap = 0.5 + 0.5 * sin(shore * 7.0 - uTime * 1.1 + netA * 3.0);
          float foam = smoothstep(0.34, 0.1, shore) + smoothstep(0.75, 0.45, shore) * step(0.62, lap) * 0.55;
          diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.86, 0.97, 0.98), clamp(foam, 0.0, 1.0) * step(0.0, shore) * 0.7);`);
    };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(SPAN, SPAN), water);
    floor.rotation.x = -Math.PI / 2; floor.position.set(0, WATER_LEVEL, center); floor.receiveShadow = true;
    this.group.add(floor);
    // Islets are placed from the board's own size, always outside it, so no level hides one under the toy.
    const reach = halfWidth + 3.2;
    const islets: readonly (readonly [number, number, number, number])[] = [
      [-reach - 2.5, -depth - 1, 2.1, 0.4], [reach + 3.4, -depth - 5, 2.6, 2.1], [-reach - 4.5, 1, 1.7, 1.2],
      [reach + 3.2, 3, 1.9, 0.2], [-reach - 2, depth + 4, 2.3, 2.6], [reach + 1.5, depth + 5, 1.8, 1.7],
      [-reach - 5, -depth - 9, 2.8, 0.9], [reach + 6, depth - 3, 1.5, 1.4],
    ];
    const land = new THREE.Mesh(fuse(islets.flatMap(([x, z, radius, turn]) => islet(x, center + z, radius, turn))),
      new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, flatShading: true, envMapIntensity: 0.5 }));
    this.group.add(land);
  }

  /** Lets the water drift; called only on frames the board draws. */
  step(seconds: number): void { if (!this.still) this.time.value += seconds; }

  dispose(): void {
    this.caustic.dispose();
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

