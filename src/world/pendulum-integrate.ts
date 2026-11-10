import{contactVelocityError,loadBounds}from'./pendulum-uncertainty';
import{cellAt,featureCells}from'./pendulum-cells';
import { VillageAdmissibilityError,VILLAGE_CONTACT } from './village-contact';
import { PendulumCore, type StrikeMode } from './pendulum-core';
import { blankBarContact, type NumericalPolicy, type NumericalReport, type PendulumRate, type PendulumState, type StateEstimates, type NumericalObservations,type ContactStart,type ContactExit,type ContactResult,type FeaturePartition,type ForwardBudget,type EventBracket,type StrikeError } from './pendulum-types';
export interface PushRow {readonly q:number;readonly time:number;readonly u:number;readonly w:number;readonly angle:number;readonly slipWork:number;readonly contactWork:number;readonly mode:StrikeMode;readonly lambda:number;readonly normal:number;readonly friction:number;readonly cell:number;readonly feature:number}
export interface PushResult {readonly rows:readonly PushRow[];readonly report:NumericalReport;readonly spinEventResiduals:readonly number[];readonly reason:'separation'|'clear'}
const stateKeys=['q','time','u','w','angle','slipWork','contactWork']as const;
const emptyEstimates=():Record<keyof StateEstimates,number>=>({q:0,time:0,u:0,w:0,angle:0,slipWork:0,contactWork:0});
const blankRate=():PendulumRate=>({q:0,u:0,w:0,angle:0,slipWork:0,contactWork:0,lambda:0,normal:0,friction:0,acceleration:0,slip:0});
/** This is the bounded pendulum push only. q is monotone; time is an integrated
 * state, never an authored timing map. Feature/event brackets stop RK4 cells. */
