import { BufferGeometry, Vector3 } from 'three';
import { VILLAGE_RADIUS, type VillageChannelLip, type VillagePort } from '../world/village-plan';

/** One profile definition for mesh construction and its independent buffer guards. */
export const TERRACOTTA_CHANNEL_PROFILE = [[-.4, 0], [-.4, .2], [-.5, .3], [-.6, .25], [-.6, -.03], [-.4, -.1],
  [.4, -.1], [.6, -.03], [.6, .25], [.5, .3], [.4, .2], [.4, 0]] as const;
export interface ChannelLipConstruction {
  readonly lip: VillageChannelLip;
  readonly staticFloor: true;
  readonly protectedOriginalFrames: readonly number[];
}
interface FloorPlane { readonly span: number; readonly point: Vector3; readonly normal: Vector3 }
const vector = (p: readonly [number, number, number]) => new Vector3(...p);
const fail = (detail: string): never => { throw new Error(`Channel lip: ${detail}`); };

/** Construction only. The caller supplies the SAME compressed frame list used
 * to build these buffers, retaining the original authored frame identities. */
export function trimChannelLip(geometry: BufferGeometry, frames: readonly VillagePort[], originals: readonly number[],
  originalCount: number, options: ChannelLipConstruction, refinedFloor: boolean): void {
  const { lip, protectedOriginalFrames } = options;
  if (options.staticFloor !== true || !lip || !['negative', 'positive'].includes(lip.side)) fail('static floor and explicit side required');
  if (!Number.isFinite(lip.minimumHeight) || lip.minimumHeight < .17 || lip.minimumHeight > .3) fail('minimum height outside .17..3');
  if (!lip.envelopes.length || frames.length !== originals.length || originals.some((v, i) => !Number.isInteger(v) || v < 0 || v >= originalCount || i > 0 && v <= originals[i - 1]!)) fail('invalid original frame map');
  if (protectedOriginalFrames.some(v => !Number.isInteger(v) || v < 0 || v >= originalCount)) fail('invalid protected frame');
  const envelopes = lip.envelopes.map(envelope => {
    const authored = [envelope.startFrame, envelope.fullStartFrame, envelope.fullEndFrame, envelope.endFrame];
    if (authored.some(v => !Number.isInteger(v) || v < 0 || v >= originalCount) || authored[0]! >= authored[1]! || authored[1]! > authored[2]! || authored[2]! >= authored[3]!) fail('invalid original frame envelope');
    const mapped = authored.map(v => originals.indexOf(v));
    if (mapped.some(v => v < 0) || mapped[1]! - mapped[0]! < 8 || mapped[3]! - mapped[2]! < 8) fail('fade requires eight existing surface frames on each side');
    const [start, fullStart, fullEnd, end] = mapped as [number, number, number, number];
    for (let ring = start + 1; ring < end; ring++) {
      const p = frames[ring]!, side = new Vector3().crossVectors(vector(p.tangent), vector(p.normal)).normalize();
      if (protectedOriginalFrames.includes(originals[ring]!)) fail('envelope modifies protected pad frame');
      if (side.z * (lip.side === 'positive' ? 1 : -1) <= 0) fail('selected wall does not face positive z');
    }
    return { start, fullStart, fullEnd, end };
  });
  const profile = TERRACOTTA_CHANNEL_PROFILE, position = geometry.getAttribute('position'), indices = geometry.index!;
  if (!position || !indices || position.itemSize !== 3) fail('indexed profile buffer required');
  // Reject foreign/shifted buffers. This is the producer's exact Float32 layout,
  // not a radius fit or a mesh-name allowance.
  frames.forEach((p, ring) => {
    const side = new Vector3().crossVectors(vector(p.tangent), vector(p.normal)).normalize();
    profile.forEach(([across, height], j) => {
      for (let k = 0; k < 3; k++) {
        const expected = Math.fround(p.position[k]! + side.getComponent(k) * across * p.width + p.normal[k]! * (height - VILLAGE_RADIUS) + p.tangent[k]! * 0);
        if (!Object.is(position.array[(ring * 12 + j) * 3 + k], expected)) fail('foreign profile vertices');
      }
    });
  });
  const baseCount = frames.length * 12, planes: FloorPlane[] = [];
  let offset = 0, extra = baseCount;
  const v = (id: number) => new Vector3().fromBufferAttribute(position, id);
  for (let span = 0; span + 1 < frames.length; span++) for (let edge = 0; edge < 12; edge++) {
    const a = span * 12 + edge, b = span * 12 + (edge + 1) % 12, c = (span + 1) * 12 + edge, d = (span + 1) * 12 + (edge + 1) % 12;
    const fan = edge === 11 && indices.getX(offset + 2) !== b;
    if (fan && !refinedFloor) fail('unexpected refined floor');
    const expected = fan ? [a, c, extra, c, d, extra, d, b, extra, b, a, extra] : [a, c, b, b, c, d];
    if (expected.some((id, j) => indices.getX(offset + j) !== id)) fail('foreign profile indices');
    if (fan) {
      const before = frames[span]!, after = frames[span + 1]!, n = vector(before.normal).add(vector(after.normal)).normalize();
      const centre = vector(before.position).add(vector(after.position)).multiplyScalar(.5).addScaledVector(n, -VILLAGE_RADIUS);
      if (![0, 1, 2].every(k => Object.is(position.array[extra * 3 + k], Math.fround(centre.getComponent(k))))) fail('foreign refined floor vertex');
      extra++;
    }
    if (edge === 11) for (let j = 0; j < expected.length; j += 3) {
      const p = v(expected[j]!), normal = v(expected[j + 1]!).sub(p).cross(v(expected[j + 2]!).sub(p)).normalize();
      if (normal.dot(vector(frames[span]!.normal)) < 0) normal.negate();
      if (normal.lengthSq() === 0) fail('degenerate local floor');
      planes.push({ span, point: p, normal });
    }
    offset += expected.length;
  }
  if (offset !== indices.count || extra !== position.count) fail('foreign profile topology');
  const original = Float32Array.from(position.array), output = Float32Array.from(position.array);
  const get = (a: Float32Array, id: number) => new Vector3().fromArray(a, id * 3);
  const packingPad = 6 * 2 ** -24 * Math.max(1, ...Array.from(original, Math.abs));
  const lipVertices = lip.side === 'negative' ? [1, 2, 3] : [8, 9, 10], floorVertex = lip.side === 'negative' ? 0 : 11;
  const ease = (u: number) => u * u * (3 - 2 * u);
  for (const envelope of envelopes) {
    for (let ring = envelope.start; ring <= envelope.end; ring++) {
      const p = frames[ring]!, normal = vector(p.normal), floor = get(original, ring * 12 + floorVertex);
      const local = planes.filter(plane => plane.span === ring - 1 || plane.span === ring);
      if (!local.length) fail('local floor planes unavailable');
      const weight = ring === envelope.start || ring === envelope.end ? 0 : ring < envelope.fullStart ? ease((ring - envelope.start) / (envelope.fullStart - envelope.start))
        : ring > envelope.fullEnd ? ease((envelope.end - ring) / (envelope.end - envelope.fullEnd)) : 1;
      for (const j of lipVertices) {
        const id = ring * 12 + j, source = get(original, id), oldHeight = source.clone().sub(floor).dot(normal);
        let minimum = lip.minimumHeight + packingPad;
        for (const plane of local) {
          const projection = normal.dot(plane.normal); if (!(projection > 0)) fail('unsupported local floor normal');
          minimum = Math.max(minimum, oldHeight + (lip.minimumHeight + packingPad - source.clone().sub(plane.point).dot(plane.normal)) / projection);
        }
        const target = oldHeight - (oldHeight - Math.min(oldHeight, minimum)) * weight;
        const candidate = source.clone().addScaledVector(normal, target - oldHeight);
        const packed = new Vector3(Math.fround(candidate.x), Math.fround(candidate.y), Math.fround(candidate.z));
        if (local.some(plane => packed.clone().sub(plane.point).dot(plane.normal) < lip.minimumHeight)) fail('packed lip below actual local floor bound');
        const oldLowering = source.clone().sub(get(output, id)).dot(normal), nextLowering = source.clone().sub(packed).dot(normal);
        if (nextLowering > oldLowering) packed.toArray(output, id * 3);
      }
    }
  }
  // Updating positions only leaves the caller to compute correct finite normals
  // once from the final merged surface, including its unchanged floor vertices.
  for (let i = 0; i < position.count; i++) position.setXYZ(i, output[i * 3]!, output[i * 3 + 1]!, output[i * 3 + 2]!);
  position.needsUpdate = true;
}
