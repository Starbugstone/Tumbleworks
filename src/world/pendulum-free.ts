// UNUSED / UNRUN. One monotone free hammer arc, actual feature events, finite deck.
import{freeMarbleBounds,rootCoordinateError,radius as intervalRadius,featureBox,geometryBoxes,approachBounds,box,point,sub,coverApproach,contactXRange,rollingExitAngleBounds}from'./pendulum-uncertainty';
import{VillageAdmissibilityError,VILLAGE_CONTACT}from'./village-contact';
import{PendulumCore,GL4,GL8,gauss,STRIKE_SPHERE}from'./pendulum-core';
import{cellAt,profileDerivativeRange,range,type Range}from'./pendulum-cells';
import{blankBarContact,type FeaturePartition,type FeatureCell,type StrikeState,type StrikeError,type MarbleFree,type FreeResult,type FreeReport,type NumericalPolicy,type ForwardBudget,type SeparationStart,type EventBracket,type MarbleExit}from'./pendulum-types';
export interface MarbleSample {x:number;v:number;w:number;angle:number;loss:number;floor:'roll'|'slip';friction:number}
/** Closed slip → roll, with angle preserved. No authored velocity or time map. */
export function sampleMarble(start:MarbleFree,time:number,target:MarbleSample):void{
 const dt=time-start.time;if(dt<0)throw new Error('Free marble sampled before its knot');
 const relative=start.v-start.w,k=STRIKE_SPHERE.kappa,m=STRIKE_SPHERE.mass,R=STRIKE_SPHERE.radius;
 const a=start.floor==='roll'?0:-VILLAGE_CONTACT.mu*9.81*Math.sign(relative),duration=a===0?0:-relative/(a*(1+1/k)),t=Math.min(dt,duration),v=start.v+a*t;
 target.x=start.x+start.v*t+.5*a*t*t+v*(dt-t);target.v=v;target.w=dt<duration?start.w-a*t/k:v;
 target.angle=start.angle+(start.w*t-.5*a*t*t/k+v*(dt-t))/R;
 target.loss=-m*a*(relative*t+.5*a*(1+1/k)*t*t);target.floor=dt<duration?'slip':'roll';target.friction=dt<duration?m*a:0;
}
function deckExit(core:PendulumCore,start:MarbleFree,x:number,error:StrikeError):MarbleExit{
 const sample:MarbleSample={x:0,v:0,w:0,angle:0,loss:0,floor:'slip',friction:0},relative=start.v-start.w,k=STRIKE_SPHERE.kappa,a=start.floor==='roll'?0:-VILLAGE_CONTACT.mu*9.81*Math.sign(relative),duration=a===0?0:-relative/(a*(1+1/k));
 sampleMarble(start,start.time+duration,sample);
 if(sample.x>x){
  const distance=x-start.x,squared=start.v*start.v+2*a*distance;if(!(distance>=0&&squared>0))throw new VillageAdmissibilityError(core.stop,'striker-stall','drive-force',0,squared);
  const dt=2*distance/(start.v+Math.sqrt(squared));sampleMarble(start,start.time+dt,sample);
  // This is a provisional finite-deck boundary. Search for an earlier real
  // re-impact before rejecting an otherwise unsupported slipping exit.
  return{time:start.time+dt,x:sample.x,v:sample.v,w:sample.w,angle:sample.angle,floor:sample.floor,error};
 }

 if(!(sample.v>0))throw new VillageAdmissibilityError(core.stop,'striker-stall','drive-force',0,sample.v);
 const time=start.time+duration+(x-sample.x)/sample.v;sampleMarble(start,time,sample);
 return{time,x:sample.x,v:sample.v,w:sample.w,angle:sample.angle,floor:'roll',error};
}
/** Quintic Hermite from (q,u,a) at BOTH ends. Coefficients are in normalized
 * time. Caller-owned targets and scalar helpers allocate nothing at runtime. */
