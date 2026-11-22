/**
 * Saltmere Pans (chapter 6): a flat working saltworks. A diagonal stone dike splits the
 * marsh into dark, low brine pans behind it and pale crystallising pans in front. The
 * marble follows the brine: a pin releases it down the sea-wall chute, it crosses the tide
 * trough and knocks the barrow-path swing gate, is caught and raised by the brine lift beside
 * the windpump, runs the long flume down the dike crest, sweeps round the Workshop, rolls
 * under the tide sluice and over the tide weighbridge, and rests at the tarred salt store.
 */
import type { VillageVec3 } from '../village-plan';
import type { VillageScenePlan, VillageSceneryPiece } from '../village-plans';
import type { TerrainFeature, TerrainVec2, VillageTerrainSpec } from '../village-terrain';
import { workshopSite } from '../workshop-building';
import { DEG, add, along, connect, groundOf, heading, piece, scale, schedule, shots, station, straight, track, turn } from './author';

/** Crest direction of the dike, from the windpump (back right) towards the front-left shore. */
const CREST_YAW = -142 * DEG;
const CREST = heading(CREST_YAW);
/** Horizontal left normal of the crest run: the salt side of the dike. */
const SALT_SIDE = heading(CREST_YAW + Math.PI / 2);

// ---- Route geometry (marble-centre frames) -------------------------------------------------
const BACK_ROW = -12.3, FRONT_ROW_RADIUS = 2.4;
const LIFT_ANCHOR: VillageVec3 = [6, 1.3, BACK_ROW];
const LIFT_TRAVEL: VillageVec3 = [0, 3.2, 0];
/** The windpump turn starts a lead's length past the lift's top dock. */
const WINDPUMP_TURN_START: VillageVec3 = [LIFT_ANCHOR[0] + .8 + .8, LIFT_ANCHOR[1] + LIFT_TRAVEL[1] - .05, BACK_ROW];
const WINDPUMP_TURN_RADIUS = 1.25;
const windpumpTurn = turn([WINDPUMP_TURN_START[0], WINDPUMP_TURN_START[1], BACK_ROW + WINDPUMP_TURN_RADIUS], WINDPUMP_TURN_RADIUS,
  Math.PI / 2, CREST_YAW, -.12, 40);
const crestStart = along(windpumpTurn.at(-1)!, .8, -.04);
const CREST_LENGTH = 14;
const crestEnd = add(crestStart, add(scale(CREST, CREST_LENGTH), [0, -.85, 0]));
const crestFlume = straight(crestStart, crestEnd, 14);
const uTurnStart = along(crestFlume.at(-1)!, .8, -.05);
const uTurnCentre = add(uTurnStart, scale(SALT_SIDE, FRONT_ROW_RADIUS));
const uTurn = turn(uTurnCentre, FRONT_ROW_RADIUS, CREST_YAW - Math.PI / 2, -CREST_YAW, -1.35, 48);
const FRONT_ROW = uTurn.at(-1)!.position[2];
const frontY = uTurn.at(-1)!.position[1];

/** Line of the dike crest in plan, extended shore to shore. */
const dikeAt = (s: number): TerrainVec2 => [crestStart[0] + CREST[0] * s, crestStart[2] + CREST[2] * s];
const DIKE_HALF_WIDTH = 1.25, DIKE_TOP = 2.2;
function dikeBand(from: number, to: number, half: number): TerrainVec2[] {
  const a = dikeAt(from), b = dikeAt(to), sx = SALT_SIDE[0] * half, sz = SALT_SIDE[2] * half;
  return [[a[0] + sx, a[1] + sz], [b[0] + sx, b[1] + sz], [b[0] - sx, b[1] - sz], [a[0] - sx, a[1] - sz]];
}
/** Signed plan distance to the crest line: positive on the salt (front) side. */
function saltSideDistance(x: number, z: number): number {
  return (x - crestStart[0]) * SALT_SIDE[0] + (z - crestStart[2]) * SALT_SIDE[2];
}

