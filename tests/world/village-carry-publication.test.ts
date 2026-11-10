import{it,expect}from'vitest';import{Vector3}from'three';
import{villageWorld}from'./village-world-fixture';
import{VillageRollingPrefix}from'../../src/world/village-prefix';

function legacyGarden(){const fixture=villageWorld(1,true),route=fixture.probe.machine.route,prefix:unknown=(route as unknown as{prefix?:unknown}).prefix;if(!(prefix instanceof VillageRollingPrefix))throw new Error('Actual current cached prefix required');return{route,prefix,dispose:fixture.dispose};}
// Independent COMMON PUBLISHER ONLY. Does not assert G-R readiness or use a
// frozen old wholefilm receipt. Fresh before-snapshot is required by protocol.
it('publishes signed carry work from each actual lower/horizontal/raising receipt, independent of G-R',()=>{
 const{route,prefix,dispose}=legacyGarden();try{route.requirePhysical();expect(prefix.retained.map(m=>m.station.stop)).toEqual([9,5,1]);
 for(const m of prefix.retained){const row=m.physicalLedger.find(r=>r.phase==='carry')!,r=m.carryAudit;
 expect(row.work).toEqual({gravity:-r.potential,brake:r.governorWork,slip:0,impact:0,drive:r.sourceEnergy});expect(m.governorLoss).toBe(r.governorWork);
 expect(Math.abs(row.work.gravity+row.work.drive-row.work.brake)).toBeLessThanOrEqual(128*Number.EPSILON*Math.max(1,Math.abs(r.potential),r.sourceEnergy));
 expect(r.requiredSite).toBe('moving-carriage-guide');expect(m.mechanicalWork).toBeGreaterThanOrEqual(0);
 // These are unchanged physical identities; the publication introduces no source.
 expect(m.ledger.available(m.sourceId)).toBe(0);expect(m.carryAudit.governorWork).toBeGreaterThanOrEqual(0);
 const p=new Vector3();for(const time of[m.start,m.carryStart,m.carryEnd,m.end]){route.sample(time,p);expect(p.toArray().every(Number.isFinite)).toBe(true);}
 }
}finally{dispose();}
});

