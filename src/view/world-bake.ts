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
      if (!['position', 'normal', 'color', 'grade'].includes(attribute)) part.deleteAttribute(attribute);
    }
    if (!part.getAttribute('normal')) part.computeVertexNormals();
    if (!part.getAttribute('color')) {
      const colors = new Float32Array(part.getAttribute('position').count * 3); colors.fill(1);
      part.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }
    parts.push(part.applyMatrix4(inverse.clone().multiply(object.matrixWorld))); meshes.push(object);
  });
  if (!parts.length) return null;
  levelGrades(parts);
  const geometry = mergeGeometries(parts); parts.forEach(part => part.dispose());
  if (!geometry) throw new Error('World geometry could not be merged');
  meshes.forEach(mesh => mesh.removeFromParent());
  const mesh = new THREE.Mesh(geometry, material); mesh.name = group.name;
  group.add(mesh); return mesh;
}

/** Append static dressing without changing the producer-owned terrain prefix or geometry identity. */
export function appendWorldGeometry(mesh: THREE.Mesh, sources: readonly THREE.BufferGeometry[]): void {
  const parts=sources.map(source=>source.index?source.toNonIndexed():source.clone());
  if(mesh.geometry.getAttribute('grade'))levelGrades(parts,true);
  const merged=mergeGeometries([mesh.geometry,...parts]);parts.forEach(part=>part.dispose());
  if(!merged)throw new Error('Island dressing could not be merged');
  for(const name of ['position','normal','color','grade'])if(merged.getAttribute(name))mesh.geometry.setAttribute(name,merged.getAttribute(name));
  mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();merged.dispose();
}

/** Slope grades ride along with the land; every other part reads level, so merged attribute sets match. */
function levelGrades(parts: readonly THREE.BufferGeometry[], force = false): void {
  if (!force && !parts.some(part => part.getAttribute('grade'))) return;
  for (const part of parts) if (!part.getAttribute('grade')) part.setAttribute('grade', new THREE.BufferAttribute(new Float32Array(part.getAttribute('position').count), 1));
}
