import type{VillageAxle}from'./village-axle';
import type{NativeInput}from'./axle-types';
import { connectorSupportFrames } from './village-plan';
import type{NativeHingeInput}from'./gravity-hinge-support';
import{certifyCarrierWelds,type CarrierWeldId,type CarrierWeldPart}from'./village-captive-welds';
import type {RetainedLayout} from './village-inventory';
import {VillageOrientation} from './village-orientation';
import {VillageAdmissibilityError,type VillageLedgerEntry,type VillageContactWitness} from './village-contact';
import { VillageTerminalPath } from './village-terminal';
import * as THREE from 'three';
import { carrierEdges, carrierContact, hasVillageCarrier, isVillageTrack, mechanismMatrix, stationPorts, villageEase } from '../view/machine-primitives';
import { VILLAGE_DURATION, villagePort } from './village-plan';
import type { VillageBearingSeat, VillageConnector, VillagePlan, VillagePort, VillageVec3 } from './village-plan';
import { VillageRollingRun } from './village-rolling';
import type { VillageAuxiliary, VillageAuxiliaryPose } from './village-motion';
import { VillageRollingPrefix } from './village-prefix';
import type { GravityCarrierPose } from './village-gravity-carrier';
import type { RetainedPose, RetainedDriveWitness } from './village-retained';

