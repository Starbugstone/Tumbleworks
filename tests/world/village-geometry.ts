import { Box3, Matrix4, Mesh, Object3D, Ray, Triangle, Vector3 } from 'three';
import { surfaceOverlaps, surfaceTriangles, type SurfaceTriangle } from './surface-overlap';
import { capsulePenetrations, type TrackTriangle } from './triangle-clearance';

export interface SolidProbe {
  readonly mesh: Mesh;
  readonly bounds: Box3;
  readonly triangles: readonly TrackTriangle[];
  readonly inverse: Matrix4;
  readonly scale: number;
}

export function visible(object: Object3D): boolean {
  for (let current: Object3D | null = object; current; current = current.parent) if (!current.visible) return false;
  return true;
}

/** Cache local rendered triangles; each rigid mover supplies only its current matrix. */
export function solidProbes(root: Object3D, radius: number): SolidProbe[] {
  const probes: SolidProbe[] = [];
  root.traverse(mesh => {
    if (!(mesh instanceof Mesh)) return;
    mesh.updateWorldMatrix(true, false);
    const scale = mesh.getWorldScale(new Vector3());
    if (Math.max(Math.abs(scale.x - scale.y), Math.abs(scale.x - scale.z)) > 1e-6 || scale.x <= 0) throw new Error(`Clearance needs positive uniform scale: ${mesh.name}`);
    const identity = mesh.clone(false); identity.position.set(0, 0, 0); identity.quaternion.identity(); identity.scale.set(1, 1, 1);
    identity.updateMatrix(); identity.matrixAutoUpdate = true;
    const triangles = surfaceTriangles(identity).map(surface => ({ triangle: new Triangle(surface.a, surface.b, surface.c),
      bounds: surface.bounds.expandByScalar(radius / scale.x), name: mesh.name || `${mesh.parent?.name}/${mesh.geometry.type}` }));
    probes.push({ mesh, triangles, scale: scale.x,
      bounds: new Box3().setFromBufferAttribute(mesh.geometry.getAttribute('position')).expandByScalar(radius / scale.x), inverse: new Matrix4() });
  });
  return probes;
}

export function sphereCollision(probes: readonly SolidProbe[], center: Vector3, radius: number) {
  const local = new Vector3(), scale = new Vector3();
  for (const probe of probes) {
    if (!visible(probe.mesh)) continue;
    probe.mesh.updateWorldMatrix(true, false); probe.mesh.getWorldScale(scale);
    if (Math.max(Math.abs(scale.x - probe.scale), Math.abs(scale.y - probe.scale), Math.abs(scale.z - probe.scale)) > 1e-6) throw new Error(`Clearance cannot change cached scale: ${probe.mesh.name}`);
    local.copy(center).applyMatrix4(probe.inverse.copy(probe.mesh.matrixWorld).invert());
    if (!probe.bounds.containsPoint(local)) continue;
    const collision = capsulePenetrations(local, local, probe.triangles, radius / scale.x);
    if (collision) return { ...collision, surface: probe.mesh.name || probe.mesh.parent?.name || collision.surface };
  }
  return null;
}

/** Sphere contact works for separated twin rails as well as a single channel floor. */
export function sphereSupported(probes: readonly SolidProbe[], center: Vector3, normal: Vector3, radius: number): boolean {
  const local = new Vector3(), closest = new Vector3(), world = new Vector3();
  for (const probe of probes) {
    if (!visible(probe.mesh)) continue;
    probe.mesh.updateWorldMatrix(true, false);
    local.copy(center).applyMatrix4(probe.inverse.copy(probe.mesh.matrixWorld).invert());
    if (probe.bounds.distanceToPoint(local) > 0.003 / probe.scale) continue;
    for (const surface of probe.triangles) {
      if (surface.bounds.distanceToPoint(local) > 0.003 / probe.scale) continue;
      surface.triangle.closestPointToPoint(local, closest);
      if (Math.abs(local.distanceTo(closest) * probe.scale - radius) > 0.002) continue;
      world.copy(closest).applyMatrix4(probe.mesh.matrixWorld).sub(center);
      if (world.dot(normal) < -radius * 0.2) return true;
    }
  }
  return false;
}

