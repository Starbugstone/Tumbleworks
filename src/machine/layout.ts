import { FigureEightTrack, type BeltShape } from '../engine/belt-path';
/**
 * Funnel Sort geometry, in world units: x right, y up, z toward the viewer. Physics and drawing
 * both read this file, so what you see is what the marbles hit.
 *
 * Back to front: a shelf of 3×3 trays, a shallow clear funnel, the belt loop, three docks with boxes.
 */
export const MARBLE_RADIUS = 0.32;
export const GRAVITY = 34;
export const TICK_SECONDS = 1 / 60;

export interface TrackPoint {
  readonly x: number;
  readonly z: number;
  /** Unit tangent in the direction of travel. */
  readonly tx: number;
  readonly tz: number;
}

/** A stadium loop: travel runs +x along the back straight and -x along the front. d = 0 is back centre. */
export class Track {
  readonly arc: number;
  readonly length: number;
  constructor(readonly straightHalf: number, readonly radius: number, readonly centerZ: number) {
    this.arc = Math.PI * radius;
    this.length = 4 * straightHalf + 2 * this.arc;
  }
  get backZ(): number { return this.centerZ - this.radius; }
  get frontZ(): number { return this.centerZ + this.radius; }

  /** A point on the centre line, offset outward (positive) or inward (negative). */
  point(distance: number, offset = 0): TrackPoint & { y: number } { return { ...this.flatPoint(distance, offset), y: 0 }; }

  private flatPoint(distance: number, offset = 0): TrackPoint {
    const { straightHalf: S, radius: R, centerZ: CZ, arc: ARC, length } = this;
    let d = ((distance % length) + length) % length;
    const r = R + offset;
    if (d < S) return { x: d, z: CZ - r, tx: 1, tz: 0 };
    d -= S;
    if (d < ARC) {
      const a = d / R;
      return { x: S + r * Math.sin(a), z: CZ - r * Math.cos(a), tx: Math.cos(a), tz: Math.sin(a) };
    }
    d -= ARC;
    if (d < 2 * S) return { x: S - d, z: CZ + r, tx: -1, tz: 0 };
    d -= 2 * S;
    if (d < ARC) {
      const a = d / R;
      return { x: -S - r * Math.sin(a), z: CZ + r * Math.cos(a), tx: -Math.cos(a), tz: -Math.sin(a) };
    }
    d -= ARC;
    return { x: -S + d, z: CZ - r, tx: 1, tz: 0 };
  }

  /** The nearest centre-line position to (x, z): how far along the loop, and how far outward of it. */
  nearest(x: number, z: number): { readonly distance: number; readonly lateral: number } {
    const { straightHalf: S, radius: R, centerZ: CZ, arc: ARC, length } = this;
    const dz = z - CZ;
    if (x > S) {
      const a = Math.atan2(x - S, -dz);
      return { distance: S + a * R, lateral: Math.hypot(x - S, dz) - R };
    }
    if (x < -S) {
      const a = Math.atan2(-S - x, dz);
      return { distance: S + ARC + 2 * S + a * R, lateral: Math.hypot(x + S, dz) - R };
    }
    if (dz < 0) return { distance: x >= 0 ? x : length + x, lateral: -dz - R };
    return { distance: S + ARC + (S - x), lateral: dz - R };
  }
}

export const RACEWAY = {
  floorY: 1.2,
  centerZ: 0.5,
  straightHalf: 2.3,
  radius: 1.5,
  /** Half the channel width. One marble wide, with a little room to wobble. */
  channelHalf: 0.46,
  wallThickness: 0.14,
  wallHeight: 0.5,
  /** Belt speed. Marbles ride it without physics and it never stops. */
  speed: 5.2,
  /** How far off the centre line a rider may sit: a hint of life that still reads as one tight string on a full belt. */
  jitter: 0.04,
} as const;
export const TRACK = new Track(RACEWAY.straightHalf, RACEWAY.radius, RACEWAY.centerZ);
export const RIDE_Y = RACEWAY.floorY + MARBLE_RADIUS;
/** The least distance along the belt between two riders. */
export const RIDER_SPACING = MARBLE_RADIUS * 2 * 1.08;
/**
 * The belt is sized to its capacity: capacity slots at this pitch close the loop, so a full belt is a
 * full string of marbles with no gaps. The two limits are the smallest tracks that still draw cleanly.
 */
export const SLOT_PITCH = RIDER_SPACING * 1.02;
export const MIN_CAPACITY: Readonly<Record<BeltShape, number>> = { oval: 14, eight: 26, 'wide-eight': 30 };
/** Marbles drop onto the belt here, at the back centre. */
export const ENTRY_DISTANCE = 0;
export const OUTER_FRONT_Z = TRACK.frontZ + RACEWAY.channelHalf + RACEWAY.wallThickness;

/** Docks along the front, in the order the belt passes them: it travels toward -x there, so dock 0 is rightmost. */
export const DOCK_SPACING = 2.4;
export const dockX = (dock: number, count: number): number => ((count - 1) / 2 - dock) * DOCK_SPACING;
export const dockDistance = (dock: number, count: number): number => TRACK.nearest(dockX(dock, count), TRACK.frontZ).distance;

export const COLUMN_SPACING = 2.5;
export const columnX = (index: number, count: number): number => (index - (count - 1) / 2) * COLUMN_SPACING;
/** The dish must catch every crate's spill, so its width follows the number of supply columns. */
export const funnelHalfWidth = (columns: number): number => ((columns - 1) / 2) * COLUMN_SPACING + 1.35;

