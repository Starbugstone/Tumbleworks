import {Matrix4,Ray,Triangle,Vector3,type BufferGeometry} from 'three';
import type { PendulumDrive } from './pendulum-types';
import type { VillageStation,VillageVec3 } from './village-plan';
import type { PendulumParts } from '../view/pendulum-parts';
import { VillageAdmissibilityError } from './village-contact';
export interface FootingPatch {readonly x:number;readonly z:number;readonly half:number;readonly heights:readonly[number,number,number,number]}
/** Finite terrain patches. The actual Scene check must independently compare
 * every intersected terrain triangle, including its clipped interior. */
export function footingHeight(d:PendulumDrive,x:number,z:number):number|undefined{
 for(const p of d.footings){
  if(x<p.x-p.half||x>p.x+p.half||z<p.z-p.half||z>p.z+p.half)continue;
  const u=(x-p.x)/(2*p.half)+.5,v=(z-p.z)/(2*p.half)+.5;
  const [a,b,c,e]=p.heights;return u>=v?a+(b-a)*u+(e-b)*v:a+(e-c)*u+(c-a)*v;
 }
 return;
}
const supports=new WeakSet<PendulumSupport>();
function fail(stop:number,detail:string,required=1,available=0):never{throw new VillageAdmissibilityError(stop,'striker-bearing-certificate','unsupported-contact-geometry',required,available,detail);}
function vertices(g:BufferGeometry){const p=g.getAttribute('position'),m=new Map<string,Vector3>();for(let i=0;i<p.count;i++){const v=new Vector3().fromBufferAttribute(p,i);m.set(v.toArray().join('/'),v);}return[...m.values()];}
function triangles(g:BufferGeometry){const p=g.getAttribute('position'),ix=g.index,t:Triangle[]=[];for(let i=0;i<(ix?.count??p.count);i+=3)t.push(new Triangle(...[0,1,2].map(j=>new Vector3().fromBufferAttribute(p,ix?ix.getX(i+j):i+j))as[Vector3,Vector3,Vector3]));return t;}
function polygon(v:readonly Vector3[],storage:number){const points:Vector3[]=[];for(const p of v)if(!points.some(a=>Math.hypot(p.x-a.x,p.y-a.y)<=storage))points.push(p);return points.sort((a,b)=>Math.atan2(a.y,a.x)-Math.atan2(b.y,b.x));}
function planes(v:readonly Vector3[]){return v.map((a,i)=>{const b=v[(i+1)%v.length]!,length=Math.hypot(b.x-a.x,b.y-a.y),nx=(b.y-a.y)/length,ny=(a.x-b.x)/length;return{nx,ny,d:nx*a.x+ny*a.y};});}
export interface BearingReaction {readonly at:VillageVec3;readonly normal:VillageVec3;readonly force:number}
export interface BearingWrench {readonly force:VillageVec3;readonly moment:VillageVec3;readonly axialTerms:readonly number[]}
/** The ONLY nominal surface here is this explicitly declared common-cylinder
 * revolute pair. Its raw chord gaps remain real and are reported separately.
 * Strength is the ideal rigid-joint model; Coulomb torque is a separate rating. */
