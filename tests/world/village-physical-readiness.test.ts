import {expect,it} from 'vitest';
import {VillageProgram} from '../../src/world/village-program';
import {villageScenePlan} from '../../src/world/village-plans';
it.each([0,1,2,3,4,5])('village %i reports its actual physical readiness without a fallback',chapter=>{
 const route=new VillageProgram(villageScenePlan(chapter).plan);
 if(chapter!==1){expect(route.motionStatus.state).toBe('authoring');expect(()=>route.requirePhysical()).toThrow();expect(route.admissibility).toBeDefined();}
 if(chapter===0||chapter===2){expect(route.admissibility).toMatchObject({stop:9,phase:'carry-governor',check:'unsupported-contact-geometry'});expect(route.physicalLedger).toEqual([]);}
 if(chapter===1){expect(route.motionStatus.state).toBe('ready');expect(()=>route.requirePhysical()).not.toThrow();expect(route.admissibility).toBeUndefined();for(const stop of[9,5,1,0])expect(route.physicalLedger.some(entry=>entry.stop===stop)).toBe(true);}
 if(chapter===4||chapter===5)expect(route.admissibility).toMatchObject({stop:9,phase:'initial-release'});
 if(chapter===3)expect(route.admissibility).toMatchObject({stop:8,phase:'escapement-impact',check:'unsupported-contact-geometry',required:1,available:0});
});
