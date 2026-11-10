import {BufferGeometry,TubeGeometry,Vector3} from 'three';
import {retainerParts,type RetainedLayout} from '../view/retainer-parts';
import type {VillageProfile,VillageStation} from './village-plan';
export type {RetainedLayout} from '../view/retainer-parts';
export type RetentionSpec=NonNullable<VillageStation['retention']>;
export interface PartMass {readonly id:string;readonly volume:number;readonly mass:number;readonly centre:readonly[number,number,number];readonly axleInertia:number}
export interface RigidBodyMass {readonly id:'head-frame'|'capture-head'|'fork'|'carrier'|'source-weight';readonly mass:number;readonly parts:readonly PartMass[];readonly centre:readonly[number,number,number];readonly axleInertia:number;readonly centralInertia:number;readonly maximumRadius:number}
interface InventoryBase {readonly model:'disjoint-composite-part-volumes';readonly head:RigidBodyMass;readonly fork:RigidBodyMass;readonly carrier:RigidBodyMass;readonly weight:RigidBodyMass;readonly translatingMass:number}
export type RetainedInventory=InventoryBase & (
 {readonly layout:'keyed-split'|'rigid-gate';readonly frame?:never}|
 {readonly layout:'keyed-prismatic';readonly frame:RigidBodyMass;readonly headAssemblyMass:number;readonly openingMass:number;readonly forkAxleTensor:readonly[number,number,number,number,number,number,number,number,number]});
/** Signed tetrahedra; tube caps exist for mass integration only. Component
 * overlaps are counted separately by the explicitly declared composite model. */