export function quinticCoefficients(q0:number,q1:number,u0:number,u1:number,a0:number,a1:number,h:number):readonly[number,number,number,number,number,number]{
 const c0=q0,c1=h*u0,c2=h*h*a0/2,A=q1-c0-c1-c2,B=h*u1-c1-2*c2,C=h*h*a1-2*c2;
 return[c0,c1,c2,10*A-4*B+C/2,-15*A+7*B-C,6*A-3*B+C/2];
}
export function quinticValue(q0:number,q1:number,u0:number,u1:number,a0:number,a1:number,t0:number,t1:number,time:number,derivative=false):number{
 const h=t1-t0,z=(time-t0)/h,c0=q0,c1=h*u0,c2=h*h*a0/2,A=q1-c0-c1-c2,B=h*u1-c1-2*c2,C=h*h*a1-2*c2,c3=10*A-4*B+C/2,c4=-15*A+7*B-C,c5=6*A-3*B+C/2;
 return derivative?(c1+z*(2*c2+z*(3*c3+z*(4*c4+z*5*c5))))/h:c0+z*(c1+z*(c2+z*(c3+z*(c4+z*c5))));
}
interface Panel {readonly q0:number;readonly q1:number;readonly t0:number;readonly t1:number;readonly cell:FeatureCell|undefined;readonly reference:number}
/** Root location and runtime knots use this SAME canonical quadrature primitive.
 * A root never gets an independently timed, displaced marble endpoint. */
class FlightPrimitive {
 readonly panels:Panel[]=[];readonly referenceEstimate:number;readonly stop:number;readonly stalls:boolean;private readonly E:number;
 constructor(readonly core:PendulumCore,readonly start:StrikeState,readonly partition:FeaturePartition,step:number,readonly budget:ForwardBudget){
  const I=core.body.axleInertia,curvature=core.body.mass*9.81*(-core.body.centre[1]*Math.cos(core.drive.stopAngle)-Math.abs(core.body.centre[0]));if(!(curvature>0&&core.potentialSlope(start.q)+core.torque>0))throw new VillageAdmissibilityError(core.stop,'striker-free-potential','unsupported-contact-geometry',1,0,'The bounded free arc requires a monotonically decelerating forward sector');this.E=.5*I*start.u**2+core.potential(start.q);
  let end=core.drive.stopAngle;this.stalls=this.energy(end)<=0;
  if(this.stalls){let lo=start.q,hi=end;for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(mid===lo||mid===hi)break;if(this.energy(mid)>0)lo=mid;else hi=mid;}end=lo;}
  this.stop=end;let q=start.q,t=start.time,estimate=0;
  while(q<end){const cell=cellAt(partition,q),next=Math.min(end,q+step,cell?.q1??end);if(!(next>q))throw new VillageAdmissibilityError(core.stop,'striker-feature-indeterminate','unsupported-contact-geometry',1,0,'No free-panel coordinate advance');
   const dt=this.integral(q,next,false),ref=this.integral(q,next,true);this.panels.push({q0:q,q1:next,t0:t,t1:t+dt,cell,reference:Math.abs(dt-ref)});estimate+=Math.abs(dt-ref);q=next;t+=dt;
  }this.referenceEstimate=estimate;
 }
 energy(q:number):number{return this.E-this.core.potential(q)-this.core.torque*(q-this.start.q);}
 speed(q:number):number{const E=this.energy(q);if(!(E>0))throw new VillageAdmissibilityError(this.core.stop,'striker-stall-before-stop','drive-force',0,E);return Math.sqrt(2*E/this.core.body.axleInertia);}
 acceleration(q:number):number{return(-this.core.potentialSlope(q)-this.core.torque)/this.core.body.axleInertia;}
 integral(a:number,b:number,reference=false):number{this.budget.use(1,'free-quadrature');return gauss(reference?GL8:GL4,a,b,q=>1/this.speed(q));}
 estimate(q:number):number{let sum=0;for(const p of this.panels){if(p.q1<=q)sum+=p.reference;else if(p.q0<q){sum+=Math.abs(this.integral(p.q0,q)-this.integral(p.q0,q,true));break;}else break;}return sum;}
 time(q:number):number{if(q===this.start.q)return this.start.time;let lo=0,hi=this.panels.length-1;while(lo<hi){const mid=(lo+hi)>>>1;if(this.panels[mid]!.q1<q)lo=mid+1;else hi=mid;}const p=this.panels[lo]!;return q===p.q1?p.t1:p.t0+this.integral(p.q0,q);}
 qAt(time:number):number{
  if(time===this.start.time)return this.start.q;
  let i=0,j=this.panels.length-1;while(i<j){const k=(i+j)>>>1;if(this.panels[k]!.t1<time)i=k+1;else j=k;}const p=this.panels[i]!;
  if(time===p.t1)return p.q1;if(!(time>=p.t0&&time<=p.t1))throw new VillageAdmissibilityError(this.core.stop,'striker-free-inverse','unsupported-contact-geometry',1,0,'Time leaves the finite canonical quadrature primitive');
  let lo=p.q0,hi=p.q1,q=lo+(hi-lo)*(time-p.t0)/(p.t1-p.t0);
  for(let k=0;k<80;k++){const actual=this.time(q);if(actual===time)return q;if(actual<time)lo=q;else hi=q;const mid=(lo+hi)/2;if(mid===lo||mid===hi)return mid;const next=q+(time-actual)*this.speed(q);q=next>lo&&next<hi?next:mid;}
  throw new VillageAdmissibilityError(this.core.stop,'striker-free-inverse','unsupported-contact-geometry',1,0,'Canonical inverse failed to reach an adjacent-double bracket');
 }
}
const magnitude=(a:Range)=>Math.max(Math.abs(a[0]),Math.abs(a[1]));
/** Analytic conservative bound on q^(6) for q''=alpha(q), with the exact
 * pendulum trigonometric potential. No finite sample is called a theorem. */
