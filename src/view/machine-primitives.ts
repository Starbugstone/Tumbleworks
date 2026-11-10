import {axlePose} from '../world/axle-pose';
import { TERRACOTTA_CHANNEL_PROFILE, trimChannelLip, type ChannelLipConstruction } from './village-channel-lips';
import * as THREE from 'three';
import { VILLAGE_RADIUS, VILLAGE_WIDTH, villagePort, type VillageProfile, type VillageMechanism, type VillagePort, type VillageStation, type VillageVec3 } from '../world/village-plan';

export const CARRIER_HALF_LENGTH = 0.8;
const ORIGIN: VillageVec3 = [0, 0, 0];
const THROUGH_EDGES = [-CARRIER_HALF_LENGTH, CARRIER_HALF_LENGTH] as const;
const LEFT_EDGES = [-CARRIER_HALF_LENGTH, -CARRIER_HALF_LENGTH] as const;
const RIGHT_EDGES = [CARRIER_HALF_LENGTH, CARRIER_HALF_LENGTH] as const;
export function carrierEdges(mechanism: VillageMechanism): readonly [number, number] {
  if (mechanism.kind === 'receiver') return [-CARRIER_HALF_LENGTH, .85];
  return mechanism.kind === 'wheelbucket' ? mechanism.angle < 0 ? RIGHT_EDGES : LEFT_EDGES : THROUGH_EDGES;
}
const clamp = (u: number): number => Math.max(0, Math.min(1, u));
export const villageEase = (u: number): number => { const t = clamp(u); return t * t * (3 - 2 * t); };
export function isVillageTrack(mechanism: VillageMechanism): mechanism is Extract<VillageMechanism, { points: readonly VillagePort[] }> {
  return 'points' in mechanism;
}
const vec = (p: VillageVec3): THREE.Vector3 => new THREE.Vector3(...p);
const tuple = (p: THREE.Vector3): VillageVec3 => [p.x, p.y, p.z];

/** Anchor is the initial local origin. Pivot and localContact are offsets from it. */
export function mechanismMatrix(mechanism: VillageMechanism, anchor: VillageVec3, progress: number, target: THREE.Matrix4): THREE.Matrix4 {
  if(mechanism.kind==='wheelbucket'&&mechanism.axleCarry)return axlePose({...mechanism,axleCarry:mechanism.axleCarry},anchor,mechanism.angle*villageEase(progress),target);
  const docking = 'dockingLift' in mechanism && mechanism.dockingLift ? mechanism.dockingLift : 0;
  const u = villageEase(docking ? (progress - .2) / .6 : progress);
  target.identity();
  if ('pivot' in mechanism) {
    const [x, y, z] = mechanism.axis, length = Math.hypot(x, y, z);
    if (Math.abs(length - 1) > 1e-6) throw new Error('Carrier axis must be unit length');
    const a = mechanism.angle * u, c = Math.cos(a), s = Math.sin(a), t = 1 - c;
    target.set(t*x*x+c, t*x*y-s*z, t*x*z+s*y, 0, t*x*y+s*z, t*y*y+c, t*y*z-s*x, 0,
      t*x*z-s*y, t*y*z+s*x, t*z*z+c, 0, 0, 0, 0, 1);
    const e = target.elements, p = mechanism.pivot;
    e[12] = anchor[0] + p[0] - e[0]! * p[0] - e[4]! * p[1] - e[8]! * p[2];
    e[13] = anchor[1] + p[1] - e[1]! * p[0] - e[5]! * p[1] - e[9]! * p[2];
    e[14] = anchor[2] + p[2] - e[2]! * p[0] - e[6]! * p[1] - e[10]! * p[2];
  } else if (mechanism.kind === 'wheelbucket') {
    const a = mechanism.angle * u;
    target.makeTranslation(anchor[0] + Math.sin(a) * mechanism.radius,
      anchor[1] + (1 - Math.cos(a)) * mechanism.radius, anchor[2]);
  } else if ('travel' in mechanism && typeof mechanism.travel !== 'number') {
    target.makeTranslation(anchor[0] + mechanism.travel[0] * u, anchor[1] + mechanism.travel[1] * u, anchor[2] + mechanism.travel[2] * u);
  } else if (mechanism.kind === 'escapement' && mechanism.pitch !== undefined) {
    target.makeRotationZ(mechanism.pitch); target.setPosition(...anchor);
  } else target.makeTranslation(...anchor);
  if ('deckPitch' in mechanism && mechanism.deckPitch) {
    // Post-multiply the deck's fixed grade without moving the mechanical pivot.
    const e = target.elements, c = Math.cos(mechanism.deckPitch), s = Math.sin(mechanism.deckPitch);
    for (let row = 0; row < 3; row++) {
      const x = e[row]!, y = e[row + 4]!;
      e[row] = x * c + y * s; e[row + 4] = -x * s + y * c;
    }
  }
  if (docking) {
    if (!('axis' in mechanism) || Math.abs(mechanism.axis[1]) < .999) throw new Error('Docking lift requires a vertical turntable shaft');
    const lift = docking * (progress < .2 ? villageEase(progress / .2) : progress > .8 ? 1 - villageEase((progress - .8) / .2) : 1);
    const e = target.elements;
    e[12]! += e[4]! * lift; e[13]! += e[5]! * lift; e[14]! += e[6]! * lift;
  }
  return target;
}
export function carrierContact(mechanism: VillageMechanism): VillageVec3 {
  return 'localContact' in mechanism && mechanism.localContact ? mechanism.localContact : ORIGIN;
}
export function mechanismPorts(mechanism: VillageMechanism, anchor: VillageVec3): { entry: VillagePort; exit: VillagePort } {
  if (isVillageTrack(mechanism)) {
    if (mechanism.points.length < 2) throw new Error('Track requires at least two frames');
    return { entry: mechanism.points[0]!, exit: mechanism.points[mechanism.points.length - 1]! };
  }
  const contact = carrierContact(mechanism), edges = carrierEdges(mechanism);
  const port = (u: number, edge: number): VillagePort => {
    const matrix = mechanismMatrix(mechanism, anchor, u, new THREE.Matrix4());
    return villagePort(tuple(vec(contact).add(new THREE.Vector3(edge, 0, 0)).applyMatrix4(matrix)),
      tuple(new THREE.Vector3(Math.sign(edge) * (u === 0 ? -1 : 1), 0, 0).transformDirection(matrix)), tuple(new THREE.Vector3(0, 1, 0).transformDirection(matrix)));
  };
  return { entry: port(0, edges[0]), exit: port(1, edges[1]) };
}
export function hasVillageCarrier(mechanism: VillageMechanism): boolean {
  return !isVillageTrack(mechanism) && mechanism.kind !== 'escapement' && mechanism.kind !== 'striker' && mechanism.kind !== 'receiver';
}

