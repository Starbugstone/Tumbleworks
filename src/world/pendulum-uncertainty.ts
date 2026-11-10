import{STRIKE_SPHERE,type PendulumCore,type StrikeMode}from'./pendulum-core';
import type{PendulumProfile}from'./pendulum-profile';
import{profileDerivativeRange,range,trig,nextFloat,type Range}from'./pendulum-cells';
import{blankBarContact,type FeaturePartition,type StrikeState,type StrikeError,type MarbleFree,type PlanarImpactResult}from'./pendulum-types';
import{VillageAdmissibilityError,VILLAGE_CONTACT}from'./village-contact';
/** Constructor-only interval operators. Units follow StrikeError. Outward
 * Float64 operations and the declared64eps libm model are conditional numerical
 * enclosures, not unconditional exact-real certificates or physical epsilons. */
export const point=(x:number):Range=>[x,x];
export const box=(x:number,e:number):Range=>{if(!(e>=0&&Number.isFinite(x)&&Number.isFinite(e)))throw new Error('Invalid uncertainty box');return e===0?[x,x]:[nextFloat(x-e,-1),nextFloat(x+e,1)];};
export const hull=(a:Range,b:Range):Range=>[Math.min(a[0],b[0]),Math.max(a[1],b[1])];
export const sub=(a:Range,b:Range):Range=>range.add(a,range.neg(b));
export const scale=(a:Range,b:number):Range=>range.mul(a,point(b));
export const square=(a:Range):Range=>a[0]<=0&&a[1]>=0?[0,nextFloat(Math.max(a[0]**2,a[1]**2),1)]:[nextFloat(Math.min(a[0]**2,a[1]**2),-1),nextFloat(Math.max(a[0]**2,a[1]**2),1)];
export const radius=(a:Range,x:number):number=>Math.max(Math.abs(a[0]-x),Math.abs(a[1]-x));
export const absolute=(a:Range):Range=>a[0]<=0&&a[1]>=0?[0,Math.max(-a[0],a[1])]:[Math.min(Math.abs(a[0]),Math.abs(a[1])),Math.max(Math.abs(a[0]),Math.abs(a[1]))];
function fail(stop:number,detail:string):never{throw new VillageAdmissibilityError(stop,'striker-uncertainty-domain','unsupported-contact-geometry',1,0,detail);}
export interface GeometryBox{readonly q:Range;readonly feature:number;readonly x:Range;readonly first:Range;readonly second:Range;readonly nx:Range;readonly ny:Range;readonly H:Range}
export function featureBox(profile:PendulumProfile,feature:number,a:number,b:number):GeometryBox{
 if(!(a<=b))throw new Error('Empty feature uncertainty domain');
 if(a===b){const c=blankBarContact();if(!profile.sampleFeature(feature,a,c,true))throw new Error('Feature point leaves contact domain');return{q:[a,b],feature,x:point(c.x),first:point(c.first),second:point(c.second),nx:point(c.nx),ny:point(c.ny),H:point(-c.J)};}
 const n=profile.xy.length/2,i=feature%n,j=(i+1)%n,x=profile.xy[2*i]!,y=profile.xy[2*i+1]!,s=trig(a,b),c=trig(a,b,true),jet=profileDerivativeRange(profile,feature,a,b,2);let nx:Range,ny:Range,H:Range;
 if(feature<n){const dx=profile.xy[2*j]!-x,dy=profile.xy[2*j+1]!-y,L=Math.hypot(dx,dy),nx0=dy/L,ny0=-dx/L,K=profile.radius+nx0*x+ny0*y;nx=sub(scale(c,nx0),scale(s,ny0));ny=range.add(scale(s,nx0),scale(c,ny0));H=range.neg(range.div(range.add(point(profile.axleY),scale(ny,K)),nx));}
 else{const px= sub(scale(c,x),scale(s,y)),py=range.add(point(profile.axleY),range.add(scale(s,x),scale(c,y))),d2=sub(point(profile.radius**2),square(py));if(!(d2[0]>0))throw new Error('Vertex q box touches geometric clear');const d:Range=[nextFloat(Math.sqrt(d2[0]),-1),nextFloat(Math.sqrt(d2[1]),1)];nx=scale(d,-1/profile.radius);ny=scale(py,-1/profile.radius);const vx=range.neg(sub(py,point(profile.axleY)));H=scale(range.add(range.mul(d,vx),range.mul(py,px)),1/profile.radius);}
 return{q:[a,b],feature,x:jet[0]!,first:jet[1]!,second:jet[2]!,nx,ny,H};
}
/** A q box crossing an ordinary joint includes BOTH actual one-sided formulas.
 * A named phase-side restriction is allowed only at its certified cell. Clear,
 * absent contact or an unknown side is indeterminate, never silently extended. */
