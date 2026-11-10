/**
 * Compact authoring helpers shared by the six village plans. Ports of moving
 * carriers always come from the compiler's own `stationPorts`; connectors are
 * cubic curves described by two tangent lengths; timing is a rhythm table.
 */
import { stationPorts, villageArc, villageBezier } from '../../view/machine-primitives';
import { VILLAGE_DURATION, VILLAGE_WIDTH, villagePort, type VillageBearingSeat, type VillageCameraShot, type VillageConnector, type VillageMechanism, type VillagePort, type VillageStation, type VillageVec3 } from '../village-plan';
import type { VillageSceneryPiece } from '../village-plans';
import { compileTerrain, terrainHeightAt, type VillageTerrain, type VillageTerrainSpec } from '../village-terrain';

export const REST_ELEVATION = 50 * Math.PI / 180;
export const DEG = Math.PI / 180;

export interface Beat { readonly start: number; readonly contact: number; readonly end: number }
/**
 * Rhythm table for stops 9…0: `[duration, gapAfter]` per stop plus the first start.
 * Carrier contacts sit a fraction into the window so approach and departure dwell both exist.
 */
export function schedule(firstStart: number, rhythm: readonly (readonly [number, number])[], contactAt = 0.3): readonly Beat[] {
  if (rhythm.length !== 10) throw new Error('A village rhythm needs ten stops');
  const beats: Beat[] = []; let start = firstStart;
  for (const [duration, gap] of rhythm) {
    const beat = { start, contact: +(start + duration * contactAt).toFixed(3), end: +(start + duration).toFixed(3) };
    beats.push(beat); start = +(beat.end + gap).toFixed(3);
  }
  return beats;
}

export const add = (a: VillageVec3, b: VillageVec3): VillageVec3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const scale = (a: VillageVec3, s: number): VillageVec3 => [a[0] * s, a[1] * s, a[2] * s];
export const unit = (a: VillageVec3): VillageVec3 => { const l = Math.hypot(...a); return [a[0] / l, a[1] / l, a[2] / l]; };
export const along = (port: VillagePort, distance: number, lift = 0): VillageVec3 =>
  [port.position[0] + port.tangent[0] * distance, port.position[1] + port.tangent[1] * distance + lift, port.position[2] + port.tangent[2] * distance];
/** Horizontal unit tangent from a yaw angle measured from +x towards −z (right-handed about y). */
export const heading = (yaw: number): VillageVec3 => [Math.cos(yaw), 0, -Math.sin(yaw)];
export const UP: VillageVec3 = [0, 1, 0];

export interface StationSpec {
  readonly stop: number;
  readonly anchor: VillageVec3;
  readonly badge: VillageVec3;
  readonly mechanism: VillageMechanism;
  readonly beat: Beat;
  readonly color: number;
  readonly supports?: readonly VillageVec3[];
  readonly terrainFeet?: readonly number[];
  readonly bearingSeats?:readonly VillageBearingSeat[];
  readonly span?: 'girder' | 'cable';
}
/** Every station's docks are the compiler's: a plan never states a moving port by hand. */
export function station(spec: StationSpec): VillageStation {
  const ports = stationPorts(spec);
  const base: VillageStation = { stop: spec.stop, anchor: spec.anchor, badge: spec.badge, mechanism: spec.mechanism,
    entry: ports.entry, exit: ports.exit, start: spec.beat.start, contact: spec.beat.contact, end: spec.beat.end, color: spec.color };
  return { ...base, ...(spec.supports ? { supports: spec.supports } : {}), ...(spec.terrainFeet ? { terrainFeet: spec.terrainFeet } : {}),
    ...(spec.bearingSeats!==undefined?{bearingSeats:spec.bearingSeats}:{}), ...(spec.span ? { span: spec.span } : {}) };
}
/** A fixed track station: its contact is the moment the marble enters the piece. */
export function track(stop: number, kind: 'channel' | 'arc' | 'helix' | 'loop' | 'bowl', points: readonly VillagePort[], beat: Beat,
  badge: VillageVec3, color: number, extra: { supports?: readonly VillageVec3[]; terrainFeet?: readonly number[]; bearingSeats?:readonly VillageBearingSeat[]; span?: 'girder' | 'cable'; anchor?: VillageVec3 } = {}): VillageStation {
  const first = points[0]!;
  const anchor = extra.anchor ?? [first.position[0], first.position[1] - 0.3, first.position[2]];
  return station({ stop, anchor, badge, mechanism: { kind, points }, beat: { ...beat, contact: beat.start }, color,
    ...(extra.supports ? { supports: extra.supports } : {}), ...(extra.terrainFeet ? { terrainFeet: extra.terrainFeet } : {}),
    ...(extra.bearingSeats!==undefined?{bearingSeats:extra.bearingSeats}:{}), ...(extra.span ? { span: extra.span } : {}) });
}

