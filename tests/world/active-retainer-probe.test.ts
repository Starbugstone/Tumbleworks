import { it, expect, vi } from 'vitest';
import { Group, Mesh, Ray, Vector3 } from 'three';
import { villageWorld } from './village-world-fixture';
import { surfaceTriangles } from './surface-overlap';
import { barEvidence, filmFloorContext, retainedKernels, retainedPhase } from './active-retainer-probe';
import { activeRetainerHit, type RetainerEvidence } from './active-retainer-occlusion';

function inspection() {
  const fixture = villageWorld(1, true), kernels = retainedKernels(fixture.probe.machine);
  const kernelAt=(stop:number)=>{const kernel=kernels.find(k=>k.motion.station.stop===stop);if(!kernel)throw fixture.probe.machine.route.admissibility??new Error(`No compiled retained stop ${stop}`);return kernel;};
  const candidates = kernels.flatMap(k => [...k.fork.children,...(k.head?.children??[])].filter((c): c is Mesh => c instanceof Mesh));
  const inspect = (stop: number, time: number) => {
    fixture.world.film(time); const center = new Vector3(); fixture.probe.machine.sample(time, center);
    const faces = candidates.flatMap(mesh => surfaceTriangles(mesh));
    const kernel = kernelAt(stop);
    return barEvidence(fixture.probe.machine.route, kernel, time, center, faces, candidates, stop);
  };
  return { ...fixture, kernels, candidates, inspect, kernelAt };
}

it('uses actual cached motions and independent complete unilateral balance at all carry samples without flickering eligibility', () => {
  const f = inspection();
  try {
    expect(f.kernels,JSON.stringify(f.probe.machine.route.admissibility)).toHaveLength(3);
    for (const kernel of f.kernels) {
      const m = kernel.motion, n = Math.ceil((m.carryEnd - m.carryStart) * 120);
      for (let i = 0; i < n; i++) {
        const time = m.carryStart + (m.carryEnd - m.carryStart) * i / n, rows = f.inspect(m.station.stop, time);
        expect(rows, `stop${m.station.stop} t${time}`).toHaveLength(2);
        for (const row of rows) expect(row.equilibrium.kind).toBe('equilibrium');
      }
    }
  } finally { f.dispose(); }
});

it('validates carry accelerations against the independent analytic cubic translation fixture', () => {
  const f = inspection(); try {
    for (const k of f.kernels) {
      const m = k.motion, mechanism = m.station.mechanism;
      if (!('travel' in mechanism) || typeof mechanism.travel === 'number') throw new Error('Fixture requires current fixed-orientation translation');
      const u = .37, duration = m.carryEnd - m.carryStart;
      const rows = f.inspect(m.station.stop, m.carryStart + u * duration);
      const expectedAcceleration = new Vector3(...mechanism.travel).multiplyScalar((6 - 12 * u) / duration ** 2);
      const demand = expectedAcceleration.add(new Vector3(0, 9.81, 0)).multiplyScalar(m.station.retention!.marbleMass);
      const actual = new Vector3();
      const equilibrium = rows[0]!.equilibrium; expect(equilibrium.kind).toBe('equilibrium');
      if (equilibrium.kind !== 'equilibrium') continue;
      const normal = new Vector3(); f.probe.machine.route.normalAt(m.carryStart + u * duration, normal);
      actual.addScaledVector(normal, equilibrium.floorReaction);
      for (const row of rows) actual.addScaledVector(row.nominal!.normal, equilibrium.reactions.get(row.contact.bar.mesh)!);
      // Independent finite-difference truncation/Float64 cancellation check, not
      // an acceptance tolerance in the classifier or physical guards.
      expect(actual.distanceTo(demand)).toBeLessThan(1e-7);
      expect([...equilibrium.reactions.values()].filter(value => value > 0)).toHaveLength(1);
      expect([...equilibrium.reactions.values()].filter(value => value === 0)).toHaveLength(1);
    }
  } finally { f.dispose(); }
});

