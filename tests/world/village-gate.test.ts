import {expect,it} from 'vitest';
import {BoxGeometry} from 'three';
import {retainedInventory,assertRetainedInventory,solidMoments} from '../../src/world/village-inventory';
import {VillageGate,legacyGateAllocation,assertGateEnvelope} from '../../src/world/village-gate';
import {carryReceipt,assertCarryGovernor} from '../../src/world/village-carry';
import {openLockReceipt,assertOpenLock} from '../../src/world/village-lock';
import {GLASSHOUSE_GARDENS} from '../../src/world/villages/glasshouse-gardens';
const spec=GLASSHOUSE_GARDENS.plan.stations.find(s=>s.stop===5)!.retention!;
it('integrates actual disjoint bodies and rejects duplicate/point inventories',()=>{
 const inv=retainedInventory(spec,'terracotta','keyed-split');assertRetainedInventory(inv);
 expect(inv.translatingMass).toBe(.004);expect(inv.fork.parts.map(p=>p.id)).toEqual(['leading-return','trailing-sleeve','trailing-return','tie','journal','open-follower']);
 expect(inv.fork.parts.reduce((s,p)=>s+p.mass,0)).toBeCloseTo(spec.gateMass,15);
 expect(()=>assertRetainedInventory({...inv,translatingMass:spec.headMass})).toThrow();
 expect(()=>assertRetainedInventory({...inv,fork:{...inv.fork,centralInertia:0}})).toThrow();
 expect(()=>assertRetainedInventory({...inv,fork:{...inv.fork,parts:[...inv.fork.parts,inv.head.parts[0]!]}})).toThrow();
 const box=new BoxGeometry(2,4,6),a=solidMoments(box),b=solidMoments(box.translate(0,0,20));
 expect(a.volume).toBeCloseTo(48,12);expect(a.axlePerMass).toBeCloseTo(20/12,12);expect(b.axlePerMass).toBeCloseTo(a.axlePerMass,12);box.dispose();
});
it('preserves legacy energy exactly and proves finite full-inventory gate bounds',()=>{
 const inv=retainedInventory(spec,'terracotta','keyed-split'),energy=legacyGateAllocation(spec),c=inv.fork.centre,p=-.18-Math.PI/2;
 expect(energy.energy).toBe(spec.gateMass*9.81*.6+.5*spec.gateMass*(1.5*.6/spec.gateSeconds)**2);
 const close=new VillageGate(5,'closure',energy,{kind:'closure',mass:spec.gateMass,inertia:inv.fork.axleInertia,openCentre:[c[0]*Math.cos(p)-c[1]*Math.sin(p),c[0]*Math.sin(p)+c[1]*Math.cos(p)],capacity:.06},spec.weightMass);
 const lift=new VillageGate(5,'release-drive',energy,{kind:'lift',mass:inv.translatingMass,normalGravity:9.81*Math.cos(.18),tangentGravity:9.81*Math.sin(.18),marbleMass:.02,rollingFactor:1.4,capacity:5},spec.weightMass);
 const state={q:0,qdot:0,qddot:0,governor:0,assist:0,lineTension:0};
 for(const gate of[close,lift]){expect(gate.duration).toBeGreaterThan(spec.gateSeconds);expect(gate.roundingSteps).toBeLessThanOrEqual(8);expect(gate.reflectedMass).toBeGreaterThan(0);for(let i=0;i<=2000;i++){gate.sample(gate.duration*i/2000,state);expect(state.governor).toBeGreaterThanOrEqual(0);expect(state.governor).toBeLessThanOrEqual(gate.axis.capacity);expect(state.lineTension).toBeGreaterThan(0);}expect(gate.ledger.residual).toBe(0);}
 expect(lift.effectiveMass*3.6/spec.gateSeconds**2+.004*9.81*Math.cos(.18)).toBeGreaterThan(lift.sourceEffort);
 expect(close.effectiveMass*6*close.span/spec.gateSeconds**2).toBeGreaterThan(close.sourceEffort);
 // Endpoint-only acceptance misses this interior force hump.
 const governor=(u:number)=>.03+.04*Math.sin(Math.PI*u);
 expect(governor(0)).toBeLessThan(.06);expect(governor(1)).toBeLessThan(.06);
 expect(()=>assertGateEnvelope(5,'interior',{minimumGovernor:.03,maximumGovernor:governor(.5),minimumLineTension:1},.06)).toThrow(/governor-capacity/);
 expect(()=>assertGateEnvelope(5,'negative',{minimumGovernor:-.001,maximumGovernor:.03,minimumLineTension:1},.06)).toThrow(/drive-force/);
 expect(()=>assertGateEnvelope(5,'pull',{minimumGovernor:0,maximumGovernor:.03,minimumLineTension:0},.06)).toThrow(/line-tension/);
});
it('does not spend carry work in a stationary slot or accept an impulsive friction shoe',()=>{
 const carry=carryReceipt(.04,[0,1,0],2,1,.4);expect(carry.governorWork).toBeGreaterThan(0);expect(()=>assertCarryGovernor(9,carry)).toThrow(/carry-governor/);
 const inv=retainedInventory(spec,'terracotta','keyed-split'),lock=openLockReceipt(spec.gateMass,inv.fork.centre,1,3,-200,-.18);
 expect(lock.requiredImpulse).toBeLessThan(0);expect(lock.requiredBrakingTorque).toBeGreaterThan(0);expect(lock.needsBothDirections).toBe(true);expect(()=>assertOpenLock(5,lock)).toThrow(/open-angle-lock/);
});
