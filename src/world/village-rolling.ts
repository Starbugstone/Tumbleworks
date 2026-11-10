import { Vector3 } from 'three';
import {railContactForces} from './village-rail-contact';
import type { VillagePort } from './village-plan';

export interface RollingSpan {
  readonly stop: number;
  readonly kind: 'contact' | 'connector';
  readonly points: readonly VillagePort[];
  /** Legacy metadata; all spans now require compressive support. */
  readonly requireSupportReaction?: boolean;
}
export interface RollingInterval extends RollingSpan {
  readonly start: number;
  readonly end: number;
}
interface Cell {
  readonly a: VillagePort; readonly b: VillagePort;
  readonly stop: number; readonly kind: RollingSpan['kind'];
  readonly start: number; readonly end: number;
  readonly distance: number; readonly length: number;
  readonly speed: number; readonly acceleration: number;
}
export interface RollingVertexWitness {
  readonly vertex:number;readonly stop:number;readonly kind:RollingSpan['kind'];readonly time:number;
  readonly point:VillagePort;readonly speed:number;readonly acceleration:number;
  readonly tangent:readonly[number,number,number];readonly normal:readonly[number,number,number];
  readonly forcePerMass:readonly[number,number,number];readonly reactionPerMass:number;readonly coneRatio:number;
}
const witnessedRuns=new WeakMap<VillageRollingRun,{cells:readonly Cell[];gravity:number;resistance:number;inertia:number;contact:RollingContact}>();
export interface RollingContact {
  readonly profile?: 'floor' | 'twinrail';
  readonly traction?: number;
  readonly precedingPoint?: VillagePort;
  /** Constructor/proof-only opt-in for the actual selected dock consumer. */
  readonly retainWitness?:boolean;
}
export interface RollingTarget {
  set(x: number, y: number, z: number): unknown;
}

/** Solid-sphere rolling on a fixed surface. Energy is per unit marble mass.
 * Authored subdivision and station labels do not introduce braking or work.
 * Source speed must come from a resolved upstream exit or visible drive.
 */
export class VillageRollingRun {
  readonly intervals: readonly RollingInterval[];
  readonly duration: number;
  readonly length: number;
  readonly exitSpeed: number;
  private readonly cells: readonly Cell[];
  distance = 0;
  speed = 0;

  constructor(spans: readonly RollingSpan[], initialSpeed: number, start = 0,
    gravity = 9.81, resistance = 0, inertiaFactor = 1.4, contact: RollingContact = {}) {
    if (![initialSpeed, start, gravity, resistance, inertiaFactor].every(Number.isFinite)
      || initialSpeed < 0 || gravity <= 0 || resistance < 0 || inertiaFactor < 1) throw new Error('Invalid rolling energy');
    const cells: Cell[] = [], intervals: RollingInterval[] = [];
    let time = start, speed = initialSpeed, distance = 0;
    for (const span of spans) {
      const begin = time;
      for (let i = 1; i < span.points.length; i++) {
        const a = span.points[i - 1]!, b = span.points[i]!;
        const length = Math.hypot(b.position[0] - a.position[0], b.position[1] - a.position[1], b.position[2] - a.position[2]);
        if (!Number.isFinite(length)) throw new Error('Invalid rolling path');
        if (length === 0) continue;
        const acceleration = -(gravity * (b.position[1] - a.position[1]) / length + resistance) / inertiaFactor;
        const squared = speed * speed + 2 * acceleration * length;
        if (squared < 0) throw new Error(`Insufficient rolling energy at stop ${span.stop} ${span.kind} edge ${i}`);
        const next = Math.sqrt(squared);
        if (speed + next === 0) throw new Error(`No physical departure at stop ${span.stop}`);
        const end = time + 2 * length / (speed + next);
        cells.push({ a, b, stop: span.stop, kind: span.kind, start: time, end, distance, length, speed, acceleration });
        time = end; speed = next; distance += length;
      }
      intervals.push({ ...span, start: begin, end: time });
    }
    if (!cells.length) throw new Error('Empty rolling run');
    validateRollingContact(cells, gravity, resistance, inertiaFactor, contact);
    if(contact.retainWitness)witnessedRuns.set(this,{cells,gravity,resistance,inertia:inertiaFactor,contact:{...contact}});
    this.cells = cells; this.intervals = intervals;
    this.duration = time - start; this.length = distance; this.exitSpeed = speed;
  }

  /** Replays the SAME validated operator on this owned run, never a caller's speed/cells. */
  contactWitnesses(tick:()=>void=()=>{}):readonly RollingVertexWitness[]{const source=witnessedRuns.get(this);if(!source)throw Error('Run did not retain the actual contact operator');const out:RollingVertexWitness[]=[];validateRollingContact(source.cells,source.gravity,source.resistance,source.inertia,source.contact,w=>out.push(w),tick);return out;}

