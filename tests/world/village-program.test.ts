import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { VillageProgram, assertVillagePortMatch, validateVillagePlan } from '../../src/world/village-program';
import { villagePort, type VillagePlan, type VillageStation, type VillageMechanism, type VillageProfile } from '../../src/world/village-plan';
import { mechanismPorts, mechanismMatrix, villageBezier, villageChannelGeometry, villageSpanGeometry, villageBearingCap, villageArc } from '../../src/view/machine-primitives';
import { solidProbes, sphereCollision, sphereSupported, trackCrossings, exposedOverlaps } from './village-geometry';
import { surfaceTriangles } from './surface-overlap';
import { VillageMachine } from '../../src/view/village-machine';

function fixture(): VillagePlan {
  const stations: VillageStation[] = [];
  for (let stop = 9; stop >= 0; stop--) {
    const i = 9 - stop, anchor = [i * 3, 3, 0] as const;
    const mechanism: VillageMechanism = stop === 9 ? { kind: 'translating', travel: [0, 1, 0] }
      : { kind: 'channel', points: [villagePort([anchor[0] - 0.8, 4, 0]), villagePort([anchor[0] + 0.8, 4, 0])] };
    stations.push({ stop, anchor, badge: anchor, mechanism, ...mechanismPorts(mechanism, anchor), start: i * 2.3, contact: i * 2.3 + 0.2, end: i * 2.3 + 1.5, color: 0xaabbcc });
  }
  const connectors = stations.slice(0, -1).map((s, i) => ({ from: s.stop, to: stations[i + 1]!.stop, points: [s.exit, stations[i + 1]!.entry] }));
  return { chapter: 0, profile: 'plank', stations, connectors, camera: [{ start: 0, end: 25, target: [0, 2.5, 0], yaw: 0, elevation: 50 * Math.PI / 180, radius: 66 }] };
}

