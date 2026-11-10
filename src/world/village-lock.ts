import {VillageAdmissibilityError} from './village-contact';
import { Matrix4, Ray, Triangle, Vector3, type BufferGeometry } from 'three';
import { openFollowerGeometry, openGuideGeometry, OPEN_FOLLOWER_HALF } from '../view/open-lock-parts';
import type { VillageCapture } from './village-capture';
import type { VillageProfile, VillageStation } from './village-plan';
export interface OpenLockReceipt {readonly requiredImpulse:number;readonly requiredBrakingTorque:number;readonly openCentre:readonly[number,number];readonly needsBothDirections:boolean;readonly finiteShoeImpulse:0}
export function openLockReceipt(forkMass:number,closedCentre:readonly[number,number,number],direction:number,postImpactSpeed:number,brakingAcceleration:number,pitch:number):OpenLockReceipt{
 const x=direction*closedCentre[1],y=-direction*closedCentre[0],gx=-9.81*Math.sin(pitch),gy=-9.81*Math.cos(pitch);
 const impulse=-forkMass*y*direction*postImpactSpeed,torque=-forkMass*(x*gy-y*(gx-direction*brakingAcceleration));
 return Object.freeze({requiredImpulse:impulse,requiredBrakingTorque:torque,openCentre:Object.freeze([x,y]as const),needsBothDirections:impulse*torque<0,finiteShoeImpulse:0});
}
export class VillageOpenLockError extends VillageAdmissibilityError{
 constructor(stop:number,readonly receipt:OpenLockReceipt){super(stop,'open-angle-lock','unsupported-contact-geometry',1,0,'The existing parts have no positive open-angle lock. Impact and braking require opposite torque directions; a one-sided over-opening lug cannot provide both.');}
}
export function assertOpenLock(stop:number,receipt:OpenLockReceipt,guide?:OpenAngleGuide):void{if((receipt.requiredImpulse!==0||receipt.requiredBrakingTorque!==0)&&!OpenAngleGuide.certified(guide,stop))throw new VillageOpenLockError(stop,receipt);}

export interface OpenGuideLoad { readonly torque:number; readonly lever:number; readonly normal:number }
const certificates = new WeakSet<OpenAngleGuide>();
/** A rigid unilateral guide, not a friction shoe. Its normal and the journal's
 * opposite reaction form the required couple. Material yield is not modelled.
 */
export class OpenAngleGuide {
 private constructor(readonly stop:number,readonly first:number,readonly last:number,readonly releaseTime:number,
   readonly impulse:OpenGuideLoad,readonly braking:readonly OpenGuideLoad[],readonly rest:OpenGuideLoad) {
  certificates.add(this); Object.freeze(this);
 }
 static certified(candidate:unknown,stop:number):candidate is OpenAngleGuide {
  return candidate instanceof OpenAngleGuide&&certificates.has(candidate)&&candidate.stop===stop;
 }
 static enrol(station:VillageStation,profile:VillageProfile,first:number,last:number,start:number,capture:VillageCapture,
   centre:readonly[number,number,number],direction:number):OpenAngleGuide|undefined {
  if(!['terracotta','plank','timber'].includes(profile)||!['release','translating','suspended'].includes(station.mechanism.kind)||direction!==1||!('deckPitch' in station.mechanism)||!station.mechanism.deckPitch)return;
  const stroke=last-first,h=OPEN_FOLLOWER_HALF;
  const fail=()=>{throw new VillageAdmissibilityError(station.stop,'open-angle-lock','unsupported-contact-geometry',h,stroke);};
  const spec=station.retention;
  if(!spec||station.initialCargo||capture.stop!==station.stop||first!==spec.captureStart+.34
    ||last!==spec.captureStart+capture.stroke+.34||capture.spec.headMass!==spec.headMass+spec.gateMass
    ||!(stroke>h)||!Number.isFinite(start))fail();
  const guide=openGuideGeometry(first,last),follower=openFollowerGeometry();
  try {
   // Check the actual packed contact faces, with only their Float32 storage bound.
   const packed=(g:BufferGeometry,m:Matrix4)=>{const p=g.getAttribute('position'),i=g.index,faces:Triangle[]=[];
    for(let j=0;j<(i?.count??p.count);j+=3)faces.push(new Triangle(...[0,1,2].map(k=>new Vector3().fromBufferAttribute(p,i?i.getX(j+k):j+k).applyMatrix4(m))as[Vector3,Vector3,Vector3]));return faces;};
   const gf=packed(guide,new Matrix4()),ff=packed(follower,new Matrix4().makeRotationZ(-Math.PI/2));
   const hit=new Vector3(),ray=new Ray(),normal=new Vector3();
   for(const [faces,x,y,sign]of[[gf,first,-.095,1],[ff,0,-.055,-1]]as const){
    ray.set(new Vector3(x,y,-.86),new Vector3(0,sign,0));let distance=Infinity,dot=0;
    for(const triangle of faces)if(ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,hit)){
     const d=hit.distanceTo(ray.origin);if(d<distance){distance=d;dot=triangle.getNormal(normal).dot(ray.direction);}}
    const bound=8*2**-24*Math.max(1,Math.abs(first),Math.abs(last));
    if(Math.abs(distance-.02)>bound||dot>-.99999)fail();
   }
  }finally{guide.dispose();follower.dispose();}
  const pitch=station.mechanism.deckPitch!,mass=station.retention!.gateMass;
  const impulseTorque=openLockReceipt(mass,centre,direction,capture.impact.vAfter,0,pitch).requiredImpulse;
  const load=(torque:number,remaining:number):OpenGuideLoad=>{
   const lever=torque<0?Math.min(h,remaining-h):-h;
   const normal=torque===0?0:-torque/lever;
   if(!Number.isFinite(normal)||normal<0||(torque<0&&lever<=0))fail();
   return Object.freeze({torque,lever,normal});
  };
  const impulse=load(impulseTorque,stroke),braking:OpenGuideLoad[]=[];
  for(const event of capture.events){
   if(event.start>=capture.centreStop)break;
   const dt=Math.min(event.end,capture.centreStop)-event.start;
   const remaining=stroke-(event.x0+event.v0*dt+.5*event.a*dt*dt);
   const torque=openLockReceipt(mass,centre,direction,0,event.a,pitch).requiredBrakingTorque;
   braking.push(load(torque,remaining));
  }
  const rest=load(openLockReceipt(mass,centre,direction,0,0,pitch).requiredBrakingTorque,stroke);
  return new OpenAngleGuide(station.stop,first,last,start+capture.centreStop,impulse,Object.freeze(braking),rest);
 }
}
