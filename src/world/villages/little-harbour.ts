import type { VillageScenePlan } from '../village-plans';
import type { VillageTerrainSpec } from '../village-terrain';
import { workshopSite } from '../workshop-building';
import { along, connect, groundOf, join, piece, schedule, shots, station, straight, track, turn, UP } from './author';
import { villagePort, type VillageBearingSeat, type VillageConnector, type VillagePort, type VillageVec3 } from '../village-plan';
import type { FootingPatch } from '../pendulum-support';
import type { PendulumDrive } from '../pendulum-types';

/**
 * Little Harbour: a low crescent of quays around a tidal inlet that opens toward the
 * player, warehouses on the ridge behind, boats inside and a second basin off the
 * right-hand mole. The crane lowers the loaded cradle a full two metres down its column
 * before it tips out; a loading arch turns the marble along the west arm, which climbs
 * a crest onto the bascule pier at the inlet's back corner. The curved back quay climbs
 * gently into the lock, whose chamber drops a metre to the quay run; the banked
 * lighthouse stair spirals down the mole, the flume brings it round the east shore into
 * the slipway cradle, which runs down its rails and lets the marble out onto a waterside
 * switchback: two hairpins descend toward the low bell berth. The actual solver must
 * establish the bell payoff before the chute runs out over the basin. Every carrier takes the marble heading +x.
 *
 * Heights follow the rest-height ledger H = y + 1.4 v^2 / 2g of the compiled route: the
 * crane drop is derived from the bascule, catches reset H, and banks follow ledger speed.
 */
const terrain: VillageTerrainSpec = {
  // Render-only exact union of equal-height, equal-colour flat land rows (as Gardens);
  // heights, cells, paint, queries, feet and physics stay literal.
  mergeFlatLand: true,
  size: [24, 32], cells: [48, 64], base: 0.8, water: 0.0, skirtDepth: 2.0,
  outline: [[-9.5, -13], [-4, -14.5], [4, -14.5], [9.5, -13], [11, -6], [11, 14.5], [7.5, 15.5], [-2, 15.5], [-8.5, 14], [-10.5, 6], [-10.5, -6]],
  features: [
    { kind: 'plateau', polygon: [[-12, -16], [12, -16], [12, -6.5], [-12, -6.5]], height: 4.2, skirt: 2.0 },
    // West quay: the crane, the arch and the west arm stand on it.
    { kind: 'plateau', polygon: [[-12, -6.5], [-1.0, -6.5], [-1.0, 16], [-12, 16]], height: 3.6, skirt: 1.2 },
    // Back quay behind the inlet; the lighthouse stands on the low mole beyond it. Its
    // east corner steps back so the mole flume and its walls pass clear of the bank.
    { kind: 'plateau', polygon: [[-1.0, -6.5], [5.0, -6.5], [5.0, 0.7], [2.2, 0.7], [2.2, 1.4], [-1.0, 1.4]], height: 2.4, skirt: 1.0 },
    // The mole slopes down to the slipway and the moored boat.
    { kind: 'cut', polygon: [[3.4, 6], [8.6, 6], [8.6, 16], [3.4, 16]], depth: 0.4, skirt: 1.5 },
    { kind: 'hole', polygon: [[-2.6, 1.8], [2.0, 1.8], [2.0, 16.5], [-2.6, 16.5]] },
    { kind: 'hole', polygon: [[8.8, 5.0], [12.5, 5.0], [12.5, 16.5], [8.8, 16.5]] },
    { kind: 'paint', polygon: [[2.0, 1.8], [3.6, 1.8], [3.6, 16], [2.0, 16]], color: 0xcfc4a2 },
    { kind: 'paint', polygon: [[-1.0, -6.3], [5.0, -6.3], [5.0, 0.5], [2.2, 0.5], [2.2, 1.2], [-1.0, 1.2]], color: 0xbfb79b },
  ],
  palette: { grass: 0x71958a, grassAlt: 0x7fa093, rock: 0x8b9792, shore: 0xd3c7a3, water: 0x3d8796, cliff: 0x546f6a },
};
const { at } = groundOf(terrain);
const beats = schedule(1.0, [[1.4, 0.4], [1.0, 2.2], [1.4, 0.4], [1.0, 0.3], [1.2, 0.3], [0.8, 0.3], [2.0, 2.5], [1.2, 0.3], [1.0, 0.3], [1.2, 0]]);
const plank = 0xd6b27a;
const FLOOR = 0.3 + 0.1;
/** Fixed deck grade shared by the three held carriers (the first-three declaration). */
const DECK_PITCH = -.18;

// ---- Rest-height ledger (hyp) -------------------------------------------------
// A held cargo released from rest has H equal to its held centre height. The first
// cradle starts at localX -.25 on a deck pitched by DECK_PITCH, so its held centre
// sits .25 sin(.18) above the deck origin after the carry.
/** Raised so the descending quay still delivers a keyed-capture arrival (~3.4 m/s) into the lock. */
const BASCULE_Y = 5.7;
/** Crest arrival target 0.5 m/s at the trip: H - y_trip = 1.4 * .5^2 / (2 * 9.81). */
const ROCKER_HEAD = 1.4 * .25 / (2 * 9.81);
const CRANE_ANCHOR: VillageVec3 = [-7.1, 7.1, 8.5];
const CRANE_DROP = CRANE_ANCHOR[1] + .25 * Math.sin(-DECK_PITCH) - (BASCULE_Y + ROCKER_HEAD); // ~2.027 (hyp)
/** Lock: a metre-deep chamber. A carry shorter than ~0.8 m cannot spend the source
 * stroke inside the unchanged 5 N brake rating, so depth is a physical lower bound. */