  /** Absolute seek, no allocations and no mutable integration history. */
  sample(seconds: number, target: RollingTarget, normal?: RollingTarget): void {
    if (!Number.isFinite(seconds)) throw new Error('Village time must be finite');
    const cells = this.cells;
    const t = Math.max(cells[0]!.start, Math.min(cells[cells.length - 1]!.end, seconds));
    let low = 0, high = cells.length - 1;
    while (low < high) { const mid = (low + high) >>> 1; if (cells[mid]!.end < t) low = mid + 1; else high = mid; }
    const c = cells[low]!, dt = t - c.start;
    const travelled = c.speed * dt + 0.5 * c.acceleration * dt * dt;
    const f = travelled / c.length;
    const a = c.a.position, b = c.b.position;
    target.set(a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f);
    if (normal) {
      const a = c.a.normal, b = c.b.normal;
      const x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, z = a[2] + (b[2] - a[2]) * f;
      const length = Math.hypot(x, y, z);
      normal.set(x / length, y / length, z / length);
    }
    this.distance = c.distance + travelled;
    this.speed = c.speed + c.acceleration * dt;
  }
}

/** Curvature comes from actual centre geometry in arc length, not the magnitude
 * or spacing of authored tangent vectors. A seam is another shared vertex. */
function validateRollingContact(cells: readonly Cell[], gravity: number, resistance: number,
  inertia: number, contact: RollingContact, publish?:(w:RollingVertexWitness)=>void,tick?:()=>void): void {
  const mu=contact.traction??.8, rail=contact.profile==='twinrail';
  if(!Number.isFinite(mu)||mu<0)throw new Error('Invalid rolling traction');
  const railSin=.22/.355,railCos=Math.sqrt(1-railSin*railSin);
  const expected=rail?1+.4/(railCos*railCos):1.4;
  if(Math.abs(inertia-expected)>1e-8)throw new Error('Rolling inertia disagrees with contact profile');
  const delta=(a:VillagePort,b:VillagePort)=>new Vector3(...b.position).sub(new Vector3(...a.position));
  for(let i=0;i<=cells.length;i++){
    tick?.();
    const left=i?cells[i-1]:undefined,right=cells[i];
    const owner=right??left!,point=right?.a??left!.b;
    if(left&&right&&delta(left.b,right.a).length()>1e-7)throw new Error('Disconnected rolling seam');
    const incoming=left?delta(left.a,left.b):contact.precedingPoint?delta(contact.precedingPoint,point):undefined;
    const outgoing=right?delta(right.a,right.b):undefined;
    const il=incoming?.length()??0,ol=outgoing?.length()??0;
    if(incoming&&il>0)incoming.multiplyScalar(1/il);
    if(outgoing&&ol>0)outgoing.multiplyScalar(1/ol);
    const tangent=incoming&&outgoing?incoming.clone().multiplyScalar(ol).addScaledVector(outgoing,il).normalize():(incoming??outgoing)!.clone();
    const curvature=incoming&&outgoing?outgoing.clone().sub(incoming).multiplyScalar(2/(il+ol)):new Vector3();
    curvature.addScaledVector(tangent,-curvature.dot(tangent));
    const normal=new Vector3(...point.normal).addScaledVector(tangent,-new Vector3(...point.normal).dot(tangent)).normalize();
    if(normal.lengthSq()<.99||tangent.lengthSq()<.99)throw new Error('Invalid rolling support frame');
    const speed=right?right.speed:Math.sqrt(left!.speed**2+2*left!.acceleration*left!.length);
    const acceleration=-(gravity*tangent.y+resistance)/inertia;
    const force=curvature.multiplyScalar(speed*speed).addScaledVector(tangent,acceleration).add(new Vector3(0,gravity,0));
    const reaction=force.dot(normal);
    const location=`stop ${owner.stop} ${owner.kind} vertex ${i} at ${point.position.join(',')} v=${speed}`;
    if(reaction<=0)throw new Error(`Loss of rolling support at ${location}: N/m=${reaction}`);
    const witnessedForce=publish?force.toArray():undefined;
    let required:number;
    if(rail){
      const side=new Vector3().crossVectors(tangent,normal);
      const lateral=force.dot(side),limit=(railSin+mu*railCos)/(railCos-mu*railSin);
      if(railCos>mu*railSin&&Math.abs(lateral)>reaction*limit+1e-8)throw new Error(`Insufficient twinrail traction at ${location}: lateral/m=${lateral}, compressive cone limit=${reaction*limit}`);
      if(!railContactForces(force,normal,side,mu))throw new Error(`Unresolved twinrail traction at ${location}: N/m=${reaction}, lateral/m=${force.dot(side)}`);
      required=0;
    }else required=force.addScaledVector(normal,-reaction).length()/reaction;
    if(required>mu+1e-8)throw new Error(`Insufficient rolling traction at ${location}: required mu=${required}, available=${mu}`);
    publish?.({vertex:i,stop:owner.stop,kind:owner.kind,time:right?.start??left!.end,point,speed,acceleration,tangent:tangent.toArray(),normal:normal.toArray(),forcePerMass:witnessedForce!,reactionPerMass:reaction,coneRatio:required});
  }
}
