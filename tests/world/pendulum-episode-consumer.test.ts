// UNUSED / UNRUN acceptance. Must fail until actual producer + obligations pass.
import{writeFileSync}from'node:fs';
import{Quaternion,Vector3}from'three';
import{expect,it}from'vitest';
import{VillageRollingPrefix}from'../../src/world/village-prefix';
import{villageScenePlan}from'../../src/world/village-plans';
import{VillageProgram}from'../../src/world/village-program';
import{VILLAGE_CONTACT}from'../../src/world/village-contact';
import{strikeEpisodes}from'../../src/world/pendulum-episodes';
import{PendulumFoundation}from'../../src/world/pendulum-foundation';
import{PROPOSED_NUMERICS}from'../../src/world/pendulum-types';
it('actual current Mill has owned finite episodes, closed work/spin and its real next failure',()=>{
 const scene=villageScenePlan(2),prefix=new VillageRollingPrefix(scene.plan),strike=prefix.strikes.find(s=>s.stop===7)?.motion;
 writeFileSync('output/current/village-layouts/parallel44/kernel/ks54/mill-consumer3.json',JSON.stringify({failure:prefix.failure,contacts:prefix.contacts,ledger:prefix.physicalLedger,sequence:strike?.sequence,foundation:strike?.foundation.certificate,groundSummary:strike?.groundSummary,groundImpulses:strike?.groundImpulses,floorImpulses:strike?.floorImpulses,energyResidual:strike?.energyResidual,actorEnd:strike?.actorEnd,bellTime:strike?.bellTime,end:strike?.end},null,2));
 expect(strike,JSON.stringify(prefix.failure)).toBeDefined();if(!strike)throw new Error('Actual current drive has no accepted striker');
 expect(Math.abs(strike.energyResidual)).toBeLessThanOrEqual(PROPOSED_NUMERICS.absoluteEnergyEstimate);expect(strike.outgoingSpeed).toBeGreaterThan(0);
 expect(PendulumFoundation.certified(strike.foundation,7)).toBe(true);expect(strike.groundSummary.rows).toBeGreaterThan(0);expect(Number.isFinite(strike.groundSummary.minimumNormalTraction)).toBe(true);expect(strike.groundSummary.work).toBe(0);expect(strike.floorImpulses.length).toBe(strike.sequence.episodes.filter(e=>e.kind==='impact').length);for(const p of strike.floorImpulses)expect(p.onTrack.map((x,i)=>x+p.onSphere[i]!)).toEqual([0,0,0]);expect(strike.groundImpulses.filter(r=>r.event==='bell'&&r.member==='family-corner').length).toBe(8);for(const r of strike.bearingLoads)if(r.kind==='impulse')expect(r.coulomb).toBe(0);
 expect(strike.sequence).toEqual(strikeEpisodes(strike.core,strike.sequence.initial.v,strike.sequence.initial.w,stationExit(scene),PROPOSED_NUMERICS));
 const impacts=strike.sequence.episodes.filter(e=>e.kind==='impact');expect(impacts.length).toBeGreaterThan(1);expect(new Set(impacts.map(e=>e.cell)).size).toBe(impacts.length);
 for(const e of impacts){expect(e.result.floorNormalImpulse).toBeGreaterThanOrEqual(0);expect(Math.abs(e.result.floorTangentImpulse)).toBeLessThanOrEqual(VILLAGE_CONTACT.mu*e.result.floorNormalImpulse+128*Number.EPSILON);expect(strike.physicalLedger.some(r=>r.strike?.episode===e.index&&r.strike.impact===e.result)).toBe(true);}
 const transfer=prefix.transfers.find(t=>t.stop===7&&t.kind==='strike')!;expect(transfer.end).toBe(strike.bellTime);expect(prefix.contacts.find(c=>c.stop===7)!.end).toBe(strike.end);
 const program=new VillageProgram(scene.plan);expect(strike.actorEnd).toBeLessThanOrEqual(program.duration);
 const center=new Vector3(),sequential=new Quaternion(),seek=new Quaternion(),times=[strike.contact,...strike.orientationKnots,strike.end],stored=new Map<number,number[]>();
 for(const time of times){program.sample(time,center);program.marbleOrientation(time,sequential);program.marbleOrientation(time,seek);expect(seek.toArray()).toEqual(sequential.toArray());stored.set(time,sequential.toArray());}for(const time of [...times].reverse()){program.marbleOrientation(time,seek);expect(seek.toArray()).toEqual(stored.get(time));}
 // Do not assert wheel6 or a predetermined count/arrival. The actual next
 // support/contact failure and its seam context are published for its owner.
},120000);

function stationExit(scene:ReturnType<typeof villageScenePlan>){const s=scene.plan.stations.find(s=>s.stop===7)!;return s.exit.position[0]-s.anchor[0];}
