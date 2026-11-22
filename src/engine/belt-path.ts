import { atan2, cos, hypot, sin } from './exact-math';
export type BeltShape = 'oval' | 'eight' | 'wide-eight' | 'delta' | 'kidney';
export interface BeltPoint { readonly x: number; readonly y: number; readonly z: number; readonly tx: number; readonly tz: number }
export interface BeltPath {
  readonly length: number;
  point(distance: number, offset?: number): BeltPoint;
  nearest(x: number, z: number): { distance: number; lateral: number };
}
interface Sample { x: number; y: number; z: number; distance: number }
const TAU = Math.PI * 2;

/** Arc-length sampled continuous eight. Its two crossing passes are separated by a real raised bridge. */
export class FigureEightTrack implements BeltPath {
  readonly length: number;
  readonly corner = 0;
  private readonly samples: Sample[] = [];
  constructor(readonly halfWidth: number, readonly halfDepth: number, readonly centerZ = 0,
    readonly vertical = true, readonly bridgeHeight = 2.1) {
    for (let i = 0; i <= 1024; i++) {
      const angle = i / 1024 * TAU;
      const x = halfWidth * sin(angle * (vertical ? 2 : 1));
      const z = centerZ + halfDepth * sin(angle * (vertical ? 1 : 2));
      const nearBridge = Math.min(angle, TAU - angle);
      const slope = Math.max(0, 1 - nearBridge / (Math.PI * 0.36));
      const y = bridgeHeight * slope * slope * (3 - 2 * slope);
      const previous = this.samples.at(-1);
      const distance = previous ? previous.distance + hypot(x - previous.x, y - previous.y, z - previous.z) : 0;
      this.samples.push({ x, y, z, distance });
    }
    this.length = this.samples.at(-1)!.distance;
  }
  point(distance: number, offset = 0): BeltPoint {
    const d = ((distance % this.length) + this.length) % this.length;
    let low = 0, high = this.samples.length - 1;
    while (low + 1 < high) {
      const mid = (low + high) >>> 1;
      if (this.samples[mid]!.distance <= d) low = mid; else high = mid;
    }
    const a = this.samples[low]!, b = this.samples[high]!;
    const ratio = (d - a.distance) / (b.distance - a.distance);
    const span = hypot(b.x - a.x, b.z - a.z);
    const tx = (b.x - a.x) / span, tz = (b.z - a.z) / span;
    return { x: a.x + (b.x - a.x) * ratio + tz * offset, y: a.y + (b.y - a.y) * ratio,
      z: a.z + (b.z - a.z) * ratio - tx * offset, tx, tz };
  }
  /** Ground-level entry/dock queries prefer the lower pass at the crossing. Transport uses distance, never nearest. */
  nearest(x: number, z: number): { distance: number; lateral: number } {
    let best = Infinity, distance = 0, lateral = 0;
    for (let i = 0; i < this.samples.length - 1; i++) {
      const a = this.samples[i]!, b = this.samples[i + 1]!;
      const dx = b.x - a.x, dz = b.z - a.z;
      const ratio = Math.max(0, Math.min(1, ((x - a.x) * dx + (z - a.z) * dz) / (dx * dx + dz * dz)));
      const px = a.x + dx * ratio, pz = a.z + dz * ratio, py = a.y + (b.y - a.y) * ratio;
      const error = (x - px) * (x - px) + (z - pz) * (z - pz) + py * py;
      if (error >= best) continue;
      best = error;
      distance = a.distance + (b.distance - a.distance) * ratio;
      lateral = ((x - px) * dz - (z - pz) * dx) / hypot(dx, dz);
    }
    return { distance, lateral };
  }
}

interface CircuitSpan {
  start: number;
  length: number;
  /** Centre of the straight segment or of the fillet circle. */
  x: number;
  z: number;
  /** Unit tangent halfway along the span. */
  tx: number;
  tz: number;
  /** Zero for a straight, positive for a left turn in the x,z plane. */
  signedRadius: number;
}

function spanPoint(span: CircuitSpan, fromMiddle: number, offset: number): BeltPoint {
  const { x, z, tx, tz, signedRadius } = span;
  if (signedRadius === 0) {
    return { x: x + tx * fromMiddle + tz * offset, y: 0, z: z + tz * fromMiddle - tx * offset, tx, tz };
  }
  const angle = fromMiddle / signedRadius;
  const c = cos(angle), s = sin(angle);
  const tangentX = tx * c - tz * s, tangentZ = tz * c + tx * s;
  return { x: x + tangentZ * (signedRadius + offset), y: 0, z: z - tangentX * (signedRadius + offset),
    tx: tangentX, tz: tangentZ };
}

