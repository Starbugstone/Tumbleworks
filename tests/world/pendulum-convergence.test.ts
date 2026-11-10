import { expect,it } from 'vitest';
import { integratePush } from '../../src/world/pendulum-integrate';
import { PendulumCore } from '../../src/world/pendulum-core';
import { PendulumProfile } from '../../src/world/pendulum-profile';
import { pendulumParts } from '../../src/view/pendulum-parts';
import { PROPOSED_NUMERICS,type PendulumDrive } from '../../src/world/pendulum-types';
import { pendulumStation } from './pendulum-fixture';
// UNRUN acceptance spec for the estimator, not an unconditional certificate.
it('push refines deterministically, records events/spin residuals and agrees across independently started refinement runs',()=>{
 const d:PendulumDrive={kind:'pendulum',mass:.001,legacyGuideWork:{friction:.008,stroke:.5},axle:{origin:[7.1,3.1,7.5],axis:[0,0,1]},bar:{arm:1.6,radius:.04,length:.56,facets:16},stopAngle:.7,dress:'harbour-bell',footings:[]};
 const parts=pendulumParts(pendulumStation,d,()=>0);
 try{
  const core=new PendulumCore(1,d,parts,new PendulumProfile(parts.bar,-.3,1.6));
  const a=integratePush(core,2,2,PROPOSED_NUMERICS),b=integratePush(core,2,2,{...PROPOSED_NUMERICS,initialStep:PROPOSED_NUMERICS.initialStep/2});
  expect(a.report.rigorous).toBe(false);expect(a.report.orderRatio).toBeGreaterThanOrEqual(8);
  for(const key of Object.keys(PROPOSED_NUMERICS.stateTargets) as (keyof typeof PROPOSED_NUMERICS.stateTargets)[])expect(a.report.estimates[key]).toBeLessThanOrEqual(PROPOSED_NUMERICS.stateTargets[key]);
  expect(a.report.eventBracket[1]-a.report.eventBracket[0]).toBeLessThanOrEqual(PROPOSED_NUMERICS.eventTimeEstimate);
  expect(Math.abs(a.rows.at(-1)!.time-b.rows.at(-1)!.time)).toBeLessThanOrEqual(PROPOSED_NUMERICS.stateTargets.time);
  expect(a.rows.every(r=>r.lambda>=0&&r.normal>0)).toBe(true);
  // A new start with the same policy must give bit-identical cached states.
  expect(integratePush(core,2,2,PROPOSED_NUMERICS)).toEqual(a);
 }finally{parts.parts.forEach(p=>p.geometry.dispose());}
});
