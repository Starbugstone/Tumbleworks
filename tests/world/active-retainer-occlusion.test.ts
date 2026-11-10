import { describe, it, expect } from 'vitest';
import { BoxGeometry, CylinderGeometry, Mesh, MeshBasicMaterial, Plane, Ray, Vector3 } from 'three';
import { surfaceTriangles } from './surface-overlap';
import { activeRetainerHit, finiteBar, lateralContact, unilateralEquilibrium, foreignRayIntervals, witnessEquilibrium, type WitnessEquilibriumInput, type RetainerEvidence, type RetainerRay } from './active-retainer-occlusion';
import { filmSegmentAt } from './active-retainer-probe';

function fixture(x = -.34, span = .56) {
  const mesh = new Mesh(new CylinderGeometry(.04, .04, span, 16).rotateX(Math.PI / 2).translate(x, 0, 0), new MeshBasicMaterial());
  const bar = finiteBar(mesh, surfaceTriangles(mesh))!;
  const contact = lateralContact(bar, new Vector3())!;
  const equilibrium = unilateralEquilibrium({ mass: .02, inertiaFactor: 1.4, acceleration: new Vector3(-2, 0, 0),
    relativeAcceleration: 0, tangent: new Vector3(1, 0, 0), floorNormal: new Vector3(0, 1, 0), contacts: [contact], traction: .8 });
  // Left bar reaction is +X: use +2 acceleration for its compressive fixture.
  const loaded = unilateralEquilibrium({ mass: .02, inertiaFactor: 1.4, acceleration: new Vector3(2, 0, 0),
    relativeAcceleration: 0, tangent: new Vector3(1, 0, 0), floorNormal: new Vector3(0, 1, 0), contacts: [contact], traction: .8 });
  const evidence: RetainerEvidence = { stop: 5, currentStop: 5, role: 'trailing', phase: 'carry', modelContact: true, contact, equilibrium: loaded };
  const eye = new Vector3(x < 0 ? -20 : 20, 100, 100), view = eye.clone().negate().normalize();
  const distance = eye.length(), circle = view.clone().multiplyScalar(-.09 / distance);
  const right = view.clone().cross(new Vector3(0, 1, 0)).normalize(), up = right.clone().cross(view).normalize();
  let ray: RetainerRay | undefined;
  for (let i = 0; i < 128 && !ray; i++) {
    const angle = i * Math.PI / 64, radius = .3 * Math.sqrt(1 - .09 / distance ** 2);
    const target = circle.clone().addScaledVector(right, radius * Math.cos(angle)).addScaledVector(up, radius * Math.sin(angle));
    const line = new Ray(eye, target.clone().sub(eye).normalize());
    const hits = bar.lateral.flatMap(face => { const p = line.intersectTriangle(face.a, face.b, face.c, false, new Vector3()); return p && p.distanceTo(eye) < target.distanceTo(eye) - .002 ? [p] : []; });
    hits.sort((a, b) => a.distanceTo(eye) - b.distanceTo(eye));
    if (hits[0]) ray = { kind: 'rim', eye, target, hit: hits[0], mesh };
  }
  if (!ray) throw new Error('Independent analytic silhouette fixture must intersect its finite bar');
  return { mesh, bar, contact, evidence, ray, pulling: equilibrium };
}

describe('finite actual contact-bar evidence', () => {
  it('measures lateral vertices, radius, finite span, closest vertex and supporting normal', () => {
    const f = fixture(); expect(f.bar.radius).toBeCloseTo(.04, 7);
    expect(f.contact.gap).toBeCloseTo(0, 6); expect(f.contact.normal.x).toBeCloseTo(1);
    expect(f.contact.station).toBeCloseTo(0); expect(f.bar.lateral.length).toBe(32);
  });
  it('rejects name fakes, warped cylinders, moved/far bars and end-cap contacts', () => {
    const fake = new Mesh(new BoxGeometry(.08, .08, .56)); fake.name = 'village-5-fork-CylinderGeometry-2';
    expect(finiteBar(fake, surfaceTriangles(fake))).toBeUndefined();
    const f = fixture(); f.mesh.position.x = -1; expect(lateralContact(finiteBar(f.mesh, surfaceTriangles(f.mesh))!, new Vector3())).toBeUndefined();
    const bent = fixture(); const pos = bent.mesh.geometry.getAttribute('position'); pos.setX(0, pos.getX(0) + .01);
    expect(finiteBar(bent.mesh, surfaceTriangles(bent.mesh))).toBeUndefined();
    expect(lateralContact(f.bar, new Vector3(-.34, 0, 1))).toBeUndefined();
    const stretched = fixture(); stretched.mesh.scale.x = 1.01;
    expect(finiteBar(stretched.mesh, surfaceTriangles(stretched.mesh))).toBeUndefined();
  });
});

