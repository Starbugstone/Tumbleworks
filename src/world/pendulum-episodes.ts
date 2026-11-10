// UNUSED / UNRUN. Bounded same-sphere/same-q episodes; not a general contact engine.
import{VillageAdmissibilityError}from'./village-contact';
import{PendulumCore,type StrikeMode}from'./pendulum-core';
import{integrateContact}from'./pendulum-integrate';
import{freeFlight}from'./pendulum-free';
import{impactInputError,impactOutputBounds,loadBounds,radius}from'./pendulum-uncertainty';
import{featureCells,nextFloat}from'./pendulum-cells';
import{blankBarContact,type StrikeState,type StrikeError,type StrikeEpisodes,type StrikeEpisode,type EventBracket,type NumericalPolicy,type ForwardBudget,type SeparationStart,type FeatureCell,type PendulumRate}from'./pendulum-types';
export class StrikeBudget implements ForwardBudget{
 private count=0;constructor(readonly stop:number,readonly maximum:number){}
 get used():number{return this.count;}
 use(n:number,phase:string):void{this.count+=n;if(this.count>this.maximum)throw new VillageAdmissibilityError(this.stop,'striker-numerical-limit','unsupported-contact-geometry',this.count,this.maximum,phase);}
}
/** Shared adjacent-episode endpoints are ONE physical event. Distinct event
 * brackets must be strictly ordered; no fictitious time gap is inserted. */
