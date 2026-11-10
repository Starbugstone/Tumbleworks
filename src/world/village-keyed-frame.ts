import{CAPTIVE_SLOT,captiveTop,WEDGE_K,SLOT_C,SLOT_S}from'../view/captive-slot-profile';
import{slotReactions,type SlotWrench,type SlotRow}from'./village-captive-slot';
import{CarriageBrake}from'./village-carriage-guide';
import type{OpenGuideLoad}from'./village-lock';
import{Matrix3,Matrix4,Ray,Triangle,Vector3,type BufferGeometry}from'three';
import{retainerParts}from'../view/retainer-parts';
import{captiveSlotCornerGeometry}from'../view/retained-support';
import{openGuideGeometry}from'../view/open-lock-parts';
import{CAPTIVE_CONTACT_RADIUS,CAPTIVE_BORE_RADIUS,JOURNAL_SHOE_LEVER}from'../view/captive-leaf-parts';
import{VillageAdmissibilityError,assertContact,type VillageContactWitness}from'./village-contact';
import type{VillageProfile,VillageStation,VillageVec3}from'./village-plan';
import type{RetainedInventory}from'./village-inventory';
export interface CaptiveReaction {readonly joint:'B'|'T'|'R'|'J1'|'J2'|'J3'|'J4'|'J5'|'J6'|'J7'|'J8';readonly point:VillageVec3;readonly force:VillageVec3;readonly torque:VillageVec3;readonly magnitude:number}
export interface CaptiveWrench {readonly force:VillageVec3;readonly moment:VillageVec3}
export interface CaptiveKinematics {
 readonly phase:'capture'|'closure'|'carry'|'opening'|'closed-hold';readonly forkX:number;readonly lift:number;
 readonly acceleration:VillageVec3;readonly angularSpeed:number;readonly angularAcceleration:number;readonly forkAngle:number;
 readonly openGuide?:OpenGuideLoad;readonly liftAcceleration:number;readonly lineForce:number;readonly leafBrake:number;readonly contact:VillageContactWitness;
}
export interface CaptiveFrameWitness {
 readonly phase:CaptiveKinematics['phase'];readonly leaf:CaptiveWrench;readonly frame:CaptiveWrench;
 readonly leafReactions:readonly CaptiveReaction[];readonly frameReactions:readonly CaptiveReaction[];
 readonly preOpeningHold:number;readonly frameBrakeUse:number;readonly leafBrakeUse:number;
 readonly forkJointForce:VillageVec3;readonly forkJointMoment:VillageVec3;readonly forkJointTorque:number;readonly forkReactions:readonly CaptiveReaction[];readonly zeroAxis:0;
}
const certificates=new WeakSet<CaptiveFrameGuide>();
const vec=(v:VillageVec3)=>new Vector3(...v),freeze=(v:Vector3):VillageVec3=>Object.freeze(v.toArray());
function fail(stop:number,detail:string):never{throw new VillageAdmissibilityError(stop,'captive-frame','unsupported-contact-geometry',1,0,detail);}
function faces(g:BufferGeometry,m=new Matrix4()){const p=g.getAttribute('position'),ix=g.index,result:Triangle[]=[];for(let i=0;i<(ix?.count??p.count);i+=3)result.push(new Triangle(...[0,1,2].map(k=>new Vector3().fromBufferAttribute(p,ix?ix.getX(i+k):i+k).applyMatrix4(m))as[Vector3,Vector3,Vector3]));return result;}
function faceAt(stop:number,triangles:readonly Triangle[],point:Vector3,out:Vector3,bound:number){const ray=new Ray(point.clone().addScaledVector(out,-.0001),out),hit=new Vector3(),normal=new Vector3();let best=Infinity,dot=-1;for(const t of triangles)if(ray.intersectTriangle(t.a,t.b,t.c,false,hit)){const d=hit.distanceTo(ray.origin);if(d<best){best=d;dot=t.getNormal(normal).dot(out);}}if(Math.abs(best-.0001)>bound||dot<.99999)fail(stop,`Missing actual finite opposed contact face ${point.toArray()} normal ${out.toArray()} hit ${best} dot ${dot}`);}
function pair(stop:number,a:readonly Triangle[],b:readonly Triangle[],point:Vector3,out:Vector3,bound:number){faceAt(stop,a,point,out,bound);faceAt(stop,b,point,out.clone().negate(),bound);}
/** NOMINAL ideal-cylinder declaration plus separate packed evidence. No clearance
 * tolerance is changed. All radial samples use ACTUAL source buffers/matrices. */
