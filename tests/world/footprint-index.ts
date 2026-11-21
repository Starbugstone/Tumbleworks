import type { Box3, Vector3 } from 'three';

/** A conservative ground-grid query over each actual triangle’s XZ bounds.
 * Bucket order follows native triangle order; callers apply their exact kernel. */
export function footprintIndex<T extends { bounds: Box3 }>(triangles: readonly T[], margin = 0) {
  if (triangles.length < 64) return () => triangles;
  const rows = new Map<number, Map<number, T[]>>(), cellSize = 2;
  for (const face of triangles) {
    const {min, max} = face.bounds;
    for (let z = Math.floor((min.z-margin)/cellSize); z <= Math.floor((max.z+margin)/cellSize); z++) {
      let row = rows.get(z);
      if (!row) rows.set(z, row = new Map());
      for (let x = Math.floor((min.x-margin)/cellSize); x <= Math.floor((max.x+margin)/cellSize); x++) {
        const bucket = row.get(x);
        if (bucket) bucket.push(face); else row.set(x, [face]);
      }
    }
  }
  const empty: T[] = [];
  return (p: Vector3): readonly T[] => rows.get(Math.floor(p.z/cellSize))?.get(Math.floor(p.x/cellSize)) ?? empty;
}
