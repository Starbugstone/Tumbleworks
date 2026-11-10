import { writeFileSync } from 'node:fs';
import { Mesh } from 'three';
import { expect, it } from 'vitest';
import { villageWorld } from './village-world-fixture';
import { VillageRollingPrefix } from '../../src/world/village-prefix';
import { villageScenePlan } from '../../src/world/village-plans';

it('first-three current scenes retain exact budgets and report actual partial prefixes',()=>{
 const rows:unknown[]=[];
 for(const chapter of [0,1,2]){
  const f=villageWorld(chapter);
  try {
   const phases:unknown[]=[];
   for(const phase of ['map','film']){
    if(phase==='film')f.world.film(0);
    let meshes=0,triangles=0;
    f.world.scene.traverse(o=>{
     if(!(o instanceof Mesh))return;
     for(let parent:import('three').Object3D|null=o;parent;parent=parent.parent)if(!parent.visible)return;
     meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;
    });
    phases.push({phase,meshes,triangles});
    expect(meshes).toBeLessThanOrEqual(phase==='map'?29:30);expect(triangles).toBeLessThanOrEqual(phase==='map'?36160:37224);
   }
   const prefix=new VillageRollingPrefix(villageScenePlan(chapter).plan);
   rows.push({chapter,phases,state:f.probe.machine.route.motionStatus,actualContacts:prefix.contacts.map(c=>c.stop),firstFailure:prefix.failure,
    source9:prefix.retained.find(m=>m.station.stop===9)?.carryAudit,physicalLedger:prefix.physicalLedger});
  }finally{f.dispose();}
 }
 writeFileSync('output/current/village-layouts/parallel44/kernel/budgets-and-prefixes.json',JSON.stringify(rows,null,2)+'\n');
});
