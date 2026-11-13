import * as THREE from 'three';
import { DEEP_SEA } from '../engine/stage';
import { sunny } from './village-terrain';

/**
 * The sea a village stands in: its own water colour at the shore, darkening to open sea before the horizon,
 * so the island's cliffs go down into water and the top of the screen stays dark behind the heading.
 * Unlit and opaque: one flat draw under everything.
 */
export function villageSea(level: number, shore: number): THREE.Mesh {
  const geometry = new THREE.RingGeometry(0, 1, 32, 6);
  geometry.rotateX(-Math.PI / 2);
  geometry.deleteAttribute('uv');
  const position = geometry.getAttribute('position');
  // Six rings, crowded toward the island where the colour changes: 384 triangles for the whole sea.
  for (let index = 0; index < position.count; index++) {
    const radius = Math.hypot(position.getX(index), position.getZ(index));
    const stretch = radius > 0 ? 150 * radius ** 1.2 : 0;
    position.setXYZ(index, position.getX(index) * stretch, 0, position.getZ(index) * stretch);
  }
  const colors = new Float32Array(position.count * 3);
  const near = sunny(shore, new THREE.Color()), far = new THREE.Color(DEEP_SEA), mixed = new THREE.Color();
  for (let index = 0; index < position.count; index++) {
    const reach = THREE.MathUtils.smoothstep(Math.hypot(position.getX(index), position.getZ(index)), 12, 62);
    mixed.copy(near).lerp(far, reach).toArray(colors, index * 3);
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  const sea = new THREE.Mesh(geometry, new THREE.MeshBasicMaterial({ vertexColors: true, fog: false }));
  sea.name = 'village-sea';
  sea.position.y = level;
  return sea;
}
