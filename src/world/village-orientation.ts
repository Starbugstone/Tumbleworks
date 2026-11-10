import type{VillageAxle}from'./village-axle';
import {Quaternion,Vector3,Matrix4} from 'three';
import type {VillageGravityCarrier} from './village-gravity-carrier';
import type {VillageRetained} from './village-retained';
import type {VillagePendulum} from './village-pendulum';
import type {VillageTerminal} from './village-terminal';
/** Compile-time transport. Query is a binary lookup + slerp, never integration. */
export class VillageOrientation {
 private readonly times:Float64Array;private readonly values:Float64Array;
 private readonly a=new Quaternion();private readonly b=new Quaternion();
 readonly byteLength:number;
 constructor(duration:number,radius:number,sample:(time:number,p:Vector3,n:Vector3)=>void,
  retained:readonly VillageRetained[],carrier:(stop:number,time:number,m:Matrix4)=>void,gravity:readonly VillageGravityCarrier[]=[],terminals:readonly VillageTerminal[]=[],strikes:readonly VillagePendulum[]=[],axles:readonly VillageAxle[]=[]){
  const keys=new Set<number>([0,duration]);for(let i=1;i<Math.ceil(duration*120);i++)keys.add(i/120);
  for(const r of retained){for(const t of [r.start,r.closureStart,r.carryStart,r.carryEnd,r.end])keys.add(t);
   if(r.capture)for(const event of r.capture.events){keys.add(r.start+event.start);keys.add(r.start+event.end);}}
  for(const m of terminals){keys.add(m.start);keys.add(m.end);for(const e of m.capture.events){keys.add(m.start+e.start);keys.add(m.start+e.end);}}
  for(const g of gravity){keys.add(g.start);keys.add(g.end);
   for(const e of g.rocker?.events??[])if(e.kind!=='home')keys.add(e.time);
   // Preserve the already-audited end-stop event; angular speed may jump there.
   for(let i=1;i<g.rows.length;i++)if(g.rows[i]!.angularVelocity===0&&g.rows[i-1]!.angularVelocity!==0)keys.add(g.rows[i]!.time);
  }
  for(const strike of strikes){keys.add(strike.contact);keys.add(strike.end);for(const time of strike.orientationKnots)keys.add(time);}
  for(const axle of axles)for(const t of axle.orientationKnots)keys.add(t);
  const gravityState={x:0,angle:0,progress:0};
  this.times=new Float64Array([...keys].filter(t=>t>=0&&t<=duration).sort((a,b)=>a-b));this.values=new Float64Array(this.times.length*4);
  const p=new Vector3(),previous=new Vector3(),n=new Vector3(),axis=new Vector3(),q=new Quaternion(),delta=new Quaternion(),r0=new Quaternion(),r1=new Quaternion(),matrix=new Matrix4();
  q.toArray(this.values,0);sample(0,previous,n);
  for(let i=1;i<this.times.length;i++){
   const t0=this.times[i-1]!,t1=this.times[i]!,mid=(t0+t1)/2,motion=retained.find(r=>mid>=r.start&&mid<=r.end)??axles.find(r=>mid>=r.start&&mid<=r.end);
   sample(t1,p,n);
   if(motion){
    carrier(motion.station.stop,t0,matrix);r0.setFromRotationMatrix(matrix);carrier(motion.station.stop,t1,matrix);r1.setFromRotationMatrix(matrix);
    delta.copy(r1).multiply(r0.invert());q.premultiply(delta);
    axis.set(0,0,-1).applyQuaternion(r1);
    delta.setFromAxisAngle(axis,motion.relativeAngle(t1)-motion.relativeAngle(t0));q.premultiply(delta);
   }else if(strikes.some(s=>mid>=s.contact&&mid<=s.end)){
    const strike=strikes.find(s=>mid>=s.contact&&mid<=s.end)!;
    axis.set(...strike.station.exit.tangent);axis.crossVectors(n,axis).normalize();
    delta.setFromAxisAngle(axis,strike.relativeAngle(t1)-strike.relativeAngle(t0));q.premultiply(delta);
   }else if(terminals.some(m=>mid>=m.start&&mid<=m.end)){
    const m=terminals.find(m=>mid>=m.start&&mid<=m.end)!;
    axis.set(...m.path.pad!.tangent);axis.crossVectors(n,axis).normalize();
    delta.setFromAxisAngle(axis,m.relativeAngle(t1)-m.relativeAngle(t0));q.premultiply(delta);
   }else if(gravity.some(g=>mid>=g.start&&mid<=g.end)){
    const g=gravity.find(g=>mid>=g.start&&mid<=g.end)!;
    g.state(t0,gravityState);const x0=gravityState.x;g.state(t1,gravityState);const x1=gravityState.x;
    carrier(g.station.stop,t0,matrix);r0.setFromRotationMatrix(matrix);carrier(g.station.stop,t1,matrix);r1.setFromRotationMatrix(matrix);
    delta.copy(r1).multiply(r0.invert());q.premultiply(delta);
    axis.set(0,0,-1).applyQuaternion(r1);delta.setFromAxisAngle(axis,(x1-x0)/.3);q.premultiply(delta);
   }else{
    axis.copy(p).sub(previous);const distance=axis.length();axis.crossVectors(n,axis).normalize();
    if(distance>0&&axis.lengthSq()>0){delta.setFromAxisAngle(axis,distance/radius);q.premultiply(delta);}
   }
   q.normalize().toArray(this.values,i*4);previous.copy(p);
  }
  this.byteLength=this.times.byteLength+this.values.byteLength;
 }
 sample(seconds:number,target:Quaternion):void{
  if(!Number.isFinite(seconds))throw new Error('Village time must be finite');
  const t=Math.max(0,Math.min(this.times[this.times.length-1]!,seconds));let lo=0,hi=this.times.length-1;
  while(lo+1<hi){const mid=(lo+hi)>>>1;if(this.times[mid]!<=t)lo=mid;else hi=mid;}
  this.a.fromArray(this.values,lo*4);this.b.fromArray(this.values,hi*4);
  target.slerpQuaternions(this.a,this.b,(t-this.times[lo]!)/(this.times[hi]!-this.times[lo]!||1));
 }
}
