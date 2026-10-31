import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { Color } from '../sim/types';
import { COLORS, decal } from './art';

interface Dimensions { bedWidth: number; bedLength: number; bedHeight: number; cabLength: number }

/** Cab faces local -z; the open tail faces the loop at +z. Cargo is added separately. */
export function lorry(target: Color, dimensions: Dimensions): { body: THREE.Group; wheels: THREE.Group[] } {
  const { bedWidth: w, bedLength: length, bedHeight: h, cabLength: cab } = dimensions;
  const body = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: COLORS[target].hex, roughness: 0.28, clearcoat: 0.8 });
  const ivory = new THREE.MeshStandardMaterial({ color: 0xfff7e5, roughness: 0.4 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x20243a, roughness: 0.8 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xbccbdc, roughness: 0.3, metalness: 0.45 });
  const window = new THREE.MeshPhysicalMaterial({ color: 0x19364e, roughness: 0.12, clearcoat: 1 });
  const lights = new THREE.MeshBasicMaterial({ color: 0xffefb0, toneMapped: false });
  const box = (width: number, height: number, depth: number, x: number, y: number, z: number, material: THREE.Material) => {
    const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 2, Math.min(0.07, height / 3, depth / 3, width / 3)), material);
    mesh.position.set(x, y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
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
  box(w * 0.72, 0.2, 0.04, 0, 0.7, cabZ - cab * 0.34, window);
  for (const side of [-1, 1]) {
    box(0.035, 0.19, cab * 0.4, side * w * 0.43, 0.7, cabZ + 0.01, window);
    box(0.12, 0.08, 0.12, side * w * 0.54, 0.58, cabZ - cab * 0.25, chrome);
    box(0.15, 0.09, 0.04, side * w * 0.32, 0.38, cabZ - cab / 2 - 0.02, lights);
  }
  box(w * 0.94, 0.09, 0.1, 0, 0.24, cabZ - cab / 2, chrome);
  box(w * 0.4, 0.12, 0.035, 0, 0.39, cabZ - cab / 2 - 0.025, rubber);
  const badge = decal(target, w * 0.65);
  badge.rotation.x = -Math.PI / 2;
  badge.position.set(0, 0.855, cabZ + 0.06);
  badge.name = 'final-colour-marker';
  body.add(badge);
  const wheels: THREE.Group[] = [];
  for (const z of [cabZ, -length * 0.27, length * 0.34]) {
    for (const side of [-1, 1]) {
      const wheel = new THREE.Group();
      const tire = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.13, 12), rubber);
      tire.rotation.z = Math.PI / 2;
      tire.castShadow = true;
      wheel.add(tire);
      const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.145, 10), chrome);
      hub.rotation.z = Math.PI / 2;
      wheel.add(hub);
      wheel.position.set(side * (w / 2 + 0.01), 0.2, z);
      body.add(wheel);
      wheels.push(wheel);
    }
  }
  return { body, wheels };
}