describe('independent Newton/Euler analytic fixtures', () => {
  const solve = (a: number, relative: number, contacts: ReturnType<typeof fixture>['contact'][]) => unilateralEquilibrium({
    mass: .02, inertiaFactor: 1.4, acceleration: new Vector3(a, 0, 0), relativeAcceleration: relative,
    tangent: new Vector3(1, 0, 0), floorNormal: new Vector3(0, 1, 0), contacts, traction: .8 });
  it('balances translating cradle with one loaded and one independently touching zero-load bar', () => {
    const left = fixture(), right = fixture(.34);
    const result = solve(2, 0, [left.contact, right.contact]); expect(result.kind).toBe('equilibrium');
    if (result.kind !== 'equilibrium') return;
    expect(result.reactions.get(left.mesh)).toBeCloseTo(.04); expect(result.reactions.get(right.mesh)).toBe(0);
    expect(result.floorReaction).toBeCloseTo(.1962); expect(result.floorFriction).toBeCloseTo(0);
    expect(result.residual).toBeLessThanOrEqual(result.arithmeticBound);
    const reverse = solve(-2, 0, [left.contact, right.contact]); expect(reverse.kind).toBe('equilibrium');
    if (reverse.kind === 'equilibrium') { expect(reverse.reactions.get(left.mesh)).toBe(0); expect(reverse.reactions.get(right.mesh)).toBeCloseTo(.04); }
  });
  it('balances release rolling torque; rejects a lone bar needing pull and excessive floor traction', () => {
    const f = fixture(); const result = solve(2, 2, [f.contact]); expect(result.kind).toBe('equilibrium');
    if (result.kind === 'equilibrium') { expect(result.floorFriction).toBeCloseTo(-.016); expect(result.reactions.get(f.mesh)).toBeCloseTo(.056); }
    expect(solve(-2, 0, [f.contact]).kind).toBe('unsupported');
    expect(solve(100, 100, [f.contact]).kind).toBe('unsupported');
    expect(solve(NaN, 0, [f.contact]).kind).toBe('unsupported');
  });
});

