import { expect, it, vi } from 'vitest';
import { Matrix4, Triangle, Vector3 } from 'three';
import * as guideParts from '../../src/view/carriage-guide-parts';
import * as retainedParts from '../../src/view/retainer-parts';
import { mechanismPorts } from '../../src/view/machine-primitives';
import { CarriageBrake, assertGuideContacts } from '../../src/world/village-carriage-guide';
import { assertCarryGovernor } from '../../src/world/village-carry';
import { VillageRetained } from '../../src/world/village-retained';
import { VillageRollingPrefix } from '../../src/world/village-prefix';
import { retainedInventory, assertRetainedInventory } from '../../src/world/village-inventory';
import { VillageProgram } from '../../src/world/village-program';
import { villageScenePlan } from '../../src/world/village-plans';
import { VILLAGE_CONTACT } from '../../src/world/village-contact';
import { allocateGuideWrench } from './guide-wrench';

it.each([0, 2])('chapter %i original source9 starts held at rest, carries and releases without an impact', chapter => {
  const plan = villageScenePlan(chapter).plan, station = plan.stations.find(s => s.stop === 9)!;
  const spec = station.retention!, motion = new VillageRetained(station, station.start, 0, 1.4, plan.profile);
  expect(spec).toMatchObject({ bodyMass: .08, marbleMass: .02, headMass: .001, gateMass: .003, weightMass: .4, weightDrop: .8, brakeForce: 5 });
  expect(VILLAGE_CONTACT.mu).toBe(.8);
  expect(motion.capture).toBeUndefined(); expect(motion.closing).toBeUndefined();
  expect(motion.keyedHead).toBe(false); expect(motion.openGuide).toBeUndefined();
  expect(motion.carryStart).toBe(station.start);
  expect(motion.physicalLedger.map(row => row.phase)).toEqual(['carry', 'release']);
  for (const row of motion.physicalLedger) { expect(row.work.impact).toBe(0); expect(row.work.slip).toBe(0); }
  const pose = { localX: 0, progress: 0, forkX: 0, forkAngle: 0, forkLift: 0, weightDrop: 0 };
  motion.state(station.start, pose);
  expect(pose).toMatchObject({ localX: station.initialCargo!.localX, progress: 0, forkAngle: 0, forkLift: 0, weightDrop: 0 });
  expect(motion.relativeAngle(motion.carryEnd)).toBe(0);
  const carry=motion.physicalLedger.find(row=>row.phase==='carry')!;
  expect(motion.carryAudit.requiredSite).toBe('moving-carriage-guide');
  expect(carry.work.gravity+carry.work.drive).toBe(carry.work.brake);
  expect(carry.work.brake).toBe(motion.carryAudit.governorWork);expect(motion.governorLoss).toBe(carry.work.brake);
  if(chapter===0){expect(carry.work.gravity).toBeGreaterThan(0);expect(carry.work.brake).toBeGreaterThan(carry.work.drive);}
  expect(motion.exitSpeed).toBeGreaterThan(0);
  motion.state(motion.end, pose); expect(pose.weightDrop).toBeCloseTo(spec.weightDrop, 14);
  const prefix = new VillageRollingPrefix(plan), actual = prefix.retained.find(m => m.station.stop === 9);
  expect(actual).toBeDefined(); expect(prefix.failure?.stop).not.toBe(9);
  expect(actual!.end).toBe(motion.end);
  expect(prefix.contacts.find(c => c.stop === 9)!.moverIds).toEqual(['village-9-carrier', 'village-9-fork', 'village-9-weight']);
  expect(prefix.transfers.filter(t => t.stop === 9).map(t => t.kind)).toEqual(['carry', 'release']);
  const brake = motion.carriageBrake!, parts = guideParts.carriageGuideParts(station, plan.profile)!;
  try {
    expect(CarriageBrake.certified(brake, 9)).toBe(true); expect(parts.rail).toBeDefined();
    assertGuideContacts(9, parts); assertCarryGovernor(9, motion.carryAudit, brake);
    expect(() => assertCarryGovernor(9, motion.carryAudit, { ...brake } as CarriageBrake)).toThrow(/carry-governor/);
    const p = parts.caliper.getAttribute('position'), index = parts.caliper.index, triangles: Triangle[] = [];
    for (let i = 0; i < (index?.count ?? p.count); i += 3) triangles.push(new Triangle(...[0, 1, 2].map(j =>
      new Vector3().fromBufferAttribute(p, index ? index.getX(i + j) : i + j).applyMatrix4(parts.frame)) as [Vector3, Vector3, Vector3]));
    for (const wrench of motion.carriageWrenches!) {
      const allocation = allocateGuideWrench(brake, wrench.force, wrench.moment), force = new Vector3(), moment = new Vector3();
      for (const reaction of allocation.reactions) {
        expect(reaction.magnitude).toBeGreaterThanOrEqual(0);
        const f = new Vector3(...reaction.normal).multiplyScalar(reaction.magnitude), offset = new Vector3(...reaction.offset);
        force.add(f); moment.add(offset.clone().cross(f));
        const point = parts.origin.clone().add(offset), nearest = new Vector3();
        expect(Math.min(...triangles.map(t => t.closestPointToPoint(point, nearest).distanceTo(point)))).toBeLessThan(1e-6);
      }
      expect(force.distanceTo(new Vector3(...wrench.force))).toBeLessThan(64 * Number.EPSILON * Math.max(1, force.length()));
      expect(moment.distanceTo(new Vector3(...wrench.moment))).toBeLessThan(64 * Number.EPSILON * Math.max(1, moment.length()));
    }
  } finally { parts.caliper.dispose(); parts.rail?.dispose(); }
});