const LOCK_ANCHOR: VillageVec3 = [4.0, 4.65, -0.1];
const LOCK_TRAVEL: VillageVec3 = [0, -1.0, 0];
/** Upper bound on H after the lock (capture stroke 0); used only for banking. */
const LOCK_HOLD = LOCK_ANCHOR[1] + LOCK_TRAVEL[1] + .25 * Math.sin(-DECK_PITCH);
/** Slipway cradle: .7 m of rail falling 6 degrees toward the water's edge (.7 m keeps the
 * slip's entry far enough east for the flume's last turn; .63 m is the governor minimum). Two shared
 * constraints bound the angle: the station's pulley beam starts .15 behind the anchor while
 * the rail's upper post stands .6 back along the rail, so slips steeper than ~18 degrees put
 * that post into the beam (run45/crossings-0-2-0); and at 18 degrees the capture's braking
 * load runs so nearly along the rail that the guide hold reached 5.08 > 5 N (run45/h41).
 * The governor force stays under the unchanged 5 N rating (hand: (3.096 + 1.02 * .073) / .7
 * = 4.53 N), and the cradle lets the marble out onto the waterside switchback. */
const SLIP_ANGLE = 6 * Math.PI / 180;
/** Slipway deck exit height, unchanged: the slip stands .45 higher than first authored, so
 * the flume turns stay at speeds their banks carry (run45/h43-h44 failed at 1.5). */
const SLIP_EXIT_Y = 1.95;
const SLIP_RAIL = 0.7;
const SLIP_TRAVEL: VillageVec3 = [SLIP_RAIL * Math.cos(SLIP_ANGLE), -SLIP_RAIL * Math.sin(SLIP_ANGLE), 0];
/** Exit edge after the carry. The deck exit sits .8 along the pitched deck from the anchor. */
const SLIP_EXIT: VillageVec3 = [6.35, SLIP_EXIT_Y, 7.5];
const SLIP_ANCHOR: VillageVec3 = [SLIP_EXIT[0] - .8 * Math.cos(-DECK_PITCH) - SLIP_TRAVEL[0], SLIP_EXIT[1] + .8 * Math.sin(-DECK_PITCH) - SLIP_TRAVEL[1], SLIP_EXIT[2]];
/** Upper bound on H after the slip releases its held cargo (captureStart -.25 on the
 * pitched deck); used only to place the level hairpins below their lateral design ratio. */
const SLIP_HOLD = SLIP_ANCHOR[1] + SLIP_TRAVEL[1] + .25 * Math.sin(-DECK_PITCH);
/** Waterside berth of the bell boom and boat chute (hyp): as low as the mole allows, the
 * boom floor .3 above its ~.4 m ground. With the bell .19 below the slip hold, the actual
 * arrival (1.595 m/s) kept the hammer in rolling contact to its clear limit and stalled
 * it before the bell (ks54/HARBOUR-MODEL-EXIT). Here the hold stands ~1.04 above it. */
const BELL_Y = 1.10;
const BOOM_X = 7.4;
/** Waterside switchback (D96): two opposite hairpins down the mole. Every turn is a
 * LEVEL, unbanked turn() arc, so each plank floor quad is planar at any facet count
 * (no bank twist to refine); every height change is a crestFrames leg on a straight
 * plan. The berth (BERTH_Z, BELL_Y) and its hardware are unchanged from Harbour94. */
const HAIRPIN_UPPER = 1.5, HAIRPIN_LOWER = 1.0, HAIRPIN_STEPS = 32;
const BERTH_Z = SLIP_EXIT[2] + 2 * HAIRPIN_UPPER + 2 * HAIRPIN_LOWER;
const DECK_GRADE = Math.tan(-DECK_PITCH);
/** Lead-in that levels the pitched slip exit; it drops its chord times the mean end grade. */
const SWITCHBACK_LEAD = .25;
const SWITCHBACK_Y = SLIP_EXIT_Y - SWITCHBACK_LEAD * DECK_GRADE / 2;
/** Lateral design ratio for an unbanked level turn at the ledger bound v^2 = 2g(H - y)/1.4:
 * v^2/(gR) <= DESIGN_TRACTION gives y >= H - .7 DESIGN_TRACTION R (hyp; the actual
 * rolling cone, mu .8, decides). The lower hairpin sits exactly at that height. */
const DESIGN_TRACTION = .5;
const LOWER_Y = SLIP_HOLD - .7 * DESIGN_TRACTION * HAIRPIN_LOWER;
/** Westmost lower apex whose pile disc (.09) stands on the cut's first fully flat column (x >= 3.5). */
const LOWER_APEX_X = 3.69;

/** Two equal turns of opposite hand: a curved quay that ends parallel to its start, shifted toward −z. */
function sBend(start: VillageVec3, radius: number, angle: number, rise: number, steps = 24): readonly VillagePort[] {
  const first = turn([start[0], start[1], start[2] - radius], radius, -Math.PI / 2, angle, rise, steps);
  const end = first[first.length - 1]!.position;
  const second = turn([end[0] + radius * Math.sin(angle), end[1], end[2] + radius * Math.cos(angle)], radius, Math.PI / 2 + angle, -angle, rise, steps);
  return join(first, second);
}
/** Frame indices under the given fractions of a path's length (the frame each pile top is taken from). */
function pileFrames(points: readonly VillagePort[], fractions: readonly number[]): readonly number[] {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!.position, b = points[i]!.position;
    lengths.push(lengths[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]));
  }
  const total = lengths[lengths.length - 1]!;
  return fractions.map(fraction => {
    let index = 0;
    while (index < lengths.length - 1 && lengths[index + 1]! < fraction * total) index++;
    return index;
  });
}
/** Pile tops under a flume at the given fractions of its length, just under the plank floor. */
function piles(points: readonly VillagePort[], fractions: readonly number[]): readonly VillageVec3[] {
  return pileFrames(points, fractions).map(index => pileTop(points[index]!));
}
/** One bearing seat per pile, on the frame that produced its top (Harbour110: the .012 standoff is closed). */
const seatsAt = (frames: readonly number[]): readonly VillageBearingSeat[] => frames.map((frame, support) => ({ support, frame }));
/** Pile top under one frame. Under a banked or graded floor the underside tilts: keep the
 * .09 pile top below its lowest point over the top disc, not just below the centre. */
