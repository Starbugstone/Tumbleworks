import type { VillageScenePlan } from '../village-plans';
import type { VillageTerrainSpec } from '../village-terrain';
import { workshopSite } from '../workshop-building';
import { connect, connectVia, groundOf, join, piece, ribbon, schedule, shots, station, straight, track, UP } from './author';
import { villagePort, type VillageConnector, type VillagePort, type VillageVec3 } from '../village-plan';

/**
 * Willow Mill: an S-shaped river between a high western bank and a broad low eastern
 * meadow, with the mill down on a quay at the water's edge and willows along both banks.
 * A cart tips its load into the millrace, which dives down the quay's west side; a brake
 * paddle checks it on the quay, the mill's own bucket wheel, standing over the river,
 * lifts it to the roof flume, a U-turn carries the flume round the mill onto the aqueduct
 * across the river, then a sluice, a meandering S bank and a spillway hand it to the
 * granary's sack hoist. Carriers all take the marble heading +x; every change of
 * direction is a real bend with room to turn.
 *
 * The aqueduct climbs a little across the river
 * and crests into the raised sluice; the meadow S bank stands on low trestles, banked
 * in its hairpins, and the spillway becomes a sack trolley that catches the marble and
 * hauls it across to the hoist. Heights follow the rest-height ledger H = y + 1.4 v^2 / 2g;
 * values marked (hyp) downstream of the wheel await its compiled hold, because the wheel
 * (stop 6) awaits orbital retained-carry support and the paddle (stop 7) a striker law.
 */
const river = [[-2.0, -17] as const, [-1.5, -10] as const, [2.3, -5.5] as const, [1.3, -0.5] as const, [-2.5, 5] as const, [-1.0, 10] as const, [0.5, 17] as const];
const terrain: VillageTerrainSpec = {
  size: [24, 32], cells: [48, 64], base: 1.4, water: 0.4, skirtDepth: 2.2,
  outline: [[-11.5, -15.5], [11, -15.5], [11.5, -5], [11.5, 12], [8, 15.5], [-8, 15.5], [-11.5, 11]],
  features: [
    { kind: 'plateau', polygon: [[-12, -16], [-2.6, -16], [-2.6, -9.5], [-5.2, -9.0], [-5.2, -7.0], [-4.4, -6.5], [-4.4, 16], [-12, 16]], height: 3.0, skirt: 1.0 },
    // Low quay at the foot of the west bank, where the wheel stands over the water.
    { kind: 'cut', polygon: [[-4.4, -8], [0.8, -8], [0.8, 2.4], [-4.4, 2.4]], depth: 0.8, skirt: 0.6 },
    // The eastern meadow falls gently toward the front.
    { kind: 'cut', polygon: [[-1, 2.5], [12, 2.5], [12, 16], [-1, 16]], depth: 1.0, skirt: 1.0 },
    { kind: 'hole', polygon: ribbon(river, 3.0) },
    { kind: 'paint', polygon: [[-4.4, -8], [0.8, -8], [0.8, 2.4], [-4.4, 2.4]], color: 0xa89f84 },
    { kind: 'paint', polygon: [[7.4, 4.6], [11, 4.6], [11, 10.2], [7.4, 10.2]], color: 0xb3a784 },
  ],
  palette: { grass: 0x88956c, grassAlt: 0x97a478, rock: 0x8c8a74, shore: 0xc4b58c, water: 0x4f8f9d, cliff: 0x6b7560 },
};
const { at } = groundOf(terrain);
const beats = schedule(0.8, [[1.6, 0.6], [1.2, 0.5], [1.0, 0.3], [3.0, 0.3], [1.0, 1.6], [1.4, 0.3], [1.5, 0.3], [1.6, 0.3], [1.3, 0.3], [2.2, 0]]);
const oak = 0xa47a4e;
const TIMBER_FLOOR = 0.3 + 0.14;
/** Trestle tops just under the aqueduct floor at the given x positions. */
const aqueductTop = 4.05, aqueductDrop = -0.57, aqueductStart = -3.9, aqueductEnd = 1.9; // (hyp) climbs 0.57
const trestle = (x: number): VillageVec3 => [x, aqueductTop - aqueductDrop * (x - aqueductStart) / (aqueductEnd - aqueductStart) - TIMBER_FLOOR - 0.03, 2.0];
// ---- Rest-height ledger (hyp) -------------------------------------------------
/** Wheel hold: anchor y 1.75 + 2 * radius 1.5, plus retainedX sin(.22) for retainedX in
 * [-.25, .05]; the midpoint stands in until the compiled hold replaces it. */