it('gets per-bar closure and separation from the actual model, rather than geometric near-contact slack', () => {
  const f = inspection(); try {
    for (const k of f.kernels) {
      const stop = k.motion.station.stop;
      if (!k.motion.station.initialCargo) {
        expect(f.inspect(stop, k.motion.start - 1 / 120)).toEqual([]);
        expect(f.inspect(stop, k.motion.closureEnd - 1 / 120).some(row => row.role === 'trailing')).toBe(false);
        expect(f.inspect(stop, k.motion.closureEnd).some(row => row.role === 'trailing')).toBe(true);
      } else { expect(f.inspect(stop, 0)).toHaveLength(2); expect(f.inspect(stop, -1 / 120)).toEqual([]); }
      expect(f.inspect(stop, k.motion.carryStart).some(row => row.role === 'trailing')).toBe(true);
      const release = f.inspect(stop, (k.motion.carryEnd + k.detach) / 2);
      expect(release.some(row => row.role === 'trailing')).toBe(false);
      expect(release.some(row => row.role === 'leading')).toBe(true);
      expect(retainedPhase(k, k.detach)).toBeUndefined();
      expect(f.inspect(stop, k.detach + 1 / 120)).toEqual([]);
    }
  } finally { f.dispose(); }
});

it('selects the true incoming floor at exact compiled contacts rather than the previous inclusive connector', () => {
  const f = inspection(); try {
    for (const contact of f.probe.machine.route.contacts) {
      const context = filmFloorContext(f.probe.machine.route, contact.contact);
      expect(context.stop).toBe(contact.stop); expect(context.kind).toBe('contact');
    }
    expect(filmFloorContext(f.probe.machine.route, 0).stop).toBe(9);
  } finally { f.dispose(); }
});

it('allows the actual reduced desktop cap shadow while retaining lateral contact, axial band and exact per-ray plane checks', () => {
  const f = inspection(); try {
    f.resize(1280, 800);
    const kernel = f.kernelAt(5), time = (kernel.motion.carryStart + kernel.motion.carryEnd) / 2;
    const rows = f.inspect(5, time); f.world.film(time, false);
    const center = new Vector3(); f.probe.machine.sample(time, center);
    const eye = f.world.camera.position, view = center.clone().sub(eye), distance = view.length(); view.normalize();
    const right = view.clone().cross(f.world.camera.up).normalize(), up = right.clone().cross(view).normalize();
    let allowedCaps = 0;
    for (let i = 0; i < 16; i++) {
      const radius = .3 * Math.sqrt(1 - .09 / distance ** 2), angle = i * Math.PI / 8;
      const target = center.clone().addScaledVector(view, -.09 / distance).addScaledVector(right, radius * Math.cos(angle)).addScaledVector(up, radius * Math.sin(angle));
      const ray = new Ray(eye, target.clone().sub(eye).normalize());
      for (const evidence of rows) for (const face of evidence.contact.bar.surface.filter(s => !evidence.contact.bar.lateral.includes(s))) {
        const hit = ray.intersectTriangle(face.a, face.b, face.c, false, new Vector3());
        if (!hit || hit.distanceTo(eye) >= target.distanceTo(eye) - .002) continue;
        expect(activeRetainerHit({kind: 'rim', eye, target, hit, mesh: face.mesh}, evidence).kind).toBe('active-retainer'); allowedCaps++;
        expect(evidence.contact.station).toBeCloseTo(0);
      }
    }
    expect(allowedCaps).toBeGreaterThan(0);
  } finally { f.dispose(); }
});

