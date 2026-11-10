import { sin, cos, hypot } from '../engine/exact-math';

export const RUBE_DURATION = 25;
export const RUBE_RADIUS = 0.3;
export const RUBE_REDUCED_CUTS = [0, 2, 5.4, 9.7, 14.3, 19.2, 23] as const;
export const RUBE_BEATS = [
  { stop: 9, start: 2, end: 2.7, contact: 2.3 }, { stop: 8, start: 3.8, end: 5, contact: 3.8 },
  { stop: 7, start: 5.8, end: 7, contact: 5.8 }, { stop: 6, start: 8.1, end: 9.3, contact: 8.1 },
  { stop: 5, start: 10.1, end: 11.6, contact: 10.1 }, { stop: 4, start: 12.7, end: 13.9, contact: 12.7 },
  { stop: 3, start: 14.7, end: 16.3, contact: 14.7 }, { stop: 2, start: 17.4, end: 18.8, contact: 17.4 },
  { stop: 1, start: 19.6, end: 21.2, contact: 19.6 }, { stop: 0, start: 22.3, end: 23.8, contact: 22.3 },
] as const;
export type RubeKind = 'channel' | 'spiral' | 'loop' | 'carried' | 'flight' | 'pocket' | 'zigzag' | 'funnel';
export interface RubePoint { x: number; y: number; z: number }
export interface RubeSample extends RubePoint {
  nx: number; ny: number; nz: number; tx: number; ty: number; tz: number;
  distance: number; stop: number; kind: RubeKind; pieceIndex: number;
}
export function createRubeSample(): RubeSample {
  return { x: 0, y: 0, z: 0, nx: 0, ny: 1, nz: 0, tx: 1, ty: 0, tz: 0, distance: 0, stop: 9, kind: 'carried', pieceIndex: 0 };
}
export function progress(time: number, start: number, end: number): number { return Math.max(0, Math.min(1, (time - start) / (end - start))); }
export function ease(time: number, start: number, end: number): number { const t = progress(time, start, end); return t * t * (3 - 2 * t); }
export interface RubePose { latch: number; cradle: number; top: number; gear: number; gate: number; pedal: number; weight: number; catapult: number; bucket: number; bucketWeight: number; hammer: number; bell: number }
export function createRubePose(): RubePose { return { latch: 0, cradle: 0, top: 0, gear: 0, gate: 0, pedal: 0, weight: 0, catapult: 0.35, bucket: 0, bucketWeight: 0, hammer: 0, bell: 0 }; }
/** Contact times are authoritative; seeking never integrates or carries state from a preceding frame. */
export function rubePose(seconds: number, out: RubePose, reduced = false): RubePose {
  out.latch = ease(seconds, 2, 2.15); out.cradle = ease(seconds, 2.15, 2.3) * 0.44;
  const turn = progress(seconds, 8.1, 10.1);
  out.top = turn * turn * (3 - 2 * turn) * Math.PI * 8;
  out.gear = -out.top * 0.5; out.gate = ease(seconds, 8.85, 9.1);
  out.pedal = ease(seconds, 10.1, 10.25); out.weight = ease(seconds, 10.3, 10.55);
  out.catapult = 0.35 - ease(seconds, 10.55, 10.6);
  out.bucket = ease(seconds, 14.7, 16) * Math.PI; out.bucketWeight = ease(seconds, 14.7, 16);
  out.hammer = -0.65 * ease(seconds, 22.3, 22.5);
  const bell = progress(seconds, 22.5, 23.8);
  out.bell = reduced ? sin(bell * Math.PI) * 0.22 : sin(bell * Math.PI * 5) * (1 - bell) ** 2 * 0.35;
  return out;
}
export interface RubePiece { start: number; end: number; stop: number; kind: RubeKind; track: boolean; powered: boolean; points: RubeSample[]; loopDiameter?: number }
type Raw = RubePoint & { nx?: number; ny?: number; nz?: number };
const TAU = Math.PI * 2;

