import{recontactFixture}from'./pendulum-recontact-fixture';
// UNUSED / UNRUN. No village imports; independent momentum, spin and work checks.
import{expect,it}from'vitest';
import{planarImpact,type ImpactBody}from'../../src/world/pendulum-impact';
import type{PlanarImpactInput,PlanarImpactResult}from'../../src/world/pendulum-types';
import{VILLAGE_CONTACT}from'../../src/world/village-contact';
const body:ImpactBody={mass:.02,kappa:.4,axleInertia:.0014463873893668683};
const zero={gamma:0,slip:0,coneSlope:0,impulse:0};
const input=(q:number,v=2,w=2,u=.9):PlanarImpactInput=>({q,nx:-Math.cos(q),ny:-Math.sin(q),first:2,v,w,u,floor:v===w?'roll':'slip',uncertainty:zero});
function independent(a:PlanarImpactInput,r:PlanarImpactResult){
 const{mass:m,kappa:k,axleInertia:I}=body,H=-a.nx*a.first,P=r.normalImpulse,F=r.floorTangentImpulse;
 expect(r.floorNormalImpulse).toBe(-P*a.ny);expect(r.floorNormalImpulse).toBeGreaterThanOrEqual(0);
 expect(m*(r.vAfter-a.v)).toBeCloseTo(P*a.nx+F,14);expect(m*k*(r.wAfter-a.w)).toBeCloseTo(-F,14);expect(I*(r.uAfter-a.u)).toBeCloseTo(H*P,14);
 expect(P*a.ny+r.floorNormalImpulse).toBe(0);expect(Math.abs(F)).toBeLessThanOrEqual(VILLAGE_CONTACT.mu*r.floorNormalImpulse+128*Number.EPSILON);
 expect(Math.abs(a.nx*r.vAfter+H*r.uAfter)).toBeLessThan(128*Number.EPSILON*Math.max(1,Math.abs(a.v),Math.abs(a.u)));
 const kinetic=(v:number,w:number,u:number)=>.5*m*(v*v+k*w*w)+.5*I*u*u;
 expect(Math.abs(kinetic(a.v,a.w,a.u)-kinetic(r.vAfter,r.wAfter,r.uAfter)-r.loss)).toBeLessThan(128*Number.EPSILON);
 const normal=r.segments.reduce((sum,s)=>sum-.5*s.dP*(s.gammaA+s.gammaB),0),friction=r.segments.reduce((sum,s)=>sum-.5*s.dF*(s.slipA+s.slipB),0);
 expect(r.normalLoss).toBe(normal);expect(r.frictionLoss).toBe(friction);expect(r.loss).toBe(normal+friction);
}
it('horizontal moving-partner and tilted stick/back-slip branches preserve signed impulse identities',()=>{
 for(const q of[0,.413,.2]){const a=input(q),r=planarImpact(7,a,body);independent(a,r);if(q===0){expect(r.floorTangentImpulse).toBe(0);expect(r.wAfter).toBe(a.w);}else if(q===.413){expect(r.branch).toBe('stick');expect(r.vAfter).toBeCloseTo(r.wAfter,14);}else expect(r.branch).toBe('slip-back');}
});
it('Routh slip-then-stick and reversal charge BOTH endpoints of every compression segment',()=>{
 for(const q of[.413,.2]){
  const a=input(q,2,1.999,.9),r=planarImpact(7,a,body);independent(a,r);expect(r.segments).toHaveLength(2);
  expect(r.segments[0]!.gammaB).toBeLessThan(0);expect(r.branch).toBe(q===.413?'slip-then-stick':'slip-then-back');
  const wrong=r.segments.reduce((sum,s)=>sum-.5*s.dP*s.gammaA-.5*s.dF*(s.slipA+s.slipB),0);
  expect(Math.abs(wrong-r.loss)).toBeGreaterThan(128*Number.EPSILON);
 }
});
it('wrong impulse directions, rolling-factor normal mass, wrong Jacobian/inverse inertia and frozen spin mutants fail independent equations',()=>{
 const a=input(.413),r=planarImpact(7,a,body);independent(a,r);
 for(const mutant of[
  {...r,floorNormalImpulse:0},
  {...r,floorNormalImpulse:r.normalImpulse*a.ny},
  {...r,vAfter:a.v+(r.normalImpulse*a.nx+r.floorTangentImpulse)/(body.mass*(1+body.kappa))},
  {...r,uAfter:a.u+a.first*r.normalImpulse/body.axleInertia},
  {...r,uAfter:a.u+(-a.nx*a.first)*r.normalImpulse*(body.axleInertia/((-a.nx*a.first)**2))},
  {...r,wAfter:a.w},
 ])expect(()=>independent(a,mutant)).toThrow();
});
it('flight, unresolved approach/cone and singular compression reject without a clamp',()=>{
 expect(()=>planarImpact(7,{...input(.2),ny:Math.sin(.2)},body)).toThrow(/striker-flight/);
 const a=input(.413);expect(()=>planarImpact(7,{...a,uncertainty:{...zero,gamma:Math.abs(a.nx*a.v-a.nx*a.first*a.u)}},body)).toThrow(/striker-reattach-indeterminate/);
 expect(()=>planarImpact(7,{...a,uncertainty:{...zero,coneSlope:1}},body)).toThrow(/striker-impact-indeterminate/);
 // A synthetic low-inertia contribution and strong normal tilt can make the
 // negative-slip D nonpositive. It remains a pure unsupported fixture.
 const singular={...input(1.4,2,3,0),first:.00001};expect(()=>planarImpact(7,singular,{...body,axleInertia:1})).toThrow(/striker-impact-singular/);
});

it('Core keeps the literal first horizontal impact bit-identical',()=>{
 const f=recontactFixture();try{for(const v of[2,5.9718075582412755]){
  const old=f.core.impact(v,v),next=f.core.impactAt(0,v,v,0,'roll',zero);
  expect(Object.is(next.vAfter,old.vAfter)).toBe(true);expect(Object.is(next.wAfter,old.spin)).toBe(true);expect(Object.is(next.uAfter,old.thetaDot)).toBe(true);expect(Object.is(next.normalImpulse,old.impulse)).toBe(true);expect(Object.is(next.loss,old.loss)).toBe(true);expect(next.floorNormalImpulse).toBe(0);expect(next.floorTangentImpulse).toBe(0);
 }}finally{f.dispose();}
});
it('a tangent free reattachment is indeterminate and does not manufacture an impulse',()=>{
 const tangent=input(.413,2,2,1);expect(()=>planarImpact(7,tangent,body)).toThrow(/striker-reattach-indeterminate/);
});