function pileTop(frame: VillagePort): VillageVec3 {
  const [nx, ny, nz] = frame.normal;
  return [frame.position[0] - nx * FLOOR, frame.position[1] - ny * FLOOR - 0.09 * Math.hypot(nx, nz) / ny - 0.012, frame.position[2] - nz * FLOOR];
}
const withPiles = (link: VillageConnector, fractions: readonly number[], terrainFeet?: readonly number[]): VillageConnector =>
  ({ ...link, supports: piles(link.points, fractions), ...(terrainFeet ? { terrainFeet } : {}), bearingSeats: seatsAt(pileFrames(link.points, fractions)) });
/** Frames of a fixed curve at explicit parameters (uniform or adaptively refined). */
type Curve = (parameters: readonly number[]) => readonly VillagePort[];
const asIs = (frames: readonly VillagePort[]) => frames;
const uniform = (steps: number) => Array.from({ length: steps + 1 }, (_, i) => i / steps);
/** Signed bank of each frame about its own tangent, measured from the unbanked normal
 * that tangent implies (the construction every curve here uses), so it needs no copy of
 * the unbanked frames. */
function bankAngles(frames: readonly VillagePort[]): number[] {
  return frames.map(({ tangent: t, normal: b }) => {
    const nx = -t[0] * t[1], ny = 1 - t[1] * t[1], nz = -t[2] * t[1], l = Math.hypot(nx, ny, nz);
    const n = [nx / l, ny / l, nz / l], side = [t[1] * n[2]! - t[2] * n[1]!, t[2] * n[0]! - t[0] * n[2]!, t[0] * n[1]! - t[1] * n[0]!];
    return Math.atan2(b[0] * side[0]! + b[1] * side[1]! + b[2] * side[2]!, b[0] * n[0]! + b[1] * n[1]! + b[2] * n[2]!);
  });
}
/** Where a bank change meets a turn's own twist, the triangulated floor can rise into
 * the marble's chord. Banked runs are subdivided, interval by interval (with their
 * neighbours, so spacing stays graded), until no bank change exceeds TWIST_STEP, the
 * step at which the strict scene sweep on the packed buffers measured every run clear
 * (run45/chord5). Positions, grades and banks are those of the fixed curve. */
const TWIST_STEP = .010;
function refined(curve: Curve, bank: (frames: readonly VillagePort[]) => readonly VillagePort[], base: number, limit = TWIST_STEP): readonly VillagePort[] {
  let parameters = uniform(base);
  for (let pass = 0; pass < 12; pass++) {
    const frames = curve(parameters), banked = bank(frames), angles = bankAngles(banked);
    // Split every interval over the limit, and its neighbours, so spacing stays graded
    // and the curvature estimate never mixes very short and very long intervals.
    const over = parameters.map((_, i) => i > 0 && Math.abs(angles[i]! - angles[i - 1]!) > limit);
    const next: number[] = [parameters[0]!];
    for (let i = 1; i < parameters.length; i++) {
      const twist = Math.ceil(Math.abs(angles[i]! - angles[i - 1]!) / limit - 1e-12);
      const parts = over[i] ? Math.max(2, twist) : over[i - 1] || over[i + 1] ? 2 : 1;
      for (let part = 1; part < parts; part++) next.push(parameters[i - 1]! + (parameters[i]! - parameters[i - 1]!) * part / parts);
      next.push(parameters[i]!);
    }
    if (next.length === parameters.length) return banked;
    parameters = next;
  }
  const frames = curve(parameters), angles = bankAngles(bank(frames));
  let at = 1;
  for (let i = 1; i < angles.length; i++) if (Math.abs(angles[i]! - angles[i - 1]!) > Math.abs(angles[at]! - angles[at - 1]!)) at = i;
  throw new Error(`Banked run did not refine to ${limit} rad per frame: ${angles[at - 1]} -> ${angles[at]} at u ${parameters[at - 1]}..${parameters[at]} of ${parameters.length}`);
}
/** villageHelix (basis +x, +z, world up) at explicit parameters; same position law. */
function helixAt(center: VillageVec3, radius: number, start: number, turns: number, rise: number, parameters: readonly number[]): readonly VillagePort[] {
  const sweep = turns * Math.PI * 2;
  return parameters.map(t => {
    const angle = start + sweep * t, c = Math.cos(angle), s = Math.sin(angle);
    const tx = -radius * sweep * s, ty = rise, tz = radius * sweep * c, tl = Math.hypot(tx, ty, tz);
    const x = tx / tl, y = ty / tl, z = tz / tl, nx = -x * y, ny = 1 - y * y, nz = -z * y, nl = Math.hypot(nx, ny, nz);
    return villagePort([center[0] + radius * c, center[1] + rise * t, center[2] + radius * s], [x, y, z], [nx / nl, ny / nl, nz / nl]);
  });
}
/** Fixed crest geometry with exact endpoint frames and zero endpoint second derivatives
 * (a local copy of Gardens' crestFrames, byte-for-byte in its maths). */
