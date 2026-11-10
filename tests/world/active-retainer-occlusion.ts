import { BufferGeometry, CylinderGeometry, Matrix4, Mesh, Triangle, Vector3 } from 'three';
import type { VillageContactWitness } from '../../src/world/village-contact';
import { VILLAGE_RADIUS } from '../../src/world/village-plan';
import type { SurfaceTriangle } from './surface-overlap';

// Existing sphereSupported/contact-ray spatial slack. No force or ray limit is relaxed.
export const CONTACT_SLACK = .002;

export interface FiniteBar {
  readonly mesh: Mesh;
  readonly axis: Vector3;
  readonly origin: Vector3;
  readonly minimum: number;
  readonly maximum: number;
  readonly radius: number;
  readonly lateral: readonly SurfaceTriangle[];
  readonly surface: readonly SurfaceTriangle[];
}

/** Verify the actual Gardens contact-cylinder buffer, not a mesh-name pattern.
 * The caller must separately establish the model/fork role. Caps are excluded. */
export function finiteBar(mesh: Mesh, faces: readonly SurfaceTriangle[]): FiniteBar | undefined {
  if (!(mesh.geometry instanceof CylinderGeometry)) return;
  const side = mesh.geometry.groups.find(group => group.materialIndex === 0);
  if (!side) return;
  const positions = mesh.geometry.getAttribute('position');
  const index = mesh.geometry.index;
  const vertices: Vector3[] = [];
  for (let i = side.start; i < side.start + side.count; i++) {
    vertices.push(new Vector3().fromBufferAttribute(positions, index ? index.getX(i) : i));
  }
  const xs = vertices.map(p => p.x), ys = vertices.map(p => p.y), zs = vertices.map(p => p.z);
  const x = (Math.min(...xs) + Math.max(...xs)) / 2;
  const y = (Math.min(...ys) + Math.max(...ys)) / 2;
  const lo = Math.min(...zs), hi = Math.max(...zs);
  const radius = Math.max(...vertices.map(p => Math.hypot(p.x - x, p.y - y)));
  // Float32 storage error bound, not a new physical acceptance tolerance.
  const rounding = 2 ** -23 * Math.max(1, Math.abs(x), Math.abs(y), Math.abs(lo), Math.abs(hi));
  if (Math.abs(radius - .04) > rounding || hi <= lo || vertices.some(p =>
    Math.abs(Math.hypot(p.x - x, p.y - y) - radius) > rounding ||
    Math.min(Math.abs(p.z - lo), Math.abs(p.z - hi)) > rounding)) return;
  for (let i = 0; i < positions.count; i++) {
    const p = new Vector3().fromBufferAttribute(positions, i);
    if (Math.hypot(p.x - x, p.y - y) > radius + rounding || p.z < lo - rounding || p.z > hi + rounding) return;
  }
  mesh.updateWorldMatrix(true, false);
  const basis = [0, 1, 2].map(column => new Vector3().setFromMatrixColumn(mesh.matrixWorld, column));
  const matrixRoundoff = Number.EPSILON * 32;
  if (basis.some(v => Math.abs(v.lengthSq() - 1) > matrixRoundoff) ||
      Math.abs(basis[0]!.dot(basis[1]!)) > matrixRoundoff || Math.abs(basis[0]!.dot(basis[2]!)) > matrixRoundoff ||
      Math.abs(basis[1]!.dot(basis[2]!)) > matrixRoundoff) return;
  const origin = new Vector3(x, y, 0).applyMatrix4(mesh.matrixWorld);
  const end = new Vector3(x, y, 1).applyMatrix4(mesh.matrixWorld);
  const scale = end.distanceTo(origin);
  const lateral = faces.filter(f => f.mesh === mesh && f.index * 3 >= side.start && f.index * 3 < side.start + side.count);
  if (!lateral.length || Math.abs(scale - 1) > Number.EPSILON * 16) return;
  return { mesh, origin, axis: end.sub(origin).normalize(), minimum: lo, maximum: hi, radius, lateral, surface: faces.filter(f => f.mesh === mesh) };
}

export interface BarContact {
  readonly bar: FiniteBar;
  readonly point: Vector3;
  /** Compressive reaction direction ON THE SPHERE. */
  readonly normal: Vector3;
  readonly gap: number;
  readonly station: number;
}

