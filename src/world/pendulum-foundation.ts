import {Vector3} from 'three';
import type {PendulumParts} from '../view/pendulum-parts';
import {PendulumSupport,footingHeight} from './pendulum-support';
import type {PendulumDrive} from './pendulum-types';
import type {VillageStation,VillageVec3} from './village-plan';
import {VillageAdmissibilityError} from './village-contact';
export type ComponentId='journal-frame'|'bell-stand';
export interface Anchor {readonly part:string;readonly patch:number;readonly centre:VillageVec3;readonly corners:readonly VillageVec3[];readonly area:number;readonly halfX:number;readonly halfZ:number}
export interface Component {readonly id:ComponentId;readonly parts:readonly string[];readonly anchors:readonly Anchor[];readonly reference:VillageVec3;readonly second:Readonly<{area:number;ix:number;iz:number;ixz:number;sxy:number;syz:number}>}
export interface Traction {a0:number;a1:number;a2:number;b0:number;c0:number;g:number}
export interface GroundForce {kind:'force';time:number;component:ComponentId;source:'push'|'free'|'return'|'rest';coulomb:number;force:[number,number,number];moment:[number,number,number];minimumNormalTraction:number;tensile:boolean;traction:Traction}
export interface GroundImpulse {readonly kind:'impulse';readonly time:number;readonly component:ComponentId;readonly event:'strike-impact'|'reimpact'|'bell';readonly member:'declared'|'family-corner';readonly impulse:VillageVec3;readonly angularImpulse:VillageVec3;readonly minimumNormalTraction:number;readonly tensile:boolean;readonly traction:Traction;readonly stopSite?:Readonly<{delta:number;z:number;impulse:number;angle:number}>}
type Wrench={readonly force:VillageVec3;readonly moment:VillageVec3;readonly axialTerms:readonly number[]};
const brand=new WeakSet<PendulumFoundation>();
function fail(stop:number,detail:string):never{throw new VillageAdmissibilityError(stop,'striker-foundation-certificate','unsupported-contact-geometry',1,0,detail);}
export function tractionWitness(component:Component,force:VillageVec3,moment:VillageVec3,out:Traction):number{
 const s=component.second,D=s.ix*s.iz-s.ixz*s.ixz;if(!(D>0&&s.area>0&&s.ix+s.iz>0))throw new Error('Degenerate finite anchor union');
 out.a0=force[1]/s.area;out.b0=force[0]/s.area;out.c0=force[2]/s.area;out.g=-moment[1]/(s.ix+s.iz);
 const r0=moment[2]-out.g*s.syz,r1=-moment[0]+out.g*s.sxy;out.a1=(r0*s.iz-r1*s.ixz)/D;out.a2=(r1*s.ix-r0*s.ixz)/D;
 let minimum=Infinity;for(const a of component.anchors)for(const p of a.corners)minimum=Math.min(minimum,out.a0+out.a1*(p[0]-component.reference[0])+out.a2*(p[2]-component.reference[2]));return minimum;
}
export function anchorComponent(id:ComponentId,parts:readonly string[],anchors:readonly Anchor[]):Component{
 const area=anchors.reduce((s,a)=>s+a.area,0);if(!(area>0))throw new Error('Component has no finite anchor');
 const reference=[0,1,2].map(i=>anchors.reduce((s,a)=>s+a.area*a.centre[i]!,0)/area)as[number,number,number];let ix=0,iz=0,ixz=0,sxy=0,syz=0;
 for(const a of anchors){const x=a.centre[0]-reference[0],y=a.centre[1]-reference[1],z=a.centre[2]-reference[2];ix+=a.area*(x*x+a.halfX*a.halfX/3);iz+=a.area*(z*z+a.halfZ*a.halfZ/3);ixz+=a.area*x*z;sxy+=a.area*x*y;syz+=a.area*y*z;}
 return Object.freeze({id,parts,anchors,reference,second:{area,ix,iz,ixz,sxy,syz}});
}
/** Exactly three finite ground welds. Strength is ideal/unrated; all signed
 * reactions are hammer-transmitted and do zero work. No dynamics feedback. */