export const stationPorts = (station: Pick<VillageStation, 'mechanism' | 'anchor'>): { entry: VillagePort; exit: VillagePort } => mechanismPorts(station.mechanism, station.anchor);

function frame(position: THREE.Vector3, tangent: THREE.Vector3, up: THREE.Vector3, width: number): VillagePort {
  tangent.normalize(); up.addScaledVector(tangent, -up.dot(tangent)).normalize();
  if (up.lengthSq() < 0.9) throw new Error('Curve up vector is parallel to tangent');
  return villagePort(tuple(position), tuple(tangent), tuple(up), width);
}
/** Explicit cubic controls; endpoint frame disagreement is rejected by the compiler. */
export function villageBezier(from: VillagePort, control1: VillageVec3, control2: VillageVec3, to: VillagePort, steps = 32): readonly VillagePort[] {
  if (!Number.isInteger(steps) || steps < 2) throw new Error('Bezier needs at least two subdivisions');
  const curve = new THREE.CubicBezierCurve3(vec(from.position), vec(control1), vec(control2), vec(to.position));
  const result: VillagePort[] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps;
    const tangent = vec(control1).sub(vec(from.position)).multiplyScalar(3 * (1 - u) ** 2)
      .addScaledVector(vec(control2).sub(vec(control1)), 6 * (1 - u) * u)
      .addScaledVector(vec(to.position).sub(vec(control2)), 3 * u * u);
    result.push(frame(curve.getPoint(u), tangent, vec(from.normal).lerp(vec(to.normal), u), from.width));
  }
  return result;
}
/** Plane basis u/v defines circular orientation; rise is along their normal. */
export function villageArc(center: VillageVec3, radius: number, start: number, sweep: number,
  u: VillageVec3 = [1, 0, 0], v: VillageVec3 = [0, 0, 1], rise = 0, steps = 48, width = VILLAGE_WIDTH): readonly VillagePort[] {
  const a = vec(u), b = vec(v), up = new THREE.Vector3().crossVectors(b, a).normalize();
  if (!Number.isInteger(steps) || steps < 2 || ![radius, start, sweep, rise].every(Number.isFinite) || radius <= 0 || sweep === 0
    || Math.abs(a.lengthSq() - 1) > 1e-6 || Math.abs(b.lengthSq() - 1) > 1e-6 || Math.abs(a.dot(b)) > 1e-6) throw new Error('Arc requires a finite radius and orthonormal plane basis');
  // A horizontal angle convention may reverse handedness; its floor still faces
  // the sky and signed rise still means world up. Vertical loops keep inward frames.
  if (up.y < -0.5) up.negate();
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps, angle = start + sweep * t;
    const point = vec(center).addScaledVector(a, radius * Math.cos(angle)).addScaledVector(b, radius * Math.sin(angle)).addScaledVector(up, rise * t);
    const tangent = a.clone().multiplyScalar(-radius * sweep * Math.sin(angle)).addScaledVector(b, radius * sweep * Math.cos(angle)).addScaledVector(up, rise);
    const normal = Math.abs(up.y) < 0.5 ? a.clone().multiplyScalar(-Math.cos(angle)).addScaledVector(b, -Math.sin(angle)) : up.clone();
    return frame(point, tangent, normal, width);
  });
}
export function villageHelix(center: VillageVec3, radius: number, start: number, turns: number, rise: number, steps = 96): readonly VillagePort[] {
  return villageArc(center, radius, start, turns * Math.PI * 2, [1, 0, 0], [0, 0, 1], rise, steps);
}