function attempt(core:PendulumCore,start:ContactStart,partition:FeaturePartition,dq:number,policy:NumericalPolicy,budget:ForwardBudget){
 const contact=blankBarContact(),rate=blankRate(),local=emptyEstimates(),rows:PushRow[]=[],spinResiduals:number[]=[],events:EventBracket[]=[];
 let q=start.state.q,y=[start.state.time,start.state.u,start.state.w,start.state.angle,0,0],mode=start.mode,cell=partition.cells[start.cell]!,steps=0;
 let stall:ReturnType<PendulumCore['clearLimitStall']>;
 let lastBracket:readonly[number,number]=[start.state.time,start.state.time];
 const state=(angle:number,v:readonly number[]):PendulumState=>({q:angle,u:v[1]!,w:mode.kind==='roll'?contact.first*v[1]!:v[2]!,angle:v[3]!,slipWork:v[4]!,contactWork:v[5]!});
 const evaluate=(angle:number,v:readonly number[])=>{
  if(!(v[1]!>0))throw new VillageAdmissibilityError(core.stop,'striker-stall','drive-force',0,v[1]!);
  if(!core.profile.sampleFeature(cell.feature,angle,contact,true))throw new VillageAdmissibilityError(core.stop,'striker-clear-indeterminate','unsupported-contact-geometry',1,0);
  core.rateOnContact(state(angle,v),mode,contact,rate);return[1/v[1]!,rate.u/v[1]!,rate.w/v[1]!,rate.angle/v[1]!,rate.slipWork/v[1]!,rate.contactWork/v[1]!];
 };
 const rawStep=(angle:number,v:readonly number[],h:number)=>{
  budget.use(1,'contact-RK4');steps++;
  const k1=evaluate(angle,v),k2=evaluate(angle+h/2,v.map((a,i)=>a+h*k1[i]!/2)),k3=evaluate(angle+h/2,v.map((a,i)=>a+h*k2[i]!/2)),k4=evaluate(angle+h,v.map((a,i)=>a+h*k3[i]!));
  const result=v.map((a,i)=>a+h*(k1[i]!+2*k2[i]!+2*k3[i]!+k4[i]!)/6);
  // Rolling is the closed constraint w=C'(q)u after its actual cone/slip event.
  // It is not a separately integrated spin coordinate or energy correction.
  if(mode.kind==='roll')result[2]=contact.first*result[1]!;return result;
 };
 const sampleRate=(angle:number,v:readonly number[],which=cell)=>{if(!core.profile.sampleFeature(which.feature,angle,contact,true))return false;return core.rateOnContact(state(angle,v),mode,contact,rate);};
 const append=()=>{if(!sampleRate(q,y))return;if(mode.kind==='roll')y[2]=contact.first*y[1]!;core.assertPush(rate);rows.push({q,time:y[0]!,u:y[1]!,w:y[2]!,angle:y[3]!,slipWork:y[4]!,contactWork:y[5]!,mode,cell:cell.index,feature:cell.feature,lambda:rate.lambda,normal:rate.normal,friction:rate.friction});};
 const done=(reason:ContactExit['kind']|'stall-clear-limit',left:number,right:number,bracket:EventBracket)=>({rows,spinResiduals,local,bracket:lastBracket,reason,cell:cell.index,lambdaLeft:left,lambdaRight:right,event:bracket,events,steps,stall});
 append();
 while(q<core.drive.stopAngle){
  let h=Math.min(dq,cell.q1-q);if(!(h>0&&q+h>q))throw new VillageAdmissibilityError(core.stop,'striker-numerical-limit','unsupported-contact-geometry',1,0,'No representable contact advance');
  sampleRate(q,y);const slip0=rate.slip;let full:number[]=[],middle:number[]=[],next:number[]=[];
  for(let recover=0;;recover++){
   try{full=rawStep(q,y,h);middle=rawStep(q,y,h/2);next=rawStep(q+h/2,middle,h/2);
    sampleRate(q+h/2,middle);const crossed=rate.lambda<0||mode.kind==='slip'&&slip0*rate.slip<=0||mode.kind==='roll'&&VILLAGE_CONTACT.mu*rate.normal-Math.abs(rate.friction)<0;
    if(crossed){if(recover>=policy.maxHalvings)throw new VillageAdmissibilityError(core.stop,'striker-event-numerical','unsupported-contact-geometry',1,0,'Midpoint event cannot be ordered within fixed recovery limit');h/=2;continue;}break;}
   catch(error){
    // A trial endpoint can land on the open side of the exact packed clear
    // bracket. Recover the domain from INSIDE, then bracket the real lambda
    // event. No nominal circle, gap allowance or fictitious clear state.
    if(!(error instanceof VillageAdmissibilityError)||error.phase!=='striker-clear-indeterminate'||recover>=policy.maxHalvings)throw error;
    h/=2;if(!(q+h>q))throw error;
   }
  }
  // Keep the actually computed refined RK4 path and its midpoint cache. The
  // full step is the independent local-error observation, never extrapolated.
  const half=next;
  for(const[i,k]of(['time','u','w','angle','slipWork','contactWork']as const).entries())local[k]+=Math.abs(full[i]!-half[i]!)*16/15;
  if(!sampleRate(q+h,next))throw new VillageAdmissibilityError(core.stop,'striker-clear-indeterminate','unsupported-contact-geometry',1,0);
  const separation=rate.lambda<0,slip=mode.kind==='slip'&&slip0*rate.slip<=0,cone=mode.kind==='roll'&&VILLAGE_CONTACT.mu*rate.normal-Math.abs(rate.friction)<0;
  if(separation||slip||cone){
   const locate=(kind:'separation'|'slip'|'cone')=>{let a=0,b=h,left=y,right=next;for(let i=0;i<80;i++){const mid=(a+b)/2;if(q+mid===q+a||q+mid===q+b)break;const v=rawStep(q+mid/2,rawStep(q,y,mid/2),mid/2);sampleRate(q+mid,v);const crossed=kind==='separation'?rate.lambda<=0:kind==='slip'?slip0*rate.slip<=0:VILLAGE_CONTACT.mu*rate.normal-Math.abs(rate.friction)<=0;if(crossed){b=mid;right=v;}else{a=mid;left=v;}}return{kind,a,b,left,right};};
   const found=[...(separation?[locate('separation')]:[]),...(slip?[locate('slip')]:[]),...(cone?[locate('cone')]:[])].sort((a,b)=>a.b-b.b),event=found[0]!;
   const oldq=q;lastBracket=[event.left[0]!,event.right[0]!];const bracket:EventBracket={id:`contact-${events.length}-${event.kind}`,q:[oldq+event.a,oldq+event.b],time:lastBracket};events.push(bracket);
   if(event.kind==='separation'){q+=event.a;y=[...event.left];append();sampleRate(oldq+event.b,event.right);return done('separation-root',rows.at(-1)!.lambda,rate.lambda,bracket);}
   q+=event.b;y=[...event.right];sampleRate(q,y);
   if(event.kind==='slip'){
    const residual=contact.first*y[1]!-y[2]!;spinResiduals.push(residual);if(Math.abs(residual)>policy.stateTargets.w)throw new VillageAdmissibilityError(core.stop,'striker-slip-event','unsupported-contact-geometry',Math.abs(residual),policy.stateTargets.w);
    y[2]=contact.first*y[1]!;core.rateOnContact(state(q,y),{kind:'roll'},contact,rate);mode=Math.abs(rate.friction)<=VILLAGE_CONTACT.mu*rate.normal?{kind:'roll'}:{kind:'slip',sign:rate.friction<0?1:-1};
   }else{mode={kind:'slip',sign:rate.friction<0?1:-1};}
   append();continue;
  }
  const oldq=q;q=oldq+h/2;y=[...middle];append();q=oldq+h;y=[...next];append();
  if(contact.x>=start.exitX)throw new VillageAdmissibilityError(core.stop,'striker-contact-offdeck','stroke',contact.x,start.exitX);
  if(q===cell.q1){
   const left=rate.lambda,nextCell=partition.cells[cell.index+1],bracket:EventBracket={id:`feature-${cell.index}`,q:cell.end,time:[y[0]!,y[0]!]};events.push(bracket);lastBracket=bracket.time;
   if(!nextCell){if(!partition.clear||cell.q1>=core.drive.stopAngle)throw new VillageAdmissibilityError(core.stop,'striker-stop-contact','unsupported-contact-geometry',1,0);throw new VillageAdmissibilityError(core.stop,'striker-clear-limit-unsupported','unsupported-contact-geometry',1,0,'Contact reaches geometric clear without an enrolled finite free launch');}
   if(!sampleRate(q,y,nextCell))throw new VillageAdmissibilityError(core.stop,'striker-feature-indeterminate','unsupported-contact-geometry',1,0);
   // The right feature is evaluated explicitly at the SAME q/state. Never
   // bisect lambda through a curvature jump or integrate the left formula past it.
   const error={q:start.state.error.q+local.q+(cell.end[1]-cell.end[0]),u:start.state.error.u+local.u,w:start.state.error.w+local.w},current={q,u:y[1]!,w:y[2]!};let bounds=loadBounds(core,partition,current,error,mode,nextCell.feature);
   if(!(bounds.normal[0]>0))throw new VillageAdmissibilityError(core.stop,'striker-transition-indeterminate','support-normal',0,bounds.normal[0]);
   if(mode.kind==='roll'){if(bounds.cone[0]<=0&&bounds.cone[1]>=0)throw new VillageAdmissibilityError(core.stop,'striker-transition-indeterminate','floor-cone',0,0,'One-sided feature cone is unresolved');if(bounds.cone[1]<0){mode={kind:'slip',sign:bounds.friction[1]<0?1:-1};core.rateOnContact(state(q,y),mode,contact,rate);bounds=loadBounds(core,partition,current,error,mode,nextCell.feature);}}
   const right=rate.lambda;if(bounds.lambda[0]<=0&&bounds.lambda[1]>=0)throw new VillageAdmissibilityError(core.stop,'striker-transition-indeterminate','head-compressive',0,0,'One-sided feature load is unresolved');
   if(bounds.lambda[1]<0)return done('separation-feature',left,right,bracket);
   cell=nextCell;append();
   if(mode.kind==='roll'){
    const s=start.state,m=.02,k=.4,I=core.body.axleInertia,E=.5*m*(s.v*s.v+k*s.w*s.w)+.5*I*s.u*s.u+core.potential(s.q),error=s.error.energy+I*Math.abs(s.u)*s.error.u+m*Math.abs(s.v)*s.error.v+m*k*Math.abs(s.w)*s.error.w+Math.abs(core.potentialSlope(s.q))*s.error.q;
    stall=core.clearLimitStall(cell,partition.clear,E,s.q,error);
    if(stall)return done('stall-clear-limit',rate.lambda,rate.lambda,bracket);
   }
  }
 }
 throw new VillageAdmissibilityError(core.stop,'striker-stop-contact','unsupported-contact-geometry',1,0);
}
/** Constructor-only dense reference at a COMMON q. No state arrays are allocated
 * by playback. Feature and Coulomb boundaries are represented by explicit rows. */
