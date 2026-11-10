import { Group, MeshBasicMaterial, Vector3 } from 'three';
import { expect, it } from 'vitest';
import { VillageMachine } from '../../src/view/village-machine';
import { villagePort, type VillagePlan, type VillageStation } from '../../src/world/village-plan';

it('uses the compiled entry clock at one physical second per handoff second', () => {
  const stations: VillageStation[] = Array.from({ length: 10 }, (_, index) => {
    const x = index * 3, start = .2 + index * 1.5, length = Math.hypot(1, .2);
    const frame = (x: number) => villagePort([x, 12 - x * .2, 0], [1 / length, -.2 / length, 0], [.2 / length, 1 / length, 0]);
    const entry = frame(x), exit = frame(x + 2);
    return { stop: 9 - index, anchor: entry.position, badge: entry.position, entry, exit,
      start, contact: start, end: start + 1.2, color: 0xaaaaaa, mechanism: { kind: 'channel', points: [entry, exit] } };
  });
  const plan: VillagePlan = { chapter: 0, profile: 'plank', stations,
    connectors: stations.slice(0, -1).map((station, i) => ({ from: station.stop, to: stations[i + 1]!.stop, points: [station.exit, stations[i + 1]!.entry] })),
    camera: [{ start: 0, end: 25, target: [0, 0, 0], radius: 60, yaw: 0, elevation: .7 }] };
  const material = new MeshBasicMaterial(), machine = new VillageMachine(plan, { model: () => new Group() }, material, () => 0);
  try {
    machine.route.requirePhysical();
    const actual = new Vector3(), expected = new Vector3();
    for (const seconds of [1, 1.5, 2.5, 1.2]) {
      machine.handoff(seconds, actual);
      machine.route.sample(machine.route.handoff.entryTime + seconds - 1, expected);
      expect(actual.distanceTo(expected), `handoff seconds ${seconds}`).toBeLessThan(1e-9);
    }
  } finally { machine.dispose(); material.dispose(); }
});