export interface ChannelSurface {
  readonly materialProfile: readonly (readonly[number,number])[];
  readonly surfaceFrames: readonly number[];
  readonly interval: readonly number[];
  readonly edge: readonly number[];
  readonly underside: readonly number[];
  readonly index: readonly number[];
  readonly materialLoops: { readonly start: readonly number[]; readonly end: readonly number[] };
}
interface ChannelSurfaceRecord {
  readonly surface: ChannelSurface;
  readonly position: THREE.BufferAttribute;
  readonly positionArray: Float32Array;
  readonly positionValues: Float32Array;
  readonly index: THREE.BufferAttribute;
  readonly indexArray: object;
  readonly indexValues: readonly number[];
  readonly original: readonly VillagePort[];
  readonly frameRefs: readonly VillagePort[];
  readonly portValues: readonly (readonly number[])[];
}
const channelSurfaces = new WeakMap<THREE.BufferGeometry, ChannelSurfaceRecord>();

// Private producer call only. Values are computed by the real channel emitter,
// including docking cuts. Never expose mutable snapshots to a proof consumer.
function rememberChannelSurface(geometry: THREE.BufferGeometry, original: readonly VillagePort[],
  surfaceFrames: readonly number[], interval: readonly number[], edge: readonly number[],
  startLoop: readonly number[], endLoop: readonly number[], profile:readonly(readonly[number,number])[]): void {
  const position = geometry.getAttribute('position'), index = geometry.index;
  if (!(position instanceof THREE.BufferAttribute) || !(position.array instanceof Float32Array)
    || position.itemSize !== 3 || position.normalized || !index || index.itemSize !== 1
    || index.normalized || index.count % 3 || interval.length !== index.count / 3 || edge.length !== interval.length
    || surfaceFrames.length !== original.length) throw new Error('Invalid emitted channel provenance');
  const frozen = (v: readonly number[]) => Object.freeze([...v]);
  const indices = frozen(Array.from(index.array));
  const surface: ChannelSurface = Object.freeze({
    materialProfile:Object.freeze(profile.map(p=>Object.freeze([...p])as readonly[number,number])), surfaceFrames: frozen(surfaceFrames), interval: frozen(interval), edge: frozen(edge),
    underside: frozen(edge.flatMap((e, t) => e === 1 ? [t] : [])), index: indices,
    materialLoops: Object.freeze({start: frozen(startLoop), end: frozen(endLoop)}),
  });
  channelSurfaces.set(geometry, {
    surface, position, positionArray: position.array, positionValues: position.array.slice(),
    index, indexArray: index.array, indexValues: indices,
    original, frameRefs: [...original],
    portValues: original.map(p => [...p.position, ...p.tangent, ...p.normal, p.width]),
  });
}

/** Producer provenance only. Does not certify a Mesh frame or merged native range. */
export function channelSurface(geometry: THREE.BufferGeometry): ChannelSurface | undefined {
  const r = channelSurfaces.get(geometry), p = geometry.getAttribute('position'), i = geometry.index;
  if (!r || p !== r.position || i !== r.index || !i || p.array !== r.positionArray
    || i.array !== r.indexArray || p.itemSize !== 3 || p.normalized || p.count * 3 !== r.positionValues.length
    || i.itemSize !== 1 || i.normalized || i.count !== r.indexValues.length || r.original.length !== r.frameRefs.length) return undefined;
  for (let k = 0; k < r.positionValues.length; k++) if (!Object.is(p.array[k], r.positionValues[k])) return undefined;
  for (let k = 0; k < r.indexValues.length; k++) if (i.getX(k) !== r.indexValues[k]) return undefined;
  for (let k = 0; k < r.frameRefs.length; k++) {
    const frame = r.original[k];
    if (frame !== r.frameRefs[k] || !frame) return undefined;
    const values = [...frame.position, ...frame.tangent, ...frame.normal, frame.width];
    if (values.some((v, j) => !Object.is(v, r.portValues[k]![j]))) return undefined;
  }
  return r.surface;
}


