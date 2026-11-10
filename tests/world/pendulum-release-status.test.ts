import{writeFileSync}from'node:fs';
import{Mesh}from'three';
import{expect,it}from'vitest';
import{villageWorld}from'./village-world-fixture';
import{villageScenePlan}from'../../src/world/village-plans';
import{VillageRollingPrefix}from'../../src/world/village-prefix';
it('records all-six exact current partial status and unchanged complete-scene budgets',()=>{
 const rows:unknown[]=[],violations:unknown[]=[];
 for(const chapter of[0,1,2,3,4,5]){
  const f=villageWorld(chapter);
  try{
   const census=[];
   for(const phase of['map','film']){
    if(phase==='film')f.world.film(0);let meshes=0,triangles=0;
    f.world.scene.traverse(o=>{if(!(o instanceof Mesh))return;for(let p:import('three').Object3D|null=o;p;p=p.parent)if(!p.visible)return;meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;});
    if(meshes>(phase==='map'?29:30)||triangles>(phase==='map'?36160:37224))violations.push({chapter,phase,meshes,triangles});census.push({phase,meshes,triangles});
   }
   const route=f.probe.machine.route,prefix=new VillageRollingPrefix(villageScenePlan(chapter).plan);
   rows.push({chapter,duration:route.duration,state:route.motionStatus,admissibility:route.admissibility,contacts:prefix.contacts.map(c=>c.stop),failure:prefix.failure,census});
  }finally{f.dispose();}
 }
 writeFileSync('output/current/village-layouts/parallel44/kernel/ks54/status-budget-final.json',JSON.stringify({rows,violations},null,2),{flag:'wx'});expect(violations).toEqual([]);
},120000);