export class PendulumFoundation{
 readonly certificate;private constructor(readonly stop:number,readonly origin:VillageVec3,readonly components:readonly Component[],readonly stopFamily:Readonly<{faceX:number;delta:readonly[number,number];z:readonly[number,number];lever:number;angle:number}>){brand.add(this);this.certificate=Object.freeze({model:'ideal-ground-anchor',strength:'ideal-unrated',tension:'admitted-at-enrolled-anchors-only',fixedMass:'not-modelled',recipient:'village-world-frame',work:0,terrain:'patch-identity; independent full Scene triangle-area oracle required',components,anchors:components.flatMap(c=>c.anchors),stop:stopFamily});Object.freeze(this);}
 static certified(value:unknown,stop:number):value is PendulumFoundation{return value instanceof PendulumFoundation&&brand.has(value)&&value.stop===stop;}
 static enrol(station:VillageStation,d:PendulumDrive,parts:PendulumParts,support:PendulumSupport):PendulumFoundation{
  if(!PendulumSupport.certified(support,station.stop))fail(station.stop,'Missing actual journal certificate');
  // Recheck geometry/graph rather than accepting a stale certificate with
  // mutated parts. Every actual fixed component has its independent ground path.
  PendulumSupport.enrol(station,d,parts);
  if(d.footings.length!==3)fail(station.stop,'Expected exactly three named patch identities');
  for(let i=0;i<3;i++)for(let j=i+1;j<3;j++){const a=d.footings[i]!,b=d.footings[j]!;if(Math.abs(a.x-b.x)<a.half+b.half&&Math.abs(a.z-b.z)<a.half+b.half)fail(station.stop,'Anchor patches overlap');}
  const names=['frame-post--1','frame-post-1','bell-foot'],anchors:Anchor[]=[];
  for(let i=0;i<names.length;i++){
   const part=parts.parts.find(p=>p.id===names[i]);if(!part||part.body!=='fixed')fail(station.stop,'Wrong anchor identity/body');const p=part.geometry.getAttribute('position'),min=Math.min(...Array.from({length:p.count},(_,j)=>p.getY(j))),unique=new Map<string,VillageVec3>();
   for(let j=0;j<p.count;j++)if(p.getY(j)===min){const point=[p.getX(j)+d.axle.origin[0],p.getY(j)+d.axle.origin[1],p.getZ(j)+d.axle.origin[2]]as const;unique.set(point.join('/'),point);}
   const corners=[...unique.values()],patch=d.footings[i]!;if(corners.length!==4||patch.heights.some(h=>h!==patch.heights[0]))fail(station.stop,'Anchor is not one flat rectangle on its own horizontal patch');
   const xs=[...new Set(corners.map(p=>p[0]))].sort((a,b)=>a-b),zs=[...new Set(corners.map(p=>p[2]))].sort((a,b)=>a-b);if(xs.length!==2||zs.length!==2)fail(station.stop,'Non-rectangular foot');
   if(min!==Math.fround(patch.heights[0]-d.axle.origin[1]))fail(station.stop,'Foot height is not the exact packed terrain-plane construction');
   for(const c of corners)if(c[0]<patch.x-patch.half||c[0]>patch.x+patch.half||c[2]<patch.z-patch.half||c[2]>patch.z+patch.half)fail(station.stop,'Actual bottom rectangle leaves its named patch');
   const halfX=(xs[1]!-xs[0]!)/2,halfZ=(zs[1]!-zs[0]!)/2,centre=[(xs[1]!+xs[0]!)/2,min+d.axle.origin[1],(zs[1]!+zs[0]!)/2]as const;
   if(!(halfX>0&&halfZ>0))fail(station.stop,'Degenerate foot area');anchors.push(Object.freeze({part:names[i]!,patch:i,centre,corners,area:4*halfX*halfZ,halfX,halfZ}));
  }
  for(const part of parts.parts)if(part.body==='fixed'&&!names.includes(part.id)){const v=part.geometry.getAttribute('position');for(let i=0;i<v.count;i++){const h=footingHeight(d,v.getX(i)+d.axle.origin[0],v.getZ(i)+d.axle.origin[2]);if(h!==undefined&&v.getY(i)<=Math.fround(h-d.axle.origin[1]))fail(station.stop,'An unenrolled fixed part touches ground');}}
  const components=[anchorComponent('journal-frame',['fixed-axle','frame-post--1','frame-post-1','frame-cap'],anchors.slice(0,2)),anchorComponent('bell-stand',['bell-stop','bell-return','bell-foot'],anchors.slice(2))];
  const bar=parts.bar.getAttribute('position'),maxX=Math.max(...Array.from({length:bar.count},(_,i)=>bar.getX(i))),face=Array.from({length:bar.count},(_,i)=>i).filter(i=>bar.getX(i)===maxX),bell=parts.parts.find(p=>p.id==='bell-stop')!.geometry.getAttribute('position');
  const delta=[Math.min(...face.map(i=>bar.getY(i)))+d.bar.arm,Math.max(...face.map(i=>bar.getY(i)))+d.bar.arm]as const,z=[Math.max(Math.min(...face.map(i=>bar.getZ(i))),Math.min(...Array.from({length:bell.count},(_,i)=>bell.getZ(i)))),Math.min(Math.max(...face.map(i=>bar.getZ(i))),Math.max(...Array.from({length:bell.count},(_,i)=>bell.getZ(i))))]as const;
  if(!(delta[0]<=0&&delta[1]>=0&&z[0]<=-.22&&z[1]>=-.22))fail(station.stop,'Declared stop resultant is outside its actual face family');
  return new PendulumFoundation(station.stop,d.axle.origin,components,{faceX:maxX,delta,z,lever:d.bar.arm,angle:d.stopAngle});
 }
 private transport(component:Component,w:Wrench,torque:number,force:number[],moment:number[]):void{
  if(![...w.force,...w.moment,...w.axialTerms,torque].every(Number.isFinite))fail(this.stop,'Nonfinite structural load');
  const x=this.origin[0]-component.reference[0],y=this.origin[1]-component.reference[1],z=this.origin[2]-component.reference[2],[fx,fy,fz]=w.force;
  force[0]=fx;force[1]=fy;force[2]=fz;moment[0]=w.moment[0]+y*fz-z*fy;moment[1]=w.moment[1]+z*fx-x*fz;moment[2]=w.moment[2]+torque+x*fy-y*fx;
 }
 groundForce(time:number,source:GroundForce['source'],w:Wrench,coulomb:number,out:GroundForce):void{
  if(!Number.isFinite(time))fail(this.stop,'Nonfinite observation time');if(out.kind!=='force'||out.component!=='journal-frame')fail(this.stop,'Wrong force receipt/recipient');this.transport(this.components[0]!,w,coulomb,out.force,out.moment);out.time=time;out.source=source;out.coulomb=coulomb;out.minimumNormalTraction=tractionWitness(this.components[0]!,out.force,out.moment,out.traction);out.tensile=out.minimumNormalTraction<0;
 }
 groundImpulse(time:number,event:'strike-impact'|'reimpact'|'bell',w:Wrench,stop?:Readonly<{impulse:number;normal:readonly[number,number];delta:number;z:number;angle:number;member:'declared'|'family-corner'}>):readonly GroundImpulse[]{
  if(!Number.isFinite(time)||!['strike-impact','reimpact','bell'].includes(event)||(event==='bell')!==!!stop)fail(this.stop,'Wrong impulse event/recipient');
  const f=[0,0,0],m=[0,0,0];this.transport(this.components[0]!,w,0,f,m);const traction={a0:0,a1:0,a2:0,b0:0,c0:0,g:0},sigma=tractionWitness(this.components[0]!,f as[number,number,number],m as[number,number,number],traction),result:GroundImpulse[]=[{kind:'impulse',time,event,component:'journal-frame',member:stop?.member??'declared',impulse:f as[number,number,number],angularImpulse:m as[number,number,number],minimumNormalTraction:sigma,tensile:sigma<0,traction,...(stop?{stopSite:{delta:stop.delta,z:stop.z,impulse:stop.impulse,angle:stop.angle}}:{})}];
  if(stop){const family=this.stopFamily;if(![stop.impulse,...stop.normal,stop.delta,stop.z,stop.angle].every(Number.isFinite)||stop.angle!==this.stopFamily.angle||stop.normal[0]!==Math.cos(stop.angle)||stop.normal[1]!==Math.sin(stop.angle)||!(stop.impulse>0)||stop.delta<family.delta[0]||stop.delta>family.delta[1]||stop.z<family.z[0]||stop.z>family.z[1])fail(this.stop,'Invalid stop resultant family member');const c=this.components[1]!,a=Math.cos(stop.angle),b=Math.sin(stop.angle),point=new Vector3(family.faceX*a-(-family.lever+stop.delta)*b+this.origin[0],family.faceX*b+(-family.lever+stop.delta)*a+this.origin[1],this.origin[2]+stop.z),impulse=[-stop.impulse*stop.normal[0],-stop.impulse*stop.normal[1],0]as const,r=point.sub(new Vector3(...c.reference)),moment=new Vector3().crossVectors(r,new Vector3(...impulse)).toArray()as[number,number,number],field={a0:0,a1:0,a2:0,b0:0,c0:0,g:0},minimum=tractionWitness(c,impulse,moment,field);result.push({kind:'impulse',time,event,component:'bell-stand',member:stop.member,impulse,angularImpulse:moment,minimumNormalTraction:minimum,tensile:minimum<0,traction:field,stopSite:{delta:stop.delta,z:stop.z,impulse:stop.impulse,angle:stop.angle}});}
  return result;
 }
}
