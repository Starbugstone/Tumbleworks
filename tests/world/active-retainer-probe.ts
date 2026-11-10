import { BufferGeometry, CylinderGeometry, Group, Matrix4, Mesh, Vector3 } from 'three';
import type { VillageProgram } from '../../src/world/village-program';
import type { VillageMachine } from '../../src/view/village-machine';
import { VillageRollingPrefix } from '../../src/world/village-prefix';
import type { VillageRetained } from '../../src/world/village-retained';
import type { SurfaceTriangle } from './surface-overlap';
import { certifyNominalSleeve, finiteBar, lateralContact, witnessEquilibrium, type RetainerEvidence, type Equilibrium, type NominalSleeve } from './active-retainer-occlusion';
import { retainerParts, type RetainedLayout } from '../../src/view/retainer-parts';
import { compactCylinderCaps } from '../../src/view/cylinder-caps';
import { VILLAGE_CONTACT, type VillageContactWitness } from '../../src/world/village-contact';

/** The original audit's absent-segment fallback used the LAST floor at t=0.
 * Explicit before/after cases prevent that harness error. */
export function filmSegmentAt<T extends { readonly start: number; readonly end: number }>(segments: readonly T[], time: number): T {
  const first = segments[0], last = segments.at(-1);
  if (!first || !last) throw new Error('Film needs actual compiled segments');
  return segments.find(segment => time >= segment.start && time <= segment.end) ?? (time < first.start ? first : last);
}

export function filmFloorContext(route: Pick<VillageProgram, 'segments' | 'contacts'>, time: number) {
  const segment = filmSegmentAt(route.segments, time);
  const contact = route.contacts.find(c => c.contact === time);
  return { segment, stop: contact?.stop ?? segment.stop, kind: contact ? 'contact' : segment.kind };
}

export interface RetainedKernel {
  readonly motion: VillageRetained;
  readonly fork: Group;
  readonly head?: Group;
  readonly detach: number;
  readonly captureEnd: number;
  readonly releaseAcceleration: (seconds: number) => number;
}

/** One checked, read-only interoperability seam to the ACTUAL cached compiler.
 * No recompilation, alternate motion law, visible pose edits or runtime API. */
export function retainedKernels(machine: VillageMachine): readonly RetainedKernel[] {
  const route = machine.route;
  if (route.authoredPlan.chapter !== 1 || route.authoredPlan.profile !== 'terracotta') return [];
  const prefix: unknown = (route as unknown as { prefix?: unknown }).prefix;
  if (!(prefix instanceof VillageRollingPrefix)) throw new Error('Actual cached physical prefix unavailable');
  const movers: unknown = (machine as unknown as { movers?: unknown }).movers;
  if (!Array.isArray(movers)) throw new Error('Actual fork-role observability unavailable');
  return prefix.retained.map(motion => {
    const forkMover: unknown = movers.find((candidate: unknown) => candidate !== null && typeof candidate === 'object' &&
      'auxiliary' in candidate && candidate.auxiliary === 'fork' && 'station' in candidate && candidate.station === motion.station &&
      'carrierLocal' in candidate && candidate.carrierLocal === true);
    if (!forkMover || typeof forkMover !== 'object' || !('group' in forkMover) || !(forkMover.group instanceof Group))
      throw new Error('Actual model-to-fork role missing');
    const headMover=movers.find((candidate:unknown)=>candidate!==null&&typeof candidate==='object'&&'auxiliary'in candidate&&candidate.auxiliary==='capture-head'&&'station'in candidate&&candidate.station===motion.station&&'carrierLocal'in candidate&&candidate.carrierLocal===true);
    const head=headMover&&'group'in headMover&&headMover.group instanceof Group?headMover.group:undefined;
    if(motion.keyedHead&&!head)throw new Error('Actual keyed-head role missing');
    const hidden = motion as unknown as { detachTime?: unknown; releaseConstraint?: unknown };
    if (typeof hidden.detachTime !== 'number' || !Number.isFinite(hidden.detachTime) || typeof hidden.releaseConstraint !== 'function')
      throw new Error('Authoritative retained phase/force observability unavailable');
    const release = hidden.releaseConstraint;
    return { motion, fork: forkMover.group, head, detach: motion.carryEnd + hidden.detachTime,
      captureEnd: motion.start + (motion.capture?.centreStop ?? 0),
      releaseAcceleration: seconds => {
        const result: unknown = Reflect.apply(release, motion, [seconds]);
        if (!result || typeof result !== 'object' || !('acceleration' in result) || typeof result.acceleration !== 'number')
          throw new Error('Invalid authoritative release acceleration');
        return result.acceleration;
      } };
  });
}