/** Join frame runs end to end, dropping each run's repeated first frame. */
export function join(...runs: readonly (readonly VillagePort[])[]): readonly VillagePort[] {
  const out: VillagePort[] = [];
  for (const run of runs) {
    const [first, ...rest] = run; if (!first) continue;
    const last = out[out.length - 1];
    if (!last) out.push(first);
    else if (Math.hypot(last.position[0] - first.position[0], last.position[1] - first.position[1], last.position[2] - first.position[2]) > 1e-6) throw new Error('Joined frame runs do not meet');
    out.push(...rest);
  }
  return out;
}

/** Cubic connector: control handles are distances along the exit and entry tangents, with optional lifts. */
export function connect(from: VillageStation, to: VillageStation, handleOut: number, handleIn: number, lifts: readonly [number, number] = [0, 0],
  extra: { supports?: readonly VillageVec3[]; terrainFeet?: readonly number[]; terrainFrameFeet?: readonly number[]; bearingSeats?:readonly VillageBearingSeat[]; omitAutomaticFrames?:readonly number[]; fixedEnds?:readonly('source'|'destination')[]; span?: 'girder' | 'cable'; steps?: number; lead?: number } = {}): VillageConnector {
  const lead = extra.lead ?? 0;
  if (!Number.isFinite(lead) || lead < 0) throw new Error('Connector lead must be finite and nonnegative');
  const start = { ...from.exit, position: along(from.exit, lead) };
  const end = { ...to.entry, position: along(to.entry, -lead) };
  const curve = villageBezier(start, along(start, handleOut, lifts[0]), along(end, -handleIn, lifts[1]), end, extra.steps ?? 32);
  const points = lead === 0 ? curve : join(straight(from.exit.position,start.position,2,from.exit.normal),curve,straight(end.position,to.entry.position,2,to.entry.normal));
  return { from: from.stop, to: to.stop, points, ...(extra.supports ? { supports: extra.supports } : {}),
    ...(extra.terrainFeet ? { terrainFeet: extra.terrainFeet } : {}), ...(extra.terrainFrameFeet ? { terrainFrameFeet: extra.terrainFrameFeet } : {}), ...(extra.bearingSeats!==undefined?{bearingSeats:extra.bearingSeats}:{}), ...(extra.omitAutomaticFrames!==undefined?{omitAutomaticFrames:extra.omitAutomaticFrames}:{}), ...(extra.fixedEnds!==undefined?{fixedEnds:extra.fixedEnds}:{}), ...(extra.span ? { span: extra.span } : {}) };
}
/** Connector through authored waypoints: consecutive cubic runs, each stated by two handle lengths. */
export function connectVia(from: VillageStation, to: VillageStation, legs: readonly { readonly via?: VillagePort; readonly out: number; readonly in: number; readonly lifts?: readonly [number, number]; readonly steps?: number }[],
  extra: { supports?: readonly VillageVec3[]; span?: 'girder' | 'cable' } = {}): VillageConnector {
  let current = from.exit; const runs: (readonly VillagePort[])[] = [];
  for (const leg of legs) {
    const target = leg.via ?? to.entry; const lifts = leg.lifts ?? [0, 0];
    runs.push(villageBezier(current, along(current, leg.out, lifts[0]), along(target, -leg.in, lifts[1]), target, leg.steps ?? 24));
    current = target;
  }
  if (current !== to.entry) throw new Error('Connector legs must finish at the destination entry');
  return { from: from.stop, to: to.stop, points: join(...runs), ...(extra.supports ? { supports: extra.supports } : {}), ...(extra.span ? { span: extra.span } : {}) };
}

/** A straight run between two world points, as frames. */
export function straight(from: VillageVec3, to: VillageVec3, steps = 2, normal: VillageVec3 = UP): readonly VillagePort[] {
  const tangent = unit([to[0] - from[0], to[1] - from[1], to[2] - from[2]]);
  const dot = tangent[0] * normal[0] + tangent[1] * normal[1] + tangent[2] * normal[2];
  const up = unit([normal[0] - tangent[0] * dot, normal[1] - tangent[1] * dot, normal[2] - tangent[2] * dot]);
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    return villagePort([from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t], tangent, up, VILLAGE_WIDTH);
  });
}
/**
 * Horizontal arc about a vertical axis; positive sweep turns left (counter-clockwise seen from above).
 * The radial angle follows `heading` (0 = +x, π/2 = −z), so an entry heading +x starts at −π/2 for a
 * left turn and at +π/2 for a right turn.
 */