export function geometryBoxes(stop:number,profile:PendulumProfile,partition:FeaturePartition,q:number,e:number,feature?:number):readonly GeometryBox[]{
 const a=q-e,b=q+e;if(!(e>=0&&Number.isFinite(a)&&Number.isFinite(b))||a<0||b>partition.stop||partition.clear&&b>=partition.clear[0])fail(stop,'q uncertainty leaves the finite packed contact domain');
 const result:GeometryBox[]=[];
 try{for(const cell of partition.cells){if(feature!==undefined&&cell.feature!==feature)continue;const lo=Math.max(a,cell.start[0]),hi=Math.min(b,cell.end[1]);if(lo<=hi)result.push(featureBox(profile,cell.feature,lo,hi));}}
 catch(error){fail(stop,error instanceof Error?error.message:'Unresolved actual profile interval');}
 if(!result.length)fail(stop,'No actual feature covers the q box');return result;
}
export function approachBounds(g:GeometryBox,v:Range,u:Range):Range{return range.add(range.mul(g.nx,v),range.mul(g.H,u));}
export function impactInputError(core:PendulumCore,state:StrikeState,partition:FeaturePartition){
 const c=blankBarContact();if(!core.profile.sample(state.q,c))fail(core.stop,'Impact centre lacks contact');const nominal=c.nx*state.v-c.J*state.u,slope=VILLAGE_CONTACT.mu*(-c.ny)-(-c.nx)*STRIKE_SPHERE.kappa/(1+STRIKE_SPHERE.kappa);let gamma=0,coneSlope=0;
 const domains=geometryBoxes(core.stop,core.profile,partition,state.q,state.error.q);for(const g of domains){gamma=Math.max(gamma,radius(approachBounds(g,box(state.v,state.error.v),box(state.u,state.error.u)),nominal));coneSlope=Math.max(coneSlope,radius(sub(scale(g.ny,-VILLAGE_CONTACT.mu),scale(g.nx,-STRIKE_SPHERE.kappa/(1+STRIKE_SPHERE.kappa))),slope));}
 if(!(nominal< -gamma))throw new VillageAdmissibilityError(core.stop,'striker-reattach-indeterminate','impact-cone',nominal,-gamma);
 return{domains,error:{gamma,coneSlope,slip:state.floor==='roll'?0:state.error.v+state.error.w,impulse:state.error.energy/(Math.abs(nominal)-gamma)}};
}
/** Interval evaluation of the actual selected Routh segments. Corner probes
 * remain observations; they cannot replace this whole-input-box branch gate. */