export function solidMoments(geometry:BufferGeometry){
 if(geometry.userData.retainerRenderTrim)throw new Error('Inventory requires untrimmed closed solids');
 const p=geometry.getAttribute('position'),index=geometry.index;const triangles:number[][]=[];
 const tube=geometry instanceof TubeGeometry?geometry:undefined;
 const count=tube?tube.parameters.tubularSegments*tube.parameters.radialSegments*6:(index?.count??p.count);
 for(let i=0;i<count;i+=3)triangles.push([index?index.getX(i):i,index?index.getX(i+1):i+1,index?index.getX(i+2):i+2]);
 const a=new Vector3(),b=new Vector3(),c=new Vector3();
 if(tube){const n=tube.parameters.radialSegments,segments=tube.parameters.tubularSegments;
  for(const ring of[0,segments]){const base=ring*(n+1),next=(ring===0?1:segments-1)*(n+1),out=new Vector3();for(let j=0;j<n;j++)out.add(new Vector3().fromBufferAttribute(p,base+j)).sub(new Vector3().fromBufferAttribute(p,next+j));
   for(let j=1;j<n-1;j++){const ids=[base,base+j,base+j+1];a.fromBufferAttribute(p,ids[0]!);b.fromBufferAttribute(p,ids[1]!);c.fromBufferAttribute(p,ids[2]!);if(b.clone().sub(a).cross(c.clone().sub(a)).dot(out)<0)ids.reverse();triangles.push(ids);}
  }
 }
 let volume=0,x=0,y=0,z=0,xx=0,yy=0;
 const square=(a:number,b:number,c:number)=>a*a+b*b+c*c+a*b+a*c+b*c;
 for(const ids of triangles){a.fromBufferAttribute(p,ids[0]!);b.fromBufferAttribute(p,ids[1]!);c.fromBufferAttribute(p,ids[2]!);const v=a.dot(b.clone().cross(c))/6;volume+=v;x+=v*(a.x+b.x+c.x)/4;y+=v*(a.y+b.y+c.y)/4;z+=v*(a.z+b.z+c.z)/4;xx+=v*square(a.x,b.x,c.x)/10;yy+=v*square(a.y,b.y,c.y)/10;}
 if(!Number.isFinite(volume)||Math.abs(volume)<1e-12)throw new Error('Retainer part has no finite solid volume');
 const sign=Math.sign(volume);volume*=sign;x*=sign;y*=sign;z*=sign;xx*=sign;yy*=sign;
 const centre=Object.freeze([x/volume,y/volume,z/volume]as const),axlePerMass=(xx+yy)/volume;
 if(axlePerMass<=centre[0]**2+centre[1]**2)throw new Error('Retainer part has zero central polar inertia');
 let maximumRadius=0;for(let i=0;i<p.count;i++)maximumRadius=Math.max(maximumRadius,Math.hypot(p.getX(i),p.getY(i)));
 return Object.freeze({volume,centre,axlePerMass,maximumRadius});
}
export function retainedInventory(spec:RetentionSpec,profile:VillageProfile,layout:RetainedLayout):RetainedInventory{
 if(layout==='keyed-prismatic')return captiveInventory(spec,profile);
 const parts=retainerParts(profile,layout);try{
 const required=['terracotta','plank','timber'].includes(profile)?['leading-sleeve','trailing-sleeve','leading-return','trailing-return','tie','journal']:['leading-sleeve','trailing-sleeve','tie','journal'];
 if(layout==='keyed-split')required.push('stator','key-pin','slider','open-follower');
 if(parts.length!==required.length||required.some(id=>!parts.some(p=>p.id===id)))throw new Error('Missing actual retained inventory part');
 const measured=parts.map(part=>({id:part.id,body:part.body,...solidMoments(part.geometry)}));
 if(new Set(measured.map(p=>p.id)).size!==measured.length)throw new Error('Duplicate inventory part');
 const body=(id:'capture-head'|'fork',mass:number):RigidBodyMass=>{
  if(!(mass>0))throw new Error('Disjoint retained mass must be positive');const selected=measured.filter(p=>p.body===id),volume=selected.reduce((s,p)=>s+p.volume,0);
  const rows=selected.map(p=>Object.freeze({id:p.id,volume:p.volume,mass:mass*p.volume/volume,centre:p.centre,axleInertia:mass*p.volume/volume*p.axlePerMass}));
  const centre=Object.freeze([0,1,2].map(i=>rows.reduce((sum,p)=>sum+p.mass*p.centre[i]!,0)/mass)as[number,number,number]);const axleInertia=rows.reduce((s,p)=>s+p.axleInertia,0),centralInertia=axleInertia-mass*(centre[0]**2+centre[1]**2);
  if(!(centralInertia>0))throw new Error('Retained body requires positive central inertia');
  return Object.freeze({id,mass,parts:Object.freeze(rows),centre,axleInertia,centralInertia,maximumRadius:Math.max(...selected.map(p=>p.maximumRadius))});
 };
 const lump=(id:'carrier'|'source-weight',mass:number):RigidBodyMass=>Object.freeze({id,mass,parts:Object.freeze([]),centre:Object.freeze([0,0,0]as const),axleInertia:0,centralInertia:0,maximumRadius:0});
 const inventory:RetainedInventory=Object.freeze({layout,model:'disjoint-composite-part-volumes',head:body('capture-head',spec.headMass),fork:body('fork',spec.gateMass),carrier:lump('carrier',spec.bodyMass),weight:lump('source-weight',spec.weightMass),translatingMass:spec.headMass+spec.gateMass});
 assertRetainedInventory(inventory);return inventory;
 }finally{parts.forEach(p=>p.geometry.dispose());}
}

