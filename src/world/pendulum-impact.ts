// UNUSED / UNRUN. Pure tilted-normal Routh compression for the bounded K-S slice.
import {VillageAdmissibilityError,VILLAGE_CONTACT,assertContact} from './village-contact';
import type {PlanarImpactInput,PlanarImpactResult,RouthSegment,ImpactBranch} from './pendulum-types';
export function impactConeRoundoff(P:number,F:number,N:number,mu:number):number{return 128*Number.EPSILON*(Math.abs(P)+Math.abs(F)+mu*Math.abs(N));}
export interface ImpactBody {readonly mass:number;readonly kappa:number;readonly axleInertia:number}
function reject(stop:number,phase:string,required:number,available:number,detail:string):never{throw new VillageAdmissibilityError(stop,phase,'impact-cone',required,available,detail);}
/** The head impulse is frictionless. Spin changes ONLY through the floor's F.
 * N=-ny*P is UPWARD. The finite angular bearing torque has no impulse share. */
export function planarImpact(stop:number,input:PlanarImpactInput,body:ImpactBody):PlanarImpactResult{
 const {nx,ny,first,uncertainty:e}=input,{mass:m,kappa:k,axleInertia:I}=body,mu=VILLAGE_CONTACT.mu;
 if(![nx,ny,first,input.v,input.w,input.u,m,k,I,...Object.values(e)].every(Number.isFinite)||!(m>0&&k>0&&I>0&&first>0&&nx<0)||Math.abs(nx*nx+ny*ny-1)>128*Number.EPSILON)reject(stop,'striker-impact-indeterminate',1,0,'Invalid planar impact frame/body/error');
 if(ny>0)reject(stop,'striker-flight',ny,0,'Upward head normal requires a separate vertical flight law');
 const H=-nx*first,a=-nx,b=-ny,initialGamma=nx*input.v+H*input.u,initialSlip=input.v-input.w;
 if(!(initialGamma < -e.gamma))reject(stop,'striker-reattach-indeterminate',initialGamma,-e.gamma,'Approach must dominate its propagated uncertainty');
 const closed=128*Number.EPSILON*Math.max(1,Math.abs(input.v),Math.abs(input.w),Math.abs(input.u));
 if(input.floor==='roll'&&Math.abs(initialSlip)>closed)reject(stop,'striker-impact-indeterminate',Math.abs(initialSlip),closed,'Rolling input must carry its actual dependent spin, not a state reset');
 let v=input.v,w=input.w,u=input.u,P=0,F=0;
 const segments:RouthSegment[]=[],stickSlope=a*k/(1+k),slopeMargin=mu*b-stickSlope;
 const add=(kind:RouthSegment['kind'],sign:-1|0|1,dP:number,phi:number)=>{
  if(!(dP>0))reject(stop,'striker-impact-indeterminate',0,dP,'Compression segment has no positive impulse');
  const gammaA=nx*v+H*u,slipA=v-w,dF=phi*dP;
  v+=(nx*dP+dF)/m;w-=dF/(m*k);u+=H*dP/I;P+=dP;F+=dF;
  const gammaB=nx*v+H*u,slipB=v-w;
  // Each intermediate segment keeps ITS ending gamma. It need not be zero.
  const normalLoss=-.5*dP*(gammaA+gammaB),frictionLoss=-.5*dF*(slipA+slipB);
  if(normalLoss<0||frictionLoss< -closed*Math.abs(dF))reject(stop,'striker-impact-indeterminate',-Math.min(normalLoss,frictionLoss),0,'Signed impulse work is not dissipative');
  segments.push({kind,sign,dP,dF,gammaA,gammaB,slipA,slipB,normalLoss,frictionLoss});
 };
 if(ny===0){
  // The public PendulumCore first-impact method retains its own literal path.
  // This general horizontal moving-partner branch is independently comparable.
  const D=nx*nx/m+H*H/I;add('frictionless',0,-initialGamma/D,0);
 }else{
  let knownZero=input.floor==='roll',sigma:-1|1=initialSlip>0?1:-1;
  for(let segment=0;segment<2;segment++){
   const gamma=nx*v+H*u,slip=v-w;
   if(knownZero){
    if(Math.abs(slopeMargin)<=e.coneSlope)reject(stop,'striker-impact-indeterminate',Math.abs(slopeMargin),e.coneSlope,'Static impulse cone classification is unresolved');
    if(slopeMargin>0){
     const D=a*a/(m*(1+k))+H*H/I;if(!(D>0))reject(stop,'striker-impact-singular',0,D,'Stick branch inverse mass');
     add('stick',0,-gamma/D,stickSlope);break;
    }
    sigma=-1; // nx<0 makes the unrestrained emerging slip negative.
   }else if(Math.abs(slip)<=e.slip)reject(stop,'striker-impact-indeterminate',Math.abs(slip),e.slip,'Pre-impact slip sign is unresolved');
   const phi=-sigma*mu*b,D=a*a/m+H*H/I+sigma*mu*a*b/m;
   if(!(D>0))reject(stop,'striker-impact-singular',0,D,'Nonpositive slip-branch inverse mass');
   const ds=nx/m+(1+1/k)*phi/m,pEnd=-gamma/D,pSwitch=knownZero?Infinity:-slip/ds;
   if(!(pEnd>0))reject(stop,'striker-impact-indeterminate',0,pEnd,'No compressive e0 solution');
   if(pSwitch>0&&pSwitch<pEnd){
    if(Math.abs(pEnd-pSwitch)<=e.impulse)reject(stop,'striker-impact-indeterminate',Math.abs(pEnd-pSwitch),e.impulse,'Friction switch coincides with compression end');
    add('slip',sigma,pSwitch,phi);knownZero=true;continue;
   }
   add('slip',sigma,pEnd,phi);
   const finalSlip=v-w;if(!(sigma*finalSlip>e.slip))reject(stop,'striker-impact-indeterminate',sigma*finalSlip,e.slip,'Post-impact slip branch is inconsistent');
   break;
  }
 }
 const gammaAfter=nx*v+H*u,N=-P*ny,cone=mu*N-Math.abs(F),gammaRound=128*Number.EPSILON*Math.max(1,Math.abs(initialGamma),Math.abs(nx*v),Math.abs(H*u));
 if(!segments.length||Math.abs(gammaAfter)>gammaRound||!(P>0)||N<0||cone< -impactConeRoundoff(P,F,N,mu))reject(stop,'striker-impact-indeterminate',Math.abs(gammaAfter),gammaRound,'Compression/complementarity identity failed');
 const normalLoss=segments.reduce((sum,s)=>sum+s.normalLoss,0),frictionLoss=segments.reduce((sum,s)=>sum+s.frictionLoss,0),loss=normalLoss+frictionLoss;
 const kinetic=(v:number,w:number,u:number)=>.5*m*(v*v+k*w*w)+.5*I*u*u;
 const before=kinetic(input.v,input.w,input.u),residual=before-kinetic(v,w,u)-loss;
 assertContact(stop,'striker-impact','energy-balance',Math.abs(residual),128*Number.EPSILON*Math.max(1,before));
 if(loss<0)reject(stop,'striker-impact-indeterminate',-loss,0,'No loss clamp');
 const last=segments.at(-1)!,branch:ImpactBranch=segments.length>1?(last.kind==='stick'?'slip-then-stick':'slip-then-back'):last.kind==='frictionless'?'frictionless':last.kind==='stick'?'stick':last.sign<0?'slip-back':'slip-forward';
 return Object.freeze({gammaBefore:initialGamma,gammaAfter,normalImpulse:P,floorNormalImpulse:N,floorTangentImpulse:F,branch,coneMargin:cone,vAfter:v,wAfter:w,uAfter:u,hammerAngularImpulse:H*P,barImpulse:[-P*nx,-P*ny]as const,loss,normalLoss,frictionLoss,residual,segments:Object.freeze(segments)});
}