describe('explicit active-retainer presentation policy', () => {
  it('allows a positively supported rim hit using its actual per-ray supporting plane', () => {
    const f = fixture(); const decision = activeRetainerHit(f.ray, f.evidence);
    expect(decision.kind).toBe('active-retainer');
    if (decision.kind === 'active-retainer') {
      expect(decision.load).toBe('loaded'); expect(decision.rayProjection).toBeGreaterThan(0);
      const oracle = new Ray(f.ray.eye, f.ray.target.clone().sub(f.ray.eye).normalize()).intersectPlane(
        new Plane().setFromNormalAndCoplanarPoint(f.contact.normal, f.contact.point), new Vector3());
      expect(oracle).not.toBeNull();
      expect(oracle!.distanceTo(f.ray.target)).toBeCloseTo(decision.planeCrossing, 10);
    }
  });
  it.each(['centre', 'wrong-stop', 'before-closure', 'after-detach', 'unknown-force', 'pulling', 'return-tube', 'crossbar', 'other-bar', 'far-yoke', 'wrong-facing'] as const)('rejects %s', mutation => {
    const f = fixture(); let ray = f.ray, evidence: RetainerEvidence | undefined = f.evidence;
    switch (mutation) {
      case 'centre': ray = { ...ray, kind: 'centre' }; break;
      case 'wrong-stop': evidence = { ...evidence, currentStop: 1 }; break;
      case 'before-closure': case 'after-detach': evidence = { ...evidence, modelContact: false }; break;
      case 'unknown-force': evidence = { ...evidence, equilibrium: { kind: 'unsupported', reason: 'unknown' } }; break;
      case 'pulling': evidence = { ...evidence, equilibrium: f.pulling }; break;
      case 'return-tube': case 'crossbar': case 'other-bar': ray = { ...ray, mesh: new Mesh() }; break;
      case 'far-yoke': evidence = { ...evidence, contact: { ...evidence.contact, gap: .41 } }; break;
      case 'wrong-facing': ray = { ...ray, eye: new Vector3(2, 1, 1) }; break;
    }
    expect(activeRetainerHit(ray, evidence).kind).toBe('foreign');
  });
  it('rejects a long-bar hit outside the sphere axial band, without enrolling the entire cylinder', () => {
    const f = fixture(-.34, 2); expect(activeRetainerHit({ ...f.ray, hit: new Vector3(-.32, 0, .5) }, f.evidence).kind).toBe('foreign');
  });
  it('keeps geometry behind an allowed bar independently foreign', () => {
    const f = fixture(); const decisions = [activeRetainerHit(f.ray, f.evidence), activeRetainerHit({ ...f.ray, mesh: new Mesh() }, f.evidence)];
    expect(decisions.map(d => d.kind)).toEqual(['active-retainer', 'foreign']);
  });
  it('rejects a non-tangent target even when it names a positively identified bar', () => {
    const f = fixture(); expect(activeRetainerHit({ ...f.ray, target: new Vector3() }, f.evidence).kind).toBe('foreign');
  });
  it('keeps a continuous foreign-ray interval when the obstructing object changes', () => {
    const result = foreignRayIntervals([
      { time: 0, rays: [{ ray: 3, foreign: ['A'] }] }, { time: .15, rays: [{ ray: 3, foreign: ['B'] }] },
      { time: .25, rays: [{ ray: 3, foreign: ['B'] }] }, { time: .3, rays: [{ ray: 3, foreign: [] }] },
    ]);
    expect(result).toHaveLength(1); expect(result[0]!.end - result[0]!.guardStart).toBeGreaterThan(.25);
    expect([...result[0]!.names]).toEqual(['A', 'B']);
  });
  it('selects the FIRST floor before the first phase and the last only after the film', () => {
    const segments = [{ stop: 9, start: .9, end: 4, kind: 'contact' as const }, { stop: 0, start: 29, end: 32, kind: 'contact' as const }];
    expect(filmSegmentAt(segments, 0).stop).toBe(9); expect(filmSegmentAt(segments, 33).stop).toBe(0);
  });
});

describe('current force/spin witness verification',()=>{
 const base=():WitnessEquilibriumInput=>{
  const f=fixture();return {mass:.02,radius:.3,inertiaFactor:1.4,acceleration:new Vector3(2,0,0),spinAcceleration:0,
   tangent:new Vector3(1,0,0),floorNormal:new Vector3(0,1,0),traction:.8,
   witness:{phase:'carry',floorNormal:.1962,floorFriction:0,leadingReaction:0,trailingReaction:.04,brake:0},
   contacts:[{contact:f.contact,normal:new Vector3(1,0,0),reaction:.04}]};
 };
 it('independently rejects Newton-balanced forces with the wrong spin derivative',()=>{
  const b=base();expect(witnessEquilibrium(b).kind).toBe('equilibrium');
  const spin={...b,acceleration:new Vector3(2,0,0),spinAcceleration:5,
   witness:{...b.witness,floorFriction:-.04,trailingReaction:.08},contacts:b.contacts.map(c=>({...c,reaction:.08}))};
  expect(witnessEquilibrium(spin).kind).toBe('equilibrium');
  expect(witnessEquilibrium({...spin,spinAcceleration:0}).kind).toBe('unsupported');
  expect(witnessEquilibrium({...spin,spinAcceleration:5+1e-9}).kind).toBe('unsupported');
 });
 it('rejects tiny arbitrary force residuals, missing loaded roles, unknown data and negative reactions',()=>{
  const b=base();
  expect(witnessEquilibrium({...b,acceleration:new Vector3(2+1e-10,0,0)}).kind).toBe('unsupported');
  expect(witnessEquilibrium({...b,contacts:[]}).kind).toBe('unsupported');
  expect(witnessEquilibrium({...b,spinAcceleration:NaN}).kind).toBe('unsupported');
  expect(witnessEquilibrium({...b,witness:{...b.witness,phase:'unknown'}}).kind).toBe('unsupported');
  expect(witnessEquilibrium({...b,contacts:[...b.contacts,...b.contacts]}).kind).toBe('unsupported');
  expect(witnessEquilibrium({...b,contacts:b.contacts.map(c=>({...c,reaction:-.04}))}).kind).toBe('unsupported');
 });
});