export function lateralContact(bar: FiniteBar, center: Vector3): BarContact | undefined {
  let distance = Infinity;
  const point = new Vector3();
  for (const face of bar.lateral) {
    const candidate = new Triangle(face.a, face.b, face.c).closestPointToPoint(center, new Vector3());
    if (candidate.distanceTo(center) < distance) { distance = candidate.distanceTo(center); point.copy(candidate); }
  }
  const station = point.clone().sub(bar.origin).dot(bar.axis);
  if (Math.abs(distance - VILLAGE_RADIUS) > CONTACT_SLACK || station <= bar.minimum || station >= bar.maximum) return;
  const normal = center.clone().sub(point).normalize();
  // At a polygon vertex the normal lies in the adjacent faces' normal cone.
  // Every actual lateral vertex must be on the bar side of this supporting plane.
  if (bar.lateral.some(f => [f.a, f.b, f.c].some(v => v.clone().sub(point).dot(normal) > CONTACT_SLACK))) return;
  return { bar, point, normal, gap: distance - VILLAGE_RADIUS, station };
}

/** Physical contact and storage evidence are distinct. Ray tests always retain
 * BarContact.point/normal and the original rendered triangles. */
export interface NominalSleeve {
  readonly bufferMatch: 'exact-shared-builder';
  readonly matrixMatch: 'exact-rigid-pose';
  readonly normal: Vector3;
  readonly point: Vector3;
  readonly maximumVertexError: number;
  readonly vertexErrorBound: number;
  readonly packedNormalError: number;
  readonly nominalGap: number;
}

/** Exact builder-buffer and pose certificate for one regular 16-sided sleeve.
 * A name, radius fit, nearby centre or arbitrary normal is insufficient. */
export function certifyNominalSleeve(contact: BarContact, reference: BufferGeometry, expectedWorld: Matrix4,
  offset: number, localCenter: Vector3, localNormal: Vector3): NominalSleeve | undefined {
  const { mesh } = contact.bar, geometry = mesh.geometry;
  if (!(geometry instanceof CylinderGeometry) || geometry.parameters.radialSegments !== 16 ||
      JSON.stringify(geometry.parameters) !== JSON.stringify((reference as CylinderGeometry).parameters) ||
      !mesh.matrix.equals(new Matrix4()) || !mesh.matrixWorld.equals(expectedWorld) ||
      JSON.stringify(geometry.groups) !== JSON.stringify(reference.groups)) return;
  for (const name of ['position', 'normal']) {
    const a = geometry.getAttribute(name), b = reference.getAttribute(name);
    if (!a || !b || a.count !== b.count || a.itemSize !== b.itemSize ||
        !Array.from(a.array).every((value, i) => Object.is(value, b.array[i]))) return;
  }
  if (!geometry.index || !reference.index || geometry.index.count !== reference.index.count ||
      !Array.from(geometry.index.array).every((value, i) => value === reference.index!.array[i])) return;
  if (contact.bar.surface.length !== geometry.index.count / 3 ||
      new Set(contact.bar.surface.map(face => face.index)).size !== geometry.index.count / 3) return;
  // Reject stale/fabricated world-space probe triangles as well as altered meshes.
  const positions = geometry.getAttribute('position');
  if (contact.bar.surface.some(face => [face.a, face.b, face.c].some((v, corner) =>
    !v.equals(new Vector3().fromBufferAttribute(positions, geometry.index!.getX(face.index * 3 + corner)).applyMatrix4(expectedWorld))))) return;
  if (Math.abs(localNormal.lengthSq() - 1) > Number.EPSILON * 32 || localNormal.z !== 0) return;
  const point = new Vector3(offset + Math.sign(localNormal.x) * .04, 0, localCenter.z);
  const delta = localCenter.clone().sub(point), gap = delta.length() - VILLAGE_RADIUS;
  const arithmetic = Number.EPSILON * 32 * (1 + localCenter.length() + Math.abs(offset));
  if (Math.abs(gap) > arithmetic || delta.addScaledVector(localNormal, -VILLAGE_RADIUS).length() > arithmetic ||
      Math.abs(localCenter.z) >= .28) return;
  // CylinderGeometry packs, rotates and translates Float32 positions in three
  // stages. Bound each rounding by 2^-24 times a conservative coordinate scale.
  const vertexErrorBound = 3 * 2 ** -24 * (.28 + .04 + Math.abs(offset));
  let maximumVertexError = 0;
  for (let ring = 0; ring < 2; ring++) for (let j = 0; j <= 16; j++) {
    const angle = j / 16 * 2 * Math.PI;
    const nominal = new Vector3(offset + .04 * Math.sin(angle), -.04 * Math.cos(angle), ring === 0 ? .28 : -.28);
    const packed = new Vector3().fromBufferAttribute(positions, ring * 17 + j);
    maximumVertexError = Math.max(maximumVertexError, packed.distanceTo(nominal));
    // At an edge the allowed load lies in its actual polygon normal cone.
    if (nominal.clone().sub(point).dot(localNormal) > arithmetic) return;
  }
  if (maximumVertexError > vertexErrorBound) return;
  const normal = localNormal.clone().transformDirection(expectedWorld);
  return { bufferMatch: 'exact-shared-builder', matrixMatch: 'exact-rigid-pose',
    normal, point: point.applyMatrix4(expectedWorld), maximumVertexError, vertexErrorBound,
    packedNormalError: normal.distanceTo(contact.normal), nominalGap: gap };
}