const WHEEL_HOLD = 4.73;
/** Crest arrival target 0.5 m/s at the trip: H - y_trip = 1.4 * .5^2 / (2 * 9.81). */
const ROCKER_HEAD = 1.4 * .25 / (2 * 9.81);
const SLUICE_TRIP = WHEEL_HOLD - ROCKER_HEAD;
/** Ledger: a 0.35 rad rocker leaves H = y_trip - 0.063 (measured exits at 0.5 m/s). */
const SLUICE_EXIT_H = SLUICE_TRIP - .063;
/** A timber mount under an unbanked frame: the world-aligned .18 x 1.1 m cap stays below
 * that frame's underside plane at every corner of its footprint. */
function timberMount(frame: VillagePort): VillageVec3 {
  const [nx, ny, nz] = frame.normal;
  return [frame.position[0] - nx * TIMBER_FLOOR, frame.position[1] - ny * TIMBER_FLOOR - (0.09 * Math.abs(nx) + 0.55 * Math.abs(nz)) / ny - 0.012,
    frame.position[2] - nz * TIMBER_FLOOR];
}
/** Roof flume: the original grade (0.2 over 2.8 m) from the wheel side at x -1.1. */
const roofY = (x: number) => 4.5 - 0.2 / 2.8 * (-1.1 - x);
const ROOF_END = -4.7, ROOF_POST = -4.6;
/** Fixed deck grade shared by held carriers (the first-three declaration). */
const DECK_PITCH = -.18;
/** The sluice hinge drops .06 to clear the deeper timber deck (its .09 axle under the
 * .44 deep underside). The same body keeps its declared COM, mass and central inertia,
 * so its inertia about the moved hinge follows the parallel-axis rule, not a new value. */
const SLUICE_PIVOT = [-0.8, -0.56, 0] as const;
const SLUICE_BODY = { mass: .012, centre: [0, -.50] as const, hingeInertia: .0104, hinge: [-0.8, -0.5] as const };
const SLUICE_CENTRAL = SLUICE_BODY.hingeInertia - SLUICE_BODY.mass * ((SLUICE_BODY.centre[0] - SLUICE_BODY.hinge[0]) ** 2 + (SLUICE_BODY.centre[1] - SLUICE_BODY.hinge[1]) ** 2);
const SLUICE_HINGE_INERTIA = SLUICE_CENTRAL + SLUICE_BODY.mass * ((SLUICE_BODY.centre[0] - SLUICE_PIVOT[0]) ** 2 + (SLUICE_BODY.centre[1] - SLUICE_PIVOT[1]) ** 2);

/** The cart starts held at localX -.25 on its pitched deck and carries horizontally. */
const CART_HOLD = 4.1 + .25 * Math.sin(-DECK_PITCH);
/** Bank ceiling for the race's landing corner onto the paddle. At about 5.8 m/s on a
 * 1.4 m radius the cone needs mu ~0.41 at 45 degrees (hand); the existing rolling check
 * judges it. 45 degrees still reads as a millrace sweeping round onto the quay, not a wall. */