/** A real crossing requires vertices on both sides, so an intentional flush joint is allowed. */
export function triangleCrossing(a: SurfaceTriangle, b: SurfaceTriangle, tolerance = 0.002): boolean {
  if (!a.bounds.intersectsBox(b.bounds)) return false;
  const distances = [a.a, a.b, a.c].map(point => point.clone().sub(b.a).dot(b.normal));
  if (Math.min(...distances) >= -tolerance || Math.max(...distances) <= tolerance) return false;
  const reverse = [b.a, b.b, b.c].map(point => point.clone().sub(a.a).dot(a.normal));
  if (Math.min(...reverse) >= -tolerance || Math.max(...reverse) <= tolerance) return false;
  const direction = a.normal.clone().cross(b.normal).normalize();
  const interval = (surface: SurfaceTriangle, signed: readonly number[]): readonly [number, number] => {
    const vertices = [surface.a, surface.b, surface.c], cuts: number[] = [];
    for (let index = 0; index < 3; index++) {
      const next = (index + 1) % 3, from = signed[index]!, to = signed[next]!;
      if (from === 0) cuts.push(vertices[index]!.dot(direction));
      if (from * to < 0) cuts.push(vertices[index]!.clone().lerp(vertices[next]!, from / (from - to)).dot(direction));
    }
    return [Math.min(...cuts), Math.max(...cuts)];
  };
  const first = interval(a, distances), second = interval(b, reverse);
  // Plane cuts meeting at one endpoint form a joint, not an interior crossing.
  return Math.min(first[1], second[1]) - Math.max(first[0], second[0]) > tolerance;
}

export function exposedOverlaps(surfaces: readonly SurfaceTriangle[]) {
  return surfaceOverlaps(surfaces).filter(overlap => {
    const points = [overlap.point, ...overlap.polygon.map(vertex => vertex.clone().lerp(overlap.point, 0.05))];
    return points.some(point => {
      const ray = new Ray(point.clone().addScaledVector(overlap.a.normal, 0.0001), overlap.a.normal);
      return !surfaces.some(surface => {
        const hit = ray.intersectTriangle(surface.a, surface.b, surface.c, false, new Vector3());
        return hit !== null && hit.distanceTo(ray.origin) > 0.0001;
      });
    });
  });
}

export function trackCrossings(tracks: readonly SurfaceTriangle[], solids: readonly SurfaceTriangle[]) {
  const grid = new Map<string, SurfaceTriangle[]>(), cellSize = 2;
  const cells = (bounds: Box3, visit: (key: string) => void) => {
    for (let x = Math.floor(bounds.min.x / cellSize); x <= Math.floor(bounds.max.x / cellSize); x++) {
      for (let y = Math.floor(bounds.min.y / cellSize); y <= Math.floor(bounds.max.y / cellSize); y++) {
        for (let z = Math.floor(bounds.min.z / cellSize); z <= Math.floor(bounds.max.z / cellSize); z++) visit(`${x}/${y}/${z}`);
      }
    }
  };
  for (const solid of solids) cells(solid.bounds, key => {
    const entries = grid.get(key);
    if (entries) entries.push(solid); else grid.set(key, [solid]);
  });
  const failures: { track: string; solid: string; at: number[] }[] = [];
  for (const track of tracks) {
    const nearby = new Set<SurfaceTriangle>();
    cells(track.bounds, key => { for (const entry of grid.get(key) ?? []) nearby.add(entry); });
    for (const solid of nearby) {
      if (solid === track) continue;
      if (triangleCrossing(track, solid) || triangleCrossing(solid, track)) {
        failures.push({ track: track.mesh.name, solid: solid.mesh.name, at: track.a.toArray() });
        break;
      }
    }
  }
  return failures;
}