/** A flat polygon with circular fillets. Distance zero leaves the first corner along its outgoing edge. */
export class RoundedCircuit implements BeltPath {
  readonly length: number;
  private readonly spans: CircuitSpan[] = [];

  constructor(vertices: readonly (readonly [number, number])[], radius: number) {
    if (vertices.length < 3 || !Number.isFinite(radius) || radius <= 0) {
      throw new RangeError('A rounded circuit needs at least three vertices and a positive finite radius');
    }
    const count = vertices.length;
    const edges = vertices.map(([x, z], i) => {
      const [nextX, nextZ] = vertices[(i + 1) % count]!;
      const dx = nextX - x, dz = nextZ - z;
      const length = hypot(dx, dz);
      if (!Number.isFinite(length) || length === 0) throw new RangeError('Circuit edges need distinct finite endpoints');
      return { length, tx: dx / length, tz: dz / length };
    });
    const corners = edges.map((outgoing, i) => {
      const incoming = edges[(i + count - 1) % count]!;
      const cross = incoming.tx * outgoing.tz - incoming.tz * outgoing.tx;
      const dot = incoming.tx * outgoing.tx + incoming.tz * outgoing.tz;
      if (cross === 0 && dot < 0) throw new RangeError('A circuit cannot reverse direction at a vertex');
      // The setback on each adjoining edge is r * tan(|turn| / 2).
      const setbackPerRadius = dot < 0 ? (1 - dot) / Math.abs(cross) : Math.abs(cross) / (1 + dot);
      return { angle: atan2(cross, dot), setbackPerRadius };
    });
    // Keep one radius throughout. The tightest pair of corners can consume their shared straight.
    let fittedRadius = radius;
    for (let i = 0; i < count; i++) {
      const setbacks = corners[i]!.setbackPerRadius + corners[(i + 1) % count]!.setbackPerRadius;
      if (setbacks > 0) fittedRadius = Math.min(fittedRadius, edges[i]!.length / setbacks);
    }

    let start = 0;
    for (let i = 0; i < count; i++) {
      const j = (i + 1) % count;
      const { length, tx, tz } = edges[i]!;
      const [x, z] = vertices[i]!, [nextX, nextZ] = vertices[j]!;
      const setback = fittedRadius * corners[i]!.setbackPerRadius;
      const nextSetback = fittedRadius * corners[j]!.setbackPerRadius;
      const straight = length - setback - nextSetback;
      if (straight > 0) {
        const mid = setback + straight / 2;
        this.spans.push({ start, length: straight, x: x + tx * mid, z: z + tz * mid, tx, tz, signedRadius: 0 });
        start += straight;
      }
      const angle = corners[j]!.angle;
      if (angle === 0) continue;
      const signedRadius = Math.sign(angle) * fittedRadius;
      const c = cos(angle / 2), s = sin(angle / 2);
      const arc = signedRadius * angle;
      this.spans.push({ start, length: arc, signedRadius,
        x: nextX - tx * nextSetback - tz * signedRadius, z: nextZ - tz * nextSetback + tx * signedRadius,
        tx: tx * c - tz * s, tz: tz * c + tx * s });
      start += arc;
    }
    this.length = start;
  }

  point(distance: number, offset = 0): BeltPoint {
    const remainder = distance % this.length;
    const d = remainder < 0 ? remainder + this.length : remainder;
    let low = 0, high = this.spans.length;
    while (low + 1 < high) {
      const mid = (low + high) >>> 1;
      if (this.spans[mid]!.start <= d) low = mid; else high = mid;
    }
    const span = this.spans[low]!;
    return spanPoint(span, d - span.start - span.length / 2, offset);
  }

  nearest(x: number, z: number): { distance: number; lateral: number } {
    let best = Infinity, distance = 0, lateral = 0;
    for (const span of this.spans) {
      const dx = x - span.x, dz = z - span.z;
      const along = dx * span.tx + dz * span.tz;
      const across = dx * span.tz - dz * span.tx;
      // Measuring angle from the middle puts both fillet endpoints inside atan2's continuous range.
      const r = span.signedRadius;
      const projected = r === 0 ? along : Math.abs(r) * atan2(along, Math.sign(r) * across);
      const half = span.length / 2;
      const fromMiddle = Math.max(-half, Math.min(half, projected));
      const p = spanPoint(span, fromMiddle, 0);
      const ex = x - p.x, ez = z - p.z;
      const error = ex * ex + ez * ez;
      if (error >= best) continue;
      best = error;
      distance = span.start + (half + fromMiddle);
      lateral = ex * p.tz - ez * p.tx;
    }
    return { distance: distance % this.length, lateral };
  }
}
