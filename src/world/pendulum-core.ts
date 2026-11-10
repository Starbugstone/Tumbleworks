import{planarImpact}from'./pendulum-impact';
import { VillageAdmissibilityError, VILLAGE_CONTACT, assertContact } from './village-contact';
import { blankBarContact, bearingTorque, type PendulumDrive, type PendulumRate, type PendulumState, type NumericalPolicy, type PendulumSettle, type BarContact, type ImpactUncertainty, type PlanarImpactResult, type FeatureCell } from './pendulum-types';
import { PendulumProfile } from './pendulum-profile';
export const STRIKE_SPHERE=Object.freeze({mass:.02,radius:.3,kappa:.4});
export type StrikeMode=Readonly<{kind:'roll'}|{kind:'slip';sign:-1|1}>;
export interface PendulumMass {readonly mass:number;readonly axleInertia:number;readonly centre:readonly[number,number,number];readonly axialProducts:readonly[number,number]}
export interface PendulumImpact {readonly vBefore:number;readonly vAfter:number;readonly spin:number;readonly thetaDot:number;readonly effectivePartnerMass:number;readonly impulse:number;readonly loss:number;readonly floorNormalImpulse:0;readonly floorTangentImpulse:0}
/** Constant axle inertia, packed-profile planar contact, one partner coordinate.
 * No engine integration, rolling-factor impact mass or reaction clamp. */