export interface WitnessEquilibriumInput {
  readonly mass: number;
  readonly radius: number;
  readonly inertiaFactor: number;
  readonly acceleration: Vector3;
  /** Derivative of R*omega, signed in the carrier's rolling direction. */
  readonly spinAcceleration: number;
  readonly tangent: Vector3;
  readonly floorNormal: Vector3;
  readonly traction: number;
  readonly witness: Readonly<VillageContactWitness>;
  readonly contacts: readonly { readonly contact: BarContact; readonly normal: Vector3; readonly reaction: number }[];
}

/** Independent Newton AND Euler, using the current Coulomb slip/spin witness.
 * No inference of no-slip during capture; no residual force cutoff. */
export function witnessEquilibrium(input: WitnessEquilibriumInput): Equilibrium {
  const { mass, radius, inertiaFactor, acceleration, spinAcceleration, tangent, floorNormal, traction, witness, contacts } = input;
  const finite = [mass, radius, inertiaFactor, spinAcceleration, traction, ...acceleration.toArray(),
    ...tangent.toArray(), ...floorNormal.toArray(), witness.floorNormal, witness.floorFriction,
    witness.leadingReaction, witness.trailingReaction, witness.brake, ...contacts.flatMap(c => [c.reaction, ...c.normal.toArray()])];
  const invalid = (reason: string): Equilibrium => ({ kind: 'unsupported', reason });
  if (!['carry', 'release', 'braking-slip', 'braking-roll', 'held-slip', 'held-rest'].includes(witness.phase) ||
      new Set(contacts.map(c => c.contact.bar.mesh)).size !== contacts.length || !finite.every(Number.isFinite) || mass <= 0 || radius <= 0 || inertiaFactor <= 1 || traction < 0 ||
      Math.abs(tangent.lengthSq() - 1) > Number.EPSILON * 32 || Math.abs(floorNormal.lengthSq() - 1) > Number.EPSILON * 32 ||
      Math.abs(tangent.dot(floorNormal)) > Number.EPSILON * 32 ||
      contacts.some(c => Math.abs(c.normal.lengthSq() - 1) > Number.EPSILON * 32)) return invalid('unknown kinematics');
  if (witness.floorNormal <= 0 || Math.abs(witness.floorFriction) > traction * witness.floorNormal ||
      witness.leadingReaction < 0 || witness.trailingReaction < 0 || contacts.some(c => c.reaction < 0)) return invalid('non-unilateral contact witness');
  // Missing loaded contacts must fail, even if their force could cancel another.
  if (Math.abs(contacts.reduce((sum, c) => sum + c.reaction, 0) - witness.leadingReaction - witness.trailingReaction) >
      Number.EPSILON * 32 * (witness.leadingReaction + witness.trailingReaction)) return invalid('missing loaded contact');
  const demand = acceleration.clone().add(new Vector3(0, 9.81, 0)).multiplyScalar(mass);
  const balance = floorNormal.clone().multiplyScalar(witness.floorNormal).addScaledVector(tangent, witness.floorFriction);
  for (const c of contacts) balance.addScaledVector(c.normal, c.reaction);
  const residual = balance.distanceTo(demand);
  const arithmeticBound = Number.EPSILON * 32 * (demand.length() + Math.abs(witness.floorNormal) + Math.abs(witness.floorFriction) + witness.leadingReaction + witness.trailingReaction);
  const torque = radius * witness.floorFriction, angularDemand = -mass * (inertiaFactor - 1) * radius * spinAcceleration;
  const angularResidual = Math.abs(torque - angularDemand);
  const angularBound = Number.EPSILON * 32 * (Math.abs(torque) + Math.abs(angularDemand));
  if (residual > arithmeticBound || angularResidual > angularBound)
    return invalid(JSON.stringify({ reason: 'instantaneous Newton/Euler witness does not balance', residual, arithmeticBound, angularResidual, angularBound }));
  return { kind: 'equilibrium', reactions: new Map(contacts.map(c => [c.contact.bar.mesh, c.reaction])),
    floorReaction: witness.floorNormal, floorFriction: witness.floorFriction, residual, arithmeticBound, angularResidual, angularBound };
}

