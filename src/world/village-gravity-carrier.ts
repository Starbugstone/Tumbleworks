import { Matrix4, Vector3 } from 'three';
import { carrierEdges, mechanismMatrix } from '../view/machine-primitives';
import { VILLAGE_RADIUS,type VillageStation } from './village-plan';
import { compileGravityLever, type LeverRow } from './village-gravity-roll';
import{compileGravityRocker,hermite}from'./village-gravity-rocker';
import type{RockerSolution}from'./gravity-rocker-types';
import{rockerReceipts,groundAllocation,type StructuralTerm,type Vec}from'./gravity-rocker-loads';
import{GravityHingeSupport,type NativeHingeInput}from'./gravity-hinge-support';
import{type VillageLedgerEntry}from'./village-contact';
export interface GravityCarrierPose { x: number; angle: number; progress: number }
/** Renderer and cargo sample one solved local coordinate and hinge angle. */
export class VillageGravityCarrier {
  readonly rocker?:RockerSolution;
  readonly physicalLedger:readonly VillageLedgerEntry[];
  readonly actorEnd:number;readonly releaseTime:number;
  readonly structuralLoads:ReturnType<typeof rockerReceipts>['loads'];
  readonly staticFamilies:ReturnType<typeof rockerReceipts>['staticFamilies'];
  nativeLoads:readonly {time:number;phase:string;kind:string;radial:ReturnType<GravityHingeSupport['reactions']>;feet:ReturnType<typeof groundAllocation>;seatAxial:readonly[number,number];staticEndpoint?:number}[]=[];
  private nativeHinge?:GravityHingeSupport;
  get supportPending():boolean{return Boolean(this.rocker)&&!GravityHingeSupport.certified(this.nativeHinge,this.station.stop);}
  get hingeCertificate(){return this.nativeHinge?.certificate;}
  invalidateHinge():void{this.nativeHinge=undefined;this.nativeLoads=[];}
  certifyHinge(input:NativeHingeInput):void{const spec=this.station.rollingDrive;if(!spec||spec.kind!=='contact-gravity-rocker')throw new Error('No rocker owns this certificate');this.invalidateHinge();const support=GravityHingeSupport.enrol(this.station,spec,input),anchors=support.certificate.anchors;if(anchors.length!==2)throw new Error('Actual two-foot inventory missing');const feet=anchors.map(a=>{const n=a.corners.length;return a.corners.reduce((v,p)=>[v[0]+p.x/n,v[1]+p.y/n,v[2]+p.z/n]as Vec,[0,0,0]as Vec);})as unknown as readonly[Vec,Vec],groups=new Map<string,StructuralTerm[]>();for(const term of this.structuralLoads){const key=term.time+'/'+term.phase+'/'+term.kind;const row=groups.get(key)??[];row.push(term);groups.set(key,row);}const published=[];for(const terms of groups.values()){const pin=terms.find(t=>t.recipient==='hinge-pin')!;published.push({time:pin.time,phase:pin.phase,kind:pin.kind,seatAxial:support.certificate.axial,radial:support.reactions(pin.vector,pin.couple,[0]).map(r=>({...r,at:r.at.map((v,i)=>v+this.rocker!.assembly.pivot[i]!)as unknown as readonly[number,number,number],frame:'station-local',recipient:'hinge-pin',actualFacetGapIsMaterialContact:false})),feet:groundAllocation(terms,feet).map((r,i)=>({...r,part:anchors[i]!.part}))});}for(const family of this.staticFamilies)for(const endpoint of family.endpoints){if(!endpoint.admissible)continue;const pin=endpoint.terms.find(t=>t.recipient==='hinge-pin')!;published.push({time:pin.time,phase:pin.phase,kind:pin.kind,seatAxial:support.certificate.axial,radial:support.reactions(pin.vector,pin.couple,[0]).map(r=>({...r,at:r.at.map((v,i)=>v+this.rocker!.assembly.pivot[i]!)as unknown as readonly[number,number,number],frame:'station-local',recipient:'hinge-pin',actualFacetGapIsMaterialContact:false})),feet:groundAllocation(endpoint.terms,feet).map((r,i)=>({...r,part:anchors[i]!.part})),staticEndpoint:endpoint.bearing});}this.nativeLoads=published;this.nativeHinge=support;}
  readonly rows: readonly LeverRow[];
  readonly end: number;
  readonly exitSpeed: number;
  readonly stopLoss: number;
  readonly initialEnergy: number;
  readonly distances: readonly number[];
  private readonly matrix = new Matrix4();
  private readonly pose: GravityCarrierPose = { x: 0, angle: 0, progress: 0 };
  distance = 0;
  constructor(readonly station: VillageStation, readonly start: number, incomingSpeed: number, inertiaFactor: number) {
    const m=station.mechanism,spec=station.rollingDrive;
    if(!spec || !('pivot' in m) || m.axis[0]!==0 || m.axis[1]!==0 || m.axis[2]!==1 || m.dockingLift || m.localContact) throw new Error('Gravity roll requires an ordinary planar hinge');
    let result: Omit<ReturnType<typeof compileGravityLever>,'rows'> & {rows:readonly LeverRow[]};
    if(spec.kind==='contact-gravity-rocker'){
      const assembly={stop:station.stop,pivot:m.pivot,angle:m.angle,deckPitch:m.deckPitch??0,entryX:carrierEdges(m)[0],exitX:carrierEdges(m)[1],radius:VILLAGE_RADIUS,inertiaFactor};
      this.rocker=compileGravityRocker(assembly,spec,start,incomingSpeed);result=this.rocker;
    }else try {result=compileGravityLever({pivot:m.pivot,angle:m.angle,deckPitch:m.deckPitch??0,entryX:carrierEdges(m)[0],exitX:carrierEdges(m)[1],radius:.3,inertiaFactor},spec,start,incomingSpeed);}
    catch(error){throw new Error(`Incoming ${incomingSpeed}m/s: ${error instanceof Error?error.message:String(error)}`);}
    const receipts=this.rocker?rockerReceipts(this.rocker):undefined;this.physicalLedger=receipts?.physicalLedger??[];this.structuralLoads=receipts?.loads??[];this.staticFamilies=receipts?.staticFamilies??[];this.actorEnd=this.rocker?.actorEnd??result.end;this.releaseTime=this.rocker?.events.find(e=>e.kind==='release')!.time??start;
    this.rows=result.rows;this.end=result.end;this.exitSpeed=result.exitSpeed;this.stopLoss=result.stopLoss;this.initialEnergy=result.initialEnergy;
    const distances=[0],previous=new Vector3(),point=new Vector3();
    for(let i=0;i<this.rows.length;i++) {
      const row=this.rows[i]!;this.samplePoint(row.time,point);
      if(i)distances.push(distances[i-1]!+point.distanceTo(previous));previous.copy(point);
    }
    this.distances=distances;
  }
  state(seconds:number,target:GravityCarrierPose):number {
    const time=Math.max(this.start,Math.min(this.end,seconds));
    let lo=0,hi=this.rows.length-1;
    while(lo+1<hi){const mid=(lo+hi)>>>1;if(this.rows[mid]!.time<=time)lo=mid;else hi=mid;}
    const a=this.rows[lo]!,b=this.rows[hi]!,dt=b.time-a.time,u=dt?(time-a.time)/dt:1;
    const u2=u*u,u3=u2*u,h0=2*u3-3*u2+1,h1=u3-2*u2+u,h2=-2*u3+3*u2,h3=u3-u2;
    target.x=h0*a.x+h1*dt*a.velocity+h2*b.x+h3*dt*b.velocity;
    target.angle=this.rocker?hermite(a.angle,b.angle,a.angularVelocity,b.angularVelocity,dt,u):h0*a.angle+h1*dt*a.angularVelocity+h2*b.angle+h3*dt*b.angularVelocity;
    const m=this.station.mechanism;
    if(!('angle' in m))throw new Error('Missing hinge');
    const rawRatio=target.angle/m.angle;
    const ratio=this.rocker?rawRatio:Math.max(0,Math.min(1,rawRatio));
    target.progress=ratio===0?0:ratio===1?1:.5-Math.sin(Math.asin(1-2*ratio)/3);
    return lo+u;
  }
  /** Body-only continuation is independent of the departed marble state. */
  bodyPose(seconds:number,target:Pick<GravityCarrierPose,'angle'|'progress'>):void{
    if(!Number.isFinite(seconds))throw new Error('Rocker time must be finite');
    if(!this.rocker){this.state(seconds,this.pose);target.angle=this.pose.angle;target.progress=this.pose.progress;return;}
    if(seconds<=this.start||seconds>=this.actorEnd){target.angle=0;target.progress=0;return;}
    if(seconds<=this.end){this.state(seconds,this.pose);target.angle=this.pose.angle;target.progress=this.pose.progress;return;}
    const rows=this.rocker.returnRows;let lo=0,hi=rows.length-1;
    while(lo+1<hi){const mid=(lo+hi)>>>1;if(rows[mid]!.time<=seconds)lo=mid;else hi=mid;}
    const a=rows[lo]!,b=rows[hi]!,dt=b.time-a.time,u=dt?(seconds-a.time)/dt:1;
    target.angle=hermite(a.angle,b.angle,a.angularVelocity,b.angularVelocity,dt,u);
    const ratio=target.angle/this.rocker.assembly.angle;
    target.progress=ratio===0?0:ratio===1?1:.5-Math.sin(Math.asin(1-2*ratio)/3);
  }
  private samplePoint(seconds:number,target:Vector3,normal?:Vector3):number {
    const at=this.state(seconds,this.pose);
    mechanismMatrix(this.station.mechanism,this.station.anchor,this.pose.progress,this.matrix);
    target.set(this.pose.x,0,0).applyMatrix4(this.matrix);normal?.set(0,1,0).transformDirection(this.matrix);return at;
  }
  sample(seconds:number,target:Vector3,normal?:Vector3):void {
    const at=this.samplePoint(seconds,target,normal),index=Math.floor(at);
    const a=this.distances[index]!,b=this.distances[Math.min(index+1,this.distances.length-1)]!;
    this.distance=a+(b-a)*(at-index);
  }
  get length():number{return this.distances[this.distances.length-1]!;}
}