export function certifyCaptiveJournal(stop:number,pin:BufferGeometry,bore:BufferGeometry,angle:number){
 const p=pin.getAttribute('position'),b=bore.getAttribute('position'),radius=CAPTIVE_CONTACT_RADIUS,bound=8*2**-24;
 if(!(JOURNAL_SHOE_LEVER<=radius)||p.count!==16||b.count!==32)fail(stop,'Unsupported nominal journal producer');
 for(let i=0;i<p.count;i++){const expected=Math.PI/8+(i%8)*Math.PI/4;if(Math.abs(p.getX(i)-radius*Math.cos(expected))>bound||Math.abs(p.getY(i)-radius*Math.sin(expected))>bound||Math.abs(p.getZ(i)-(i<8?-.88:-.675))>bound)fail(stop,'Wrong pin ideal radius, phase or axial extent');}
 const rotation=new Matrix4().makeRotationZ(angle),inner=Array.from({length:8},(_,i)=>new Vector3().fromBufferAttribute(b,i).applyMatrix4(rotation));
 for(let i=0;i<8;i++)if(Math.abs(new Vector3().fromBufferAttribute(b,i).length()-Math.hypot(CAPTIVE_BORE_RADIUS,-.875))>bound||Math.abs(b.getZ(i)+.875)>bound||Math.abs(b.getZ(16+i)+.66)>bound)fail(stop,'Bore no longer matches original declared producer');
 let maximumSupportGap=0,minimumSupportGap=Infinity;
 for(let i=0;i<8;i++){
  const a=inner[i]!,c=inner[(i+1)%8]!,normal=new Vector3(c.y-a.y,a.x-c.x,0).normalize();if(normal.dot(a)<0)normal.negate();
  const plane=a.dot(normal),support=Math.max(...Array.from({length:8},(_,j)=>p.getX(j)*normal.x+p.getY(j)*normal.y));
  if(Math.abs(plane-radius)>bound||support>plane+bound)fail(stop,'Pin crosses actual journal flat beyond storage evidence');
  const gap=plane-support;maximumSupportGap=Math.max(maximumSupportGap,gap);minimumSupportGap=Math.min(minimumSupportGap,gap);
  // Per-FLAT support gap of the selected inscribed pin, not maximum radial void
  // at a bore vertex. The latter is a different, explicitly unclaimed metric.
  if(gap>radius*(1-Math.cos(Math.PI/8))+2*bound)fail(stop,'Gap exceeds the APPROVED nominal facet envelope');
 }
 if(angle===0||angle===-Math.PI/2)if(maximumSupportGap>2*bound)fail(stop,'No zero-clearance closed/open line contacts');
 return Object.freeze({idealRadius:radius,boreCircumradius:CAPTIVE_BORE_RADIUS,pinFaceting:radius*(1-Math.cos(Math.PI/8)),boreFaceting:CAPTIVE_BORE_RADIUS-radius,axial:Object.freeze([-.875,-.675]as const),maximumSupportGap,minimumSupportGap,storageBound:bound,brakeLever:JOURNAL_SHOE_LEVER});
}
/** Finite J1/J2/J7 face pairs. Material yield remains unmodelled, as for the
 * existing OpenAngleGuide; bounded friction sites are separately charged. */
