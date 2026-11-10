import { expect,it } from 'vitest';
import { Matrix4,Quaternion,Vector3 } from 'three';
import { VillageTerminal,VillageTerminalPath } from '../../src/world/village-terminal';
import { LITTLE_HARBOUR } from '../../src/world/villages/little-harbour';
import { GLASSHOUSE_GARDENS } from '../../src/world/villages/glasshouse-gardens';
import { VillageProgram } from '../../src/world/village-program';
import { VillageOrientation } from '../../src/world/village-orientation';
import { villagePort,type VillagePlan,type VillageStation } from '../../src/world/village-plan';
import { assertContact, assertTangentImpact } from '../../src/world/village-contact';
import { spiralBowl, straight } from '../../src/world/villages/author';
const source=GLASSHOUSE_GARDENS.plan.stations.find(s=>s.stop===0)!;
const flat=(points=straight([0,3,0],[2,2.8,0])):VillageStation=>({...source,entry:points[0]!,exit:points.at(-1)!,mechanism:{kind:'channel',points}});

it('keeps the original curved terminal rejected without a pad',()=>{
 const points=spiralBowl([9.6,3.45,.5],1.5,.7,Math.PI/2,-1,.9,.5);
 const station={...source,entry:points[0]!,exit:points.at(-1)!,mechanism:{kind:'bowl' as const,points}};
 expect(new VillageTerminalPath(station).pad).toBeUndefined();
 expect(()=>new VillageTerminal(station,0,2,1.4)).toThrow(/terminal-pad/);
 const route=new VillageProgram({...GLASSHOUSE_GARDENS.plan,stations:GLASSHOUSE_GARDENS.plan.stations.map(s=>s.stop===0?station:s)});
 expect(()=>route.requirePhysical()).toThrow();expect(route.admissibility).toMatchObject({stop:0,phase:'curved-terminal',check:'unsupported-contact-geometry'});
});
it('Harbour remains blocked at its unchanged unsupported source carry',()=>{
 const route=new VillageProgram(LITTLE_HARBOUR.plan);expect(route.admissibility).toMatchObject({stop:9,phase:'carry-governor'});expect(()=>route.requirePhysical()).toThrow();
});
it('a planar terminal preserves angular momentum at impact then dissipates spin and translation finitely',()=>{
 const station=flat(),m=new VillageTerminal(station,2,3,1.4),c=m.capture,s=station.terminalCapture!;
 expect(m.path.pad).toBeDefined();expect(c.impact.vAfter).toBe(s.marbleMass*3/(s.marbleMass+s.headMass));
 expect(c.impact.floorTangentImpulse).toBe(0);expect(c.impact.floorNormalImpulse).toBe(0);expect(c.impact.spin).toBe(3);
 expect(m.length).toBeGreaterThan(0);expect(m.length).toBeLessThan(s.availableStroke);expect(c.settledAt).toBeGreaterThan(c.centreStop);
 expect(Math.abs(c.work.residual)).toBeLessThan(128*Number.EPSILON);
 const p=new Vector3(),head=new Matrix4(),centre=new Vector3(),state={distance:0,speed:0,spin:0,angle:0};
 for(let i=0;i<=480;i++){
  const t=m.start+(m.end-m.start)*i/480;m.sample(t,p);m.headPose(t,head);centre.setFromMatrixPosition(head);
  expect(centre.distanceTo(p)).toBeCloseTo(.34,12);c.sample(t-m.start,state);
  const event=c.eventAt(t-m.start);
  expect(event.floorNormal).toBeGreaterThan(0);expect(Math.abs(event.floorFriction)).toBeLessThanOrEqual(.8*event.floorNormal);
  expect(event.headReaction).toBeGreaterThanOrEqual(0);expect(Math.abs(event.brake)).toBeLessThanOrEqual(s.brakeForce);
  const gravity=-9.81*m.path.pad!.tangent[1];
  expect(Math.abs(s.marbleMass*(gravity-event.a)+event.floorFriction-event.headReaction)).toBeLessThan(1e-14);
 }
 c.sample(c.centreStop,state);expect(state.spin).toBeGreaterThan(0);
 c.sample(c.settledAt,state);expect(state.speed).toBe(0);expect(state.spin).toBe(0);
 m.sample(m.end,p);const end=p.clone();m.sample(m.end+10,p);expect(p.toArray()).toEqual(end.toArray());
 // Both old no-slip impact counterexamples remain impossible at zero floor impulse.
 for(const v of[2,3.7]){const oldAfter=s.marbleMass*1.4*v/(s.marbleMass*1.4+s.headMass);expect(()=>assertTangentImpact(0,s.marbleMass,.4,v,oldAfter,0,.8)).toThrow(/impact-cone/);}
 const g=-9.81*m.path.pad!.tangent[1],normal=s.marbleMass*9.81*m.path.pad!.normal[1];
 const oldAcceleration=((s.marbleMass+s.headMass)*g-s.brakeForce)/(1.4*s.marbleMass+s.headMass);
 expect(()=>assertContact(0,'old-no-slip-terminal','floor-cone',Math.abs(.4*s.marbleMass*oldAcceleration),.8*normal)).toThrow(/floor-cone/);
 expect(()=>new VillageTerminal(station,0,8,1.4)).toThrow(/stroke/);
 expect(()=>new VillageTerminal(station,0,2,1.6)).toThrow(/terminal-pad/);
});
it('rejects bad windows, bank, uphill grade and inconsistent chord frames with typed numeric witnesses',()=>{
 const station=flat(),points=station.mechanism.kind==='channel'?station.mechanism.points:[];
 const cases=[
  {...station,terminalCapture:{...station.terminalCapture!,lead:2.5}},
  flat(straight([0,3,0],[.2,2.98,0])),
  flat(straight([0,3,0],[2,3.2,0])),
  flat(points.map(p=>({...p,normal:[0,1,0] as const}))),
  flat(points.map(p=>({...p,normal:new Vector3(...p.normal).applyAxisAngle(new Vector3(...p.tangent),.1).toArray()}))),
  flat(points.map((p,i)=>i===points.length-1?{...p,tangent:[1,0,0] as const}:p)),
  flat(points.map(p=>({...p,normal:p.normal.map(x=>-x) as [number,number,number]}))),
  flat(straight([0,3,0],[2,3,0]).map(p=>({...p,tangent:[-1,0,0] as const}))),
 ];
 for(const candidate of cases)expect(()=>new VillageTerminal(candidate,0,2,1.4)).toThrow();
});
it('orientation includes residual terminal spin while its centre is already held',()=>{
 const station=flat(),motion=new VillageTerminal(station,0,3,1.4),duration=motion.end+.2;
 const table=new VillageOrientation(duration,.3,(t,p,n)=>motion.sample(t,p,n),[],()=>{},[],[motion]);
 const a=new Quaternion(),b=new Quaternion();table.sample(motion.capture.centreStop,a);table.sample(motion.end,b);
 expect(a.angleTo(b)).toBeGreaterThan(.01);table.sample(duration,a);expect(a.angleTo(b)).toBeLessThan(1e-7);
 const samples=Array.from({length:50},(_,i)=>{const t=duration*i/49;table.sample(t,a);return a.toArray();});
 for(let i=49;i>=0;i--){table.sample(duration*i/49,a);expect(a.toArray()).toEqual(samples[i]);}
});
it('a fully fixed rolling fixture can finish at a proven planar terminal without a legacy fallback',()=>{
 const port=(x:number)=>villagePort([x,4-x*.05,0],[1/Math.hypot(1,.05),-.05/Math.hypot(1,.05),0],[.05/Math.hypot(1,.05),1/Math.hypot(1,.05),0]);
 const stations=Array.from({length:10},(_,i)=>{
  const entry=port(i*2),exit=port(i*2+1.5);
  return {stop:9-i,anchor:entry.position,badge:[i*2,5,0] as const,entry,exit,start:i*2+.2,contact:i*2+.5,end:i*2+1.5,color:0xabcdef,mechanism:{kind:'channel' as const,points:[entry,exit]},...(i===9?{terminalCapture:{marbleMass:.02,headMass:.001,brakeForce:2,lead:.35,availableStroke:.3}}:{})};
 });
 const plan:VillagePlan={chapter:0,profile:'plank',stations,connectors:stations.slice(0,-1).map((s,i)=>({from:s.stop,to:stations[i+1]!.stop,points:[s.exit,stations[i+1]!.entry]})),camera:[{start:0,end:25,target:[0,2,0],radius:66,yaw:0,elevation:.8}]};
 const route=new VillageProgram(plan);expect(()=>route.requirePhysical()).not.toThrow();expect(route.motionStatus.state).toBe('ready');
 expect(route.physicalLedger.some(row=>row.stop===0&&row.phase==='terminal-capture')).toBe(true);
 expect(route.transfers.find(t=>t.stop===0)?.kind).toBe('capture');
 const start=route.transfers.find(t=>t.stop===0)!.start,witness={phase:'',floorNormal:0,floorFriction:0,leadingReaction:0,trailingReaction:0,brake:0};
 expect(route.contactWitness(0,start-.001,witness)).toBe(false);expect(route.contactWitness(0,route.duration,witness)).toBe(true);
 expect(witness.phase).toBe('held-rest');expect(witness.floorFriction).toBe(0);expect(witness.leadingReaction).toBeGreaterThan(0);
 const p=new Vector3();route.sample(route.duration,p);const end=p.toArray();route.sample(route.duration-1,p);expect(p.toArray()).toEqual(end);
});