/** The same contact frames generate the full floor and side walls. */
export function villageChannelGeometry(points: readonly VillagePort[], style: VillageProfile = 'plank', docking?: { start?: VillageVec3; end?: VillageVec3 }, refineFloor = false, lip?: ChannelLipConstruction,recordSurface=false): THREE.BufferGeometry {
  if(recordSurface&&(style!=='plank'||lip!==undefined))throw Error('Unsupported channel surface recording');
  if (lip && (style !== 'terracotta' || docking !== undefined || lip.staticFloor !== true)) throw new Error('Channel lip requires a static terracotta floor without docking');
  const originalPoints = points;
  points = straightSurfaceFrames(points);
  if (style === 'twinrail') return villageRailGeometry(points);
  const positions: number[] = [], indices: number[] = [];
  const interval=recordSurface?[]as number[]:undefined,edgeOf=recordSurface?[]as number[]:undefined;
  let profile: readonly (readonly [number, number])[] = [[-0.5, 0.17], [-0.5, -0.1], [0.5, -0.1], [0.5, 0.17], [0.4, 0.17], [0.4, 0], [-0.4, 0], [-0.4, 0.17]];
  if (style === 'timber') profile = [[-0.65, 0.2], [-0.65, -0.14], [0.65, -0.14], [0.65, 0.2], [0.4, 0.2], [0.4, 0], [-0.4, 0], [-0.4, 0.2]];
  if (style === 'girder') profile = [[-0.5, 0.12], [-0.5, -0.16], [0.5, -0.16], [0.5, 0.12], [0.4, 0.12], [0.4, 0], [-0.4, 0], [-0.4, 0.12]];
  if (style === 'steel') profile = [[-0.48, 0.2], [-0.48, -0.06], [0.48, -0.06], [0.48, 0.2], [0.42, 0.2], [0.42, 0], [-0.42, 0], [-0.42, 0.2]];
  if (style === 'terracotta') profile = TERRACOTTA_CHANNEL_PROFILE;
  points.forEach((p, index) => {
    const side = new THREE.Vector3().crossVectors(vec(p.tangent), vec(p.normal)).normalize();
    const travel = index === 0 ? docking?.start : index === points.length - 1 ? docking?.end : undefined;
    // A translating dock meets on a plane containing its travel and width axes.
    // Anchor that plane on the real floor edge, leaving rolling contact unchanged.
    const cut = travel ? new THREE.Vector3().crossVectors(side, vec(travel)).normalize() : undefined;
    const tangent = vec(p.tangent), normal = vec(p.normal);
    if (cut && Math.abs(cut.dot(tangent)) < 1e-6) throw new Error('Translation cannot define a transverse docking cut');
    for (const [across, height] of profile) {
      const along = cut ? -height! * cut.dot(normal) / cut.dot(tangent) : 0;
      positions.push(p.position[0] + side.x * across! * p.width + p.normal[0] * (height! - VILLAGE_RADIUS) + tangent.x * along,
        p.position[1] + side.y * across! * p.width + p.normal[1] * (height! - VILLAGE_RADIUS) + tangent.y * along,
        p.position[2] + side.z * across! * p.width + p.normal[2] * (height! - VILLAGE_RADIUS) + tangent.z * along);
    }
  });
  const vec3=(i:number)=>new THREE.Vector3().fromArray(positions,i*3);
  for(let index=1;index<points.length;index++)for(let edge=0;edge<profile.length;edge++){
    const a=(index-1)*profile.length+edge,b=(index-1)*profile.length+(edge+1)%profile.length;
    const c=index*profile.length+edge,d=index*profile.length+(edge+1)%profile.length;
    const before=points[index-1]!,after=points[index]!;
    let fan=false;
    if(refineFloor&&edge===(style==='terracotta'?profile.length-1:5)){
      const first=new THREE.Triangle(vec3(a),vec3(c),vec3(b)),second=new THREE.Triangle(vec3(b),vec3(c),vec3(d)),nearest=new THREE.Vector3();
      for(const u of [.25,.5,.75]){
        const sphere=vec(before.position).lerp(vec(after.position),u);
        const distance=Math.min(first.closestPointToPoint(sphere,nearest).distanceTo(sphere),second.closestPointToPoint(sphere,nearest).distanceTo(sphere));
        // A 1mm construction target leaves half the existing 2mm contact skin
        // for facet interpolation and packing. The clearance guard stays strict.
        if(Math.abs(distance-VILLAGE_RADIUS)>.001)fan=true;
      }
    }
    if(fan){
      const normal=vec(before.normal).add(vec(after.normal)).normalize();
      const centre=vec(before.position).add(vec(after.position)).multiplyScalar(.5).addScaledVector(normal,-VILLAGE_RADIUS);
      const e=positions.length/3;positions.push(centre.x,centre.y,centre.z);
      indices.push(a,c,e,c,d,e,d,b,e,b,a,e);if(interval&&edgeOf)for(let k=0;k<4;k++){interval.push(index);edgeOf.push(edge);}
    }else{indices.push(a,c,b,b,c,d);if(interval&&edgeOf){interval.push(index,index);edgeOf.push(edge,edge);}}
  }
  if (docking) for (const [end, travel] of [[false, docking.start], [true, docking.end]] as const) {
    if (!travel) continue;
    const p = points[end ? points.length - 1 : 0]!, tangent = vec(p.tangent);
    const side = new THREE.Vector3().crossVectors(tangent, vec(p.normal)).normalize();
    const cut = new THREE.Vector3().crossVectors(side, vec(travel)).normalize();
    if (cut.dot(tangent) * (end ? -1 : 1) < 0) cut.negate();
    const floor = vec(p.position).addScaledVector(vec(p.normal), -VILLAGE_RADIUS);
    // A curved neighbour can overhang the dock even after its terminal ring is
    // mitered. Trim those actual triangles, retaining every surviving facet.
    const clipped: number[] = [], intersections = new Map<string, number>();
    const clippedInterval=recordSurface?[]as number[]:undefined,clippedEdge=recordSurface?[]as number[]:undefined;
    const vertex = (i: number) => new THREE.Vector3().fromArray(positions, i * 3);
    const ringStart = end ? (points.length - 1) * profile.length : 0;
    // These vertices were constructed on this plane above. Preserve that exact
    // membership instead of manufacturing slivers from a second dot product.
    const distance = (i: number) => i >= ringStart && i < ringStart + profile.length ? 0 : vertex(i).sub(floor).dot(cut);
    for (let i = 0; i < indices.length; i += 3) {
      const polygon: number[] = [];
      for (let edge = 0; edge < 3; edge++) {
        const a = indices[i + edge]!, b = indices[i + (edge + 1) % 3]!;
        const da = distance(a), db = distance(b);
        if (da >= 0) polygon.push(a);
        if ((da < 0 && db > 0) || (da > 0 && db < 0)) {
          const low = Math.min(a,b), high = Math.max(a,b), key = `${low}/${high}`;
          let index = intersections.get(key);
          if (index === undefined) {
            const lo = vertex(low), hi = vertex(high), dl = distance(low), dh = distance(high);
            lo.lerp(hi, dl / (dl - dh)); index = positions.length / 3;
            positions.push(lo.x,lo.y,lo.z); intersections.set(key,index);
          }
          polygon.push(index);
        }
      }
      for(let j=1;j+1<polygon.length;j++){clipped.push(polygon[0]!,polygon[j]!,polygon[j+1]!);if(clippedInterval&&clippedEdge){clippedInterval.push(interval![i/3]!);clippedEdge.push(edgeOf![i/3]!);}}
    }
    indices.splice(0,indices.length,...clipped);if(interval&&edgeOf){interval.splice(0,interval.length,...clippedInterval!);edgeOf.splice(0,edgeOf.length,...clippedEdge!);}
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  if (lip) {
    try { trimChannelLip(geometry, points, points.map(p => originalPoints.indexOf(p)), originalPoints.length, lip, refineFloor); }
    catch (error) { geometry.dispose(); throw error; }
  }
  geometry.computeVertexNormals();
  if(recordSurface)rememberChannelSurface(geometry,originalPoints,originalPoints.map(p=>points.indexOf(p)),interval!,edgeOf!,Array.from({length:profile.length},(_,i)=>i),Array.from({length:profile.length},(_,i)=>(points.length-1)*profile.length+i),profile);
  return geometry;
}

/** Remove redundant cuts of one straight, constant cross-section extrusion.
 * Curves, banks and width transitions retain every authored surface frame.
 */
function straightSurfaceFrames(points: readonly VillagePort[]): readonly VillagePort[] {
  if (points.length < 3) return points;
  const result = [points[0]!];
  for (let i = 1; i < points.length - 1; i++) {
    const a = result[result.length - 1]!, b = points[i]!, c = points[i + 1]!;
    const sameFrame = [a, c].every(p => p.width === b.width && p.normal.every((v, k) => Math.abs(v - b.normal[k]!) < 1e-12)
      && p.tangent.every((v, k) => Math.abs(v - b.tangent[k]!) < 1e-12));
    const ab = vec(b.position).sub(vec(a.position)), bc = vec(c.position).sub(vec(b.position));
    const forward = ab.dot(bc) > 0;
    const straight = ab.clone().cross(bc).lengthSq() <= 1e-24 * ab.lengthSq() * bc.lengthSq();
    if (!sameFrame || !forward || !straight) result.push(b);
  }
  result.push(points[points.length - 1]!);
  return result;
}

/** Twin rails retain the repaired sphere/rail contact depth, including inverted loops. */
function villageRailGeometry(points: readonly VillagePort[]): THREE.BufferGeometry {
  const angles = [0, Math.PI / 4, 3 * Math.PI / 4, Math.PI, 5 * Math.PI / 4, 7 * Math.PI / 4];
  const positions: number[] = [], indices: number[] = [], radius = 0.055, sides = angles.length;
  for (const direction of [-1, 1]) {
    const base = positions.length / 3;
    points.forEach((p, index) => {
      const halfWidth = p.width * 0.275;
      if (halfWidth >= VILLAGE_RADIUS + radius) throw new Error('Twin rails cannot support this marble at the authored width');
      const depth = Math.sqrt((VILLAGE_RADIUS + radius) ** 2 - halfWidth ** 2);
      const side = new THREE.Vector3().crossVectors(vec(p.tangent), vec(p.normal)).normalize();
      for (let radial = 0; radial < sides; radial++) {
        const angle = angles[radial]!, up = -depth + radius * Math.cos(angle), across = direction * halfWidth + radius * Math.sin(angle);
        positions.push(p.position[0] + side.x * across + p.normal[0] * up, p.position[1] + side.y * across + p.normal[1] * up, p.position[2] + side.z * across + p.normal[2] * up);
        if (index) {
          const a = base + (index - 1) * sides + radial, b = base + (index - 1) * sides + (radial + 1) % sides;
          const c = base + index * sides + radial, d = base + index * sides + (radial + 1) % sides;
          indices.push(a, b, c, b, d, c);
        }
      }
    });
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

export function villageFloorDepth(profile: VillageProfile): number {
  return profile === 'timber' ? 0.14 : profile === 'girder' ? 0.16 : profile === 'steel' ? 0.06 : 0.1;
}

/** Open-top structural web: its rim joins the deck underside without duplicate top faces. */
export function villageSpanGeometry(points: readonly VillagePort[], profile: VillageProfile): THREE.BufferGeometry {
  const depth = villageFloorDepth(profile);
  const vertices: number[] = [], indices: number[] = [];
  points.forEach((p, i) => {
    const side = new THREE.Vector3().crossVectors(vec(p.tangent), vec(p.normal)).normalize();
    // The rim shares the deck boundary, avoiding a second interpolation through
    // the interior of warped floor quads. Rails meet at their bottom vertices.
    const half = p.width * (profile === 'twinrail' ? 0.275 : profile === 'timber' ? 0.65 : profile === 'steel' ? 0.48 : profile === 'terracotta' ? 0.4 : 0.5);
    const underside = profile === 'twinrail' ? Math.sqrt((VILLAGE_RADIUS + 0.055) ** 2 - half ** 2) + 0.055 - VILLAGE_RADIUS : depth;
    for (const [across, down] of [[-half, underside], [-half, underside + 0.2], [half, underside + 0.2], [half, underside]]) {
      vertices.push(p.position[0] + side.x * across! - p.normal[0] * (VILLAGE_RADIUS + down!),
        p.position[1] + side.y * across! - p.normal[1] * (VILLAGE_RADIUS + down!),
        p.position[2] + side.z * across! - p.normal[2] * (VILLAGE_RADIUS + down!));
    }
    if (i) for (let edge = 0; edge < 3; edge++) {
      const a = (i - 1) * 4 + edge, b = a + 1, c = i * 4 + edge, d = c + 1;
      indices.push(a, b, c, b, d, c);
    }
  });
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals(); return geometry;
}

/** A bearing cap whose roof is clipped from the rendered underside triangles. */
export function villageBearingCap(points: readonly VillagePort[], profile: VillageProfile, frame: VillagePort,
  centre: VillageVec3, halfLength = 0.13, halfWidth = 0.56): THREE.BufferGeometry {
  const source = villageChannelGeometry(points, profile), sourcePositions = source.getAttribute('position'), index = source.getIndex()!;
  const yaw = Math.atan2(-frame.tangent[2], frame.tangent[0]);
  const toLocal = new THREE.Matrix4().makeRotationY(-yaw).multiply(new THREE.Matrix4().makeTranslation(-centre[0], 0, -centre[2]));
  const toWorld = toLocal.clone().invert(), roof: THREE.Vector3[][] = [];
  const up = vec(frame.normal).transformDirection(toLocal);
  const bounds = [[0, -halfLength, 1], [0, halfLength, -1], [2, -halfWidth, 1], [2, halfWidth, -1]] as const;
  for (let i = 0; i < index.count; i += 3) {
    let polygon = [0, 1, 2].map(offset => new THREE.Vector3().fromBufferAttribute(sourcePositions, index.getX(i + offset)).applyMatrix4(toLocal));
    const normal = new THREE.Vector3().subVectors(polygon[1]!, polygon[0]!).cross(new THREE.Vector3().subVectors(polygon[2]!, polygon[0]!)).normalize();
    if (normal.dot(up) > -0.1 || normal.y >= -0.05) continue;
    for (const [axis, limit, sign] of bounds) {
      const clipped: THREE.Vector3[] = [];
      for (let j = 0; j < polygon.length; j++) {
        const a = polygon[j]!, b = polygon[(j + 1) % polygon.length]!;
        const da = (a.getComponent(axis) - limit) * sign, db = (b.getComponent(axis) - limit) * sign;
        if (da >= 0) clipped.push(a);
        if ((da >= 0) !== (db >= 0)) {
          // Shared edges are clipped in one direction so adjacent triangles get
          // bit-identical intersections without rounding their coordinates.
          const start = da < db ? a : b, end = da < db ? b : a;
          const distance = Math.min(da, db), span = Math.max(da, db) - distance;
          const intersection = start.clone().lerp(end, -distance / span);
          intersection.setComponent(axis, limit);
          clipped.push(intersection);
        }
      }
      polygon = clipped;
    }
    if (polygon.length >= 3) roof.push(polygon);
  }
  source.dispose();
  if (!roof.length) throw new Error('Bearing cap has no rendered underside contact');
  const bottom = Math.min(...roof.flat().map(p => p.y)) - 0.12;
  const values: number[] = [], triangles: THREE.Vector3[][] = [];
  const edges = new Map<string, { a: THREE.Vector3; b: THREE.Vector3; count: number }>();
  const key = (p: THREE.Vector3): string => `${p.x.toFixed(6)},${p.y.toFixed(6)},${p.z.toFixed(6)}`;
  const face = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3): void => {
    triangles.push([a, b, c]);
  };
  const foot = (p: THREE.Vector3): THREE.Vector3 => new THREE.Vector3(p.x, bottom, p.z);
  for (const polygon of roof) {
    for (let i = 1; i < polygon.length - 1; i++) {
      face(polygon[0]!, polygon[i + 1]!, polygon[i]!);
      face(foot(polygon[0]!), foot(polygon[i]!), foot(polygon[i + 1]!));
    }
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]!, b = polygon[(i + 1) % polygon.length]!;
      const id = [key(a), key(b)].sort().join('/'), existing = edges.get(id);
      if (existing) existing.count++; else edges.set(id, { a, b, count: 1 });
    }
  }
  for (const { a, b, count } of edges.values()) if (count === 1) {
    face(a, b, foot(a)); face(b, foot(b), foot(a));
  }
  for (const triangle of compactCapPlanes(triangles)) for (const point of triangle) {
    values.push(...point.clone().applyMatrix4(toWorld).toArray());
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3)); geometry.computeVertexNormals(); geometry.computeBoundingBox();
  return geometry;
}