export class PendulumSupport {
 private constructor(readonly stop:number,readonly radius:number,readonly axial:readonly[number,number],readonly certificate:Readonly<{
  model:'nominal-common-cylinder';parts:readonly['fixed-axle','hammer-hub'];shaftPhase:number;borePhase:number;
  shaftCircumradius:number;boreApothem:number;nominalMismatch:number;storageBound:number;
  shaftChordDeviation:number;boreChordDeviation:number;containmentMargin:number;
  supportPlanes:readonly Readonly<{nx:number;ny:number;d:number}>[];
 }>){supports.add(this);Object.freeze(this);}
 static certified(v:unknown,stop:number):v is PendulumSupport{return v instanceof PendulumSupport&&supports.has(v)&&v.stop===stop;}
 static enrol(station:VillageStation,d:PendulumDrive,parts:PendulumParts):PendulumSupport{
  const stop=station.stop;
  if(d.axle.axis[0]!==0||d.axle.axis[1]!==0||d.axle.axis[2]!==1||station.entry.tangent.some((v,i)=>v!==[1,0,0][i])||station.entry.normal.some((v,i)=>v!==[0,1,0][i])||station.exit.position[1]!==station.anchor[1]||station.exit.position[2]!==station.anchor[2])fail(stop,'Only flat +x/up, zero axial-load terms are supported');
  const joint=parts.joints.find(j=>j.id==='axle-bearing');
  if(!joint||joint.model!=='ideal-revolute'||joint.parts.join('/')!=='fixed-axle/hammer-hub'||!joint.axial)fail(stop,'Missing named finite revolute declaration');
  const shaft=parts.parts.find(p=>p.id==='fixed-axle'),hub=parts.parts.find(p=>p.id==='hammer-hub');
  if(!shaft||!hub||shaft.body!=='fixed'||hub.body!=='hammer'||new Set(parts.parts.map(p=>p.id)).size!==parts.parts.length)fail(stop,'Wrong physical ownership or missing bore');
  const sv=vertices(shaft.geometry),hv=vertices(hub.geometry),radial=(v:Vector3)=>Math.hypot(v.x,v.y);
  const storage=2**-24*Math.sqrt(2)*Math.max(...sv.map(radial),...hv.map(radial))+64*Number.EPSILON;
  const sz=[Math.min(...sv.map(p=>p.z)),Math.max(...sv.map(p=>p.z))],hz=[Math.min(...hv.map(p=>p.z)),Math.max(...hv.map(p=>p.z))];
  const outer=Math.max(...hv.map(radial)),inner=Math.min(...hv.map(radial)),bore=polygon(hv.filter(v=>radial(v)<(inner+outer)/2),storage),sp=polygon(sv.filter(v=>radial(v)>storage),storage);
  if(bore.length!==16||sp.length!==16)fail(stop,'Missing complete packed shaft/bore polygons');
  const bp=planes(bore),shaftPlanes=planes(sp),sr=Math.max(...sp.map(radial)),br=Math.min(...bp.map(p=>p.d));
  for(const p of [...sp,...bore])if(!Number.isFinite(p.length()))fail(stop,'Nonfinite joint buffer');
  for(const [points,faces]of[[sp,shaftPlanes],[bore,bp]]as const){
   const r=Math.max(...points.map(radial));if(Math.max(...points.map(p=>Math.abs(radial(p)-r)))>storage)fail(stop,'Moved/tilted/eccentric nominal axis');
   for(let i=0;i<points.length;i++){
    const p=points[i]!,next=points[(i+1)%points.length]!,cross=p.x*next.y-p.y*next.x,dot=p.x*next.x+p.y*next.y;
    if(Math.abs(Math.atan2(cross,dot)-2*Math.PI/16)>4*storage/r||faces[i]!.d<=0)fail(stop,'Packed phase/support planes do not form the declared complete regular polygon');
   }
  }
  if(Math.abs(sr-br)>storage||Math.abs(sr-parts.bearingRadius)>storage)fail(stop,'Extra nominal clearance/radius mismatch',Math.abs(sr-br),storage);
  // Circle containment is an all-angle proof: the shaft lies inside its
  // circumcircle; the bore contains its incircle at EVERY sector rotation.
  if(sr>br+storage)fail(stop,'Out-of-sector penetration',sr-br,storage);
  const z0=Math.max(sz[0]!,hz[0]!),z1=Math.min(sz[1]!,hz[1]!);
  const axialStorage=2**-24*Math.max(...sv.map(v=>Math.abs(v.z)),...hv.map(v=>Math.abs(v.z)))+64*Number.EPSILON;
  if(Math.abs(hz[0]!-joint.axial[0])>axialStorage||Math.abs(hz[1]!-joint.axial[1])>axialStorage||!(z1-z0>.1)||sz[0]!>=hz[0]!||sz[1]!<=hz[1]!)fail(stop,'Insufficient actual axial bearing overlap');
  // Flat finite feet have real upward planes. No world-wide soil is invented.
  if(d.footings.length!==3)fail(stop,'Missing finite terrain patches');
  for(const id of['frame-post--1','frame-post-1','bell-foot']){
   const p=parts.parts.find(p=>p.id===id);if(!p||p.body!=='fixed')fail(stop,`Missing fixed load path ${id}`);
   const v=vertices(p.geometry),min=Math.min(...v.map(v=>v.y)),bottom=v.filter(v=>Math.abs(v.y-min)<=storage);
   if(bottom.length!==4)fail(stop,'Foot must have one complete planar rectangle');
   const footStorage=2**-24*Math.max(...v.map(p=>Math.abs(p.y)))+64*Number.EPSILON*Math.max(1,Math.abs(d.axle.origin[1]));
   for(const v of bottom){const actual=footingHeight(d,d.axle.origin[0]+v.x,d.axle.origin[2]+v.z);if(actual===undefined||Math.abs(v.y+d.axle.origin[1]-actual)>footStorage)fail(stop,'Foot rectangle leaves its finite supporting surface',actual===undefined?Infinity:Math.abs(v.y+d.axle.origin[1]-actual),footStorage);}
  }
  const required=['striking-bar','hammer-arm','bar-return','hammer-hub','fixed-axle','frame-post--1','frame-post-1','frame-cap','bell-stop','bell-foot','bell-return'];
  if(parts.parts.length!==required.length||required.some(id=>!parts.parts.some(p=>p.id===id)))fail(stop,'Incomplete physical inventory/load path');
  const bounds=(id:string)=>{const v=vertices(parts.parts.find(p=>p.id===id)!.geometry);return{min:[0,1,2].map(i=>Math.min(...v.map(p=>p.getComponent(i)))),max:[0,1,2].map(i=>Math.max(...v.map(p=>p.getComponent(i))))};};
  const cap=bounds('frame-cap');
  if(cap.min[1]!<=Math.max(...hv.map(v=>Math.hypot(v.x,v.y)))+storage)fail(stop,'Foreign frame cap crosses rotating hub envelope');
  for(const side of[-1,1]){
   const post=bounds(`frame-post-${side}`);
   if(post.min[0]!>=-sr||post.max[0]!<=sr||post.min[1]!>=-sr||post.max[1]!<=sr||Math.min(post.max[2]!,sz[1]!)-Math.max(post.min[2]!,sz[0]!)<=.1)fail(stop,'Axle has no finite post weld');
   // Box half-height and translated y each incur one Float32 store. Since the
   // post bottom is below -.12 and its top is .1, both producing magnitudes
   // fit its existing y extrema; the cap's do too. This bounds y, not axle z.
   const flushStorage=2**-23*(Math.max(Math.abs(post.min[1]!),Math.abs(post.max[1]!))+Math.max(Math.abs(cap.min[1]!),Math.abs(cap.max[1]!)))+64*Number.EPSILON;
   if(!Number.isFinite(flushStorage)||Math.abs(post.max[1]!-cap.min[1]!)>flushStorage||post.min[0]!<cap.min[0]!-storage||post.max[0]!>cap.max[0]!+storage||post.min[2]!<cap.min[2]!-axialStorage||post.max[2]!>cap.max[2]!+axialStorage)fail(stop,'Frame cap/post finite flush joint missing');
  }
  const inside=(id:string,p:Vector3)=>{const t=triangles(parts.parts.find(part=>part.id===id)!.geometry),ray=new Ray(p,new Vector3(1,.371,.217).normalize()),hit=new Vector3(),hits:number[]=[];
   for(const face of t)if(ray.intersectTriangle(face.a,face.b,face.c,false,hit)){const distance=hit.distanceTo(p);if(!hits.some(d=>Math.abs(d-distance)<=storage))hits.push(distance);}return hits.length%2===1;
  };
  const weld=(a:string,b:string,p:Vector3)=>{if(!inside(a,p)||!inside(b,p))fail(stop,`Finite physical weld ${a}/${b} missing`);};
  weld('striking-bar','bar-return',new Vector3(0,-d.bar.arm+.025,-.265));
  weld('bar-return','hammer-arm',new Vector3(0,-d.bar.arm+.06,-.35));
  weld('hammer-arm','hammer-hub',new Vector3(0,-.045,-.36));
  const barSupport=Math.max(...vertices(parts.bar).map(v=>v.x)),cq=Math.cos(d.stopAngle),sq=Math.sin(d.stopAngle),plateX=d.bar.arm*sq+(barSupport+.04)*cq,plateY=-d.bar.arm*cq+(barSupport+.04)*sq;
  const start=new Vector3(plateX,plateY-.32,-.62),end=new Vector3(plateX+.06*sq,plateY-.06*cq,-.31),axis=end.clone().sub(start).normalize();
  const weldRadial=new Vector3(0,-axis.z,axis.y).normalize();
  weld('bell-foot','bell-return',start.clone().addScaledVector(axis,.005).addScaledVector(weldRadial,.015));
  weld('bell-stop','bell-return',end.clone().addScaledVector(axis,-.005));
  // The same actual packed bar face meets the actual bell plate at qstop.
  const bar=parts.parts.find(p=>p.id==='striking-bar'),bell=parts.parts.find(p=>p.id==='bell-stop');if(!bar||!bell)fail(stop,'Missing stop pair');
  const bv=vertices(bar.geometry),q=d.stopAngle,c=Math.cos(q),s=Math.sin(q),normal=new Vector3(c,s,0),direction=normal.clone().negate();
  const posed=bv.map(v=>v.clone().applyMatrix4(new Matrix4().makeRotationZ(q))),max=Math.max(...posed.map(v=>v.dot(normal))),face=posed.filter(v=>Math.abs(v.dot(normal)-max)<=storage);
  const ts=triangles(bell.geometry),ray=new Ray(),hit=new Vector3(),stopStorage=2**-24*8*Math.max(1,d.bar.arm);
  for(const v of face){
   const p=v.clone();p.z=Math.max(-.27,Math.min(-.12,v.z));ray.set(p.clone().addScaledVector(normal,-.01),normal);let distance=Infinity,dot=0;
   for(const t of ts)if(ray.intersectTriangle(t.a,t.b,t.c,false,hit)){const distance0=hit.distanceTo(ray.origin);if(distance0<distance){distance=distance0;dot=t.getNormal(new Vector3()).dot(direction);}}
   if(Math.abs(distance-.01)>stopStorage||dot<.99999)fail(stop,'Actual opposed stop contact face missing',Math.abs(distance-.01),stopStorage);
  }
  if(face.length<4||bv.some(v=>v.y>=0))fail(stop,'Stop support-face/sector monotonicity witness missing');
  return new PendulumSupport(stop,(sr+br)/2,[z0+(z1-z0)/4,z1-(z1-z0)/4],Object.freeze({model:'nominal-common-cylinder',parts:['fixed-axle','hammer-hub']as const,shaftPhase:Math.atan2(sp[0]!.y,sp[0]!.x),borePhase:Math.atan2(bore[0]!.y,bore[0]!.x),shaftCircumradius:sr,boreApothem:br,nominalMismatch:sr-br,storageBound:storage,shaftChordDeviation:sr-Math.min(...shaftPlanes.map(p=>p.d)),boreChordDeviation:Math.max(...bore.map(radial))-br,containmentMargin:br-sr,supportPlanes:bp}));
 }
 /** Opposed radial forces at two finite axial sections span Fx/Fy/Mx/My.
  * Fz must vanish TERM BY TERM: this bearing has no invented thrust face. */
 reactions(w:BearingWrench):readonly BearingReaction[]{
  if(w.axialTerms.some(v=>v!==0)||w.force[2]!==0||w.moment[2]!==0)fail(this.stop,'Unsupported axial force or torque assigned to radial joint');
  const [a,b]=this.axial,L=b-a,[fx,fy]=w.force,[mx,my]=w.moment;
  const forces=[[(b*fx-my)/L,(b*fy+mx)/L],[(my-a*fx)/L,(-mx-a*fy)/L]];
  return forces.flatMap((force,i)=>force.map((v,j)=>({at:[j===0?Math.sign(v!)*this.radius:0,j===1?Math.sign(v!)*this.radius:0,i===0?a:b]as VillageVec3,normal:[j===0?Math.sign(v!):0,j===1?Math.sign(v!):0,0]as VillageVec3,force:Math.abs(v!)})));
 }
}
