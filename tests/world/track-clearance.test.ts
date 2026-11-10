import * as THREE from 'three';
import { expect, it, vi } from 'vitest';
import { WorldAssets } from '../../src/view/world-assets';
import { WorldRube } from '../../src/view/world-rube';
import { createRubeSample, RUBE_RADIUS } from '../../src/world/rube-sequence';

import { capsulePenetrations, segmentDistanceSquared, type TrackTriangle } from './triangle-clearance';
// Two millimetres allow float/tessellation error, not an authored clearance margin.
const tolerance = 0.002;

/** Capture the actual authored track surfaces before batching erases their mesh names. */
function authoredTracks() {
  const surfaces: TrackTriangle[] = [];
  const solids: { frame: THREE.Group; surfaces: TrackTriangle[]; bounds: THREE.Box3; name: string }[] = [];
  const prototype = WorldRube.prototype as unknown as { merge(group: THREE.Group): void };
  const merge = prototype.merge;
  const observe = vi.spyOn(prototype, 'merge').mockImplementation(function (this: WorldRube, group) {
    group.updateWorldMatrix(true, true);
    group.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const isTrack = /^rube-(track-|loop-rail)/.test(object.name);
      const localSurfaces: TrackTriangle[] = [];
      const inverse = group.matrixWorld.clone().invert();
      const source = `${group.name || group.parent?.name || 'fixed'}/${object.name || `${object.geometry.type} at ${object.position.toArray().map(n => n.toFixed(2)).join(',')}`}`;
      const solidBounds = new THREE.Box3();
      const positions = object.geometry.getAttribute('position');
      const indices = object.geometry.index;
      const count = indices?.count ?? positions.count;
      for (let offset = 0; offset < count; offset += 3) {
        const vertices = [0, 1, 2].map(corner => new THREE.Vector3().fromBufferAttribute(positions, indices ? indices.getX(offset + corner) : offset + corner).applyMatrix4(object.matrixWorld));
        const triangle = new THREE.Triangle(vertices[0]!, vertices[1]!, vertices[2]!);
        if (isTrack) surfaces.push({ triangle, bounds: new THREE.Box3().setFromPoints(vertices).expandByScalar(RUBE_RADIUS), name: `${object.name}@${group.parent?.name ?? group.name}` });
        const localVertices = vertices.map(vertex => vertex.clone().applyMatrix4(inverse));
        localVertices.forEach(vertex => solidBounds.expandByPoint(vertex));
        localSurfaces.push({ triangle: new THREE.Triangle(localVertices[0]!, localVertices[1]!, localVertices[2]!),
          bounds: new THREE.Box3().setFromPoints(localVertices).expandByScalar(RUBE_RADIUS), name: source });
      }
      solids.push({ frame: group, surfaces: localSurfaces, bounds: solidBounds.expandByScalar(RUBE_RADIUS), name: source });
    });
    merge.call(this, group);
  });
  const assets = new WorldAssets();
  const material = new THREE.MeshBasicMaterial();
  let machine: WorldRube;
  try { machine = new WorldRube(assets.anchors, assets, material); }
  finally { observe.mockRestore(); }
  return { machine, surfaces, solids, dispose: () => { machine.dispose(); assets.dispose(); material.dispose(); } };
}

function penetrations(point: THREE.Vector3, surfaces: readonly TrackTriangle[]) {
  const closest = new THREE.Vector3();
  let minimum = RUBE_RADIUS, name = '';
  let nearest: THREE.Triangle | null = null;
  for (const surface of surfaces) {
    if (!surface.bounds.containsPoint(point)) continue;
    surface.triangle.closestPointToPoint(point, closest);
    const distance = point.distanceTo(closest);
    if (distance < minimum) { minimum = distance; name = surface.name; nearest = surface.triangle; }
  }
  return minimum < RUBE_RADIUS - tolerance ? { distance: minimum, surface: name, center: point.toArray(),
    triangle: nearest ? [nearest.a.toArray(), nearest.b.toArray(), nearest.c.toArray()] : null } : null;
}


