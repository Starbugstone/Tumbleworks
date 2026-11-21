import * as THREE from 'three';
import { candy, moulded } from '../engine/candy';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { Color } from '../sim/types';
import { COLORS, decal } from './art';

interface Dimensions { bedWidth: number; bedLength: number; bedHeight: number; cabLength: number }

/** One level owns these materials through its meshes; never reuse them after clearing the level. */
export function lorryMaterials() {
  const rubber = new THREE.MeshStandardMaterial({ color: 0x20243a, roughness: 0.8 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xbccbdc, roughness: 0.3, metalness: 0.45 });
  return {
    paints: new Map<Color, THREE.MeshStandardMaterial>(),
    ivory: candy(new THREE.MeshStandardMaterial({ color: 0xfff7e5, roughness: 0.35, vertexColors: true })),
    trim: new THREE.MeshStandardMaterial({ color: 0xfff7e5, roughness: 0.35 }),
    rubber, chrome,
    // Ordinary and instanced geometry need separate material identities to keep shader variants stable.
    tires: rubber.clone(), hubs: chrome.clone(),
    windowMaterial: new THREE.MeshStandardMaterial({ color: 0x19364e, roughness: 0.12 }),
    lights: new THREE.MeshBasicMaterial({ color: 0xffefb0, toneMapped: false }),
  };
}
export type LorryMaterials = ReturnType<typeof lorryMaterials>;

/**
 * How far the tub walls stand above the bed, and how tall a cargo brick is. The walls are the taller, so the lit
 * wall and the cab lay real shadows across the bed and, more narrowly, across the load: that is what shows the
 * tub's depth from a camera that looks almost straight down.
 */
export const TUB = { wall: 0.6, cargo: 0.42, inset: 0.11 } as const;

/**
 * One stretch of cargo: a chamfered brick whose length is set by moving its two ends apart, so the chamfers
 * keep their size and their shading at every length. Stretching a rounded box instead skewed its edges and
 * made the colour drift as a lorry filled. Sides fall darker towards the bed; the top stays one clean colour.
 */
export function cargoBrick(width: number, height = TUB.cargo, chamfer = 0.085): { geometry: THREE.BufferGeometry; setLength: (length: number) => void } {
  const x = width / 2, shoulder = height - chamfer;
  // Corner order round the brick: near-left, near-right, far-right, far-left (near is +z).
  const ring = (halfX: number, y: number, inner: boolean) => [[-halfX, y, 1, inner], [halfX, y, 1, inner], [halfX, y, -1, inner], [-halfX, y, -1, inner]] as const;
  const top = ring(x - chamfer, height, true), rim = ring(x, shoulder, false), foot = ring(x, 0, false);
  type Corner = readonly [number, number, number, boolean];
  const corners: Corner[] = [];
  const tones: number[] = [];
  const quad = (a: Corner, b: Corner, c: Corner, d: Corner, toneTop: number, toneBottom: number): void => {
    corners.push(a, b, c, a, c, d);
    tones.push(toneTop, toneTop, toneBottom, toneTop, toneBottom, toneBottom);
  };
  corners.push(top[0], top[1], top[2], top[0], top[2], top[3]);
  tones.push(1, 1, 1, 1, 1, 1);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    quad(top[j]!, top[i]!, rim[i]!, rim[j]!, 1.05, 1.05);
    quad(rim[j]!, rim[i]!, foot[i]!, foot[j]!, 0.86, 0.5);
  }
  const position = new THREE.BufferAttribute(new Float32Array(corners.length * 3), 3);
  const color = new THREE.BufferAttribute(new Float32Array(corners.flatMap((_, index) => [tones[index]!, tones[index]!, tones[index]!])), 3);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', position);
  geometry.setAttribute('color', color);
  let current = -1;
  const setLength = (length: number): void => {
    if (Math.abs(length - current) < 0.0005) return;
    current = length;
    // A stretch shorter than two chamfers keeps a sliver of flat top between them.
    const back = Math.min(chamfer, length * 0.3);
    corners.forEach(([cx, cy, end, inner], index) => position.setXYZ(index, cx, cy, end * (length / 2 - (inner ? back : 0))));
    position.needsUpdate = true;
    geometry.computeVertexNormals();
  };
  setLength(1);
  return { geometry, setLength };
}

/**
 * Cab faces local -z; the open tail faces the loop at +z. Cargo is added separately.
 */