function crestFrames(from: VillagePort, to: VillagePort, steps = 64, parameters: readonly number[] = uniform(steps)): readonly VillagePort[] {
  const length = Math.hypot(to.position[0] - from.position[0], to.position[2] - from.position[2]);
  const aScale = length / Math.hypot(from.tangent[0], from.tangent[2]);
  const bScale = length / Math.hypot(to.tangent[0], to.tangent[2]);
  return parameters.map(u => {
    const u2 = u * u, u3 = u2 * u, u4 = u3 * u, u5 = u4 * u;
    const blend = 10 * u3 - 15 * u4 + 6 * u5;
    const h0 = u - 6 * u3 + 8 * u4 - 3 * u5, h1 = -4 * u3 + 7 * u4 - 3 * u5;
    const db = 30 * u2 - 60 * u3 + 30 * u4;
    const d0 = 1 - 18 * u2 + 32 * u3 - 15 * u4, d1 = -12 * u2 + 28 * u3 - 15 * u4;
    const coordinate = (axis: 0 | 1 | 2) => from.position[axis] + (to.position[axis] - from.position[axis]) * blend
      + from.tangent[axis] * aScale * h0 + to.tangent[axis] * bScale * h1;
    const derivative = (axis: 0 | 1 | 2) => (to.position[axis] - from.position[axis]) * db
      + from.tangent[axis] * aScale * d0 + to.tangent[axis] * bScale * d1;
    const dx = derivative(0), dy = derivative(1), dz = derivative(2), size = Math.hypot(dx, dy, dz);
    const x = dx / size, y = dy / size, z = dz / size;
    const nx = -x * y, ny = 1 - y * y, nz = -z * y, up = Math.hypot(nx, ny, nz);
    return villagePort([coordinate(0), coordinate(1), coordinate(2)], [x, y, z], [nx / up, ny / up, nz / up], from.width);
  });
}
/** The crest curve banked toward its exact horizontal curvature centre from the ledger
 * speed: phi = min(cap, atan(v^2 kappa / g)). Curvature comes from the quintic's own
 * second derivative, so every parameter has its exact bank however it is sampled; the
 * ends have zero curvature, so both docks stay level. Positions are the crest's. */
function bankedCrest(from: VillagePort, to: VillagePort, H: number, cap: number): Curve {
  const length = Math.hypot(to.position[0] - from.position[0], to.position[2] - from.position[2]);
  const aScale = length / Math.hypot(from.tangent[0], from.tangent[2]);
  const bScale = length / Math.hypot(to.tangent[0], to.tangent[2]);
  return parameters => crestFrames(from, to, 0, parameters).map((frame, i) => {
    const u = parameters[i]!, u2 = u * u, u3 = u2 * u;
    const d2b = 60 * u - 180 * u2 + 120 * u3, d20 = -36 * u + 96 * u2 - 60 * u3, d21 = -24 * u + 84 * u2 - 60 * u3;
    const u4 = u3 * u, db = 30 * u2 - 60 * u3 + 30 * u4, d0 = 1 - 18 * u2 + 32 * u3 - 15 * u4, d1 = -12 * u2 + 28 * u3 - 15 * u4;
    const first = [0, 1, 2].map(j => (to.position[j]! - from.position[j]!) * db + from.tangent[j]! * aScale * d0 + to.tangent[j]! * bScale * d1);
    const second = [0, 1, 2].map(j => (to.position[j]! - from.position[j]!) * d2b + from.tangent[j]! * aScale * d20 + to.tangent[j]! * bScale * d21);
    const speed2 = first[0]! ** 2 + first[1]! ** 2 + first[2]! ** 2, [tx, , tz] = frame.tangent, [nx, ny, nz] = frame.normal;
    const along = second[0]! * frame.tangent[0] + second[1]! * frame.tangent[1] + second[2]! * frame.tangent[2];
    const h = Math.hypot(tx, tz), sx = -tz / h, sz = tx / h;
    const lateral = ((second[0]! - along * frame.tangent[0]) * sx + (second[2]! - along * frame.tangent[2]) * sz) / speed2;
    const v2 = 2 * 9.81 * Math.max(0, H - frame.position[1]) / 1.4;
    const bank = Math.min(cap, Math.atan(v2 * Math.abs(lateral) / 9.81)) * Math.sign(lateral);
    if (bank === 0) return frame;
    const cos = Math.cos(bank), sin = Math.sin(bank);
    return villagePort(frame.position, frame.tangent, [nx * cos + sx * sin, ny * cos, nz * cos + sz * sin], frame.width);
  });
}
/**
 * Bank a helix toward its axis from the ledger speed v^2 = 2g(H - y)/1.4: the bank that
 * cancels lateral demand, capped at `cap` (UX ceiling); floor friction carries the rest
 * and the existing rolling cone judges it. Ramps in from level over the first `ramp` of
 * the frames so the entry frame meets its unbanked connector. Positions are unchanged.
 */
function bankedHelix(points: readonly VillagePort[], axis: VillageVec3, radius: number, H: number, cap: number, ramp = 1 / 6, parameters?: readonly number[]): readonly VillagePort[] {
  return points.map((point, i) => {
    // The fade follows the curve parameter, not the frame index, so refinement cannot move it.
    const u = parameters?.[i] ?? i / (points.length - 1), fade = Math.min(1, u / ramp), eased = fade * fade * (3 - 2 * fade);
    const v2 = 2 * 9.81 * Math.max(0, H - point.position[1]) / 1.4;
    const bank = Math.min(cap, Math.atan(v2 / (radius * 9.81))) * eased;
    const [tx, ty, tz] = point.tangent, [nx, ny, nz] = point.normal;
    let ix = axis[0] - point.position[0], iz = axis[2] - point.position[2];
    const l = Math.hypot(ix, iz); ix /= l; iz /= l;
    const it = ix * tx + iz * tz;
    let bx = ix - it * tx, by = -it * ty, bz = iz - it * tz;
    const bn = bx * nx + by * ny + bz * nz;
    bx -= bn * nx; by -= bn * ny; bz -= bn * nz;
    const bl = Math.hypot(bx, by, bz); bx /= bl; by /= bl; bz /= bl;
    const c = Math.cos(bank), s = Math.sin(bank);
    return villagePort(point.position, point.tangent, [nx * c + bx * s, ny * c + by * s, nz * c + bz * s], point.width);
  });
}

