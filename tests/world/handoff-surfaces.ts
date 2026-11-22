import { Buffer } from 'node:buffer';
import { Box3, Mesh, type BufferGeometry, type Object3D } from 'three';
import { NativeRayTree } from './native-ray-tree';
import { coplanarOverlap, appendMeshTriangles, overlapBounds, surfaceOverlaps, type SurfaceTriangle } from './surface-overlap';
import { indexedTrackCrossings, visible, visibleOverlaps } from './village-geometry';

type Faces = SurfaceTriangle[];

function geometryState(geometry: BufferGeometry) {
  const position = geometry.getAttribute('position'), index = geometry.index;
  const data = 'data' in position ? position.data : position;
  const bytes = (array: ArrayBufferView) => Buffer.from(array.buffer, array.byteOffset, array.byteLength);
  const source = bytes(data.array), vertices = Buffer.from(source);
  const indexSource = index && bytes(index.array), indices = indexSource && Buffer.from(indexSource);
  const count = position.count, size = position.itemSize, normalized = position.normalized;
  const offset = 'offset' in position ? position.offset : 0, stride = 'data' in position ? position.data.stride : size;
  const vertexType = data.array.constructor, indexType = index?.array.constructor;
  const indexedCount = index?.count, indexedSize = index?.itemSize, indexedNormalized = index?.normalized;
  return () =>
    geometry.getAttribute('position') === position && geometry.index === index &&
    position.count === count && position.itemSize === size && position.normalized === normalized &&
    ('offset' in position ? position.offset : 0) === offset && ('data' in position ? position.data.stride : size) === stride &&
    index?.count === indexedCount && index?.itemSize === indexedSize && index?.normalized === indexedNormalized &&
    ('data' in position ? position.data : position) === data && data.array.constructor === vertexType && index?.array.constructor === indexType &&
    bytes(data.array).equals(vertices) && (!index || bytes(index.array).equals(indices!));
}

/** Read actual world vertices at every sampled pose. Only byte-equivalent triangles
 * visible at every pose qualify for reusing fixed/fixed intersection results. */
export function* handoffSurfaces(root: Object3D, times: Iterable<number>, pose: (time: number) => void) {
  const reference = new Map<Mesh, { faces: Faces; matrix: Mesh['matrixWorld']; geometry: BufferGeometry }>();
  const geometry = new Map<BufferGeometry, () => boolean>(), fixed = new Set<Faces>();
  const poses: { time: number; groups: Faces[] }[] = [];
  for (const time of times) {
    pose(time); root.updateWorldMatrix(true, true);
    const groups: Faces[] = [], seen = new Set<Mesh>(), matches = new Map<BufferGeometry, boolean>();
    root.traverse(mesh => {
      if (!(mesh instanceof Mesh) || !visible(mesh)) return;
      seen.add(mesh);
      const first = reference.get(mesh);
      if (first && first.geometry === mesh.geometry && first.matrix.equals(mesh.matrixWorld)) {
        let same = matches.get(mesh.geometry);
        if (same === undefined) {
          same = geometry.get(mesh.geometry)!();
          matches.set(mesh.geometry, same);
        }
        if (same) { groups.push(first.faces); return; }
      }
      const faces: Faces = [];
      appendMeshTriangles(mesh, faces);
      if (faces.length) groups.push(faces);
      if (!poses.length && faces.length) {
        if (!geometry.has(mesh.geometry)) geometry.set(mesh.geometry, geometryState(mesh.geometry));
        reference.set(mesh, { faces, matrix: mesh.matrixWorld.clone(), geometry: mesh.geometry });
        fixed.add(faces);
      } else if (first) fixed.delete(first.faces);
    });
    for (const [mesh, first] of reference) if (!seen.has(mesh)) fixed.delete(first.faces);
    poses.push({ time, groups });
  }

  const fixedFaces = [...fixed].flat();
  const track = (f: SurfaceTriangle) => f.mesh.name.startsWith('village-track-');
  const fixedTracks = fixedFaces.filter(track);
  const fixedTree = new NativeRayTree(fixedFaces);
  const fixedCrossings = indexedTrackCrossings(fixedTracks, [fixedTree]);
  const fixedOverlaps = visibleOverlaps(surfaceOverlaps(fixedFaces, 1e-5, fixedTree), [fixedTree]);
  for (const { time, groups } of poses) {
    const moving = groups.filter(group => !fixed.has(group)).flat();
    const movingTracks = moving.filter(track);
    const movingTree = new NativeRayTree(moving);
    const crossings = [...fixedCrossings, ...indexedTrackCrossings(fixedTracks, [movingTree]),
      ...indexedTrackCrossings(movingTracks, [fixedTree, movingTree])];
    const overlaps = surfaceOverlaps(moving, 1e-5, movingTree);
    const bounds = new Box3();
    // Match the stable min-X ordering of surfaceOverlaps, including exact ties.
    const meshOrder = new Map(groups.map((faces, i) => [faces[0]!.mesh, i]));
    for (const face of moving) {
      overlapBounds(face.bounds, 1e-5, bounds);
      fixedTree.visitBounds(bounds, other => {
        const first = face.bounds.min.x < other.bounds.min.x ||
          (face.bounds.min.x === other.bounds.min.x && meshOrder.get(face.mesh)! < meshOrder.get(other.mesh)!);
        const overlap = first ? coplanarOverlap(face, other) : coplanarOverlap(other, face);
        if (overlap) overlaps.push(overlap);
      });
    }
    yield { time, crossings, exposed: visibleOverlaps([...fixedOverlaps, ...overlaps], [fixedTree, movingTree]) };
  }
}