function sixthBound(core:PendulumCore,a:number,b:number,uMax:number):number{
 const I=core.body.axleInertia,A=(Math.max(Math.abs(core.potentialSlope(a)),Math.abs(core.potentialSlope(b)))+core.torque)/I,B=core.body.mass*9.81*Math.hypot(core.body.centre[0],core.body.centre[1])/I;
 return B*uMax**4+6*B*uMax*uMax*A+3*B*A*A+5*B*B*uMax*uMax+B*B*A;
}
/** Factored grazing remainder over the ENTIRE first panel. For a root release
 * g(0)=g'(0)=g''(0)=0 follows from the bracketed contact law. For a feature jump
 * the right-limit g'' is positive. No subtractively rounded zero gap is divided. */
function separatingWindow(core:PendulumCore,primitive:FlightPrimitive,marble:MarbleFree,launch:SeparationStart,proofEnd?:number){
 const first=primitive.panels[0]!,end=proofEnd??first.q1,p={...first,q1:end,t1:primitive.time(end)};if(!p.cell)throw new VillageAdmissibilityError(core.stop,'striker-interpolation','unsupported-contact-geometry',1,0,'Initial separating feature absent');
 const derivatives=profileDerivativeRange(core.profile,p.cell.feature,p.q0,p.q1,3),u:Range=[primitive.speed(p.q1),primitive.speed(p.q0)],I=core.body.axleInertia;
 const alpha:Range=[primitive.acceleration(p.q1),primitive.acceleration(p.q0)],curvature=core.body.mass*9.81*Math.hypot(core.body.centre[0],core.body.centre[1]),alphaPrime:Range=[-curvature/I,-core.body.mass*9.81*(-core.body.centre[1]*Math.cos(p.q1)-Math.abs(core.body.centre[0]))/I];
 const pow=(x:Range,n:number)=>{let r:Range=[1,1];for(let i=0;i<n;i++)r=range.mul(r,x);return r;};
 const jerk=range.add(range.add(range.mul(derivatives[3]!,pow(u,3)),range.mul([3,3],range.mul(derivatives[2]!,range.mul(u,alpha)))),range.mul(derivatives[1]!,range.mul(alphaPrime,u)));
 const slide=marble.floor==='roll'?0:-VILLAGE_CONTACT.mu*9.81*Math.sign(marble.v-marble.w),second=range.add(range.add(range.mul(derivatives[2]!,pow(u,2)),range.mul(derivatives[1]!,alpha)),[-slide,-slide]);
 const h=p.t1-p.t0,M=sixthBound(core,p.q0,p.q1,u[1]),C1=magnitude(derivatives[1]!);
 const derivativeLower=launch.kind==='root'?jerk[0]:second[0],relative=launch.kind==='root'?C1*M*h**3/(120*derivativeLower):C1*M*h**4/(360*derivativeLower);
 if(!(derivativeLower>0&&relative<.5))throw new VillageAdmissibilityError(core.stop,'striker-interpolation','unsupported-contact-geometry',relative,.5,'One-sided analytic grazing remainder unresolved; halve panels, never waive a gap');
 return{kind:launch.kind==='root'?'cubic-gap' as const:'quadratic-gap' as const,derivativeLower,quinticRelativeRemainder:relative,roundingModel:'outward Float64 interval operations, explicit64eps libm model; not unconditional exact-real enclosure'};
}
function nativeFlight(core:PendulumCore,start:StrikeState,launch:SeparationStart,partition:FeaturePartition,exitX:number,step:number,_policy:NumericalPolicy,budget:ForwardBudget){
 const primitive=new FlightPrimitive(core,start,partition,step,budget),marble:MarbleFree={time:start.time,x:start.x,v:start.v,w:start.w,angle:start.angle,floor:start.floor},marbleExit=deckExit(core,marble,exitX,start.error),scratch:MarbleSample={x:0,v:0,w:0,angle:0,loss:0,floor:'slip',friction:0},contact=blankBarContact();
 const first=primitive.panels[0]!,I=core.body.axleInertia,relative=marble.v-marble.w,aSlip=marble.floor==='roll'?0:-VILLAGE_CONTACT.mu*9.81*Math.sign(relative),slipDuration=aSlip===0?Infinity:-relative/(aSlip*(1+1/STRIKE_SPHERE.kappa)),slipTime=marble.time+slipDuration;
 const slipQ=slipTime>start.time&&slipTime<primitive.panels.at(-1)!.t1?primitive.qAt(slipTime):undefined,proofEnd=slipQ!==undefined?Math.min(first.q1,slipQ):first.q1;
 const grazing=separatingWindow(core,primitive,marble,launch,proofEnd);
 const pointJerk=(time:number)=>{const q=primitive.qAt(time),cell=cellAt(partition,q)!,u=primitive.speed(q),alpha=primitive.acceleration(q),d=profileDerivativeRange(core.profile,cell.feature,q,q,3);return(d[3]![0]+d[3]![1])/2*u**3+3*(d[2]![0]+d[2]![1])/2*u*alpha+(d[1]![0]+d[1]![1])/2*(-core.potentialCurvature(q)/I)*u;};
 core.profile.sampleFeature(first.cell!.feature,start.q,contact,true);const acceleration=primitive.acceleration(start.q),aMarble=marble.floor==='roll'?0:-VILLAGE_CONTACT.mu*9.81*Math.sign(marble.v-marble.w),g2=contact.second*start.u**2+contact.first*acceleration-aMarble;
 // Stored launch is the left bracket state, with its real nonzero load. The
 // bracket owns the unresolved transition; the nominal free continuation is
 // only separated after this residual-derived event-time observation.
 const effective=marble.floor==='roll'?STRIKE_SPHERE.mass*(1+STRIKE_SPHERE.kappa):STRIKE_SPHERE.mass,fl=marble.floor==='roll'?0:VILLAGE_CONTACT.mu*Math.sign(marble.v-marble.w)*contact.ny,D=effective*contact.first*(-contact.J)/I-contact.nx-fl,g2Estimate=Math.abs(D)*launch.uncertainty/effective;
 const launchTimeEstimate=launch.bracket.time[1]-launch.bracket.time[0]+(launch.kind==='root'?3*(Math.abs(g2)+g2Estimate)/grazing.derivativeLower:0);
 if(!(launch.lambdaLeft>=0&&launch.lambdaRight<=0)||launchTimeEstimate>_policy.eventTimeEstimate||launchTimeEstimate>=primitive.time(proofEnd)-start.time)throw new VillageAdmissibilityError(core.stop,'striker-launch-indeterminate','unsupported-contact-geometry',launchTimeEstimate,_policy.eventTimeEstimate,'Separation bracket/residual does not resolve before the separating window');
 const launchReceipt={lambdaLeft:launch.lambdaLeft,lambdaRight:launch.lambdaRight,loadEstimate:launch.uncertainty,bracketSeconds:launch.bracket.time[1]-launch.bracket.time[0],secondDerivative:g2,secondDerivativeEstimate:g2Estimate,timeEstimate:launchTimeEstimate,ownership:'bracketed transition; not an exactly unloaded left state'};
 const factoredGap=(time:number)=>{const dt=time-start.time;return .5*g2*dt*dt+.5*gauss(GL4,0,dt,t=>(dt-t)**2*pointJerk(start.time+t));};
 const gap=(q:number,cell?:FeatureCell)=>{if(q===start.q)return 0;const time=primitive.time(q);if(time>marbleExit.time)return Infinity;if(q<=proofEnd)return factoredGap(time);const c=cell??cellAt(partition,q);if(!c)return Infinity;if(!core.profile.sampleFeature(c.feature,q,contact,true))return Infinity;sampleMarble(marble,time,scratch);return contact.x-scratch.x;};
 const prime=(q:number,cell:FeatureCell)=>{if(!core.profile.sampleFeature(cell.feature,q,contact,true))return Infinity;sampleMarble(marble,primitive.time(q),scratch);return contact.first-scratch.v/primitive.speed(q);};
 const coverage={intervals:0,positive:0,monotone:0};
 const derivative=(a:number,b:number,cell:FeatureCell):Range=>{
  const m=(a+b)/2,g=featureBox(core.profile,cell.feature,a,b),u:Range=[primitive.speed(b),primitive.speed(a)],ta=primitive.time(a),tb=primitive.time(b),mb=freeMarbleBounds(marble,{x:0,v:0,w:0,angle:0,time:0},(ta+tb)/2,(tb-ta)/2,core.stop),direct=sub(g.first,range.div(mb.v,u));
  const alpha:Range=[primitive.acceleration(b),primitive.acceleration(a)],acc=marble.floor==='roll'||ta>=slipTime?0:aSlip;
  const second=range.add(sub(g.second,range.div(point(acc),range.mul(u,u))),range.div(range.mul(mb.v,alpha),range.mul(range.mul(u,u),u))),centered=range.add(point(prime(m,cell)),range.mul(second,[a-m,b-m]));
  return[Math.max(direct[0],centered[0]),Math.min(direct[1],centered[1])];
 };
 let root:readonly[number,number]|undefined,rootCell:FeatureCell|undefined,minimumGap=Infinity;const topology:string[]=[];let slipRecorded=false;
 for(const p of primitive.panels){
  if(p.t0>=marbleExit.time||!p.cell)break;
  const end=p.t1<=marbleExit.time?p.q1:primitive.qAt(marbleExit.time),nodes=[p.q0,end];
  if(slipQ!==undefined&&slipQ>=p.q0&&slipQ<=end){nodes.push(slipQ);if(!slipRecorded){topology.push(`slip-complete:${p.cell.index}`);slipRecorded=true;}}
  if(proofEnd>=p.q0&&proofEnd<=end)nodes.push(proofEnd);
  const sorted=[...new Set(nodes)].sort((a,b)=>a-b);
  for(let i=0;i+1<sorted.length;i++){
   const a=sorted[i]!,b=sorted[i+1]!;
   if(b<=proofEnd){const gb=gap(b,p.cell);if(!(gb>0))throw new VillageAdmissibilityError(core.stop,'striker-launch-indeterminate','unsupported-contact-geometry',gb,0,'Residual-aware separating window does not advance');minimumGap=Math.min(minimumGap,gb);continue;}
   const bracket=coverApproach(core.stop,a,b,q=>gap(q,p.cell),(a,b)=>derivative(a,b,p.cell!),()=>budget.use(1,'free-root-interval'),coverage,(a,b)=>{const ta=primitive.time(a),tb=primitive.time(b),mb=freeMarbleBounds(marble,{x:0,v:0,w:0,angle:0,time:0},(ta+tb)/2,(tb-ta)/2,core.stop);return sub(contactXRange(core.profile,p.cell!.feature,a,b),mb.x);});
   // F2: only accepted pre-event nodes enter the minimum sample receipt.
   minimumGap=Math.min(minimumGap,gap(a,p.cell));
   if(bracket){root=bracket;rootCell=p.cell;topology.push(`reimpact:${p.cell.index}:${p.cell.feature}`);break;}
   minimumGap=Math.min(minimumGap,gap(b,p.cell));
  }if(root)break;
 }
 const q=root?(root[0]+root[1])/2:primitive.stop,time=primitive.time(q);if(!root&&marbleExit.floor==='slip')throw new VillageAdmissibilityError(core.stop,'striker-slip','stroke',marbleExit.x,exitX,'No earlier owned re-impact before slipping deck exit');if(!root&&primitive.stalls)throw new VillageAdmissibilityError(core.stop,'striker-stall-before-stop','drive-force',0,primitive.energy(q));
 const knots=[...new Set([start.q,...primitive.panels.filter(p=>p.q1<q).map(p=>p.q1),...(slipQ!==undefined&&slipQ<q?[slipQ]:[]),q])].sort((a,b)=>a-b),rows=new Float64Array(knots.length*4);let qError=0,uError=0;
 for(let i=0;i<knots.length;i++){const angle=knots[i]!,at=primitive.time(angle);rows.set([at,angle,primitive.speed(angle),primitive.acceleration(angle)],i*4);
  if(i){const base=(i-1)*4,t0=rows[base]!,t1=at;for(const fraction of[.25,.5,.75]){const t=t0+(t1-t0)*fraction,exact=primitive.qAt(t),cached=quinticValue(rows[base+1]!,angle,rows[base+2]!,rows[i*4+2]!,rows[base+3]!,rows[i*4+3]!,t0,t1,t),velocity=quinticValue(rows[base+1]!,angle,rows[base+2]!,rows[i*4+2]!,rows[base+3]!,rows[i*4+3]!,t0,t1,t,true);qError=Math.max(qError,Math.abs(cached-exact));uError=Math.max(uError,Math.abs(velocity-primitive.speed(exact)));}}
 }
 const checkedTime=Math.min(time,marbleExit.time);sampleMarble(marble,checkedTime,scratch);
 const endQ=checkedTime===time?q:primitive.qAt(checkedTime);let state:StrikeState={q:endQ,time:checkedTime,x:scratch.x,v:scratch.v,w:scratch.w,u:primitive.speed(endQ),angle:scratch.angle,floor:scratch.floor,error:start.error};
 let gamma=Infinity,condition=0,gapResidual=0;
 if(root){core.profile.sampleFeature(rootCell!.feature,q,contact,true);sampleMarble(marble,time,scratch);gamma=contact.nx*scratch.v-contact.J*primitive.speed(q);condition=Math.abs(scratch.v*primitive.speed(q)*contact.nx/gamma);gapResidual=contact.x-scratch.x;
  // The endpoint is one shared event coordinate. Residual is retained in its
  // estimate; no time warp or physical gap allowance is introduced.
  state={...state,x:contact.x};
 }
 const bracket:EventBracket={id:root?`reimpact-cell-${rootCell!.index}`:'bell',q:root??[q,q],time:root?[primitive.time(root[0]),primitive.time(root[1])]:[time,time]};
 return{primitive,marble,marbleExit,end:state,partnerEnd:{q,time,u:primitive.speed(q)},rootCell,rows,gamma,condition,gapResidual,minimumGap,topology:[...topology,root?'reimpact':'bell'],grazing,coverage,launchReceipt,launchTimeEstimate,bracket,slipLoss:scratch.loss,qError,uError};
}
/** Consecutive event topologies and common-q time observations must stabilize.
 * Conditioning can force a numerical reject; targets are never enlarged. */