/** A straight run along the dock's own tangent that unwinds its bank to level: the
 * normal rotates about that fixed tangent (smoothstep in angle), so every frame stays
 * orthonormal and the first frame is the dock port itself. */
function unwind(from: VillagePort, length: number): readonly VillagePort[] {
  const [tx, ty, tz] = from.tangent, [fx, fy, fz] = from.normal;
  let ux = -ty * tx, uy = 1 - ty * ty, uz = -ty * tz; const ul = Math.hypot(ux, uy, uz); ux /= ul; uy /= ul; uz /= ul;
  const total = Math.acos(Math.max(-1, Math.min(1, ux * fx + uy * fy + uz * fz)));
  // Smoothstep's peak rate is 1.5x its mean; keep each frame's twist within TWIST_STEP
  // (a 4x coarser step left a 6 mm floor ridge: run45/chord17).
  const steps = Math.max(2, Math.ceil(1.5 * total / TWIST_STEP));
  return Array.from({ length: steps + 1 }, (_, i) => {
    if (i === 0) return from;
    const u = i / steps, w = 1 - u * u * (3 - 2 * u), a = total * w;
    const s0 = total === 0 ? 1 : Math.sin(total - a) / Math.sin(total), s1 = total === 0 ? 0 : Math.sin(a) / Math.sin(total);
    const n = [ux * s0 + fx * s1, uy * s0 + fy * s1, uz * s0 + fz * s1] as const, l = Math.hypot(...n);
    return villagePort(along(from, length * u), from.tangent, [n[0] / l, n[1] / l, n[2] / l], from.width);
  });
}
const quayRun = straight([5.4, 3.50, -0.1], [6.4, 3.50, -0.1], 2);
const STAIR_CENTRE: VillageVec3 = [6.9, 3.5, 0.9];
/** The stair's whole drop, unchanged (formerly 0.9 per turn over a turn and a half). */
const STAIR_DROP = 1.35;
/** (hyp) 30 degree ceiling; at the foot this leaves a required floor ratio of ~0.7 (hand). */
const STAIR_BANK_CAP = 30 * Math.PI / 180;
/** Harbour122: the stair's two docks are exactly the ends of the former 1.5-turn helix,
 * evaluated by its unchanged law, so the 4→3 splice and the 3→2 flume keep bit-identical ports. */
const STAIR_PORTS = bankedHelix(helixAt(STAIR_CENTRE, 1.0, -Math.PI / 2, 1.5, -STAIR_DROP, [0, 1]),
  STAIR_CENTRE, 1.0, LOCK_HOLD, STAIR_BANK_CAP, .3, [0, 1]);
/** Half a turn between those docks, so no lap ever passes over another and the descent stays
 * in view. u is the fraction of the drop (y = 3.5 - 1.35 u, as before); the plan angle phi
 * solves phi - sin(2 phi) / 3 = pi u, giving the grade (0.45 + 1.8 sin^2 phi) / pi: the old
 * 1.35 / (3 pi) at both docks with no change of grade there. Equal drop steps keep each step's
 * helicoid twist at cos(grade) * 1.35 / 160, never above the old stair's. */
function halfTurnStairAt(parameters: readonly number[]): readonly VillagePort[] {
  return parameters.map(u => {
    let phi = Math.PI * u;
    for (let i = 0; i < 16; i++) {
      const step = (phi - Math.sin(2 * phi) / 3 - Math.PI * u) / (1 - 2 * Math.cos(2 * phi) / 3);
      phi -= step;
      if (Math.abs(step) <= 1e-15) break;
    }
    const angle = -Math.PI / 2 + phi, c = Math.cos(angle), s = Math.sin(angle);
    const rise = -STAIR_DROP * (1 - 2 * Math.cos(2 * phi) / 3) / Math.PI, tl = Math.hypot(s, rise, c);
    const x = -s / tl, y = rise / tl, z = c / tl, nx = -x * y, ny = 1 - y * y, nz = -z * y, nl = Math.hypot(nx, ny, nz);
    return villagePort([STAIR_CENTRE[0] + c, STAIR_CENTRE[1] - STAIR_DROP * u, STAIR_CENTRE[2] + s], [x, y, z], [nx / nl, ny / nl, nz / nl]);
  });
}
/** Bank ramp over the first half of the drop: the smoothstep's steepest step, cap * 1.5 / (.5 * 160),
 * stays under TWIST_STEP, so only the cap transition is subdivided. */
const halfTurn = refined(parameters => bankedHelix(halfTurnStairAt(parameters),
  STAIR_CENTRE, 1.0, LOCK_HOLD, STAIR_BANK_CAP, .5, parameters), asIs, 160);
const lighthouseStair = [STAIR_PORTS[0]!, ...halfTurn.slice(1, -1), STAIR_PORTS[1]!];
/** The head pile is the first frame whose pile disc lies wholly beyond the 4→3 joint plane
 * (frame 3); the foot pile keeps the old last-but-one frame at the flume dock. */
