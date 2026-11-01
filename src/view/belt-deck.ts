import * as THREE from 'three';
import type { BeltPath } from '../engine/belt-path';
import { ARCADE } from './arcade';

/** Sample the same elevated path as transport, including both separated passes at the crossing. */
export function beltDeck(path: BeltPath, halfWidth: number, floorY: number, wallHeight: number): THREE.Group {
  const group = new THREE.Group();
  const floor = new THREE.MeshStandardMaterial({ color: ARCADE.track, roughness: 0.6 });
  const edge = new THREE.MeshStandardMaterial({ color: ARCADE.edge, roughness: 0.45 });
  const band = (left: number, right: number, bottom: number, top: number, material: THREE.Material): void => {
    const positions: number[] = [], indices: number[] = [];
    const samples = 256;
    for (let i = 0; i <= samples; i++) {
      const d = i / samples * path.length;
      for (const h of [bottom, top]) for (const offset of [left, right]) {
        const p = path.point(d, offset);
        positions.push(p.x, floorY + p.y + h, p.z);
      }
      if (i === samples) continue;
      const a = i * 4;
      indices.push(a + 2, a + 6, a + 3, a + 3, a + 6, a + 7,
        a, a + 1, a + 4, a + 1, a + 5, a + 4,
        a, a + 4, a + 2, a + 2, a + 4, a + 6,
        a + 1, a + 3, a + 5, a + 3, a + 7, a + 5);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const mesh = new THREE.Mesh(geometry, material); mesh.receiveShadow = true; mesh.castShadow = true;
    group.add(mesh);
  };
  band(-halfWidth, halfWidth, -0.2, 0, floor);
  for (const side of [-1, 1]) {
    const outer = side * (halfWidth + 0.12), inner = side * halfWidth;
    band(Math.min(outer, inner), Math.max(outer, inner), -0.2, wallHeight, edge);
  }
  // Amber bridge posts sit on the raised shoulders, outside the marble channel.
  const posts = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.35, 0.1), new THREE.MeshStandardMaterial({ color: ARCADE.gold }), 12);
  const dummy = new THREE.Object3D();
  let index = 0;
  for (const d of [-1.8, -1.1, -0.4, 0.4, 1.1, 1.8]) for (const side of [-1, 1]) {
    const p = path.point(d, side * (halfWidth + 0.06));
    dummy.position.set(p.x, floorY + p.y + wallHeight + 0.175, p.z);
    dummy.updateMatrix(); posts.setMatrixAt(index++, dummy.matrix);
  }
  group.add(posts);
  return group;
}
