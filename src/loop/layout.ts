/**
 * Loop Sort geometry, in world units: x right, y up, z toward the viewer. A portrait platform with
 * the loop channel around its rim and truck lanes down the middle; trucks pour and load at the front.
 */
export const TICK_SECONDS = 1 / 60;
export const MARBLE_RADIUS = 0.17;
/** Every rules unit is drawn as rows of three across the channel; wide units get more rows. */
export const ROW_WIDTH = 3;
export const ROW_PITCH = 0.37;

export interface TrackPoint { readonly x: number; readonly z: number; readonly tx: number; readonly tz: number }

/** A rounded rectangle centre line. d = 0 starts the back straight; travel runs clockwise seen from above. */
export class RoundedTrack {
  readonly straightX: number;
  readonly straightZ: number;
  readonly quarter: number;
  readonly length: number;
  constructor(readonly halfWidth: number, readonly halfDepth: number, readonly corner: number) {
    this.straightX = 2 * (halfWidth - corner);
    this.straightZ = 2 * (halfDepth - corner);
    this.quarter = (Math.PI / 2) * corner;
    this.length = 2 * this.straightX + 2 * this.straightZ + 4 * this.quarter;
  }

  point(distance: number, offset = 0): TrackPoint {
    const { halfWidth: hw, halfDepth: hd, corner: rc, straightX: sx, straightZ: sz, quarter: q, length } = this;
    let d = ((distance % length) + length) % length;
    const r = rc + offset;
    if (d < sx) return { x: -(hw - rc) + d, z: -hd - offset, tx: 1, tz: 0 };
    d -= sx;
    if (d < q) { const a = d / rc; return { x: hw - rc + r * Math.sin(a), z: -hd + rc - r * Math.cos(a), tx: Math.cos(a), tz: Math.sin(a) }; }
    d -= q;
    if (d < sz) return { x: hw + offset, z: -(hd - rc) + d, tx: 0, tz: 1 };
    d -= sz;
    if (d < q) { const a = d / rc; return { x: hw - rc + r * Math.cos(a), z: hd - rc + r * Math.sin(a), tx: -Math.sin(a), tz: Math.cos(a) }; }
    d -= q;
    if (d < sx) return { x: hw - rc - d, z: hd + offset, tx: -1, tz: 0 };
    d -= sx;
    if (d < q) { const a = d / rc; return { x: -(hw - rc) - r * Math.sin(a), z: hd - rc + r * Math.cos(a), tx: -Math.cos(a), tz: -Math.sin(a) }; }
    d -= q;
    if (d < sz) return { x: -hw - offset, z: hd - rc - d, tx: 0, tz: -1 };
    d -= sz;
    const a = d / rc;
    return { x: -(hw - rc) - r * Math.cos(a), z: -hd + rc - r * Math.sin(a), tx: Math.sin(a), tz: -Math.cos(a) };
  }

  /** How far along the loop the nearest centre-line point is, and how far outward (x, z) sits from it. */
  nearest(x: number, z: number): { readonly distance: number; readonly lateral: number } {
    const { halfWidth: hw, halfDepth: hd, corner: rc, straightX: sx, straightZ: sz, quarter: q } = this;
    const cx = Math.max(-(hw - rc), Math.min(hw - rc, x));
    const cz = Math.max(-(hd - rc), Math.min(hd - rc, z));
    if (Math.abs(x) <= hw - rc) {
      return z < 0
        ? { distance: x + (hw - rc), lateral: -z - hd }
        : { distance: sx + q + sz + q + (hw - rc - x), lateral: z - hd };
    }
    if (Math.abs(z) <= hd - rc) {
      return x > 0
        ? { distance: sx + q + (z + hd - rc), lateral: x - hw }
        : { distance: 2 * sx + 3 * q + sz + (hd - rc - z), lateral: -x - hw };
    }
    const lateral = Math.hypot(x - cx, z - cz) - rc;
    if (x > 0 && z < 0) return { distance: sx + Math.atan2(x - cx, -(z - cz)) * rc, lateral };
    if (x > 0 && z > 0) return { distance: sx + q + sz + Math.atan2(z - cz, x - cx) * rc, lateral };
    if (x < 0 && z > 0) return { distance: 2 * sx + 2 * q + sz + Math.atan2(-(x - cx), z - cz) * rc, lateral };
    return { distance: 2 * sx + 3 * q + 2 * sz + Math.atan2(-(z - cz), -(x - cx)) * rc, lateral };
  }
}

export const LOOP = {
  floorY: 0.9,
  wallHeight: 0.42,
  wallThickness: 0.14,
  /** Half the channel width: three rows of tiny marbles with a little room. */
  channelHalf: 0.64,
  rowOffset: 0.4,
  speed: 6.2,
} as const;
export const RIDE_Y = LOOP.floorY + MARBLE_RADIUS;
export const DECK_TOP = LOOP.floorY + LOOP.wallHeight;

/** Up to three lanes face the front straight; more lanes add a second row facing the back. */
export const LANE_SPACING = 1.25;
export interface Bay { readonly row: 'front' | 'back'; readonly x: number }
export function bays(lanes: number): Bay[] {
  const back = lanes <= 3 ? 0 : Math.ceil(lanes / 2);
  const front = lanes - back;
  const x = (index: number, count: number): number => (index - (count - 1) / 2) * LANE_SPACING;
  return Array.from({ length: lanes }, (_, lane) => lane < back ? { row: 'back', x: x(lane, back) } : { row: 'front', x: x(lane - back, front) });
}
export const TRUCK = {
  bedWidth: 0.92,
  bedLength: 3.6,
  bedHeight: 0.28,
  cabLength: 0.82,
  /** The bed's loop end, measured inward from the loop's centre line. */
  mouthInset: LOOP.channelHalf + 0.4,
  arriveSeconds: 0.38,
  leaveSeconds: 0.85,
  exitLength: 2.6,
} as const;
export const trackFor = (lanes: number): RoundedTrack => {
  const columns = Math.max(...[bays(lanes).filter((bay) => bay.row === 'front').length, bays(lanes).filter((bay) => bay.row === 'back').length]);
  const rows = lanes <= 3 ? 1 : 2;
  const halfWidth = Math.max(2.75, (columns * LANE_SPACING) / 2 + LOOP.channelHalf + 0.85);
  const halfDepth = rows === 1 ? 3.6 : TRUCK.mouthInset + TRUCK.bedLength + TRUCK.cabLength + 0.35;
  return new RoundedTrack(halfWidth, halfDepth, 1.15);
};
/** One rules unit of cargo is this long on the bed. */
export const unitLength = (capacity: number): number => TRUCK.bedLength / capacity;

export const STREAM = {
  /** Ticks between units leaving a pouring truck. */
  intervalTicks: 4,
  hopSeconds: 0.16,
  absorbSeconds: 0.18,
} as const;
