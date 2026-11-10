import {VillageAxle}from'./village-axle';
import type{AxleStation}from'./axle-types';
import { VillageTerminal, VillageTerminalPath } from './village-terminal';
import { VillageGravityCarrier } from './village-gravity-carrier';
import { Matrix4, Vector3 } from 'three';
import { isVillageTrack, mechanismMatrix, carrierContact } from '../view/machine-primitives';
import { villagePort, type VillagePlan, type VillagePort } from './village-plan';
import { VillageRollingRun } from './village-rolling';
import { VillageCam } from './village-cam';
import {VillageAdmissibilityError,type VillageLedgerEntry} from './village-contact';
import { VillageRetained } from './village-retained';
import { VillagePendulum } from './village-pendulum';
import type { VillageContactRecord, VillageSegment, VillageTransferInterval } from './village-program';

interface Phase { readonly start: number; readonly end: number; readonly distance: number;
  readonly run: { readonly length: number; readonly distance: number; sample(seconds: number, target: Vector3, normal?: Vector3): void } }
export interface PrefixEvent { readonly stop: number; readonly cam: VillageCam; readonly incomingSpeed: number; readonly outgoingSpeed: number }
/** Compile a physically supported fixed-surface prefix up to the next unresolved carrier.
 * This is explicitly partial: it never marks the remaining village physically ready.
 */