const STAIR_PILES = [0.06, 1] as const;
if (pileTop(lighthouseStair[pileFrames(lighthouseStair, STAIR_PILES)[0]!]!)[0] - .09 <= STAIR_PORTS[0]!.position[0]) {
  throw new Error('Stair head pile crosses the 4→3 joint');
}
// Story beats remain camera ordering metadata; none of these values sets a playback duration.
const stations = [
  // Crane: the loaded cradle is lowered down its column onto the upper quay before it tips out.
  station({ stop: 9, anchor: CRANE_ANCHOR, badge: [-9.5, 7.95, 10.9], mechanism: { kind: 'release', travel: [0, -CRANE_DROP, 0], deckPitch: DECK_PITCH }, beat: beats[0]!, color: plank }),
  // Loading arch: an open quarter turn that sends the marble along the west arm (lowered with the crane).
  track(8, 'arc', turn([-5.5, 5.45, 6.7], 1.8, -Math.PI / 2, Math.PI / 2, -0.3), beats[1]!, [-3.2, 6.05, 7.2], plank),
  // Bascule pier at the inlet's back corner, reached by a crest off the west arm.
  station({ stop: 7, anchor: [-1.3, BASCULE_Y, 0.6], badge: [-2.95, 6.05, 0.15], mechanism: { kind: 'bridge', pivot: [-0.8, -0.5, 0], axis: [0, 0, 1], angle: -0.3 }, beat: beats[2]!, color: plank }),
  // Curved back quay: a gentle S that runs down into the lock (hyp: 5.05 -> 4.85), so its
  // own grade carries the descent and the short splice onto the pitched deck stays gentle.
  track(6, 'arc', sBend([0.48, 5.05, 0.6], 2.0, 0.6, -0.1), beats[3]!, [-1.9, 9.2, -2.8], plank),
  // Lock: the chamber drops a metre and lets the marble out onto the quay run.
  station({ stop: 5, anchor: LOCK_ANCHOR, badge: [2.9, 6.65, -1.3], mechanism: { kind: 'translating', travel: LOCK_TRAVEL, deckPitch: DECK_PITCH }, beat: beats[4]!, color: plank }),
  // Short run to the end of the quay.
  // One pile, outside the stair's channel footprint (radius .6-1.4 m); the run's ends rest
  // on the lock splice and the stair splice.
  // The pile stands on the back quay's steep skirt: its foot follows the drawn terrain (Harbour102).
  // Its seat also bears the lock splice's last interval: this one joint pile carries both floors (Harbour110).
  track(4, 'channel', quayRun, beats[5]!, [7.2, 7.9, -2.3], plank, { supports: piles(quayRun, [0.1]), terrainFeet: [0],
    bearingSeats: [{ support: 0, frame: pileFrames(quayRun, [0.1])[0]!, joint: 'entry' }] }),
  // Lighthouse stair on the mole: half a turn down between the old stair's exact docks,
  // with no lap overhead, banked as it gathers speed.
  track(3, 'helix', lighthouseStair, beats[6]!, [9.5, 5.4, 0.75], plank, { supports: piles(lighthouseStair, STAIR_PILES),
    bearingSeats: seatsAt(pileFrames(lighthouseStair, STAIR_PILES)) }),
  // Slipway cradle: catches the marble and runs down its rails toward the water.
  station({ stop: 2, anchor: SLIP_ANCHOR, badge: [2.9, 5.4, 5.4], mechanism: { kind: 'translating', travel: SLIP_TRAVEL, deckPitch: DECK_PITCH }, beat: beats[7]!, color: plank }),
  // The boom swings and rings the ship's bell as the marble passes the low berth. Stops 1
  // and 0 are the old dock moved rigidly by (0, BELL_Y - 1.95, BERTH_Z - 7.5); the
  // stop-1 badge is raised and inset over the mole to separate the two berth targets.
  station({ stop: 1, anchor: [BOOM_X, BELL_Y, BERTH_Z], badge: [BOOM_X - 1.65, BELL_Y + 1, BERTH_Z + 1.4], mechanism: { kind: 'striker', travel: 0.5 }, beat: beats[8]!, color: plank }),
  // Loading chute over the basin edge, beside the boat; piles stand on the last of the mole.
  station({ stop: 0, anchor: [9.4, BELL_Y, BERTH_Z], badge: [8.7, BELL_Y + 2.6, BERTH_Z - 1.3], mechanism: { kind: 'receiver', travel: 0 }, beat: beats[9]!, color: plank,
    // Both tops seat the deck and splice; their feet lie on the one skirt-cell plane (Harbour102).
    span: 'girder', supports: [[8.65, BELL_Y - 0.4, BERTH_Z - .28], [8.65, BELL_Y - 0.4, BERTH_Z + .28]], terrainFeet: [0, 1] }),
];
/** The approved bell hardware (mass, legacy work, bar, facets, stop angle, dress) moved
 * rigidly with its berth. Axle and footing centres follow proposedPendulum's own
 * construction (axle .3 behind the anchor, arm 1.6 up; feet at z -.65/+.65 and the bell
 * foot at its unchanged x, z -.62). Heights are sampled from the actual terrain in the
 * migration's corner order; they are never copied from the old dock. */
const BELL_AXLE: VillageVec3 = [BOOM_X - .3, BELL_Y + 1.6, BERTH_Z];
const FOOT_HALF = Math.max(Math.fround(.07), Math.abs(Math.fround(.65 + .07) - .65), Math.abs(Math.fround(.65 - .07) - .65));
const foot = (x: number, z: number): FootingPatch => ({ x, z, half: FOOT_HALF,
  heights: [at(x - FOOT_HALF, z - FOOT_HALF), at(x + FOOT_HALF, z - FOOT_HALF), at(x - FOOT_HALF, z + FOOT_HALF), at(x + FOOT_HALF, z + FOOT_HALF)] });
const BELL_DRIVE: PendulumDrive = { kind: 'pendulum', mass: 0.001, legacyGuideWork: { friction: 0.008, stroke: 0.5 },
  axle: { origin: BELL_AXLE, axis: [0, 0, 1] }, bar: { arm: 1.6, radius: 0.04, length: 0.56, facets: 16 }, stopAngle: 0.7, dress: 'harbour-bell',
  footings: [foot(BELL_AXLE[0], BELL_AXLE[2] - .65), foot(BELL_AXLE[0], BELL_AXLE[2] + .65), foot(8.191347826122232, BELL_AXLE[2] - .62)] };
