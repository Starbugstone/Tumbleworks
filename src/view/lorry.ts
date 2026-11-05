import * as THREE from 'three';
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
    ivory: new THREE.MeshStandardMaterial({ color: 0xfff7e5, roughness: 0.4 }),
    rubber, chrome,
    // Ordinary and instanced geometry need separate material identities to keep shader variants stable.
    tires: rubber.clone(), hubs: chrome.clone(),
    windowMaterial: new THREE.MeshStandardMaterial({ color: 0x19364e, roughness: 0.12 }),
    lights: new THREE.MeshBasicMaterial({ color: 0xffefb0, toneMapped: false }),
  };
}
export type LorryMaterials = ReturnType<typeof lorryMaterials>;

/** Cab faces local -z; the open tail faces the loop at +z. Cargo is added separately. */
export function lorry(target: Color, dimensions: Dimensions, materials: LorryMaterials, latchColor: Color | null = null, decals?: Map<Color, THREE.MeshBasicMaterial>): { body: THREE.Group; setWheelTravel: (distance: number) => void; setLatched: (latched: boolean) => void; setUnloading: (state: 'pouring' | 'waiting' | null, time: number) => void } {
  const { bedWidth: w, bedLength: length, bedHeight: h, cabLength: cab } = dimensions;
  const body = new THREE.Group();
  let paint = materials.paints.get(target);
  if (!paint) { paint = new THREE.MeshStandardMaterial({ color: COLORS[target].hex, roughness: 0.28 }); materials.paints.set(target, paint); }
  const { ivory, rubber, chrome, windowMaterial, lights } = materials;
  const box = (width: number, height: number, depth: number, x: number, y: number, z: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 2, Math.min(0.07, height / 3, depth / 3, width / 3)), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    body.add(mesh);
    return mesh;
  };
  box(w * 0.85, 0.14, length + cab, 0, 0.15, -cab / 2, rubber);
  box(w, h * 0.55, length, 0, h * 0.72, 0, ivory);
  for (const side of [-1, 1]) {
    box(0.08, 0.22, length, side * (w / 2 - 0.04), h + 0.07, 0, paint);
    box(0.04, 0.05, length - 0.2, side * (w / 2 + 0.005), h + 0.14, 0, ivory);
  }
  const cabZ = -(length + cab) / 2;
  box(w, 0.48, cab, 0, 0.43, cabZ, paint);
  box(w * 0.84, 0.27, cab * 0.76, 0, 0.71, cabZ + 0.05, paint);
  box(w * 0.72, 0.2, 0.04, 0, 0.7, cabZ - cab * 0.34, windowMaterial);
  for (const side of [-1, 1]) {
    box(0.035, 0.19, cab * 0.4, side * w * 0.43, 0.7, cabZ + 0.01, windowMaterial);
    box(0.12, 0.08, 0.12, side * w * 0.54, 0.58, cabZ - cab * 0.25, chrome);
    box(0.15, 0.09, 0.04, side * w * 0.32, 0.38, cabZ - cab / 2 - 0.02, lights);
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
    const merged = mergeGeometries(geometries);
    if (!merged) throw new Error('Lorry geometry could not be merged');
    const mesh = new THREE.Mesh(merged, material);
    mesh.castShadow = true;
    body.add(mesh);
    for (const geometry of geometries) geometry.dispose();
  }
  const badge = decal(target, w * 0.65, decals);
  badge.rotation.x = -Math.PI / 2;
  badge.position.set(0, 0.855, cabZ + 0.06);
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
  latch.position.set(0, h + 0.42, length / 2 - 0.16);
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