export function freeFlight(core:PendulumCore,start:StrikeState,launch:SeparationStart,partition:FeaturePartition,exitX:number,policy:NumericalPolicy,budget:ForwardBudget):FreeResult{
 let previous:ReturnType<typeof nativeFlight>|undefined,stable=0;
 for(let level=0;level<=policy.maxHalvings;level++){
  let result:ReturnType<typeof nativeFlight>;
  try{result=nativeFlight(core,start,launch,partition,exitX,policy.initialStep/2**level,policy,budget);}catch(error){if(error instanceof VillageAdmissibilityError&&error.phase==='striker-interpolation'&&level<policy.maxHalvings){previous=undefined;stable=0;continue;}throw error;}
  if(!previous){previous=result;continue;}
  const topology=result.topology.join('/')===previous.topology.join('/');stable=topology?stable+1:0;
  let commonTime=0;for(let i=0;i<previous.rows.length;i+=4){const q=previous.rows[i+1]!;if(q<=result.partnerEnd.q)commonTime=Math.max(commonTime,Math.abs(result.primitive.time(q)-previous.rows[i]!));}
  const quadrature=Math.max(commonTime,result.primitive.estimate(result.partnerEnd.q))*16/15,difference=Math.abs(result.partnerEnd.time-previous.partnerEnd.time),dq=Math.abs(result.partnerEnd.q-previous.partnerEnd.q);
  const root=result.rootCell!==undefined,uMin=Math.min(result.partnerEnd.u,start.u),dt=result.partnerEnd.time-start.time,I=core.body.axleInertia;
  const energyInput=I*Math.abs(start.u)*start.error.u+Math.abs(core.potentialSlope(start.q))*start.error.q+start.error.energy;
  const inheritedTime=(result.partnerEnd.q-start.q)*energyInput/(I*uMin**3),timing=quadrature+inheritedTime+start.error.time+result.launchTimeEstimate;
  const gapInput=start.error.x+Math.abs(dt)*(start.error.v+start.error.w)+Math.abs(start.v)*timing;
  const rootContact=blankBarContact();if(root&&!core.profile.sampleFeature(result.rootCell!.feature,result.partnerEnd.q,rootContact,true))throw new VillageAdmissibilityError(core.stop,'striker-root-indeterminate','unsupported-contact-geometry',1,0);
  const baseQ=Math.max(dq,root?result.condition*quadrature:0)+result.qError+start.error.q,baseU=start.error.u*Math.abs(start.u)/uMin+energyInput/(I*uMin)+result.uError+Math.abs(result.partnerEnd.u-previous.partnerEnd.u);
  let qEstimate=baseQ+(root?rootCoordinateError(gapInput,Math.abs(rootContact.nx),result.partnerEnd.u,Math.abs(result.gamma)):0),timeEstimate=timing+qEstimate/uMin,uEstimate=baseU,gammaEstimate=0,marbleBox=freeMarbleBounds(result.marble,start.error,result.end.time,timeEstimate,core.stop),conditioned=!root;
  // Self-consistent local root box: the derivative and marble/slip branch
  // must cover the same q/time/u uncertainty that they are used to propagate.
  // Failure to close the box is numerical indeterminacy, not a missed root.
  for(let iteration=0;root&&iteration<16;iteration++){
   let nxMax=0;gammaEstimate=0;
   const alphaMax=(Math.abs(core.potentialSlope(result.partnerEnd.q))+core.torque+core.body.mass*9.81*Math.hypot(core.body.centre[0],core.body.centre[1])*qEstimate)/I;
   uEstimate=baseU+alphaMax*qEstimate/uMin;timeEstimate=timing+qEstimate/uMin;marbleBox=freeMarbleBounds(result.marble,start.error,result.end.time,timeEstimate,core.stop);
   for(const g of geometryBoxes(core.stop,core.profile,partition,result.partnerEnd.q,qEstimate)){gammaEstimate=Math.max(gammaEstimate,intervalRadius(approachBounds(g,marbleBox.v,box(result.partnerEnd.u,uEstimate)),result.gamma));nxMax=Math.max(nxMax,magnitude(g.nx));}
   gammaEstimate+=Math.abs(result.gamma-previous.gamma);
   const gammaLower=Math.abs(result.gamma)-gammaEstimate;if(!(gammaLower>0))break;
   const required=baseQ+rootCoordinateError(gapInput,nxMax,result.partnerEnd.u+uEstimate,gammaLower);
   if(required<=qEstimate){conditioned=true;break;}qEstimate=required;
  }
  if(!conditioned)throw new VillageAdmissibilityError(core.stop,'striker-root-indeterminate','unsupported-contact-geometry',qEstimate,policy.stateTargets.q,'Root conditioning box failed to close under its own propagated uncertainty');
  const error:StrikeError={...start.error,q:qEstimate,time:timeEstimate,x:Math.max(gapInput,intervalRadius(marbleBox.x,result.end.x))+Math.abs(result.gapResidual),u:uEstimate,v:intervalRadius(marbleBox.v,result.end.v),w:intervalRadius(marbleBox.w,result.end.w),angle:intervalRadius(marbleBox.angle,result.end.angle)};
  if(root&&!(result.gamma< -gammaEstimate))throw new VillageAdmissibilityError(core.stop,'striker-reattach-indeterminate','impact-cone',result.gamma,-gammaEstimate);
  if(stable>=2&&qEstimate<=policy.stateTargets.q&&timeEstimate<=policy.eventTimeEstimate&&uEstimate<=policy.stateTargets.u&&error.v<=policy.stateTargets.w&&error.w<=policy.stateTargets.w&&error.angle<=policy.stateTargets.angle){
   const report:FreeReport={status:'observed-convergence-estimate',panels:result.rows.length/4-1,differenceSeconds:difference,referenceDifferenceSeconds:result.primitive.estimate(result.partnerEnd.q),interpolation:{q:result.qError,u:result.uError},rigorous:false,topology:result.topology,stableRefinements:stable,localTimeEstimate:quadrature,state:error,grazing:result.grazing,coverage:result.coverage,launch:result.launchReceipt,...(root?{rootConditioning:{gamma:result.gamma,gammaEstimate,factor:result.condition,q:qEstimate,time:timeEstimate,gapResidual:result.gapResidual,quadratureEstimate:quadrature}}:{})};
   const exitBox=freeMarbleBounds(result.marble,start.error,result.marbleExit.time,timeEstimate,core.stop);
   if(!(exitBox.v[0]>0))throw new VillageAdmissibilityError(core.stop,'striker-deckexit-indeterminate','drive-force',0,exitBox.v[0]);
   const exitTimeError=timeEstimate+intervalRadius(exitBox.x,result.marbleExit.x)/exitBox.v[0],conditionedExit=freeMarbleBounds(result.marble,start.error,result.marbleExit.time,exitTimeError,core.stop),exitError:StrikeError={...error,time:exitTimeError,x:intervalRadius(conditionedExit.x,result.marbleExit.x),v:intervalRadius(conditionedExit.v,result.marbleExit.v),w:intervalRadius(conditionedExit.w,result.marbleExit.w),angle:intervalRadius(result.marbleExit.floor==='roll'?rollingExitAngleBounds(result.marble,start.error,exitX,core.stop):conditionedExit.angle,result.marbleExit.angle)};
   if(!root&&(exitError.time>policy.eventTimeEstimate||exitError.v>policy.stateTargets.w||exitError.w>policy.stateTargets.w||exitError.angle>policy.stateTargets.angle))throw new VillageAdmissibilityError(core.stop,'striker-deckexit-indeterminate','unsupported-contact-geometry',Math.max(exitError.time/policy.eventTimeEstimate,exitError.v/policy.stateTargets.w,exitError.w/policy.stateTargets.w,exitError.angle/policy.stateTargets.angle),1,JSON.stringify({exitError,policy:policy.stateTargets,eventTime:policy.eventTimeEstimate,scope:'actual final finite-deck exit only; earlier reimpact supersedes a provisional boundary'}));
   return{start,end:{...result.end,error},exit:root?'reimpact':'bell',cell:result.rootCell?.index,bracket:result.bracket,rows:result.rows,marble:result.marble,report,slipLoss:result.slipLoss,minimumGap:result.minimumGap,partnerEnd:result.partnerEnd,marbleExit:{...result.marbleExit,error:exitError},checkedUntil:result.end.time};
  }previous=result;
 }
 throw new VillageAdmissibilityError(core.stop,'striker-free-numerical-convergence','unsupported-contact-geometry',1,0,'Event topology/conditioning/interpolation targets unresolved');
}
