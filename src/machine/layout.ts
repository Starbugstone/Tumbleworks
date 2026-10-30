/**
 * The machine's real geometry, in world units: x right, y up, z toward the viewer.
 * Physics and drawing both read this file, so what you see is what the marbles hit.
 *
 * Top to bottom: tipping trays, a clear funnel, a powered raceway, a chute, and the boxes.
 */
export const MARBLE_RADIUS = 0.42;
export const GRAVITY = 26;
export const TICK_SECONDS = 1 / 60;

export const RACEWAY = {
  floorY: 2.1,
  centerZ: 0.5,
  straightHalf: 2.6,
  radius: 2.7,
  /** Room for marbles to pass at the loading point instead of bridging the funnel. */
  channelHalf: 1.3,
  wallThickness: 0.14,
  wallHeight: 1.8,
  /** Target tangential speed of the powered floor. */
  speed: 14,
  /** How hard the drive can push, as an acceleration. Collisions can still slow a marble down. */
  driveAcceleration: 50,
} as const;

export const GATE = {
  /** Marbles are checked as they cross this x on the front straight, travelling toward -x. */
  checkX: 0.72,
  doorHalf: 1.15,
  kickOutward: 7,
  kickUp: 0.9,
  kickAlong: -1.2,
  /** How long the kicker arm and door are drawn open. The door only ever lets a kicked marble through. */
  openSeconds: 0.26,
} as const;

const raceFrontZ = RACEWAY.centerZ + RACEWAY.radius;
export const OUTER_FRONT_Z = raceFrontZ + RACEWAY.channelHalf;

export const CHUTE = {
  topZ: OUTER_FRONT_Z + RACEWAY.wallThickness + 0.02,
  topY: RACEWAY.floorY - 0.02,
  bottomZ: OUTER_FRONT_Z + 1.25,
  bottomY: 1.45,
  halfWidth: 1.22,
} as const;

export const BOX = {
  z: CHUTE.bottomZ + 0.62,
  halfWidth: 1.5,
  halfDepth: 0.62,
  height: 1,
  floorThickness: 0.14,
  wallThickness: 0.12,
  /** Invisible extension so a bouncing marble stays in. */
  catchHeight: 2.6,
  nextX: 5.1,
  parkedX: 30,
  exitX: -9.5,
  /** How long a full box sits still before leaving. */
  holdSeconds: 0.18,
  swapSeconds: 0.3,
} as const;

/** The tray pivots on its front bottom edge, so its marbles spill toward the funnel. */
export const TRAY = {
  halfWidth: 1.72,
  depth: 2.5,
  floorThickness: 0.16,
  wallHeight: 0.62,
  sillHeight: 0.2,
  wallThickness: 0.12,
  frontY: 7.5,
  frontZ: -5.1,
  nextY: 9.1,
  nextZ: -6.3,
  tipAngle: 0.72,
  tipSeconds: 0.5,
  /** The tilt angle's progress at which the first marble is let go, then one more per gap. */
  firstMarbleSeconds: 0.25,
  marbleGapSeconds: 0.14,
  /** After the last marble is let go, give it this long to roll out, then leave. */
  pourSeconds: 0.9,
  leaveSeconds: 0.25,
  slideSeconds: 0.28,
  slots: [
    { x: -1.08, z: -0.66 },
    { x: 0, z: -0.66 },
    { x: 1.08, z: -0.66 },
    { x: -1.08, z: -1.76 },
    { x: 0, z: -1.76 },
    { x: 1.08, z: -1.76 },
  ],
} as const;

export const supplyX = (index: number, count: number): number => {
  const spots = count === 2 ? [-2.3, 2.3] : count === 3 ? [-3.75, 0, 3.75] : [0];
  const x = spots[index];
  if (x === undefined) throw new Error(`No position for supply ${index} of ${count}`);
  return x;
};

const backZ = RACEWAY.centerZ - RACEWAY.radius;
export const FUNNEL = {
  mouthY: 6.4,
  /** Clear walls above the mouth, so a lively pour stays in. */
  wallTopY: 10.5,
  mouth: { left: -5.7, right: 5.7, back: -5.7, front: -0.9 },
  /** Keep the converging walls above circulating traffic, with an open fall into the wide channel. */
  neckY: RACEWAY.floorY + RACEWAY.wallHeight + 0.5,
  neck: {
    left: -1.7,
    right: 1.7,
    back: backZ - RACEWAY.channelHalf,
    front: backZ + RACEWAY.channelHalf,
  },
} as const;

export interface TrackPoint {
  readonly x: number;
  readonly z: number;
  /** Unit tangent in the direction of travel. */
  readonly tx: number;
  readonly tz: number;
}

const { straightHalf: S, radius: R, centerZ: CZ } = RACEWAY;
const ARC = Math.PI * R;
export const TRACK_LENGTH = 4 * S + 2 * ARC;

/** A point on the channel's centre line. d = 0 is back centre, and travel runs +x along the back. */
export function trackPoint(distance: number, offset = 0): TrackPoint {
  let d = ((distance % TRACK_LENGTH) + TRACK_LENGTH) % TRACK_LENGTH;
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

/** The direction of travel at the point on the centre line nearest to (x, z), and how far along it is. */
export function nearestOnTrack(x: number, z: number): TrackPoint & { readonly distance: number; readonly lateral: number } {
  const dz = z - CZ;
  if (x > S) {
    const a = Math.atan2(x - S, -dz);
    const distance = S + a * R;
    return { x, z, tx: Math.cos(a), tz: Math.sin(a), distance, lateral: Math.hypot(x - S, dz) - R };
  }
  if (x < -S) {
    const a = Math.atan2(-S - x, dz);
    const distance = S + ARC + 2 * S + a * R;
    return { x, z, tx: -Math.cos(a), tz: -Math.sin(a), distance, lateral: Math.hypot(x + S, dz) - R };
  }
  if (dz < 0) {
    const distance = x >= 0 ? x : TRACK_LENGTH + x;
    return { x, z, tx: 1, tz: 0, distance, lateral: -dz - R };
  }
  return { x, z, tx: -1, tz: 0, distance: S + ARC + (S - x), lateral: dz - R };
}
