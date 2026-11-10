import type { VillageScenePlan } from '../village-plans';
import type { VillageTerrainSpec } from '../village-terrain';
import { workshopSite } from '../workshop-building';
import { REST_ELEVATION, connect, groundOf, join, piece, schedule, shots, spiralBowl, station, straight, terminalRunout, track, turn } from './author';
import { villagePort, type VillagePort, type VillageConnector, type VillageVec3 } from '../village-plan';
import { villageChannelGeometry } from '../../view/machine-primitives';
import { validateVillagePort } from '../village-program';

/**
 * Glasshouse Gardens: three broad planted terraces stepping sideways, high on the
 * left and low on the right, with greenhouse rows along the rear and a reflecting
 * pool wrapping the fountain island at the front right. The marble waters its way
 * down the terraces: a hanging can, a pergola bend, a run down the high terrace,
 * a tilting trough, a rill back along the middle terrace, sliding cold-frame lids,
 * a second trough, then a right-hand half turn around a round bed in front of it.
 * A level westward rill turns left towards the pump and raised basin. The lower
 * switchback stays in front of the preceding stages instead of passing beneath them.
 */
const terrain: VillageTerrainSpec = {
  mergeFlatLand: true,
  mergePaintedFlatLand: true,
  size: [24, 32], cells: [18, 14], base: 1.4, water: 0.5, skirtDepth: 2.0,
  outline: [[-11, -15.5], [11, -15.5], [11.6, -8], [11.6, 10], [9, 15], [-9, 15], [-11.6, 10], [-11.6, -8]],
  features: [
    { kind: 'plateau', polygon: [[-12, -16], [-4 / 3, -16], [-4 / 3, 16], [-12, 16]], height: 4.2, skirt: 1.0 },
    { kind: 'plateau', polygon: [[-3.5, -16], [8 / 3, -16], [8 / 3, 16], [-3.5, 16]], height: 2.8, skirt: 1.0 },
    // The pool wraps the fountain island on its west and south sides.
    { kind: 'hole', polygon: [[4.4, 0.3], [7.4, 0.3], [7.4, 13.8], [4.4, 13.8]] },
    { kind: 'hole', polygon: [[7.4, 2.8], [10.8, 2.8], [10.8, 13.8], [7.4, 13.8]] },
    { kind: 'paint', polygon: [[-10.5, -14], [-4.5, -14], [-4.5, 14], [-10.5, 14]], color: 0x9fb07a },
    { kind: 'paint', polygon: [[-2.5, -14], [2.5, -14], [2.5, 14], [-2.5, 14]], color: 0xb79c74 },
    { kind: 'paint', polygon: [[3.6, -14], [10.8, -14], [10.8, -0.4], [3.6, -0.4]], color: 0x8aa267 },
    { kind: 'paint', polygon: [[7.4, -0.4], [10.8, -0.4], [10.8, 2.8], [7.4, 2.8]], color: 0xcfc39d },
  ],
  palette: { grass: 0x789773, grassAlt: 0x86a37f, rock: 0x8f8b76, shore: 0xcfc39d, water: 0x4d93a3, cliff: 0x6f7b66 },
};
const { at } = groundOf(terrain);
const beats = schedule(0.9, [[1.6, 0.4], [1.0, 1.8], [1.4, 0.7], [1.2, 0.7], [1.6, 0.3], [1.4, 0.3], [2.0, 0.3], [1.6, 0.7], [1.6, 0.3], [2.4, 0]]);
const clay = 0xc78a63;
// Crest hypotheses only; replace from the actual upstream rest-height ledger after P0 release.
const troughCrest = 5.72;
const secondTroughCrest = 3.71;
/** Fixed crest geometry with exact endpoint frames and zero endpoint second derivatives. */
function crestFrames(from: VillagePort, to: VillagePort, steps = 64, parameters?: readonly number[]): readonly VillagePort[] {
  const length = Math.hypot(to.position[0] - from.position[0], to.position[2] - from.position[2]);
  const aScale = length / Math.hypot(from.tangent[0], from.tangent[2]);
  const bScale = length / Math.hypot(to.tangent[0], to.tangent[2]);
  return (parameters ?? Array.from({ length: steps + 1 }, (_, i) => i / steps)).map(u => {
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
/** Fixed-dock planar dip/climb. The peak is fixed by the integrated grade area.
 * One reference pass preserves the existing quintic's interior x evaluation bits.
 * Endpoint objects remain the actual docks. Exported for narrow domain mutants. */
export function gradedCrest(from: VillagePort, to: VillagePort, inflection: number, steps = 64): readonly VillagePort[] {
  try { validateVillagePort(from); validateVillagePort(to); }
  catch { throw new Error('Graded crest requires valid planar unbanked docks'); }
  const run = to.position[0] - from.position[0], climb = to.position[1] - from.position[1];
  if (from.position[2] !== to.position[2] || from.tangent[2] !== 0 || to.tangent[2] !== 0
    || from.normal[2] !== 0 || to.normal[2] !== 0 || !(from.normal[1] > 0) || !(to.normal[1] > 0)
    || !(run > 0) || !(from.tangent[0] > 0) || !(to.tangent[0] > 0)
    || !(inflection > 0 && inflection < 1) || !Number.isInteger(steps) || steps < 2 || from.width !== to.width) {
    throw new Error('Graded crest needs forward unbanked docks on one x line and a valid inflection');
  }
  const slope0 = from.tangent[1] / from.tangent[0], slope1 = to.tangent[1] / to.tangent[0];
  const peak = 2 * climb / run - inflection * slope0 - (1 - inflection) * slope1;
  if (!Number.isFinite(peak) || !(peak > Math.max(slope0, slope1))) throw new Error('Graded crest needs a rising-then-falling grade');
  const original = crestFrames(from, to, steps);
  const ramp = (t: number) => t * t * (3 - 2 * t), area = (t: number) => t * t * t * (1 - t / 2);
  const sagRise = run * inflection * (slope0 + peak) / 2;
  return Array.from({ length: steps + 1 }, (_, i) => {
    if (i === 0) return from;
    if (i === steps) return to;
    const s = i / steps, sag = s <= inflection, t = sag ? s / inflection : (s - inflection) / (1 - inflection);
    const slope = sag ? slope0 + (peak - slope0) * ramp(t) : slope1 + (peak - slope1) * (1 - ramp(t));
    const y = from.position[1] + (sag ? run * (slope0 * s + (peak - slope0) * inflection * area(t))
      : sagRise + run * (1 - inflection) * (slope1 * t + (peak - slope1) * (t - area(t))));
    const norm = Math.hypot(1, slope), old = original[i]!;
    return villagePort([old.position[0], y, old.position[2]], [1 / norm, slope / norm, old.tangent[2]], [-slope / norm, 1 / norm, old.normal[2]], from.width);
  });
}

/**
 * A constant-radius quarter whose grade falls monotonically over its whole
 * horizontal arc, from the docked exit's height and slope to the level rill:
 * a cubic in arc length with zero height and slope at the rill. Its start slope
 * must lie between 1.5 and 3 secant slopes, so the grade never rises and the
 * floor sags everywhere (no crest to leave). Exported only for its own mutants.
 */
export function gradedQuarter(from: VillagePort, to: VillagePort): readonly VillagePort[] {
  const radius = from.position[2] - to.position[2], drop = from.position[1] - to.position[1], length = radius * Math.PI / 2;
  const slope0 = from.tangent[1] / Math.hypot(from.tangent[0], from.tangent[2]), ratio = -slope0 * length / drop;
  if (!(radius > 0) || !(drop > 0) || !(ratio >= 1.5 && ratio <= 3)) throw new Error('Graded quarter needs a falling, sagging monotone cubic');
  return turn([from.position[0], from.position[1], to.position[2]], radius, -Math.PI / 2, Math.PI / 2, 0, 64).map((point, i) => {
    const u = i / 64, w = 1 - u;
    const y = to.position[1] + w * w * (drop * (1 + 2 * u) + slope0 * length * u);
    const slope = slope0 * w * (1 - 3 * u) - 6 * drop * u * w / length, norm = Math.hypot(1, slope);
    const x = point.tangent[0], z = point.tangent[2];
    return villagePort([point.position[0], y, point.position[2]], [x / norm, slope / norm, z / norm], [-x * slope / norm, 1 / norm, -z * slope / norm]);
  });
}
/** Broad constant-radius pump approach; the vertical profile matches the actual inlet grade. */
function pumpQuarter(from: VillagePort, to: VillagePort): readonly VillagePort[] {
  const radius = to.position[2] - from.position[2], length = radius * Math.PI / 2;
  const drop = from.position[1] - to.position[1], slope1 = to.tangent[1] / Math.hypot(to.tangent[0], to.tangent[2]);
  // Integrate a monotone grade ramp with zero grade derivative at both docks.
  const power = -2 * length * slope1 / drop - 2;
  return turn([to.position[0], from.position[1], from.position[2]], radius, Math.PI, Math.PI / 2, 0, 96).map((point, i) => {
    const u = i / 96;
    const y = from.position[1] + length * slope1 * (u ** (power + 1) - power / (power + 2) * u ** (power + 2));
    const slope = slope1 * u ** power * (power + 1 - power * u), norm = Math.hypot(1, slope);
    const x = point.tangent[0], z = point.tangent[2];
    return villagePort([point.position[0], y, point.position[2]], [x / norm, slope / norm, z / norm], [-x * slope / norm, 1 / norm, -z * slope / norm]);
  });
}
/**
 * Banking belongs to the fixed trough surface; both dock frames stay unchanged.
 * `exitLift` c (fair ramp only, 0 < c <= 10) adds c*r^2*(1-r)^3 where the exit fade
 * r = (1-u)/.15 is selected: the weight stays monotone, with F(0) = 0, F(1) = 1 and zero end
 * slopes. The default 0 leaves every other call's float operations unchanged.
 */
function bankBend(link: VillageConnector, angle: number, late = true, steady = false, parameter?: (index: number) => number, exitLift = 0): VillageConnector {
  if (exitLift !== 0 && (late || steady || !(exitLift > 0 && exitLift <= 10))) throw new Error('Exit lift needs the fair ramp and 0 < c <= 10');
  return { ...link, points: link.points.map((point, i) => {
    const u = parameter?.(i) ?? i / (link.points.length - 1), ramp = Math.min(1, u / .2, (1 - u) / .15);
    const fair = ramp ** 3 * (10 - 15 * ramp + 6 * ramp * ramp);
    const shaped = exitLift !== 0 && (1 - u) / .15 < Math.min(1, u / .2) ? fair + exitLift * ramp ** 2 * (1 - ramp) ** 3 : fair;
    const a = angle * (steady ? 1 : late ? u ** 8 * (1 - u) ** 2 / (.8 ** 8 * .2 ** 2) : shaped);
    const c = Math.cos(a), s = Math.sin(a), [x, y, z] = point.tangent, [nx, ny, nz] = point.normal;
    return { ...point, normal: [nx * c + (y * nz - z * ny) * s,
      ny * c + (z * nx - x * nz) * s, nz * c + (x * ny - y * nx) * s] as const };
  }) };
}
/**
 * One flat-topped .38 m splice post at the chord midpoint between the actual
 * docks of a connector that runs along one z line. Its top is the lowest point
 * of the connector's rendered surface over the post footprint, rounded down to
 * a stored float, so the top meets and never enters the underside. Footing,
 * clearance and the rendered box's own rounding remain scene proofs. Exported
 * only for its own mutants.
 */
export function splicePost(points: readonly VillagePort[]): VillageVec3 {
  const first = points[0]!.position, last = points[points.length - 1]!.position, half = .19;
  if (first[2] !== last[2] || points.some(p => p.position[2] < first[2] - .5 || p.position[2] > first[2] + .5)) throw new Error('Splice post needs a connector along one line');
  const x = (first[0] + last[0]) / 2, z = first[2];
  const geometry = villageChannelGeometry(points, 'terracotta'), position = geometry.getAttribute('position'), index = geometry.getIndex()!;
  let top = Infinity;
  for (let i = 0; i < index.count; i += 3) {
    let polygon = [0, 1, 2].map(k => [position.getX(index.getX(i + k)), position.getY(index.getX(i + k)), position.getZ(index.getX(i + k))] as const);
    for (const [axis, limit, sign] of [[0, x - half, 1], [0, x + half, -1], [2, z - half, 1], [2, z + half, -1]] as const) {
      const kept: (readonly [number, number, number])[] = [];
      polygon.forEach((a, j) => {
        const b = polygon[(j + 1) % polygon.length]!, da = (a[axis] - limit) * sign, db = (b[axis] - limit) * sign;
        if (da >= 0) kept.push(a);
        if ((da >= 0) !== (db >= 0)) { const t = da / (da - db); kept.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]); }
      });
      polygon = kept;
    }
    for (const p of polygon) top = Math.min(top, p[1]);
  }
  geometry.dispose();
  if (!Number.isFinite(top)) throw new Error('Splice post has no rendered connector above it');
  const stored = new Float32Array([top]), bits = new Uint32Array(stored.buffer);
  if (stored[0]! > top) bits[0] = stored[0]! > 0 ? bits[0]! - 1 : bits[0]! + 1;
  return [x, stored[0]!, z];
}
const firstTrough = station({ stop: 7, anchor: [-4.8, troughCrest, -1.0], badge: [-5.5, 8.45, -0.5], mechanism: { kind: 'tipping', pivot: [0.1, -0.5, 0], axis: [0, 0, 1], angle: -0.35 }, beat: beats[2]!, color: clay });
const pumpStation = station({ stop: 1, anchor: [7.7, 2.2, -1.0], badge: [3.3, 3.7, 0.2], mechanism: { kind: 'translating', travel: [0, 1.3, 0], deckPitch: -.18 }, beat: beats[8]!, color: clay });
const upperRillX = firstTrough.exit.position[0] + 1.4;
// Passive forward fold: both banks follow the actual upstream rolling energy.
const bedRadius = 1.2;
const bedLegZ = -7 + 2 * bedRadius;
// Preserve the original compiled pump approach's positions, tangents, widths, bank amplitude,
// entry ramp, plateau and both end frames bit for bit. Its reference dock comes from the former
// crest's actual final frame, including its round-off. Pump90: only the exit-fade normals
// (frames 82-95) take the lifted fade c = 6, so the actual 2->1 cone holds at vertices 90-94.
const pumpDockReference = crestFrames(villagePort([6, 2.55, -7.4], [0, 0, 1]),
  villagePort([pumpStation.entry.position[0] - 2.4, 2.55, pumpStation.entry.position[2] - 2.4], [0, 0, 1]), 1)[1]!;
const pumpApproach = bankBend({ from: 2, to: pumpStation.stop, points: pumpQuarter(pumpDockReference, pumpStation.entry) }, -.08, false, false, undefined, 6);
const pumpRejoin = pumpApproach.points[0]!;
const returnRadius = pumpRejoin.position[2] - bedLegZ;
if (returnRadius < 1) throw new Error('Forward return needs a full-width bend of radius at least one metre');
/** Right-hand half turn; the actual 0.4 m fall settles to level at both docks. */
function forwardBed(): readonly VillagePort[] {
  const length = Math.PI * bedRadius;
  const points = turn([7.5, 2.95, -7 + bedRadius], bedRadius, Math.PI / 2, -Math.PI, 0, 64).map((point, i) => {
    const u = i / 64, slope = -.4 * 6 * u * (1 - u) / length, norm = Math.hypot(1, slope);
    const [x, , z] = point.tangent;
    return villagePort([point.position[0], 2.95 - .4 * (3 * u * u - 2 * u * u * u), point.position[2]],
      [x / norm, slope / norm, z / norm], [-x * slope / norm, 1 / norm, -z * slope / norm]);
  });
  return bankBend({ from: 3, to: 2, points }, .35, false, true).points;
}
// The westward half-metre before this rill remains a real 3->2 connector.
const returnBendStart = villagePort([pumpRejoin.position[0] + returnRadius, 2.55, bedLegZ], [-1, 0, 0]);
/** Preserve every original frame and refine only the rising bank's twisted facets. */
function returnBankParameters(): readonly number[] {
  const angleAt = (u: number) => {
    const r = Math.min(1, u / .2, (1 - u) / .15);
    return .40 * r ** 3 * (10 - 15 * r + 6 * r * r);
  };
  const result = [0];
  for (let i = 0; i < 72; i++) {
    const a = i / 72, b = (i + 1) / 72, start = angleAt(a), end = angleAt(b);
    const parts = a < .2 ? Math.max(1, Math.ceil(Math.abs(end - start) / .010)) : 1;
    for (let part = 1; part < parts; part++) {
      const angle = start + (end - start) * part / parts;
      let low = a, high = b;
      for (let iteration = 0; iteration < 40; iteration++) {
        const middle = (low + high) / 2;
        if (angleAt(middle) < angle) low = middle; else high = middle;
      }
      result.push((low + high) / 2);
    }
    result.push(b);
  }
  return result;
}
const returnParameters = returnBankParameters();
const returnWest = returnParameters.filter(u => u <= 1 / 9).map(u => villagePort([
  7 + (returnBendStart.position[0] - 7) * u * 9, 2.55, bedLegZ,
], [-1, 0, 0]));
const returnCurve = crestFrames(returnBendStart, pumpRejoin, 64,
  returnParameters.filter(u => u >= 1 / 9).map(u => (u - 1 / 9) * 9 / 8));
const bankedReturnRill = bankBend({ from: 2, to: 1, points: join(returnWest, returnCurve) }, -.40, false, false,
  i => returnParameters[i]!).points;
const returnRill = [...bankedReturnRill.slice(0, -1), pumpRejoin];
// A level rill can bear directly on the full .38 m post top, inside its .64 m
// flat underside. Preserve both mounts while avoiding a redundant broad cap.
function levelRillSupports(points: readonly VillagePort[]) {
  return [.15, .85].map(fraction => {
    const frame = points[Math.round(fraction * (points.length - 1))]!;
    if (frame.normal[0] !== 0 || frame.normal[1] !== 1 || frame.normal[2] !== 0) throw new Error('Level rill mount requires a horizontal underside');
    return [frame.position[0], Math.fround(frame.position[1] - .4), frame.position[2]] as const;
  });
}
const upperRill = straight([upperRillX, 5.0, -2.4], [upperRillX, 5.0, -5.6], 24);
// Keep the rim and entrance; unwind the last stretch onto the damper's straight
// receiving pad. Its two original mounts remain at their original frame indices.
const basinSpiral = spiralBowl([9.6, 3.45, 0.5], 1.5, 0.7, Math.PI / 2, -1, 0.9, .50);
const basinLap = basinSpiral.slice(0, -14);
const basinRunout = terminalRunout(basinLap.at(-1)!, {
  previous: basinLap.at(-2)!, easement: .4, pad: .35, steps: 17,
});
const basinTrack = [...basinLap, ...basinRunout.slice(1)];
// The binding neighbour is rim post 5's brace arm (east face x=4.3867, y 5.48-5.58,
// across the weight's whole z band); the leaf arm's sweep (x=4.118) lies further
// west (gardens-source77). The weight's west face clears the post by .107 and the
// guide stands on the flat low-terrace cell as the beam's column.
const LIDS_SOURCE_MOUNT = { x: 2.01, guide: 'grounded' as const };
// Physical-authoring proposal; shared-api-request.md in output/current/village-layouts/first3-motion-staging records blockers.
// Story beats remain camera ordering metadata; none of these values sets a playback duration.
const stations = [
  // Watering can hung from the pergola rail: slides along and dips before it pours.
  station({ stop: 9, anchor: [-9.4, 6.2, -9.5], badge: [-9.2, 9.4, -9.5], mechanism: { kind: 'suspended', travel: [1.4, -0.5, 0], deckPitch: -.18 }, beat: beats[0]!, color: clay }),
  // Pergola bend: a right-hand quarter that turns the marble down the high terrace.
  track(8, 'arc', turn([-5.8, 5.5, -7.7], 1.8, Math.PI / 2, -Math.PI / 2, -0.3), beats[1]!, [-3.0, 7.6, -8.6], clay),
  // First tilting trough at the foot of the high-terrace arm, pouring onto the middle terrace.
  firstTrough,
  // Rill back along the middle terrace.
  track(6, 'channel', upperRill, beats[3]!, [-0.30, 3.4, -3.74], clay, { supports: levelRillSupports(upperRill) }),
  // Gang of cold-frame lids: the loaded lid slides sideways under its counterweight.
  station({ stop: 5, anchor: [2.674, 3.7, -7.0], badge: [1.42, 9.05, -4.88], mechanism: { kind: 'translating', travel: [.7, 0, 0], deckPitch: -.18 }, beat: beats[4]!, color: clay }),
  // Second trough steps down to the low terrace. Its anchor sits .5 upstream of
  // the old one, at the same crest height, so the raised docked exit has a full
  // metre of run to fall to the bed entry.
  station({ stop: 4, anchor: [5.5, secondTroughCrest, -7.0], badge: [5.43, 7.55, -12.97], mechanism: { kind: 'tipping', pivot: [0.1, -0.5, 0], axis: [0, 0, 1], angle: -0.35 }, beat: beats[5]!, color: clay }),
  // Round bed in front of the second trough: half a turn right, leaving west.
  { ...track(3, 'arc', forwardBed(), beats[6]!, [9.1, 5.6, -9.8], clay), channelLip: { side: 'negative' as const, minimumHeight: .17, envelopes: [
    { startFrame: 41, fullStartFrame: 49, fullEndFrame: 56, endFrame: 64 },
    { startFrame: 42, fullStartFrame: 50, fullEndFrame: 56, endFrame: 64 },
  ] } },
  // Level westward rill turns left into the unchanged pump approach.
  track(2, 'channel', returnRill, beats[7]!, [12.0, 3.9, -3.85], clay),
  // Pump: the plunger lifts the marble to the fountain head as its weight drops.
  pumpStation,
  // The final straight shares one frame with its head and guide. The extra post
  // meets the measured underside of its bearing cap, rather than the floor.
  { ...track(0, 'bowl', basinTrack, beats[9]!, [10.4, 4.15, 2.66], clay, {
    anchor: [9.6, 1.4, 0.5], supports: [[9.217281647919437, 2.08842396736145, -0.18514588559971626]],
  }), supportIndices: [34, 62], channelLip: { side: 'negative' as const, minimumHeight: .17, envelopes: [
    { startFrame: 23, fullStartFrame: 31, fullEndFrame: 37, endFrame: 45 },
    { startFrame: 26, fullStartFrame: 34, fullEndFrame: 41, endFrame: 49 },
    { startFrame: 29, fullStartFrame: 37, fullEndFrame: 44, endFrame: 52 },
    { startFrame: 38, fullStartFrame: 46, fullEndFrame: 54, endFrame: 62 },
    { startFrame: 41, fullStartFrame: 49, fullEndFrame: 57, endFrame: 65 },
    { startFrame: 44, fullStartFrame: 52, fullEndFrame: 60, endFrame: 68 },
    { startFrame: 23, fullStartFrame: 31, fullEndFrame: 38, endFrame: 46 },
    { startFrame: 41, fullStartFrame: 49, fullEndFrame: 58, endFrame: 66 },
  ] } },
].map(station => station.stop === 9 ? { ...station,
  initialCargo: { localX: -.25 }, retention: {
    marbleMass: .02, headMass: .001, brakeForce: 5, captureStart: -.25, captureStroke: .3,
    bodyMass: .08, bodyInertia: 0, rotorInertia: 0, weightMass: .4, weightDrop: .8,
    acceleration: 3, gateSeconds: .22, gateMass: .003,
  },
} : [7, 4].includes(station.stop) ? { ...station, hinge:'outboard-journal' as const,rollingDrive: {
    kind:'contact-gravity-rocker' as const,marbleMass:.02,bodyMass:.012,
    bodyCentre:[0,-.46,0] as const,centralInertia:.0027008,bearingTorque:.0002,
    restitution:0 as const,traction:.8,homeSeat:{lever:.12},dockSeat:{lever:.12},
  } }
  : [5, 1].includes(station.stop) ? { ...station, ...(station.stop === 5 ? { sourceMount: LIDS_SOURCE_MOUNT } : {}), retention: {
    opening: 'captive-leaf' as const,
    marbleMass: .02, headMass: .001, brakeForce: 5, captureStart: -.25, captureStroke: .3,
    bodyMass: .08, bodyInertia: 0, rotorInertia: 0, weightMass: .4, weightDrop: .8,
    acceleration: 3, gateSeconds: .22, gateMass: .003,
  } }
  : station.stop === 0 ? { ...station, terminalCapture: { marbleMass: .02, headMass: .001, brakeForce: 2, lead: .35, availableStroke: .3 } } : station);
const [can, pergola, trough, rill, lids, trough2, bed, steps, pump, basin] = stations as [typeof stations[number], typeof stations[number], typeof stations[number], typeof stations[number], typeof stations[number], typeof stations[number], typeof stations[number], typeof stations[number], typeof stations[number], typeof stations[number]];
// High-terrace arm: straight south from the pergola, then a left quarter into the trough.
const highBend = turn([-6.80, 5.30, -2.4], 1.4, Math.PI, Math.PI / 2, 0, 48);
const highLead = connect(pergola, { ...trough, entry: highBend[0]! }, 1.8, 1.8);
const lidBend = turn([rill.exit.position[0] + 1.4, 5.0, -5.6], 1.4, Math.PI, -Math.PI / 2, 0, 48);
// Fixed docks and65 rings; the selected early inflection keeps the finite underside unfolded.
const lidsToTrough = gradedCrest(lids.exit, trough2.entry, .2);
/** The docked exit falls to the level, banked bed entry along one line. Handles of
 * a third of the run each keep the run linear in the curve parameter, so the
 * height is the cubic grade between the two actual slopes. */
const bedRun = bed.entry.position[0] - trough2.exit.position[0];
if (trough2.exit.position[2] !== bed.entry.position[2] || trough2.exit.tangent[2] !== 0 || !(bedRun > 0)) throw new Error('Bed lead must run straight downstream along one line');
const troughToBed = connect(trough2, bed, bedRun / (3 * trough2.exit.tangent[0]), bedRun / 3);
const connectors: readonly VillageConnector[] = [
  connect(can, pergola, 0.5, 0.5),
  { ...highLead, points: join(highLead.points, highBend, crestFrames(highBend[highBend.length - 1]!, trough.entry)) },
  { from: trough.stop, to: rill.stop, points: gradedQuarter(trough.exit, rill.entry) },
  { from: rill.stop, to: lids.stop, points: join(lidBend, crestFrames(lidBend[lidBend.length - 1]!, lids.entry, 96)) },
  // One post per short splice. Each flat top meets the lowest rendered underside
  // over its footprint; paired automatic feet overlapped each other or the hinge post.
  { from: lids.stop, to: trough2.stop, points: lidsToTrough, supports: [splicePost(lidsToTrough)] },
  { ...troughToBed, supports: [splicePost(troughToBed.points)] },
  connect(bed, steps, 0.15, 0.15, [0, 0], { supports: [[7.250000000000001, 2.072242259979248, -4.530356744962561]] }),
  pumpApproach,
  connect(pump, basin, 0.3, 0.3),
];
const scenery = [
  piece('greenhouse', [-7.4, at(-7.4, -13.4), -13.4], 0, 1.0), piece('greenhouse', [4 / 3, at(4 / 3, -13.6), -13.6], 0, 0.9),
  piece('greenhouse', [9.3, at(9.3, -13.4), -13.4], 0, 0.85),
  piece('house-b', [-8.6, at(-8.6, 2.0), 2.0], 0.2, 1.0), piece('house-a', [-7.4, at(-7.4, 11.0), 11.0], -0.15, 1.0),
  piece('tree-a', [-9.8, at(-9.8, -5.5) + .052 * .85, -5.5], 0, 0.85), piece('tree-a', [2.4, at(2.4, 6.5) + .052 * .8, 6.5], 0, 0.8),
  piece('tree-a', [-2.2, at(-2.2, 12.5) + .052 * .9, 12.5], 0, 0.9), piece('tree-a', [2.4, at(2.4, 11.0) + .052 * .75, 11.0], 0, 0.75),
];
export const GLASSHOUSE_GARDENS: VillageScenePlan = {
  chapter: 1, construction: 'drop', terrain, scenery,
  plan: { chapter: 1, profile: 'terracotta', stations, connectors, camera: shots([0, 2.6, 0], [
    { at: 2.7, target: [-5.0, 5.3, -8.0], radius: 22 }, { at: 4.8, target: [-3.6, 4.9, -2.6], radius: 22, elevation: REST_ELEVATION },
    { at: 7.45, target: [0.5, 3.9, -4.0], radius: 22, elevation: REST_ELEVATION }, { at: 11.45, target: [4.4, 3.5, -7.4], radius: 24 },
    { at: 15.45, target: [6.2, 2.6, -6.0], radius: 24 }, { at: 17.55, target: [8.4, 2.9, 0.0], radius: 22 },
  ]) },
  workshop: workshopSite({ position: [4 / 3, at(4 / 3, 3.2), 3.2], scale: 1.1, yaw: 0 }, [0.19, at(4 / 3, 3.2) + 2.3, 9.32], { from: 2, to: 1 }),
  rewards: [{ project: 'loop-210', position: [-6.8, at(-6.8, 5.6), 5.6], yaw: 0 }],
  overview: [piece('greenhouse', [-5, at(-5, -11), -11], 0, 1.2), piece('greenhouse', [1, at(1, -11), -11], 0, 1.1), piece('house-b', [-6, at(-6, 4), 4], 0, 1.1)],
};
