import { Ray, Vector3, type PerspectiveCamera } from 'three';
import { villageChannelGeometry } from '../../src/view/machine-primitives';
import { villagePort, VILLAGE_RADIUS, type VillageProfile } from '../../src/world/village-plan';
import type { SurfaceTriangle } from './surface-overlap';
import type { VillageSegment } from '../../src/world/village-program';

export interface FloorTopology {
  readonly stations: readonly { readonly stop: number; readonly mechanism: { readonly kind: string; readonly points?: readonly unknown[] } }[];
  readonly connectors: readonly { readonly from: number; readonly to: number }[];
}
export interface FloorContext {
  readonly stop: number;
  readonly kind: VillageSegment['kind'];
}
export function stationFloorName(topology: FloorTopology, stop: number): string {
  const station = topology.stations.find(s => s.stop === stop);
  if (!station) throw new Error(`Unknown floor stop ${stop}`);
  return `village-track-${'points' in station.mechanism ? station.mechanism.kind : 'carrier'}-${stop}`;
}

/** G-J: explicit registered adjacency. This supplies names only; it does not
 * change the unchanged local ±(R+.002) slab, section radius, or centre-ray rule. */
export function adjacentFloorNames(topology: FloorTopology, context: FloorContext): Set<string> {
  const names = new Set([stationFloorName(topology, context.stop)]);
  if (context.kind === 'connector') {
    const links = topology.connectors.filter(link => link.from === context.stop);
    const link = links[0];
    if (links.length !== 1 || !link || link.to !== link.from - 1)
      throw new Error('Connector needs one explicit adjacent destination');
    names.add(`village-track-connector-${link.from}-${link.to}`);
    names.add(stationFloorName(topology, link.to));
  } else {
    for (const link of topology.connectors) if (link.to === context.stop) {
      if (link.from !== link.to + 1) throw new Error('Incoming connector is not adjacent');
      names.add(`village-track-connector-${link.from}-${link.to}`);
    }
  }
  return names;
}

export function contactSectionRadius(profile: VillageProfile, width: number): number {
  const geometry = villageChannelGeometry([villagePort([0, 0, 0], [1, 0, 0], [0, 1, 0], width), villagePort([1, 0, 0], [1, 0, 0], [0, 1, 0], width)], profile);
  try {
    const p = geometry.getAttribute('position'); let radius = 0;
    for (let i = 0; i < p.count; i++) radius = Math.max(radius, Math.hypot(p.getY(i), p.getZ(i)));
    return radius;
  } finally { geometry.dispose(); }
}
/** Original finite floor predicate, unchanged. No centre classification here. */
export function intendedFloorHit(meshName: string, hit: Vector3, center: Vector3, tangent: Vector3, names: ReadonlySet<string>, sectionRadius: number): boolean {
  if (!names.has(meshName)) return false;
  const delta = hit.clone().sub(center), along = delta.dot(tangent), across = delta.addScaledVector(tangent, -along).length();
  return Math.abs(along) <= VILLAGE_RADIUS + .002 && across <= sectionRadius + .002;
}
export interface FloorRayHit {
  readonly name: string; readonly parent: string | undefined; readonly index: number;
  readonly point: [number, number, number];
  readonly triangle: [[number, number, number], [number, number, number], [number, number, number]];
  readonly distanceFromCamera: number;
}
export function contactRayHits(camera: PerspectiveCamera, target: Vector3, center: Vector3, tangent: Vector3,
  surfaces: readonly SurfaceTriangle[], floorNames: ReadonlySet<string>, sectionRadius: number, centreRay: boolean) {
  const delta = target.clone().sub(camera.position), length = delta.length(), ray = new Ray(camera.position, delta.divideScalar(length)), point = new Vector3();
  const intended: FloorRayHit[] = [], foreign: FloorRayHit[] = [];
  for (const face of surfaces) {
    if (!ray.intersectsBox(face.bounds) || !ray.intersectTriangle(face.a, face.b, face.c, false, point) || point.distanceTo(camera.position) >= length - (centreRay ? VILLAGE_RADIUS : 0) - .002) continue;
    const row: FloorRayHit = { name: face.mesh.name, parent: face.mesh.parent?.name, index: face.index, point: point.toArray(),
      triangle: [face.a.toArray(), face.b.toArray(), face.c.toArray()], distanceFromCamera: point.distanceTo(camera.position) };
    (!centreRay && intendedFloorHit(face.mesh.name, point, center, tangent, floorNames, sectionRadius) ? intended : foreign).push(row);
  }
  return { intended, foreign };
}