export class CaptiveFrameGuide {
 private constructor(readonly stop:number,readonly first:number,readonly last:number,readonly capacity:number,readonly pitch:number){certificates.add(this);Object.freeze(this);}
 static certified(value:unknown,stop:number):value is CaptiveFrameGuide{return value instanceof CaptiveFrameGuide&&certificates.has(value)&&value.stop===stop;}
 static enrol(station:VillageStation,profile:VillageProfile,first:number,last:number):CaptiveFrameGuide {
  const m=station.mechanism,s=station.retention;
  if(!s||s.opening!=='captive-leaf'||station.initialCargo||!['terracotta','plank','timber'].includes(profile)||!['release','translating','suspended'].includes(m.kind)||!('travel'in m)||typeof m.travel==='number'||m.travel[2]!==0||!('deckPitch'in m)||!m.deckPitch||!(last>first))return fail(station.stop,'Unsupported opt-in direction/profile/translation');
  const parts=retainerParts(profile,'keyed-prismatic'),guide=openGuideGeometry(first,last),corner=captiveSlotCornerGeometry(first,last);
  const get=(id:string)=>{const p=parts.find(p=>p.id===id);if(!p)return fail(station.stop,'Missing body identity');return p.geometry;};
  const bound=8*2**-24*Math.max(1,Math.abs(first),Math.abs(last)),slider=get('slider'),leaf=get('leaf-shoe');
  try{
   if(!(WEDGE_K>0&&CAPTIVE_SLOT.underBack>CAPTIVE_CONTACT_RADIUS))fail(station.stop,'Wedge cannot supply the selected positive-z generator');
   for(const x of[first,(first+last)/2,last]){
    const sf=faces(slider,new Matrix4().makeTranslation(x,0,0)),rf=faces(get('leaf-guide'),new Matrix4().makeTranslation(x,0,0));
    for(const dx of[-.03,.03])for(const z of[-.915,-.885]){
     pair(station.stop,sf,faces(guide),new Vector3(x+dx,CAPTIVE_SLOT.floor,z),new Vector3(0,-1,0),bound);
     pair(station.stop,sf,faces(corner),new Vector3(x+dx,captiveTop(z),z),new Vector3(0,SLOT_C,-SLOT_S),bound);
     pair(station.stop,rf,faces(corner),new Vector3(x+dx,captiveTop(z),CAPTIVE_SLOT.back),new Vector3(0,0,1),bound);
    }
   }
   const atEnd=faces(slider,new Matrix4().makeTranslation(last,0,0));
   for(const y of[-.025,.025])for(const z of[-.915,-.885])pair(station.stop,atEnd,faces(corner),new Vector3(last+.035,y,z),new Vector3(1,0,0),bound);
   for(const lift of[0,.6]){
    const shoe=faces(leaf,new Matrix4().makeTranslation(0,lift,0)),fixed=faces(get('leaf-guide'));
    for(const dy of[-.015,0,.015]){
     for(const z of[-.9665,-.9335])for(const sign of[-1,1])pair(station.stop,shoe,fixed,new Vector3(sign*.02,lift+dy,z),new Vector3(sign,0,0),bound);
     for(const x of[-.015,0,.015])for(const sign of[-1,1])pair(station.stop,shoe,fixed,new Vector3(x,lift+dy,-.95+sign*.02),new Vector3(0,0,sign),bound);
    }
   }
   for(const angle of[0,-Math.PI/8,-Math.PI/4,-3*Math.PI/8,-Math.PI/2])certifyCaptiveJournal(station.stop,get('key-pin'),get('journal'),angle);
   return new CaptiveFrameGuide(station.stop,first,last,s.brakeForce,m.deckPitch);
  }finally{parts.forEach(p=>p.geometry.dispose());guide.dispose();corner.dispose();}
 }
 witness(inventory:RetainedInventory,k:CaptiveKinematics):CaptiveFrameWitness {
  if(inventory.layout!=='keyed-prismatic'||!CaptiveFrameGuide.certified(this,this.stop)||k.acceleration[2]!==0)return fail(this.stop,'Uncertified body/zero axis');
  if(![k.forkX,k.lift,...k.acceleration,k.angularSpeed,k.angularAcceleration,k.forkAngle,k.liftAcceleration,k.lineForce,k.leafBrake,...Object.values(k.contact).filter((v):v is number=>typeof v==='number')].every(Number.isFinite)||k.forkX<this.first||k.forkX>this.last||k.lift<0||k.lift>.6)fail(this.stop,'Nonfinite/out-of-range compiled captive state');
  const gravity=new Vector3(-9.81*Math.sin(this.pitch),-9.81*Math.cos(this.pitch),0),a=vec(k.acceleration),effective=gravity.clone().sub(a),origin=new Vector3(0,k.lift,-.95),frameOrigin=new Vector3(0,0,0);
  const bodyLoad=(mass:number,centre:Vector3,extraForce:Vector3,extraPoint:Vector3,about:Vector3,acc=effective)=>{const force=acc.clone().multiplyScalar(mass).add(extraForce),moment=centre.clone().sub(about).cross(acc.clone().multiplyScalar(mass)).add(extraPoint.clone().sub(about).cross(extraForce));return{force,moment};};
  const contact=k.contact,sin=k.phase==='opening'?k.lift/.3:0;if(sin<0||sin>=1&&contact.leadingReaction!==0)fail(this.stop,'Unsupported release contact sector');
  const lead=new Vector3(contact.leadingReaction*Math.sqrt(Math.max(0,1-sin*sin)),contact.leadingReaction*sin,0),leafAcceleration=effective.clone().add(new Vector3(0,-k.liftAcceleration,0));
  const leaf=bodyLoad(inventory.head.mass,vec(inventory.head.centre).add(new Vector3(0,k.lift,0)),lead,new Vector3(-.04,k.lift,0),origin,leafAcceleration);
  const linePoint=new Vector3(-.02,k.lift,-.95),line=new Vector3(0,k.lineForce,0);leaf.force.add(line);leaf.moment.add(linePoint.clone().sub(origin).cross(line));
  const neededBrake=leaf.force.y,brake=k.phase==='opening'?k.leafBrake:neededBrake;
  assertContact(this.stop,'captive-leaf-hold','hold-bound',Math.abs(brake),this.capacity);
  const leafReaction=leafReactions(leaf.force.clone().negate(),leaf.moment.clone().negate(),k.lift,brake,this.stop);
  const c=vec(inventory.fork.centre).applyMatrix4(new Matrix4().makeRotationZ(k.forkAngle)),rotA=new Vector3(-k.angularAcceleration*c.y-k.angularSpeed**2*c.x,k.angularAcceleration*c.x-k.angularSpeed**2*c.y,0);
  const barForce=new Vector3(-contact.trailingReaction,0,0),forkExternal=effective.clone().sub(rotA).multiplyScalar(inventory.fork.mass).add(barForce);
  const tensor=inventory.forkAxleTensor,cs=Math.cos(k.forkAngle),sn=Math.sin(k.forkAngle),ixz=cs*tensor[2]-sn*tensor[5],iyz=sn*tensor[2]+cs*tensor[5];
  const angularMomentumRate=new Vector3(k.angularAcceleration*ixz-k.angularSpeed**2*iyz,k.angularAcceleration*iyz+k.angularSpeed**2*ixz,k.angularAcceleration*inventory.fork.axleInertia);
  const forkMoment=c.clone().cross(effective.clone().multiplyScalar(inventory.fork.mass)).add(new Vector3(-.64,0,0).cross(barForce)).sub(angularMomentumRate);
  const followerForce=new Vector3(0,-(k.openGuide?.normal??0),0),followerPoint=new Vector3(k.openGuide?.lever??0,-.075,-.86);
  const jointForce=forkExternal.clone().add(followerForce).negate(),jointMoment=forkMoment.clone().add(followerPoint.clone().cross(followerForce)).negate();
  if(k.phase==='capture'&&Math.abs(jointMoment.z)>128*Number.EPSILON*Math.max(1,Math.abs(forkMoment.z)))fail(this.stop,'Open follower did not supply the current finite closure hold');
  if(k.phase!=='capture'&&k.phase!=='closure')assertContact(this.stop,'captive-fork-hold','hold-bound',Math.abs(jointMoment.z),this.capacity*JOURNAL_SHOE_LEVER);
  const forkRows=journalRows(jointForce,jointMoment,this.stop);
  const frame=bodyLoad(inventory.frame.mass,vec(inventory.frame.centre),jointForce.clone().negate(),new Vector3(0,0,0),frameOrigin);frame.moment.sub(jointMoment);
  // Every leaf/guide/brake/ideal-drive reaction has an explicit equal opposite
  // frame wrench. Source train routing and application point are a declared
  // existing-drive assumption to be independently certified before acceptance.
  for(const reaction of leafReaction){const force=vec(reaction.force).negate();frame.force.add(force);frame.moment.add(vec(reaction.point).sub(frameOrigin).cross(force)).sub(vec(reaction.torque));}
  frame.force.sub(line);frame.moment.sub(linePoint.clone().sub(frameOrigin).cross(line));
  if(frame.force.z!==0||leaf.force.z!==0)fail(this.stop,'Fz load term is not exactly zero');
  const fr=frameReactions(frame.force.clone().negate(),frame.moment.clone().negate(),this.stop,this.capacity,k.phase,k.contact.brake);
  return Object.freeze({phase:k.phase,leaf:Object.freeze({force:freeze(leaf.force),moment:freeze(leaf.moment)}),frame:Object.freeze({force:freeze(frame.force),moment:freeze(frame.moment)}),leafReactions:Object.freeze(leafReaction),frameReactions:Object.freeze(fr.reactions),preOpeningHold:k.phase==='opening'?0:Math.abs(neededBrake),frameBrakeUse:fr.brakeUse,leafBrakeUse:Math.abs(brake),forkJointForce:freeze(jointForce),forkJointMoment:freeze(jointMoment),forkJointTorque:jointMoment.z,forkReactions:Object.freeze(forkRows),zeroAxis:0});
 }
}
function reaction(joint:CaptiveReaction['joint'],point:Vector3,force:Vector3):CaptiveReaction{return Object.freeze({joint,point:freeze(point),force:freeze(force),torque:Object.freeze([0,0,0]as const),magnitude:force.length()});}
function balanced(stop:number,rows:readonly CaptiveReaction[],force:Vector3,moment:Vector3,origin:Vector3){const f=new Vector3(),m=new Vector3();let scale=1;for(const r of rows){const q=vec(r.force);f.add(q);m.add(vec(r.point).sub(origin).cross(q)).add(vec(r.torque));scale+=q.length()+vec(r.point).sub(origin).length()*q.length();}const bound=128*Number.EPSILON*scale;if(f.distanceTo(force)>bound||m.distanceTo(moment)>bound)fail(stop,'Independent guide wrench sum failed arithmetic bound');}
function leafReactions(force:Vector3,moment:Vector3,lift:number,brake:number,stop:number){const rows:CaptiveReaction[]=[],origin=new Vector3(0,lift,-.95);const pushX=(fx:number,y:number)=>{for(const z of[-.9665,-.9335])rows.push(reaction('J7',new Vector3(fx>=0?-.02:.02,y,z),new Vector3(fx/2,0,0)));};const pushZ=(fz:number,x:number,y:number)=>rows.push(reaction('J7',new Vector3(x,y,-.95+(fz>=0?-.02:.02)),new Vector3(0,0,fz)));
 const brakeReaction=reaction('J8',new Vector3(-.02,lift,-.95),new Vector3(0,-brake,0));rows.push(brakeReaction);const remaining=moment.clone().sub(vec(brakeReaction.point).sub(origin).cross(vec(brakeReaction.force)));
 pushX(force.x,lift);pushZ(force.z,0,lift);pushZ(remaining.x/.03,0,lift+.015);pushZ(-remaining.x/.03,0,lift-.015);pushZ(-remaining.y/.03,.015,lift);pushZ(remaining.y/.03,-.015,lift);pushX(-remaining.z/.03,lift+.015);pushX(remaining.z/.03,lift-.015);
 balanced(stop,rows,force,moment,origin);return rows;
}
function frameReactions(force:Vector3,moment:Vector3,stop:number,capacity:number,phase:CaptiveKinematics['phase'],captureBrake:number){
 if(force.z!==0)fail(stop,'Frame has no enrolled Fz load');
 const point=new Vector3(0,CAPTIVE_SLOT.floor,-.9);let axial=force.x,site:'J2'|'J3'='J3';
 if(phase==='capture'){
  if(Math.abs(force.x+captureBrake)>128*Number.EPSILON*Math.max(1,Math.abs(captureBrake)))fail(stop,'Actual capture brake resultant failed arithmetic bound');
  axial=-captureBrake;
  // B/T/R have exactly zero x authority. Only roundoff in the independently
  // reconstructed axial balance is admitted, never an arbitrary physical load.
 }else if(axial<0){site='J2';point.set(.035,0,-.9);}
 const brakeUse=site==='J3'?Math.abs(axial):0;assertContact(stop,'captive-frame-slot','hold-bound',brakeUse,capacity);
 const E:SlotWrench={force:[axial,force.y,force.z],moment:freeze(moment)},rows=slotReactions(E,axial,site,freeze(point)).map(r=>reaction(r.face,new Vector3(...r.point),new Vector3(...r.force)));
 balanced(stop,rows,force,moment,new Vector3());return{reactions:rows,brakeUse};
}
/** J4 bilateral radial rows at the ACTUAL two axial support stations; J5 alone
 * carries z torque. No closed journal gap is used as an impulse allowance. */
