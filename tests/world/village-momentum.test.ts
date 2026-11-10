import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { villagePort, type VillagePlan, type VillageStation } from '../../src/world/village-plan';
import { VillageProgram } from '../../src/world/village-program';

// One uninterrupted descending rail, partitioned into construction stops only.
function descendingRun(): VillagePlan {
  const stations: VillageStation[] = Array.from({ length: 10 }, (_, index) => {
    const x = index * 3, start = .2 + index * 1.5;
    const port = (at: number) => villagePort([at, 10 - at * .2, 0], [1 / Math.hypot(1, .2), -.2 / Math.hypot(1, .2), 0], [.2 / Math.hypot(1, .2), 1 / Math.hypot(1, .2), 0]);
    const entry = port(x), exit = port(x + 2);
    return { stop: 9 - index, anchor: entry.position, badge: [x, 12, 0], start, contact: start + .2, end: start + 1.2,
      entry, exit, mechanism: { kind: 'channel', points: [entry, exit] }, color: 0xaabbcc };
  });
  return { chapter: 0, profile: 'plank', stations,
    connectors: stations.slice(0, -1).map((station, index) => ({ from: station.stop, to: stations[index + 1]!.stop, points: [station.exit, stations[index + 1]!.entry] })),
    camera: [{ start: 0, end: 25, target: [0, 2, 0], radius: 66, yaw: 0, elevation: 50 * Math.PI / 180 }] };
}
function speed(program: VillageProgram, time: number, epsilon = 1e-4): number {
  const a = new Vector3(), b = new Vector3();
  program.sample(time - epsilon, a); program.sample(time + epsilon, b);
  return a.distanceTo(b) / (epsilon * 2);
}

it('carries momentum through an ordinary construction-stop join instead of braking', () => {
  const program = new VillageProgram(descendingRun());
  const join = program.segments[0]!.end;
  const approach = Math.min(speed(program, join - .05), speed(program, join + .05));
  expect(speed(program, join), 'a construction boundary is not a physical brake').toBeGreaterThan(approach * .5);
});

it('does not lose speed while rolling down one straight unpowered incline', () => {
  const program = new VillageProgram(descendingRun());
  const first = program.segments[0]!;
  const entering = speed(program, first.start + (first.end - first.start) * .5);
  const leaving = speed(program, first.start + (first.end - first.start) * .9);
  expect(leaving, 'a continued descent cannot shed momentum at a metadata boundary').toBeGreaterThanOrEqual(entering * .99);
});