function commonQ(core:PendulumCore,rows:readonly PushRow[],q:number,feature:number):PushRow{
 let lo=0,hi=rows.length;while(lo<hi){const mid=(lo+hi)>>>1;if(rows[mid]!.q<q)lo=mid+1;else hi=mid;}for(let n=lo;n<rows.length&&rows[n]!.q===q;n++)if(rows[n]!.feature===feature)return rows[n]!;
 let i=0,j=rows.length-1;while(i+1<j){const mid=(i+j)>>>1;if(rows[mid]!.q<=q)i=mid;else j=mid;}
 const a=rows[i]!,b=rows[j]!;if(q===a.q)return a;if(q===b.q)return b;
 const ra=blankRate(),rb=blankRate(),ca=blankBarContact(),cb=blankBarContact();core.profile.sampleFeature(a.feature,a.q,ca,true);core.profile.sampleFeature(b.feature,b.q,cb,true);core.rateOnContact(a,a.mode,ca,ra);core.rateOnContact(b,b.mode,cb,rb);
 const h=b.q-a.q,z=(q-a.q)/h,z2=z*z,z3=z2*z;
 const interp=(x:number,y:number,dx:number,dy:number)=>(2*z3-3*z2+1)*x+(z3-2*z2+z)*h*dx+(-2*z3+3*z2)*y+(z3-z2)*h*dy;
 const time=interp(a.time,b.time,1/a.u,1/b.u),u=interp(a.u,b.u,ra.u/a.u,rb.u/b.u),c=blankBarContact();core.profile.sampleFeature(a.feature,q,c,true);
 const w=a.mode.kind==='roll'?c.first*u:interp(a.w,b.w,ra.w/a.u,rb.w/b.u);
 const state={q,u,w,angle:interp(a.angle,b.angle,ra.angle/a.u,rb.angle/b.u),slipWork:interp(a.slipWork,b.slipWork,ra.slipWork/a.u,rb.slipWork/b.u),contactWork:interp(a.contactWork,b.contactWork,ra.contactWork/a.u,rb.contactWork/b.u)};
 const rate=blankRate();core.rateOnContact(state,a.mode,c,rate);
 return{...state,time,mode:a.mode,cell:a.cell,feature:a.feature,lambda:rate.lambda,normal:rate.normal,friction:rate.friction};
}
/** Observed convergence, local step doubling and independently observed common-q
 * loads. These estimates cannot enlarge a physical cone or make a theorem. */