const dot = (a: VillageVec3, b: VillageVec3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const distance = (a: VillageVec3, b: VillageVec3): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export function validateVillagePort(port: VillagePort): void {
  if (![...port.position, ...port.tangent, ...port.normal, port.width].every(Number.isFinite)
    || port.width < 0.8 || Math.abs(dot(port.tangent, port.tangent) - 1) > 1e-6
    || Math.abs(dot(port.normal, port.normal) - 1) > 1e-6 || Math.abs(dot(port.tangent, port.normal)) > 1e-6) {
    throw new Error('Invalid village port frame or width');
  }
}
export function assertVillagePortMatch(a: VillagePort, b: VillagePort): void {
  validateVillagePort(a); validateVillagePort(b);
  if (distance(a.position, b.position) > 1e-6 || distance(a.tangent, b.tangent) > 1e-6
    || distance(a.normal, b.normal) > 1e-6 || Math.abs(a.width - b.width) > 1e-6) {
    throw new Error('Village port position, frame or width mismatch');
  }
}
/** Structural validation precedes geometry allocation; failures never leak scene resources. */
/** Terrain feet name the owner's own explicit plank supports, strictly ascending. */
function validateFootIndices(feet: readonly number[] | undefined, allowed: readonly number[]): void {
  if (feet===undefined) return;
  if (!Array.isArray(feet)||feet.length===0) throw new Error('Invalid terrain feet');
  for(let k=0;k<feet.length;k++) if(!Object.hasOwn(feet,k)||!Number.isInteger(feet[k])||!allowed.includes(feet[k]!)||(k>0&&feet[k]!<=feet[k-1]!)) throw new Error('Invalid terrain feet');
}
function validateTerrainFeet(plan: VillagePlan, feet: readonly number[] | undefined, supports: readonly VillageVec3[] | undefined): void {
  if(feet===undefined)return;
  if(plan.profile!=='plank'||!supports)throw new Error('Invalid terrain feet');
  validateFootIndices(feet,Array.from({length:supports.length},(_,i)=>i));
  for(const i of feet){const p=supports[i];if(!Array.isArray(p)||p.length!==3||![0,1,2].every(k=>Object.hasOwn(p,k)&&Number.isFinite(p[k])))throw new Error('Invalid terrain feet support');}
}
function validateBearingSeats(plan: VillagePlan, seats: readonly VillageBearingSeat[] | undefined,
  supports: readonly VillageVec3[] | undefined, points: readonly VillagePort[] | undefined): void {
  if (seats === undefined) return;
  const bad = () => new Error('Invalid bearing seats');
  if (plan.profile !== 'plank' || !Array.isArray(supports) || !Array.isArray(points)
    || !Array.isArray(seats) || seats.length === 0) throw bad();
  for (let k = 0; k < seats.length; k++) {
    if (!Object.hasOwn(seats, k)) throw bad();
    const s = seats[k];
    if (!s || typeof s !== 'object' || Array.isArray(s)
      || !Object.hasOwn(s, 'support') || !Object.hasOwn(s, 'frame')
      || !Number.isInteger(s.support) || s.support < 0 || s.support >= supports.length
      || (k > 0 && s.support <= seats[k - 1]!.support)
      || !Number.isInteger(s.frame) || s.frame < 0 || s.frame >= points.length
      || (s.joint !== undefined && !(s.joint === 'entry' && s.frame === 0)
        && !(s.joint === 'exit' && s.frame === points.length - 1))) throw bad();
    const p = supports[s.support];
    if (!Object.hasOwn(supports, s.support) || !Array.isArray(p) || p.length !== 3
      || ![0, 1, 2].every(i => Object.hasOwn(p, i) && Number.isFinite(p[i]))) throw bad();
    if (!Object.hasOwn(points, s.frame)) throw bad();
  }
}

// Replace110's omit.some condition with this helper call at its existing site.
// Native support-graph proof is STILL required; data validation cannot prove an omitted pier redundant.
function validateOmittedAutomaticFrames(link: VillageConnector, defaults: readonly number[]): void {
  const omit = link.omitAutomaticFrames;
  if (omit === undefined) return;
  const bad = () => new Error('Invalid omitted automatic frames');
  if (link.supports !== undefined || !Array.isArray(omit) || omit.length === 0
    || omit.length >= defaults.length) throw bad();
  for (let k = 0; k < omit.length; k++) {
    if (!Object.hasOwn(omit, k)) throw bad();
    const i = omit[k]!;
    if (!Number.isInteger(i) || !defaults.includes(i)
      || (k > 0 && i <= omit[k - 1]!) || link.terrainFrameFeet?.includes(i)) throw bad();
  }
}

function validateFixedEnds(plan:VillagePlan,link:VillageConnector):void{
 const ends=link.fixedEnds;if(ends===undefined)return;
 if(plan.staticSupports!=='harbour-static-112'||plan.chapter!==0||plan.profile!=='plank'||link.from!==4||link.to!==3||!Array.isArray(ends)||ends.length!==2||!Object.hasOwn(ends,0)||!Object.hasOwn(ends,1)||ends[0]!=='source'||ends[1]!=='destination')throw Error('Invalid fixed material ends');
 for(const stop of[link.from,link.to]){const station=plan.stations.find(s=>s.stop===stop);if(!station||!isVillageTrack(station.mechanism))throw Error('Fixed material end is moving/absent');}
}
export function validateVillagePlan(plan: VillagePlan): void {
 if(plan.staticSupports!==undefined&&(plan.staticSupports!=='harbour-static-112'||plan.chapter!==0||plan.profile!=='plank'))throw Error('Invalid static support model');

  if (!['plank', 'terracotta', 'timber', 'twinrail', 'girder', 'steel'].includes(plan.profile)) throw new Error('Village requires an explicit track profile');
  if (!Number.isInteger(plan.chapter) || plan.chapter < 0) throw new Error('Invalid numeric chapter');
  if (plan.stations.length !== 10 || new Set(plan.stations.map(s => s.stop)).size !== 10) throw new Error('Village requires ten stable stops');
  const ordered = [...plan.stations].sort((a, b) => b.stop - a.stop);
  for (const [index, station] of ordered.entries()) {
    if (station.stop !== 9 - index) throw new Error('Invalid stable stop');
    validateVillagePort(station.entry); validateVillagePort(station.exit);
    validateTerrainFeet(plan, station.terrainFeet, station.supports);
    validateBearingSeats(plan,station.bearingSeats,station.supports,isVillageTrack(station.mechanism)?station.mechanism.points:undefined);
    if(station.supportIndices){
      const m=station.mechanism;
      if(!isVillageTrack(m)||station.supportIndices.length===0||new Set(station.supportIndices).size!==station.supportIndices.length
        ||station.supportIndices.some(i=>!Number.isInteger(i)||i<0||i>=m.points.length))throw new Error('Invalid explicit support frame indices');
    }
    if ('pivot' in station.mechanism) {
      const m = station.mechanism, contact = carrierContact(m);
      const delta: VillageVec3 = [contact[0] - m.pivot[0], contact[1] - m.pivot[1], contact[2] - m.pivot[2]];
      const axial = dot(delta, m.axis);
      const gap = Math.sqrt(Math.max(0, dot(delta, delta) - axial ** 2) + Math.max(0, Math.abs(axial) - 0.35) ** 2);
      if (gap < 0.39) throw new Error('Carrier shaft intersects marble contact');
    }
    const ports = stationPorts(station); assertVillagePortMatch(station.entry, ports.entry); assertVillagePortMatch(station.exit, ports.exit);
    if (!Number.isFinite(station.contact) || station.contact < station.start || station.contact > station.end) throw new Error('Invalid causal contact');
    if (!isVillageTrack(station.mechanism) && (station.contact <= station.start || station.contact >= station.end)) throw new Error('Carrier needs approach and departure dwell');
    const duration = station.end - station.start;
    if (!Number.isFinite(duration) || duration < 0.8 || duration > 4 || station.start < 0 || station.end > 23.8) throw new Error('Invalid contact window');
    const previous = ordered[index - 1];
    if (previous && (station.start < previous.end || station.start - previous.end > 2.5)) throw new Error('Invalid connector window');
    if (previous && station.start === previous.end && distance(previous.exit.position, station.entry.position) > 1e-6) throw new Error('Nonempty connector needs travel time');
  }
  if (ordered[0]!.contact > 2.5) throw new Error('First contact is late');
  if (plan.connectors.length !== 9) throw new Error('Village requires nine explicit connections');
  for (let index = 0; index < 9; index++) {
    const source = ordered[index]!, destination = ordered[index + 1]!;
    const links = plan.connectors.filter(link => link.from === source.stop && link.to === destination.stop);
    if (links.length !== 1) throw new Error('Missing or duplicate connection');
    const points = links[0]!.points;
    validateTerrainFeet(plan, links[0]!.terrainFeet, links[0]!.supports);
    validateBearingSeats(plan,links[0]!.bearingSeats,links[0]!.supports,points);
    const supportFrames=links[0]!.supportIndices??connectorSupportFrames(points);
    if(links[0]!.supportIndices!==undefined){if(links[0]!.supports!==undefined)throw new Error('Conflicting connector supports');validateFootIndices(supportFrames,points.map((_,i)=>i));}
    validateOmittedAutomaticFrames(links[0]!,supportFrames);validateFixedEnds(plan,links[0]!);
    const frameFeet=links[0]!.terrainFrameFeet;
    if(frameFeet!==undefined){if(plan.profile!=='plank'||links[0]!.supports!==undefined)throw new Error('Invalid terrain frame feet');validateFootIndices(frameFeet,supportFrames);}
    if (points.length < 2) throw new Error('Connection needs endpoint frames');
    points.forEach(validateVillagePort);
    assertVillagePortMatch(source.exit, points[0]!);
    assertVillagePortMatch(destination.entry, points[points.length - 1]!);
    for (let p = 1; p < points.length; p++) {
      if (Math.abs(points[p]!.width - points[p - 1]!.width) > 1e-6) throw new Error('Connector width mismatch');
    }
  }
}

export interface VillageContactRecord {
  readonly stop: number; readonly start: number; readonly contact: number; readonly end: number;
  readonly moverIds: readonly string[];
}
export interface VillageSegment {
  readonly stop: number; readonly start: number; readonly end: number;
  readonly kind: 'contact' | 'connector'; readonly points: readonly VillagePort[];
  readonly lengths: readonly number[];
}
export interface VillageTimeBoundary {
  readonly stop: number; readonly kind: 'contact' | 'connector';
  readonly authoredStart: number; readonly authoredEnd: number;
  readonly start: number; readonly end: number;
}
export interface VillageTransferInterval {
  readonly stop: number;
  readonly kind: 'capture' | 'carry' | 'release' | 'strike';
  readonly start: number; readonly end: number;
}
export interface VillageHandoff {
  readonly entry: VillagePort;
  readonly entryTime: number;
  readonly causeTime: number;
}
function segmentLengths(points: readonly VillagePort[]): readonly number[] {
  const lengths = [0];
  for (let index = 1; index < points.length; index++) lengths.push(lengths[index - 1]! + distance(points[index - 1]!.position, points[index]!.position));
  return lengths;
}
export function carrierProgress(station: VillagePlan['stations'][number], seconds: number): number {
  const length = station.end - station.contact;
  return length > 0 ? Math.max(0, Math.min(1, (seconds - station.contact) / (length * 0.8))) : Number(seconds >= station.end);
}

/** Pure absolute-time seeking. The renderer consumes this exact carrier transform. */
export class VillageProgram {
  readonly mode='physical' as const;
  get playback(){return this.motionStatus.state==='ready'?{state:'ready' as const}:{state:'unavailable' as const,reason:this.motionStatus.reason};}
  readonly physicalLedger:readonly VillageLedgerEntry[]=Object.freeze([]);
  readonly admissibility?:VillageAdmissibilityError;
  private readonly orientation:VillageOrientation;
  readonly plan: VillagePlan;
  readonly authoredPlan: VillagePlan;
  readonly duration: number;
  /** Explicit authoring facade until a carrier's physical drive is compiled.
   * Consumers must require ready before presenting a physical film.
   */
  private readonly compiledMotionStatus: { readonly state: 'ready' } | { readonly state: 'authoring'; readonly reason: string };
  get motionStatus(): { readonly state:'ready' }|{readonly state:'authoring';readonly reason:string}{
    if(this.prefix?.axles.length)for(const axle of this.prefix.axles)if(axle.proof.state!=='enrolled')return{state:'authoring',reason:`Stop ${axle.station.stop}: axle native proof pending`};
    const rocker=this.prefix?.gravity.find(m=>m.supportPending);
    if(rocker)return{state:'authoring',reason:`Stop ${rocker.station.stop}: actual finite rocker journal/seat/weld/anchor/merged-buffer certificate pending`};
    const pending=this.prefix?.retained.find(m=>m.carrierProofPending);
    return pending?{state:'authoring',reason:`Stop ${pending.station.stop}: actual carrier weld/fixed-side certificate pending`}:this.compiledMotionStatus;
  }
  readonly segments: readonly VillageSegment[];
  readonly contacts: readonly VillageContactRecord[];
  readonly beats: readonly VillageContactRecord[];
  readonly cuts: readonly number[];
  readonly boundaries: readonly VillageTimeBoundary[];
  readonly transfers: readonly VillageTransferInterval[];
  readonly handoff: VillageHandoff;
  private readonly terminalPaths = new Map<number,VillageTerminalPath>();
  private readonly lengths: number[] = [];
  private readonly matrix = new THREE.Matrix4();
  private readonly normalPoint = new THREE.Vector3();
  private readonly stations: VillagePlan['stations'];
  private readonly rolling?: VillageRollingRun;
  private readonly prefix?: VillageRollingPrefix;
  private readonly gravityPose: GravityCarrierPose={x:0,angle:0,progress:0};
  private readonly retainedPose: RetainedPose = { localX: 0, progress: 0, forkX: 0, forkAngle: 0, forkLift: 0, weightDrop: 0 };
  distance = 0;
  constructor(plan: VillagePlan) {
    validateVillagePlan(plan);
    for(const station of plan.stations)if(station.terminalCapture)this.terminalPaths.set(station.stop,new VillageTerminalPath(station));
    this.authoredPlan = plan;
    this.stations = [...plan.stations].sort((a, b) => a.stop - b.stop);
    this.contacts = [...this.stations].reverse().map(s => ({ stop: s.stop, start: s.start, contact: s.contact, end: s.end,
      moverIds: s.terminalCapture ? [`village-${s.stop}-damper`] : isVillageTrack(s.mechanism) ? [] : [...(hasVillageCarrier(s.mechanism) ? [`village-${s.stop}-carrier`] : []), ...(['wheelbucket', 'translating', 'suspended'].includes(s.mechanism.kind) ? [`village-${s.stop}-weight`] : []), ...(s.retention?.opening==='captive-leaf'?[`village-${s.stop}-fork`,`village-${s.stop}-capture-head`,`village-${s.stop}-head-frame`]:[]), ...(s.mechanism.kind === 'wheelbucket' ? [`village-${s.stop}-wheel`] : s.mechanism.kind === 'escapement' || s.mechanism.kind === 'striker' ? [`village-${s.stop}-${s.mechanism.kind}`, ...(s.mechanism.kind === 'escapement' ? [`village-${s.stop}-gear`, `village-${s.stop}-top`] : [])] : [])] }));
    this.beats = this.contacts;
    this.cuts = plan.camera.slice(1).map(s => s.start);
    const segments: VillageSegment[] = [];
    for (let stop = 9; stop >= 0; stop--) {
      const s = this.stations[stop]!;
      const points = isVillageTrack(s.mechanism) ? s.mechanism.points : [s.entry, s.exit];
      segments.push({ stop, start: s.start, end: s.end, kind: 'contact', points, lengths: segmentLengths(points) });
      if (stop > 0) {
        const next = this.stations[stop - 1]!, connector = plan.connectors.find(c => c.from === stop)!;
        segments.push({ stop, start: s.end, end: next.start, kind: 'connector', points: connector.points, lengths: segmentLengths(connector.points) });
      }
    }
    this.segments = segments;
    const fixedRails = this.stations.every(station => isVillageTrack(station.mechanism));
    const terminalBrake = this.stations.some(station => station.terminalCapture);
    if (fixedRails && !terminalBrake) {
      // A resting marble can start on a descending run without supplied energy.
      // Flat starts and unreachable rises fail explicitly, never receive a floor speed.
      const inertia = plan.profile === 'twinrail' ? 1 + 0.4 / (1 - (0.22 / (0.3 + 0.055)) ** 2) : 1.4;
      this.rolling = new VillageRollingRun(segments.map(segment => ({ ...segment,
        requireSupportReaction: segment.kind === 'contact' && this.stations[segment.stop]!.mechanism.kind === 'loop',
      })), 0, this.stations[9]!.start, 9.81, 0, inertia, {profile:plan.profile==='twinrail'?'twinrail':'floor',traction:.8});
      this.segments = this.rolling.intervals.map(interval => ({ ...interval, lengths: segmentLengths(interval.points) }));
      this.contacts = this.segments.filter(segment => segment.kind === 'contact').map(segment => ({
        stop: segment.stop, start: segment.start, contact: segment.start, end: segment.end, moverIds: [],
      }));
      this.beats = this.contacts;
      this.duration = this.stations[9]!.start + this.rolling.duration;
      this.plan = { ...plan, stations: plan.stations.map(station => {
        const contact = this.contacts.find(value => value.stop === station.stop)!;
        return { ...station, start: contact.start, contact: contact.contact, end: contact.end };
      }) };
      this.boundaries = this.segments.map((segment, index) => ({ stop: segment.stop, kind: segment.kind,
        authoredStart: segments[index]!.start, authoredEnd: segments[index]!.end, start: segment.start, end: segment.end }));
      this.transfers = [];
      const initial = this.stations[9]!, held = initial.initialCargo;
    let handoffEntry = initial.entry;
    if (held) {
      const position = new THREE.Vector3(held.localX, 0, 0).applyMatrix4(mechanismMatrix(initial.mechanism, initial.anchor, 0, this.matrix));
      handoffEntry = villagePort(position.toArray(), initial.entry.tangent, initial.entry.normal, initial.entry.width);
    }
    this.handoff = { entry: handoffEntry, entryTime: this.contacts[0]!.start, causeTime: this.contacts[0]!.contact };
      this.compiledMotionStatus = { state: 'ready' };
      this.orientation=this.compileOrientation();
      return;
    }
    let shift = 0;
    let physicalFailure: string | undefined;
    if (this.stations[9]!.releasePin || this.stations[9]!.initialCargo || (fixedRails && terminalBrake)) {
      const compiled = new VillageRollingPrefix(plan);
      this.admissibility=compiled.failure?.admissibility;
      this.physicalLedger=compiled.physicalLedger;
      physicalFailure=compiled.failure ? `Stop ${compiled.failure.stop}: ${compiled.failure.message}` : undefined;
      if (compiled.lastStop < 10) {
      this.prefix = compiled;
      const last = this.prefix.lastStop;
      shift = this.prefix.end - this.stations[last]!.end;
      const tail = segments.filter(segment => segment.stop < last || segment.stop === last && segment.kind === 'connector')
        .map(segment => ({ ...segment, start: segment.start + shift, end: segment.end + shift }));
      this.segments = [...this.prefix.segments, ...tail];
      this.contacts = [...this.prefix.contacts, ...this.contacts.filter(contact => contact.stop < last)
        .map(contact => ({ ...contact, start: contact.start + shift, contact: contact.contact + shift, end: contact.end + shift }))];
      this.beats = this.contacts;
      this.stations = this.stations.map(station => {
        const contact = this.contacts.find(value => value.stop === station.stop)!;
        return { ...station, start: contact.start, contact: contact.contact, end: contact.end };
      });
    }
    }
    if(!this.prefix&&!this.admissibility)this.admissibility=new VillageAdmissibilityError(9,'initial-release','unsupported-contact-geometry',1,0);
    this.plan = { ...plan, stations: plan.stations.map(station => this.stations[station.stop]!) };
    this.duration = this.prefix?.lastStop === 0 ? this.prefix.end + 1.2 : VILLAGE_DURATION + shift;
    for(const strike of this.prefix?.strikes??[])if(strike.actorEnd>this.duration){
      this.admissibility=new VillageAdmissibilityError(strike.stop,'striker-actor-tail','stroke',strike.actorEnd,this.duration);
      physicalFailure=this.admissibility.message;
    }
    for(const rocker of this.prefix?.gravity??[])if(rocker.rocker&&rocker.actorEnd>this.duration){this.admissibility=new VillageAdmissibilityError(rocker.station.stop,'rocker-actor-tail','stroke',rocker.actorEnd,this.duration);physicalFailure=this.admissibility.message;}
    this.boundaries = this.segments.map((segment, index) => ({ stop: segment.stop, kind: segment.kind,
      authoredStart: segments[index]!.start, authoredEnd: segments[index]!.end, start: segment.start, end: segment.end }));
    this.transfers = this.contacts.filter(contact => (!this.prefix || contact.stop < this.prefix.lastStop)
      && hasVillageCarrier(this.stations[contact.stop]!.mechanism))
      .map(contact => ({ stop: contact.stop, kind: 'carry', start: contact.contact,
        end: contact.contact + (contact.end - contact.contact) * 0.8 }));
    if (this.prefix) this.transfers = [...this.prefix.transfers, ...this.transfers];
    const initial = this.stations[9]!, held = initial.initialCargo;
    let handoffEntry = initial.entry;
    if (held) {
      const position = new THREE.Vector3(held.localX, 0, 0).applyMatrix4(mechanismMatrix(initial.mechanism, initial.anchor, 0, this.matrix));
      handoffEntry = villagePort(position.toArray(), initial.entry.tangent, initial.entry.normal, initial.entry.width);
    }
    this.handoff = { entry: handoffEntry, entryTime: this.contacts[0]!.start, causeTime: this.contacts[0]!.contact };
    this.compiledMotionStatus = this.prefix?.lastStop === 0&&!this.admissibility ? { state: 'ready' } : { state: 'authoring', reason: physicalFailure ?? (this.prefix
      ? `Physical rolling/contact prefix ends at stop ${this.prefix.lastStop}; later carriers still require physical compilation`
      : 'Carrier drives and physical captures have not yet been compiled') };
    const previous = new THREE.Vector3(), point = new THREE.Vector3();
    this.samplePoint(0, previous); this.lengths.push(0);
    for (let frame = 1; frame <= Math.ceil(this.duration * 120); frame++) {
      this.samplePoint(Math.min(this.duration, frame / 120), point);
      this.lengths.push(this.lengths[frame - 1]! + point.distanceTo(previous)); previous.copy(point);
    }
    this.orientation=this.compileOrientation();
  }
  private compileOrientation():VillageOrientation {
    const radius=this.authoredPlan.profile==='twinrail'?.3*Math.sqrt(1-(.22/.355)**2):.3;
    return new VillageOrientation(this.duration,radius,(t,p,n)=>this.samplePoint(t,p,n),this.prefix?.retained??[],(stop,t,m)=>this.carrierPose(stop,t,m),this.prefix?.gravity??[],this.prefix?.terminal??[],this.prefix?.strikes.map(s=>s.motion)??[],this.prefix?.axles??[]);
  }
  marbleOrientation(seconds:number,target:THREE.Quaternion):void{this.orientation.sample(seconds,target);}
  contactWitness(stop:number,seconds:number,target:VillageContactWitness):boolean{
    const axle=this.axleMotion(stop);if(axle&&seconds>=axle.start&&seconds<=axle.end){axle.contactWitness(seconds,target);return true;}
    const strike=this.prefix?.strikes.find(s=>s.stop===stop)?.motion;
    if(strike&&seconds>=strike.contact&&seconds<=strike.end){strike.contactWitness(seconds,target);return true;}
    const terminal=this.prefix?.terminal.find(m=>m.station.stop===stop),motion=this.prefix?.retained.find(m=>m.station.stop===stop)??terminal;
    if(!motion||seconds<motion.start||seconds>(terminal?this.duration:motion.end))return false;
    motion.contactWitness(seconds,target);return true;
  }
  driveWitness(stop:number,seconds:number,target:RetainedDriveWitness):boolean {
    const motion=this.prefix?.retained.find(m=>m.station.stop===stop);
    if(!motion||seconds<motion.start||seconds>motion.end)return false;
    motion.driveWitness(seconds,target);return true;
  }
  sample(seconds: number, target: THREE.Vector3): void {
    if (this.rolling) { this.rolling.sample(seconds, target); this.distance = this.rolling.distance; return; }
    this.samplePoint(seconds, target);
    const at = Math.max(0, Math.min(this.duration, seconds)) * 120, index = Math.floor(at);
    const a = this.lengths[index]!, b = this.lengths[Math.min(index + 1, this.lengths.length - 1)]!;
    const fraction = (at - index) / Math.min(1, this.duration * 120 - index || 1);
    this.distance = a + (b - a) * fraction;
  }
  requirePhysical(): void {
    for(const motion of this.prefix?.retained??[])motion.requireCarrierProof();
    if (this.motionStatus.state !== 'ready') throw this.admissibility??new Error(this.motionStatus.reason);
  }
  normalAt(seconds: number, target: THREE.Vector3): void {
    if (this.rolling) { this.rolling.sample(seconds, this.normalPoint, target); return; }
    this.samplePoint(seconds, this.normalPoint, target);
  }
  carrierPose(stop: number, seconds: number, target: THREE.Matrix4): void {
    if (!Number.isFinite(seconds)) throw new Error('Village time must be finite');
    const station = this.stations[stop];
    if (!station) throw new Error('Unknown village stop');
    const axle=this.axleMotion(stop);if(axle){axle.carrierPose(seconds,target);return;}
    if(this.prefix) for(const motion of this.prefix.gravity) if(motion.station.stop===stop) {
      motion.bodyPose(seconds,this.gravityPose);
      mechanismMatrix(motion.station.mechanism,motion.station.anchor,this.gravityPose.progress,target);return;
    }
    if (this.prefix) for (const motion of this.prefix.retained) if (motion.station.stop === stop) {
      motion.state(seconds, this.retainedPose);
      mechanismMatrix(station.mechanism, station.anchor, this.retainedPose.progress, target); return;
    }
    mechanismMatrix(station.mechanism, station.anchor, carrierProgress(station, seconds), target);
  }
  axleDockRuns(stop:number){const motion=this.axleMotion(stop);if(!motion||!this.prefix)throw Error('Actual axle prefix required');const get=(time:number)=>{const phase=this.prefix!.phases.find(p=>p.start===time&&p.run instanceof VillageRollingRun);if(!phase||!(phase.run instanceof VillageRollingRun))throw Error('Actual causal dock run missing');return phase.run;};return{home:get(motion.approach.start),top:get(motion.end)};}
  axleMotion(stop:number):VillageAxle|undefined{const axles=this.prefix?.axles;if(axles?.length)for(let i=0;i<axles.length;i++)if(axles[i]!.station.stop===stop)return axles[i];return undefined;}
  certifyAxleNative(stop:number,input:NativeInput){const axle=this.axleMotion(stop);if(!axle)throw new Error('No actual compiled axle');axle.certifyNative(input);}
  invalidateAxleNative(stop:number){this.axleMotion(stop)?.invalidateNative();}
  get rockerLoads(){return(this.prefix?.gravity??[]).filter(g=>g.rocker).map(g=>({stop:g.station.stop,loads:g.nativeLoads,staticFamilies:g.staticFamilies,certificate:g.hingeCertificate}));}
  invalidateGravityHinge(stop:number):void{this.prefix?.gravity.find(g=>g.station.stop===stop)?.invalidateHinge();}
  certifyGravityHinge(stop:number,input:NativeHingeInput):void{const motion=this.prefix?.gravity.find(g=>g.station.stop===stop&&g.rocker);if(!motion)throw new Error('No compiled rocker owns this native certificate');motion.certifyHinge(input);}
  terminalPad(stop:number){return this.prefix?.terminal.find(m=>m.station.stop===stop)?.path.pad;}
  terminalHeadPose(stop:number,seconds:number,target:THREE.Matrix4):void {
    if(this.prefix)for(const motion of this.prefix.terminal)if(motion.station.stop===stop){motion.headPose(seconds,target);return;}
    const path=this.terminalPaths.get(stop);if(!path)throw new Error('Unknown terminal brake');
    path.headPose(path.startDistance,target);
  }
  hasCompiledRetained(stop:number):boolean{return Boolean(this.prefix?.retained.some(m=>m.station.stop===stop));}
  certifyRetainedCarrierWelds(stop:number,parts:ReadonlyMap<CarrierWeldId,CarrierWeldPart>):void {
    const motion=this.prefix?.retained.find(m=>m.station.stop===stop);if(!motion||motion.inventory.layout!=='keyed-prismatic')throw new Error('No compiled captive body owns this carrier certificate');
    const m=motion.station.mechanism;if(!('travel'in m)||typeof m.travel==='number')throw new Error('No supported carrier translation');
    certifyCarrierWelds(motion,parts,motion.retainedX+.34,this.plan.profile,m.travel[0]===0);
  }
  certifyRetainedFixedPost(stop:number,post:THREE.Mesh,collar:THREE.Mesh,carrierRest:THREE.Matrix4):void {
    const motion=this.prefix?.retained.find(m=>m.station.stop===stop);
    if(!motion?.carriageBrake||motion.inventory.layout!=='keyed-prismatic')throw new Error('No actual compiled captive carrier owns this fixed-side proof');
    const expected=new THREE.Matrix4();this.carrierPose(stop,motion.start,expected);collar.updateMatrix();if(!expected.equals(carrierRest)||!collar.matrix.equals(new THREE.Matrix4()))throw new Error('Actual collar rest/frame does not match Program ownership');
    post.updateWorldMatrix(true,false);motion.carriageBrake.certifyRenderedPost(motion.station,this.plan.profile,post.geometry,post.matrixWorld,collar.geometry,carrierRest);
  }
  retainedHeadRole(stop:number): 'keyed-planar'|'captive-leaf'|undefined {
    if(this.axleMotion(stop))return 'keyed-planar';
    const motion=this.prefix?.retained.find(m=>m.station.stop===stop);
    if(motion?.keyedHead)return motion.inventory.layout==='keyed-prismatic'?'captive-leaf':'keyed-planar';
    return this.stations[stop]?.retention?.opening==='captive-leaf'?'captive-leaf':undefined;
  }
  retainedLayout(stop:number):RetainedLayout {
    const station=this.stations[stop];if(!station?.retention)throw new Error('No retained assembly');
    const motion=this.prefix?.retained.find(m=>m.station.stop===stop);
    if(motion)return motion.inventory.layout;
    // Explicit real-rest authoring metadata is published HERE; no Scene guesses.
    return station.retention.opening==='captive-leaf'?'keyed-prismatic':this.retainedHeadRole(stop)?'keyed-split':'rigid-gate';
  }
  retainedSide(stop:number):1|-1 { return this.stations[stop]?.mechanism.kind==='wheelbucket'?1:-1; }
  retainedForkOrigin(stop: number): number {
    if (this.prefix) for (const motion of this.prefix.retained) if (motion.station.stop === stop) return motion.retainedX + motion.inputDirection * .34;
    return .34;
  }
  auxiliaryPose(stop: number, part: VillageAuxiliary, seconds: number, target: VillageAuxiliaryPose): void {
    if (!Number.isFinite(seconds)) throw new Error('Village time must be finite');
    const station = this.stations[stop];
    if (!station) throw new Error('Unknown village stop');
    const m = station.mechanism, driven = villageEase(carrierProgress(station, seconds));
    target.angle = 0; target.x = 0; target.y = 0; target.z = 0;
    const axle=this.axleMotion(stop);if(axle){if(part==='wheel'||part==='weight'||part==='capture-head')axle.auxiliaryPose(part,seconds,target);else if(part==='fork'||part==='head-frame')throw new Error('Unbuilt axle fork has no pose');return;}
    if (this.prefix) for (const strike of this.prefix.strikes) if (strike.stop === stop && part === 'striker') {
      target.angle = strike.motion.partnerAngle(seconds);
      return;
    }
    if (this.prefix) for (const motion of this.prefix.retained) if (motion.station.stop === stop) {
      motion.state(seconds, this.retainedPose);
      if (part === 'weight') target.y = -this.retainedPose.weightDrop;
      else if (part === 'fork' || part === 'capture-head'||part==='head-frame') { target.x = this.retainedPose.forkX; target.y = part==='head-frame'?0:part==='capture-head'&&motion.inventory.layout==='keyed-prismatic'?this.retainedPose.headLift!:this.retainedPose.forkLift; target.angle = part === 'fork' ? this.retainedPose.forkAngle : 0; }
      else if (part === 'wheel' && m.kind === 'wheelbucket') target.angle = m.angle * villageEase(this.retainedPose.progress);
      return;
    }
    if(m.kind==='striker'&&station.strikerDrive?.kind==='pendulum'&&part==='striker')return; // Unsupported authoring tail stays at real rest.
    if (station.releasePin && part === 'gate') { target.y = .6 * villageEase(seconds / this.handoff.entryTime); return; }
    if(station.retention?.opening==='captive-leaf'&&(part==='fork'||part==='capture-head'||part==='head-frame')){
      target.x=station.retention.captureStart+.34;target.angle=part==='fork'?-Math.PI/2:0;return;
    }
    if (station.retention && (part === 'fork' || part === 'capture-head')) {
      target.x = .34;
      target.angle = part==='fork'?-Math.PI / 2 * (1 - villageEase(carrierProgress(station, seconds) * 2)):0;
      target.y = .6 * villageEase((carrierProgress(station, seconds) - .7) / .3);
      return;
    }
    if (this.prefix) for (const event of this.prefix.events) if (event.stop === stop) {
      event.cam.sample(seconds);
      if (part === 'top') target.angle = event.cam.angle;
      else if (part === 'gear') target.angle = -event.cam.angle * 2;
      else if (part === 'gate') target.y = event.cam.lift;
      else if (part === 'striker') target.angle = Math.min(Math.PI / 2, event.cam.angle);
      return;
    }
    if (part === 'wheel' && m.kind === 'wheelbucket') target.angle = m.angle * driven;
    else if (part === 'weight') {
      const distance = m.kind === 'wheelbucket' ? Math.abs(m.angle * m.radius) * .4
        : 'travel' in m && typeof m.travel !== 'number' ? Math.hypot(...m.travel) * .5 : 0;
      target.y = -distance * driven;
    } else if (part === 'top') target.angle = driven * Math.PI;
    else if (part === 'gear') target.angle = -driven * Math.PI * 2;
    else if (part === 'gate') target.y = driven * 1.2;
    else if (part === 'striker' && m.kind === 'escapement') target.angle = driven * Math.PI / 2;
    else if (part === 'striker') { target.angle = -driven * .7; target.z = -driven; }
  }
  private samplePoint(seconds: number, target: THREE.Vector3, normal?: THREE.Vector3): void {
    if (!Number.isFinite(seconds)) throw new Error('Village time must be finite');
    if(this.rolling){this.rolling.sample(seconds,target,normal);return;}
    if (this.prefix && (seconds <= this.prefix.end || this.prefix.lastStop === 0)) { this.prefix.sample(seconds, target, normal); return; }
    const first = this.stations[9]!, last = this.stations[0]!;
    if (seconds <= first.start) { target.set(...first.entry.position); normal?.set(...first.entry.normal); return; }
    if (seconds >= last.end) { target.set(...last.exit.position); normal?.set(...last.exit.normal); return; }
    for (const segment of this.segments) {
      if (seconds > segment.end) continue;
      const station = this.stations[segment.stop]!;
      if (segment.kind === 'connector' || isVillageTrack(station.mechanism)) {
        this.path(segment, (seconds - segment.start) / (segment.end - segment.start), target, normal); return;
      }
      const local = carrierContact(station.mechanism);
      const departure = station.contact + (station.end - station.contact) * 0.8;
      const edges = carrierEdges(station.mechanism);
      let x = local[0];
      if (seconds < station.contact) x += edges[0] * (1 - villageEase((seconds - station.start) / (station.contact - station.start)));
      else if (seconds > departure) x += edges[1] * villageEase((seconds - departure) / (station.end - departure));
      target.set(x, local[1], local[2]);
      mechanismMatrix(station.mechanism, station.anchor, carrierProgress(station, seconds), this.matrix);
      target.applyMatrix4(this.matrix); normal?.set(0, 1, 0).transformDirection(this.matrix); return;
    }
  }
  focus(stop: number, target: THREE.Vector3): void {
    const station = this.stations[stop]; if (!station) throw new Error('Unknown village stop');
    this.sample(this.contacts.find(contact => contact.stop === stop)!.contact, target);
  }
  private path(segment: VillageSegment, progress: number, target: THREE.Vector3, normal?: THREE.Vector3): void {
    const { points, lengths } = segment;
    // Travel follows geometric distance, with zero endpoint velocity at carrier
    // handoffs. Adding mesh subdivisions cannot change the marble's timing.
    const at = lengths[lengths.length - 1]! * villageEase(progress);
    let low = 0, high = lengths.length - 1;
    while (low + 1 < high) { const middle = (low + high) >>> 1; if (lengths[middle]! <= at) low = middle; else high = middle; }
    const index = Math.min(points.length - 2, low), length = lengths[index + 1]! - lengths[index]!;
    const t = length > 0 ? (at - lengths[index]!) / length : 0;
    const a = points[index]!.position, b = points[index + 1]!.position;
    target.set(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t);
    if (normal) {
      const left = points[index]!.normal, right = points[index + 1]!.normal;
      normal.set(left[0] + (right[0] - left[0]) * t, left[1] + (right[1] - left[1]) * t, left[2] + (right[2] - left[2]) * t).normalize();
    }
  }
}
