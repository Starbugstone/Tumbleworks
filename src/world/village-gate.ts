import {VillageAdmissibilityError,assertContact} from './village-contact';
import type {RetentionSpec} from './village-inventory';
export interface GateAllocation {readonly energy:number;readonly origin:'legacy-gate-seconds'}
/** The sole production reader; preserves the original Float64 evaluation order. */
export function legacyGateAllocation(spec:Pick<RetentionSpec,'gateMass'|'gateSeconds'>):GateAllocation{
 if(!(spec.gateMass>0&&spec.gateSeconds>0&&Number.isFinite(spec.gateSeconds)))throw new Error('Invalid legacy gate allocation');
 const velocity=1.5*.6/spec.gateSeconds;
 return Object.freeze({energy:spec.gateMass*9.81*.6+.5*spec.gateMass*velocity**2,origin:'legacy-gate-seconds'});
}
export type GateAxis=Readonly<
 {kind:'closure';mass:number;inertia:number;openCentre:readonly[number,number];capacity:number}|
 {kind:'lift';mass:number;normalGravity:number;marbleMass:number;tangentGravity:number;rollingFactor:number;capacity:number}>;
export interface GateState {q:number;qdot:number;qddot:number;governor:number;assist:number;lineTension:number}
export interface ReleaseState {distance:number;speed:number;acceleration:number;lift:number;headReaction:number;assist:number}
const scratch64=new DataView(new ArrayBuffer(8));
function nextUp(x:number):number{scratch64.setFloat64(0,x);scratch64.setBigUint64(0,scratch64.getBigUint64(0)+1n);return scratch64.getFloat64(0);}
export function releaseGeometry(seconds:number,T:number,axis:Extract<GateAxis,{kind:'lift'}>,target:ReleaseState):void{
 const u=Math.max(0,Math.min(1,seconds/T)),q=.6*u*u*(3-2*u),v=.6*6*u*(1-u)/T,a=.6*(6-12*u)/T**2;
 const s=Math.sqrt(.3**2-q*q);target.lift=q;
 target.distance=.3-s;target.speed=q*v/s;target.acceleration=q*a/s+.3**2*v*v/s**3;
 const cosine=s/.3;target.headReaction=axis.marbleMass*(axis.tangentGravity-axis.rollingFactor*target.acceleration)/cosine;target.assist=target.headReaction*q/.3;
}
export interface GateEnvelope {readonly minimumGovernor:number;readonly maximumGovernor:number;readonly minimumLineTension:number}
export function assertGateEnvelope(stop:number,phase:string,envelope:GateEnvelope,capacity:number):void{
 if(envelope.minimumGovernor<0)throw new VillageAdmissibilityError(stop,phase,'drive-force',-envelope.minimumGovernor,0);
 if(envelope.maximumGovernor>capacity)throw new VillageAdmissibilityError(stop,phase,'governor-capacity',envelope.maximumGovernor,capacity);
 if(!(envelope.minimumLineTension>0))throw new VillageAdmissibilityError(stop,phase,'line-tension',Number.EPSILON,envelope.minimumLineTension);
}
export class VillageGate {
 readonly duration:number;readonly span:number;readonly binding:'source-onset'|'governor-capacity';readonly reflectedMass:number;
 readonly effectiveMass:number;readonly sourceEffort:number;readonly sourceRatio:number;readonly detachTime:number;
 readonly envelope:GateEnvelope;readonly ledger:Readonly<{source:number;potential:number;sphere:number;governor:number;residual:number;peakSourceKinetic:number}>;
 readonly roundingSteps:number;
 private readonly releaseScratch:ReleaseState={distance:0,speed:0,acceleration:0,lift:0,headReaction:0,assist:0};
 constructor(readonly stop:number,readonly phase:'closure'|'release-drive',readonly allocation:GateAllocation,readonly axis:GateAxis,readonly weightMass:number){
  this.axis=axis.kind==='closure'?Object.freeze({...axis,openCentre:Object.freeze([...axis.openCentre]as[number,number])}):Object.freeze({...axis});
  this.allocation=Object.freeze({...allocation});
  if(axis.kind==='lift'&&!(axis.mass>0&&axis.normalGravity>0&&axis.marbleMass>0&&axis.tangentGravity>0&&axis.rollingFactor>=1))throw new VillageAdmissibilityError(stop,phase,'unsupported-contact-geometry',1,0);
  this.span=axis.kind==='lift'?.6:Math.PI/2;this.sourceEffort=allocation.energy/this.span;this.sourceRatio=allocation.energy/(this.span*weightMass*9.81);
  this.reflectedMass=weightMass*this.sourceRatio**2;this.effectiveMass=(axis.kind==='lift'?axis.mass:axis.inertia)+this.reflectedMass;
  if(!(weightMass>0&&allocation.energy>0&&axis.capacity>0&&this.effectiveMass>0))throw new VillageAdmissibilityError(stop,phase,'unsupported-contact-geometry',1,0);
  if(axis.kind==='closure'){
   if(!(axis.mass>0&&axis.inertia>axis.mass*(axis.openCentre[0]**2+axis.openCentre[1]**2)))throw new VillageAdmissibilityError(stop,phase,'unsupported-contact-geometry',1,0,'Closure needs positive central inertia, expressed about the actual axle');
   const angle=Math.atan2(axis.openCentre[1],axis.openCentre[0]);
   if(!(angle>0&&angle+this.span<Math.PI))throw new VillageAdmissibilityError(stop,phase,'unsupported-contact-geometry',angle+this.span,Math.PI,'Closure potential must decrease over the entire arc');
  }
  const u0=this.potentialSlope(0),u1=this.potentialSlope(this.span),onset=this.sourceEffort-u0,capacity=axis.capacity-this.sourceEffort+u1;
  if(!(onset>0))throw new VillageAdmissibilityError(stop,phase,'drive-force',u0,this.sourceEffort);
  if(!(capacity>0))throw new VillageAdmissibilityError(stop,phase,'governor-capacity',this.sourceEffort-u1,axis.capacity);
  const a=Math.sqrt(6*this.span*this.effectiveMass/onset),b=Math.sqrt(6*this.span*this.effectiveMass/capacity);
  this.binding=a>=b?'source-onset':'governor-capacity';let duration=Math.max(a,b),rounding=0;
  const endpointPass=()=>this.sourceEffort-this.effectiveMass*(this.span*6/duration**2)-u0>=0&&this.sourceEffort+this.effectiveMass*(this.span*6/duration**2)-u1<=axis.capacity;
  while(!endpointPass()&&rounding<8){duration=nextUp(duration);rounding++;}
  if(!endpointPass())throw new VillageAdmissibilityError(stop,phase,'drive-force',1,0,'Endpoint rounding exceeded eight ulps');
  this.duration=duration;this.roundingSteps=rounding;
  // Closure U''<0 proves monotone governor. Lift's nonnegative assistance
  // proves ONLY its lower bound. Its separate global upper bound covers every
  // contact point in the first facet; it is not an endpoint monotonicity claim.
  const assistanceBound=axis.kind==='lift'?axis.marbleMass*axis.tangentGravity*Math.tan(Math.PI/16):0;
  this.envelope=Object.freeze({minimumGovernor:this.sourceEffort-this.effectiveMass*(this.span*6/duration**2)-u0,
   maximumGovernor:this.sourceEffort+this.effectiveMass*(this.span*6/duration**2)-u1+assistanceBound,
   minimumLineTension:weightMass*(9.81-this.sourceRatio*6*this.span/duration**2)});
  assertGateEnvelope(stop,phase,this.envelope,axis.capacity);
  let sphere=0;this.detachTime=0;
  if(axis.kind==='lift'){
   // On u<=.2, x''' >= (L²/T³)*u*(108-360u+240u²)/sqrt(R²-L²)>0.
   // Hence release acceleration increases and the first zero of B is unique.
   let lo=0,hi=.2;for(let i=0;i<60;i++){const u=(lo+hi)/2;if(.6*u*u*(3-2*u)<.3*Math.sin(Math.PI/16))lo=u;else hi=u;}
   const sectorEnd=lo*duration;releaseGeometry(sectorEnd,duration,axis,this.releaseScratch);
   if(!(this.releaseScratch.acceleration>axis.tangentGravity/axis.rollingFactor))throw new VillageAdmissibilityError(stop,phase,'unsupported-contact-geometry',1,0,'Release cannot detach inside the first actual vertex sector');
   lo=0;hi=sectorEnd;for(let i=0;i<60;i++){const t=(lo+hi)/2;releaseGeometry(t,duration,axis,this.releaseScratch);if(this.releaseScratch.acceleration<axis.tangentGravity/axis.rollingFactor)lo=t;else hi=t;}
   this.detachTime=(lo+hi)/2;releaseGeometry(this.detachTime,duration,axis,this.releaseScratch);
   sphere=axis.marbleMass*axis.tangentGravity*this.releaseScratch.distance-.5*axis.marbleMass*axis.rollingFactor*this.releaseScratch.speed**2;
  }
  const potential=axis.kind==='lift'?axis.mass*axis.normalGravity*this.span:axis.mass*9.81*(axis.openCentre[0]*Math.sin(this.span)+axis.openCentre[1]*(Math.cos(this.span)-1));
  const governor=allocation.energy+sphere-potential,residual=allocation.energy+sphere-potential-governor;
  assertContact(stop,phase,'energy-balance',-governor,0);
  this.ledger=Object.freeze({source:allocation.energy,potential,sphere,governor,residual,peakSourceKinetic:.5*weightMass*(this.sourceRatio*1.5*this.span/duration)**2});
 }
 private potentialSlope(q:number):number{return this.axis.kind==='lift'?this.axis.mass*this.axis.normalGravity:this.axis.mass*9.81*(this.axis.openCentre[0]*Math.cos(q)-this.axis.openCentre[1]*Math.sin(q));}
 sample(seconds:number,target:GateState):void{
  const u=Math.max(0,Math.min(1,seconds/this.duration));target.q=this.span*u*u*(3-2*u);target.qdot=this.span*6*u*(1-u)/this.duration;target.qddot=this.span*(6-12*u)/this.duration**2;
  target.assist=0;if(this.axis.kind==='lift'&&seconds>=0&&seconds<this.detachTime){releaseGeometry(seconds,this.duration,this.axis,this.releaseScratch);target.assist=this.releaseScratch.assist;}
  target.governor=this.sourceEffort-this.effectiveMass*target.qddot-this.potentialSlope(target.q)+target.assist;
  target.lineTension=this.weightMass*(9.81-this.sourceRatio*target.qddot);
 }
}