function journalRows(force:Vector3,moment:Vector3,stop:number):CaptiveReaction[]{
 if(force.z!==0)fail(stop,'Journal axial force unsupported');const z0=-.875,z1=-.675,span=z1-z0,rows:CaptiveReaction[]=[];
 const components=[[z0,(z1*force.x-moment.y)/span,(z1*force.y+moment.x)/span],[z1,(moment.y-z0*force.x)/span,(-moment.x-z0*force.y)/span]];
 for(const[z,x,y]of components){if(x===0&&y===0)continue;const angle=Math.atan2(y!,x!),step=Math.PI/4,k=Math.floor((angle-Math.PI/8)/step),a=Math.PI/8+k*step,b=a+step,det=Math.sin(b-a),A=(x!*Math.sin(b)-y!*Math.cos(b))/det,B=(y!*Math.cos(a)-x!*Math.sin(a))/det;
  for(const[t,m]of[[a,A],[b,B]]){if(m!<0)fail(stop,'Journal radial normal magnitude negative');rows.push(reaction('J4',new Vector3(CAPTIVE_CONTACT_RADIUS*Math.cos(t!),CAPTIVE_CONTACT_RADIUS*Math.sin(t!),z!),new Vector3(m!*Math.cos(t!),m!*Math.sin(t!),0)));}}
 rows.push(Object.freeze({joint:'J5',point:Object.freeze([0,0,-.775]as const),force:Object.freeze([0,0,0]as const),torque:Object.freeze([0,0,moment.z]as const),magnitude:Math.abs(moment.z)}));balanced(stop,rows,force,moment,new Vector3());return rows;
}