export class PendulumCore {
 readonly torque:number;private readonly contact=blankBarContact();
 constructor(readonly stop:number,readonly drive:PendulumDrive,readonly body:PendulumMass,readonly profile:PendulumProfile){
  this.torque=bearingTorque(drive);
  if(body.mass!==drive.mass||!(body.axleInertia>body.mass*(body.centre[0]**2+body.centre[1]**2)))throw new VillageAdmissibilityError(stop,'striker-inertia','unsupported-contact-geometry',1,0);
 }
 potential(q:number):number{const c=this.body.centre;return this.body.mass*9.81*(c[0]*Math.sin(q)+c[1]*(Math.cos(q)-1));}
 potentialSlope(q:number):number{const c=this.body.centre;return this.body.mass*9.81*(c[0]*Math.cos(q)-c[1]*Math.sin(q));}
 impact(vBefore:number,spin:number):PendulumImpact{
  if(!(vBefore>0&&Number.isFinite(spin))||!this.profile.sample(0,this.contact))throw new VillageAdmissibilityError(this.stop,'striker-impact','unsupported-contact-geometry',1,0);
  const {nx,ny,J}=this.contact;
  if(nx!==-1||ny!==0||!(J<0))throw new VillageAdmissibilityError(this.stop,'striker-impact','impact-cone',Math.abs(ny),0,'Planar zero-floor-impulse impact requires the actual rest facet normal horizontal');
  const m=STRIKE_SPHERE.mass,M=this.body.axleInertia/(J*J),vAfter=m*vBefore/(m+M),thetaDot=nx*vAfter/J;
  const impulse=m*(vBefore-vAfter),loss=.5*m*vBefore**2-.5*m*vAfter**2-.5*this.body.axleInertia*thetaDot**2;
  assertContact(this.stop,'striker-impact','energy-balance',-loss,0);
  return Object.freeze({vBefore,vAfter,spin,thetaDot,effectivePartnerMass:M,impulse,loss,floorNormalImpulse:0,floorTangentImpulse:0});
 }
 impactAt(q:number,v:number,w:number,u:number,floor:'roll'|'slip',uncertainty:ImpactUncertainty,contact?:BarContact):PlanarImpactResult{
  const c=contact??this.contact;if(!contact&&!this.profile.sample(q,c))throw new VillageAdmissibilityError(this.stop,'striker-recontact','unsupported-contact-geometry',1,0);
  if(q===0&&u===0&&c.nx===-1&&c.ny===0){
   // Preserve the old literal first-impact computation, including its bits.
   const old=this.impact(v,w),gamma=-v;
   return{gammaBefore:gamma,gammaAfter:-old.vAfter+(-c.J)*old.thetaDot,normalImpulse:old.impulse,floorNormalImpulse:0,floorTangentImpulse:0,branch:'frictionless',coneMargin:0,vAfter:old.vAfter,wAfter:old.spin,uAfter:old.thetaDot,hammerAngularImpulse:-c.J*old.impulse,barImpulse:[old.impulse,0],loss:old.loss,normalLoss:old.loss,frictionLoss:0,residual:.5*STRIKE_SPHERE.mass*v*v-.5*STRIKE_SPHERE.mass*old.vAfter*old.vAfter-.5*this.body.axleInertia*old.thetaDot*old.thetaDot-old.loss,segments:[{kind:'frictionless',sign:0,dP:old.impulse,dF:0,gammaA:gamma,gammaB:-old.vAfter+(-c.J)*old.thetaDot,slipA:v-w,slipB:old.vAfter-w,normalLoss:old.loss,frictionLoss:0}]};
  }
  return planarImpact(this.stop,{q,nx:c.nx,ny:c.ny,first:c.first,v,w,u,floor,uncertainty},{mass:STRIKE_SPHERE.mass,kappa:STRIKE_SPHERE.kappa,axleInertia:this.body.axleInertia});
 }
 potentialCurvature(q:number):number{const c=this.body.centre;return this.body.mass*9.81*(-c[0]*Math.sin(q)-c[1]*Math.cos(q));}
 /** Return false only when the actual expanded polygon no longer intersects the
  * floor centreline. The event solver brackets that geometric release. */
 rate(state:PendulumState,mode:StrikeMode,out:PendulumRate):boolean{
  if(!this.profile.sample(state.q,this.contact))return false;
  return this.rateOnContact(state,mode,this.contact,out);
 }
 rateOnContact(state:PendulumState,mode:StrikeMode,c:BarContact,out:PendulumRate):boolean{
  const m=STRIKE_SPHERE.mass,k=STRIKE_SPHERE.kappa,I=this.body.axleInertia,mu=VILLAGE_CONTACT.mu,gn=9.81;
  if(!(c.first>0)||c.nx>=0||c.ny>0)throw new VillageAdmissibilityError(this.stop,'striker-contact','unsupported-contact-geometry',1,0,'Actual facet normal/frame leaves supported push model');
  const H=-c.J,U=this.potentialSlope(state.q)+this.torque;
  const f0=mode.kind==='slip'?-mu*mode.sign*m*gn:0;
  const fLambda=mode.kind==='slip'?mu*mode.sign*c.ny:0;
  const effective=mode.kind==='roll'?m*(1+k):m;
  const denominator=effective*c.first*H/I-c.nx-fLambda;
  if(!(denominator>0))throw new VillageAdmissibilityError(this.stop,'striker-contact','unsupported-contact-geometry',1,0,'Singular unilateral coupling');
  const lambda=(f0-effective*c.second*state.u**2+effective*c.first*U/I)/denominator;
  const angular=(H*lambda-U)/I,acceleration=c.second*state.u**2+c.first*angular;
  const normal=m*gn-lambda*c.ny,friction=mode.kind==='roll'?-m*k*acceleration:f0+fLambda*lambda;
  out.q=state.u;out.u=angular;out.w=mode.kind==='roll'?acceleration:-friction/(m*k);out.angle=(mode.kind==='roll'?c.first*state.u:state.w)/STRIKE_SPHERE.radius;
  out.slipWork=mode.kind==='roll'?0:-friction*(c.first*state.u-state.w);out.contactWork=lambda*c.nx*c.first*state.u;
  out.lambda=lambda;out.normal=normal;out.friction=friction;out.acceleration=acceleration;out.slip=mode.kind==='roll'?0:c.first*state.u-state.w;
  // Signed results are returned intact for deterministic event bracketing.
  // Negative lambda is a separation event, never clamped into acceptance.
  return true;
 }
 stickMode(state:PendulumState,scratch:PendulumRate):StrikeMode{
  if(!this.rate(state,{kind:'roll'},scratch))throw new VillageAdmissibilityError(this.stop,'striker-clear','unsupported-contact-geometry',1,0);
  if(Math.abs(scratch.friction)<=VILLAGE_CONTACT.mu*scratch.normal)return {kind:'roll'};
  return {kind:'slip',sign:scratch.friction<0?1:-1};
 }
 assertPush(rate:PendulumRate):void{
  assertContact(this.stop,'striker-push','head-compressive',-rate.lambda,0);
  assertContact(this.stop,'striker-push','support-normal',Number.EPSILON,rate.normal);
  assertContact(this.stop,'striker-push','floor-cone',Math.abs(rate.friction),VILLAGE_CONTACT.mu*rate.normal);
  assertContact(this.stop,'striker-push','energy-balance',-rate.slipWork,0);
 }
 /** Sufficient obstruction for the actual last rounded VERTEX contact cell.
  * This predicts a rejection only: no clear endpoint/actor state is created.
  * If rolling stays compressive through clear, Cprime→infinity and finite
  * marble energy imply u→0 before the remaining strictly positive bell work. */
 clearLimitStall(cell:FeatureCell,clear:readonly[number,number]|undefined,initialEnergy:number,startQ:number,energyError:number){
  const p=this.profile,n=p.xy.length/2,R=p.radius;
  if(cell.kind!=='vertex'||cell.feature<n||!clear||clear[0]!==cell.end[0]||clear[1]!==cell.end[1])return;
  const i=cell.feature%n,x=p.xy[2*i]!,y=p.xy[2*i+1]!,c=this.body.centre,curvature=this.body.mass*9.81*(-c[1]*Math.cos(this.drive.stopAngle)-Math.abs(c[0]));
  if(!(x<0&&y<0&&curvature>0))return;
  const py=(q:number)=>p.axleY+x*Math.sin(q)+y*Math.cos(q),dy=(q:number)=>x*Math.cos(q)-y*Math.sin(q),ddy=(q:number)=>-x*Math.sin(q)-y*Math.cos(q);
  const libm=128*Number.EPSILON*Math.max(1,Math.abs(x),Math.abs(y),p.axleY),dq=libm/dy(cell.q0),a=cell.q0-dq,b=cell.end[1]+dq;
  if(!(a>0&&b<this.drive.stopAngle&&dy(a)>0&&ddy(b)>0&&py(cell.end[0])<=R+libm&&py(cell.end[1])>=R-libm))return;
  const pyMin=py(a)-libm,dyMin=dy(a)-libm,dyMax=dy(b)+libm,ddyMax=ddy(a)+libm,s2=R*R-pyMin*pyMin;
  if(!(pyMin>0&&s2>0&&dyMin>0))return;
  const sMax=Math.sqrt(s2),ratio=((dyMax*dyMax+R*ddyMax)*s2+R*R*dyMax*dyMax)/(pyMin*dyMin)**3;
  // C''/C'^3 is bounded without evaluating the singular derivatives: multiply
  // both by s^3, drop the negative x'' term, and bound (x's+yy')^3 below.
  const Emax=initialEnergy+energyError-this.potential(a)-this.torque*(a-startQ),Umin=this.potentialSlope(a)+this.torque,m=STRIKE_SPHERE.mass*(1+STRIKE_SPHERE.kappa),I=this.body.axleInertia;
  const compressive=Umin*m-2*I*Emax*ratio,cone=VILLAGE_CONTACT.mu*pyMin-STRIKE_SPHERE.kappa/(1+STRIKE_SPHERE.kappa)*sMax,remaining=this.potential(this.drive.stopAngle)-this.potential(b)+this.torque*(this.drive.stopAngle-b),round=128*Number.EPSILON*Math.max(1,initialEnergy,Math.abs(Umin*m),Math.abs(2*I*Emax*ratio));
  if(!(Emax>0&&compressive>round&&cone>round&&remaining>round))return;
  return{model:'actual-packed-vertex-clear-stall',cell:cell.index,feature:cell.feature,vertex:[x,y],qEntry:cell.q0,qClear:[cell.end[0]-dq,b],pyMin,dyMin,dyMax,ddyMax,ratioBound:ratio,energyUpper:Emax,energyError,compressiveLower:compressive-round,coneLower:cone-round,remainingWorkLower:remaining-round,limit:'finite total energy and Cprime divergence imply angular speed tends0',conditional:'actual causally-entered rolling branch; no release because both compression and cone stay strict',rigorous:false,roundingModel:'analytic interval inequalities with explicit128eps libm observation model; prefix convergence reported separately'}as const;
 }
 /** Actual Newton/Euler radial wrench. Rotation is about z; the nonzero COMz
  * and xz/yz products produce Mx/My even though EVERY axial load term is zero.
  * Angular Coulomb torque is kept out of this radial bearing reaction. */
 bearingWrench(q:number,u:number,angular:number,lambda:number){
  if(!this.profile.sample(q,this.contact)&&lambda!==0)throw new Error('Bearing contact load lost its profile');
  const c=Math.cos(q),s=Math.sin(q),body=this.body,m=body.mass,rx=c*body.centre[0]-s*body.centre[1],ry=s*body.centre[0]+c*body.centre[1];
  const xz=c*body.axialProducts[0]-s*body.axialProducts[1],yz=s*body.axialProducts[0]+c*body.axialProducts[1];
  const force=[m*(-angular*ry-u*u*rx)+lambda*this.contact.nx,m*(angular*rx-u*u*ry)+m*9.81+lambda*this.contact.ny,0]as const;
  const moment=[-xz*angular+yz*u*u-m*9.81*body.centre[2],-yz*angular-xz*u*u,0]as const;
  return{force,moment,axialTerms:[m*0,lambda*0,m*9.81*0]};
 }
 bearingImpulse(q:number,deltaU:number,impulse:readonly[number,number],contactZ:number){
  const c=Math.cos(q),s=Math.sin(q),body=this.body,m=body.mass,rx=c*body.centre[0]-s*body.centre[1],ry=s*body.centre[0]+c*body.centre[1];
  const xz=c*body.axialProducts[0]-s*body.axialProducts[1],yz=s*body.axialProducts[0]+c*body.axialProducts[1];
  return{force:[-m*deltaU*ry-impulse[0],m*deltaU*rx-impulse[1],0]as const,moment:[-xz*deltaU+contactZ*impulse[1],-yz*deltaU-contactZ*impulse[0],0]as const,axialTerms:[m*0,0]};
 }
 /** One passive dry-friction arc after an e0 bell impact, or the same bearing's
  * static hold. No authored timing, new coefficient or geometry participates. */
 settle(bellTime:number,bellSpeed:number,policy:NumericalPolicy):PendulumSettle{
  const s=this.drive.stopAngle,I=this.body.axleInertia,G=this.potentialSlope(s),tau=this.torque;
  const delta=this.body.mass*9.81*(2**-24*Math.max(1,...this.body.centre.map(Math.abs))+128*Number.EPSILON)+128*Number.EPSILON*Math.max(1,tau);
  const bell=Object.freeze({time:bellTime,speed:bellSpeed,impulse:I*bellSpeed,loss:.5*I*bellSpeed*bellSpeed,restitution:0 as const});
  if(!(bellSpeed>0))throw new VillageAdmissibilityError(this.stop,'striker-stall-before-stop','drive-force',0,bellSpeed);
  const rest=(kind:'bell-hold'|'return-stick',q:number,time:number,returnBearingWork:number,potentialDrop:number)=>{
   const gravitySlope=this.potentialSlope(q),margin=tau-Math.abs(gravitySlope)-delta;
   if(!(margin>0))throw new VillageAdmissibilityError(this.stop,'striker-settle-indeterminate','hold-bound',Math.abs(gravitySlope)+delta,tau);
   return Object.freeze({kind,q,time,gravitySlope,capacity:tau,margin,work:0 as const,stopReaction:0 as const,site:'axle-bearing' as const,returnBearingWork,potentialDrop});
  };
  if(Math.abs(G)<tau-delta)return{bell,rest:rest('bell-hold',s,bellTime,0,0),rows:new Float64Array(),certificate:{minimumCurvature:0,leavesBell:false,cannotReachRest:tau*s-this.potential(s),qStar:s,delta,rootBracket:[s,s],rootResidual:0}};
  if(G<=tau+delta)throw new VillageAdmissibilityError(this.stop,'striker-settle-indeterminate','hold-bound',Math.abs(G)+delta,tau);
  if(!(s>0&&s<Math.PI/2))throw new VillageAdmissibilityError(this.stop,'striker-return-potential','unsupported-contact-geometry',1,0);
  const c=this.body.centre,curvature=(q:number)=>this.body.mass*9.81*(-c[0]*Math.sin(q)-c[1]*Math.cos(q));
  // On this first-quadrant sector the conservative trigonometric lower bound
  // includes the complete interval, not only a sampled endpoint.
  const minimumCurvature=this.body.mass*9.81*(-c[1]*Math.cos(s)-Math.abs(c[0]));
  if(!(minimumCurvature>delta))throw new VillageAdmissibilityError(this.stop,'striker-return-potential','drive-force',delta,minimumCurvature);
  const cannotReachRest=tau*s-(this.potential(s)-this.potential(0));
  if(!(cannotReachRest>delta*s))throw new VillageAdmissibilityError(this.stop,'striker-return-past-rest','energy-balance',this.potential(s)-this.potential(0),tau*s);
  let lo=0,hi=s;for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(mid===lo||mid===hi)break;if(this.potentialSlope(mid)<tau)lo=mid;else hi=mid;}const qStar=(lo+hi)/2;
  const sinc=(x:number)=>x===0?1:Math.sin(x)/x;
  const f=(q:number)=>{const distance=s-q,mid=(s+q)/2;return distance*(this.body.mass*9.81*(c[0]*Math.cos(mid)-c[1]*Math.sin(mid))*sinc(distance/2)-tau);};
  lo=0;hi=qStar;for(let i=0;i<100;i++){const mid=(lo+hi)/2;if(mid===lo||mid===hi)break;if(f(mid)<0)lo=mid;else hi=mid;}
  const bracket=[lo,hi]as const,b=Math.abs(f(lo))<=Math.abs(f(hi))?lo:hi,residual=f(b),closed=128*Number.EPSILON*Math.max(1,this.potential(s));
  assertContact(this.stop,'striker-return-root','energy-balance',Math.abs(residual),closed);
  // f(q)=(s-q)(q-b)A(q). A is an average of U'', so this
  // endpoint-regularized time integrand has no 0/0 or endpoint cancellation.
  // The adjacent-double root error and quadrature differences remain labelled
  // estimates; the closed root residual above is reported independently.
  const A=(q:number,rule:readonly(readonly[number,number])[])=>gauss(rule,0,1,t=>gauss(rule,0,1,v=>(1-v)*curvature(b+t*(q-b)+v*(s-b-t*(q-b)))));
  const angle=(phi:number)=>b+(s-b)*(1+Math.cos(phi))/2;
  const integrand=(phi:number,rule:readonly(readonly[number,number])[])=>Math.sqrt(I/(2*A(angle(phi),rule)));
  let previous=Infinity;
  for(let level=0;level<=policy.maxHalvings;level++){
   const panels=16*2**level;if(panels>policy.maxSteps)break;
   const rows=new Float64Array((panels+1)*3);rows[0]=bellTime;rows[1]=s;rows[2]=0;
   let time=0,reference=0,qError=0,uError=0;
   for(let i=0;i<panels;i++){
    const a=Math.PI*i/panels,z=Math.PI*(i+1)/panels,mid=(a+z)/2,dt=gauss(GL4,a,z,p=>integrand(p,GL4));
    reference+=gauss(GL8,a,z,p=>integrand(p,GL8));
    const q=i+1===panels?b:angle(z),energy=i+1===panels?0:f(q);
    if(energy<0)throw new VillageAdmissibilityError(this.stop,'striker-return-numerical-energy','energy-balance',-energy,0);
    const u=i+1===panels?0:-Math.sqrt(2*energy/I),offset=(i+1)*3;
    rows[offset]=bellTime+time+dt;rows[offset+1]=q;rows[offset+2]=u;
    const tm=bellTime+time+gauss(GL8,a,mid,p=>integrand(p,GL8)),qm=angle(mid),um=-Math.sqrt(2*f(qm)/I),start=i*3;
    const qi=arcHermite(rows[start+1]!,q,rows[start+2]!,u,rows[start]!,rows[offset]!,tm),ui=arcHermiteDerivative(rows[start+1]!,q,rows[start+2]!,u,rows[start]!,rows[offset]!,tm);
    qError=Math.max(qError,Math.abs(qi-qm));uError=Math.max(uError,Math.abs(ui-um));time+=dt;
   }
   const difference=Math.abs(time-previous),referenceDifference=Math.abs(time-reference);
   if(level>=1&&difference<=policy.eventTimeEstimate&&referenceDifference<=policy.eventTimeEstimate&&qError<=policy.stateTargets.q&&uError<=policy.stateTargets.u){
    const final=rest('return-stick',b,bellTime+time,tau*(s-b),this.potential(s)-this.potential(b));
    return{bell,rest:final,rows,report:{status:'observed-convergence-estimate',panels,differenceSeconds:difference,referenceDifferenceSeconds:referenceDifference,interpolation:{q:qError,u:uError},rigorous:false},certificate:{minimumCurvature,leavesBell:true,cannotReachRest,qStar,delta,rootBracket:bracket,rootResidual:residual}};
   }
   previous=time;
  }
  throw new VillageAdmissibilityError(this.stop,'striker-return-numerical-convergence','unsupported-contact-geometry',1,0,'Fixed time/interpolation targets not met');
 }
 /** Exact closed identity: static bearing supports signed gravity torque, does
  * no work, and does not borrow a tensile reaction from the fixed stop. */
 hold():Readonly<{site:'bearing-static';required:number;capacity:number;reaction:number;work:0;stopReaction:0}>{
  return bearingStaticHold(this.stop,this.potentialSlope(this.drive.stopAngle),this.torque);
 }
}
export function bearingStaticHold(stop:number,gravitySlope:number,capacity:number){
 if(!Number.isFinite(gravitySlope)||!(capacity>=0))throw new VillageAdmissibilityError(stop,'striker-hold','unsupported-contact-geometry',1,0);
 if(Math.abs(gravitySlope)>capacity)throw new VillageAdmissibilityError(stop,'striker-hold','hold-bound',Math.abs(gravitySlope),capacity,'Fixed bell stop has no reverse reaction; bearing static cone failed');
 return Object.freeze({site:'bearing-static' as const,required:Math.abs(gravitySlope),capacity,reaction:gravitySlope,work:0 as const,stopReaction:0 as const});
}