it('the entire swept marble route clears actual track surfaces, including other coils and non-current pieces', () => {
  const { machine, surfaces, dispose } = authoredTracks();
  try {
    expect(surfaces.length, 'the guard must inspect real rendered track triangles').toBeGreaterThan(100);
    const sample = createRubeSample();
    const center = new THREE.Vector3();
    const failures: { kind: string; seconds: number; distance: number; surface: string }[] = [];
    for (const piece of machine.route.pieces) {
      let worst: { kind: string; seconds: number; distance: number; surface: string } | null = null;
      if (piece.kind !== 'carried' && piece.kind !== 'flight') {
        // Rolling samples are linear interpolation of these actual authored vertices: the
        // capsule minimum covers the entire segment, including crossings between clock samples.
        for (let index = 1; index < piece.points.length; index++) {
          const a = piece.points[index - 1]!, b = piece.points[index]!;
          const failure = capsulePenetrations(new THREE.Vector3(a.x, a.y, a.z), new THREE.Vector3(b.x, b.y, b.z), surfaces);
          const seconds = piece.start + (piece.end - piece.start) * (index - 1) / (piece.points.length - 1);
          if (failure && (!worst || failure.distance < worst.distance)) worst = { kind: piece.kind, seconds, ...failure };
        }
      } else {
        // Analytic carriers and flight remain a bounded 120 Hz surface probe, not a continuous proof.
        const count = Math.ceil((piece.end - piece.start) * 120);
        const times = new Set(Array.from({ length: count + 1 }, (_, index) => piece.start + (piece.end - piece.start) * index / count));
        piece.points.forEach((_, index) => times.add(piece.start + (piece.end - piece.start) * index / (piece.points.length - 1)));
        for (const seconds of times) {
          machine.route.sample(seconds, sample); center.set(sample.x, sample.y, sample.z);
          const failure = penetrations(center, surfaces);
          if (failure && (!worst || failure.distance < worst.distance)) worst = { kind: piece.kind, seconds, ...failure };
        }
      }
      if (worst) failures.push(worst);
    }
    expect(failures, 'triangle distance must leave the whole radius clear; floor tangency and shared joints are allowed, penetration is not').toEqual([]);
  } finally { dispose(); }
});

it('rejects a non-current solid wall across the marble even when its own track contact frame looks valid', () => {
  const { machine, surfaces, dispose } = authoredTracks();
  try {
    const sample = machine.route.sample(6.4, createRubeSample());
    const center = new THREE.Vector3(sample.x, sample.y, sample.z);
    const wall = new THREE.Triangle(center.clone().add(new THREE.Vector3(-1, -1, 0)), center.clone().add(new THREE.Vector3(1, -1, 0)), center.clone().add(new THREE.Vector3(0, 1, 0)));
    const mutant = { triangle: wall, bounds: new THREE.Box3().setFromPoints([wall.a, wall.b, wall.c]).expandByScalar(RUBE_RADIUS), name: 'unrelated-crossing-wall' };
    expect(penetrations(center, [mutant])).toMatchObject({ distance: 0, surface: 'unrelated-crossing-wall' });
    // A separated unrelated wall is valid. This distinguishes clearance from blanket rejection.
    wall.a.z += 1; wall.b.z += 1; wall.c.z += 1;
    mutant.bounds.setFromPoints([wall.a, wall.b, wall.c]).expandByScalar(RUBE_RADIUS);
    expect(penetrations(center, [mutant])).toBeNull();
    expect(surfaces.length).toBeGreaterThan(0);
  } finally { dispose(); }
});

