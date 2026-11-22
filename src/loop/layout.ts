import { atan2, cos, hypot, sin } from '../engine/exact-math';
import { FigureEightTrack, RoundedCircuit, type BeltShape } from '../engine/belt-path';
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

  point(distance: number, offset = 0): TrackPoint & { y: number } { return { ...this.flatPoint(distance, offset), y: 0 }; }

  private flatPoint(distance: number, offset = 0): TrackPoint {
    const { halfWidth: hw, halfDepth: hd, corner: rc, straightX: sx, straightZ: sz, quarter: q, length } = this;
    let d = ((distance % length) + length) % length;
    const r = rc + offset;
    if (d < sx) return { x: -(hw - rc) + d, z: -hd - offset, tx: 1, tz: 0 };
    d -= sx;
    if (d < q) { const a = d / rc; return { x: hw - rc + r * sin(a), z: -hd + rc - r * cos(a), tx: cos(a), tz: sin(a) }; }
    d -= q;
    if (d < sz) return { x: hw + offset, z: -(hd - rc) + d, tx: 0, tz: 1 };
    d -= sz;
    if (d < q) { const a = d / rc; return { x: hw - rc + r * cos(a), z: hd - rc + r * sin(a), tx: -sin(a), tz: cos(a) }; }
    d -= q;
    if (d < sx) return { x: hw - rc - d, z: hd + offset, tx: -1, tz: 0 };
    d -= sx;
    if (d < q) { const a = d / rc; return { x: -(hw - rc) - r * sin(a), z: hd - rc + r * cos(a), tx: -cos(a), tz: -sin(a) }; }
    d -= q;
    if (d < sz) return { x: -hw - offset, z: hd - rc - d, tx: 0, tz: -1 };
    d -= sz;
    const a = d / rc;
    return { x: -(hw - rc) - r * cos(a), z: -hd + rc - r * sin(a), tx: sin(a), tz: -cos(a) };
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
    const lateral = hypot(x - cx, z - cz) - rc;
    if (x > 0 && z < 0) return { distance: sx + atan2(x - cx, -(z - cz)) * rc, lateral };
    if (x > 0 && z > 0) return { distance: sx + q + sz + atan2(z - cz, x - cx) * rc, lateral };
    if (x < 0 && z > 0) return { distance: 2 * sx + 2 * q + sz + atan2(-(x - cx), z - cz) * rc, lateral };
    return { distance: 2 * sx + 3 * q + 2 * sz + atan2(-(z - cz), -(x - cx)) * rc, lateral };
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
/**
 * The furthest from the centre line a marble is drawn. Its wobble is lopsided and reaches 0.52 on one side, which sank
 * that row into the wall; this keeps every marble just clear of both walls. It places the drawing only, never the rules.
 */
export const ROW_REACH = LOOP.channelHalf - MARBLE_RADIUS - 0.01;
export const DECK_TOP = LOOP.floorY + LOOP.wallHeight;

/**
 * Every lane's docked lorry stands in one row with its open end at the top, against the belt. On an oval the ring goes
 * round the row; an eight, a delta and a kidney lie above it. Waiting lorries are shown in the cards under the toy.
 */
export interface Bay { readonly x: number }
export const laneSpacing = (lanes: number): number => (lanes <= 3 ? 1.5 : 1.12);
export function bays(lanes: number): Bay[] {
  const spacing = laneSpacing(lanes);
  return Array.from({ length: lanes }, (_, lane) => ({ x: (lane - (lanes - 1) / 2) * spacing }));
}
export const TUB = { wall: 0.6, cargo: 0.42, inset: 0.11 } as const;

export const TRUCK = {
  bedWidth: 0.92,
  bedLength: 3.6,
  bedHeight: 0.28,
  cabLength: 0.82,
  /** The bed's loop end, measured outward from the loop's centre line. */
  mouthGap: LOOP.channelHalf + 0.4,
  arriveSeconds: 0.38,
  leaveSeconds: 0.85,
  /** A short dispatch pad beyond the rim: a leaving truck shrinks away over it. */
  exitLength: 1.7,
} as const;
/** A leaving lorry lifts clear of the belt while it shrinks away. */
export const LIFT_OFF = 1.6;
/** A share of a lorry's bed as a whole percentage. Plain rounding, so equal loads always print the same number. */
export const sharePercent = (units: number, capacity: number): number => Math.round((units / capacity) * 100);
/**
 * Lengths of a bed's stretches. Each is proportional to its units, but never shorter than `least`, so its number
 * always fits; what the short ones take comes out of the long ones. Stretches fading to nothing shrink smoothly.
 */
export function bedSpans(units: readonly number[], capacity: number, length: number, least: number): number[] {
  const wanted = units.map((value) => (value / capacity) * length);
  const floors = units.map((value) => least * Math.min(1, value));
  const surplus = wanted.reduce((sum, value, index) => sum + Math.max(0, value - floors[index]!), 0);
  const room = Math.max(0, length - floors.reduce((sum, value) => sum + value, 0));
  const fit = surplus > 0 ? room / surplus : 0;
  return wanted.map((value, index) => floors[index]! + Math.max(0, value - floors[index]!) * fit);
}
/**
 * The flat belts that lie above the lorry row, as corners to round for a row of three lanes, measured from the middle
 * of their mouth straight with z running back from it. The first edge is that straight: it travels in lane order and
 * every lorry opens on it. A delta is a skew triangle; a kidney has a low lobe behind the first lane, a tall one behind
 * the last and a waist between them, and its third number says which way a corner moves when the row is wider.
 */
const CROWN = {
  radius: 0.9,
  /** Where the mouth straight lies, as far toward the viewer as an eight's lobes reach. */
  mouthLine: 1.5,
  /** Belt kept straight beyond the outermost lorry, so its stream never meets a bend. */
  margin: 0.55,
  /** Half the mouth straight the three-lane corners leave after rounding. */
  straight: { delta: 2.2, kidney: 2.1 },
  delta: [[-5.3, 0], [4, 0], [1, -4]],
  kidney: [[-3.36, 0, -1], [3.03, 0, 1], [2.95, -3.5, 1], [1.3, -3.8, 1], [-0.2, -1.45, 1], [-2.5, -2.65, -1]],
} as const;
/** The corners for a row that needs `grow` more straight at each end. Bends keep their angles, so the straight gains exactly that. */
function crownCorners(shape: 'delta' | 'kidney', grow: number): (readonly [number, number])[] {
  if (shape === 'kidney') return CROWN.kidney.map(([x, z, side]) => [x + side * grow, CROWN.mouthLine + z] as const);
  // A triangle grows as a whole about the middle of its base. The three-lane figure is used exactly as written.
  const [left, right] = CROWN.delta, middle = (left[0] + right[0]) / 2, scale = 1 + 2 * grow / (right[0] - left[0]);
  return CROWN.delta.map(([x, z]) => grow === 0 ? [x, CROWN.mouthLine + z] as const : [middle + (x - middle) * scale, CROWN.mouthLine + z * scale] as const);
}
export interface TrackBounds { readonly minX: number; readonly maxX: number; readonly minZ: number; readonly maxZ: number }

/** A flat belt above the lorry row. Its far side is the island side, at a positive offset from the centre line. */
export class CrownTrack extends RoundedCircuit {
  readonly corner = CROWN.radius;
  readonly mouthLine: number = CROWN.mouthLine;
  /** Extents of the centre line. */
  readonly bounds: TrackBounds;
  constructor(shape: 'delta' | 'kidney', lanes: number) {
    const grow = Math.max(0, ((lanes - 1) * laneSpacing(lanes)) / 2 + CROWN.margin - CROWN.straight[shape]);
    super(crownCorners(shape, grow), CROWN.radius);
    let minX = Infinity, maxX = -Infinity, minZ = Infinity;
    for (let i = 0; i < 720; i++) {
      const p = this.point(i / 720 * this.length);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minZ = Math.min(minZ, p.z);
    }
    this.bounds = { minX, maxX, minZ, maxZ: CROWN.mouthLine };
  }
  /** Where the far run crosses a lane: the last belt a leaving lorry passes over. */
  farZ(x: number): number {
    let far = this.mouthLine, previous = this.point(0);
    for (let i = 1; i <= 720; i++) {
      const next = this.point(i / 720 * this.length);
      if ((previous.x - x) * (next.x - x) <= 0 && previous.x !== next.x) {
        far = Math.min(far, previous.z + (next.z - previous.z) * (x - previous.x) / (next.x - previous.x));
      }
      previous = next;
    }
    return far;
  }
}
export type LoopTrack = RoundedTrack | FigureEightTrack | CrownTrack;
export const trackBounds = (track: LoopTrack): TrackBounds => track instanceof CrownTrack ? track.bounds
  : { minX: -track.halfWidth, maxX: track.halfWidth, minZ: -track.halfDepth, maxZ: track.halfDepth };

/** The ring fits its row of docked lorries exactly; waiting lorries live in the cards, not on the toy. */
export const trackFor = (lanes: number, shape: BeltShape = 'oval'): LoopTrack => {
  if (shape === 'delta' || shape === 'kidney') return new CrownTrack(shape, lanes);
  if (shape !== 'oval') return new FigureEightTrack(shape === 'wide-eight' ? 3.4 : 3.05, 1.5, 0, false, 1.25);
  const corner = 0.95;
  const halfWidth = Math.max(2.4, ((lanes - 1) * laneSpacing(lanes)) / 2 + TRUCK.bedWidth / 2 + 0.12 + LOOP.channelHalf);
  return new RoundedTrack(halfWidth, (TRUCK.mouthGap + TRUCK.bedLength + TRUCK.cabLength + 0.2 + LOOP.channelHalf) / 2, corner);
};
/** One rules unit of cargo is this long on the bed. */
export const unitLength = (capacity: number): number => TRUCK.bedLength / capacity;

export const STREAM = {
  /** Ticks between units leaving a pouring truck. */
  intervalTicks: 4,
  hopSeconds: 0.16,
  absorbSeconds: 0.18,
} as const;