export interface CaptiveImpactWitness {
 readonly firstMomentZ:number;readonly vAfter:number;readonly leadingImpulse:number;
 readonly requiredGuideAngularImpulseY:number;readonly availableGuideAngularImpulseY:0;
 readonly finiteBrakeImpulse:0;readonly sourceImpulse:0;readonly endCheekSeparated:boolean;
}
/** SOURCE-READ OBSTRUCTION, UNRUN. The actual scalar capture solver has no
 * angular impulse about y. A zero net Fz does not eliminate a required My couple.
 * J1/J6 normals are y; J2 is separated at impact; J3/J8 are finite-force brakes.
 * Internal pin/leaf contacts cannot supply an external assembly impulse. */
export function oldFlatImpactWitness(inventory:RetainedInventory,vAfter:number,headImpulse:number,first:number,last:number):CaptiveImpactWitness {
 if(inventory.layout!=='keyed-prismatic'||!Number.isFinite(vAfter)||!Number.isFinite(headImpulse))throw new Error('Actual captive capture/inventory required');
 const firstMomentZ=[inventory.frame,inventory.head,inventory.fork].reduce((sum,b)=>sum+b.mass*b.centre[2],0);
 return Object.freeze({firstMomentZ,vAfter,leadingImpulse:headImpulse,requiredGuideAngularImpulseY:firstMomentZ*vAfter,availableGuideAngularImpulseY:0,finiteBrakeImpulse:0,sourceImpulse:0,endCheekSeparated:last>first});
}
export function assertOldFlatCaptiveImpact(stop:number,w:CaptiveImpactWitness):void {
 if(!w.endCheekSeparated||w.requiredGuideAngularImpulseY!==0)throw new VillageAdmissibilityError(stop,'captive-frame-impact','unsupported-contact-geometry',Math.abs(w.requiredGuideAngularImpulseY),0,'No declared carrier face pair supports the capture My impulse; finite brake/source cannot be promoted to an impulsive constraint');
}

