import {expect,it,vi} from 'vitest';
import * as carry from '../../src/world/village-carry';
import * as lock from '../../src/world/village-lock';
import {Quaternion,Vector3} from 'three';
import {VillageProgram} from '../../src/world/village-program';
import {VillageRollingPrefix} from '../../src/world/village-prefix';
import {GLASSHOUSE_GARDENS} from '../../src/world/villages/glasshouse-gardens';
import {VillageOrientation} from '../../src/world/village-orientation';
import type {CoulombContact} from '../../src/world/village-contact';
const actualRoute=new VillageProgram(GLASSHOUSE_GARDENS.plan);
// Pose-controlled mathematical orientation/work fixture, NOT finite-drive acceptance.
const driveGuard=vi.spyOn(carry,'assertCarryGovernor').mockImplementation(()=>{});
const lockGuard=vi.spyOn(lock,'assertOpenLock').mockImplementation(()=>{});
const route=new VillageProgram(GLASSHOUSE_GARDENS.plan);
driveGuard.mockRestore();lockGuard.mockRestore();
const prefix=(route as unknown as {prefix:VillageRollingPrefix}).prefix;
it('uses one declared Coulomb coefficient, not independent tunable branches',()=>{
 const law:CoulombContact={kind:'coulomb-single',mu:.8};expect(law.mu).toBe(.8);
 // @ts-expect-error The approved law deliberately has no kinetic/static split.
 const split:CoulombContact={kind:'coulomb-single',mu:.8,muKinetic:.7};void split;
});
it('enrols the repaired source carry and the proven planar terminal',()=>{
 expect(()=>actualRoute.requirePhysical()).not.toThrow();
 expect(actualRoute.physicalLedger.some(entry=>entry.stop===0&&entry.phase==='terminal-capture')).toBe(true);
 expect(actualRoute.physicalLedger.some(entry=>entry.stop===9)).toBe(true);
 expect(actualRoute.physicalLedger.some(entry=>entry.stop===5)).toBe(true);
 const witness={phase:'',floorNormal:0,floorFriction:0,leadingReaction:0,trailingReaction:0,brake:0};
 expect(actualRoute.contactWitness(5,15.35,witness)).toBe(true);
 expect(prefix.retained.map(m=>m.station.stop)).toEqual([9,5,1]);
});
it('pose-controlled sphere contact balances do not prove head-drive feasibility',()=>{
 const witness={phase:'',floorNormal:0,floorFriction:0,leadingReaction:0,trailingReaction:0,brake:0};
 for(const m of prefix.retained){
  expect(m.governorLoss).toBeGreaterThanOrEqual(0);expect(m.ledger.available(m.sourceId)).toBeCloseTo(0,12);
  for(let i=0;i<=1000;i++){
   const t=m.carryStart+(m.end-m.carryStart)*i/1000;m.contactWitness(t,witness);
   expect(witness.floorNormal).toBeGreaterThan(0);expect(Math.abs(witness.floorFriction)).toBeLessThanOrEqual(.8*witness.floorNormal);
   expect(witness.leadingReaction).toBeGreaterThanOrEqual(0);expect(witness.trailingReaction).toBeGreaterThanOrEqual(0);
  }
  expect(m.physicalLedger.find(r=>r.phase==='release')!.sphereEnergy!.barWork).toBeLessThanOrEqual(0);
  const angle=m.relativeAngle(m.carryEnd);expect(m.relativeAngle(m.carryEnd+1e-7)-angle).toBeLessThan(1e-10);
 }
});
it('seeks world orientation identically in shuffled absolute time without altering positions',()=>{
 const times=Array.from({length:100},(_,i)=>route.duration*i/99),q=new Quaternion(),p=new Vector3();
 const rows=times.map(t=>{route.marbleOrientation(t,q);route.sample(t,p);return {q:q.toArray(),p:p.toArray()};});
 for(let j=99;j>=0;j--){route.marbleOrientation(times[j]!,q);route.sample(times[j]!,p);expect(q.toArray()).toEqual(rows[j]!.q);expect(p.toArray()).toEqual(rows[j]!.p);expect(q.length()).toBeCloseTo(1,12);}
});
it('pose-controlled held source orientation continuous and does not roll its carry translation',()=>{
 const a=new Quaternion(),b=new Quaternion();
 for(const m of prefix.retained){
  for(const t of [m.start,m.closureStart,m.carryStart,m.carryEnd,m.end]){route.marbleOrientation(t-1e-9,a);route.marbleOrientation(t+1e-9,b);expect(a.angleTo(b)).toBeLessThan(1e-6);}
  route.marbleOrientation(m.carryStart,a);route.marbleOrientation(m.carryEnd,b);expect(a.angleTo(b)).toBeLessThan(1e-7);

 }
});
it('fixed sloped rolling transports orientation around the actual floor cross-axis',()=>{
 const tangent=new Vector3(1,-.2,0).normalize(),normal=new Vector3(.2,1,0).normalize();
 const table=new VillageOrientation(1,.3,(t,p,n)=>{p.copy(tangent).multiplyScalar(t);n.copy(normal);},[],()=>{});
 const q=new Quaternion();table.sample(1,q);expect(q.angleTo(new Quaternion().setFromAxisAngle(new Vector3().crossVectors(normal,tangent),1/.3))).toBeLessThan(1e-7);
});