export interface UnilateralInput {
  readonly mass: number;
  readonly inertiaFactor: number;
  readonly acceleration: Vector3;
  readonly relativeAcceleration: number;
  readonly tangent: Vector3;
  readonly floorNormal: Vector3;
  readonly contacts: readonly BarContact[];
  readonly traction: number;
}
export type Equilibrium = { readonly kind: 'unsupported'; readonly reason: string } | {
  readonly kind: 'equilibrium'; readonly reactions: ReadonlyMap<Mesh, number>;
  readonly floorReaction: number; readonly floorFriction: number;
  readonly residual: number; readonly arithmeticBound: number;
  readonly angularResidual?: number; readonly angularBound?: number;
};

/** Newton + Euler for a sphere on the CURRENT FIXED-ORIENTATION translating deck.
 * Normal bar reactions pass through COM and exert no sphere torque. No-slip
 * rolling therefore fixes floor friction to -m*(k-1)*relativeAcceleration.
 * Enumerate the unilateral active sets; a two-sided closed cradle may have a
 * loaded bar plus a zero-load enclosing touch. Negative force is NEVER clamped.
 * Unknown/rotating-deck kinematics must be rejected by the caller. */
export function unilateralEquilibrium(input: UnilateralInput): Equilibrium {
  const { mass, inertiaFactor: k, acceleration, relativeAcceleration, tangent, floorNormal: normal, contacts, traction } = input;
  if (![mass, k, relativeAcceleration, traction, ...acceleration.toArray()].every(Number.isFinite) || mass <= 0 || k < 1)
    return { kind: 'unsupported', reason: 'unknown kinematics' };
  const demand = acceleration.clone().add(new Vector3(0, 9.81, 0)).multiplyScalar(mass);
  const friction = -mass * (k - 1) * relativeAcceleration;
  const required = demand.dot(tangent) - friction;
  const choices: (BarContact | undefined)[] = required === 0 ? [undefined] : [...contacts];
  for (const loaded of choices) {
    const projection = loaded?.normal.dot(tangent) ?? 1;
    if (projection === 0) continue;
    const reaction = loaded ? required / projection : 0;
    if (!Number.isFinite(reaction) || reaction < 0) continue;
    const floor = demand.dot(normal) - reaction * (loaded?.normal.dot(normal) ?? 0);
    if (floor <= 0 || Math.abs(friction) > traction * floor) continue;
    const balance = normal.clone().multiplyScalar(floor).addScaledVector(tangent, friction);
    if (loaded) balance.addScaledVector(loaded.normal, reaction);
    const residual = balance.distanceTo(demand);
    // Roundoff bound for the finite dot/multiply/add operations; not a force cutoff.
    const arithmeticBound = Number.EPSILON * 32 * (demand.length() + Math.abs(floor) + Math.abs(friction) + reaction);
    if (residual > arithmeticBound) continue;
    const reactions = new Map(contacts.map(c => [c.bar.mesh, c === loaded ? reaction : 0]));
    return { kind: 'equilibrium', reactions, floorReaction: floor, floorFriction: friction, residual, arithmeticBound };
  }
  return { kind: 'unsupported', reason: 'no complete unilateral floor/bar equilibrium' };
}

export interface RetainerEvidence {
  readonly stop: number;
  readonly currentStop: number;
  readonly role: 'leading' | 'trailing';
  readonly phase: 'initial-hold' | 'capture' | 'closing' | 'carry' | 'release';
  readonly modelContact: boolean;
  readonly contact: BarContact;
  readonly equilibrium: Equilibrium;
  readonly nominal?: NominalSleeve;
}
export interface RetainerRay {
  readonly kind: 'centre' | 'rim';
  readonly eye: Vector3;
  readonly target: Vector3;
  readonly hit: Vector3;
  readonly mesh: Mesh;
}
export type RetainerDecision = { readonly kind: 'foreign'; readonly reason: string } | {
  readonly kind: 'active-retainer'; readonly load: 'loaded' | 'enclosing-touch';
  readonly reaction: number; readonly axialOffset: number;
  readonly planeDistance: number; readonly rayProjection: number;
  readonly planeCrossing: number; readonly distanceBeforeTarget: number;
};