const QUAY_BANK_CAP = 45 * Math.PI / 180;
/** Bank ceiling for the descending race turn (about 2.6 m/s, 1.1 m radius). */
const RACE_BANK_CAP = 25 * Math.PI / 180;
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
/** Horizontal arc (author `turn` basis: +x, -z, world up) at explicit parameters. */
function arcAt(center: VillageVec3, radius: number, start: number, sweep: number, rise: number): Curve {
  return parameters => parameters.map(t => {
    const angle = start + sweep * t, c = Math.cos(angle), s = Math.sin(angle);
    const tx = -radius * sweep * s, ty = rise, tz = -radius * sweep * c, tl = Math.hypot(tx, ty, tz);
    const x = tx / tl, y = ty / tl, z = tz / tl, nx = -x * y, ny = 1 - y * y, nz = -z * y, nl = Math.hypot(nx, ny, nz);
    return villagePort([center[0] + radius * c, center[1] + rise * t, center[2] - radius * s], [x, y, z], [nx / nl, ny / nl, nz / nl]);
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
/** Bank one constant-radius turn toward its centre from the ledger speed, capped at
 * `cap` (UX ceiling), level at both ends so successive hairpins meet unbanked at their
 * inflection. Positions and tangents are unchanged; the rolling cone judges the rest. */
function bankedTurn(points: readonly VillagePort[], centre: VillageVec3, radius: number, H: number, cap: number, ramp = .2, parameters?: readonly number[]): readonly VillagePort[] {
  return points.map((point, i) => {
    // The fade follows the curve parameter, not the frame index, so refinement cannot move it.
    const u = parameters?.[i] ?? i / (points.length - 1), fade = Math.min(1, u / ramp, (1 - u) / ramp), eased = fade * fade * (3 - 2 * fade);
    const v2 = 2 * 9.81 * Math.max(0, H - point.position[1]) / 1.4;
    const bank = Math.min(cap, Math.atan(v2 / (radius * 9.81))) * eased;
    const [tx, ty, tz] = point.tangent, [nx, ny, nz] = point.normal;
    let ix = centre[0] - point.position[0], iz = centre[2] - point.position[2];
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
/** (hyp) Meadow hairpins: 15 degree ceiling; required floor ratio ~0.47 at 3 m/s (hand). */
const HAIRPIN_BANK_CAP = 15 * Math.PI / 180;
const bankFirst: VillageVec3 = [4.8, 4.0, 3.1], bankSecond: VillageVec3 = [4.8, 3.9, 5.3];
const sBank = join(refined(parameters => bankedTurn(arcAt(bankFirst, 1.1, Math.PI / 2, -Math.PI, -0.1)(parameters), bankFirst, 1.1, SLUICE_EXIT_H, HAIRPIN_BANK_CAP, .2, parameters), asIs, 32),
  refined(parameters => bankedTurn(arcAt(bankSecond, 1.1, Math.PI / 2, Math.PI, -0.1)(parameters), bankSecond, 1.1, SLUICE_EXIT_H, HAIRPIN_BANK_CAP, .2, parameters), asIs, 32));
// Physical-authoring proposal; shared-api-request.md in output/current/village-layouts/first3-motion-staging records blockers.
// Story beats remain camera ordering metadata; none of these values sets a playback duration.
const stations = [
  // Cart rolls along the bank-top rails before tipping into the race.
  station({ stop: 9, anchor: [-7.5, 4.1, -9.5], badge: [-8.1, 7.6, -9.2], mechanism: { kind: 'translating', travel: [1.6, 0, 0], deckPitch: -.18 }, beat: beats[0]!, color: oak }),
  // Millrace dives south along the quay's west side, from the bank top down to the quay.
  track(8, 'channel', straight([-3.9, 3.6, -8.3], [-3.9, 2.0, -4.4], 6), beats[1]!, [-1.7, 5.8, -8.9], oak),
  // Brake paddle on the quay.
  station({ stop: 7, anchor: [-1.9, 1.6, -3.0], badge: [-0.7, 3.2, -4.9], mechanism: { kind: 'striker', travel: 0.5 }, beat: beats[2]!, color: oak }),
  // The mill's own bucket wheel: its disc hangs out over the river and lifts the marble to the roof flume.
  station({ stop: 6, anchor: [0.3, 1.75, -3.0], badge: [2.8, 3.6, -3.6], mechanism: { kind: 'wheelbucket', radius: 1.5, angle: Math.PI, deckPitch: .22 }, beat: beats[3]!, color: oak,
    // The orbit hangs over water; connected rear trestles carry the axle from land.
    span: 'girder', supports: [[0.3, 2.76, -4.4], [0.3, 2.76, -5.5]] }),
  // Roof flume back west over the quay.
  // The flume runs on .8 m at the same grade so its far end lies over the west bank, where a
  // short post carries it. The old post at x -2.85 stood in the race's landing onto the
  // paddle, which runs beneath the flume on the same line, and there is no clear footing
  // over the quay. Same seat rule as before: the flume underside there, less .00755.
  track(5, 'channel', straight([-1.1, 4.5, -3.0], [ROOF_END, roofY(ROOF_END), -3.0], 4), beats[4]!, [-4.7, 6.05, -3.9], oak,
    { supports: [[ROOF_POST, roofY(ROOF_POST) - TIMBER_FLOOR - 0.00755, -3]] }),
  // Aqueduct across the river to the meadow, on bank trestles.
  track(4, 'channel', straight([aqueductStart, aqueductTop, 2.0], [aqueductEnd, aqueductTop - aqueductDrop, 2.0], 8), beats[5]!, [0.8, 4.25, 2.8], oak,
    { span: 'girder', supports: [trestle(-3.4), trestle(1.6)] }),
  // Sluice gate, raised to meet the crest at walking pace, tips the marble down onto the bank.
  // Its fixed hinge sits .06 lower than on plank, below the deeper timber deck's underside.
  station({ stop: 3, anchor: [3.4, SLUICE_TRIP, 2.0], badge: [4.6, 6.0, 1.0], mechanism: { kind: 'tipping', pivot: SLUICE_PIVOT, axis: [0, 0, 1], angle: -0.35 }, beat: beats[6]!, color: oak }),
  // S bank: two banked hairpins on low trestles over the meadow, like the river beside them.
  track(2, 'arc', sBank, beats[7]!, [2.2, 3.5, 5.2], oak, { anchor: [4.8, at(4.8, 4.2), 4.2] }),
  // Sack trolley: catches the marble off the bank and hauls it across to the hoist.
  station({ stop: 1, anchor: [6.187, 3.607, 6.4], badge: [8.2, 3.85, 6.1], mechanism: { kind: 'translating', travel: [0.7, 0, 0], deckPitch: DECK_PITCH }, beat: beats[8]!, color: oak }),
  // Sack hoist in front of the granary lifts the load into the loft.
  station({ stop: 0, anchor: [9.5, 3.27, 6.4], badge: [4.3, 4.85, 7.2], mechanism: { kind: 'suspended', travel: [0, 1.6, 0] }, beat: beats[9]!, color: oak }),
].map(station => station.stop === 9 ? { ...station,
  initialCargo: { localX: -.25 }, retention: {
    marbleMass: .02, headMass: .001, brakeForce: 5, captureStart: -.25, captureStroke: .3,
    bodyMass: .08, bodyInertia: 0, rotorInertia: 0, weightMass: .4, weightDrop: .8,
    acceleration: 3, gateSeconds: .22, gateMass: .003,
  },
} : station.stop === 7 ? { ...station, strikerDrive: {"kind":"pendulum","mass":0.001,"legacyGuideWork":{"friction":0.012,"stroke":0.5},"axle":{"origin":[-2.1999999999999997,3.2,-3],"axis":[0,0,1]},"bar":{"arm":1.6,"radius":0.04,"length":0.56,"facets":16},"stopAngle":0.7,"dress":"mill-paddle","footings":[{"x":-2.1999999999999997,"z":-3.65,"half":0.07000002861022947,"heights":[0.800000011920929,0.800000011920929,0.800000011920929,0.800000011920929]},{"x":-2.1999999999999997,"z":-2.35,"half":0.07000002861022947,"heights":[0.800000011920929,0.800000011920929,0.800000011920929,0.800000011920929]},{"x":-1.108652173877768,"z":-3.62,"half":0.07000002861022947,"heights":[0.800000011920929,0.800000011920929,0.800000011920929,0.800000011920929]}]} as const }
  : station.stop === 6 ? { ...station, retention: {
    marbleMass: .02, headMass: .001, brakeForce: 5, captureStart: -.25, captureStroke: .3,
    bodyMass: .08, bodyInertia: 0, rotorInertia: .024, weightMass: 1, weightDrop: .8,
    acceleration: 3, gateSeconds: .22, gateMass: .003,
  } }
  : station.stop === 3 ? { ...station, rollingDrive: {
    kind: 'contact-gravity' as const, marbleMass: .02, bodyMass: .012,
    bodyInertia: SLUICE_HINGE_INERTIA, bodyCentre: [0, -.50, 0] as const,
    tripX: -.55, bearingTorque: .0002,
    restitution: 0, traction: .8,
  } }
  // First-three held-carrier declaration, unchanged values. bodyCentre states the
  // carrier-frame COM the compiler previously assumed implicitly (pending the measured
  // inventory); pure translation has no driven axis, so central bodyInertia is 0.
  : station.stop === 1 ? { ...station, retention: {
    marbleMass: .02, headMass: .001, brakeForce: 5, captureStart: -.25, captureStroke: .3,
    bodyMass: .08, bodyCentre: [0, -.4, 0] as const, bodyInertia: 0, rotorInertia: 0, weightMass: .4, weightDrop: .8,
    acceleration: 3, gateSeconds: .22, gateMass: .003,
  } }
  : station.stop === 0 ? { ...station, retainAtEnd: true, retention: {
    marbleMass: .02, headMass: .001, brakeForce: 5, captureStart: -.25, captureStroke: .3,
    bodyMass: .08, bodyInertia: 0, rotorInertia: 0, weightMass: .4, weightDrop: .8,
    acceleration: 3, gateSeconds: .22, gateMass: .003,
  } } : station);
const [cart, race, paddle, wheel, flume, aqueduct, sluice, bank, spillway, hoist] = stations as [typeof stations[number], typeof stations[number], typeof stations[number], typeof stations[number], typeof stations[number], typeof stations[number], typeof stations[number], typeof stations[number], typeof stations[number], typeof stations[number]];
// The race lands on the quay at speed, round a corner banked toward its centre.
const landing = refined(bankedCrest(race.exit, paddle.entry, CART_HOLD, QUAY_BANK_CAP), asIs, 64);
// The flume turns through a half circle round the mill before it becomes the aqueduct.
const millTurn = villagePort([-6.4, 4.05, -0.5], [0, 0, 1], UP);
const connectors = [
  // The bank-top run turns down the race on a curvature-continuous splice, banked from
  // the cart's released ledger (H = cart hold), so the descending right turn keeps its grip.
  { from: cart.stop, to: race.stop, points: refined(bankedCrest(cart.exit, race.entry, CART_HOLD, RACE_BANK_CAP), asIs, 48) },
  // The race lands on the quay at speed: its turn onto the paddle is curvature-continuous
  // and banked from the cart's ledger, like a flume corner, so the floor keeps its grip. It is
  // carried at both ends, by the race's end support and the paddle frame: a world-aligned
  // timber cap anywhere along it meets the banked floor (run45/geometry8-11).
  { from: race.stop, to: paddle.stop, points: landing, supports: [] },
  // This short rigid splice is carried at both ends by the paddle frame and wheel bearing.
  connect(paddle, wheel, 0.25, 0.25, [0, 0], { supports: [] }),
  // The short upper splice is carried by the fixed wheel dock and roof flume; posts here cross the lower approach.
  connect(wheel, flume, 0.3, 0.3, [0, 0], { supports: [] }),
  connectVia(flume, aqueduct, [{ via: millTurn, out: 1.38, in: 1.38, steps: 32 }, { out: 1.38, in: 1.38, steps: 32 }]),
  // Crest off the climbing aqueduct into the raised sluice; arrival at walking pace.
  // It rests on the aqueduct's bank trestle and the sluice frame: automatic posts on so
  // short a splice would overlap the sluice's own.
  { from: aqueduct.stop, to: sluice.stop, points: crestFrames(aqueduct.exit, sluice.entry, 48), supports: [] },
  connect(sluice, bank, 0.3, 0.3),
  connect(bank, spillway, 0.3, 0.3),
  // Too short for two automatic supports (they would overlap): one timber mount mid-splice.
  ((link: VillageConnector) => ({ ...link, supports: [timberMount(link.points[Math.round((link.points.length - 1) / 2)]!)] }))(connect(spillway, hoist,
    (hoist.entry.position[0]-spillway.exit.position[0])/(3*spillway.exit.tangent[0]),
    (hoist.entry.position[0]-spillway.exit.position[0])/(3*hoist.entry.tangent[0]))),
];
const scenery = [
  piece('mill', [-3.9, at(-3.9, -0.5), -0.5], 0, 0.8), piece('warehouse', [9.4, at(9.4, 8.6), 8.6], 0, 0.9),
  piece('willow', [-6.5, at(-6.5, -5.5), -5.5], 0, 1.0), piece('willow', [-7.6, at(-7.6, 4.6), 4.6], 0.6, 1.1),
  piece('willow', [3.4, at(3.4, -8.2), -8.2], -0.4, 0.95), piece('willow', [-5.4, at(-5.4, 9.4), 9.4], 1.2, 1.0),
  piece('house-a', [6.6, at(6.6, -6.4), -6.4], 0.1, 1.0), piece('house-b', [-8.8, at(-8.8, -12.6), -12.6], -0.2, 1.0),
  piece('tree-a', [9.6, at(9.6, -11.0), -11.0], 0, 0.85), piece('tree-a', [1.8, at(1.8, 12.8), 12.8], 0, 0.8),
];
export const WILLOW_MILL: VillageScenePlan = {
  chapter: 2, construction: 'rise', terrain, scenery,
  plan: { chapter: 2, profile: 'timber', stations, connectors, camera: shots([0, 2.4, 0], [
    { at: 2.7, target: [-3.0, 2.8, -5.5], radius: 24 }, { at: 5.85, target: [-0.6, 3.0, -3.2], radius: 22 },
    { at: 10.9, target: [-2.4, 3.9, 0.4], radius: 24 }, { at: 15.25, target: [4.8, 2.6, 4.2], radius: 22 },
    { at: 18.75, target: [7.8, 2.6, 6.6], radius: 22 },
  ]) },
  workshop: workshopSite({ position: [8.7, at(8.7, 3.6), 3.6], scale: 1.1, yaw: -0.2 }, [9.6, at(8.7, 3.6) + 2.3, 4.8], { from: 2, to: 1 }),
  rewards: [{ project: 'tube-210', position: [-8.0, at(-8.0, 8.6), 8.6], yaw: 0 }],
  overview: [piece('mill', [-3.9, at(-3.9, -0.5), -0.5], 0, 1.1), piece('willow', [-6, at(-6, 5), 5], 0, 1.3), piece('house-b', [6, at(6, -5), -5], 0, 1.0)],
};
