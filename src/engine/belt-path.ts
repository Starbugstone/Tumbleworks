export type BeltShape = 'oval' | 'eight' | 'wide-eight';
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
      const x = halfWidth * Math.sin(angle * (vertical ? 2 : 1));
      const z = centerZ + halfDepth * Math.sin(angle * (vertical ? 1 : 2));
      const nearBridge = Math.min(angle, TAU - angle);
      const slope = Math.max(0, 1 - nearBridge / (Math.PI * 0.36));
      const y = bridgeHeight * slope * slope * (3 - 2 * slope);
      const previous = this.samples.at(-1);
      const distance = previous ? previous.distance + Math.hypot(x - previous.x, y - previous.y, z - previous.z) : 0;
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
    const span = Math.hypot(b.x - a.x, b.z - a.z);
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
      const error = (x - px) ** 2 + (z - pz) ** 2 + py ** 2;
      if (error >= best) continue;
      best = error;
      distance = a.distance + (b.distance - a.distance) * ratio;
      lateral = ((x - px) * dz - (z - pz) * dx) / Math.hypot(dx, dz);
    }
    return { distance, lateral };
  }
}
