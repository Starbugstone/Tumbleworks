import{expect,it}from'vitest';import{VillageRollingPrefix}from'../../src/world/village-prefix';import{villageScenePlan}from'../../src/world/village-plans';import{PROPOSED_NUMERICS}from'../../src/world/pendulum-types';import{villageWorld}from'./village-world-fixture';
it('Harbour D96 causally rolls from its unchanged slip into the original striker, bell, passive return and terminal',()=>{
 const scene=villageScenePlan(0),p=new VillageRollingPrefix(scene.plan),w=villageWorld(0);
 try{expect(p.failure).toBeUndefined();expect(p.lastStop).toBe(0);w.probe.machine.route.requirePhysical();expect(p.contacts.map(c=>c.stop)).toEqual([9,8,7,6,5,4,3,2,1,0]);
 const slip=p.retained.find(m=>m.station.stop===2)!,strike=p.strikes.find(s=>s.stop===1)!.motion,expected=Math.sqrt(slip.exitSpeed**2+2*9.81*(slip.station.exit.position[1]-strike.station.anchor[1])/1.4);
 expect(strike.sequence.initial.v).toBeCloseTo(expected,12);expect(strike.sequence.initial.w).toBe(strike.sequence.initial.v);expect(strike.drive.mass).toBe(.001);expect(strike.drive.legacyGuideWork).toEqual({friction:.008,stroke:.5});expect(strike.sequence.atBell.q).toBe(.7);
 expect(strike.rest.kind).toBe('return-stick');expect(strike.rest.returnBearingWork).toBeGreaterThan(0);expect(strike.actorEnd).toBeLessThanOrEqual(w.probe.machine.route.duration);expect(Math.abs(strike.energyResidual)).toBeLessThanOrEqual(PROPOSED_NUMERICS.absoluteEnergyEstimate);expect(strike.postBellClearance.work).toBeLessThan(PROPOSED_NUMERICS.maxSteps);expect(p.terminal).toHaveLength(1);
 }finally{w.dispose();}
});