export function integrateContact(core:PendulumCore,start:ContactStart,partition:FeaturePartition,policy:NumericalPolicy,budget:ForwardBudget):ContactResult{
 let previous:ReturnType<typeof attempt>|undefined,previousDifference=Infinity,plateauRuns=0;
 for(let halvings=0;halvings<=policy.maxHalvings;halvings++){
  const step=policy.initialStep/2**halvings,result=attempt(core,start,partition,step,policy,budget),last=result.rows.at(-1)!;
  if(!previous){previous=result;continue;}
  const old=previous.rows.at(-1)!,differences=emptyEstimates(),estimates=emptyEstimates();
  for(const k of stateKeys){differences[k]=Math.abs(last[k]-old[k]);estimates[k]=differences[k]*16/15;}
  estimates.w=Math.max(estimates.w,...result.spinResiduals.map(Math.abs));
  const normalizedDifference=Math.max(...stateKeys.map(k=>differences[k]/policy.stateTargets[k])),ratio=previousDifference/normalizedDifference;
  const observations:Record<keyof NumericalObservations,number>={lambda:0,normal:0,friction:0,cone:0,spin:0,x:0,speed:0,energy:0,time:0,eventQ:Math.abs(last.q-old.q),eventTime:Math.abs(last.time-old.time)};
  const transitions=(rows:readonly PushRow[])=>rows.flatMap((r,i)=>i&&r.mode.kind!==rows[i-1]!.mode.kind?[{row:r,left:rows[i-1]!.mode}]:[]);
  const coarseEvents=transitions(previous.rows),fineEvents=transitions(result.rows),regimeEvents:{qDifference:number;timeDifference:number;spinDifference:number;leftFriction:number;rightFriction:number}[]=[];
  let eventMatch=coarseEvents.length===fineEvents.length;
  const rateRow=(row:PushRow,mode:StrikeMode,out:PendulumRate)=>{const c=blankBarContact();core.profile.sampleFeature(row.feature,row.q,c,true);return core.rateOnContact(row,mode,c,out);};
  for(let i=0;i<Math.min(coarseEvents.length,fineEvents.length);i++){
   const a=coarseEvents[i]!,b=fineEvents[i]!,ar=blankRate(),br=blankRate(),left=blankRate(),right=blankRate();
   rateRow(a.row,a.left,ar);rateRow(b.row,b.left,br);rateRow(b.row,b.left,left);rateRow(b.row,b.row.mode,right);
   const dq=Math.abs(a.row.q-b.row.q),dt=Math.abs(a.row.time-b.row.time),dw=Math.abs(a.row.w-b.row.w);
   observations.lambda=Math.max(observations.lambda,Math.abs(ar.lambda-br.lambda));observations.normal=Math.max(observations.normal,Math.abs(ar.normal-br.normal));observations.friction=Math.max(observations.friction,Math.abs(ar.friction-br.friction));
   rateRow(a.row,a.row.mode,ar);rateRow(b.row,b.row.mode,br);
   observations.lambda=Math.max(observations.lambda,Math.abs(ar.lambda-br.lambda));observations.normal=Math.max(observations.normal,Math.abs(ar.normal-br.normal));observations.friction=Math.max(observations.friction,Math.abs(ar.friction-br.friction));
   observations.eventQ=Math.max(observations.eventQ,dq);observations.eventTime=Math.max(observations.eventTime,dt);
   eventMatch=eventMatch&&dt<=policy.eventTimeEstimate&&dw<=policy.stateTargets.w;
   regimeEvents.push({qDifference:dq,timeDifference:dt,spinDifference:dw,leftFriction:left.friction,rightFriction:right.friction});
  }
  let minimumLambda=Infinity,minimumNormal=Infinity,rollingCone=Infinity;
  const c=blankBarContact(),r=blankRate(),m=.02,k=.4,initial=.5*m*(start.state.v**2+k*start.state.w**2)+.5*core.body.axleInertia*start.state.u**2+core.potential(start.state.q);
  const energy=(row:PushRow)=>{core.profile.sampleFeature(row.feature,row.q,c,true);return .5*m*((c.first*row.u)**2+k*row.w**2)+.5*core.body.axleInertia*row.u**2+core.potential(row.q)+core.torque*(row.q-start.state.q)+row.slipWork;};
  let margins=true;
  for(const a of previous.rows){
   if(a.q>=Math.min(old.q,last.q))continue;
   const b=commonQ(core,result.rows,a.q,a.feature);core.profile.sampleFeature(a.feature,a.q,c,true);
   if(a.feature!==b.feature){eventMatch=false;continue;}
   if(a.mode.kind!==b.mode.kind){
    if(!coarseEvents.some((event,i)=>fineEvents[i]&&a.q>=Math.min(event.row.q,fineEvents[i]!.row.q)&&a.q<=Math.max(event.row.q,fineEvents[i]!.row.q)))eventMatch=false;
    continue; // Compare the matched one-sided laws above, not their real jump.
   }
   const da=Math.abs(a.lambda-b.lambda),dn=Math.abs(a.normal-b.normal),df=Math.abs(a.friction-b.friction);
   observations.lambda=Math.max(observations.lambda,da);observations.normal=Math.max(observations.normal,dn);observations.friction=Math.max(observations.friction,df);
   observations.cone=Math.max(observations.cone,VILLAGE_CONTACT.mu*dn+df);observations.spin=Math.max(observations.spin,Math.abs(a.w-b.w));observations.time=Math.max(observations.time,Math.abs(a.time-b.time));
   observations.speed=Math.max(observations.speed,Math.abs(c.first*(a.u-b.u)));observations.energy=Math.max(observations.energy,Math.abs(energy(a)-energy(b)));
   core.rateOnContact(b,b.mode,c,r);const cone=VILLAGE_CONTACT.mu*b.normal-Math.abs(b.friction);
   minimumLambda=Math.min(minimumLambda,b.lambda);minimumNormal=Math.min(minimumNormal,b.normal);
   if(b.mode.kind==='roll')rollingCone=Math.min(rollingCone,cone);
   const round=128*Number.EPSILON*Math.max(1,Math.abs(b.lambda),Math.abs(b.normal),Math.abs(b.friction));
   if(b.lambda<=da*16/15+round||b.normal<=dn*16/15+round||b.mode.kind==='roll'&&cone<=(VILLAGE_CONTACT.mu*dn+df)*16/15+round)margins=false;
  }
  const residual=initial-energy(last),eventWidth=result.bracket[1]-result.bracket[0];
  eventMatch=eventMatch&&result.events.map(e=>e.id).join('/')===previous.events.map(e=>e.id).join('/');
  const targets=stateKeys.every(k=>estimates[k]<=policy.stateTargets[k]&&result.local[k]<=policy.stateTargets[k]);
  // A measured order ratio is undefined once independent refinements differ
  // only at floating-point roundoff. Require two successive per-unit plateaus,
  // local observations, matched events and ALL unchanged physical/error gates.
  // This is an observed stopping condition, not a Richardson certificate.
  const roundoff=emptyEstimates();for(const k of stateKeys)roundoff[k]=128*Number.EPSILON*Math.max(1,Math.abs(last[k]),Math.abs(old[k]));
  const plateau=stateKeys.every(k=>roundoff[k]<=policy.stateTargets[k])&&stateKeys.every(k=>differences[k]<=roundoff[k])&&observations.energy<=128*Number.EPSILON*Math.max(1,initial)&&observations.time<=roundoff.time&&observations.spin<=roundoff.w;
  plateauRuns=plateau&&margins&&eventMatch&&targets?plateauRuns+1:0;
  if(halvings>=2&&result.reason===previous.reason&&targets&&(ratio>=8||plateauRuns>=2)&&margins&&eventMatch&&Math.abs(residual)<=policy.absoluteEnergyEstimate&&observations.energy*16/15<=policy.absoluteEnergyEstimate&&observations.eventTime*16/15+eventWidth<=policy.eventTimeEstimate){
   const report:NumericalReport={status:'observed-convergence-estimate',termination:plateauRuns>=2?'roundoff-plateau':'observed-order',roundoff,step,halvings,differences,estimates,localEstimates:result.local,orderRatio:ratio,normalizedDifference,observations,regimeEvents,margins:{lambda:minimumLambda,normal:minimumNormal,rollingCone},energyResidual:residual,eventBracket:result.bracket,rigorous:false};
   for(const k of stateKeys)estimates[k]=Math.max(estimates[k],result.local[k],plateauRuns>=2?roundoff[k]:0);
   if(result.reason==='stall-clear-limit')throw new VillageAdmissibilityError(core.stop,'striker-stall-before-stop','drive-force',result.stall!.remainingWorkLower,0,JSON.stringify({proof:result.stall,prefix:report,entry:{q:last.q,time:last.time,u:last.u,w:last.w,angle:last.angle,slipWork:last.slipWork,mode:last.mode},rollingEntry:result.rows.find(r=>r.mode.kind==='roll')}));
   core.profile.sampleFeature(last.feature,last.q,c,true);
   const error:StrikeError={q:start.state.error.q+estimates.q,time:start.state.error.time+estimates.time,x:start.state.error.x+Math.abs(c.first)*estimates.q,v:start.state.error.v+observations.speed*16/15+contactVelocityError(core,partition,last.q,last.u,start.state.error.q+estimates.q,start.state.error.u+estimates.u),u:start.state.error.u+estimates.u,w:start.state.error.w+estimates.w,angle:start.state.error.angle+estimates.angle,energy:start.state.error.energy+Math.abs(residual),lambda:start.state.error.lambda+observations.lambda*16/15,normal:start.state.error.normal+observations.normal*16/15,friction:start.state.error.friction+observations.friction*16/15};
   for(let i=1;i<result.rows.length;i++){const row=result.rows[i]!,prior=result.rows[i-1]!;if(row.feature===prior.feature)continue;const bounds=loadBounds(core,partition,row,{q:error.q,u:error.u,w:error.w},row.mode,row.feature);if(!(bounds.lambda[0]>0&&bounds.normal[0]>0)||(row.mode.kind==='roll'&&!(bounds.cone[0]>0)))throw new VillageAdmissibilityError(core.stop,'striker-transition-indeterminate','head-compressive',0,bounds.lambda[0],'Final state estimate does not resolve feature contact/regime');}
   if(result.reason==='separation-feature'&&!(result.lambdaLeft>error.lambda&&result.lambdaRight< -error.lambda))throw new VillageAdmissibilityError(core.stop,'striker-contact-indeterminate','head-compressive',Math.abs(result.lambdaRight),error.lambda,'Unresolved one-sided feature release');
   core.profile.sampleFeature(last.feature,last.q,c,true);
   const exit:ContactExit={kind:result.reason,state:{q:last.q,time:last.time,u:last.u,w:last.w,v:c.first*last.u,x:c.x,angle:last.angle,floor:last.mode.kind==='roll'?'roll':'slip',error},cell:result.cell,bracket:result.event,lambdaLeft:result.lambdaLeft,lambdaRight:result.lambdaRight,error:error.lambda};
   return{rows:result.rows,start,exit,report,steps:result.steps,events:result.events};
  }
  previous=result;previousDifference=normalizedDifference;
 }
 throw new VillageAdmissibilityError(core.stop,'striker-numerical-convergence','unsupported-contact-geometry',1,0,'Fixed per-unit targets or observed physical margins not met; no tolerance growth');
}