/** Supply crates hang over the funnel in a receding stack; the front crate opens when tapped. */
export const STACK = { y: 6.15, z: -2.75, stepY: 1.0, stepZ: -0.9, slideSeconds: 0.22 } as const;
export const CRATE = {
  halfWidth: 1.14,
  halfDepth: 1.14,
  floorThickness: 0.1,
  wallHeight: 0.46,
  wallThickness: 0.1,
  /** How long the opened crate stays before it is gone. */
  openSeconds: 0.32,
  /** A marble still sitting in an opened crate after this long is dropped by force. */
  stuckSeconds: 0.9,
  slots: [-0.7, 0, 0.7].flatMap((z) => [-0.7, 0, 0.7].map((x) => ({ x, z }))),
} as const;

const backZ = TRACK.backZ;
/**
 * A shallow clear dish under the shelf that gathers every pour into one neck, and a clear chute from
 * the neck to the belt. The dish sits high enough that the figure-eight bridge ramps pass under it.
 */
export const FUNNEL = {
  mouthY: 5.3,
  rimY: 5.75,
  mouth: { back: -4.05, front: -0.5 },
  neckY: 3.7,
  /** The drawn opening above the belt. The pile rests on a closed floor here; the exit itself is scripted. */
  neck: { halfX: 0.5, halfZ: 0.45, z: backZ - 0.2 },
  /** Marbles this close to the neck centre, and this low, are the ones the neck can take next. */
  pickRadius: 1.0,
  pickHeight: 1.1,
  /** The dish vibrates a little, like a parts feeder, so the pile keeps rolling toward the neck. */
  shakeHeight: 1.4,
  shakeImpulse: 0.5,
  /** The scripted exit: down through the neck, then straight down the chute onto the belt. */
  exitSeconds: 0.1,
  dropSeconds: 0.2,
  /** The chute's inside radius; its lower mouth stops this far above a riding marble. */
  chuteRadius: 0.56,
  chuteClearance: 0.12,
} as const;

export const BOX = {
  z: OUTER_FRONT_Z + 0.98,
  slotSpacing: 0.7,
  halfWidth: 1.12,
  halfDepth: 0.5,
  height: 0.46,
  floorThickness: 0.1,
  wallThickness: 0.08,
  /** Boxes still queued wait in a smaller row in front of the docks. */
  queueZ: OUTER_FRONT_Z + 2.35,
  queueSpacing: 1.1,
  queueScale: 0.52,
  queueVisible: 4,
  moveSeconds: 0.26,
  leaveSeconds: 0.3,
} as const;

/** The scripted hop from the belt into a box. */
export const FLIGHT = { seconds: 0.22, arc: 0.95, hopSeconds: 0.14, hopHeight: 0.16, mergeSeconds: 0.12 } as const;

/**
 * Where the chute meets the belt. The oval takes the point straight below the neck. An eight joins the
 * lower pass a little before it dives under the bridge, so the chute never ends beneath the deck.
 */
export function entryDistanceFor(track: Track | FigureEightTrack): number {
  if (track instanceof FigureEightTrack) {
    const a = 0.35;
    return track.nearest(track.halfWidth * Math.sin(a), track.centerZ - track.halfDepth * Math.sin(2 * a)).distance;
  }
  return track.nearest(0, FUNNEL.neck.z).distance;
}

const EIGHT_DEPTH: Readonly<Record<'eight' | 'wide-eight', number>> = { eight: 1.2, 'wide-eight': 1.65 };
const EIGHT_MIN_HALF_WIDTH = 3;

/** The track for a belt of this capacity. The oval keeps its corners and depth, so the chute and docks stay put. */
export function conveyorTrack(shape: BeltShape = 'oval', capacity: number = MIN_CAPACITY.oval): Track | FigureEightTrack {
  const length = capacity * SLOT_PITCH;
  if (shape === 'oval') return new Track(Math.max(0, (length - 2 * Math.PI * RACEWAY.radius) / 4), RACEWAY.radius, RACEWAY.centerZ);
  const depth = EIGHT_DEPTH[shape];
  const build = (halfWidth: number): FigureEightTrack => new FigureEightTrack(halfWidth, depth, RACEWAY.centerZ, false);
  let low = EIGHT_MIN_HALF_WIDTH;
  let high = 12;
  if (build(low).length >= length) return build(low);
  for (let step = 0; step < 30; step++) {
    const middle = (low + high) / 2;
    if (build(middle).length < length) low = middle; else high = middle;
  }
  return build(high);
}

/** Four tapered faces shared by the hopper mesh and its solid collision panels. */
export function funnelFaces(columns: number): { x: number; y: number; z: number }[][] {
  const half = funnelHalfWidth(columns);
  const { mouth, mouthY, neck, neckY } = FUNNEL;
  const outside = [
    { x: -half, y: mouthY, z: mouth.back }, { x: half, y: mouthY, z: mouth.back },
    { x: half, y: mouthY, z: mouth.front }, { x: -half, y: mouthY, z: mouth.front },
  ];
  const inside = [
    { x: -neck.halfX, y: neckY, z: neck.z - neck.halfZ }, { x: neck.halfX, y: neckY, z: neck.z - neck.halfZ },
    { x: neck.halfX, y: neckY, z: neck.z + neck.halfZ }, { x: -neck.halfX, y: neckY, z: neck.z + neck.halfZ },
  ];
  return outside.map((point, index) => [point, outside[(index + 1) % 4]!, inside[(index + 1) % 4]!, inside[index]!]);
}