export class VillageRollingPrefix {
  readonly failure?: { readonly stop: number; readonly message: string; readonly admissibility?:VillageAdmissibilityError };
  readonly physicalLedger:readonly VillageLedgerEntry[];
  readonly axles:readonly VillageAxle[];
  readonly terminal: readonly VillageTerminal[];
  readonly gravity: readonly VillageGravityCarrier[];
  readonly phases: readonly Phase[];
  readonly segments: readonly VillageSegment[];
  readonly contacts: readonly VillageContactRecord[];
  readonly transfers: readonly VillageTransferInterval[];
  readonly events: readonly PrefixEvent[];
  readonly retained: readonly VillageRetained[];
  readonly strikes: readonly { stop: number; motion: VillagePendulum; actorEnd:number }[];
  readonly end: number;
  readonly lastStop: number;
  distance = 0;
  constructor(plan: VillagePlan) {
    const ordered = [...plan.stations].sort((a, b) => b.stop - a.stop);
    const phases: Phase[] = [], segments: VillageSegment[] = [], contacts: VillageContactRecord[] = [];
    const transfers: VillageTransferInterval[] = [], events: PrefixEvent[] = [];
    const axles:VillageAxle[]=[];
    const retained: VillageRetained[] = [];
    const gravity: VillageGravityCarrier[] = [];
    const terminal: VillageTerminal[] = [];
    const strikes: { stop: number; motion: VillagePendulum; actorEnd:number }[] = [];
    const inertia = plan.profile === 'twinrail' ? 1 + .4 / (1 - (.22 / .355) ** 2) : 1.4;
    let time = ordered[0]!.start, speed = 0, distance = 0, lastStop = 10;
    let previousRolling: readonly VillagePort[] | undefined;
    const roll = (stop: number, kind: 'contact' | 'connector', points: readonly VillagePort[], loop = false) => {
      const twinrail = plan.profile === 'twinrail';
      if(loop&&!twinrail)throw new Error('Loop twinrail transition requires resolved contact inertia');
      const previousEnd=previousRolling?.at(-1);
      const meets=previousEnd&&Math.hypot(...previousEnd.position.map((value,i)=>value-points[0]!.position[i]!))<1e-7;
      const run = new VillageRollingRun([{ stop, kind, points }], speed, time, 9.81, 0, inertia,
        {profile:twinrail?'twinrail':'floor',traction:.8,precedingPoint:meets?previousRolling?.at(-2):undefined,...(plan.stations.some(s=>s.mechanism.kind==='wheelbucket'&&s.mechanism.axleCarry&&(stop===s.stop||stop===s.stop+1))?{retainWitness:true}:{})});
      previousRolling=points;
      phases.push({ start: time, end: time + run.duration, distance, run });
      const start = time; time += run.duration; speed = run.exitSpeed; distance += run.length;
      return { start, end: time };
    };
    const lengths = (points: readonly VillagePort[]) => {
      const result = [0];
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1]!.position, b = points[i]!.position;
        result.push(result[i - 1]! + Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]));
      }
      return result;
    };
    for (const station of ordered) {
      const m = station.mechanism;
      if (!isVillageTrack(m) && !(m.kind === 'escapement' && m.drive && m.pitch !== undefined) && !station.retention && !station.rollingDrive && !(m.kind === 'striker' && station.strikerDrive) && m.kind !== 'receiver') break;
      const checkpoint = {time,speed,distance,phases:phases.length,segments:segments.length,contacts:contacts.length,transfers:transfers.length,retained:retained.length,events:events.length,strikes:strikes.length,gravity:gravity.length,terminal:terminal.length,axles:axles.length};
      try {
      if (lastStop !== 10) {
        const connector = plan.connectors.find(link => link.from === lastStop)!;
        const interval = roll(lastStop, 'connector', connector.points);
        segments.push({ stop: lastStop, kind: 'connector', points: connector.points, lengths: lengths(connector.points), ...interval });
      }
      const start = time;
      let cause = start;
      let ids: string[] = station.releasePin ? [`village-${station.stop}-pin`] : [];
      let points: readonly VillagePort[];
      if(station.terminalCapture) {
        const path=new VillageTerminalPath(station);
        if(!path.pad)throw new VillageAdmissibilityError(station.stop,'curved-terminal','unsupported-contact-geometry',1,0);
        points=path.points;roll(station.stop,'contact',path.approach);cause=time;
        const motion=new VillageTerminal(station,cause,speed,inertia);terminal.push(motion);
        phases.push({start:cause,end:motion.end,distance,run:motion});
        time=motion.end;distance+=motion.length;speed=0;
        transfers.push({stop:station.stop,kind:'capture',start:cause,end:motion.end});
        ids=[`village-${station.stop}-damper`];
      } else if (isVillageTrack(m)) { points = m.points; roll(station.stop, 'contact', points, m.kind === 'loop'); }
      else if (m.kind === 'receiver') {
        points = [station.entry, station.exit];
        roll(station.stop, 'contact', points); cause = time;
        speed = 0;
        transfers.push({ stop: station.stop, kind: 'capture', start: cause, end: cause });
      } else if (m.kind === 'striker' && station.strikerDrive) {
        if(station.strikerDrive.kind!=='pendulum')throw new VillageAdmissibilityError(station.stop,'striker-impact','unsupported-contact-geometry',1,0);
        const touch=VillagePendulum.touch(station),point=villagePort([station.anchor[0]+touch,station.anchor[1],station.anchor[2]],station.entry.tangent,station.entry.normal);
        roll(station.stop,'contact',[station.entry,point]);cause=time;
        const motion=new VillagePendulum(station,cause,speed,speed,plan.profile);
        strikes.push({stop:station.stop,motion,actorEnd:motion.actorEnd});phases.push({start:cause,end:motion.end,distance,run:motion});
        time=motion.end;distance+=motion.length;speed=motion.outgoingSpeed;
        transfers.push({stop:station.stop,kind:'strike',start:cause,end:motion.bellTime});
        ids=[`village-${station.stop}-striker`];points=[station.entry,point,station.exit];
      } else if (station.rollingDrive) {
        if(station.rollingDrive.kind==='contact-gravity-rocker'){
          const motion=new VillageGravityCarrier(station,time,speed,inertia);gravity.push(motion);
          phases.push({start:time,end:motion.end,distance,run:motion});cause=motion.releaseTime;
          time=motion.end;distance+=motion.length;speed=motion.exitSpeed;
          transfers.push({stop:station.stop,kind:'carry',start:cause,end:motion.end});
          ids=[`village-${station.stop}-carrier`];points=[station.entry,station.exit];
        }else{
        const matrix=mechanismMatrix(m,station.anchor,0,new Matrix4());
        const point=new Vector3(station.rollingDrive.tripX,0,0).applyMatrix4(matrix);
        const trip=villagePort(point.toArray(),station.entry.tangent,station.entry.normal);
        roll(station.stop,'contact',[station.entry,trip]);cause=time;
        const motion=new VillageGravityCarrier(station,time,speed,inertia);gravity.push(motion);
        phases.push({start:time,end:motion.end,distance,run:motion});
        time=motion.end;distance+=motion.length;speed=motion.exitSpeed;
        transfers.push({stop:station.stop,kind:'carry',start:cause,end:motion.end});
        ids=[`village-${station.stop}-carrier`];points=[station.entry,trip,station.exit];
        }
      } else if(m.kind==='wheelbucket'&&m.axleCarry&&station.retention){
        const matrix=mechanismMatrix(m,station.anchor,0,new Matrix4()),position=new Vector3(station.retention.captureStart,0,0).applyMatrix4(matrix),capturePoint=villagePort(position.toArray(),station.entry.tangent,station.entry.normal);
        const approachSpeed=speed,approach=roll(station.stop,'contact',[station.entry,capturePoint]);cause=time;
        const motion=new VillageAxle(station as AxleStation,cause,speed,inertia,plan.profile==='timber'?'timber':(()=>{throw new Error('Axle timber only');})(),{...approach,incomingSpeed:approachSpeed});axles.push(motion);
        phases.push({start:cause,end:motion.end,distance,run:motion});time=motion.end;distance+=motion.length;speed=motion.exitSpeed;
        transfers.push({stop:station.stop,kind:'capture',start:cause,end:motion.carryStart},{stop:station.stop,kind:'carry',start:motion.carryStart,end:motion.carryEnd},{stop:station.stop,kind:'release',start:motion.carryEnd,end:motion.end});
        ids=[`village-${station.stop}-carrier`,`village-${station.stop}-capture-head`,`village-${station.stop}-wheel`,`village-${station.stop}-weight`];points=[station.entry,capturePoint,station.exit];
      } else if (station.retention) {
        const matrix = mechanismMatrix(m, station.anchor, 0, new Matrix4());
        const offset = carrierContact(m);
        const position = new Vector3(offset[0] + (station.initialCargo?.localX ?? station.retention.captureStart), offset[1], offset[2]).applyMatrix4(matrix);
        const capturePoint = villagePort(position.toArray(), station.entry.tangent, station.entry.normal);
        if (station.initialCargo) {
          if (lastStop !== 10 || speed !== 0) throw new Error('Initial cargo is only valid in the first loaded cradle');
        } else roll(station.stop, 'contact', [station.entry, capturePoint]);
        cause = time;
        const motion = new VillageRetained(station, cause, speed, inertia,plan.profile);
        retained.push(motion);
        phases.push({ start: cause, end: motion.end, distance, run: motion });
        time = motion.end; distance += motion.length; speed = motion.exitSpeed;
        if (!station.initialCargo) transfers.push({ stop: station.stop, kind: 'capture', start: cause, end: motion.carryStart });
        transfers.push({ stop: station.stop, kind: 'carry', start: motion.carryStart, end: motion.carryEnd });
        if (!station.retainAtEnd) transfers.push({ stop: station.stop, kind: 'release', start: motion.carryEnd, end: motion.end });
        ids = [`village-${station.stop}-carrier`, `village-${station.stop}-fork`, `village-${station.stop}-weight`,
          ...(motion.keyedHead ? [`village-${station.stop}-capture-head`] : []),
          ...(motion.inventory.layout==='keyed-prismatic'?[`village-${station.stop}-head-frame`]:[]),
          ...(m.kind === 'wheelbucket' ? [`village-${station.stop}-wheel`] : [])];
        points = [station.entry, capturePoint, station.exit];
      } else if (m.kind === 'escapement') {
        throw new VillageAdmissibilityError(station.stop,'escapement-impact','unsupported-contact-geometry',1,0);
      } else throw new Error('Unsupported physical station');
      if(station.retention||station.rollingDrive||station.strikerDrive?.kind==='pendulum'){
        const exit=station.exit;
        previousRolling=[villagePort(exit.position.map((value,i)=>value-.1*exit.tangent[i]!) as [number,number,number],exit.tangent,exit.normal),exit];
      }
      contacts.push({ stop: station.stop, start, contact: cause, end: time, moverIds: ids });
      segments.push({ stop: station.stop, kind: 'contact', start, end: time, points, lengths: lengths(points) });
      lastStop = station.stop;
      } catch (error) {
        this.failure={stop:station.stop,message:error instanceof Error?error.message:String(error),admissibility:error instanceof VillageAdmissibilityError?error:new VillageAdmissibilityError(station.stop,'legacy-physical-guard','unsupported-contact-geometry',1,0,error instanceof Error?error.message:String(error))};
        time=checkpoint.time;speed=checkpoint.speed;distance=checkpoint.distance;
        phases.length=checkpoint.phases;segments.length=checkpoint.segments;contacts.length=checkpoint.contacts;
        transfers.length=checkpoint.transfers;retained.length=checkpoint.retained;events.length=checkpoint.events;
        strikes.length=checkpoint.strikes;gravity.length=checkpoint.gravity;terminal.length=checkpoint.terminal;axles.length=checkpoint.axles;
        break;
      }
    }
    this.phases = phases; this.segments = segments; this.contacts = contacts; this.transfers = transfers;
    this.events = events; this.end = time; this.lastStop = lastStop;
    this.axles=axles;
    this.retained = retained; this.gravity=gravity;this.terminal=terminal;
    this.strikes = strikes;
    for(const motion of axles){const get=(time:number)=>{const phase=phases.find(p=>p.start===time&&p.run instanceof VillageRollingRun);return phase?.run instanceof VillageRollingRun?phase.run:undefined;},home=get(motion.approach.start);if(!home)throw Error('Actual axle HOME rolling phase missing');motion.publishDockTransfers({home,top:get(motion.end)});}
    this.physicalLedger=Object.freeze([...axles,...retained,...terminal,...strikes.map(s=>s.motion),...gravity.filter(g=>g.rocker)].flatMap(motion=>motion.physicalLedger));
  }
  sample(seconds: number, target: Vector3, normal?: Vector3): void {
    let lo = 0, hi = this.phases.length - 1;
    while (lo < hi) { const mid = (lo + hi) >>> 1; if (this.phases[mid]!.end < seconds) lo = mid + 1; else hi = mid; }
    const phase = this.phases[lo]!;
    phase.run.sample(seconds, target, normal); this.distance = phase.distance + phase.run.distance;
  }
}
