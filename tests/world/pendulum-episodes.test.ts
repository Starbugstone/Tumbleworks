// UNUSED / UNRUN. Phase fixture proves no actual scene/village acceptance.
import{readFileSync}from'node:fs';
import{expect,it}from'vitest';
import{strikeEpisodes}from'../../src/world/pendulum-episodes';
import{PROPOSED_NUMERICS}from'../../src/world/pendulum-types';
import{recontactFixture}from'./pendulum-recontact-fixture';
it('derived episodes intercept the old witness with a decisive real impact; no forced count or hand root',()=>{
 const old=JSON.parse(readFileSync('tests/world/fixtures/pendulum-single-episode-negative.json','utf8')),f=recontactFixture();
 try{
  const sequence=strikeEpisodes(f.core,old.actualIncoming,old.actualIncoming,.8,PROPOSED_NUMERICS),impacts=sequence.episodes.filter(e=>e.kind==='impact');
  expect(impacts.length).toBeGreaterThan(1);expect(new Set(impacts.map(e=>e.cell)).size).toBe(impacts.length);expect(impacts.length).toBeLessThanOrEqual(sequence.partition.cells.length);
  // Only the first new approaching impact is required by the retained negative.
  // Later episode counts/branches come from the actual solve, never predictions.
  const first=impacts[1]!;expect(first.state.time).toBeLessThan(old.time-6.287796558153742);expect(first.result.gammaBefore).toBeLessThan(0);expect(first.result.floorNormalImpulse).toBeGreaterThan(0);expect(first.result.loss).toBeGreaterThan(0);
  for(const e of sequence.episodes)if(e.kind==='free'){expect(e.motion.report.stableRefinements).toBeGreaterThanOrEqual(2);expect(e.motion.report.grazing!.quinticRelativeRemainder).toBeLessThan(.5);expect(e.motion.report.rigorous).toBe(false);if(e.motion.report.rootConditioning){expect(e.motion.report.rootConditioning.q).toBeLessThanOrEqual(PROPOSED_NUMERICS.stateTargets.q);expect(e.motion.report.rootConditioning.time).toBeLessThanOrEqual(PROPOSED_NUMERICS.eventTimeEstimate);}}
  expect(sequence.episodes.some(e=>e.kind==='contact'&&e.motion.report.termination==='roundoff-plateau')).toBe(true);
  expect(sequence.forwardBearingWork).toBeCloseTo(.012*.5,15);expect(sequence.marbleExit.v).toBeGreaterThan(0);expect(sequence.steps).toBeLessThanOrEqual(PROPOSED_NUMERICS.maxSteps);
 }finally{f.dispose();}
},120000);

function simpson(a:number,b:number,n:number,f:(q:number)=>number){const h=(b-a)/n;let total=f(a)+f(b);for(let i=1;i<n;i++)total+=(i%2?4:2)*f(a+i*h);return total*h/3;}
it('free episodes agree with independent Simpson time and closed slip/spin at common q, including reimpact',()=>{
 const f=recontactFixture();try{
  const a=strikeEpisodes(f.core,5.9718075582412755,5.9718075582412755,.8,PROPOSED_NUMERICS),b=strikeEpisodes(f.core,5.9718075582412755,5.9718075582412755,.8,{...PROPOSED_NUMERICS,initialStep:PROPOSED_NUMERICS.initialStep/2});
  expect(b.topology).toEqual(a.topology);expect(b.episodes.length).toBe(a.episodes.length);
  for(let i=0;i<a.episodes.length;i++){
   const e=a.episodes[i]!,r=b.episodes[i]!;if(e.kind==='impact'&&r.kind==='impact'){expect(Math.abs(e.state.time-r.state.time)).toBeLessThan(PROPOSED_NUMERICS.eventTimeEstimate);expect(Math.abs(e.result.normalImpulse-r.result.normalImpulse)).toBeLessThan(1e-10);expect(Math.abs(e.result.wAfter-r.result.wAfter)).toBeLessThan(PROPOSED_NUMERICS.stateTargets.w);}
   if(e.kind!=='free'||r.kind!=='free')continue;
   const s=e.motion.start,I=f.parts.axleInertia,E=.5*I*s.u*s.u+f.core.potential(s.q),inverse=(q:number)=>1/Math.sqrt(2*(E-f.core.potential(q)-f.core.torque*(q-s.q))/I);
   for(let j=0;j<e.motion.rows.length;j+=Math.max(4,4*Math.floor(e.motion.rows.length/20/4))){
    const q=e.motion.rows[j+1]!,coarse=simpson(s.q,q,128,inverse),fine=simpson(s.q,q,256,inverse);expect(Math.abs(fine-coarse)).toBeLessThan(1e-11);expect(Math.abs(e.motion.rows[j]!-s.time-fine)).toBeLessThan(PROPOSED_NUMERICS.eventTimeEstimate);
    expect(Math.abs(.5*I*e.motion.rows[j+2]!**2+f.core.potential(q)+f.core.torque*(q-s.q)-E)).toBeLessThan(128*Number.EPSILON);
   }
  }
 }finally{f.dispose();}
},120000);