/** This is a presentation-policy extension, NOT a contact-patch classification. */
export function activeRetainerHit(ray: RetainerRay, evidence?: RetainerEvidence): RetainerDecision {
  if (ray.kind === 'centre') return { kind: 'foreign', reason: 'centre never filtered' };
  if (!evidence || evidence.stop !== evidence.currentStop || !evidence.modelContact)
    return { kind: 'foreign', reason: 'no authoritative active role/phase' };
  const { contact, equilibrium } = evidence;
  if (ray.mesh !== contact.bar.mesh) return { kind: 'foreign', reason: 'different finite bar' };
  if (Math.abs(contact.gap) > CONTACT_SLACK) return { kind: 'foreign', reason: 'separated bar' };
  if (equilibrium.kind !== 'equilibrium') return { kind: 'foreign', reason: equilibrium.reason };
  const reaction = equilibrium.reactions.get(ray.mesh);
  if (reaction === undefined || !Number.isFinite(reaction) || reaction < 0)
    return { kind: 'foreign', reason: 'unknown or pulling reaction' };
  const axialOffset = ray.hit.clone().sub(contact.point).dot(contact.bar.axis);
  if (Math.abs(axialOffset) > VILLAGE_RADIUS + CONTACT_SLACK)
    return { kind: 'foreign', reason: 'outside axial holding band' };
  const delta = ray.target.clone().sub(ray.eye), length = delta.length();
  const direction = delta.divideScalar(length);
  const center = contact.point.clone().addScaledVector(contact.normal, VILLAGE_RADIUS + contact.gap);
  const rimNormal = ray.target.clone().sub(center);
  if (Math.abs(rimNormal.length() - VILLAGE_RADIUS) > CONTACT_SLACK || Math.abs(rimNormal.dot(direction)) > CONTACT_SLACK)
    return { kind: 'foreign', reason: 'target is not an actual sphere silhouette tangent' };
  const hitStation = ray.hit.clone().sub(ray.eye).dot(direction);
  if (ray.eye.clone().addScaledVector(direction, hitStation).distanceTo(ray.hit) > CONTACT_SLACK ||
      !contact.bar.surface.some(face => new Triangle(face.a, face.b, face.c).closestPointToPoint(ray.hit, new Vector3()).distanceTo(ray.hit) <= CONTACT_SLACK))
    return { kind: 'foreign', reason: 'hit is not on actual ray and finite bar surface' };
  if (hitStation <= 0 || hitStation >= length - CONTACT_SLACK)
    return { kind: 'foreign', reason: 'outside original ray segment' };
  // Exact per-ray supporting-plane oracle. For target P and hit H=P-s*d,
  // (H-Q).n = (P-Q).n - s*d.n <= 0. Use the measured polygon support plane,
  // not a centre-eye angular approximation or a fitted angular acceptance cone.
  const planeDistance = ray.target.clone().sub(contact.point).dot(contact.normal);
  const rayProjection = direction.dot(contact.normal);
  const distanceBeforeTarget = length - hitStation;
  if (ray.eye.clone().sub(contact.point).dot(contact.normal) >= 0 || rayProjection <= 0 ||
      ray.hit.clone().sub(contact.point).dot(contact.normal) > CONTACT_SLACK)
    return { kind: 'foreign', reason: 'wrong-facing supporting plane' };
  const planeCrossing = planeDistance / rayProjection;
  if (distanceBeforeTarget < planeCrossing - CONTACT_SLACK / rayProjection)
    return { kind: 'foreign', reason: 'per-ray plane inconsistency' };
  return { kind: 'active-retainer', load: reaction > 0 ? 'loaded' : 'enclosing-touch', reaction,
    axialOffset, planeDistance, rayProjection, planeCrossing, distanceBeforeTarget };
}

export interface ForeignRayObservation { readonly time: number; readonly rays: readonly { readonly ray: number; readonly foreign: readonly string[] }[] }
export interface ForeignRayInterval { readonly ray: number; readonly start: number; end: number; readonly guardStart: number; readonly names: Set<string> }

/** Original 20Hz guard: do not reset an occlusion when its foreign mesh changes.
 * The original guard's half-open first .05s sample bin remains conservative. */
export function foreignRayIntervals(observations: readonly ForeignRayObservation[]): readonly ForeignRayInterval[] {
  const intervals: ForeignRayInterval[] = [], active = new Map<number, ForeignRayInterval>();
  for (const sample of observations) for (const ray of sample.rays) {
    if (!ray.foreign.length) { active.delete(ray.ray); continue; }
    let interval = active.get(ray.ray);
    if (!interval) { interval = { ray: ray.ray, start: sample.time, end: sample.time, guardStart: sample.time - 1 / 20, names: new Set() }; active.set(ray.ray, interval); intervals.push(interval); }
    interval.end = sample.time; for (const name of ray.foreign) interval.names.add(name);
  }
  return intervals;
}