/** Only constructed axis planes qualify. Sloping, curved and warped roof facets
 * retain their original triangles. Boundary loops keep holes and sharp steps.
 */
function compactCapPlanes(triangles: readonly THREE.Vector3[][]): readonly THREE.Vector3[][] {
  const preserved: THREE.Vector3[][] = [];
  const groups = new Map<string, { axis: 0 | 1 | 2; sign: number; faces: THREE.Vector3[][] }>();
  for (const triangle of triangles) {
    const axis = ([0, 1, 2] as const).find(a => triangle.every(p => p.getComponent(a) === triangle[0]!.getComponent(a)));
    if (axis === undefined) { preserved.push(triangle); continue; }
    const [u, v] = axis === 0 ? [1, 2] as const : axis === 1 ? [0, 2] as const : [0, 1] as const;
    const [a, b, c] = triangle;
    const area = (b!.getComponent(u) - a!.getComponent(u)) * (c!.getComponent(v) - a!.getComponent(v))
      - (b!.getComponent(v) - a!.getComponent(v)) * (c!.getComponent(u) - a!.getComponent(u));
    if (area === 0) { preserved.push(triangle); continue; }
    const sign = Math.sign(area), key = `${axis}/${triangle[0]!.getComponent(axis)}/${sign}`;
    const group = groups.get(key);
    if (group) group.faces.push(triangle); else groups.set(key, { axis, sign, faces: [triangle] });
  }
  for (const { axis, sign, faces } of groups.values()) {
    preserved.push(...(compactCapPlane(faces, axis, sign) ?? faces));
  }
  return preserved;
}