it('the full marble sphere clears static and moving rig solids throughout every route piece', () => {
  const { machine, solids: meshes, dispose } = authoredTracks();
  try {
    // Cache actual pre-batch primitive triangles once; batching changes neither shape nor pose.
    expect(meshes.length).toBeGreaterThan(10);
    const sample = createRubeSample(), center = new THREE.Vector3(), local = new THREE.Vector3(), inverse = new THREE.Matrix4();
    const scale = new THREE.Vector3();
    const failures: { kind: string; seconds: number; distance: number; surface: string }[] = [];
    for (const piece of machine.route.pieces) {
      const count = Math.ceil((piece.end - piece.start) * 120);
      const times = new Set(Array.from({ length: count + 1 }, (_, index) => piece.start + (piece.end - piece.start) * index / count));
      piece.points.forEach((_, index) => times.add(piece.start + (piece.end - piece.start) * index / (piece.points.length - 1)));
      let worst: { kind: string; seconds: number; distance: number; surface: string } | null = null;
      for (const seconds of times) {
        machine.apply(seconds); machine.route.sample(seconds, sample); center.set(sample.x, sample.y, sample.z);
        machine.groups.forEach(group => group.updateWorldMatrix(true, true));
        for (const entry of meshes) {
          // Merged rigid solids currently have unit scale. Reject an unsupported transform rather
          // than silently testing the wrong-radius sphere after a future scale change.
          entry.frame.getWorldScale(scale);
          if (Math.max(Math.abs(scale.x - 1), Math.abs(scale.y - 1), Math.abs(scale.z - 1)) > 1e-6) throw new Error(`Clearance probe needs scaled sphere support: ${entry.name}`);
          local.copy(center).applyMatrix4(inverse.copy(entry.frame.matrixWorld).invert());
          if (!entry.bounds.containsPoint(local)) continue;
          const failure = penetrations(local, entry.surfaces);
          if (failure && (!worst || failure.distance < worst.distance)) worst = { kind: piece.kind, seconds, ...failure };
        }
      }
      if (worst) failures.push(worst);
    }
    expect(failures, `actual static/moving solids may touch the marble, but none may enter its sphere: ${JSON.stringify(failures.map(({ kind, seconds, distance, surface }) => ({ kind, seconds, distance, surface })))}`).toEqual([]);
  } finally { dispose(); }
});


it('rejects crossed and near-grazing thin walls between safe endpoints, but accepts a separated wall', () => {
  const start = new THREE.Vector3(-1, 0, 0), end = new THREE.Vector3(1, 0, 0);
  const surface = (z: number): TrackTriangle => {
    const triangle = new THREE.Triangle(new THREE.Vector3(0, -0.1, z), new THREE.Vector3(0, 0.1, z), new THREE.Vector3(0, 0, z + 0.1));
    return { triangle, bounds: new THREE.Box3().setFromPoints([triangle.a, triangle.b, triangle.c]).expandByScalar(RUBE_RADIUS), name: 'thin-wall' };
  };
  const crossing = surface(0), grazing = surface(0.25), separated = surface(0.4);
  for (const wall of [crossing, grazing, separated]) {
    expect(penetrations(start, [wall])).toBeNull(); expect(penetrations(end, [wall])).toBeNull();
  }
  expect(capsulePenetrations(start, end, [crossing])).toMatchObject({ distance: 0 });
  expect(capsulePenetrations(start, end, [grazing])?.distance).toBeCloseTo(0.25, 10);
  expect(capsulePenetrations(start, end, [separated])).toBeNull();
  // The closest points on these skew segments are both interior, testing the edge-distance branch.
  expect(segmentDistanceSquared(start, end, new THREE.Vector3(0, -1, 0.2), new THREE.Vector3(0, 1, 0.2))).toBeCloseTo(0.04, 10);
});


it('clears the spiral and flight intrusion counterexamples found before the geometry fix', () => {
  const { machine, surfaces, dispose } = authoredTracks();
  try {
    const failures = [4.60625, 10.805882352941177].map(seconds => {
      const sample = machine.route.sample(seconds, createRubeSample());
      return { seconds, failure: penetrations(new THREE.Vector3(sample.x, sample.y, sample.z), surfaces) };
    }).filter(entry => entry.failure !== null);
    expect(failures).toEqual([]);
  } finally { dispose(); }
});
