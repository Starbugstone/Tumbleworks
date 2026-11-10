import { Box3, BoxGeometry, Mesh, MeshBasicMaterial, PerspectiveCamera, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { occludingSurface, sphereFramed } from './village-camera-probe';
import { surfaceTriangles } from './surface-overlap';
import { VillageFilmCamera, type VillageCameraMachine } from '../../src/view/village-film-camera';
import { villagePort, type VillagePlan } from '../../src/world/village-plan';
import type { VillageCameraTimeline } from '../../src/view/village-film-shots';
import { straightMachine } from './village-runtime-fixture';
import { villageWorld } from './village-world-fixture';
import { visible } from './village-geometry';

const cuts = [0, 4.3, 8.7, 13.1, 17.5, 21.9, 25];
const fixture: VillagePlan = {
  profile: 'plank',
  chapter: 0,
  stations: Array.from({ length: 10 }, (_, index) => {
    const entry = villagePort([index - 5, 4, 0]);
    return { stop: 9 - index, anchor: entry.position, badge: entry.position, mechanism: { kind: 'channel', points: [entry, entry] },
      entry, exit: entry, start: index * 2.2 + 0.3, contact: index * 2.2 + 0.5, end: index * 2.2 + 1.7, color: 0xabcdef };
  }),
  connectors: [],
  camera: cuts.slice(0, -1).map((start, index) => ({ start, end: cuts[index + 1]!,
    target: [0, 4, 0], yaw: 0, elevation: (index === 0 || index === cuts.length - 2 ? 50 : 40) * Math.PI / 180,
    radius: index === 0 || index === cuts.length - 2 ? 66 : 22 })),
};
// This synthetic legacy clock is explicit, never a runtime 25-second fallback.
const legacyTimeline = (plan: VillagePlan = fixture): VillageCameraTimeline => ({
  duration: 25, plan, authoredPlan: plan,
  contacts: plan.stations.map(station => ({ ...station, moverIds: [] })),
  boundaries: [{ stop: 9, kind: 'contact', authoredStart: 0, authoredEnd: 25, start: 0, end: 25 }],
  transfers: plan.stations.map(station => ({ stop: station.stop, kind: 'carry', start: station.contact, end: station.end })),
});
const machine: VillageCameraMachine = {
  sample: (seconds, target) => { target.set(8 * Math.sin(seconds / 25 * Math.PI * 4), 4, 8 - seconds * 0.6); },
  bounds: target => {
    target.makeEmpty();
    const contact = new Box3();
    for (const station of fixture.stations) { machine.contactBounds(station.stop, contact); target.union(contact); }
    for (let frame = 0; frame <= 25 * 120; frame++) {
      const point = new Vector3(); machine.sample(frame / 120, point); target.expandByPoint(point);
    }
  },
  contactBounds: (stop, target) => {
    const station = fixture.stations.find(station => station.stop === stop)!;
    target.makeEmpty();
    for (let time = station.start; time <= station.end + 0.001; time += 0.05) {
      const point = new Vector3(); machine.sample(time, point); target.expandByPoint(point);
    }
    target.expandByVector(new Vector3(3, 2, 1));
  },
};
const pose = (camera: PerspectiveCamera) => [...camera.position.toArray(), ...camera.quaternion.toArray(), camera.fov, camera.zoom];


it('seeks in either direction, clamps finite time, and returns exactly to the map pose in both modes', () => {
  const choreography = new VillageFilmCamera(machine, legacyTimeline()), camera = new PerspectiveCamera(34, 375 / 690, 0.1, 160);
  for (const cameraMotion of [true, false]) {
    choreography.apply(camera, 0, cameraMotion); const rest = pose(camera);
    for (const time of [0.2, 4, 8.7, 12.3, 23]) {
      choreography.apply(camera, time, cameraMotion); const expected = pose(camera);
      choreography.apply(camera, 25 - time, cameraMotion);
      choreography.frame(camera, time, cameraMotion); expect(pose(camera)).toEqual(expected);
    }
    for (const time of [-1, 0, 25, 30]) { choreography.apply(camera, time, cameraMotion); expect(pose(camera)).toEqual(rest); }
  }
  expect(() => choreography.apply(camera, NaN)).toThrow('finite');
  for (const aspect of [0, -1, NaN, Infinity]) expect(() => choreography.resize(aspect)).toThrow('finite and positive');
});

it('holds reduced poses for complete compiled shots and merges cuts inside actual transfers', () => {
  const choreography = new VillageFilmCamera(machine, legacyTimeline()), camera = new PerspectiveCamera();
  for (const shot of fixture.camera) {
    choreography.apply(camera, shot.start, false); const expected = pose(camera);
    for (const fraction of [0.01, 0.5, 0.999]) {
      choreography.apply(camera, shot.start + (shot.end - shot.start) * fraction, false); expect(pose(camera)).toEqual(expected);
    }
  }
  const cameraShots = fixture.camera.map(shot => ({ ...shot }));
  cameraShots[0]!.end = 3; cameraShots[1]!.start = 3;
  expect(new VillageFilmCamera(machine, legacyTimeline({ ...fixture, camera: cameraShots })).shots.some(shot => shot.start === 3)).toBe(false);
  expect(() => new VillageFilmCamera(machine, legacyTimeline({ ...fixture, camera: fixture.camera.slice(1) }))).toThrow();
});

it.each([[375, 690], [1280, 800]])('fits complete machine bounds beyond the cargo and contact envelopes at rest at %d×%d', (width, height) => {
  const whole = new Box3(new Vector3(-20, -2, -16), new Vector3(20, 12, 16));
  const actual: VillageCameraMachine = { ...machine, bounds: target => { target.copy(whole); } };
  const choreography = new VillageFilmCamera(actual, legacyTimeline()), camera = new PerspectiveCamera(34, width / height, 0.1, 220);
  choreography.resize(width / height);
  for (const motion of [true, false]) for (const time of [0, 25]) {
    choreography.apply(camera, time, motion);
    for (let corner = 0; corner < 8; corner++) {
      const point = new Vector3(corner & 1 ? whole.max.x : whole.min.x, corner & 2 ? whole.max.y : whole.min.y, corner & 4 ? whole.max.z : whole.min.z);
      expect(sphereFramed(camera, point, 0), `whole machine corner ${corner}`).toBe(true);
    }
  }
  const empty: VillageCameraMachine = { ...machine, bounds: target => { target.makeEmpty(); } };
  expect(() => new VillageFilmCamera(empty, legacyTimeline())).toThrow('complete nonempty linkage bounds');
});

it.each([[375, 690], [1280, 800]])('fits the whole sphere and complete linkage envelope at %d×%d', (width, height) => {
  const choreography = new VillageFilmCamera(machine, legacyTimeline()), camera = new PerspectiveCamera(34, width / height, 0.1, 160);
  const center = new Vector3(), box = new Box3(); choreography.resize(width / height);
  for (const cameraMotion of [true, false]) {
    for (let frame = 0; frame <= legacyTimeline().duration * 30; frame++) {
      const time = frame / 30; choreography.apply(camera, time, cameraMotion); machine.sample(time, center);
      expect(sphereFramed(camera, center), `marble at ${time}, cameraMotion=${cameraMotion}`).toBe(true);
      for (const station of fixture.stations) if (time >= station.contact - 0.3 && time <= station.end) {
        machine.contactBounds(station.stop, box);
        for (let corner = 0; corner < 8; corner++) {
          center.set(corner & 1 ? box.max.x : box.min.x, corner & 2 ? box.max.y : box.min.y, corner & 4 ? box.max.z : box.min.z);
          expect(sphereFramed(camera, center, 0), `whole linkage ${station.stop} at ${time}`).toBe(true);
        }
      }
    }
  }
  // A camera aimed correctly at the marble can still cut off the actual carrier.
  camera.position.set(0, 4, 5); camera.lookAt(0, 4, 0); camera.updateMatrixWorld();
  expect(sphereFramed(camera, new Vector3(0, 4, 0))).toBe(true);
  expect(sphereFramed(camera, new Vector3(3, 4, 0), 0)).toBe(false);
});

it('frames a coming linkage before a reduced-motion cut when its contact begins just after that cut', () => {
  const shots = fixture.camera.map(shot => ({ ...shot }));
  shots[1]!.end = 9.05; shots[2]!.start = 9.05;
  const station = fixture.stations[4]!, envelope = new Box3(new Vector3(20, 2, -1), new Vector3(26, 6, 1));
  const actual: VillageCameraMachine = { ...machine, contactBounds: (stop, target) => {
    if (stop === station.stop) target.copy(envelope); else machine.contactBounds(stop, target);
  }, bounds: target => { machine.bounds(target); target.union(envelope); } };
  const camera = new PerspectiveCamera(34, 375 / 690, 0.1, 220), choreography = new VillageFilmCamera(actual, legacyTimeline({ ...fixture, camera: shots }));
  const time = station.contact - 0.3;
  expect(time).toBeLessThan(shots[1]!.end);
  choreography.apply(camera, time, false);
  for (let corner = 0; corner < 8; corner++) {
    const point = new Vector3(corner & 1 ? envelope.max.x : envelope.min.x, corner & 2 ? envelope.max.y : envelope.min.y, corner & 4 ? envelope.max.z : envelope.min.z);
    expect(sphereFramed(camera, point, 0), `incoming linkage corner ${corner}`).toBe(true);
  }
});

it('keeps normal camera velocity continuous through contacts, LUT knots and rest boundaries', () => {
  const choreography = new VillageFilmCamera(machine, legacyTimeline()), camera = new PerspectiveCamera();
  const before = new Vector3(), current = new Vector3(), after = new Vector3(), epsilon = 1e-5;
  const times = [...fixture.stations.flatMap(station => [station.start - 0.3, station.contact, station.end]),
    ...Array.from({ length: legacyTimeline().duration * 3 + 1 }, (_, index) => index / 3)];
  for (const time of times) {
    choreography.apply(camera, time - epsilon); before.copy(camera.position);
    choreography.apply(camera, time); current.copy(camera.position);
    choreography.apply(camera, time + epsilon); after.copy(camera.position);
    before.sub(current).multiplyScalar(-1 / epsilon); after.sub(current).multiplyScalar(1 / epsilon);
    expect(before.distanceTo(after), `camera velocity at ${time}`).toBeLessThan(0.1);
    expect(camera.fov).toBe(34); expect(camera.zoom).toBe(1);
  }
});

it('fits complete real runtime carrier geometry, including the receiving end of its lift', () => {
  const { machine, dispose } = straightMachine(), camera = new PerspectiveCamera(34, 375 / 690, 0.1, 160);
  try {
    const choreography = new VillageFilmCamera(machine, machine.route);
    const movers = new Set(machine.route.contacts.find(contact => contact.stop === 9)!.moverIds);
    for (const cameraMotion of [true, false]) for (const time of [0, 0.2, 0.7, 1.24, 1.5, machine.route.duration]) {
      machine.apply(time); choreography.apply(camera, time, cameraMotion);
      const box = new Box3(); machine.contactBounds(9, box);
      // Outgoing connectors belong to the whole map, not this contact's linkage.
      machine.groups[9]!.traverse(object => { if (movers.has(object.name)) box.union(new Box3().setFromObject(object)); });
      for (let corner = 0; corner < 8; corner++) {
        const point = new Vector3(corner & 1 ? box.max.x : box.min.x, corner & 2 ? box.max.y : box.min.y, corner & 4 ? box.max.z : box.min.z);
        expect(sphereFramed(camera, point, 0), `actual carrier ${time}`).toBe(true);
      }
    }
  } finally { dispose(); }
});

it('rejects opaque geometry across the actual camera-to-marble ray, but accepts a clear view', () => {
  const geometry = new BoxGeometry(2, 2, 0.1), material = new MeshBasicMaterial(), wall = new Mesh(geometry, material);
  const camera = new PerspectiveCamera(34, 375 / 690, 0.1, 160), center = new Vector3();
  wall.name = 'opaque-roof'; wall.position.z = 2;
  camera.position.set(0, 0, 5); camera.lookAt(center); camera.updateMatrixWorld();
  try {
    expect(sphereFramed(camera, center)).toBe(true);
    expect(occludingSurface(camera, center, surfaceTriangles(wall))).toBe('opaque-roof');
    wall.position.x = 3;
    expect(occludingSurface(camera, center, surfaceTriangles(wall))).toBeNull();
  } finally { geometry.dispose(); material.dispose(); }
});

it.each([0, 1, 2, 3, 4, 5])('village %i: actual film keeps contacts and complete linkage travel visible in both modes and viewports', chapter => {
  const { world, probe, resize, dispose } = villageWorld(chapter), center = new Vector3(), bound = new Box3();
  try {
    const moving = new Set(probe.machine.route.contacts.flatMap(contact => contact.moverIds));
    moving.add('workshop-hammer-sign');
    const staticSurfaces = surfaceTriangles(world.scene).filter(surface => {
      if (!visible(surface.mesh)) return false;
      for (let parent: import('three').Object3D | null = surface.mesh; parent; parent = parent.parent) if (moving.has(parent.name)) return false;
      return true;
    });
    expect(staticSurfaces.length).toBeGreaterThan(100);
    for (const [width, height] of [[375, 690], [1280, 800]]) for (const cameraMotion of [true, false]) {
      resize(width!, height!);
      const duration = probe.machine.route.duration, steps = Math.ceil(duration * 20);
      const times = [...new Set([...Array.from({ length: steps + 1 }, (_, index) => duration * index / steps),
        ...probe.plan.stations.flatMap(station => [station.contact - 0.3, station.contact, station.end])])].filter(time => time >= 0 && time <= duration).sort((a, b) => a - b);
      let occludedSince: number | null = null;
      for (const time of times) {
        world.film(time, cameraMotion); probe.machine.sample(time, center);
        expect(sphereFramed(world.camera, center), `whole marble, village ${chapter} at ${time}, ${width}×${height}, motion=${cameraMotion}`).toBe(true);
        const obstruction = occludingSurface(world.camera, center, staticSurfaces);
        if (obstruction) occludedSince ??= time - 1 / 20;
        else occludedSince = null;
        expect(occludedSince === null || time - occludedSince <= 0.25,
          `cargo occluded by ${obstruction} from ${occludedSince} through ${time}, village ${chapter}, motion=${cameraMotion}`).toBe(true);
        for (const station of probe.plan.stations) if (time >= station.contact - 0.3 && time <= station.end) {
          if (time === station.contact) expect(obstruction, `contact ${station.stop}, village ${chapter}`).toBeNull();
          probe.machine.contactBounds(station.stop, bound);
          for (let corner = 0; corner < 8; corner++) {
            const point = new Vector3(corner & 1 ? bound.max.x : bound.min.x, corner & 2 ? bound.max.y : bound.min.y, corner & 4 ? bound.max.z : bound.min.z);
            expect(sphereFramed(world.camera, point, 0), `complete linkage ${station.stop} at ${time}, village ${chapter}`).toBe(true);
          }
        }
      }
    }
  } finally { dispose(); }
}, 30_000);

it.each([0, 1, 2, 3, 4, 5])('village %i: map targets and Workshop retain their complete touch areas through upright-phone orbit', chapter => {
  const { world, dispose } = villageWorld(chapter);
  try {
    for (let degrees = -15; degrees <= 15; degrees += 5) {
      world.setYaw(degrees * Math.PI / 180);
      const stops = world.targets(), grounds = world.groundTargets(), workshop = world.workshopTargets();
      expect(stops).toHaveLength(10);
      for (const point of [...stops, workshop.badge]) {
        expect(point.x - 22, `44px target left at yaw ${degrees}`).toBeGreaterThanOrEqual(7);
        expect(point.x + 22).toBeLessThanOrEqual(368);
        expect(point.y - 22, `header safe area at yaw ${degrees}`).toBeGreaterThanOrEqual(120);
        expect(point.y + 22, `footer safe area at yaw ${degrees}`).toBeLessThanOrEqual(570);
      }
      for (let a = 0; a < stops.length; a++) for (let b = a + 1; b < stops.length; b++) {
        expect(Math.hypot(stops[a]!.x - stops[b]!.x, stops[a]!.y - stops[b]!.y), `stops ${a}/${b}, yaw ${degrees}`).toBeGreaterThanOrEqual(48);
      }
      for (let index = 0; index < stops.length; index++) {
        const stop = stops[index]!, ground = grounds[index]!, dx = ground.x - stop.x, dy = ground.y - stop.y;
        const t = dx === 0 && dy === 0 ? 0 : Math.max(0, Math.min(1, ((workshop.badge.x - stop.x) * dx + (workshop.badge.y - stop.y) * dy) / (dx * dx + dy * dy)));
        expect(Math.hypot(workshop.badge.x - stop.x, workshop.badge.y - stop.y)).toBeGreaterThanOrEqual(52);
        expect(Math.hypot(workshop.badge.x - stop.x - t * dx, workshop.badge.y - stop.y - t * dy)).toBeGreaterThanOrEqual(30);
      }
    }
  } finally { dispose(); }
});
