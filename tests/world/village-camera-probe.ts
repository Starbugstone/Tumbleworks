import { PerspectiveCamera, Ray, Vector3 } from 'three';
import { VILLAGE_RADIUS } from '../../src/world/village-plan';
import type { SurfaceTriangle } from './surface-overlap';

export function sphereFramed(camera: PerspectiveCamera, center: Vector3, radius = VILLAGE_RADIUS): boolean {
  const local = center.clone().applyMatrix4(camera.matrixWorldInverse), depth = -local.z;
  if (depth - radius < camera.near || depth + radius > camera.far) return false;
  const bounds = (coordinate: number, scale: number): [number, number] => {
    const spread = radius * Math.sqrt(coordinate * coordinate + depth * depth - radius * radius);
    return [(coordinate * depth - spread) / (depth * depth - radius * radius) * scale,
      (coordinate * depth + spread) / (depth * depth - radius * radius) * scale];
  };
  const x = bounds(local.x, camera.projectionMatrix.elements[0]!);
  const y = bounds(local.y, camera.projectionMatrix.elements[5]!);
  return x[0] >= -0.86 && x[1] <= 0.86 && y[0] >= -0.66 && y[1] <= 0.76;
}

export function occludingSurface(camera: PerspectiveCamera, center: Vector3, surfaces: readonly SurfaceTriangle[]): string | null {
  const direction = center.clone().sub(camera.position), length = direction.length();
  const ray = new Ray(camera.position, direction.divideScalar(length)), hit = new Vector3();
  for (const surface of surfaces) {
    if (!ray.intersectsBox(surface.bounds)) continue;
    if (ray.intersectTriangle(surface.a, surface.b, surface.c, false, hit) && hit.distanceTo(camera.position) < length - VILLAGE_RADIUS - 0.002) {
      return surface.mesh.name || surface.mesh.parent?.name || surface.mesh.geometry.type;
    }
  }
  return null;
}

