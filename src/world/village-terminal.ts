import { Matrix4, Vector3 } from 'three';
import { isVillageTrack } from '../view/machine-primitives';
import { villagePort, type VillagePort, type VillageStation, type VillageVec3 } from './village-plan';
import { VillageCapture, type CaptureState } from './village-capture';
import { TerminalGuideBrake } from './village-terminal-guide';
import { VillageAdmissibilityError,VILLAGE_CONTACT,VILLAGE_HEAD,type VillageLedgerEntry,type VillageContactWitness } from './village-contact';
export interface TerminalPad {
 readonly start:VillageVec3;readonly end:VillageVec3;readonly tangent:VillageVec3;readonly normal:VillageVec3;readonly length:number;
}
/** The terminal head follows the actual sampled floor, including curved basins. */
export class VillageTerminalPath {
  private readonly point=new Vector3();
  private readonly tangent=new Vector3();
  private readonly normal=new Vector3();
  private readonly across=new Vector3();
  readonly points:readonly VillagePort[];
  readonly lengths:readonly number[];
  readonly startDistance:number;
  readonly approach:readonly VillagePort[];
  readonly pad?:TerminalPad;
  readonly padFailure?:VillageAdmissibilityError;
  constructor(readonly station:VillageStation) {
    const spec=station.terminalCapture;
    if(!spec || station.stop!==0 || !Object.values(spec).every(Number.isFinite)||spec.availableStroke<=0||spec.lead<=spec.availableStroke)throw new VillageAdmissibilityError(station.stop,'terminal-pad','unsupported-contact-geometry',spec?.availableStroke??1,spec?.lead??0,'Terminal brake needs a real remaining deck and finite stroke');
    this.points=isVillageTrack(station.mechanism)?station.mechanism.points:[station.entry,station.exit];
    const lengths=[0];for(let i=1;i<this.points.length;i++)lengths.push(lengths[i-1]!+new Vector3(...this.points[i]!.position).distanceTo(new Vector3(...this.points[i-1]!.position)));
    this.lengths=lengths;
    const rawStart=lengths.at(-1)!-spec.lead,padStart=lengths.at(-2)!;
    const arithmeticBound=64*Number.EPSILON*Math.max(1,lengths.at(-1)!,...this.points.at(-1)!.position.map(Math.abs));
    // A lead equal to the final chord must reuse that authored boundary. A
    // subtraction-rounding fragment would otherwise invent enormous curvature.
    this.startDistance=Math.abs(rawStart-padStart)<=arithmeticBound?padStart:rawStart;
    if(this.startDistance<=0)throw new VillageAdmissibilityError(station.stop,'terminal-pad','unsupported-contact-geometry',spec.lead,lengths.at(-1)!,'Impact lies before the receiving track');
    const p=new Vector3(),t=new Vector3(),n=new Vector3();this.at(this.startDistance,p,t,n);
    const first=this.points.filter((_,i)=>lengths[i]!<this.startDistance);
    this.approach=[...first,villagePort(p.toArray(),t.toArray(),n.toArray(),station.entry.width)];
    try{this.pad=this.provePad();}catch(error){if(!(error instanceof VillageAdmissibilityError))throw error;this.padFailure=error;}
  }
  private provePad():TerminalPad {
    const a=this.points.at(-2)!,b=this.points.at(-1)!,spec=this.station.terminalCapture!;
    const delta=new Vector3(...b.position).sub(new Vector3(...a.position)),length=delta.length();
    // Only arithmetic error from subtracting/normalising these coordinates is
    // admitted here. This is not a physical contact or clearance tolerance.
    const bound=64*Number.EPSILON*Math.max(1,...a.position.map(Math.abs),...b.position.map(Math.abs));
    const fail=(required:number,available:number,detail:string):never=>{throw new VillageAdmissibilityError(this.station.stop,'terminal-pad','unsupported-contact-geometry',required,available,detail);};
    if(length+bound<spec.lead)fail(spec.lead,length,'Capture window spans more than the final chord');
    if(a.width!==b.width||a.tangent.some((v,i)=>v!==b.tangent[i])||a.normal.some((v,i)=>v!==b.normal[i]))fail(1,0,'Pad endpoints require one identical frame');
    const t=new Vector3(...b.tangent),n=new Vector3(...b.normal),along=delta.clone().normalize();
    const error=Math.max(Math.abs(t.length()-1),Math.abs(n.length()-1),Math.abs(t.dot(n)),Math.abs(n.dot(along)),t.clone().cross(along).length());
    if(error>bound)fail(error,bound,'Pad chord and normal are not perpendicular');
    if(t.dot(along)<=0)fail(1,t.dot(along),'Pad tangent reverses its chord');
    if(n.y<=0)fail(Number.EPSILON,n.y,'Pad support must face upwards');
    const bank=Math.abs(new Vector3().crossVectors(t,n).y);
    if(bank>bound)fail(bank,bound,'Planar capture has no sideways support model for a banked pad');
    if(t.y>0)fail(t.y,0,'The held marble needs a downhill or level pad');
    const padStart=this.lengths.at(-2)!;
    if(this.startDistance<padStart-bound)fail(padStart,this.startDistance,'Impact lies before the proven pad');
    if(spec.availableStroke>spec.lead)fail(spec.availableStroke,spec.lead,'Capture exceeds the pad end');
    return Object.freeze({start:a.position,end:b.position,tangent:b.tangent,normal:b.normal,length});
  }
  requirePad():TerminalPad {if(!this.pad)throw this.padFailure!;return this.pad;}
  headPose(distance:number,target:Matrix4):void {
    this.at(distance,this.point,this.tangent,this.normal);
    this.normal.addScaledVector(this.tangent,-this.normal.dot(this.tangent)).normalize();
    this.across.crossVectors(this.tangent,this.normal).normalize();this.point.addScaledVector(this.tangent,.34);
    target.makeBasis(this.tangent,this.normal,this.across).setPosition(this.point);
  }
  at(distance:number,point:Vector3,tangent?:Vector3,normal?:Vector3):void {
    const d=Math.max(0,Math.min(this.lengths.at(-1)!,distance));let lo=0,hi=this.points.length-1;
    while(lo+1<hi){const mid=(lo+hi)>>>1;if(this.lengths[mid]!<=d)lo=mid;else hi=mid;}
    const a=this.points[lo]!,b=this.points[hi]!,u=(d-this.lengths[lo]!)/(this.lengths[hi]!-this.lengths[lo]!);
    point.set(a.position[0]+(b.position[0]-a.position[0])*u,a.position[1]+(b.position[1]-a.position[1])*u,a.position[2]+(b.position[2]-a.position[2])*u);
    tangent?.set(a.tangent[0]+(b.tangent[0]-a.tangent[0])*u,a.tangent[1]+(b.tangent[1]-a.tangent[1])*u,a.tangent[2]+(b.tangent[2]-a.tangent[2])*u).normalize();
    normal?.set(a.normal[0]+(b.normal[0]-a.normal[0])*u,a.normal[1]+(b.normal[1]-a.normal[1])*u,a.normal[2]+(b.normal[2]-a.normal[2])*u).normalize();
    if(normal&&tangent)normal.addScaledVector(tangent,-normal.dot(tangent)).normalize();
  }
}
/** A straight, unbanked head and floor use exactly the retained capture law.
 * There is no no-slip impact, restored incoming energy or curved-path fallback.
 */
