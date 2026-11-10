import {writeFileSync}from'node:fs';
import {performance}from'node:perf_hooks';
import {Quaternion}from'three';
import{expect,it}from'vitest';
import{villageWorld}from'./village-world-fixture';
// Opt-in cost fixture: ordinary test runs must preserve the frozen BEFORE receipt.
const costOutput=process.env.TW_PENDULUM_COST;
it.runIf(Boolean(costOutput))('records constructor and query costs with actual work counters',()=>{
 if(!costOutput)throw new Error('TW_PENDULUM_COST output required');
 const rows:unknown[]=[];
 for(const chapter of[0,1,2]){
  const constructors:number[]=[];let f:ReturnType<typeof villageWorld>|undefined;
  for(let i=0;i<3;i++){const t=performance.now();const current=villageWorld(chapter);constructors.push(performance.now()-t);f?.dispose();f=current;}
  if(!f)throw new Error('fixture missing');
  try{
   const machine=f.probe.machine,q=new Quaternion(),count=10000,duration=machine.route.duration;
   let t=performance.now();for(let i=0;i<count;i++)machine.apply(duration*(i%997)/996);const apply=performance.now()-t;
   t=performance.now();let checksum=0;for(let i=0;i<count;i++){machine.marbleOrientation(duration*(i%997)/996,q);checksum+=q.w;}const orientation=performance.now()-t;
   rows.push({chapter,constructorsMs:constructors,applyMs:apply,orientationMs:orientation,queries:count,checksum,duration,state:machine.route.motionStatus,contacts:machine.route.contacts.map(c=>({stop:c.stop,start:c.start,end:c.end,movers:c.moverIds})),triangles:machine.triangles,movingGroups:machine.movingGroups});
  }finally{f.dispose();}
 }
 writeFileSync(costOutput,JSON.stringify({scope:'Node constructor/query costs only; compare equivalent status, path and work counters',rows},null,2));expect(rows.length).toBe(3);
});
