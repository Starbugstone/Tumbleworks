import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { VillageFilmCamera, type VillageCameraMachine } from '../../src/view/village-film-camera';
import { villageFilmShots, type VillageCameraTimeline } from '../../src/view/village-film-shots';
import { villagePort, type VillagePlan, type VillageStation } from '../../src/world/village-plan';
import { VillageProgram } from '../../src/world/village-program';
import { sphereFramed } from './village-camera-probe';

function timeline(duration = 21.137): VillageCameraTimeline {
  const cuts = [0, 5, 10, 15, 20, 25];
  const plan: VillagePlan = { chapter: 0, profile: 'plank', stations: [], connectors: [],
    camera: cuts.slice(0, -1).map((start, index) => ({ start, end: cuts[index + 1]!,
      target: [index === 0 || index === cuts.length - 2 ? 0 : index, 4, 0], yaw: 0,
      elevation: (index === 0 || index === cuts.length - 2 ? 50 : 40) * Math.PI / 180,
      radius: index === 0 || index === cuts.length - 2 ? 66 : 22 })),
  };
  return { duration, plan, authoredPlan: plan, contacts: [], transfers: [], boundaries: [
    { stop: 9, kind: 'contact', authoredStart: 0, authoredEnd: 5, start: 0, end: 3 },
    { stop: 9, kind: 'connector', authoredStart: 5, authoredEnd: 10, start: 3, end: 11 },
    { stop: 8, kind: 'contact', authoredStart: 10, authoredEnd: 20, start: 11, end: 18 },
    { stop: 8, kind: 'connector', authoredStart: 20, authoredEnd: 25, start: 18, end: duration },
  ] };
}

it('maps compositions through physical boundaries instead of scaling the film to 25 seconds', () => {
  const route = timeline(), shots = villageFilmShots(route);
  expect(shots.map(shot => shot.start)).toEqual([0, 3, 11, 14.5, 18]);
  expect(shots.at(-1)!.end).toBe(route.duration);
  expect(route.authoredPlan.camera.at(-1)!.end).toBe(25);
  expect(shots[1]!.target).toEqual(route.authoredPlan.camera[1]!.target);
  expect(shots.at(-1)!.target).toEqual(shots[0]!.target);
});

it('merges cuts through capture/carry/release and the contact lead, while permitting rotor coast', () => {
  const route = timeline();
  const coast = { stop: 9, start: 8, contact: 9.5, end: 17, moverIds: ['shaft'] };
  const safe = villageFilmShots({ ...route, contacts: [coast], transfers: [{ stop: 9, kind: 'carry', start: 9.5, end: 10.5 }] });
  expect(safe.some(shot => shot.start === 11), 'the coasting rotor is not an active cargo transfer').toBe(true);
  for (const kind of ['capture', 'carry', 'release'] as const) {
    const shots = villageFilmShots({ ...route, contacts: [coast], transfers: [{ stop: 9, kind, start: 10.5, end: 12 }] });
    expect(shots.some(shot => shot.start === 11), kind).toBe(false);
    expect(shots[1]!.end).toBe(14.5);
  }
  const lead = villageFilmShots({ ...route, contacts: [{ ...coast, contact: 11.2 }] });
  expect(lead.some(shot => shot.start === 11)).toBe(false);
});

it('groups short physical shots without extending or slowing the physical film', () => {
  const route = timeline(3.137);
  const compressed = { ...route, boundaries: [{ stop: 9, kind: 'contact' as const,
    authoredStart: 0, authoredEnd: 25, start: 0, end: route.duration }] };
  const shots = villageFilmShots(compressed);
  expect(shots).toHaveLength(1); expect(shots[0]!.start).toBe(0); expect(shots[0]!.end).toBe(3.137);
  expect(shots[0]!.target).toEqual(route.authoredPlan.camera[0]!.target);
  for (const duration of [5.137, 11.019, 25, 40.137]) {
    const current = { ...compressed, duration, boundaries: [{ ...compressed.boundaries[0]!, end: duration }] };
    const grouped = villageFilmShots(current);
    expect(grouped.length).toBeLessThanOrEqual(7);
    expect(grouped.at(-1)!.end).toBe(duration);
    grouped.forEach((shot, index) => {
      expect(shot.end - shot.start).toBeGreaterThanOrEqual(2);
      expect(shot.start).toBe(index === 0 ? 0 : grouped[index - 1]!.end);
    });
  }
});

