import{expect,it}from'vitest';
import{recontactFixture}from'./pendulum-recontact-fixture';
import{featureCells}from'../../src/world/pendulum-cells';
import{strikeEpisodes}from'../../src/world/pendulum-episodes';
import{blankBarContact,PROPOSED_NUMERICS}from'../../src/world/pendulum-types';
it('retains the actual original-mass Harbour arrival as a converged physical clear-limit stall',()=>{
 const f=recontactFixture(.008);try{
  let failure:unknown;try{strikeEpisodes(f.core,1.5948988319494617,1.5948988319494617,.8,PROPOSED_NUMERICS);}catch(e){failure=e;}
  expect(failure).toMatchObject({phase:'striker-stall-before-stop',check:'drive-force',available:0});
  const detail=JSON.parse((failure as{detail:string}).detail),p=detail.proof;expect(detail.entry.mode.kind).toBe('roll');expect(detail.prefix.orderRatio).toBeGreaterThan(8);expect(p.remainingWorkLower).toBeGreaterThan(.0004375);expect(p.compressiveLower).toBeGreaterThan(.000037);expect(p.coneLower).toBeGreaterThan(.22);expect(detail.prefix.estimates.w).toBeLessThanOrEqual(PROPOSED_NUMERICS.stateTargets.w);expect(detail.prefix.energyResidual).toBeLessThan(PROPOSED_NUMERICS.absoluteEnergyEstimate);
 }finally{f.dispose();}
});
it('actual vertex derivative ratios and signed rolling laws stay within the finite tail obstruction; high-energy/false-cell mutants never receive that proof',()=>{
 const f=recontactFixture(.008);try{
  const partition=featureCells(1,f.profile,.7),cell=partition.cells.at(-1)!,v=1.5948988319494617,r=f.core.impact(v,v),E=.5*.02*(r.vAfter**2+.4*v*v)+.5*f.parts.axleInertia*r.thetaDot**2,p=f.core.clearLimitStall(cell,partition.clear,E,0,0)!;expect(p).toBeDefined();
  const c=blankBarContact();for(let i=0;i<256;i++){const q=cell.q0+(cell.q1-cell.q0)*i/256;expect(f.profile.sampleFeature(cell.feature,q,c,true)).toBe(true);expect(c.second/c.first**3).toBeLessThanOrEqual(p.ratioBound);const energy=E-f.core.potential(q)-f.core.torque*q,u=Math.sqrt(2*energy/(f.parts.axleInertia+.028*c.first*c.first)),state={q,u,w:c.first*u,angle:0,slipWork:0,contactWork:0},out={q:0,u:0,w:0,angle:0,slipWork:0,contactWork:0,lambda:0,normal:0,friction:0,acceleration:0,slip:0};f.core.rateOnContact(state,{kind:'roll'},c,out);expect(out.lambda).toBeGreaterThan(0);expect(.8*out.normal-Math.abs(out.friction)).toBeGreaterThan(0);expect(out.slipWork).toBe(0);expect(out.slip).toBe(0);}
  expect(f.core.clearLimitStall(cell,partition.clear,1,0,0)).toBeUndefined();expect(f.core.clearLimitStall({...cell,feature:0,kind:'edge'},partition.clear,E,0,0)).toBeUndefined();expect(f.core.clearLimitStall(cell,[.6,.6],E,0,0)).toBeUndefined();
 }finally{f.dispose();}
});
