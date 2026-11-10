import {writeFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {villageScenePlan} from '../../src/world/village-plans';
import {VillageRollingPrefix} from '../../src/world/village-prefix';
it('actual current Mill reaches supported striker7 from its actual incoming state',()=>{
 const scene=villageScenePlan(2),station=scene.plan.stations.find(s=>s.stop===7)!;
 const legacy={...scene.plan,stations:scene.plan.stations.map(s=>s===station?{...s,strikerDrive:{mass:.001,inertia:.000095,friction:.012,stroke:.5}}:s)};
 const before=new VillageRollingPrefix(legacy);expect(before.failure?.admissibility).toMatchObject({stop:7,phase:'striker-impact',check:'unsupported-contact-geometry'});
 const actual=new VillageRollingPrefix(scene.plan),motion=actual.strikes.find(s=>s.stop===7)?.motion;
 writeFileSync('output/current/village-layouts/parallel44/kernel/ks54/mill-first-consumer3.json',JSON.stringify({beforeFailure:before.failure,failure:actual.failure,contacts:actual.contacts,ledger:actual.physicalLedger,motion:motion&&{contact:motion.contact,end:motion.end,partnerEnd:motion.partnerEnd,outgoingSpeed:motion.outgoingSpeed,push:motion.push}},null,2));
 expect(motion,JSON.stringify(actual.failure)).toBeDefined();expect(actual.contacts.map(c=>c.stop)).toContain(7);
 expect(motion!.outgoingSpeed).toBeGreaterThan(0);expect(motion!.physicalLedger.some(r=>r.phase.startsWith('striker-push['))).toBe(true);
},120000);
