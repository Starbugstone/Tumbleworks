import{VillagePendulum}from'../../src/world/village-pendulum';
import{writeFileSync}from'node:fs';
import{expect,it}from'vitest';
import{PendulumCore,arcHermite,arcHermiteDerivative}from'../../src/world/pendulum-core';
import{PendulumProfile}from'../../src/world/pendulum-profile';
import{PROPOSED_NUMERICS}from'../../src/world/pendulum-types';
import{pendulumParts}from'../../src/view/pendulum-parts';
import{pendulumStation}from'./pendulum-fixture';
import{proposedPendulum}from'./pendulum-fields';
it('actual original Harbour hold remains negative, then one passive return settles; Mill holds with zero work',()=>{
 const reports:unknown[]=[];
 for(const friction of[.008,.012]){
  const d=proposedPendulum({...pendulumStation,strikerDrive:{mass:.001,inertia:.000095,friction,stroke:.5}},'harbour-bell',()=>0),parts=pendulumParts(pendulumStation,d,()=>0);
  try{
   const core=new PendulumCore(1,d,parts,new PendulumProfile(parts.bar,-.3,1.6));
   if(friction===.008)expect(()=>core.hold()).toThrow(/striker-hold hold-bound/);else expect(core.hold().work).toBe(0);
   const settle=core.settle(2,1,PROPOSED_NUMERICS);reports.push({friction,settle:{...settle,rows:Array.from(settle.rows)}});
   expect(settle.bell.impulse).toBeGreaterThan(0);expect(settle.bell.loss).toBe(.5*parts.axleInertia);expect(settle.rest.stopReaction).toBe(0);expect(settle.rest.work).toBe(0);expect(settle.rest.margin).toBeGreaterThan(0);
   if(friction===.012){expect(settle.rest.kind).toBe('bell-hold');expect(settle.rest.q).toBe(.7);expect(settle.rest.time).toBe(2);expect(settle.rows.length).toBe(0);continue;}
   expect(settle.rest.kind).toBe('return-stick');expect(settle.rest.q).toBeGreaterThan(0);expect(settle.rest.q).toBeLessThan(settle.certificate.qStar);
   expect(Math.abs(settle.certificate.rootResidual)).toBeLessThan(128*Number.EPSILON);expect(settle.rest.time).toBeGreaterThan(2);
   expect(settle.report!.differenceSeconds).toBeLessThanOrEqual(PROPOSED_NUMERICS.eventTimeEstimate);
   expect(Math.abs(settle.rest.returnBearingWork-settle.rest.potentialDrop)).toBeLessThan(128*Number.EPSILON);
   for(let i=0;i<settle.rows.length;i+=3){expect(settle.rows[i+1]).toBeGreaterThanOrEqual(settle.rest.q);expect(settle.rows[i+1]).toBeLessThanOrEqual(.7);expect(settle.rows[i+2]).toBeLessThanOrEqual(0);}
   for(let i=0;i+3<settle.rows.length;i+=3){const [t,q,u,t1,q1,u1]=Array.from(settle.rows.slice(i,i+6)),tm=(t!+t1!)/2,x=arcHermite(q!,q1!,u!,u1!,t!,t1!,tm),v=arcHermiteDerivative(q!,q1!,u!,u1!,t!,t1!,tm);
    const energy=core.potential(.7)-core.potential(x)-core.torque*(.7-x);expect(Math.abs(.5*parts.axleInertia*v*v-energy)).toBeLessThan(PROPOSED_NUMERICS.absoluteEnergyEstimate);
   }
   expect(core.torque*.7+settle.rest.returnBearingWork).toBeGreaterThan(.004);
   const zero={...d,legacyGuideWork:{friction:0,stroke:.5}},mutant=new PendulumCore(1,zero,parts,core.profile);expect(()=>mutant.settle(2,1,PROPOSED_NUMERICS)).toThrow(/striker-return-past-rest/);
   const equal={...d,legacyGuideWork:{friction:core.potentialSlope(.7)*.7/.5,stroke:.5}},indeterminate=new PendulumCore(1,equal,parts,core.profile);expect(()=>indeterminate.settle(2,1,PROPOSED_NUMERICS)).toThrow(/striker-settle-indeterminate/);
  }finally{parts.parts.forEach(p=>p.geometry.dispose());}
 }
 writeFileSync('output/current/village-layouts/parallel44/kernel/ks54/settle-result.json',JSON.stringify(reports,null,2));
},120000);

it('late passive actors reject without extending the marble duration',()=>{
 expect(()=>VillagePendulum.assertActorEnd(1,3,2)).toThrow(/striker-actor-tail/);
 expect(()=>VillagePendulum.assertActorEnd(1,2,2)).not.toThrow();
});
