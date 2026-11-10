import { expect,it } from 'vitest';
import { bearingStaticHold,PendulumCore } from '../../src/world/pendulum-core';
import { bearingTorque } from '../../src/world/pendulum-types';
import { pendulumParts } from '../../src/view/pendulum-parts';
import { PendulumProfile } from '../../src/world/pendulum-profile';
import { pendulumStation } from './pendulum-fixture';
import type { PendulumDrive } from '../../src/world/pendulum-types';
const drive:PendulumDrive={kind:'pendulum',mass:.001,legacyGuideWork:{friction:.008,stroke:.5},axle:{origin:[7.1,3.1,7.5],axis:[0,0,1]},bar:{arm:1.6,radius:.04,length:.56,facets:16},stopAngle:1.4*.5,dress:'harbour-bell',footings:[]};
it('tiny positive/negative static bearing cone, signed reaction, no tensile bell reaction or double work',()=>{
 const capacity=bearingTorque(drive);
 for(const sign of [-1,1]){const h=bearingStaticHold(1,sign*capacity/2,capacity);expect(h.reaction).toBe(sign*capacity/2);expect(h.work).toBe(0);expect(h.stopReaction).toBe(0);}
 expect(()=>bearingStaticHold(1,capacity*2,capacity)).toThrow(/striker-hold hold-bound/);
 expect(()=>bearingStaticHold(1,-capacity*2,capacity)).toThrow(/striker-hold hold-bound/);
 expect(capacity*drive.stopAngle).toBeCloseTo(.008*.5,16);
});
it('frictionlesse0 uses translational sphere mass, I/J², unchanged spin and zero floor impulses',()=>{
 const station=pendulumStation,parts=pendulumParts(station,drive,()=>0);
 try{
  const p=new PendulumProfile(parts.bar,-.3,1.6),core=new PendulumCore(1,drive,parts,p),impact=core.impact(2,2);
  expect(impact.spin).toBe(2);expect(impact.floorNormalImpulse).toBe(0);expect(impact.floorTangentImpulse).toBe(0);
  expect(impact.effectivePartnerMass).toBe(parts.axleInertia/(1.6**2));
  const momentum=.02*impact.vAfter+impact.effectivePartnerMass*impact.vAfter;
  expect(momentum).toBeCloseTo(.02*2,14);expect(impact.loss).toBeGreaterThanOrEqual(0);
  const elastic=(.02*1.4-impact.effectivePartnerMass)/(.02*1.4+impact.effectivePartnerMass)*2;
  expect(Math.abs(elastic-impact.vAfter)).toBeGreaterThan(1e-6);
  expect(parts.parts.some(p=>p.body as string==='pawl'||p.id==='pawl')).toBe(false);
 }finally{parts.parts.forEach(p=>p.geometry.dispose());}
});