export function assertRetainedInventory(inventory:RetainedInventory):void{
 if(inventory.layout==='keyed-prismatic'){
  const bodies=[inventory.frame,inventory.head,inventory.fork],ids=bodies.flatMap(b=>b.parts.map(p=>p.id));
  const required=['slider','key-pin','leaf-guide','leading-sleeve','lift-arm','leaf-shoe','leading-return','trailing-return','trailing-sleeve','tie','journal','open-follower'];
  if(inventory.model!=='disjoint-composite-part-volumes'||ids.length!==required.length||new Set(ids).size!==ids.length||required.some(id=>!ids.includes(id)))throw new Error('Captive inventory ownership is not exhaustive/disjoint');
  if(inventory.frame.mass+inventory.head.mass!==inventory.headAssemblyMass||inventory.openingMass!==inventory.head.mass||inventory.translatingMass!==inventory.headAssemblyMass+inventory.fork.mass)throw new Error('Original head allocation not conserved');
  for(const body of bodies)if(!(body.mass>0&&body.centralInertia>0&&body.axleInertia>0&&body.parts.length))throw new Error('Captive rigid body has no finite inertia');
  return;
 }
 if(inventory.model!=='disjoint-composite-part-volumes'||inventory.translatingMass!==inventory.head.mass+inventory.fork.mass)throw new Error('Retained masses must be disjoint and exhaustive');
 const ids=[...inventory.head.parts,...inventory.fork.parts].map(p=>p.id);
 for(const id of ['leading-sleeve','trailing-sleeve','tie','journal',...(inventory.layout==='keyed-split'?['stator','key-pin','slider','leading-return','trailing-return','open-follower']:[])])if(!ids.includes(id))throw new Error('Missing retained part');if(new Set(ids).size!==ids.length)throw new Error('A retained part is owned by two bodies');
 for(const body of[inventory.head,inventory.fork])if(!(body.mass>0&&body.centralInertia>0&&body.axleInertia>0&&body.parts.length>0))throw new Error('Retained body cannot be a point mass or lose its parts');
}

function captiveInventory(spec:RetentionSpec,profile:VillageProfile):RetainedInventory {
 const reference=retainedInventory(spec,profile,'keyed-split'),parts=retainerParts(profile,'keyed-prismatic');
 try{
  const measured=parts.filter(p=>p.body!=='fork').map(p=>({id:p.id,body:p.body,...solidMoments(p.geometry)}));
  const frameVolume=measured.filter(p=>p.body==='head-frame').reduce((sum,p)=>sum+p.volume,0),volume=measured.reduce((sum,p)=>sum+p.volume,0);
  const leafVolume=volume-frameVolume,larger=spec.headMass*Math.max(frameVolume,leafVolume)/volume;
  const frameMass=frameVolume>=leafVolume?larger:spec.headMass-larger,leafMass=frameVolume>=leafVolume?spec.headMass-larger:larger;
  if(frameMass+leafMass!==spec.headMass||frameMass+leafMass+spec.gateMass!==spec.headMass+spec.gateMass)throw new Error('Capture literal split not exact');
  const body=(id:'head-frame'|'capture-head',mass:number):RigidBodyMass=>{
   const selected=measured.filter(p=>p.body===id),v=selected.reduce((sum,p)=>sum+p.volume,0);
   const rows=selected.map(p=>Object.freeze({id:p.id,volume:p.volume,mass:mass*p.volume/v,centre:p.centre,axleInertia:mass*p.volume/v*p.axlePerMass}));
   const centre=Object.freeze([0,1,2].map(i=>rows.reduce((sum,p)=>sum+p.mass*p.centre[i]!,0)/mass)as[number,number,number]),axleInertia=rows.reduce((sum,p)=>sum+p.axleInertia,0),centralInertia=axleInertia-mass*(centre[0]**2+centre[1]**2);
   if(!(mass>0&&centralInertia>0))throw new Error('Captive body needs measured positive mass and central inertia');
   return Object.freeze({id,mass,parts:Object.freeze(rows),centre,axleInertia,centralInertia,maximumRadius:Math.max(...selected.map(p=>p.maximumRadius))});
  };
  const frame=body('head-frame',frameMass),head=body('capture-head',leafMass);
  const result:RetainedInventory=Object.freeze({layout:'keyed-prismatic',model:'disjoint-composite-part-volumes',frame,head,headAssemblyMass:spec.headMass,openingMass:head.mass,forkAxleTensor:measureForkTensor(parts,reference.fork),
   fork:reference.fork,carrier:reference.carrier,weight:reference.weight,translatingMass:spec.headMass+spec.gateMass});
  assertRetainedInventory(result);return result;
 }finally{parts.forEach(p=>p.geometry.dispose());}
}