export function orderedEvent(stop:number,previous:EventBracket|undefined,next:EventBracket):void{
 if(!previous)return;
 const same=previous.id===next.id&&previous.q.every((v,i)=>v===next.q[i])&&previous.time.every((v,i)=>v===next.time[i]);
 if(!same&&!(next.q[0]>previous.q[1]&&next.time[0]>previous.time[1]))throw new VillageAdmissibilityError(stop,'striker-contact-accumulation','unsupported-contact-geometry',1,0,JSON.stringify({previous,next}));
}
export function occupyCell(stop:number,used:Set<number>,cell:number):void{
 if(used.has(cell))throw new VillageAdmissibilityError(stop,'striker-contact-accumulation','unsupported-contact-geometry',cell,cell,'The supported subset permits only one contact START per maximal feature interval');used.add(cell);
}
const emptyError=():StrikeError=>({q:0,time:0,x:0,v:0,u:0,w:0,angle:0,energy:0,lambda:0,normal:0,friction:0});
const blankRate=():PendulumRate=>({q:0,u:0,w:0,angle:0,slipWork:0,contactWork:0,lambda:0,normal:0,friction:0,acceleration:0,slip:0});
export function modeAt(core:PendulumCore,state:StrikeState,cell:FeatureCell,partition=featureCells(core.stop,core.profile,core.drive.stopAngle)){
 const c=blankBarContact(),r=blankRate();if(!core.profile.sampleFeature(cell.feature,state.q,c,true))throw new VillageAdmissibilityError(core.stop,'striker-contact-indeterminate','unsupported-contact-geometry',1,0);
 let mode:StrikeMode;
 if(state.floor==='roll'){
  const bounds=loadBounds(core,partition,state,state.error,{kind:'roll'});
  if(bounds.cone[0]<=0&&bounds.cone[1]>=0)throw new VillageAdmissibilityError(core.stop,'striker-contact-indeterminate','floor-cone',0,0,'Post-impact cone box straddles its boundary');
  mode=bounds.cone[0]>0?{kind:'roll'}:{kind:'slip',sign:bounds.friction[1]<0?1:-1};
 }else{const slip=state.v-state.w,error=state.error.v+state.error.w;if(!(Math.abs(slip)>error))throw new VillageAdmissibilityError(core.stop,'striker-impact-indeterminate','impact-cone',Math.abs(slip),error);mode={kind:'slip',sign:slip>0?1:-1};}
 core.rateOnContact({q:state.q,u:state.u,w:state.w,angle:state.angle,slipWork:0,contactWork:0},mode,c,r);
 const bounds=loadBounds(core,partition,state,state.error,mode);
 if(bounds.lambda[0]<=0&&bounds.lambda[1]>=0)throw new VillageAdmissibilityError(core.stop,'striker-contact-indeterminate','head-compressive',0,0,'Post-impact load box straddles zero');
 if(!(bounds.normal[0]>0))throw new VillageAdmissibilityError(core.stop,'striker-contact-indeterminate','support-normal',0,bounds.normal[0]);
 return{mode,rate:r,error:radius(bounds.lambda,r.lambda),loads:{lambda:radius(bounds.lambda,r.lambda),normal:radius(bounds.normal,r.normal),friction:radius(bounds.friction,r.friction)}};
}
export function strikeEpisodes(core:PendulumCore,incoming:number,spin:number,exitX:number,policy:NumericalPolicy):StrikeEpisodes{
 const partition=featureCells(core.stop,core.profile,core.drive.stopAngle),budget=new StrikeBudget(core.stop,policy.maxSteps),episodes:StrikeEpisode[]=[],used=new Set<number>(),c=blankBarContact();
 if(!core.profile.sample(0,c))throw new VillageAdmissibilityError(core.stop,'striker-impact','unsupported-contact-geometry',1,0);
 const initial:StrikeState={q:0,time:0,x:c.x,v:incoming,u:0,w:spin,angle:0,floor:incoming===spin?'roll':'slip',error:emptyError()};
 let state=initial,cell=partition.cells[0]!,knot:EventBracket={id:'first-impact',q:[0,0],time:[0,0]},previous:EventBracket|undefined,finalSeparation=0,forwardWork=0;
 const topology:string[]=[];
 for(;;){
  orderedEvent(core.stop,previous,knot);occupyCell(core.stop,used,cell.index);budget.use(1,'impact');core.profile.sampleFeature(cell.feature,state.q,c,true);
  const input=impactInputError(core,state,partition),uncertainty=input.error;
  const before=state,result=core.impactAt(state.q,state.v,state.w,state.u,state.floor,uncertainty,c);
  if(!(result.vAfter>0&&result.uAfter>0))throw new VillageAdmissibilityError(core.stop,'striker-stall','drive-force',0,Math.min(result.vAfter,result.uAfter));
  const enclosure=impactOutputBounds(core,state,result,input.domains);
  const round=128*Number.EPSILON*Math.max(1,Math.abs(result.vAfter),Math.abs(result.uAfter));let dv=Math.max(round,radius(enclosure.v,result.vAfter)),du=Math.max(round,radius(enclosure.u,result.uAfter)),dw=Math.max(round,radius(enclosure.w,result.wAfter));
  // Observed input-error corner propagation, reported as an estimate rather
  // than an unconditional enclosure. A change of branch is indeterminate.
  const probe=blankBarContact();
  for(const sq of[-1,1])for(const sv of[-1,1])for(const su of[-1,1])for(const sw of[-1,1]){
   const q=state.q+sq*state.error.q,v=state.v+sv*state.error.v,u=state.u+su*state.error.u,w=state.floor==='roll'?v:state.w+sw*state.error.w;
   if(!core.profile.sample(q,probe))throw new VillageAdmissibilityError(core.stop,'striker-impact-indeterminate','unsupported-contact-geometry',1,0);
   const check=core.impactAt(q,v,w,u,state.floor,{gamma:0,slip:0,coneSlope:0,impulse:0},probe);budget.use(1,'impact-error-corner');
   if(check.branch!==result.branch)throw new VillageAdmissibilityError(core.stop,'striker-impact-indeterminate','impact-cone',1,0,'Impact branch changes inside observed input uncertainty');
   dv=Math.max(dv,Math.abs(check.vAfter-result.vAfter)+round);du=Math.max(du,Math.abs(check.uAfter-result.uAfter)+round);dw=Math.max(dw,Math.abs(check.wAfter-result.wAfter)+round);
  }
  const error:StrikeError={...state.error,v:dv,u:du,w:dw,energy:state.error.energy+Math.abs(result.residual)};
  state={...state,v:result.vAfter,w:result.wAfter,u:result.uAfter,floor:result.branch==='stick'||result.branch==='slip-then-stick'?'roll':'slip',error};
  episodes.push({kind:'impact',index:episodes.length,state,before,cell:cell.index,result,bracket:knot});topology.push(`impact:${cell.index}:${result.branch}`);
  const right=modeAt(core,state,cell,partition);state={...state,error:{...state.error,...right.loads}};let launch:SeparationStart;
  if(right.rate.lambda>right.error){
   const contact=integrateContact(core,{state,cell:cell.index,mode:right.mode,bracket:knot,exitX},partition,policy,budget);
   episodes.push({kind:'contact',index:episodes.length,start:state.time,end:contact.exit.state.time,motion:contact});forwardWork+=core.torque*(contact.exit.state.q-state.q);state=contact.exit.state;
   const end={...contact.exit.bracket,id:`episode-${episodes.length}:${contact.exit.bracket.id}`};orderedEvent(core.stop,knot,end);previous=end;finalSeparation=state.time;
   launch={kind:contact.exit.kind==='separation-root'?'root':'jump',bracket:end,lambdaLeft:contact.exit.lambdaLeft,lambdaRight:contact.exit.lambdaRight,uncertainty:contact.exit.error};topology.push(`${contact.exit.kind}:${contact.exit.cell}`);
  }else{
   previous=knot;finalSeparation=state.time;launch={kind:'jump',bracket:knot,lambdaLeft:0,lambdaRight:right.rate.lambda,uncertainty:right.error};topology.push(`impact-release:${cell.index}`);
  }
  const flight=freeFlight(core,state,launch,partition,exitX,policy,budget);episodes.push({kind:'free',index:episodes.length,start:state.time,end:flight.partnerEnd.time,motion:flight});forwardWork+=core.torque*(flight.partnerEnd.q-state.q);
  orderedEvent(core.stop,previous,flight.bracket);topology.push(...flight.report.topology);
  if(flight.exit==='bell'){
   if(flight.marbleExit.floor!=='roll')throw new VillageAdmissibilityError(core.stop,'striker-slip','unsupported-contact-geometry',1,0);
   const expected=core.torque*core.drive.stopAngle,round=4*(episodes.length+1)*(nextFloat(expected,1)-expected);
   if(Math.abs(forwardWork-expected)>round)throw new VillageAdmissibilityError(core.stop,'striker-forward-work','energy-balance',Math.abs(forwardWork-expected),round);
   return{partition,episodes:Object.freeze(episodes),initial,atBell:{...flight.partnerEnd,error:flight.report.state},marbleExit:flight.marbleExit,finalSeparation,forwardBearingWork:forwardWork,steps:budget.used,topology};
  }
  state=flight.end;cell=partition.cells[flight.cell!]!;knot=flight.bracket;previous=flight.bracket;
  if(episodes.filter(e=>e.kind!=='impact').length>2*partition.cells.length+1)throw new VillageAdmissibilityError(core.stop,'striker-contact-accumulation','unsupported-contact-geometry',episodes.length,2*partition.cells.length+1,'Explicit subset bound, not a universal e0 no-Zeno theorem');
 }
}