it('transports gravity-lever relative roll and rigid rotation without erasing its proved end-stop impulse',()=>{
 const a=new Quaternion(),b=new Quaternion(),pose={x:0,angle:0,progress:0};
 for(const g of prefix.gravity){
  g.state(g.start,pose);const x0=pose.x,angle0=pose.angle;g.state(g.end,pose);
  const turn=pose.angle-angle0-(pose.x-x0)/.3;
  route.marbleOrientation(g.start,a);route.marbleOrientation(g.end,b);
  const expected=new Quaternion().setFromAxisAngle(new Vector3(0,0,1),turn).multiply(a);
  expect(expected.angleTo(b)).toBeLessThan(1e-7);
  expect(g.stopLoss).toBeGreaterThanOrEqual(0);
 }
});
it('pose-controlled quadrature independently integrates release-bar force work and balances the opposite moving-gate contact power',()=>{
 const witness={phase:'',floorNormal:0,floorFriction:0,leadingReaction:0,trailingReaction:0,brake:0};
 const a={localX:0,progress:0,forkX:0,forkAngle:0,forkLift:0,weightDrop:0},b={...a};
 for(const m of prefix.retained){
  const detach=(m as unknown as {detachTime:number}).detachTime,n=2000;let sphereWork=0,gateWork=0;
  for(let i=0;i<n;i++){
   const t0=m.carryEnd+detach*i/n,t1=m.carryEnd+detach*(i+1)/n,mid=(t0+t1)/2;
   m.state(t0,a);m.state(t1,b);m.contactWitness(mid,witness);
   const lift=(a.forkLift+b.forkLift)/2,sin=lift/.3,cos=Math.sqrt(1-sin*sin);
   sphereWork-=witness.leadingReaction*cos*(b.localX-a.localX)*m.outputDirection;
   gateWork+=witness.leadingReaction*sin*(b.forkLift-a.forkLift);
  }
  const entry=m.physicalLedger.find(r=>r.phase==='release')!;
  // Midpoint quadrature error, not an admissibility or geometry tolerance.
  expect(sphereWork).toBeCloseTo(entry.sphereEnergy!.barWork,10);
  expect(gateWork).toBeCloseTo(-sphereWork,10);
  expect(entry.sphereEnergy!.residual).toBeCloseTo(0,13);
 }
});

it('absolute centreStop force and pose select the same post-brake event',()=>{
 const witness={phase:'',floorNormal:0,floorFriction:0,leadingReaction:0,trailingReaction:0,brake:0};
 for(const m of prefix.retained.filter(m=>m.capture)){
  m.contactWitness(m.closureStart,witness);
  expect(witness.phase).toBe(m.capture!.eventAt(m.capture!.centreStop).kind);
  expect(witness.brake).toBe(m.capture!.eventAt(m.capture!.centreStop).brake);
  expect(m.capture!.impact.vAfter*(m.station.retention!.marbleMass+m.inventory.translatingMass)).toBeCloseTo(m.station.retention!.marbleMass*m.capture!.impact.vBefore,14);
 }
});