const pose = (camera: PerspectiveCamera) => [...camera.position.toArray(), ...camera.quaternion.toArray(), camera.fov, camera.zoom];

it.each([3.137, 21.137, 40.019])('samples an exact fractional endpoint and keeps cached seekable poses at duration %f', duration => {
  const source = timeline(), times: number[] = [];
  const route = { ...source, duration, boundaries: [{ stop: 9, kind: 'contact' as const,
    authoredStart: 0, authoredEnd: 25, start: 0, end: duration }] };
  const machine: VillageCameraMachine = {
    sample: (time, target) => { times.push(time); target.set(time, 4, 0); },
    bounds: target => { target.set(new Vector3(-2, 2, -2), new Vector3(duration + 2, 6, 2)); },
    contactBounds: (_stop, target) => { target.copy(new Box3(new Vector3(-2, 2, -2), new Vector3(2, 6, 2))); },
  };
  const choreography = new VillageFilmCamera(machine, route), camera = new PerspectiveCamera();
  expect(times).toContain(0); expect(times).toContain(duration);
  expect(times.every(time => time >= 0 && time <= duration)).toBe(true);
  const samples = times.length;
  for (const motion of [true, false]) {
    choreography.apply(camera, 0, motion); const rest = pose(camera);
    for (const time of [0.123, duration / 2, duration - 0.00001]) {
      choreography.apply(camera, time, motion); const expected = pose(camera);
      choreography.apply(camera, duration - time, motion); choreography.apply(camera, time, motion);
      expect(pose(camera)).toEqual(expected);
    }
    choreography.apply(camera, duration, motion); expect(pose(camera)).toEqual(rest);
    choreography.apply(camera, duration + 10, motion); expect(pose(camera)).toEqual(rest);
    const steps = Math.ceil(duration * 30);
    for (let frame = 0; frame <= steps; frame++) {
      const time = duration * frame / steps;
      choreography.apply(camera, time, motion);
      expect(sphereFramed(camera, new Vector3(time, 4, 0)), `fractional film at ${time}, cameraMotion=${motion}`).toBe(true);
      expect(camera.fov).toBe(34); expect(camera.zoom).toBe(1);
    }
  }
  choreography.resize(1280 / 800); choreography.apply(camera, duration);
  expect(times).toHaveLength(samples);
});

it('consumes a ready Program with derived timing while leaving its authored camera metadata intact', () => {
  const stations: VillageStation[] = Array.from({ length: 10 }, (_, index) => {
    const length = Math.hypot(1, 0.2), port = (x: number) => villagePort([x, 10 - x * 0.2, 0],
      [1 / length, -0.2 / length, 0], [0.2 / length, 1 / length, 0]);
    const entry = port(index * 3), exit = port(index * 3 + 2), start = 0.2 + index * 1.5;
    return { stop: 9 - index, anchor: entry.position, badge: entry.position, entry, exit,
      start, contact: start + 0.2, end: start + 1.2, color: 0xabcdef, mechanism: { kind: 'channel', points: [entry, exit] } };
  });
  const authored = timeline().authoredPlan;
  const route = new VillageProgram({ ...authored, stations, connectors: stations.slice(0, -1).map((station, index) => ({
    from: station.stop, to: stations[index + 1]!.stop, points: [station.exit, stations[index + 1]!.entry],
  })) });
  expect(route.motionStatus.state).toBe('ready'); expect(route.duration).not.toBe(25);
  expect(route.plan.camera).toBe(route.authoredPlan.camera);
  const shots = villageFilmShots(route);
  expect(shots.at(-1)!.end).toBe(route.duration);
  shots.forEach(shot => expect(shot.end - shot.start).toBeGreaterThanOrEqual(2));
});

it('rejects invalid physical duration and missing required compiled boundaries', () => {
  for (const duration of [0, 1.99, NaN, Infinity]) expect(() => villageFilmShots({ ...timeline(), duration })).toThrow('physical seconds');
  expect(() => villageFilmShots({ ...timeline(), boundaries: [] })).toThrow('compiled time boundaries');
});
