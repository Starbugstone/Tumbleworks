import { BoxGeometry, BufferGeometry, ExtrudeGeometry, Matrix4, Path, Quaternion, Shape, Vector3 } from 'three';
import type { VillageProfile, VillageStation } from '../world/village-plan';
import { carrierContact, mechanismMatrix } from './machine-primitives';

export interface CarriageGuideParts {
  readonly kind: 'rail-caliper' | 'post-collar';
  readonly caliper: BufferGeometry;
  readonly rail?: BufferGeometry;
  readonly travel: Vector3;
  readonly frame: Matrix4;
  readonly origin: Vector3;
  readonly tangent: Vector3;
  readonly normal: Vector3;
  readonly across: Vector3;
  readonly halfNormal: number;
  readonly halfAcross: number;
  readonly contactHalfLength: number;
  readonly capacity: number;
}

function ring(outer: readonly [number, number][], inner: readonly [number, number][], depth: number) {
  const shape = new Shape();
  outer.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y)); shape.closePath();
  const hole = new Path();
  inner.forEach(([x, y], i) => i ? hole.lineTo(x, y) : hole.moveTo(x, y)); hole.closePath();
  shape.holes.push(hole);
  return new ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 });
}

/** Actual opposed contact faces, shared by rendering and physical enrolment.
 * A closed ring also supplies the transverse guide moments; a cleared side
 * wall cannot be used as an anti-rotation bearing.
 */
export function carriageGuideParts(station: VillageStation, profile: VillageProfile): CarriageGuideParts | undefined {
  const m = station.mechanism;
  if (!['terracotta', 'plank', 'timber'].includes(profile) || !station.retention || !('travel' in m) || typeof m.travel === 'number'
    || !('deckPitch' in m) || !m.deckPitch || m.travel[2] !== 0) return;
  const vertical = m.travel[0] === 0;
  if (Math.hypot(...m.travel) === 0) return;
  const contact = carrierContact(m), frame = mechanismMatrix(m, station.anchor, 0, new Matrix4());
  const local = new Vector3(contact[0], contact[1] + (vertical ? 1.7 : 1.97), contact[2] - (vertical ? 1.2 : .65));
  const origin = local.clone().applyMatrix4(frame), tangent = new Vector3(...m.travel).normalize();
  const across = new Vector3(0, 0, 1);
  if (vertical) {
    const caliper = ring([[-.16, -.13], [.16, -.13], [.16, .13], [-.16, .13]],
      [[-.06, -.07], [-.06, .07], [.06, .07], [.06, -.07]], .18);
    // Construct the collar in the true fixed-post frame, then carry it in the
    // deck frame. All four inner faces slide on the actual upright post.
    caliper.rotateX(Math.PI / 2).translate(origin.x, origin.y + .09, origin.z).applyMatrix4(frame.clone().invert());
    const rail = profile === 'terracotta' ? undefined : new BoxGeometry(.12, Math.abs(m.travel[1]) + .18, .14)
      .translate(origin.x, origin.y + m.travel[1] / 2, origin.z);
    return { kind: 'post-collar', caliper, rail, travel: new Vector3(...m.travel), frame, origin, tangent, normal: new Vector3(1, 0, 0), across,
      halfNormal: .06, halfAcross: .07, contactHalfLength: .07, capacity: station.retention.brakeForce };
  }
  // A rail has no preferred axial sign; keep its roof upward for either travel direction.
  const railTangent = tangent.x < 0 ? tangent.clone().negate() : tangent;
  const rotation = new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), railTangent);
  const normal = new Vector3(0, 1, 0).applyQuaternion(rotation);
  const up = normal.clone().transformDirection(frame.clone().invert());
  if (up.y <= .5) throw new Error('Carriage guide needs a supported rail frame');
  const bottom = contact[1] + 1.75, bottomLevel = (bottom - local.y) * up.y;
  const caliper = ring([[-.74, bottomLevel], [-.54, bottomLevel], [-.54, .09], [-.74, .09]],
    [[-.72, -.06], [-.72, .06], [-.58, .06], [-.58, -.06]], .15);
  const vertices = caliper.getAttribute('position');
  for (let i = 0; i < vertices.count; i++) {
    const z = vertices.getX(i), level = vertices.getY(i), x = vertices.getZ(i) - .075;
    const y = Math.abs(level - bottomLevel) < 1e-7 ? bottom : local.y + (level - up.x * x) / up.y;
    vertices.setXYZ(i, contact[0] + x, y, contact[2] + z);
  }
  // The (z, level, x) mapping reverses handedness.
  const indices: number[] = [];
  for (let i = 0; i < vertices.count; i += 3) indices.push(i, i + 2, i + 1);
  caliper.setIndex(indices); caliper.computeVertexNormals();
  const end = origin.clone().add(new Vector3(...m.travel));
  const rail = new BoxGeometry(new Vector3(...m.travel).length() + 1.4, .12, .14).applyQuaternion(rotation);
  const centre = origin.clone().add(end).multiplyScalar(.5); rail.translate(centre.x, centre.y, centre.z);
  return { kind: 'rail-caliper', caliper, rail, travel: new Vector3(...m.travel), frame, origin, tangent, normal, across,
    halfNormal: .06, halfAcross: .07, contactHalfLength: .05, capacity: station.retention.brakeForce };
}