export function turn(center: VillageVec3, radius: number, startAngle: number, sweep: number, rise = 0, steps = 32): readonly VillagePort[] {
  // Basis u=+x, v=−z makes angles agree with `heading` (0 along +x, π/2 along −z).
  return villageArc(center, radius, startAngle, sweep, [1, 0, 0], [0, 0, -1], rise, steps);
}
/**
 * Conical spiral descending into a basin: radius shrinks from `outer` to `inner` over `turns`,
 * floor tilted inwards like a real bowl, so the frame normal leans toward the axis.
 */
export function spiralBowl(center: VillageVec3, outer: number, inner: number, startAngle: number, turns: number, drop: number, tilt = 0.35, steps = 96): readonly VillagePort[] {
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps, angle = startAngle + turns * Math.PI * 2 * t, radius = outer + (inner - outer) * t;
    const radial: VillageVec3 = [Math.cos(angle), 0, -Math.sin(angle)];
    const position: VillageVec3 = [center[0] + radial[0] * radius, center[1] - drop * t, center[2] + radial[2] * radius];
    const dr = (inner - outer) / steps, dAngle = turns * Math.PI * 2 / steps;
    const tangent = unit([dr * radial[0] - radius * dAngle * Math.sin(angle), -drop / steps, dr * radial[2] - radius * dAngle * Math.cos(angle)]);
    const lean: VillageVec3 = unit([-radial[0] * Math.sin(tilt), Math.cos(tilt), -radial[2] * Math.sin(tilt)]);
    const dot = lean[0] * tangent[0] + lean[1] * tangent[1] + lean[2] * tangent[2];
    const normal = unit([lean[0] - tangent[0] * dot, lean[1] - tangent[1] * dot, lean[2] - tangent[2] * dot]);
    return villagePort(position, tangent, normal, VILLAGE_WIDTH);
  });
}
/** Vertical loop in the xy plane: enters along +x at the bottom, climbs the far side, returns to +x. */
export function verticalLoop(entry: VillageVec3, diameter: number, drift = 1.2, steps = 72): readonly VillagePort[] {
  const r = diameter / 2;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps, angle = Math.PI * 2 * t;
    const position: VillageVec3 = [entry[0] + r * Math.sin(angle), entry[1] + r * (1 - Math.cos(angle)), entry[2] + drift * t * t * (3 - 2 * t)];
    const tangent = unit([r * Math.cos(angle), r * Math.sin(angle), drift * 6 * t * (1 - t) / (Math.PI * 2)]);
    const inward: VillageVec3 = [-Math.sin(angle), Math.cos(angle), 0];
    const dot = inward[0] * tangent[0] + inward[1] * tangent[1] + inward[2] * tangent[2];
    return villagePort(position, tangent, unit([inward[0] - tangent[0] * dot, inward[1] - tangent[1] * dot, inward[2] - tangent[2] * dot]), VILLAGE_WIDTH);
  });
}

/** Rest shot first and last; the cuts between fall in connector gaps, never inside a contact. */
export function shots(rest: VillageVec3, cuts: readonly { readonly at: number; readonly target: VillageVec3; readonly yaw?: number; readonly elevation?: number; readonly radius?: number }[]): readonly VillageCameraShot[] {
  const result: VillageCameraShot[] = []; let start = 0, target = rest, yaw = 0, elevation = REST_ELEVATION, radius = 66;
  for (const cut of [...cuts, { at: VILLAGE_DURATION, target: rest }]) {
    result.push({ start, end: cut.at, target, yaw, elevation, radius });
    start = cut.at; target = cut.target; yaw = cut.yaw ?? 0; elevation = cut.elevation ?? 40 * DEG; radius = cut.radius ?? 20;
  }
  const last = result[result.length - 1]!;
  result[result.length - 1] = { ...last, target: rest, yaw: 0, elevation: REST_ELEVATION, radius: 66 };
  return result;
}

export const piece = (model: string, position: VillageVec3, yaw = 0, scale = 1): VillageSceneryPiece => ({ model, position, yaw, scale });

