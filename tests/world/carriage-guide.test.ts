import { BoxGeometry, Mesh, Matrix4, Quaternion, Ray, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { carrierContact, mechanismMatrix } from '../../src/view/machine-primitives';
import { surfaceTriangles } from './surface-overlap';
import { villageWorld } from './village-world-fixture';
import { retainedKernels } from './active-retainer-probe';
import { trackCrossings } from './village-geometry';

it.each([9, 5, 1])('Gardens carriage %i has opposed guide contacts throughout its travel', stop => {
  const { probe, dispose } = villageWorld(1, true);
  try {
    const station = probe.plan.stations.find(s => s.stop === stop)!;
    const mechanism = station.mechanism;
    if (!('travel' in mechanism) || typeof mechanism.travel === 'number') throw new Error('Translation fixture required');
    const carrier = probe.machine.root.getObjectByName(`village-${stop}-carrier`)!;
    const fixed = probe.machine.staticSolids[stop]!;
    const frame = mechanismMatrix(mechanism, station.anchor, 0, new Matrix4());
    const contact = carrierContact(mechanism), vertical = Math.hypot(mechanism.travel[0], mechanism.travel[2]) === 0;
    const centre = new Vector3(contact[0], contact[1] + (vertical ? 1.7 : 1.97), contact[2] - (vertical ? 1.2 : .65)).applyMatrix4(frame);
    const tangent = new Vector3(...mechanism.travel).normalize();
    const up = vertical ? new Vector3(1, 0, 0) : new Vector3(0, 1, 0).applyQuaternion(new Quaternion().setFromUnitVectors(new Vector3(1, 0, 0), tangent));
    const across = new Vector3(0, 0, 1), ray = new Ray(), hit = new Vector3();
    // Pose-controlled geometry, independent of the motion timing.
    for (const progress of [0, .5, 1]) {
      carrier.matrix.copy(mechanismMatrix(mechanism, station.anchor, progress, new Matrix4()));
      carrier.matrixWorldNeedsUpdate = true; carrier.updateWorldMatrix(true, true);
      const movingFaces = surfaceTriangles(carrier), fixedFaces = surfaceTriangles(fixed);
      for (const offset of [-.035, 0, .035]) for (const axis of [up, across]) for (const sign of [-1, 1]) {
        const origin = centre.clone().addScaledVector(new Vector3(...mechanism.travel), progress).addScaledVector(tangent, offset);
        ray.set(origin, axis.clone().multiplyScalar(sign));
        const nearest = (faces: typeof movingFaces) => {
          let distance = Infinity, normal: Vector3 | undefined;
          for (const face of faces) if (ray.intersectTriangle(face.a, face.b, face.c, false, hit)) {
            const d = hit.distanceTo(origin);
            if (d < distance) { distance = d; normal = face.normal; }
          }
          return { distance, normal };
        };
        const guide = nearest(fixedFaces), jaw = nearest(movingFaces);
        expect(guide.distance, 'actual fixed guide surface').toBeLessThan(.1);
        expect(Math.abs(jaw.distance - guide.distance), `gap at progress ${progress}, sign ${sign}, axis ${axis.toArray()}`).toBeLessThan(2e-6);
        expect(jaw.normal!.dot(guide.normal!), 'opposing contact normals').toBeLessThan(-.99999);
      }
    }
  } finally { dispose(); }
});


it('the vertical collar clears the beam joint and pulley; both original geometries fail', () => {
 const f=villageWorld(1,true);
 try {
  const k=retainedKernels(f.probe.machine).find(k=>k.motion.station.stop===1)!;
  expect(k).toBeDefined();const m=k.motion,contact=carrierContact(m.station.mechanism);
  f.world.film((m.carryStart+m.carryEnd)/2);
  const caliper=f.probe.machine.root.getObjectByName('village-carriage-caliper-1') as Mesh;
  const faces=surfaceTriangles(caliper),carrier=f.probe.machine.root.getObjectByName('village-1-carrier')!;
  const beam=carrier.children.find(o=>o instanceof Mesh&&o.geometry instanceof BoxGeometry&&o.geometry.parameters.width===.15&&o.geometry.parameters.height===.1) as Mesh;
  const pulley=f.probe.machine.staticSolids[1]!.children.find(o=>o instanceof Mesh&&o.geometry instanceof BoxGeometry&&o.geometry.parameters.width===1.5) as Mesh;
  expect(beam).toBeDefined();expect(pulley).toBeDefined();
  expect(trackCrossings(faces,[...surfaceTriangles(beam),...surfaceTriangles(pulley)])).toEqual([]);
  const oldBeam=new Mesh(new BoxGeometry(.15,.1,1.84).translate(contact[0],contact[1]+1.7,contact[2]-.17));
  oldBeam.matrixAutoUpdate=false;oldBeam.matrix.copy(carrier.matrixWorld);oldBeam.updateMatrixWorld(true);
  const a=m.station.anchor,oldPulley=new Mesh(new BoxGeometry(1.5,.1,.3).translate(a[0]+.6,a[1]+2.3,a[2]-.96));
  try {
   expect(trackCrossings(faces,surfaceTriangles(oldBeam)).length).toBeGreaterThan(0);
   expect(trackCrossings(faces,surfaceTriangles(oldPulley)).length).toBeGreaterThan(0);
  }finally{oldBeam.geometry.dispose();oldPulley.geometry.dispose();}
 }finally{f.dispose();}
});