export function impactOutputBounds(core:PendulumCore,state:StrikeState,result:PlanarImpactResult,domains:readonly GeometryBox[]){
 let V:Range|undefined,W:Range|undefined,U:Range|undefined;
 const m=STRIKE_SPHERE.mass,k=STRIKE_SPHERE.kappa,I=core.body.axleInertia,mu=VILLAGE_CONTACT.mu;
 const reject=(detail:string):never=>{throw new VillageAdmissibilityError(core.stop,'striker-impact-indeterminate','impact-cone',1,0,detail);};
 for(const g of domains){let v=box(state.v,state.error.v),w=state.floor==='roll'?v:box(state.w,state.error.w),u=box(state.u,state.error.u);const a=range.neg(g.nx),b=range.neg(g.ny),stick=scale(a,k/(1+k)),margin=sub(scale(b,mu),stick),H2=scale(square(g.H),1/I);
  for(let i=0;i<result.segments.length;i++){const segment=result.segments[i]!,gamma=approachBounds(g,v,u),slip=sub(v,w),last=i===result.segments.length-1;let P:Range,phi:Range;
   if(segment.kind==='frictionless'){if(g.ny[0]!==0||g.ny[1]!==0)reject('Horizontal impulse domain contains tilted contact');phi=point(0);P=range.div(range.neg(gamma),range.add(scale(square(a),1/m),H2));}
   else if(segment.kind==='stick'){if(!(margin[0]>0))reject('Static impulse branch changes in the q box');phi=stick;P=range.div(range.neg(gamma),range.add(scale(square(a),1/(m*(1+k))),H2));}
   else{phi=scale(b,-segment.sign*mu);if(i===0&&state.floor!=='roll'&&!(scale(slip,segment.sign)[0]>0))reject('Uncertain initial impulse slip sign');if(i>0&&!(margin[1]<0))reject('Emerging back-slip branch changes in the q box');const D=range.add(range.add(scale(square(a),1/m),H2),scale(range.mul(a,b),segment.sign*mu/m));if(!(D[0]>0))reject('Impulse inverse-mass domain is singular');
    if(last)P=range.div(range.neg(gamma),D);else{const ds=range.add(scale(g.nx,1/m),scale(phi,(1+1/k)/m));if(ds[0]<=0&&ds[1]>=0)reject('Impulse slip-zero denominator unresolved');P=range.div(range.neg(slip),ds);}
   }
   if(!(P[0]>0))reject('Impulse segment positivity is unresolved');const F=range.mul(phi,P);v=range.add(v,scale(range.add(range.mul(g.nx,P),F),1/m));w=sub(w,scale(F,1/(m*k)));u=range.add(u,scale(range.mul(g.H,P),1/I));
   if(!last){if(!(approachBounds(g,v,u)[1]<0))reject('Slip-zero and compression-end ordering unresolved');const common:Range=[Math.max(v[0],w[0]),Math.min(v[1],w[1])];if(common[0]>common[1])reject('Slip-zero equations have disjoint intervals');v=w=common;}
   else if(segment.kind==='slip'&&!(scale(sub(v,w),segment.sign)[0]>0))reject('Post-impact slip sign is unresolved');
  }
  V=V?hull(V,v):v;W=W?hull(W,w):w;U=U?hull(U,u):u;
 }
 if(!V||!W||!U)reject('Empty impact domain');return{v:V!,w:W!,u:U!};
}
export function loadBounds(core:PendulumCore,partition:FeaturePartition,state:Pick<StrikeState,'q'|'u'|'w'>,error:Pick<StrikeError,'q'|'u'|'w'>,mode:StrikeMode,feature?:number){
 const m=STRIKE_SPHERE.mass,k=STRIKE_SPHERE.kappa,I=core.body.axleInertia,mu=VILLAGE_CONTACT.mu,effective=mode.kind==='roll'?m*(1+k):m,u=box(state.u,error.u);let L:Range|undefined,N:Range|undefined,F:Range|undefined;
 for(const g of geometryBoxes(core.stop,core.profile,partition,state.q,error.q,feature)){const sin=trig(g.q[0],g.q[1]),cos=trig(g.q[0],g.q[1],true),U=range.add(scale(sub(scale(cos,core.body.centre[0]),scale(sin,core.body.centre[1])),core.body.mass*9.81),point(core.torque)),f0=mode.kind==='slip'?-mu*mode.sign*m*9.81:0,fl=mode.kind==='slip'?scale(g.ny,mu*mode.sign):point(0),D=sub(sub(scale(range.mul(g.first,g.H),effective/I),g.nx),fl);if(!(D[0]>0))fail(core.stop,'Contact inverse-mass box reaches zero');
  const lambda=range.div(range.add(sub(point(f0),scale(range.mul(g.second,square(u)),effective)),scale(range.mul(g.first,U),effective/I)),D),alpha=scale(sub(range.mul(g.H,lambda),U),1/I),acc=range.add(range.mul(g.second,square(u)),range.mul(g.first,alpha)),normal=sub(point(m*9.81),range.mul(lambda,g.ny)),friction=mode.kind==='roll'?scale(acc,-m*k):range.add(point(f0),range.mul(fl,lambda));L=L?hull(L,lambda):lambda;N=N?hull(N,normal):normal;F=F?hull(F,friction):friction;}
 return{lambda:L!,normal:N!,friction:F!,cone:sub(scale(N!,mu),absolute(F!))};
}
export function contactVelocityError(core:PendulumCore,partition:FeaturePartition,q:number,u:number,eQ:number,eU:number):number{let e=0;const c=blankBarContact();if(!core.profile.sample(q,c))fail(core.stop,'Contact velocity centre absent');for(const g of geometryBoxes(core.stop,core.profile,partition,q,eQ))e=Math.max(e,radius(range.mul(g.first,box(u,eU)),c.first*u));return e;}
/** m / (m/rad) = rad. No geometric radius in metres replaces |nx|. */
export function rootCoordinateError(gapMetres:number,nxMagnitude:number,uRadiansPerSecond:number,gammaMetresPerSecond:number):number{if(!(gapMetres>=0&&nxMagnitude>0&&uRadiansPerSecond>0&&gammaMetresPerSecond>0))throw new Error('Indeterminate root conditioning');return gapMetres*nxMagnitude*uRadiansPerSecond/gammaMetresPerSecond;}
export function freeMarbleBounds(start:MarbleFree,e:Pick<StrikeError,'x'|'v'|'w'|'angle'|'time'>,time:number,timeError:number,stop=-1){
 const elapsed=box(time-start.time,timeError+e.time),dt:Range=[Math.max(0,elapsed[0]),Math.max(0,elapsed[1])],v=box(start.v,e.v),w=box(start.w,e.w),x=box(start.x,e.x),angle=box(start.angle,e.angle),k=STRIKE_SPHERE.kappa,R=STRIKE_SPHERE.radius;
 if(start.floor==='roll'){const velocity=hull(v,w);return{x:range.add(x,range.mul(velocity,dt)),v:velocity,w:velocity,angle:range.add(angle,scale(range.mul(velocity,dt),1/R))};}
 const slip=sub(v,w),sign=start.v>start.w?1:-1;if(!(scale(slip,sign)[0]>0))throw new VillageAdmissibilityError(stop,'striker-free-indeterminate','unsupported-contact-geometry',1,0,'Uncertain free-marble slip sign');const a=-VILLAGE_CONTACT.mu*9.81*sign,duration=scale(slip,-1/(a*(1+1/k))),rolling=scale(range.add(v,scale(w,k)),1/(1+k));
 const sliding=(t:Range)=>({x:range.add(x,range.add(range.mul(v,t),scale(square(t),a/2))),v:range.add(v,scale(t,a)),w:sub(w,scale(t,a/k)),angle:range.add(angle,scale(sub(range.mul(w,t),scale(square(t),a/(2*k))),1/R))});
 const rolled=(t:Range)=>{const after=sub(t,duration),tail:Range=[Math.max(0,after[0]),Math.max(0,after[1])],travel=range.mul(rolling,tail);return{x:range.add(x,range.add(range.add(range.mul(v,duration),scale(square(duration),a/2)),travel)),v:rolling,w:rolling,angle:range.add(angle,scale(range.add(sub(range.mul(w,duration),scale(square(duration),a/(2*k))),travel),1/R))};};
 if(dt[1]<duration[0])return sliding(dt);if(dt[0]>duration[1])return rolled(dt);const a0=sliding([dt[0],Math.min(dt[1],duration[1])]),b0=rolled([Math.max(dt[0],duration[0]),dt[1]]);return{x:hull(a0.x,b0.x),v:hull(a0.v,b0.v),w:hull(a0.w,b0.w),angle:hull(a0.angle,b0.angle)};
}
/** Left-first coverage of a finite feature cell. Every discarded interval has
 * a positive gap enclosure or a strictly signed derivative. Samples choose
 * subdivision only. Exhausted work/adjacent doubles are indeterminate. */