it('rejects a name-forged fork, wrong stop, moved bar, and every adjacent return/crossbar', () => {
  const f = inspection(); try {
    const k = f.kernelAt(5), t = (k.motion.carryStart + k.motion.carryEnd) / 2;
    const rows = f.inspect(5, t), center = new Vector3(); f.probe.machine.sample(t, center);
    expect(rows).toHaveLength(2);
    const original = rows[0]!.contact.bar.mesh, clone = original.clone(), fakeFork = new Group(); fakeFork.name = k.fork.name; fakeFork.add(clone);
    clone.matrix.copy(original.matrixWorld); clone.matrixAutoUpdate = false;
    expect(barEvidence(f.probe.machine.route, k, t, center, surfaceTriangles(clone), [clone], 5)).toEqual([]);
    expect(barEvidence(f.probe.machine.route, k, t, center, surfaceTriangles(original), [original], 1)).toEqual([]);
    original.position.x += 1;
    expect(barEvidence(f.probe.machine.route, k, t, center, surfaceTriangles(original), [original], 5)).toEqual([]);
    original.position.x -= 1;
    const unrelated = [...k.fork.children,...(k.head?.children??[])].filter((o): o is Mesh => o instanceof Mesh && !rows.some(row => row.contact.bar.mesh === o));
    expect(barEvidence(f.probe.machine.route, k, t, center, unrelated.flatMap(o => surfaceTriangles(o)), unrelated, 5)).toEqual([]);
  } finally { f.dispose(); }
});

it('leaves original foreign-yoke and carrier4-underpass identities foreign even during a positively supported carry', () => {
  const f = inspection(); try {
    const k = f.kernelAt(5), rows = f.inspect(5, (k.motion.carryStart + k.motion.carryEnd) / 2);
    const evidence: RetainerEvidence = rows[0]!;
    for (const name of ['village-9-carrier-BoxGeometry-8', 'village-track-carrier-4']) {
      const foreign = new Mesh(); foreign.name = name;
      expect(activeRetainerHit({kind: 'rim', eye: new Vector3(), target: new Vector3(1, 0, 0), hit: new Vector3(.5, 0, 0), mesh: foreign}, evidence).kind).toBe('foreign');
    }
  } finally { f.dispose(); }
});

it('uses current finite Coulomb capture and refuses evidence without the instantaneous producer witness',()=>{
 const f=inspection();try{
  expect(f.probe.machine.route.admissibility).toBeUndefined();
  const k=f.kernelAt(5),capture=k.motion.capture!;
  expect(capture).toBeDefined();expect(k.head).toBeDefined();
  const time=k.motion.start+capture.centreStop/2;
  const rows=f.inspect(5,time);expect(rows).toHaveLength(1);
  expect(rows[0]!.equilibrium.kind).toBe('equilibrium');
  const spy=vi.spyOn(f.probe.machine.route,'contactWitness').mockReturnValue(false);
  try{expect(f.inspect(5,time)[0]!.equilibrium.kind).toBe('unsupported');}finally{spy.mockRestore();}
 }finally{f.dispose();}
});

it('certifies current capture/held-spin/release at 120Hz and exact event boundaries, keeping nominal and packed evidence separate', () => {
 const f=inspection();try{
  for(const k of f.kernels){
   const m=k.motion, times=[m.start,m.closureStart,m.closureEnd,m.carryStart,m.carryEnd];
   if(m.capture)for(const event of m.capture.events)times.push(m.start+event.start,(m.start+event.start+m.start+event.end)/2);
   for(const [start,end]of [[m.start,m.carryStart],[m.carryEnd,k.detach]]){
    const n=Math.ceil((end!-start!)*120);
    for(let i=0;i<n;i++)times.push(start!+(end!-start!)*i/n);
   }
   for(const time of times.filter(t=>t<k.detach)){
    const rows=f.inspect(m.station.stop,time);
    expect(rows.length,`stop${m.station.stop} t${time}`).toBeGreaterThan(0);
    for(const row of rows){
     expect(row.equilibrium.kind,`stop${m.station.stop} t${time} ${JSON.stringify(row.equilibrium)}`).toBe('equilibrium');
     expect(row.nominal).toBeDefined();
     expect(row.nominal!.maximumVertexError).toBeLessThanOrEqual(row.nominal!.vertexErrorBound);
     if(row.equilibrium.kind==='equilibrium'){
      expect(row.equilibrium.residual).toBeLessThanOrEqual(row.equilibrium.arithmeticBound);
      expect(row.equilibrium.angularResidual).toBeLessThanOrEqual(row.equilibrium.angularBound!);
     }
    }
   }
  }
 }finally{f.dispose();}
});