export class VillageTerminal {
  readonly path:VillageTerminalPath;
  readonly capture:VillageCapture;
  readonly guide:TerminalGuideBrake;
  readonly end:number;
  readonly length:number;
  readonly impulseLoss:number;
  readonly brakeWork:number;
  readonly physicalLedger:readonly VillageLedgerEntry[];
  private readonly state:CaptureState={distance:0,speed:0,spin:0,angle:0};
  distance=0;
  constructor(readonly station:VillageStation,readonly start:number,incomingSpeed:number,inertia:number) {
    this.path=new VillageTerminalPath(station);const pad=this.path.requirePad(),spec=station.terminalCapture!;
    const frame=new Matrix4();this.path.headPose(this.path.startDistance,frame);
    this.guide=TerminalGuideBrake.enrol(station.stop,frame,spec.availableStroke,spec.brakeForce);
    if(inertia!==1.4)throw new VillageAdmissibilityError(station.stop,'terminal-pad','unsupported-contact-geometry',inertia,1.4,'Planar capture needs a single flat floor');
    this.capture=new VillageCapture({incomingSpeed,headMass:spec.headMass,brakeForce:spec.brakeForce,
      downhillAcceleration:-9.81*pad.tangent[1],normalAcceleration:9.81*pad.normal[1],availableStroke:spec.availableStroke},
      {mass:spec.marbleMass,radius:.3,centralInertia:.4*spec.marbleMass*.3**2},VILLAGE_CONTACT,VILLAGE_HEAD,station.stop);
    this.end=start+this.capture.settledAt;this.length=this.capture.stroke;
    this.impulseLoss=this.capture.work.impact;this.brakeWork=this.capture.work.brake;
    const events=this.capture.events,w=this.capture.work;
    this.physicalLedger=Object.freeze([Object.freeze({stop:station.stop,phase:'terminal-capture',start,end:this.end,
      minimumNormal:Math.min(...events.map(e=>e.floorNormal)),maximumFrictionRatio:Math.max(...events.map(e=>Math.abs(e.floorFriction)/e.floorNormal)),
      minimumHeadReaction:Math.min(...events.map(e=>e.headReaction)),maximumBrake:Math.max(...events.map(e=>Math.abs(e.brake))),
      work:Object.freeze({gravity:w.gravity,brake:w.brake,slip:w.slip,impact:w.impact,drive:0})})]);
  }
  private seek(seconds:number):number {
    if(!Number.isFinite(seconds))throw new Error('Village time must be finite');
    this.capture.sample(Math.max(0,seconds-this.start),this.state);this.distance=this.state.distance;
    return this.path.startDistance+this.distance;
  }
  sample(seconds:number,target:Vector3,normal?:Vector3):void {this.path.at(this.seek(seconds),target,undefined,normal);}
  relativeAngle(seconds:number):number {this.seek(seconds);return this.state.angle;}
  contactWitness(seconds:number,target:VillageContactWitness):void {
    const event=this.capture.eventAt(Math.max(0,seconds-this.start));
    target.phase=event.kind;target.floorNormal=event.floorNormal;target.floorFriction=event.floorFriction;
    target.leadingReaction=event.headReaction;target.trailingReaction=0;target.brake=event.brake;
  }
  headPose(seconds:number,target:Matrix4):void {this.path.headPose(this.seek(seconds),target);}
}