function compactCapPlane(faces: readonly THREE.Vector3[][], axis: 0 | 1 | 2, sign: number): THREE.Vector3[][] | undefined {
  const [u, v] = axis === 0 ? [1, 2] as const : axis === 1 ? [0, 2] as const : [0, 1] as const;
  const key = (p: THREE.Vector3): string => `${p.getComponent(u)}/${p.getComponent(v)}`;
  const vertices = new Map<string, THREE.Vector3>();
  const edges = new Map<string, { from: string; to: string; count: number }>();
  for (const face of faces) for (let i = 0; i < face.length; i++) {
    const a = face[i]!, b = face[(i + 1) % face.length]!, from = key(a), to = key(b);
    if (from === to) continue;
    vertices.set(from, a); vertices.set(to, b);
    const id = [from, to].sort().join('|'), edge = edges.get(id);
    if (edge) {
      if (edge.count !== 1 || edge.from !== to || edge.to !== from) return;
      edge.count++;
    } else edges.set(id, { from, to, count: 1 });
  }
  const next = new Map<string, string>(), incoming = new Set<string>();
  for (const edge of edges.values()) if (edge.count === 1) {
    if (next.has(edge.from) || incoming.has(edge.to)) return;
    next.set(edge.from, edge.to); incoming.add(edge.to);
  }
  const loops: THREE.Vector3[][] = [];
  while (next.size) {
    const first = next.keys().next().value;
    if (first === undefined) return;
    const loop: THREE.Vector3[] = []; let current = first;
    do {
      const point = vertices.get(current), following = next.get(current);
      if (!point || !following) return;
      loop.push(point); next.delete(current); current = following;
    } while (current !== first);
    let changed = true;
    while (changed && loop.length > 3) {
      changed = false;
      for (let i = 0; i < loop.length; i++) {
        const a = loop[(i + loop.length - 1) % loop.length]!, b = loop[i]!, c = loop[(i + 1) % loop.length]!;
        const ab = new THREE.Vector2(b.getComponent(u) - a.getComponent(u), b.getComponent(v) - a.getComponent(v));
        const bc = new THREE.Vector2(c.getComponent(u) - b.getComponent(u), c.getComponent(v) - b.getComponent(v));
        if (ab.dot(bc) > 0 && ab.cross(bc) ** 2 <= 1e-24 * ab.lengthSq() * bc.lengthSq()) {
          loop.splice(i, 1); changed = true; break;
        }
      }
    }
    if (loop.length < 3) return;
    loops.push(loop);
  }
  const projected = loops.map(loop => loop.map(p => new THREE.Vector2(p.getComponent(u), p.getComponent(v))));
  const area = (loop: readonly THREE.Vector2[]): number => loop.reduce((sum, p, i) => sum + p.cross(loop[(i + 1) % loop.length]!), 0) / 2;
  const contains = (loop: readonly THREE.Vector2[], point: THREE.Vector2): boolean => {
    let inside = false;
    for (let i = 0, j = loop.length - 1; i < loop.length; j = i++) {
      const a = loop[i]!, b = loop[j]!;
      if ((a.y > point.y) !== (b.y > point.y) && point.x < (b.x - a.x) * (point.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
    }
    return inside;
  };
  const parents = projected.map((loop, i) => {
    let parent = -1, parentArea = Infinity;
    for (let j = 0; j < projected.length; j++) if (j !== i && contains(projected[j]!, loop[0]!)) {
      const size = Math.abs(area(projected[j]!));
      if (size < parentArea && size > Math.abs(area(loop))) { parent = j; parentArea = size; }
    }
    return parent;
  });
  const depth = (index: number): number => { let d = 0; for (let p = parents[index]!; p >= 0; p = parents[p]!) d++; return d; };
  const result: THREE.Vector3[][] = [];
  for (let i = 0; i < loops.length; i++) if (depth(i) % 2 === 0) {
    const holes = loops.map((_, index) => index).filter(index => parents[index] === i && depth(index) % 2 === 1);
    const points = [loops[i]!, ...holes.map(h => loops[h]!)].flat();
    const indices = THREE.ShapeUtils.triangulateShape(projected[i]!, holes.map(h => projected[h]!));
    for (const ids of indices) {
      const a = points[ids[0]!]!, b = points[ids[1]!]!, c = points[ids[2]!]!;
      const winding = (b.getComponent(u) - a.getComponent(u)) * (c.getComponent(v) - a.getComponent(v))
        - (b.getComponent(v) - a.getComponent(v)) * (c.getComponent(u) - a.getComponent(u));
      result.push(Math.sign(winding) === sign ? [a, b, c] : [a, c, b]);
    }
  }
  const triangleArea = (triangle: readonly THREE.Vector3[]): number => new THREE.Triangle(triangle[0]!, triangle[1]!, triangle[2]!).getArea();
  const originalArea = faces.reduce((sum, face) => sum + triangleArea(face), 0);
  const compactArea = result.reduce((sum, face) => sum + triangleArea(face), 0);
  if (!result.length || result.length >= faces.length || Math.abs(originalArea - compactArea) > 1e-12 * Math.max(1, originalArea)) return;
  return result;
}