it('rejects swapped sleeves, tiny buffer edits, stale triangles and non-authoritative rigid matrices',()=>{
 const f=inspection();try{
  const k=f.kernelAt(5),t=(k.motion.carryStart+k.motion.carryEnd)/2;
  const rows=f.inspect(5,t),center=new Vector3();f.probe.machine.sample(t,center);
  const leading=rows.find(r=>r.role==='leading')!.contact.bar.mesh;
  const trailing=rows.find(r=>r.role==='trailing')!.contact.bar.mesh;
  const inspect=(mesh:Mesh,faces=surfaceTriangles(mesh))=>barEvidence(f.probe.machine.route,k,t,center,faces,[mesh],5);
  const geometry=leading.geometry;
  try{leading.geometry=trailing.geometry;expect(inspect(leading)).toEqual([]);}finally{leading.geometry=geometry;}
  const p=geometry.getAttribute('position'),old=p.getX(0);
  try{p.setX(0,old+1e-8);expect(inspect(leading)).toEqual([]);}finally{p.setX(0,old);}
  const stale=surfaceTriangles(leading).map(face=>({...face,a:face.a.clone().addScalar(1e-8)}));
  expect(inspect(leading,stale)).toEqual([]);
  try{leading.position.y=1e-8;expect(inspect(leading)).toEqual([]);}finally{leading.position.y=0;}
  expect(barEvidence(f.probe.machine.route,k,t,center.clone().addScalar(1e-6),surfaceTriangles(leading),[leading],5)).toEqual([]);
  // A well-formed contact alone cannot replace a missing loaded force role.
  const both=f.inspect(5,k.motion.carryStart);f.probe.machine.sample(k.motion.carryStart,center);const loaded=both.find(r=>r.equilibrium.kind==='equilibrium'&&r.equilibrium.reactions.get(r.contact.bar.mesh)!>0)!;
  const unloaded=both.find(r=>r!==loaded)!.contact.bar.mesh;
  const missingLoaded=barEvidence(f.probe.machine.route,k,k.motion.carryStart,center,surfaceTriangles(unloaded),[unloaded],5);
  expect(missingLoaded).toHaveLength(1);expect(missingLoaded[0]!.equilibrium.kind).toBe('unsupported');
 }finally{f.dispose();}
});

it('retains the raw packed-normal release residual while proving nominal Newton/Euler under the original force bound',()=>{
 const f=inspection();try{
  const k=f.kernelAt(9),time=k.motion.carryEnd+1/120,rows=f.inspect(9,time);
  expect(rows).toHaveLength(1);const row=rows[0]!,equilibrium=row.equilibrium;
  expect(equilibrium.kind).toBe('equilibrium');if(equilibrium.kind!=='equilibrium')return;
  const tangent=new Vector3(...k.motion.station.exit.tangent),normal=new Vector3(...k.motion.station.exit.normal);
  const forceDemand=tangent.clone().multiplyScalar(k.motion.station.retention!.marbleMass*k.releaseAcceleration(time-k.motion.carryEnd)).add(new Vector3(0,k.motion.station.retention!.marbleMass*9.81,0));
  const rawBalance=normal.clone().multiplyScalar(equilibrium.floorReaction).addScaledVector(tangent,equilibrium.floorFriction).addScaledVector(row.contact.normal,equilibrium.reactions.get(row.contact.bar.mesh)!);
  expect(rawBalance.distanceTo(forceDemand)).toBeGreaterThan(equilibrium.arithmeticBound);
  expect(equilibrium.residual).toBeLessThanOrEqual(equilibrium.arithmeticBound);
  expect(row.contact.normal.distanceTo(row.nominal!.normal)).toBeGreaterThan(0);
  expect(row.contact.point.distanceTo(row.nominal!.point)).toBeLessThan(row.nominal!.vertexErrorBound);
 }finally{f.dispose();}
});
