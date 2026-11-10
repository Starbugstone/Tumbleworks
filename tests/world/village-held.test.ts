import { expect,it } from 'vitest';
import { VillageRetained } from '../../src/world/village-retained';
import { mechanismPorts } from '../../src/view/machine-primitives';
import { CLOCKMAKERS_HILL } from '../../src/world/villages/clockmakers-hill';
import { villageWorld } from './village-world-fixture';
it.each([0,2])('village %i retains its held-source metadata but rejects carry without an enrolled moving-guide governor',chapter=>{
 const {probe,dispose}=villageWorld(chapter);
 try{
  const route=probe.machine.route,station=route.authoredPlan.stations.find(s=>s.stop===9)!;
  expect(station.initialCargo).toBeDefined();
  expect(()=>new VillageRetained(station,station.start,0,1.4,probe.plan.profile)).toThrow(/carry-governor unsupported-contact-geometry/);
  expect(route.admissibility).toMatchObject({stop:9,phase:'carry-governor'});
  expect(route.physicalLedger).toEqual([]);
  expect(()=>route.requirePhysical()).toThrow(/carry-governor/);
 }finally{dispose();}
});
it('Gardens compiles its actually held source with an enrolled caliper and its proven terminal',()=>{
 const {probe,dispose}=villageWorld(1);
 try{
  const route=probe.machine.route,station=route.authoredPlan.stations.find(s=>s.stop===9)!;
  const source=new VillageRetained(station,station.start,0,1.4,probe.plan.profile);
  expect(source.capture).toBeUndefined();expect(source.carriageBrake?.supports(9)).toBe(true);
  expect(source.carryAudit.governorForceRange[1]).toBeLessThanOrEqual(station.retention!.brakeForce);
  expect(route.physicalLedger.some(entry=>entry.stop===9)).toBe(true);
  expect(route.physicalLedger.some(entry=>entry.stop===0&&entry.phase==='terminal-capture')).toBe(true);
  expect(()=>route.requirePhysical()).not.toThrow();
 }finally{dispose();}
});
it('does not enrol a terminal hoist whose captured fork closure has an unsupported holding contact',()=>{
 const original=CLOCKMAKERS_HILL.plan.stations.find(s=>s.stop===2)!;
 const mechanism={kind:'suspended' as const,travel:[0,1,0] as const,deckPitch:-.18};
 const station={...original,stop:0,mechanism,...mechanismPorts(mechanism,original.anchor),retainAtEnd:true};
 expect(()=>new VillageRetained(station,0,2,1.4,'terracotta')).toThrow(/fork-closure unsupported-contact-geometry/);
});