export class RubeRoute {
  readonly pieces: RubePiece[] = [];
  readonly anchors: readonly RubePoint[];
  constructor(anchors: readonly RubePoint[]) {
    if (anchors.length !== 10) throw new Error('The Rube machine needs ten authored stops');
    this.anchors = anchors.map(point => ({ ...point }));
    const at = (stop: number, x: number, y: number, z: number): Raw => ({ x: anchors[stop]!.x + x, y: anchors[stop]!.y + y, z: anchors[stop]!.z + z });
    const add = (stop: number, start: number, end: number, kind: RubeKind, track: boolean, fn: (u: number) => Raw, steps = 24, powered = false): RubePiece => {
      const points = Array.from({ length: steps + 1 }, (_, i) => {
        const p = fn(i / steps); return { ...createRubeSample(), ...p, nx: p.nx ?? 0, ny: p.ny ?? 1, nz: p.nz ?? 0, stop, kind };
      });
      const piece = { stop, start, end, kind, track, powered, points }; this.pieces.push(piece); return piece;
    };
    add(9, 0, 2.3, 'carried', false, u => { const angle = 0.44 * ease(u * 2.3, 2.15, 2.3); return at(9, -0.3 * sin(angle), 2.5 + 0.3 * cos(angle), 0); }, 92);
    const releaseX = -0.3 * sin(0.44); const releaseY = 2.5 + 0.3 * cos(0.44);
    add(9, 2.3, 2.7, 'channel', true, u => at(9, releaseX + (-1.4 - releaseX) * u, (2 * u ** 3 - 3 * u * u + 1) * releaseY + (u ** 3 - 2 * u * u + u) * (-1.4 - releaseX) * sin(0.44) / cos(0.44) + (-2 * u ** 3 + 3 * u * u) * 2.45, 0), 24);
    add(8, 3.8, 5, 'spiral', true, u => at(8, 0.7 * cos(u * TAU * 1.25), 2.6 - ease(u, 0.2, 0.6) * 0.8, 0.7 * sin(u * TAU * 1.25)), 64);
    const loop = (stop: number, start: number, end: number, diameter: number, entry: number): void => {
      add(stop, start, start + 0.2, 'channel', true, u => at(stop, -1.5 + 1.5 * u * u, entry + (0.6 - entry) * u * u * (3 - 2 * u), -2.7 + 1.8 * (2 * u - u * u)), 40);
      const piece = add(stop, start + 0.2, end, 'loop', true, u => {
        const angle = TAU * (u + 0.1 * sin(TAU * u));
        return { ...at(stop, diameter / 2 * sin(angle), 0.6 + diameter / 2 * (1 - cos(angle)), -0.9 + 1.8 * u * u * (3 - 2 * u)), nx: -sin(angle), ny: cos(angle), nz: 0 };
      }, 72); piece.loopDiameter = diameter;
    };
    loop(7, 5.8, 7, 1.6, 2.4);
    add(6, 8.1, 8.45, 'channel', true, u => at(6, -1.15 + 0.6 * ease(u, 0.35, 1), 0.6, 1.4 * u), 40);
    add(6, 8.45, 9, 'pocket', false, () => at(6, -0.55, 0.6, 1.4), 1);
    add(6, 9, 9.3, 'channel', true, u => at(6, -0.55, 0.6, 1.4 + 0.8 * u), 24);
    const catapult = (angle: number): Raw => ({ ...at(5, -0.9 * cos(angle) - 0.36 * sin(angle), 0.61 - 0.9 * sin(angle) + 0.36 * cos(angle), 0), nx: -sin(angle), ny: cos(angle), nz: 0 });
    add(5, 10.1, 10.6, 'carried', false, u => catapult(0.35 - ease(10.1 + u * 0.5, 10.55, 10.6)), 20, true);
    const launch = catapult(-0.65); const catchPoint = at(5, 0.85, 2.8, 0.45);
    const peak = anchors[5]!.y + 3.2; const arch = 2 * peak - launch.y - catchPoint.y + 2 * Math.sqrt((peak - launch.y) * (peak - catchPoint.y));
    add(5, 10.6, 11.3, 'flight', false, u => ({ x: launch.x + (catchPoint.x - launch.x) * u, y: launch.y + (catchPoint.y - launch.y) * u + arch * u * (1 - u), z: launch.z + (catchPoint.z - launch.z) * u }), 32, true);
    add(5, 11.3, 11.6, 'carried', false, () => catchPoint, 1);
    add(5, 11.6, 11.85, 'channel', true, u => {
      const angle = u * Math.PI / 2;
      return at(5, 0.05 + 0.8 * cos(angle), 2.8, 0.45 + 0.8 * sin(angle));
    }, 24);
    loop(4, 12.7, 13.9, 1.8, 2.7);
    add(3, 14.4, 14.7, 'channel', true, u => at(3, -1.6 + 1.6 * u, 0.6, 0.55), 24);
    add(3, 14.7, 16, 'carried', false, u => { const angle = ease(u, 0, 1) * Math.PI; return at(3, 1.05 * sin(angle), 1.65 - 1.05 * cos(angle), 0.55); }, 64, true);
    add(3, 16, 16.3, 'channel', true, u => at(3, -0.8 * u, 2.7, 0.55), 16);
    add(3, 16.3, 16.65, 'channel', true, u => {
      const angle = Math.PI / 2 + Math.PI * u;
      return at(3, -0.8 + 0.7 * cos(angle), 2.7 - 0.05 * ease(u, 0, 1), -0.15 + 0.7 * sin(angle));
    }, 32);
    add(3, 16.65, 17.4, 'channel', true, u => at(3, -0.8 + 7.3 * u, 2.65 - 0.25 * ease(u, 0, 1), -0.85 - 1.25 * ease(u, 0, 1)), 32);
    add(2, 17.4, 18.8, 'zigzag', true, u => {
      const straight = 1.5, radius = 0.6, arc = Math.PI * radius;
      let distance = u * (4 * straight + 3 * arc);
      for (let row = 0; row < 4; row++) {
        const right = row % 2 === 0; const z = -2.6 + row * 1.2;
        if (distance <= straight || row === 3) return at(2, -0.75 + (right ? -0.75 + distance : 0.75 - distance), 2.6 - 1.97 * u * u * (3 - 2 * u), z);
        distance -= straight;
        if (distance <= arc) {
          const angle = -Math.PI / 2 + (right ? 1 : -1) * distance / radius;
          return at(2, -0.75 + (right ? 0.75 : -0.75) + radius * cos(angle), 2.6 - 1.97 * u * u * (3 - 2 * u), z + radius + radius * sin(angle));
        }
        distance -= arc;
      }
      throw new Error('Unreachable switchback section');
    }, 160);
    add(2, 18.8, 19, 'channel', true, u => {
      const angle = -Math.PI / 2 - Math.PI * u;
      return at(2, -1.5 + 0.6 * cos(angle), 0.63 - 0.01 * ease(u, 0, 1), 1.6 + 0.6 * sin(angle));
    }, 28);
    add(2, 19, 19.15, 'channel', true, u => at(2, -1.5 + 1.2 * u, 0.62, 2.2), 8);
    add(2, 19.15, 19.45, 'channel', true, u => {
      const angle = -Math.PI / 2 + Math.PI * u;
      return at(2, -0.3 + 0.8 * cos(angle), 0.62, 3 + 0.8 * sin(angle));
    }, 28);
    const funnelSlope = 0.3 / 0.82;
    const funnelNy = 1 / Math.sqrt(1 + funnelSlope * funnelSlope);
    const funnelOffset = RUBE_RADIUS * funnelSlope * funnelNy;
    add(1, 19.45, 19.6, 'flight', false, u => at(1, 1.7 + (1.22 - funnelOffset - 1.7) * u, 1.42 - 0.22 * u * u, -0.2 * (1 - u)), 16);
    add(1, 19.6, 20.96, 'funnel', true, u => {
      const angle = TAU * 3 * (0.7 * u + 0.3 * u * u);
      const radius = 1.22 - 0.82 * u - funnelOffset;
      return { ...at(1, radius * cos(angle), 1.2 - 0.3 * u, radius * sin(angle)), nx: -funnelSlope * funnelNy * cos(angle), ny: funnelNy, nz: -funnelSlope * funnelNy * sin(angle) };
    }, 144);
    add(1, 20.96, 21.04, 'flight', false, u => at(1, (0.4 - funnelOffset) * (1 - u) ** 2, 0.9 - 0.3 * u * u, 0), 16);
    add(1, 21.04, 21.2, 'channel', true, u => {
      const angle = u * Math.PI / 2;
      return { ...at(1, -0.3 * (1 - cos(angle)), 0.6 - 0.3 * sin(angle), 0), nx: -cos(angle), ny: sin(angle), nz: 0 };
    }, 24);
    add(0, 22.3, 22.7, 'flight', false, u => at(0, -0.35 + u * 0.85, 0.5 - 0.15 * u + 1.4 * u * (1 - u), 0.35 + u), 20);
    add(0, 22.7, RUBE_DURATION, 'pocket', false, () => at(0, 0.5, 0.35, 1.35), 1);
    this.pieces.sort((a, b) => a.start - b.start);
    const mechanisms = [...this.pieces];
    for (let index = 1; index < mechanisms.length; index++) {
      const previous = mechanisms[index - 1]!; const next = mechanisms[index]!;
      if (next.start <= previous.end) continue;
      const a = previous.points.at(-1)!; const b = next.points[0]!;
      const chord = hypot(b.x - a.x, b.y - a.y, b.z - a.z);
      const direction = (from: RubeSample, to: RubeSample): RubePoint => {
        const length = hypot(to.x - from.x, to.y - from.y, to.z - from.z);
        return length > 1e-7 ? { x: (to.x - from.x) / length, y: (to.y - from.y) / length, z: (to.z - from.z) / length }
          : { x: (b.x - a.x) / chord, y: (b.y - a.y) / chord, z: (b.z - a.z) / chord };
      };
      const incoming = direction(previous.points.at(-2)!, a); const outgoing = direction(b, next.points[1]!);
      if (next.stop === 0 || next.stop === 3) { outgoing.x = next.stop === 0 ? -1 : 1; outgoing.y = 0; outgoing.z = 0; }
      if (next.stop === 5) { outgoing.x = -cos(0.35); outgoing.y = -sin(0.35); outgoing.z = 0; }
      const handle = (d: RubePoint): number => Math.min(chord * 0.3, 1.4, Math.abs(d.y) > 1e-5 ? Math.abs(b.y - a.y) * 0.3 / Math.abs(d.y) : Infinity);
      const ha = handle(incoming), hb = next.stop === 4 || next.stop === 7 ? Math.min(chord * 0.3, 2.8) : next.stop === 5 ? 2.2 : handle(outgoing);
      const c = { x: a.x + incoming.x * ha, y: a.y + Math.min(0, incoming.y) * ha, z: a.z + incoming.z * ha };
      const d = { x: b.x - outgoing.x * hb, y: b.y - Math.min(0, outgoing.y) * hb, z: b.z - outgoing.z * hb };
      add(previous.stop, previous.end, next.start, 'channel', true, u => {
        const v = 1 - u;
        return { x: v ** 3 * a.x + 3 * v * v * u * c.x + 3 * v * u * u * d.x + u ** 3 * b.x - (next.stop === 5 ? 6.4 * u * u * v * v : 0),
          y: v ** 3 * a.y + 3 * v * v * u * c.y + 3 * v * u * u * d.y + u ** 3 * b.y,
          z: v ** 3 * a.z + 3 * v * v * u * c.z + 3 * v * u * u * d.z + u ** 3 * b.z,
          nx: a.nx + (b.nx - a.nx) * u * u * (3 - 2 * u), ny: a.ny + (b.ny - a.ny) * u * u * (3 - 2 * u), nz: a.nz + (b.nz - a.nz) * u * u * (3 - 2 * u) };
      }, 40);
    }
    this.pieces.sort((a, b) => a.start - b.start);
    let distance = 0; let last: RubeSample | undefined;
    this.pieces.forEach((piece, pieceIndex) => piece.points.forEach((point, index) => {
      const before = piece.points[Math.max(0, index - 1)]!; const after = piece.points[Math.min(piece.points.length - 1, index + 1)]!;
      let tx = after.x - before.x; let ty = after.y - before.y; let tz = after.z - before.z;
      const length = hypot(tx, ty, tz); if (length < 1e-9) { tx = 1; ty = 0; tz = 0; } else { tx /= length; ty /= length; tz /= length; }
      const dot = point.nx * tx + point.ny * ty + point.nz * tz;
      point.nx -= dot * tx; point.ny -= dot * ty; point.nz -= dot * tz;
      let normalLength = hypot(point.nx, point.ny, point.nz);
      if (normalLength < 1e-6) { point.nx = 0; point.ny = 0; point.nz = 1; normalLength = 1; }
      point.nx /= normalLength; point.ny /= normalLength; point.nz /= normalLength;
      point.tx = tx; point.ty = ty; point.tz = tz;
      if (last) distance += hypot(point.x - last.x, point.y - last.y, point.z - last.z);
      point.distance = distance; point.pieceIndex = pieceIndex; last = point;
    }));
    // Adjacent sweeps share one frame, so their physical floors join without a seam.
    for (let i = 1; i < this.pieces.length; i++) {
      const a = this.pieces[i - 1]!.points.at(-1)!; const b = this.pieces[i]!.points[0]!;
      if (hypot(a.x - b.x, a.y - b.y, a.z - b.z) > 1e-7) throw new Error('Disconnected Rube route');
      if (!this.pieces[i - 1]!.track || !this.pieces[i]!.track || a.tx * b.tx + a.ty * b.ty + a.tz * b.tz < 0.95 || a.nx * b.nx + a.ny * b.ny + a.nz * b.nz < 0.95) continue;
      let tx = a.tx + b.tx; let ty = a.ty + b.ty; let tz = a.tz + b.tz;
      let length = hypot(tx, ty, tz); if (length < 1e-6) { tx = a.tx; ty = a.ty; tz = a.tz; length = 1; }
      tx /= length; ty /= length; tz /= length;
      let nx = a.nx + b.nx; let ny = a.ny + b.ny; let nz = a.nz + b.nz;
      const dot = nx * tx + ny * ty + nz * tz; nx -= dot * tx; ny -= dot * ty; nz -= dot * tz;
      length = hypot(nx, ny, nz); if (length < 1e-6) { nx = a.nx; ny = a.ny; nz = a.nz; length = 1; }
      for (const point of [a, b]) { point.tx = tx; point.ty = ty; point.tz = tz; point.nx = nx / length; point.ny = ny / length; point.nz = nz / length; }
    }
  }
  focus(stop: number, out: RubePoint): void {
    const anchor = this.anchors[stop]!; out.x = anchor.x - (stop === 2 ? 0.75 : 0); out.z = anchor.z;
    out.y = anchor.y + (stop === 9 ? 2 : stop === 5 ? 1.65 : stop === 3 ? 1.4 : 1.1);
  }
  sample(seconds: number, out: RubeSample): RubeSample {
    const time = Math.max(0, Math.min(RUBE_DURATION, seconds));
    let index = 0; while (index + 1 < this.pieces.length && time >= this.pieces[index + 1]!.start) index++;
    const piece = this.pieces[index]!; const offset = progress(time, piece.start, piece.end) * (piece.points.length - 1);
    const low = Math.min(piece.points.length - 2, Math.floor(offset)); const fraction = offset - low;
    const a = piece.points[low]!; const b = piece.points[low + 1]!;
    out.x = a.x + (b.x - a.x) * fraction; out.y = a.y + (b.y - a.y) * fraction; out.z = a.z + (b.z - a.z) * fraction;
    out.nx = a.nx + (b.nx - a.nx) * fraction; out.ny = a.ny + (b.ny - a.ny) * fraction; out.nz = a.nz + (b.nz - a.nz) * fraction;
    const norm = hypot(out.nx, out.ny, out.nz); out.nx /= norm; out.ny /= norm; out.nz /= norm;
    out.tx = a.tx + (b.tx - a.tx) * fraction; out.ty = a.ty + (b.ty - a.ty) * fraction; out.tz = a.tz + (b.tz - a.tz) * fraction;
    out.distance = a.distance + (b.distance - a.distance) * fraction; out.stop = piece.stop; out.kind = piece.kind; out.pieceIndex = index;
    // A carried marble is a point on the carrier, not an approximation of its sampled arc.
    const anchor = this.anchors[piece.stop]!;
    if (piece.kind === 'carried' && piece.stop === 9) {
      const angle = 0.44 * ease(time, 2.15, 2.3);
      out.x = anchor.x - 0.3 * sin(angle); out.y = anchor.y + 2.5 + 0.3 * cos(angle); out.z = anchor.z;
      out.nx = -sin(angle); out.ny = cos(angle); out.nz = 0;
    } else if (piece.kind === 'carried' && piece.stop === 5 && time < 10.6) {
      const angle = 0.35 - ease(time, 10.55, 10.6);
      out.x = anchor.x - 0.9 * cos(angle) - 0.36 * sin(angle);
      out.y = anchor.y + 0.61 - 0.9 * sin(angle) + 0.36 * cos(angle); out.z = anchor.z;
      out.nx = -sin(angle); out.ny = cos(angle); out.nz = 0;
    } else if (piece.kind === 'carried' && piece.stop === 3) {
      const angle = ease(time, 14.7, 16) * Math.PI;
      out.x = anchor.x + 1.05 * sin(angle); out.y = anchor.y + 1.65 - 1.05 * cos(angle); out.z = anchor.z + 0.55;
      out.nx = 0; out.ny = 1; out.nz = 0;
    }
    return out;
  }
}