/** Full axle tensor is needed for closure's x/y support reactions. Izz must be
 * EXACTLY the original fork scalar, so no new closure timing law is introduced. */
export {partTensor as solidTensor};
function partTensor(geometry:BufferGeometry){
 const p=geometry.getAttribute('position'),index=geometry.index;const triangles:number[][]=[];
 const tube=geometry instanceof TubeGeometry?geometry:undefined;
 const count=tube?tube.parameters.tubularSegments*tube.parameters.radialSegments*6:(index?.count??p.count);
 for(let i=0;i<count;i+=3)triangles.push([index?index.getX(i):i,index?index.getX(i+1):i+1,index?index.getX(i+2):i+2]);
 const a=new Vector3(),b=new Vector3(),c=new Vector3();
 if(tube){const n=tube.parameters.radialSegments,segments=tube.parameters.tubularSegments;
  for(const ring of[0,segments]){const base=ring*(n+1),next=(ring===0?1:segments-1)*(n+1),out=new Vector3();for(let j=0;j<n;j++)out.add(new Vector3().fromBufferAttribute(p,base+j)).sub(new Vector3().fromBufferAttribute(p,next+j));
   for(let j=1;j<n-1;j++){const ids=[base,base+j,base+j+1];a.fromBufferAttribute(p,ids[0]!);b.fromBufferAttribute(p,ids[1]!);c.fromBufferAttribute(p,ids[2]!);if(b.clone().sub(a).cross(c.clone().sub(a)).dot(out)<0)ids.reverse();triangles.push(ids);}
  }
 }
 let volume=0,xx=0,yy=0,zz=0,xy=0,xz=0,yz=0;
 const square=(a:number,b:number,c:number)=>a*a+b*b+c*c+a*b+a*c+b*c;
 const product=(x:readonly number[],y:readonly number[])=>((x[0]!+x[1]!+x[2]!)*(y[0]!+y[1]!+y[2]!)+x[0]!*y[0]!+x[1]!*y[1]!+x[2]!*y[2]!)/20;
 for(const ids of triangles){a.fromBufferAttribute(p,ids[0]!);b.fromBufferAttribute(p,ids[1]!);c.fromBufferAttribute(p,ids[2]!);const v=a.dot(b.clone().cross(c))/6;volume+=v;xx+=v*square(a.x,b.x,c.x)/10;yy+=v*square(a.y,b.y,c.y)/10;zz+=v*square(a.z,b.z,c.z)/10;xy+=v*product([a.x,b.x,c.x],[a.y,b.y,c.y]);xz+=v*product([a.x,b.x,c.x],[a.z,b.z,c.z]);yz+=v*product([a.y,b.y,c.y],[a.z,b.z,c.z]);}
 const scalar=solidMoments(geometry),sign=Math.sign(volume);if(Math.abs(volume)*1!==scalar.volume||(xx+yy)/volume!==scalar.axlePerMass)throw new Error('Tensor/scalar triangle conventions drifted');
 xx*=sign;yy*=sign;zz*=sign;xy*=sign;xz*=sign;yz*=sign;const V=Math.abs(volume);
 return[(yy+zz)/V,-xy/V,-xz/V,-xy/V,(xx+zz)/V,-yz/V,-xz/V,-yz/V,(xx+yy)/V]as const;
}
function measureForkTensor(parts:ReturnType<typeof retainerParts>,fork:RigidBodyMass):readonly[number,number,number,number,number,number,number,number,number]{
 const total=Array(9).fill(0)as number[];for(const row of fork.parts){const part=parts.find(p=>p.body==='fork'&&p.id===row.id);if(!part)throw new Error('Fork tensor lost original owner');const tensor=partTensor(part.geometry);for(let k=0;k<9;k++)total[k]!+=row.mass*tensor[k]!;}
 if(total[8]!==fork.axleInertia||![0,4,8].every(k=>total[k]!>0)||!total.every(Number.isFinite))throw new Error('Fork tensor changed original Izz or lost finite inertia');
 return Object.freeze(total as[number,number,number,number,number,number,number,number,number]);
}