/** The first-three held-carrier declaration (unchanged values, as Gardens 9/5/1).
 * Conventions: bodyCentre is the carrier-frame COM of the complete moving body (origin
 * at the carrier contact, +y along the deck normal); it states the value the compiler
 * previously assumed implicitly, pending the measured carrier inventory. A pure
 * translation has no driven rotation axis, so the central bodyInertia is 0 by
 * convention (it is only read for pivoted carriers) and rotorInertia is 0. */
const held = {
  marbleMass: .02, headMass: .001, brakeForce: 5, captureStart: -.25, captureStroke: .3,
  bodyMass: .08, bodyCentre: [0, -.4, 0] as const, bodyInertia: 0, rotorInertia: 0, weightMass: .4, weightDrop: .8,
  acceleration: 3, gateSeconds: .22, gateMass: .003,
};
const physical = stations.map(station => station.stop === 9 ? { ...station, initialCargo: { localX: -.25 }, retention: held }
  : station.stop === 5 || station.stop === 2 ? { ...station, retention: held }
  : station.stop === 7 ? { ...station, rollingDrive: {
    kind: 'contact-gravity' as const, marbleMass: .02, bodyMass: .012,
    bodyInertia: .0104, bodyCentre: [0, -.46, 0] as const,
    tripX: -.55, bearingTorque: .0002,
    restitution: 0, traction: .8,
  } }
  : station.stop === 1 ? { ...station, strikerDrive: BELL_DRIVE }
  : station.stop === 0 ? { ...station, terminalCapture: { marbleMass: .02, headMass: .001, brakeForce: 2, lead: .35, availableStroke: .3 } } : station);
const [crane, arch, bascule, quay, lock, backQuay, stair, slipway, boom, chute] = physical as [typeof physical[number], typeof physical[number], typeof physical[number], typeof physical[number], typeof physical[number], typeof physical[number], typeof physical[number], typeof physical[number], typeof physical[number], typeof physical[number]];
// West arm: climb on the straight beside the quay, turn level, then a short straight
// crest onto the bascule. Climbing and turning stay separate, so the floor never twists
// under the marble; the level turn runs at about 1.5 m/s.
const ARM_TURN_Y = 5.555;
const armTurnIn = villagePort([-3.7, ARM_TURN_Y, 1.6], [0, 0, -1], UP);
const armTurnOut = villagePort([-2.7, ARM_TURN_Y, 0.6], [1, 0, 0], UP);
const westArm = join(refined(parameters => crestFrames(arch.exit, armTurnIn, 0, parameters), asIs, 32),
  refined(parameters => crestFrames(armTurnIn, armTurnOut, 0, parameters), asIs, 24),
  refined(parameters => crestFrames(armTurnOut, bascule.entry, 0, parameters), asIs, 12));
