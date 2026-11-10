import { Group, MeshBasicMaterial } from 'three';
import { mechanismPorts } from '../../src/view/machine-primitives';
import { VillageMachine } from '../../src/view/village-machine';
import { villagePort, type VillageMechanism, type VillagePlan, type VillageStation } from '../../src/world/village-plan';

/** Small real compiler/renderer fixture; never a substitute for the six authored villages. */
export function straightVillage(): VillagePlan {
  const stations: VillageStation[] = Array.from({ length: 10 }, (_, index) => {
    const stop = 9 - index, anchor = [index * 2.5 - 11.25, index === 0 ? 3 : 4, 0] as const;
    const mechanism: VillageMechanism = index === 0 ? { kind: 'release', travel: [0, 1, 0] }
      : { kind: 'channel', points: [villagePort([anchor[0] - 0.8, 4, 0]), villagePort([anchor[0] + 0.8, 4, 0])] };
    return { stop, anchor, badge: anchor, mechanism, ...mechanismPorts(mechanism, anchor),
      start: index * 2.3, contact: index * 2.3 + 0.2, end: index * 2.3 + 1.5, color: 0x789a90 };
  });
  return { chapter: 0, profile: 'plank', stations,
    connectors: stations.slice(0, -1).map((station, index) => ({ from: station.stop, to: stations[index + 1]!.stop,
      points: [station.exit, stations[index + 1]!.entry] })),
    camera: [{ start: 0, end: 25, target: [0, 4, 0], yaw: 0, elevation: 50 * Math.PI / 180, radius: 66 }] };
}

export function straightMachine() {
  const material = new MeshBasicMaterial({ vertexColors: true }), plan = straightVillage();
  const machine = new VillageMachine(plan, { model: () => new Group() }, material, () => 0);
  return { plan, machine, dispose: () => { machine.dispose(); material.dispose(); } };
}