/** Ground lookup for authoring heights; throws where a plan expects land but has none. */
export function groundOf(spec: VillageTerrainSpec): { terrain: VillageTerrain; at: (x: number, z: number) => number } {
  const terrain = compileTerrain(spec);
  return { terrain, at: (x, z) => {
    const height = terrainHeightAt(terrain, x, z);
    if (height === undefined) throw new Error(`No ground at (${x}, ${z})`);
    return height;
  } };
}

/** Polygon of constant width around a centre line (for a river, rill or pool), in terrain x/z. */
export function ribbon(centre: readonly (readonly [number, number])[], width: number): readonly (readonly [number, number])[] {
  if (centre.length < 2) throw new Error('A ribbon needs at least two centre points');
  const left: [number, number][] = [], right: [number, number][] = [];
  centre.forEach(([x, z], index) => {
    const before = centre[Math.max(0, index - 1)]!, after = centre[Math.min(centre.length - 1, index + 1)]!;
    const dx = after[0] - before[0], dz = after[1] - before[1], length = Math.hypot(dx, dz) || 1;
    const nx = -dz / length * width / 2, nz = dx / length * width / 2;
    left.push([x + nx, z + nz]); right.push([x - nx, z - nz]);
  });
  return [...left, ...right.reverse()];
}

/** A constant-grade easement into one planar receiving chord. Previous port
 * supplies curvature: a lone port does not encode a curve's radius.
 */
export function terminalRunout(last:VillagePort,spec:{previous:VillagePort;easement:number;pad:number;steps:number}):readonly VillagePort[]{
  const {previous,easement:L,pad,steps}=spec;
  if(!Number.isFinite(L)||L<=0||!Number.isFinite(pad)||pad<=0||!Number.isInteger(steps)||steps<2)throw new Error('Invalid terminal runout');
  const horizontal=Math.hypot(last.tangent[0],last.tangent[2]),before=Math.hypot(previous.tangent[0],previous.tangent[2]);
  const chord=Math.hypot(last.position[0]-previous.position[0],last.position[2]-previous.position[2]);
  if(horizontal<=0||before<=0||chord<=0||last.tangent[1]>0)throw new Error('Runout needs a descending horizontal curve');
  const hx=last.tangent[0]/horizontal,hz=last.tangent[2]/horizontal,px=previous.tangent[0]/before,pz=previous.tangent[2]/before;
  const curvature=Math.atan2(px*hz-pz*hx,px*hx+pz*hz)/chord,heading=Math.atan2(hz,hx),grade=last.tangent[1];
  const up:VillageVec3=[-hx*grade,horizontal,-hz*grade],side:VillageVec3=[-hz,0,hx];
  const bank=Math.atan2(last.normal[0]*side[0]+last.normal[2]*side[2],last.normal[0]*up[0]+last.normal[1]*up[1]+last.normal[2]*up[2]);
  // Eight-point Gauss-Legendre integration of the clothoid's direction. Each
  // sample is evaluated from the same origin, avoiding accumulated pose drift.
  const nodes=[-.9602898564975363,-.7966664774136267,-.525532409916329,-.1834346424956498,.1834346424956498,.525532409916329,.7966664774136267,.9602898564975363];
  const weights=[.1012285362903763,.2223810344533745,.3137066458778873,.362683783378362,.362683783378362,.3137066458778873,.2223810344533745,.1012285362903763];
  const points:VillagePort[]=[last];
  for(let i=1;i<=steps;i++){
    const s=L*i/steps;let x=0,z=0;
    for(let j=0;j<nodes.length;j++){
      const u=s*(nodes[j]!+1)/2,angle=heading+curvature*horizontal*(u-u*u/(2*L));
      x+=weights[j]!*Math.cos(angle);z+=weights[j]!*Math.sin(angle);
    }
    const yaw=heading+curvature*horizontal*(s-s*s/(2*L)),tx=Math.cos(yaw),tz=Math.sin(yaw);
    const lean=i===steps?0:Math.atan(Math.tan(bank)*(1-s/L));
    const normal:VillageVec3=[-tx*grade*Math.cos(lean)-tz*Math.sin(lean),horizontal*Math.cos(lean),-tz*grade*Math.cos(lean)+tx*Math.sin(lean)];
    points.push(villagePort([last.position[0]+horizontal*s*x/2,last.position[1]+grade*s,last.position[2]+horizontal*s*z/2],
      [tx*horizontal,grade,tz*horizontal],normal,last.width));
  }
  const flat=points.at(-1)!;
  points.push(villagePort(along(flat,pad),flat.tangent,flat.normal,last.width));
  return points;
}