export function coverApproach(stop:number,a:number,b:number,gap:(q:number)=>number,derivative:(a:number,b:number)=>Range,use:()=>void,receipt:{intervals:number;positive:number;monotone:number},enclosure?:(a:number,b:number)=>Range):Range|undefined{
 const stack:Range[]=[[a,b]];
 while(stack.length){const [lo,hi]=stack.pop()!;use();receipt.intervals++;if(enclosure&&enclosure(lo,hi)[0]>0){receipt.positive++;continue;}const gl=gap(lo),gh=gap(hi);let d:Range;try{d=derivative(lo,hi);}catch(error){throw new VillageAdmissibilityError(stop,'striker-root-indeterminate','unsupported-contact-geometry',1,0,error instanceof Error?error.message:'Feature derivative domain unresolved');}
  if(!(Number.isFinite(gl)&&Number.isFinite(gh)&&Number.isFinite(d[0])&&Number.isFinite(d[1])&&d[0]<=d[1]))throw new VillageAdmissibilityError(stop,'striker-root-indeterminate','unsupported-contact-geometry',1,0,'Nonfinite finite-cell enclosure');
  if(d[0]>0&&gl>0||d[1]<0&&gh>0){receipt.monotone++;continue;}
  if(d[1]<0&&gl>0&&gh<=0){let l=lo,r=hi;for(let i=0;i<100;i++){use();const m=(l+r)/2;if(m===l||m===r)break;if(gap(m)>0)l=m;else r=m;}return[l,r];}
  const mid=(lo+hi)/2,gm=gap(mid),g=range.add(point(gm),range.mul(d,[lo-mid,hi-mid]));
  if(g[0]>0){receipt.positive++;continue;}
  if(mid===lo||mid===hi)throw new VillageAdmissibilityError(stop,'striker-root-indeterminate','unsupported-contact-geometry',gl,gh,'Grazing/hidden root cannot be classified at adjacent doubles');
  stack.push([mid,hi],[lo,mid]);
 }
 return;
}
/** Signed distance to the actual convex polygon is 1-Lipschitz under point
 * translation and Hausdorff motion. rMax*dq is an operator norm for rotating
 * its packed vertices; it is NOT a nominal circular contact surface. */