export function lorry(target: Color, dimensions: Dimensions, materials: LorryMaterials, latchColor: Color | null = null, decals?: Map<Color, THREE.MeshBasicMaterial>): { body: THREE.Group; setWheelTravel: (distance: number) => void; setLatched: (latched: boolean) => void; setUnloading: (state: 'pouring' | 'waiting' | null, time: number) => void } {
  const { bedWidth: w, bedLength: length, bedHeight: h, cabLength: cab } = dimensions;
  const body = new THREE.Group();
  let paint = materials.paints.get(target);
  if (!paint) { paint = candy(new THREE.MeshStandardMaterial({ color: COLORS[target].hex, roughness: 0.45, vertexColors: true })); materials.paints.set(target, paint); }
  const { ivory, rubber, chrome, windowMaterial, lights } = materials;
  const box = (width: number, height: number, depth: number, x: number, y: number, z: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 3, Math.min(0.12, height / 3, depth / 3, width / 3)), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    body.add(mesh);
    return mesh;
  };
  box(w * 0.85, 0.14, length + cab, 0, 0.15, -cab / 2, rubber);
  // The bed is a plain slab cut into strips across its width, darkened a little where it meets each wall.
  const bed = new THREE.BoxGeometry(w - 0.04, h * 0.55, length, 8, 1, 1).toNonIndexed();
  const bedAt = bed.getAttribute('position');
  const shade = new Float32Array(bedAt.count * 3);
  const enamel = new THREE.Color(0x4a5967);
  for (let i = 0; i < bedAt.count; i++) {
    const fromWall = Math.max(0, (w / 2 - TUB.inset - Math.abs(bedAt.getX(i))) / 0.14);
    const light = bedAt.getY(i) > 0 ? 0.8 + 0.2 * Math.min(1, fromWall) : 0.7;
    shade.set([enamel.r * light, enamel.g * light, enamel.b * light], i * 3);
  }
  bed.setAttribute('color', new THREE.BufferAttribute(shade, 3));
  const floor = new THREE.Mesh(bed, ivory);
  floor.position.set(0, h * 0.72, 0);
  body.add(floor);
  for (const side of [-1, 1]) {
    box(0.09, TUB.wall + 0.1, length + 0.06, side * (w / 2 - 0.045), h + TUB.wall / 2 - 0.05, -0.03, paint);
    box(0.06, 0.05, length - 0.16, side * (w / 2 - 0.045), h + TUB.wall + 0.012, 0, ivory);
  }
  const cabZ = -(length + cab) / 2;
  // The headboard closes the tub against the cab.
  box(w, TUB.wall + 0.16, 0.1, 0, h + TUB.wall / 2 - 0.02, -length / 2 - 0.05, paint);
  // A tall cab: its windscreen and nose face the player, the one upright face this view shows.
  const roof = 1.08;
  box(w, 0.5, cab, 0, 0.44, cabZ, paint);
  box(w * 0.86, roof - 0.62, cab * 0.74, 0, (roof + 0.62) / 2, cabZ + 0.06, paint);
  box(w * 0.74, roof - 0.74, 0.05, 0, (roof + 0.68) / 2 - 0.01, cabZ + 0.06 - cab * 0.37, windowMaterial);
  for (const side of [-1, 1]) {
    box(0.04, roof - 0.78, cab * 0.42, side * w * 0.43, (roof + 0.7) / 2, cabZ + 0.03, windowMaterial);
    box(0.12, 0.08, 0.12, side * w * 0.54, 0.66, cabZ - cab * 0.25, chrome);
    box(0.17, 0.11, 0.04, side * w * 0.31, 0.42, cabZ - cab / 2 - 0.02, lights);
  }
  box(w * 0.94, 0.09, 0.1, 0, 0.24, cabZ - cab / 2, chrome);
  box(w * 0.4, 0.12, 0.035, 0, 0.39, cabZ - cab / 2 - 0.025, rubber);
  // Static details share a draw per material; the moving wheels are instanced below.
  const batches = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const part of [...body.children]) {
    if (!(part instanceof THREE.Mesh) || Array.isArray(part.material)) continue;
    part.updateMatrix();
    const geometry = part.geometry.applyMatrix4(part.matrix);
    const batch = batches.get(part.material) ?? [];
    batch.push(geometry);
    batches.set(part.material, batch);
    body.remove(part);
  }
  for (const [material, geometries] of batches) {
    // Paint is two-tone, darker towards the wheels; every ivory part but the bed stays plain.
    if (material === ivory) for (const geometry of geometries) {
      if (!geometry.getAttribute('color')) geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(geometry.getAttribute('position').count * 3).fill(1), 3));
    }
    const merged = mergeGeometries(geometries);
    if (!merged) throw new Error('Lorry geometry could not be merged');
    if (material === paint) moulded(merged, 0.66, 1.04);
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    // Of a lorry's parts only the ivory bed takes shadows, with the cargo bricks: the rest stay cheap.
    mesh.receiveShadow = material === ivory;
    body.add(mesh);
    for (const geometry of geometries) geometry.dispose();
  }
  const badge = decal(target, w * 0.65, decals);
  badge.rotation.x = -Math.PI / 2;
  badge.position.set(0, roof + 0.006, cabZ + 0.06);
  badge.name = 'final-colour-marker';
  body.add(badge);
  const tireGeometry = new THREE.CylinderGeometry(0.2, 0.2, 0.13, 12);
  const hubGeometry = new THREE.CylinderGeometry(0.095, 0.095, 0.145, 10);
  tireGeometry.rotateZ(Math.PI / 2);
  hubGeometry.rotateZ(Math.PI / 2);
  const tires = new THREE.InstancedMesh(tireGeometry, materials.tires, 6);
  const hubs = new THREE.InstancedMesh(hubGeometry, materials.hubs, 6);
  tires.castShadow = true;
  body.add(tires, hubs);
  const wheel = new THREE.Object3D();
  const setWheelTravel = (distance: number): void => {
    let index = 0;
    for (const z of [cabZ, -length * 0.27, length * 0.34]) for (const side of [-1, 1]) {
      wheel.position.set(side * (w / 2 + 0.01), 0.2, z);
      wheel.rotation.x = distance / 0.2;
      wheel.updateMatrix();
      tires.setMatrixAt(index, wheel.matrix);
      hubs.setMatrixAt(index++, wheel.matrix);
    }
    tires.instanceMatrix.needsUpdate = true;
    hubs.instanceMatrix.needsUpdate = true;
  };
  setWheelTravel(0);
  const unloading = new THREE.Group();
  unloading.position.set(0, h + 0.08, length / 2 + 0.28);
  const plate = new THREE.Mesh(new RoundedBoxGeometry(w * 0.8, 0.06, 0.78, 2, 0.02), rubber);
  unloading.add(plate);
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(-0.2, 0.08);
  arrowShape.lineTo(0, -0.11);
  arrowShape.lineTo(0.2, 0.08);
  arrowShape.lineTo(0.13, 0.14);
  arrowShape.lineTo(0, 0.015);
  arrowShape.lineTo(-0.13, 0.14);
  arrowShape.closePath();
  const arrowGeometry = new THREE.ShapeGeometry(arrowShape);
  arrowGeometry.rotateX(-Math.PI / 2);
  const arrows = Array.from({ length: 3 }, (_, index) => {
    const material = new THREE.MeshBasicMaterial({ color: 0xfff9d8, transparent: true, toneMapped: false });
    const arrow = new THREE.Mesh(arrowGeometry, material);
    arrow.position.set(0, 0.04, (index - 1) * 0.23);
    unloading.add(arrow);
    return arrow;
  });
  const pause = new THREE.Group();
  for (const side of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.03, 0.38), lights);
    bar.position.set(side * 0.12, 0.045, 0);
    pause.add(bar);
  }
  unloading.add(pause);
  body.add(unloading);
  const setUnloading = (state: 'pouring' | 'waiting' | null, time: number): void => {
    unloading.visible = state !== null;
    pause.visible = state === 'waiting';
    arrows.forEach((arrow, index) => {
      arrow.visible = state === 'pouring';
      arrow.material.opacity = 0.3 + 0.7 * Math.max(0, Math.sin(time * 12 - index * 1.4));
    });
  };
  setUnloading(null, 0);
  const latch = new THREE.Group();
  latch.name = 'tailboard-latch';
  latch.position.set(0, h + TUB.cargo + 0.1, length / 2 - 0.16);
  const lock = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.12, 0.52, 2, 0.04), rubber);
  latch.add(lock);
  const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.045, 6, 12, Math.PI), chrome);
  shackle.rotation.x = -Math.PI / 2;
  shackle.position.z = -0.24;
  latch.add(shackle);
  if (latchColor) {
    const mark = decal(latchColor, 0.43, decals);
    mark.rotation.x = -Math.PI / 2;
    mark.position.y = 0.075;
    latch.add(mark);
  }
  body.add(latch);
  const setLatched = (latched: boolean): void => { latch.visible = latched; };
  setLatched(latchColor !== null);
  return { body, setWheelTravel, setUnloading, setLatched };
}