// ---- Terrain -------------------------------------------------------------------------------
const BRINE = 0x405b63, BRINE_MID = 0x5f7a78, DRY = 0xcdc2b9, DRIER = 0xc0afa7, STONE = 0x8c877a;
const rect = (x0: number, z0: number, x1: number, z1: number): TerrainVec2[] => [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
/** Keep the part of a convex polygon where a linear plan function is non-negative. */
function clip(polygon: readonly TerrainVec2[], keep: (x: number, z: number) => number): TerrainVec2[] {
  const out: TerrainVec2[] = [];
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length]!, fa = keep(a[0], a[1]), fb = keep(b[0], b[1]);
    if (fa >= 0) out.push(a);
    if (fa * fb < 0) { const t = fa / (fa - fb); out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]); }
  });
  return out;
}
const area = (polygon: readonly TerrainVec2[]) => Math.abs(polygon.reduce((sum, a, i) => {
  const b = polygon[(i + 1) % polygon.length]!; return sum + a[0] * b[1] - b[0] * a[1]; }, 0)) / 2;
/**
 * Pans keep a dry walking bund between them and abut the dike along its diagonal, so the grid
 * reads as a working saltworks at map scale. `side` is +1 for the salt side, −1 for the brine side.
 */
function pans(xs: readonly number[], zs: readonly number[], side: 1 | -1,
  shade: (column: number, row: number) => number, depth?: number): TerrainFeature[] {
  const features: TerrainFeature[] = [];
  for (let column = 0; column + 1 < xs.length; column++) for (let row = 0; row + 1 < zs.length; row++) {
    const x0 = xs[column]! + .25, x1 = xs[column + 1]! - .25, z0 = zs[row]! + .25, z1 = zs[row + 1]! - .25;
    if (![[x0, z0], [x1, z0], [x0, z1], [x1, z1]].every(([x, z]) => inland(x!, z!))) continue;
    const polygon = clip(rect(x0, z0, x1, z1), (x, z) => side * saltSideDistance(x, z) - (DIKE_HALF_WIDTH + PAN_BUND));
    if (polygon.length < 3 || area(polygon) < 2.5) continue;
    if (depth !== undefined) features.push({ kind: 'cut', polygon, depth });
    // Carry the paint under the dike toe. The surface finish draws the diagonal edge inside this overlap.
    const paint = clip(rect(x0, z0, x1, z1), (x, z) => side * saltSideDistance(x, z) - DIKE_HALF_WIDTH);
    features.push({ kind: 'paint', polygon: paint, color: shade(column, row) });
  }
  return features;
}
const outline: TerrainVec2[] = [
  [-14.5,-12.5],[-12,-15.2],[-5,-15.8],[3,-15.6],[10,-15.3],[14,-12.8],[15,-6],[15,3],[14.6,9.5],
  [11.5,14.4],[4,15.6],[-4,15.5],[-11,14.6],[-14.6,10.5],[-15.2,2],[-15.2,-6],
];
/** The tide enters through a broad notch in the north-west shore, beside the brine house and clear of every foundation. */
const INTAKE: TerrainVec2[] = [[-16, -9.3], [-12.6, -8.9], [-11.3, -7.9], [-11.1, -6.9], [-12.6, -5.9], [-16, -5.5]];
function edgeDistance(polygon: readonly TerrainVec2[], x: number, z: number): number {
  let best = Infinity;
  polygon.forEach((a, i) => {
    const b = polygon[(i + 1) % polygon.length]!, dx = b[0] - a[0], dz = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz)));
    best = Math.min(best, Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz));
  });
  return best;
}
/** Pans stop well short of the tidal bank: the beach and the intake keep their own grade. */
const inland = (x: number, z: number) => Math.min(edgeDistance(outline, x, z), edgeDistance(INTAKE, x, z)) > 2.4;
/** Pans start just past the dike's rock flank (half width plus a 0.9 skirt). */
const PAN_BUND = 1.25;
export const SALTMERE_DIKE = { origin: dikeAt(0), normal: [SALT_SIDE[0], SALT_SIDE[2]], halfWidth: DIKE_HALF_WIDTH, toe: DIKE_HALF_WIDTH + PAN_BUND } as const;
const BRINE_XS = [-10, -6.5, -3, .5, 4, 7.5, 11], BRINE_ZS = [-14, -11, -8, -5, -2];
const DRY_XS = [-12, -8.5, -5, -1.5, 2, 5.5, 9, 12.5], DRY_ZS = [-11.5, -8, -4, -1, 2, 5, 8.5, 12.2];
const terrain: VillageTerrainSpec = {
  size: [32, 34], cells: [64, 68], base: .45, water: -.55, skirtDepth: 1.4, beachWidth: 1.4, outline,
  smoothLandNormals: true, rockContour: true,
  features: [
    ...pans(BRINE_XS, BRINE_ZS, -1, (c, r) => (c + r) % 3 === 0 ? BRINE_MID : BRINE, .2),
    ...pans(DRY_XS, DRY_ZS, 1, (c, r) => (c + 2 * r) % 4 === 1 ? BRINE_MID : (c + r) % 2 ? DRIER : DRY),
    { kind: 'plateau', polygon: dikeBand(-6, 26, DIKE_HALF_WIDTH), height: DIKE_TOP, skirt: .9 },
    // Only the crest walk is dressed stone; the dike's steep flanks are left to the rock contour.
    { kind: 'paint', polygon: dikeBand(-6, 26, DIKE_HALF_WIDTH - .2), color: STONE },
    { kind: 'hole', polygon: INTAKE },
  ],
  palette: { grass: 0x8e9a87, grassAlt: 0x98a38f, rock: 0x8a8578, shore: 0xcfc5ab, water: 0x4c7c86, cliff: 0x6d6a60 },
};
const { at } = groundOf(terrain);