export function clearanceLower(profile:PendulumProfile,q:Range,x:Range):number{
 const qm=(q[0]+q[1])/2,xm=(x[0]+x[1])/2;let r=0;for(let i=0;i<profile.xy.length;i+=2)r=Math.max(r,Math.hypot(profile.xy[i]!,profile.xy[i+1]!));
 const round=64*Number.EPSILON*(1+Math.abs(xm)+Math.abs(profile.axleX)+Math.abs(profile.axleY)+r);
 return nextFloat(profile.clearance(qm,xm)-r*radius(q,qm)-radius(x,xm)-round,-1);
}
export function coverClearance(stop:number,a:number,b:number,lower:(a:number,b:number)=>number,use:()=>void):number{
 const stack:Range[]=[[a,b]];let count=0;while(stack.length){const [lo,hi]=stack.pop()!;use();count++;if(lower(lo,hi)>0)continue;const mid=(lo+hi)/2;if(mid===lo||mid===hi)throw new VillageAdmissibilityError(stop,'striker-postbell-indeterminate','unsupported-contact-geometry',1,0,'No strictly positive whole-interval post-bell clearance');stack.push([mid,hi],[lo,mid]);}return count;
}

/** Continuous position range up to a vertex clear endpoint. Derivatives need
 * not exist there. Intersecting d² with [0,+inf) restricts to the certified
 * vertex cell's real domain; it does not create a contact beyond clear. */
export function contactXRange(profile:PendulumProfile,feature:number,a:number,b:number):Range{
 const n=profile.xy.length/2;if(feature<n)return profileDerivativeRange(profile,feature,a,b,0)[0]!;
 const i=feature%n,x=profile.xy[2*i]!,y=profile.xy[2*i+1]!,s=trig(a,b),c=trig(a,b,true),px=range.add(point(profile.axleX),sub(scale(c,x),scale(s,y))),py=range.add(point(profile.axleY),range.add(scale(s,x),scale(c,y))),d2=sub(point(profile.radius**2),square(py));
 if(d2[1]<0)throw new Error('Vertex position box has no real domain');return sub(px,[0,nextFloat(Math.sqrt(Math.max(0,d2[1])),1)]);
}
/** Condition on the actual finite x=exit event. In rolling, angle increment is
 * distance/R, independent of uncertain speed and arrival time. A prior slip
 * contributes the exact integrated spin deficit -relative*duration/2. */
export function rollingExitAngleBounds(start:MarbleFree,e:Pick<StrikeError,'x'|'v'|'w'|'angle'>,exitX:number,stop=-1):Range{
 const R=STRIKE_SPHERE.radius,k=STRIKE_SPHERE.kappa,travel=sub(point(exitX),box(start.x,e.x));let deficit:Range=point(0);
 if(start.floor==='slip'){const relative=sub(box(start.v,e.v),box(start.w,e.w)),sign=Math.sign(start.v-start.w);if(!(scale(relative,sign)[0]>0))throw new VillageAdmissibilityError(stop,'striker-deckexit-indeterminate','unsupported-contact-geometry',1,0,'Unresolved slip sign at deck exit');const a=-VILLAGE_CONTACT.mu*9.81*sign,duration=scale(relative,-1/(a*(1+1/k))),finish=range.add(box(start.x,e.x),range.add(range.mul(box(start.v,e.v),duration),scale(square(duration),a/2)));if(!(finish[1]<exitX))throw new VillageAdmissibilityError(stop,'striker-deckexit-indeterminate','unsupported-contact-geometry',1,0,'Deck exit and slip-completion ordering unresolved');deficit=scale(range.mul(relative,duration),.5);}
 return range.add(box(start.angle,e.angle),scale(sub(travel,deficit),1/R));
}