export function retainedPhase(kernel: RetainedKernel, time: number): RetainerEvidence['phase'] | undefined {
  const m = kernel.motion;
  if (time < m.start) return m.station.initialCargo && time >= 0 ? 'initial-hold' : undefined;
  if (time >= kernel.detach) return;
  if (time < kernel.captureEnd) return 'capture';
  if (time < m.carryStart) return 'closing';
  return time < m.carryEnd ? 'carry' : 'release';
}

const references = new Map<string, BufferGeometry>();
function sleeveReference(layout: RetainedLayout, role: 'leading' | 'trailing'): BufferGeometry {
  const key = `${layout}:${role}`;
  let geometry = references.get(key);
  if (!geometry) {
    for (const part of retainerParts('terracotta', layout, 1, -1)) {
      if (part.id === `${role}-sleeve`) {
        geometry = part.geometry;
        if (!(geometry instanceof CylinderGeometry)) throw new Error('Shared sleeve builder changed');
        compactCylinderCaps(geometry);
      } else part.geometry.dispose();
    }
    if (!geometry) throw new Error('Shared sleeve builder missing');
    references.set(key, geometry);
  }
  return geometry;
}

export function barEvidence(route: VillageProgram, kernel: RetainedKernel, time: number, center: Vector3,
  faces: readonly SurfaceTriangle[], candidates: readonly Mesh[], currentStop: number): readonly RetainerEvidence[] {
  const m = kernel.motion, station = m.station, mechanism = station.mechanism;
  const phase = retainedPhase(kernel, time);
  // Explicit Gardens-only enrollment. Terminal is not a fork. Unsupported
  // directions, rigid rotation and unobservable states fail closed.
  if (!phase || station.stop !== currentStop || !station.retention || station.terminalCapture ||
      !['suspended', 'translating'].includes(mechanism.kind) || !('travel' in mechanism) || typeof mechanism.travel === 'number' ||
      m.inputDirection !== 1 || m.outputDirection !== 1) return [];
  const matrix = new Matrix4(); route.carrierPose(station.stop, time, matrix);
  const tangent = new Vector3().setFromMatrixColumn(matrix, 0).normalize();
  const normal = new Vector3().setFromMatrixColumn(matrix, 1).normalize();
  const pose = { localX: 0, progress: 0, forkX: 0, forkAngle: 0, forkLift: 0, weightDrop: 0 };
  m.state(time, pose);
  const modelCenter = new Vector3(pose.localX, 0, 0).applyMatrix4(matrix);
  if (center.distanceTo(modelCenter) > Number.EPSILON * 32 * (1 + center.length() + modelCenter.length())) return [];
  const identified: { contact: NonNullable<ReturnType<typeof lateralContact>>; role: 'leading' | 'trailing'; nominal: NominalSleeve }[] = [];
  for (const mesh of candidates) {
    const bar = finiteBar(mesh, faces);
    if (!bar || (mesh.parent !== kernel.fork && mesh.parent !== kernel.head)) continue;
    const metadata: unknown = mesh.userData['retainerPart'];
    if (!metadata || typeof metadata !== 'object' || !('id' in metadata)) continue;
    const role = metadata.id === 'leading-sleeve' ? 'leading' : metadata.id === 'trailing-sleeve' ? 'trailing' : undefined;
    if (!role || (role === 'leading' && kernel.head && mesh.parent !== kernel.head) || (role === 'trailing' && mesh.parent !== kernel.fork)) continue;
    if (role === 'trailing' && ((!station.initialCargo && time < m.closureEnd) || phase === 'release')) continue;
    const auxiliary = { x: 0, y: 0, z: 0, angle: 0 };
    route.auxiliaryPose(station.stop, mesh.parent === kernel.head ? 'capture-head' : 'fork', time, auxiliary);
    const angularRoundoff = Number.EPSILON * 32 * (1 + Math.abs(time) + Math.abs(m.closureStart)) / (m.closing?.duration ?? 1);
    if (Math.abs(auxiliary.angle) > angularRoundoff || !mesh.parent.parent?.matrixWorld.equals(new Matrix4())) continue;
    const localMatrix = new Matrix4().makeRotationZ(auxiliary.angle).setPosition(auxiliary.x, auxiliary.y, auxiliary.z);
    const expected = matrix.clone().multiply(localMatrix);
    const contact = lateralContact(bar, center);
    if (!contact) continue;
    const sin = phase === 'release' ? auxiliary.y / .3 : 0;
    if (sin < 0 || sin >= 1) continue;
    const modelNormal = new Vector3((role === 'leading' ? -1 : 1) * Math.sqrt(1 - sin * sin), -sin, 0);
    const nominal = certifyNominalSleeve(contact, sleeveReference(m.inventory.layout, role), expected,
      role === 'leading' ? 0 : -.68, new Vector3(pose.localX - auxiliary.x, -auxiliary.y, -auxiliary.z), modelNormal);
    if (nominal) identified.push({ contact, role, nominal });
  }
  let acceleration = new Vector3(), spinAcceleration = 0;
  // Centre-stop is not spin-stop: finite held-slip may continue during closure.
  if (m.capture && time < m.carryStart) {
    // state() switches to the held centre at the published absolute closure
    // boundary. Subtracting its epoch may round to the previous event; use
    // that same right-hand boundary, not a force or time tolerance.
    const elapsed = time >= m.closureStart ? Math.max(m.capture.centreStop, time - m.start) : time - m.start;
    const event = m.capture.eventAt(elapsed);
    acceleration.addScaledVector(tangent, m.inputDirection * event.a);
    spinAcceleration = m.inputDirection * event.spinRate;
  } else if (phase === 'release') {
    const relativeAcceleration = m.outputDirection * kernel.releaseAcceleration(time - m.carryEnd);
    acceleration.addScaledVector(tangent, relativeAcceleration);
    spinAcceleration = relativeAcceleration;
  } else if (phase === 'carry') {
    const duration = m.carryEnd - m.carryStart, u = (time - m.carryStart) / duration;
    acceleration = new Vector3(...mechanism.travel).multiplyScalar((6 - 12 * u) / duration ** 2);
  }
  const witness: VillageContactWitness = { phase: '', floorNormal: 0, floorFriction: 0, leadingReaction: 0, trailingReaction: 0, brake: 0 };
  let equilibrium: Equilibrium = { kind: 'unsupported', reason: 'no authoritative instantaneous contact witness' };
  if (route.physicalLedger.some(row => row.stop === station.stop) &&
      (route.contactWitness(station.stop, time, witness) || (station.initialCargo && time < m.start && (m.contactWitness(time, witness), true)))) {
    equilibrium = witnessEquilibrium({ mass: station.retention.marbleMass, radius: .3, inertiaFactor: m.inertiaFactor,
      acceleration, spinAcceleration, tangent, floorNormal: normal, traction: VILLAGE_CONTACT.mu, witness,
      contacts: identified.map(row => ({ contact: row.contact, normal: row.nominal.normal,
        reaction: row.role === 'leading' ? witness.leadingReaction : witness.trailingReaction })) });
  }
  return identified.map(({ contact, role, nominal }) => ({ stop: station.stop, currentStop, role, phase, contact,
    modelContact: true, equilibrium, nominal }));
}