export const GL4=Object.freeze([[-.8611363115940526,.3478548451374538],[-.3399810435848563,.6521451548625461],[.3399810435848563,.6521451548625461],[.8611363115940526,.3478548451374538]]as const);
export const GL8=Object.freeze([[-.9602898564975363,.1012285362903763],[-.7966664774136267,.2223810344533745],[-.525532409916329,.3137066458778873],[-.1834346424956498,.362683783378362],[.1834346424956498,.362683783378362],[.525532409916329,.3137066458778873],[.7966664774136267,.2223810344533745],[.9602898564975363,.1012285362903763]]as const);
export function gauss(rule:readonly(readonly[number,number])[],a:number,b:number,f:(x:number)=>number):number{const middle=(a+b)/2,half=(b-a)/2;let sum=0;for(const[x,w]of rule)sum+=w*f(middle+half*x);return half*sum;}
export function arcHermite(a:number,b:number,va:number,vb:number,t0:number,t1:number,time:number):number{const h=t1-t0;if(h===0)return b;const u=(time-t0)/h;return(2*u**3-3*u*u+1)*a+(u**3-2*u*u+u)*h*va+(-2*u**3+3*u*u)*b+(u**3-u*u)*h*vb;}
export function arcHermiteDerivative(a:number,b:number,va:number,vb:number,t0:number,t1:number,time:number):number{const h=t1-t0;if(h===0)return vb;const u=(time-t0)/h;return((6*u*u-6*u)*a+(3*u*u-4*u+1)*h*va+(-6*u*u+6*u)*b+(3*u*u-2*u)*h*vb)/h;}
