import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Merge scene-owned copies; cached Blender geometry stays with its asset owner. */
export function bakeWorldGroup(group: THREE.Group, material: THREE.Material): THREE.Mesh | null {
  group.updateWorldMatrix(true, true);
  const inverse = group.matrixWorld.clone().invert();
  const parts: THREE.BufferGeometry[] = [], meshes: THREE.Mesh[] = [];
  group.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const part = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone();
    for (const attribute of Object.keys(part.attributes)) {
      if (!['position', 'normal', 'color'].includes(attribute)) part.deleteAttribute(attribute);
    }
    if (!part.getAttribute('normal')) part.computeVertexNormals();
    if (!part.getAttribute('color')) {
      const colors = new Float32Array(part.getAttribute('position').count * 3); colors.fill(1);
      part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    parts.push(part.applyMatrix4(inverse.clone().multiply(object.matrixWorld))); meshes.push(object);
  });
  if (!parts.length) return null;
  const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose());
  if (!geometry) throw new Error('World geometry could not be merged');
  meshes.forEach(mesh => mesh.removeFromParent());
  const mesh = new THREE.Mesh(geometry, material); mesh.name = group.name;
  group.add(mesh); return mesh;
}