// ---- Stations ------------------------------------------------------------------------------
const beats = schedule(.3, [[1.6,.6],[1.3,.5],[1.2,.5],[2.2,.6],[1.2,.4],[3.2,.5],[1.8,.6],[1.2,.5],[1.3,.5],[1.4,0]]);
/** Every station is built of the same sun-bleached timber, so the whole run reads as one works. */
const BLEACHED = 0xc9bc9e;
// The front row runs along the crystallising pans to the shed door.
const SLUICE_ANCHOR: VillageVec3 = [.4, frontY - .25, FRONT_ROW];
const WEIGHBRIDGE_ANCHOR: VillageVec3 = [3.8, frontY - .55, FRONT_ROW];
const SHED_ANCHOR: VillageVec3 = [7.2, frontY - .85, FRONT_ROW];
const authored = [
  // A pin in the sea-wall gate lifts and lets the marble down the chute.
  { ...track(9, 'channel', straight([-8.8, 3.05, BACK_ROW], [-7, 2.9, BACK_ROW], 6), beats[0]!, [-7.7, 5, BACK_ROW - .3], BLEACHED), releasePin: true },
  // The tide trough on the sea wall tips under the marble as it rolls across.
  station({ stop: 8, anchor: [-4.2, 2.62, BACK_ROW], badge: [-3.8, 4.3, BACK_ROW - 1.1], beat: beats[1]!, color: BLEACHED,
    mechanism: { kind: 'tipping', pivot: [0, -.8, 0], axis: [0, 0, 1], angle: -.3 } }),
  // The swing gate on the barrow path is knocked open by the marble and falls back behind it.
  station({ stop: 7, anchor: [.9, 2.02, BACK_ROW], badge: [.5, 3.7, BACK_ROW - 1.2], beat: beats[2]!, color: BLEACHED,
    mechanism: { kind: 'striker', travel: .5 } }),
  // The windpump's brine lift: the one stop where the marble is held and carried.
  station({ stop: 6, anchor: LIFT_ANCHOR, badge: [4.3, 6.2, BACK_ROW - 1.3], beat: beats[3]!, color: BLEACHED,
    mechanism: { kind: 'translating', travel: LIFT_TRAVEL } }),
  track(5, 'arc', windpumpTurn, beats[4]!, [8.1, 6.2, -9.9], BLEACHED),
  // Pinned at mid-crest, so its stem stays on the dike rather than reaching back to the windpump.
  track(4, 'channel', crestFlume, beats[5]!, [3.2, 5.4, -4.3], BLEACHED, { anchor: add(crestFlume[7]!.position, [0, -.3, 0]) }),
  // Its map pin stands at the turn's apex, where the marble swings round the Workshop.
  track(3, 'arc', uTurn, beats[6]!, [-7.2, 4.4, 2.6], BLEACHED, { anchor: add(uTurn[18]!.position, [0, -.3, 0]) }),
  // The tide sluice gate lifts out of the bund as the marble arrives under it.
  station({ stop: 2, anchor: SLUICE_ANCHOR, badge: [.6, 3.6, FRONT_ROW + 2.1], beat: beats[7]!, color: BLEACHED,
    mechanism: { kind: 'escapement', travel: .65, pitch: -.12,
      drive: { marbleMass: .02, rotorEnergy: .05, rotorInertia: .00016, dragTorque: .002, gateMass: .002, gateLift: 1.2, riseAngle: Math.PI / 2 } } }),
  // The tide weighbridge dips under the marble's weight and rights itself behind it.
  station({ stop: 1, anchor: WEIGHBRIDGE_ANCHOR, badge: [3.9, 3.6, FRONT_ROW - 2], beat: beats[8]!, color: BLEACHED,
    mechanism: { kind: 'tipping', pivot: [0, -.6, 0], axis: [0, 0, 1], angle: -.2 } }),
  station({ stop: 0, anchor: SHED_ANCHOR, badge: [7.6, 3.2, FRONT_ROW + 1.8], beat: beats[9]!, color: BLEACHED,
    mechanism: { kind: 'receiver', travel: 0 } }),
];
/** Trough and weighbridge are counterweighted: each dips under the marble and rights itself after it. */
const RIGHTING = { kind: 'contact-gravity' as const, marbleMass: .02, bodyMass: .012, bodyInertia: .0012, bodyCentre: [0, -.5, 0] as const,
  tripX: -.55, bearingTorque: .0002, restitution: 0, traction: .8 };