describe('village program contract', () => {
  it.each<VillageProfile>(['plank', 'timber', 'terracotta', 'girder', 'steel', 'twinrail'])('joins a banked %s web to actual underside edges', profile => {
    const points = [villagePort([0, 4, 0]), villagePort([1, 4, 0], [1, 0, 0], [0, Math.cos(.6), Math.sin(.6)])];
    const material = new THREE.MeshBasicMaterial();
    const deck = new THREE.Mesh(villageChannelGeometry(points, profile), material);
    const web = new THREE.Mesh(villageSpanGeometry(points, profile), material);
    try {
      expect(trackCrossings(surfaceTriangles(deck), surfaceTriangles(web))).toEqual([]);
      const a = deck.geometry.getAttribute('position'), b = web.geometry.getAttribute('position');
      for (const index of [0, 3, 4, 7]) {
        const edge = new THREE.Vector3().fromBufferAttribute(b, index);
        let distance = Infinity;
        for (let i = 0; i < a.count; i++) distance = Math.min(distance, edge.distanceTo(new THREE.Vector3().fromBufferAttribute(a, i)));
        expect(distance, 'web rim must use a real underside vertex').toBeLessThan(1e-6);
      }
    } finally { deck.geometry.dispose(); web.geometry.dispose(); material.dispose(); }
  });
  it.each<VillageProfile>(['plank', 'timber', 'terracotta', 'girder', 'steel', 'twinrail'])('joins the %s receiver wall at the deck end without crossing faces', profile => {
    const base = fixture(), source = base.stations[0]!;
    const mechanism: VillageMechanism = { kind: 'receiver', travel: 0 };
    const station = { ...source, mechanism, ...mechanismPorts(mechanism, source.anchor) };
    const plan = { ...base, profile, stations: [station, ...base.stations.slice(1)],
      connectors: base.connectors.map((c, i) => i ? c : { ...c, points: [station.exit, c.points[1]!] }) };
    const batching = vi.spyOn(VillageMachine.prototype as unknown as { merge(group: THREE.Group): void }, 'merge').mockImplementation(() => undefined);
    const material = new THREE.MeshBasicMaterial();
    let machine: VillageMachine;
    try { machine = new VillageMachine(plan, { model: () => new THREE.Group() }, material, () => 0); }
    finally { batching.mockRestore(); }
    try {
      const carrier = machine.root.getObjectByName('village-9-carrier')!;
      const faces = surfaceTriangles(carrier), tracks = faces.filter(face => face.mesh.name.startsWith('village-track-'));
      expect(trackCrossings(tracks, faces.filter(face => !face.mesh.name.startsWith('village-track-')))).toEqual([]);
    } finally { machine.dispose(); material.dispose(); }
  });
  it.each<VillageProfile>(['plank', 'timber', 'terracotta', 'girder', 'steel', 'twinrail'])('keeps %s support caps beneath a pitched and banked floor', profile => {
    const material = new THREE.MeshBasicMaterial(), plan = { ...fixture(), profile };
    const machine = new VillageMachine(plan, { model: () => new THREE.Group() }, material, () => 0);
    const tangent = new THREE.Vector3(Math.cos(.4), Math.sin(.4), 0);
    const normal = new THREE.Vector3(-Math.sin(.4), Math.cos(.4), 0).applyAxisAngle(tangent, .35);
    const center = new THREE.Vector3(0, 4, 0);
    const port = (p: THREE.Vector3) => villagePort(p.toArray() as [number, number, number], tangent.toArray() as [number, number, number], normal.toArray() as [number, number, number]);
    const points = [port(center.clone().addScaledVector(tangent, -2)), port(center), port(center.clone().addScaledVector(tangent, 2))];
    const track = new THREE.Mesh(villageChannelGeometry(points, profile), material);
    const impl = machine as unknown as { support(s: VillageStation, p: readonly [number, number, number], explicit: boolean, frame: typeof points[number]): void };
    try {
      impl.support(plan.stations[0]!, [0, 4, 0], false, points[1]!);
      const mount = machine.staticSolids[9]!.children.at(-1)!;
      expect(trackCrossings(surfaceTriangles(track), surfaceTriangles(mount))).toEqual([]);
    } finally { machine.dispose(); track.geometry.dispose(); material.dispose(); }
  });
  it.each<VillageProfile>(['plank', 'timber', 'terracotta', 'girder', 'steel', 'twinrail'])('clips the %s bearing roof from curved rendered underside triangles', profile => {
    const points = villageArc([0, 4, 0], 1.5, 0, Math.PI / 2, [1, 0, 0], [0, 0, 1], -.5, 24);
    const frame = points[12]!, material = new THREE.MeshBasicMaterial();
    const track = new THREE.Mesh(villageChannelGeometry(points, profile), material);
    const cap = new THREE.Mesh(villageBearingCap(points.slice(4, 21), profile, frame, frame.position), material);
    try {
      expect(trackCrossings(surfaceTriangles(track), surfaceTriangles(cap))).toEqual([]);
      expect(cap.geometry.getAttribute('position').count).toBeGreaterThan(24);
    } finally { track.geometry.dispose(); cap.geometry.dispose(); material.dispose(); }
  });
  it('keeps vertical lift guide and yoke faces separated at both travel ends', () => {
    const material = new THREE.MeshBasicMaterial();
    const batching = vi.spyOn(VillageMachine.prototype as unknown as { merge(group: THREE.Group): void }, 'merge').mockImplementation(() => undefined);
    let machine: VillageMachine;
    try { machine = new VillageMachine(fixture(), { model: () => new THREE.Group() }, material, () => 0); }
    finally { batching.mockRestore(); }
    try {
      for (const time of [0, 1.5]) {
        machine.apply(time);
        expect(exposedOverlaps(surfaceTriangles(machine.groups[9]!))).toEqual([]);
      }
    } finally { machine.dispose(); material.dispose(); }
  });
  it('accepts explicit generated ports and rejects position/frame/width mutants', () => {
    const plan = fixture(); expect(() => validateVillagePlan(plan)).not.toThrow();
    const port = plan.stations[0]!.entry;
    for (const broken of [ { ...port, position: [99, 0, 0] as const }, { ...port, tangent: [-1, 0, 0] as const }, { ...port, normal: [0, -1, 0] as const }, { ...port, width: 0.9 } ]) {
      expect(() => assertVillagePortMatch(port, broken)).toThrow();
    }
    expect(() => validateVillagePlan({ ...plan, connectors: [] })).toThrow();
    expect(() => validateVillagePlan({ ...plan, stations: plan.stations.map((s, i) => i ? s : { ...s, contact: s.end + 1 }) })).toThrow();
  });
  it('handoff seeks the real first carrier after arrival and preserves physical motion', () => {
    const plan = fixture(), material = new THREE.MeshBasicMaterial();
    const machine = new VillageMachine(plan, { model: () => new THREE.Group() }, material, () => 0);
    const point = new THREE.Vector3(), expected = new THREE.Vector3();
    const carrier = machine.root.getObjectByName('village-9-carrier')!;
    machine.handoff(1, point);
    expect(point.toArray()).toEqual([...plan.stations[0]!.entry.position]);
    const initial = carrier.matrix.clone();
    for (const seconds of [1.72, 2.5, 1.72]) {
      const time = machine.route.handoff.entryTime + seconds - 1;
      machine.sample(time, expected);
      machine.apply(time, true); const reduced = carrier.matrix.clone();
      machine.handoff(seconds, point);
      expect(point.distanceTo(expected)).toBeLessThan(1e-9);
      expect(carrier.matrix.equals(reduced)).toBe(true);
      expect(carrier.matrix.equals(initial)).toBe(false);
    }
    machine.handoff(0, point); expect(carrier.matrix.equals(initial)).toBe(true);
    machine.dispose(); material.dispose();
  });
  it('keeps striker solids clear during approach, actuation and departure', () => {
    const original = fixture();
    const stations = original.stations.map((s, i) => {
      if (!i) return s;
      const mechanism: VillageMechanism = { kind: 'channel', points: [villagePort([s.anchor[0] - .8, 3, 0]), villagePort([s.anchor[0] + .8, 3, 0])] };
      return { ...s, mechanism, ...mechanismPorts(mechanism, s.anchor) };
    });
    const base = { ...original, stations, connectors: stations.slice(0, -1).map((s, i) => ({ from: s.stop, to: stations[i + 1]!.stop, points: [s.exit, stations[i + 1]!.entry] })) }, first = stations[0]!;
    const mechanism: VillageMechanism = { kind: 'striker', travel: 0.6 };
    const station = { ...first, mechanism, ...mechanismPorts(mechanism, first.anchor) };
    const plan = { ...base, stations: [station, ...base.stations.slice(1)], connectors: base.connectors.map((c, i) => i ? c : { ...c, points: [station.exit, c.points[1]!] }) };
    const material = new THREE.MeshBasicMaterial(), machine = new VillageMachine(plan, { model: () => new THREE.Group() }, material, () => 0);
    const probes = solidProbes(machine.groups[9]!, .3), point = new THREE.Vector3();
    for (let frame = 0; frame <= 90; frame++) {
      const time = station.end * frame / 90;
      machine.apply(time); machine.sample(time, point);
      expect(sphereCollision(probes, point, .3), `time ${time}`).toBeNull();
      expect(sphereSupported(probes, point, new THREE.Vector3(0, 1, 0), .3)).toBe(true);
    }
    machine.dispose(); material.dispose();
  });
  it('rejects guessed moving docks', () => {
    const plan = fixture();
    expect(() => validateVillagePlan({ ...plan, stations: plan.stations.map((s, i) => i ? s : { ...s, exit: s.entry }) })).toThrow(/mismatch/);
  });
  it('rejects a shaft through the marble instead of hiding it', () => {
    const plan = fixture(), s = plan.stations[0]!;
    const mechanism: VillageMechanism = { kind: 'tipping', pivot: [0, 0, 0], axis: [0, 0, 1], angle: 0.2 };
    const replacement = { ...s, mechanism, ...mechanismPorts(mechanism, s.anchor) };
    expect(() => validateVillagePlan({ ...plan, stations: [replacement, ...plan.stations.slice(1)] })).toThrow(/shaft/);
  });
  it('seeks the exact shared carrier transform in either direction', () => {
    const plan = fixture(), program = new VillageProgram(plan), p = new THREE.Vector3();
    program.sample(0.72, p);
    const expected = new THREE.Vector3().applyMatrix4(mechanismMatrix(plan.stations[0]!.mechanism, plan.stations[0]!.anchor, 0.5, new THREE.Matrix4()));
    expect(p.distanceTo(expected)).toBeLessThan(1e-9);
    program.sample(24, p); program.sample(0.72, p); expect(p.distanceTo(expected)).toBeLessThan(1e-9);
    program.sample(0, p); expect(p.toArray()).toEqual([...plan.stations[0]!.entry.position]);
    program.sample(25, p); expect(p.toArray()).toEqual([...plan.stations[9]!.exit.position]);
    expect(program.duration).toBe(25); expect(program.contacts).toHaveLength(10);
  });
  it('keeps complete mover identities and reduced physical motion', () => {
    const plan = fixture(), s = plan.stations[0]!;
    const mechanism: VillageMechanism = { kind: 'escapement', travel: 1 };
    const replacement = { ...s, mechanism, ...mechanismPorts(mechanism, s.anchor) };
    const changed = { ...plan, stations: [replacement, ...plan.stations.slice(1)], connectors: plan.connectors.map((c, i) => i ? c : { ...c, points: [replacement.exit, c.points[1]!] }) };
    const machine = new VillageMachine(changed, { model: () => new THREE.Group() }, new THREE.MeshBasicMaterial(), () => 0);
    const record = machine.route.contacts.find(c => c.stop === 9)!;
    expect(record.moverIds).toEqual(['village-9-escapement', 'village-9-gear', 'village-9-top']);
    record.moverIds.forEach(id => expect(machine.root.getObjectByName(id)).toBeDefined());
    machine.apply(0.72, false); const first = machine.root.toJSON();
    machine.apply(0.72, true); expect(machine.root.toJSON()).toEqual(first); machine.dispose();
  });
  it('keeps every profile outside the supported sphere with real contact', () => {
    const points = [villagePort([-0.8, 0, 0]), villagePort([0.8, 0, 0])];
    const triangle = new THREE.Triangle(), closest = new THREE.Vector3(), centre = new THREE.Vector3();
    for (const profile of ['plank', 'terracotta', 'timber', 'twinrail', 'girder', 'steel'] satisfies VillageProfile[]) {
      const geometry = villageChannelGeometry(points, profile), position = geometry.getAttribute('position'), index = geometry.getIndex()!;
      let distance = Infinity;
      for (let i = 0; i < index.count; i += 3) {
        triangle.a.fromBufferAttribute(position, index.getX(i)); triangle.b.fromBufferAttribute(position, index.getX(i + 1)); triangle.c.fromBufferAttribute(position, index.getX(i + 2));
        triangle.closestPointToPoint(centre, closest); distance = Math.min(distance, closest.length());
      }
      expect(distance, profile).toBeGreaterThanOrEqual(0.3 - 1e-6);
      expect(distance, profile).toBeLessThan(0.306); geometry.dispose();
    }
  });
  it.each<VillageMechanism>([
    { kind: 'release', travel: [0.2, -0.4, 0] },
    { kind: 'suspended', travel: [2, 0.4, 1] },
    { kind: 'wheelbucket', radius: 1, angle: Math.PI },
    { kind: 'tipping', pivot: [0, -0.5, 0], axis: [0, 0, 1], angle: -0.3 },
    { kind: 'turntable', pivot: [-0.5, -0.5, 0], axis: [0, 1, 0], angle: 1 },
    { kind: 'launcher', pivot: [0.7, -0.5, 0], axis: [0, 0, 1], angle: -0.4 },
  ])('keeps $kind cargo on its actual carrier and bounds every pose', mechanism => {
    const plan = fixture(), s = plan.stations[0]!;
    const replacement = { ...s, mechanism, ...mechanismPorts(mechanism, s.anchor) };
    const next = plan.stations[1]!;
    const c1 = new THREE.Vector3(...replacement.exit.position).add(new THREE.Vector3(...replacement.exit.tangent));
    const c2 = new THREE.Vector3(...next.entry.position).sub(new THREE.Vector3(...next.entry.tangent));
    const points = villageBezier(replacement.exit, [c1.x, c1.y, c1.z], [c2.x, c2.y, c2.z], next.entry);
    const changed = { ...plan, stations: [replacement, ...plan.stations.slice(1)], connectors: plan.connectors.map((c, i) => i ? c : { ...c, points }) };
    const machine = new VillageMachine(changed, { model: () => new THREE.Group() }, new THREE.MeshBasicMaterial(), () => 0);
    const point = new THREE.Vector3(), expected = new THREE.Vector3(), bounds = new THREE.Box3(); machine.contactBounds(9, bounds);
    for (const t of [0.3, 0.72, 1.1, 0.3]) {
      machine.apply(t); machine.sample(t, point);
      const carrier = machine.root.getObjectByName('village-9-carrier')!;
      expected.set(0, 0, 0).applyMatrix4(carrier.matrix); expect(point.distanceTo(expected)).toBeLessThan(1e-8);
      const actual = new THREE.Box3().setFromObject(carrier); expect(bounds.containsBox(actual)).toBe(true);
      const whole = new THREE.Box3(); machine.bounds(whole);
      expect(whole.containsBox(new THREE.Box3().setFromObject(machine.groups[9]!))).toBe(true);
    }
    machine.dispose();
  });
  it('requires authored bank supports over voids rather than inventing seabed', () => {
    const plan = fixture(), material = new THREE.MeshBasicMaterial(), assets = { model: () => new THREE.Group() };
    const height = (x: number): number | undefined => x > 1.1 && x < 1.9 ? undefined : 0;
    expect(() => new VillageMachine(plan, assets, material, height)).toThrow(/void/);
    const supported: VillagePlan = { ...plan, connectors: plan.connectors.map((c, i) => i ? c : {
      ...c, span: 'girder', supports: [[0.8, 3.4, 0], [2.2, 3.4, 0]],
    }) };
    const machine = new VillageMachine(supported, assets, material, height); machine.dispose();
    expect(() => new VillageMachine({ ...supported, connectors: supported.connectors.map((c, i) => i ? c : { ...c, supports: [[1.5, 3.4, 0], [2.2, 3.4, 0]] }) }, assets, material, height)).toThrow(/no ground/);
  });
  it('clears every wheel assembly solid through its orbit and catches a rotor in the cargo plane', () => {
    const base = fixture();
    const stations = base.stations.map(s => {
      const anchor = [-s.anchor[0], s.anchor[1], s.anchor[2]] as const;
      const mechanism: VillageMechanism = s.stop === 9 ? { kind: 'wheelbucket', radius: 1, angle: Math.PI }
        : { kind: 'channel', points: [villagePort([anchor[0] + 0.8, 4, 0], [-1, 0, 0]), villagePort([anchor[0] - 0.8, 4, 0], [-1, 0, 0])] };
      return { ...s, anchor, mechanism, ...mechanismPorts(mechanism, anchor) };
    });
    const connectors = stations.slice(0, -1).map((s, i) => {
      const to = stations[i + 1]!;
      return { from: s.stop, to: to.stop, points: villageBezier(s.exit, [s.exit.position[0] - 1, s.exit.position[1], 0], [to.entry.position[0] + 1, to.entry.position[1], 0], to.entry),
        // The lower intake must remain open underneath this upper outlet.
        supports: [[to.entry.position[0], to.entry.position[1] - 0.4, 0] as const] };
    });
    const machine = new VillageMachine({ ...base, stations, connectors }, { model: () => new THREE.Group() }, new THREE.MeshBasicMaterial(), () => 0);
    const meshes: THREE.Mesh[] = []; machine.groups[9]!.traverse(o => { if (o instanceof THREE.Mesh) meshes.push(o); });
    const point = new THREE.Vector3(), closest = new THREE.Vector3(), triangle = new THREE.Triangle();
    const clearance = (): number => {
      let result = Infinity;
      for (let frame = 0; frame <= 40; frame++) {
        const time = 1.5 * frame / 40; machine.apply(time); machine.sample(time, point); machine.root.updateMatrixWorld(true);
        for (const mesh of meshes) {
          const position = mesh.geometry.getAttribute('position'), index = mesh.geometry.getIndex(), count = index?.count ?? position.count;
          for (let i = 0; i < count; i += 3) {
            triangle.a.fromBufferAttribute(position, index ? index.getX(i) : i).applyMatrix4(mesh.matrixWorld);
            triangle.b.fromBufferAttribute(position, index ? index.getX(i + 1) : i + 1).applyMatrix4(mesh.matrixWorld);
            triangle.c.fromBufferAttribute(position, index ? index.getX(i + 2) : i + 2).applyMatrix4(mesh.matrixWorld);
            triangle.closestPointToPoint(point, closest); result = Math.min(result, closest.distanceTo(point));
          }
        }
      }
      return result;
    };
    expect(clearance()).toBeGreaterThanOrEqual(0.3 - 1e-6);
    machine.root.getObjectByName('village-9-wheel')!.traverse(object => {
      if (object instanceof THREE.Mesh) object.geometry.translate(0, 0, .65);
    });
    expect(clearance()).toBeLessThan(0.29); machine.dispose();
  });
  it('builds compact explicit curves with matching endpoint frames', () => {
    const from = villagePort([0, 2, 0]), to = villagePort([4, 2, 0]);
    const points = villageBezier(from, [1, 2, 0], [3, 2, 0], to);
    expect(() => assertVillagePortMatch(points[0]!, from)).not.toThrow();
    expect(() => assertVillagePortMatch(points[points.length - 1]!, to)).not.toThrow();
  });
  it('excludes distant outgoing track from contact bounds but includes it in cached whole bounds', () => {
    const base = fixture(), first = base.connectors[0]!;
    const middle = villagePort([1.5, 4, 30]);
    const points = [...villageBezier(first.points[0]!, [1.1, 4, 0], [1.2, 4, 30], middle),
      ...villageBezier(middle, [1.8, 4, 30], [1.9, 4, 0], first.points[1]!).slice(1)];
    const material = new THREE.MeshBasicMaterial();
    const machine = new VillageMachine({ ...base, connectors: [{ ...first, points }, ...base.connectors.slice(1)] },
      { model: () => new THREE.Group() }, material, () => 0);
    const contact = new THREE.Box3(), whole = new THREE.Box3();
    machine.apply(.72); const before = machine.root.toJSON();
    machine.contactBounds(9, contact); machine.bounds(whole);
    expect(contact.max.z).toBeLessThan(5);
    expect(whole.containsPoint(new THREE.Vector3(...points[16]!.position))).toBe(true);
    expect(whole.max.z).toBeGreaterThan(20);
    expect(machine.root.toJSON()).toEqual(before);
    whole.makeEmpty(); machine.bounds(whole); expect(whole.max.z).toBeGreaterThan(20);
    machine.dispose(); material.dispose();
  });
  it('exposes conservative cached bounds without changing poses and owns only its geometry', () => {
    const material = new THREE.MeshStandardMaterial({ vertexColors: true }), dispose = vi.spyOn(material, 'dispose');
    const machine = new VillageMachine(fixture(), { model: () => new THREE.Group() }, material, () => 0);
    machine.apply(0.72); const before = machine.root.toJSON();
    const box = new THREE.Box3(), point = new THREE.Vector3(); machine.contactBounds(9, box);
    for (let t = 0; t <= 1.5; t += 0.05) { machine.sample(t, point); expect(box.containsPoint(point)).toBe(true); }
    expect(machine.root.toJSON()).toEqual(before);
    const geometries: THREE.BufferGeometry[] = [];
    machine.root.traverse(o => { if (o instanceof THREE.Mesh) geometries.push(o.geometry); });
    const spies = geometries.map(g => vi.spyOn(g, 'dispose'));
    machine.dispose(); machine.dispose(); expect(dispose).not.toHaveBeenCalled();
    spies.forEach(spy => expect(spy).toHaveBeenCalledTimes(1));
  });
});