it.each([0, 2])('chapter %i rejects absent or separated jaw and finite guide old bugs', chapter => {
  const plan = villageScenePlan(chapter).plan, station = plan.stations.find(s => s.stop === 9)!;
  const factory = guideParts.carriageGuideParts;
  const absent = vi.spyOn(guideParts, 'carriageGuideParts').mockReturnValue(undefined);
  try { expect(() => new VillageRetained(station, station.start, 0, 1.4, plan.profile)).toThrow(/carry-governor/); }
  finally { absent.mockRestore(); }
  for (const role of ['jaw', 'fixed-guide'] as const) {
    const parts = factory(station, plan.profile)!;
    try {
      if (role === 'jaw') parts.caliper.translate(0, .01, 0);
      else parts.rail!.translate(.01, 0, .01);
      expect(() => assertGuideContacts(9, parts)).toThrow(/guide-contact/);
    } finally { parts.caliper.dispose(); parts.rail?.dispose(); }
  }
  const parts = factory(station, plan.profile)!;
  try {
    // Keep the start patch and destroy only the far-end patch: an infinite-plane
    // or origin-only guide check would falsely accept this finite missing rail.
    const frame = new Matrix4().makeTranslation(...parts.origin.toArray());
    const p = parts.rail!.getAttribute('position'), inverse = frame.clone().invert(), point = new Vector3();
    for (let i = 0; i < p.count; i++) {
      point.fromBufferAttribute(p, i).applyMatrix4(inverse);
      const along = point.dot(parts.tangent);
      if (along > .1) point.addScaledVector(parts.tangent, -(along - .1));
      point.applyMatrix4(frame); p.setXYZ(i, point.x, point.y, point.z);
    }
    expect(() => assertGuideContacts(9, parts)).toThrow(/fixed-guide-contact/);
  } finally { parts.caliper.dispose(); parts.rail?.dispose(); }
});

it.each([0, 2])('chapter %i measures the complete matching return inventory and rejects missing parts', chapter => {
  const plan = villageScenePlan(chapter).plan, spec = plan.stations.find(s => s.stop === 9)!.retention!;
  for (const layout of ['rigid-gate', 'keyed-split'] as const) {
    const inv = retainedInventory(spec, plan.profile, layout), parts = retainedParts.retainerParts(plan.profile, layout);
    try {
      const ids = [...inv.head.parts, ...inv.fork.parts].map(p => p.id).sort();
      expect(ids).toEqual(parts.map(p => p.id).sort()); expect(new Set(ids).size).toBe(ids.length);
      for (const body of [inv.head, inv.fork]) {
        expect(body.parts.reduce((sum, part) => sum + part.mass, 0)).toBeCloseTo(body.mass, 15);
        expect(body.centralInertia).toBeCloseTo(body.axleInertia - body.mass * (body.centre[0] ** 2 + body.centre[1] ** 2), 15);
      }
      expect(ids).toContain('leading-return'); expect(ids).toContain('trailing-return');
      expect(() => assertRetainedInventory({ ...inv, fork: { ...inv.fork, parts: inv.fork.parts.filter(p => p.id !== 'journal') } })).toThrow();
    } finally { parts.forEach(p => p.geometry.dispose()); }
    const factory=retainedParts.retainerParts;
    const missing=vi.spyOn(retainedParts,'retainerParts').mockImplementation((profile,kind,direction,side)=>{
      const actual=factory(profile,kind,direction,side);
      const removed=actual.find(p=>p.id==='trailing-return')!; removed.geometry.dispose();
      return actual.filter(p=>p!==removed);
    });
    try { expect(()=>retainedInventory(spec,plan.profile,layout)).toThrow(/Missing actual retained inventory part/); }
    finally { missing.mockRestore(); }
  }
});

it('does not enrol a rotating, orbital or twinrail carrier by extending flat-floor profiles', () => {
  for (const chapter of [2, 3, 4, 5]) {
    const plan = villageScenePlan(chapter).plan;
    for (const station of plan.stations.filter(s => s.retention && (s.mechanism.kind === 'wheelbucket' || 'pivot' in s.mechanism))) {
      expect(() => new VillageRetained(station, 0, 4, plan.profile === 'twinrail' ? 1 + .4 / (1 - (.22 / .355) ** 2) : 1.4, plan.profile)).toThrow();
    }
  }
  const gardens = new VillageProgram(villageScenePlan(1).plan); gardens.requirePhysical();
  expect(gardens.duration).toBe(33.87939035586543);
});

it('keeps opposed horizontal patches for signed rail travel without reversing its roof',()=>{
  const plan=villageScenePlan(2).plan,original=plan.stations.find(s=>s.stop===9)!;
  for(const sign of [-1,1]){
    const mechanism={kind:'translating' as const,travel:[sign*1.6,0,0] as const,deckPitch:-.18};
    const station={...original,mechanism,...mechanismPorts(mechanism,original.anchor)},parts=guideParts.carriageGuideParts(station,'timber')!;
    try {expect(parts.normal.y).toBeGreaterThan(0);assertGuideContacts(9,parts);expect(CarriageBrake.enrol(station,'timber')).toBeDefined();}
    finally {parts.caliper.dispose();parts.rail?.dispose();}
  }
});
