import { expect, it } from 'vitest';
import { villagePort } from '../../src/world/village-plan';
import { VillageRollingRun } from '../../src/world/village-rolling';
import { VillageProgram } from '../../src/world/village-program';
import { villageScenePlan } from '../../src/world/village-plans';

function bend(bank:number){
 return Array.from({length:65},(_,i)=>{
  const angle=Math.PI*i/128,c=Math.cos(angle),s=Math.sin(angle);
  return villagePort([c,3,s],[-s,0,c],[-c*Math.sin(bank),Math.cos(bank),-s*Math.sin(bank)]);
 });
}
it('K-L: existing floor law rejects high-speed flat lateral load and accepts sufficient actual bank',()=>{
 const flat={stop:42,kind:'connector' as const,points:bend(0)};
 expect(()=>new VillageRollingRun([flat],5,0,9.81,0,1.4,{profile:'floor',traction:.8})).toThrow(/rolling traction at stop 42 connector vertex .*required mu=/);
 expect(()=>new VillageRollingRun([flat],3,0,9.81,0,1.4,{profile:'floor',traction:.8})).toThrow(/required mu=/);
 expect(()=>new VillageRollingRun([{...flat,points:bend(35*Math.PI/180)}],3,0,9.81,0,1.4,{profile:'floor',traction:.8})).not.toThrow();
 expect(()=>new VillageRollingRun([{...flat,points:bend(35*Math.PI/180)}],6,0,9.81,0,1.4,{profile:'floor',traction:.8})).toThrow(/rolling traction/);
});
it('K-L: unchanged Gardens passes its existing full combined floor cone',()=>{
 const route=new VillageProgram(villageScenePlan(1).plan);route.requirePhysical();
 expect(route.duration).toBe(33.87939035586543);expect(route.admissibility).toBeUndefined();
});
