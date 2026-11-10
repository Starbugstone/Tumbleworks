import{readFileSync,writeFileSync}from'node:fs';
import{expect,it}from'vitest';
import{villageScenePlan}from'../../src/world/village-plans';
import{VillageRollingPrefix}from'../../src/world/village-prefix';
import{VillageProgram}from'../../src/world/village-program';
import{PROPOSED_NUMERICS}from'../../src/world/pendulum-types';
const root='output/current/village-layouts/parallel44/kernel/ks54';
it('Harbour keeps original scalar mass/work and approved hardware at the translated berth',()=>{
 const before=JSON.parse(readFileSync(root+'/harbour-plan-before.json','utf8')),old=before.plan.stations.find((s:{stop:number})=>s.stop===1),now=villageScenePlan(0).plan.stations.find(s=>s.stop===1)!;
 expect(now.anchor).toEqual([7.4,1.1,12.5]);
 expect(now.strikerDrive).toMatchObject({kind:'pendulum',mass:old.strikerDrive.mass,legacyGuideWork:{friction:old.strikerDrive.friction,stroke:old.strikerDrive.stroke},bar:{arm:1.6,radius:.04,length:.56,facets:16},stopAngle:.7,dress:'harbour-bell',axle:{origin:[7.1000000000000005,2.7,12.5],axis:[0,0,1]}});
});
it('actual Harbour derives its episodes and passive return, retaining the bell static-hold negative',()=>{
 const scene=villageScenePlan(0),prefix=new VillageRollingPrefix(scene.plan),motion=prefix.strikes.find(s=>s.stop===1)?.motion;
 writeFileSync(root+'/'+(process.env.TW_HARBOUR_RECEIPT??'harbour-consumer-next.json'),JSON.stringify({failure:prefix.failure,contacts:prefix.contacts,ledger:prefix.physicalLedger,sequence:motion?.sequence,foundation:motion?.foundation.certificate,groundSummary:motion?.groundSummary,groundImpulses:motion?.groundImpulses,floorImpulses:motion?.floorImpulses,bellTime:motion?.bellTime,actorEnd:motion?.actorEnd,end:motion?.end,rest:motion?.rest,energyResidual:motion?.energyResidual},null,2),{flag:'wx'});
 expect(motion,JSON.stringify(prefix.failure)).toBeDefined();if(!motion)throw new Error('Actual Harbour striker remains rejected');
 expect(()=>motion.core.hold()).toThrow(/striker-hold/);expect(motion.rest.kind).toBe('return-stick');expect(motion.rest.returnBearingWork).toBeGreaterThan(0);expect(motion.rest.margin).toBeGreaterThan(0);expect(motion.rest.stopReaction).toBe(0);expect(motion.actorEnd).toBeGreaterThan(motion.bellTime);expect(Math.abs(motion.energyResidual)).toBeLessThanOrEqual(PROPOSED_NUMERICS.absoluteEnergyEstimate);expect(motion.actorEnd).toBeLessThanOrEqual(new VillageProgram(scene.plan).duration);
});