const stations = authored.map(s => s.stop === 8 || s.stop === 1 ? { ...s, rollingDrive: RIGHTING } : s);
/** Cubic handle lengths and frame counts per connector; the three lead-length joins about the windpump and crest stay short. */
const joins: Record<number, readonly [number, number]> = { 9: [.9, 24], 8: [1.1, 24], 7: [1.3, 28], 6: [.27, 8], 5: [.27, 8], 4: [.27, 8], 3: [.7, 16], 2: [.9, 20], 1: [.9, 20] };
const connectors = stations.slice(0, -1).map((from, index) => {
  const [handle, steps] = joins[from.stop]!;
  return connect(from, stations[index + 1]!, handle, handle, [0, 0], { steps });
});

// ---- Settlement ----------------------------------------------------------------------------
type Lot = readonly [model: string, x: number, z: number, yaw: number, scale: number];
const lots: readonly Lot[] = [
  // One tall signature windpump at the end of the dike, beside the lift and its turn. It stands to the
  // right of the route, never between the camera and the marble on the back row.
  ['salt-windpump', 11.2, -8.4, 0, 1.05],
  // Tarred sheds: the brine house on the sea wall, the salt store at the weighbridge, and the yard sheds.
  ['salt-shed', -11.2, -10.9, .08, .9], ['salt-shed', 9.75, FRONT_ROW, -Math.PI / 2, .95],
  ['salt-shed', 11.2, -1.2, -1.2, .85], ['salt-shed', -11.4, 8.6, .35, .9],
  // Raked salt heaps and their rakers on the pale crystallising pans.
  ['salt-mound', -6.6, 6.4, 0, .9], ['salt-mound', -3.6, 7.2, .4, .7], ['salt-mound', 2.4, 9.6, .2, .85],
  ['salt-mound', 6.8, 10.6, .7, .65], ['salt-mound', -8.8, 11.8, .3, .75],
  ['salt-raker', -4.8, 5.3, .6, 1], ['salt-raker', .5, 8.5, -.4, 1], ['salt-raker', 7.2, 7.4, -.9, .95],
  // At the tide intake: timber trestles at the reservoir edge and a raker on the bank.
  ['timber-yard', -8.9, -6.3, 1.35, .75], ['salt-raker', -10.1, -8.5, .9, .95],
  // Saltworkers' cottages on the dry western bank.
  ['stone-croft', -12.2, 4.4, 1.1, .85], ['plaster-terrace', -12.4, -2.6, 1.25, .8], ['fell-cottage', -12.6, 1, 1.3, .8],
  ['timber-yard', 12.4, 7.4, -1.3, .8],
];
/** Local plan bounds of each kit model at scale 1: [minX, maxX, minZ, maxZ]. Pads flatten the whole footprint. */
const footprint: Record<string, readonly [number, number, number, number]> = {
  'salt-shed': [-1.39, 1.39, -.86, .86], 'salt-windpump': [-1.45, 1.45, -.9, .9], 'salt-mound': [-1.03, 1.1, -1.08, 1.08],
  'salt-raker': [-.23, .42, -.14, .44], 'stone-croft': [-1.01, 1.01, -.74, .74], 'plaster-terrace': [-.82, .82, -.7, .7],
  'fell-cottage': [-1.14, 1.14, -.87, .87], 'timber-yard': [-1.1, .95, -.66, .66], 'fell-scrub': [-1.43, 1.26, -.62, .81],
};
const PAD_MARGIN = .2;
function padOutline([, x, z, yaw, s]: Lot, [x0, x1, z0, z1]: readonly [number, number, number, number]): TerrainVec2[] {
  // Rotation about y by yaw maps local (u, v) to (u cos + v sin, −u sin + v cos).
  const c = Math.cos(yaw), n = Math.sin(yaw), m = PAD_MARGIN;
  return ([[x0 * s - m, z0 * s - m], [x1 * s + m, z0 * s - m], [x1 * s + m, z1 * s + m], [x0 * s - m, z1 * s + m]] as const)
    .map(([u, v]): TerrainVec2 => [x + u * c + v * n, z - u * n + v * c]);
}
const house: VillageVec3 = [-2.1, at(-2.1, 1.35), 1.35];
const housePad = { outline: padOutline(['house-a', house[0], house[2], 0, .7], [-1.22, 1.22, -1.08, 1.24]), height: house[1], apron: .6 };
const cinematicTerrain: VillageTerrainSpec = { ...terrain, buildingPads: [housePad, ...lots.map(lot => ({
  outline: padOutline(lot, footprint[lot[0]]!), height: at(lot[1], lot[2]), apron: .6 }))] };
