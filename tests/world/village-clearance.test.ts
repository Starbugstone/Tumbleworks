import { BoxGeometry, Group, Mesh, MeshBasicMaterial, Triangle, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { VILLAGE_RADIUS } from '../../src/world/village-plan';
import { surfaceTriangles } from './surface-overlap';
import { exposedOverlaps, solidProbes, sphereCollision, sphereSupported, trackCrossings, visible } from './village-geometry';
import { capsulePenetrations } from './triangle-clearance';
import { straightMachine } from './village-runtime-fixture';
import { villageWorld } from './village-world-fixture';
import { normalAt, portEdges } from './village-frame';
import { isVillageTrack } from '../../src/view/machine-primitives';
import { assertVillagePortMatch } from '../../src/world/village-program';
import { villageScenePlan } from '../../src/world/village-plans';
import { compileTerrain, terrainHeightAt } from '../../src/world/village-terrain';

it('rejects a thin crossing solid between safe endpoints using the extracted swept-sphere guard', () => {
  const material = new MeshBasicMaterial(), geometry = new BoxGeometry(0.02, 2, 2), wall = new Mesh(geometry, material);
  wall.name = 'thin-crossing-wall';
  try {
    const probe = solidProbes(wall, VILLAGE_RADIUS)[0]!;
    const before = new Vector3(-1, 0, 0), after = new Vector3(1, 0, 0);
    expect(sphereCollision([probe], before, VILLAGE_RADIUS)).toBeNull();
    expect(sphereCollision([probe], after, VILLAGE_RADIUS)).toBeNull();
    expect(capsulePenetrations(before, after, probe.triangles, VILLAGE_RADIUS)).not.toBeNull();
    wall.position.z = 2; wall.updateWorldMatrix(true, false);
    expect(sphereCollision([probe], new Vector3(), VILLAGE_RADIUS)).toBeNull();
  } finally { geometry.dispose(); material.dispose(); }
});

it('rejects an obstacle at the full track edge although the marble centre and sphere clear it', () => {
  const material = new MeshBasicMaterial(), trackGeometry = new BoxGeometry(4, 0.1, 0.8), obstacleGeometry = new BoxGeometry(0.2, 0.2, 0.1);
  const track = new Mesh(trackGeometry, material), obstacle = new Mesh(obstacleGeometry, material), root = new Group();
  track.name = 'full-width-track'; track.position.y = -0.35;
  obstacle.name = 'support-through-track-edge'; obstacle.position.set(0, -0.35, 0.38); root.add(track, obstacle);
  try {
    const probe = solidProbes(obstacle, VILLAGE_RADIUS);
    expect(sphereCollision(probe, new Vector3(), VILLAGE_RADIUS)).toBeNull();
    expect(trackCrossings(surfaceTriangles(track), surfaceTriangles(obstacle)).length).toBeGreaterThan(0);
    obstacle.position.z = 0.6;
    expect(trackCrossings(surfaceTriangles(track), surfaceTriangles(obstacle))).toEqual([]);
  } finally { trackGeometry.dispose(); obstacleGeometry.dispose(); material.dispose(); }
});

it('rejects exposed duplicate floors but accepts separated surfaces and a true shared edge', () => {
  const geometry = new BoxGeometry(1, 0.1, 1), material = new MeshBasicMaterial(), root = new Group();
  const floor = new Mesh(geometry, material), duplicate = new Mesh(geometry, material); root.add(floor, duplicate);
  try {
    expect(exposedOverlaps(surfaceTriangles(root)).length).toBeGreaterThan(0);
    duplicate.position.y = -0.12;
    expect(exposedOverlaps(surfaceTriangles(root))).toEqual([]);
    duplicate.position.set(1, 0, 0);
    expect(exposedOverlaps(surfaceTriangles(root))).toEqual([]);
  } finally { geometry.dispose(); material.dispose(); }
});

it('checks actual transformed mesh triangles at both ends of carrier travel', () => {
  const geometry = new BoxGeometry(0.1, 1, 1), material = new MeshBasicMaterial(), mover = new Mesh(geometry, material);
  mover.name = 'carrier'; mover.position.x = -1;
  try {
    const probes = solidProbes(mover, VILLAGE_RADIUS);
    expect(sphereCollision(probes, new Vector3(), VILLAGE_RADIUS)).toBeNull();
    mover.position.x = 0.2;
    expect(sphereCollision(probes, new Vector3(), VILLAGE_RADIUS)?.surface).toBe('carrier');
    mover.position.x = 1;
    expect(sphereCollision(probes, new Vector3(), VILLAGE_RADIUS)).toBeNull();
  } finally { geometry.dispose(); material.dispose(); }
});

it('checks the new runtime deck and visible suspension through complete carrier travel', () => {
  const { machine, dispose } = straightMachine(), center = new Vector3();
  try {
    const probes = solidProbes(machine.root, VILLAGE_RADIUS);
    expect(probes.reduce((sum, probe) => sum + probe.triangles.length, 0)).toBeGreaterThan(100);
    for (const reduced of [false, true]) for (let frame = 0; frame <= 180; frame++) {
      const time = frame / 120; machine.apply(time, reduced); machine.sample(time, center);
      expect(sphereCollision(probes, center, VILLAGE_RADIUS), `new runtime carrier at ${time}, reduced=${reduced}`).toBeNull();
      expect(sphereSupported(probes, center, new Vector3(0, 1, 0), VILLAGE_RADIUS), `real carrier contact at ${time}`).toBe(true);
    }
  } finally { dispose(); }
});

it.each([0, 1, 2, 3, 4, 5])('village %i: actual marble clears every rendered solid and stays supported in both motion modes', chapter => {
  const { world, probe, dispose } = villageWorld(chapter), center = new Vector3(), normal = new Vector3();
  const terrain = compileTerrain(villageScenePlan(chapter).terrain);
  try {
    const probes = solidProbes(world.scene, VILLAGE_RADIUS);
    expect(probes.length).toBeGreaterThan(10);
    for (const reduced of [false, true]) for (let frame = 0; frame <= 25 * 120; frame++) {
      const time = frame / 120; world.film(time, !reduced); probe.machine.sample(time, center);
      const collision = sphereCollision(probes, center, VILLAGE_RADIUS);
      expect(collision, `village ${chapter}, seconds ${time}, reduced=${reduced}, point=${JSON.stringify(center.toArray())}, collision=${JSON.stringify(collision)}`).toBeNull();
      normalAt(probe.machine.route, time, normal);
      expect(sphereSupported(probes, center, normal, VILLAGE_RADIUS), `unsupported marble: village ${chapter}, seconds ${time}`).toBe(true);
      const ground = terrainHeightAt(terrain, center.x, center.z);
      if (ground !== undefined) expect(center.y - VILLAGE_RADIUS, `inside terrain: village ${chapter}, seconds ${time}`).toBeGreaterThanOrEqual(ground - 0.002);
    }
  } finally { dispose(); }
}, 30_000);

it.each([0, 1, 2, 3, 4, 5])('village %i: complete rolling segments sweep clear of actual static triangles and ports join across their width', chapter => {
  const { world, probe, dispose } = villageWorld(chapter, true);
  try {
    const moverNames = new Set(probe.machine.route.contacts.flatMap(contact => contact.moverIds));
    moverNames.add('workshop-hammer-sign');
    const staticTriangles = surfaceTriangles(world.scene).filter(surface => {
      if (!visible(surface.mesh)) return false;
      for (let parent: import('three').Object3D | null = surface.mesh; parent; parent = parent.parent) if (moverNames.has(parent.name)) return false;
      return true;
    }).map(surface => ({ triangle: new Triangle(surface.a, surface.b, surface.c),
      bounds: surface.bounds.clone().expandByScalar(VILLAGE_RADIUS), name: surface.mesh.name || surface.mesh.parent?.name || 'static-village' }));
    expect(staticTriangles.length).toBeGreaterThan(100);
    for (const segment of probe.machine.route.segments) {
      const station = probe.plan.stations.find(station => station.stop === segment.stop)!;
      if (segment.kind === 'contact' && !isVillageTrack(station.mechanism)) continue;
      for (let index = 1; index < segment.points.length; index++) {
        const start = new Vector3(...segment.points[index - 1]!.position), end = new Vector3(...segment.points[index]!.position);
        const collision = capsulePenetrations(start, end, staticTriangles, VILLAGE_RADIUS);
        expect(collision, `full rolling sweep, village ${chapter}, stop ${segment.stop}, segment ${index}, collision=${JSON.stringify(collision)}`).toBeNull();
      }
    }
    for (const connector of probe.plan.connectors) {
      const source = probe.plan.stations.find(station => station.stop === connector.from)!;
      const destination = probe.plan.stations.find(station => station.stop === connector.to)!;
      for (const [actual, expected] of [[connector.points[0]!, source.exit], [connector.points.at(-1)!, destination.entry]]) {
        expect(() => assertVillagePortMatch(actual!, expected!)).not.toThrow();
        const edges = portEdges(actual!), other = portEdges(expected!);
        edges.forEach((point, index) => expect(point.distanceTo(other[index]!)).toBeLessThan(1e-6));
      }
    }
  } finally { dispose(); }
}, 30_000);

it.each([0, 1, 2, 3, 4, 5])('village %i: full track faces and moving handoffs have no crossing solids or exposed coincident faces', chapter => {
  const { world, probe, dispose } = villageWorld(chapter, true);
  try {
    const times = [...new Set([0, ...probe.plan.stations.flatMap(station => [station.start, station.contact,
      station.contact + (station.end - station.contact) * 0.4, station.contact + (station.end - station.contact) * 0.8, station.end])])].sort((a, b) => a - b);
    for (const time of times) {
      world.film(time);
      const surfaces = surfaceTriangles(world.scene).filter(surface => visible(surface.mesh) && surface.mesh !== probe.marble?.mesh);
      const tracks = surfaces.filter(surface => surface.mesh.name.startsWith('village-track-'));
      expect(tracks.length, 'inspect actual unbatched profile triangles').toBeGreaterThan(100);
      const crossings = trackCrossings(tracks, surfaces);
      expect(crossings.slice(0, 10), `whole track width, village ${chapter} at ${time}: ${JSON.stringify(crossings.slice(0, 10))}`).toEqual([]);
      const overlaps = exposedOverlaps(surfaces);
      expect(overlaps.slice(0, 10).map(overlap => ({ a: overlap.a.mesh.name || overlap.a.mesh.parent?.name,
        b: overlap.b.mesh.name || overlap.b.mesh.parent?.name, point: overlap.point.toArray(), area: overlap.area })),
      `exposed surfaces, village ${chapter} at ${time}`).toEqual([]);
    }
  } finally { dispose(); }
}, 60_000);