export interface CaptiveImpactCertificate {
 readonly frameExternal:SlotWrench;readonly slotRows:readonly SlotRow[];readonly j7OnLeaf:CaptiveWrench;readonly j4OnFork:CaptiveWrench;readonly j6OnFork:CaptiveWrench;
 readonly j7Rows:readonly CaptiveReaction[];readonly j4Rows:readonly CaptiveReaction[];readonly carrierCouple:VillageVec3;readonly carrierCoupleWorld:VillageVec3;readonly carrierGuideRows:readonly CaptiveReaction[];readonly firstMomentZ:number;
 readonly zeroImpulse:Readonly<{J2:0;J3:0;J5:0;J8:0;source:0;floorNormal:0;floorTangent:0}>;
}
export function captiveImpactCertificate(stop:number,inventory:RetainedInventory,impact:{vAfter:number;headImpulse:number;translatingMass:number},openGuide:OpenGuideLoad,carriage:CarriageBrake,carrierFrame:Matrix4):CaptiveImpactCertificate {
 if(inventory.layout!=='keyed-prismatic'||!CarriageBrake.certified(carriage,stop)||openGuide.lever===0||!(openGuide.normal>=0))return fail(stop,'Missing impact body/open guide/carriage certificate');
 const v=impact.vAfter,cf=new Vector3(inventory.fork.centre[1],-inventory.fork.centre[0],inventory.fork.centre[2]),head=inventory.head.mass+inventory.frame.mass;
 if(head+inventory.fork.mass!==inventory.translatingMass||inventory.translatingMass!==impact.translatingMass||inventory.translatingMass*v-impact.headImpulse!==0)fail(stop,'Inexact capture literal split');
 const dL=(m:number,c:Vector3)=>new Vector3(0,m*v*c.z,-m*v*c.y),j6Force=new Vector3(0,-openGuide.normal,0),j6Moment=new Vector3(openGuide.lever,-.075,-.86).cross(j6Force);
 const j4Force=new Vector3(inventory.fork.mass*v,openGuide.normal,0),j4Moment=dL(inventory.fork.mass,cf).sub(j6Moment);
 if(Math.abs(j4Moment.z)>4*Number.EPSILON*Math.max(1,Math.abs(inventory.fork.mass*v*cf.y)))fail(stop,'Open guide left an unsupported revolute impulse');
 const j7Force=new Vector3(inventory.head.mass*v-impact.headImpulse,0,0),j7Moment=dL(inventory.head.mass,vec(inventory.head.centre)),frameMoment=dL(inventory.frame.mass,vec(inventory.frame.centre)).add(j7Moment).add(j4Moment),E:SlotWrench={force:[0,openGuide.normal,0],moment:freeze(frameMoment)};
 const slot=slotReactions(E,0,'J3',[0,CAPTIVE_SLOT.floor,-.9]),j7Origin=new Vector3(0,0,-.95),j7Rows=leafReactions(j7Force,j7Moment.clone().sub(j7Origin.clone().cross(j7Force)),0,0,stop),j4Rows=journalRows(j4Force,new Vector3(j4Moment.x,j4Moment.y,0),stop);
 const firstMomentZ=inventory.frame.mass*inventory.frame.centre[2]+inventory.head.mass*inventory.head.centre[2]+inventory.fork.mass*cf.z,carrierCouple=frameMoment.clone().add(j6Moment).negate();
 const carrierCoupleWorld=carrierCouple.clone().applyMatrix3(new Matrix3().setFromMatrix4(carrierFrame)),carrierGuideRows=carriageCoupleRows(carriage,carrierCoupleWorld,stop);
 return Object.freeze({frameExternal:E,slotRows:slot,j7OnLeaf:{force:freeze(j7Force),moment:freeze(j7Moment)},j4OnFork:{force:freeze(j4Force),moment:freeze(j4Moment)},j6OnFork:{force:freeze(j6Force),moment:freeze(j6Moment)},j7Rows:Object.freeze(j7Rows),j4Rows:Object.freeze(j4Rows),carrierCouple:freeze(carrierCouple),carrierCoupleWorld:freeze(carrierCoupleWorld),carrierGuideRows:Object.freeze(carrierGuideRows),firstMomentZ,zeroImpulse:Object.freeze({J2:0,J3:0,J5:0,J8:0,source:0,floorNormal:0,floorTangent:0})});
}
function carriageCoupleRows(guide:CarriageBrake,coupleLocal:Vector3,stop:number):CaptiveReaction[]{
 // The caller supplies the couple transformed by the ACTUAL Program carrier
 // frame. Guide directions, points and this reconstruction live in WORLD space.
 const t=vec(guide.tangent),n=vec(guide.normal),b=vec(guide.across),origin=vec(guide.origin),rows:CaptiveReaction[]=[],moment=coupleLocal.clone();
 const l=guide.halfLength,d=guide.halfAcross*.5;if(!(l>0&&d>0))fail(stop,'Carriage couple has no finite lever');
 const add=(normal:Vector3,amount:number,offset:Vector3,extent:number)=>{const point=origin.clone().add(offset).addScaledVector(normal,Math.sign(amount)*extent);rows.push(reaction('J1',point,normal.clone().multiplyScalar(amount)));};
 const mt=moment.dot(t),mn=moment.dot(n),mb=moment.dot(b);
 add(n,-mt/(2*d),b.clone().multiplyScalar(d),guide.halfNormal);add(n,mt/(2*d),b.clone().multiplyScalar(-d),guide.halfNormal);
 add(b,-mn/(2*l),t.clone().multiplyScalar(l),guide.halfAcross);add(b,mn/(2*l),t.clone().multiplyScalar(-l),guide.halfAcross);
 add(n,mb/(2*l),t.clone().multiplyScalar(l),guide.halfNormal);add(n,-mb/(2*l),t.clone().multiplyScalar(-l),guide.halfNormal);
 balanced(stop,rows,new Vector3(),moment,origin);return rows;
}
export function assertCaptiveImpact(stop:number,c:CaptiveImpactCertificate,guide:CaptiveFrameGuide):void {
 if(!CaptiveFrameGuide.certified(guide,stop)||c.frameExternal.force[0]!==0||c.frameExternal.force[2]!==0||Object.values(c.zeroImpulse).some(v=>v!==0))fail(stop,'Unsupported capture impulse authority');
 const rows=c.slotRows.map(r=>reaction(r.face,new Vector3(...r.point),new Vector3(...r.force)));balanced(stop,rows,vec(c.frameExternal.force),vec(c.frameExternal.moment),new Vector3());
 if(c.slotRows.some(r=>r.face==='J2'||r.face==='J3'||r.magnitude<0))fail(stop,'Finite brake/end stop credited with an impulse');
}