const ground = groundOf(cinematicTerrain).at;
const scenery: VillageSceneryPiece[] = lots.map(([model, x, z, yaw, s]) => piece(model, [x, ground(x, z), z], yaw, s));

export const SALTWORKS: VillageScenePlan = {
  chapter: 6, construction: 'rise', terrain, cinematicTerrain, scenery,
  workshop: workshopSite({ position: house, scale: .7, yaw: 0 }, [-2.9, 5.2, -.2], { from: 3, to: 2 }),
  rewards: [],
  overview: [piece('salt-windpump', [11.2, at(11.2, -8.4), -8.4], 0, .9), piece('salt-shed', [9, at(9, 7), 7], -Math.PI / 2, 1.1),
    piece('salt-mound', [-5, at(-5, 7), 7], 0, 1.2)],
  // Reduced-motion stills cut in connector gaps: sea wall, brine lift, dike crest, tide gate and weighbridge.
  plan: { chapter: 6, profile: 'brine', stations, connectors, camera: shots([0, 2.5, 0], [
    { at: 3.85, target: [-2.2, 2.4, -12.3], radius: 30 }, { at: 5.9, target: [7, 3.4, -11.4], radius: 30 },
    { at: 10.61, target: [1.6, 3.2, -4.2], radius: 36 }, { at: 16.13, target: [2.6, 1.6, 3.6], radius: 28 },
    { at: 19.84, target: [0, 2.5, 0] },
  ]) },
};
