export interface IdentityAnchor { readonly x: number; readonly y: number; readonly z: number }

export function sequenceDistance(a: readonly string[], b: readonly string[]): number {
  let row = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let index = 0; index < a.length; index++) {
    const next = [index + 1];
    for (let column = 0; column < b.length; column++) {
      next.push(Math.min(next[column]! + 1, row[column + 1]! + 1,
        row[column]! + Number(a[index] !== b[column])));
    }
    row = next;
  }
  return row[b.length]!;
}

function normalized(points: readonly IdentityAnchor[]): number[][] {
  if (points.length < 3) throw new Error('Spatial identity needs at least three anchors');
  const center = [0, 0, 0];
  for (const point of points) { center[0]! += point.x; center[1]! += point.y; center[2]! += point.z; }
  const values = points.map(point => [point.x - center[0]! / points.length,
    point.y - center[1]! / points.length, point.z - center[2]! / points.length]);
  const norm = Math.sqrt(values.reduce((sum, point) => sum + point.reduce((n, value) => n + value * value, 0), 0));
  if (!Number.isFinite(norm) || norm < 1e-10) throw new Error('Spatial identity needs finite noncoincident anchors');
  return values.map(point => point.map(value => value / norm));
}

/** RMS residual / anchor RMS radius after translation, scale, rotation AND reflection.
 * Allowing reflection is deliberate: a mirrored machine is still the same layout.
 * The singular values of AᵀB give the best orthogonal fit without a math dependency.
 */
export function spatialDistance(a: readonly IdentityAnchor[], b: readonly IdentityAnchor[]): number {
  if (a.length !== b.length) throw new Error('Compare the same stable stop indices');
  const left = normalized(a), right = normalized(b);
  const covariance = Array.from({ length: 3 }, () => [0, 0, 0]);
  for (let index = 0; index < left.length; index++) for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) {
    covariance[r]![c]! += left[index]![r]! * right[index]![c]!;
  }
  const gram = Array.from({ length: 3 }, (_, r) => Array.from({ length: 3 }, (_, c) =>
    covariance.reduce((sum, row) => sum + row[r]! * row[c]!, 0)));
  // Jacobi diagonalization of the symmetric positive semidefinite 3×3 Gram matrix.
  for (let iteration = 0; iteration < 30; iteration++) {
    let p = 0, q = 1;
    for (const [r, c] of [[0, 2], [1, 2]]) if (Math.abs(gram[r!]![c!]!) > Math.abs(gram[p]![q]!)) { p = r!; q = c!; }
    if (Math.abs(gram[p]![q]!) < 1e-15) break;
    const angle = 0.5 * Math.atan2(2 * gram[p]![q]!, gram[q]![q]! - gram[p]![p]!);
    const cos = Math.cos(angle), sin = Math.sin(angle);
    const pp = gram[p]![p]!, qq = gram[q]![q]!, pq = gram[p]![q]!;
    gram[p]![p] = cos * cos * pp - 2 * sin * cos * pq + sin * sin * qq;
    gram[q]![q] = sin * sin * pp + 2 * sin * cos * pq + cos * cos * qq;
    gram[p]![q] = 0; gram[q]![p] = 0;
    for (let k = 0; k < 3; k++) if (k !== p && k !== q) {
      const kp = gram[k]![p]!, kq = gram[k]![q]!;
      gram[k]![p] = cos * kp - sin * kq; gram[p]![k] = gram[k]![p]!;
      gram[k]![q] = sin * kp + cos * kq; gram[q]![k] = gram[k]![q]!;
    }
  }
  const largest = Math.max(...gram.map((row, index) => Math.abs(row[index]!)));
  // Roundoff in a rank-two layout otherwise invents a third singular value,
  // making the distance depend on which village was supplied first.
  const nuclear = gram.reduce((sum, row, index) => sum + Math.sqrt(row[index]! < largest * 1e-14 ? 0 : row[index]!), 0);
  return Math.sqrt(Math.max(0, 2 - 2 * nuclear));
}

// A fifth of the anchor RMS radius is a sizeable layout displacement after the
// best possible fit. Labels, palette, world units and orientation cannot buy it.
export const MIN_SPATIAL_DISTANCE = 0.2;
export const MIN_SEQUENCE_DISTANCE = 5;
