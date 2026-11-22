import { Box3, Ray, Vector3 } from 'three';
import type { SurfaceTriangle } from './surface-overlap';

interface Hit { face: SurfaceTriangle; point: Vector3; distance: number }

/** Bounds are conservative. All final intersections use Three's native triangle kernel. */
export class NativeRayTree {
  private readonly bounds = new Box3();
  private readonly children: NativeRayTree[] = [];

  private readonly faces: readonly SurfaceTriangle[];

  constructor(faces: readonly SurfaceTriangle[]) {
    this.faces = faces.length <= 16 ? faces : [];
    for (const face of faces) this.bounds.union(face.bounds);
    if (!faces.length) return;
    const magnitude = Math.max(1, ...this.bounds.min.toArray().map(Math.abs), ...this.bounds.max.toArray().map(Math.abs));
    this.bounds.expandByScalar(64 * Number.EPSILON * magnitude);
    if (faces.length <= 16) return;
    const size = this.bounds.getSize(new Vector3());
    const axis = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
    const ordered = [...faces].sort((a, b) => (a.bounds.min[axis] + a.bounds.max[axis]) - (b.bounds.min[axis] + b.bounds.max[axis]));
    const middle = ordered.length >>> 1;
    this.children.push(new NativeRayTree(ordered.slice(0, middle)), new NativeRayTree(ordered.slice(middle)));
  }

  hits(ray: Ray, length: number, out: Hit[] = [], scratch = new Vector3()): Hit[] {
    if (!ray.intersectBox(this.bounds, scratch)) return out;
    if (this.children.length) {
      for (const child of this.children) child.hits(ray, length, out, scratch);
    } else {
      for (const face of this.faces) {
        const hit = ray.intersectTriangle(face.a, face.b, face.c, false, scratch);
        if (!hit) continue;
        const distance = hit.distanceTo(ray.origin);
        if (distance < length) out.push({ face, point: hit.clone(), distance });
      }
    }
    return out;
  }

  occludes(ray: Ray, minDistance: number, scratch: Vector3): boolean {
    if (!ray.intersectBox(this.bounds, scratch)) return false;
    if (this.children.length) return this.children.some(child => child.occludes(ray, minDistance, scratch));
    return this.faces.some(face => {
      const hit = ray.intersectTriangle(face.a, face.b, face.c, false, scratch);
      return hit !== null && hit.distanceTo(ray.origin) > minDistance;
    });
  }

  visitBounds(bounds: Box3, visit: (face: SurfaceTriangle) => void): void {
    if (!this.bounds.intersectsBox(bounds)) return;
    if (this.children.length) {
      for (const child of this.children) child.visitBounds(bounds, visit);
    } else {
      for (const face of this.faces) if (face.bounds.intersectsBox(bounds)) visit(face);
    }
  }
}