/** First-episode compatibility wrapper. Literal horizontal impact is unchanged.
 * Episode production calls integrateContact directly after every real impulse. */
export function integratePush(core:PendulumCore,incoming:number,spin:number,policy:NumericalPolicy):PushResult{
 const partition=featureCells(core.stop,core.profile,core.drive.stopAngle),c=blankBarContact(),old=core.impact(incoming,spin);core.profile.sample(0,c);
 const error:StrikeError={q:0,time:0,x:0,v:0,u:0,w:0,angle:0,energy:0,lambda:0,normal:0,friction:0};
 const state={q:0,time:0,x:c.x,v:old.vAfter,u:old.thetaDot,w:spin,angle:0,floor:old.vAfter===spin?'roll' as const:'slip' as const,error},scratch=blankRate(),mode=state.floor==='roll'?core.stickMode({q:0,u:state.u,w:state.w,angle:0,slipWork:0,contactWork:0},scratch):{kind:'slip' as const,sign:state.v>state.w?1 as const:-1 as const};
 let used=0;const budget:ForwardBudget={get used(){return used;},use(n,phase){used+=n;if(used>policy.maxSteps)throw new VillageAdmissibilityError(core.stop,'striker-numerical-limit','unsupported-contact-geometry',used,policy.maxSteps,phase);}};
 const result=integrateContact(core,{state,cell:cellAt(partition,0)!.index,mode,bracket:{id:'first-impact',q:[0,0],time:[0,0]},exitX:Infinity},partition,policy,budget);
 return{rows:result.rows,report:result.report,spinEventResiduals:[],reason:result.exit.kind==='clear'?'clear':'separation'};
}