// Mole flume: a straight that unwinds the stair's bank, then two left turns down the
// east shore into the slipway. The turns are curvature-continuous (level, unbanked at
// their ends) and banked from the ledger speed; the corridor keeps the original shore.
/** (hyp) bank ceiling for the 4.4-4.8 m/s flume turns. */
const FLUME_BANK_CAP = 40 * Math.PI / 180;
/** The first, wider turn off the stair needs less bank than the last (hand; the rolling check decides). */
const FLUME_FIRST_CAP = 30 * Math.PI / 180;
const FLUME_UNWIND = 1.3;
const flumeUnwind = unwind(stair.exit, FLUME_UNWIND);
const flumeStraight = flumeUnwind.at(-1)!;
// The shore straight carries the descent to the slip, so the banked turns stay nearly
// level; both its ports share its grade.
// The shore run climbs gently toward the raised slip; its ports share its grade.
const SHORE_TOP = 2.20, SHORE_DROP = -0.06, shoreGrade = Math.hypot(SHORE_DROP, 1.6);
const shoreNorth = villagePort([2.6, SHORE_TOP, 4.0], [0, -SHORE_DROP / shoreGrade, 1.6 / shoreGrade], [0, 1.6 / shoreGrade, SHORE_DROP / shoreGrade]);
const shoreSouth = villagePort([2.6, SHORE_TOP - SHORE_DROP, 5.6], shoreNorth.tangent, shoreNorth.normal);
// Switchback (D96): level lead end, upper right-hand hairpin, run west, lower left-hand
// hairpin, then the chute leg that drops onto the level boom.
const leadEnd = villagePort([SLIP_EXIT[0] + SWITCHBACK_LEAD, SWITCHBACK_Y, SLIP_EXIT[2]]);
const upperTurn = turn([leadEnd.position[0], SWITCHBACK_Y, SLIP_EXIT[2] + HAIRPIN_UPPER], HAIRPIN_UPPER, Math.PI / 2, -Math.PI, 0, HAIRPIN_STEPS);
const lowerStart = villagePort([LOWER_APEX_X + HAIRPIN_LOWER, LOWER_Y, upperTurn.at(-1)!.position[2]], [-1, 0, 0]);
const lowerTurn = turn([lowerStart.position[0], LOWER_Y, lowerStart.position[2] + HAIRPIN_LOWER], HAIRPIN_LOWER, Math.PI / 2, Math.PI, 0, HAIRPIN_STEPS);
const SWITCHBACK_LEGS = [
  crestFrames(slipway.exit, leadEnd, 2),
  upperTurn,
  crestFrames(villagePort(upperTurn.at(-1)!.position, [-1, 0, 0]), lowerStart, 8),
  lowerTurn,
  crestFrames(villagePort(lowerTurn.at(-1)!.position, [1, 0, 0]), boom.entry, 16),
] as const;
const switchback = join(...SWITCHBACK_LEGS);
/** One pile under each leg's middle frame except the short lead (on the slip's own supports). */
const switchbackFrames = SWITCHBACK_LEGS.slice(1).map((_, leg) => {
  const before = SWITCHBACK_LEGS.slice(0, leg + 1).reduce((sum, run) => sum + run.length - 1, 0);
  return before + (SWITCHBACK_LEGS[leg + 1]!.length - 1) / 2;
});
const switchbackPiles = switchbackFrames.map(index => pileTop(switchback[index]!));
const connectors = [
  // Short splices (.3-.8 m) need no more than 16 intervals.
  connect(crane, arch, 0.3, 0.3, [0, 0], { steps: 16 }),
  withPiles({ from: arch.stop, to: bascule.stop, points: westArm }, [0.1, 0.3, 0.5, 0.68, 0.86]),
  connect(bascule, quay, 0.4, 0.4, [0, 0], { steps: 16, terrainFrameFeet: [4] }),
  // Too short for two automatic supports (they would overlap): one pile at its middle.
  withPiles(connect(quay, lock, 0.2, 0.2, [0, 0], { steps: 16 }), [0.5]),
  // Its frame-12 post stood .136 m from the quay's joint pile and crossed it; the joint seat carries that end (Harbour110).
  connect(lock, backQuay, 0.2, 0.2, [0, 0], { steps: 16, terrainFrameFeet: [4], omitAutomaticFrames: [12] }),
  // The short splice rests on the two adjoining assemblies, clear of the lower lap.
  connect(backQuay, stair, 0.2, 0.2, [0, 0], { supports: [], steps: 16, fixedEnds:['source','destination'] }),
  withPiles({ from: stair.stop, to: slipway.stop, points: join(flumeUnwind,
    refined(bankedCrest(flumeStraight, shoreNorth, LOCK_HOLD, FLUME_FIRST_CAP), asIs, 32),
    straight(shoreNorth.position, shoreSouth.position, 8),
    // Piles .2, .33, .6, .73 and .9 stand across terrain creases; their feet follow the drawn terrain (Harbour102).
    refined(bankedCrest(shoreSouth, slipway.entry, LOCK_HOLD, FLUME_BANK_CAP), asIs, 32)) }, [0.08, 0.2, 0.33, 0.47, 0.6, 0.73, 0.9], [1, 2, 4, 5, 6]),
  // Waterside switchback: level hairpins, all height change on straight plan legs.
  { from: slipway.stop, to: boom.stop, points: switchback, supports: switchbackPiles, bearingSeats: seatsAt(switchbackFrames) },
  // The splice pile's foot crosses the cut floor's edge at x 8.5 (Harbour102).
  connect(boom, chute, 0.15, 0.15, [0, 0], { supports: [[8.4, BELL_Y - 0.4, BERTH_Z]], terrainFeet: [0], steps: 16 }),
];
const scenery = [
  piece('warehouse', [-4.5, at(-4.5, -9.5), -9.5], 0, 1.0), piece('warehouse', [1.5, at(1.5, -10.0), -10.0], 0.1, 1.0),
  piece('warehouse', [6.8, at(6.8, -9.0), -9.0], -0.1, 0.95),
  piece('house-b', [-8.6, at(-8.6, -6.0), -6.0], 0.2, 1.0), piece('house-a', [-8.0, at(-8.0, 12.5), 12.5], -0.2, 1.1),
  // Moored at z 10 (Harbour94). Its packed hull did not cross the chute at the old z 10.9
  // either (harbour-live94 feet-boat3), so no old-mooring collision is claimed.
  piece('boat', [9.6, -0.25, 10.0], Math.PI / 2, 1.0), piece('boat', [-0.3, -0.25, 12.0], -0.4, 1.1),
  piece('tree-a', [-9.2, at(-9.2, 1.0), 1.0], 0, 0.85), piece('tree-a', [6.0, at(6.0, 4.8), 4.8], 0, 0.8),
  piece('tree-a', [-1.5, at(-1.5, -8.0), -8.0], 0, 0.75), piece('tree-a', [9.8, at(9.8, 1.5), 1.5], 0, 0.8),
];
export const LITTLE_HARBOUR: VillageScenePlan = {
  chapter: 0, construction: 'rise', terrain, scenery,
  // Shot times are unchanged authored metadata; retime against route.duration at the camera stage.
  plan: { chapter: 0, profile: 'plank', staticSupports:'harbour-static-112', stations: physical, connectors, camera: shots([0, 2.4, 0], [
    { at: 2.6, target: [-3.6, 4.8, 5.0], radius: 22 }, { at: 5.0, target: [-1.3, 4.6, 1.0], radius: 22 },
    { at: 7.6, target: [3.0, 3.8, -0.2], radius: 24 }, { at: 10.45, target: [6.6, 2.8, 0.6], radius: 22 },
    // The bell shot's target moves with the berth; its time, radius and the zoom count are unchanged.
    { at: 14.9, target: [4.0, 2.0, 4.6], radius: 26 }, { at: 17.55, target: [7.6, 1.5, 7.6], radius: 22 },
  ]) },
  workshop: workshopSite({ position: [-7.4, at(-7.4, 4.6), 4.6], scale: 1.1, yaw: 0.3 }, [-7.6, at(-7.4, 4.6) + 3.3, 4.8], { from: 8, to: 7 }),
  rewards: [
    { project: 'board-210', position: [-3.6, at(-3.6, -5.6), -5.6], yaw: 0 },
    { project: 'board-212', position: [-7.2, at(-7.2, -2.0), -2.0], yaw: 0 },
  ],
  overview: [piece('warehouse', [-4, at(-4, -9.5), -9.5], 0, 1.3), piece('boat', [-0.3, -0.25, 9], -0.3, 1.5), piece('house-a', [-7.5, at(-7.5, 5), 5], 0.3, 1.2)],
};
