import { expect, it } from 'vitest';
import { BufferGeometry, Mesh, MeshBasicMaterial, Triangle, Vector3 } from 'three';
import { villageScenePlan } from '../../src/world/village-plans';
import { VillageRollingPrefix } from '../../src/world/village-prefix';
import { VillageRollingRun } from '../../src/world/village-rolling';
import { villageChannelGeometry } from '../../src/view/machine-primitives';
import { solidProbes, sphereCollision, sphereSupported } from './village-geometry';
import { ORIGINAL_EXIT_NORMALS, REJECTED_MINUS45 } from './pump-bank-before';

function pump() {
  const plan = villageScenePlan(1).plan, prefix = new VillageRollingPrefix(plan);
  const segment = prefix.segments.find(s => s.stop === 2 && s.kind === 'contact');
  const phase = prefix.phases.find(p => p.start === segment?.start && p.end === segment?.end);
  const station = plan.stations.find(s => s.stop === 2)!, receiver = plan.stations.find(s => s.stop === 1)!;
  if (!phase || !(phase.run instanceof VillageRollingRun) || !('points' in station.mechanism) || receiver.mechanism.kind !== 'translating') throw Error('Actual causal rill/pump required');
  const link = plan.connectors.find(c => c.from === 2 && c.to === 1)!;
  const incomingSpeed = phase.run.exitSpeed, precedingPoint = station.mechanism.points.at(-2);
  const run = (points = link.points) => new VillageRollingRun([{ stop: 2, kind: 'connector', points }], incomingSpeed, phase.end, 9.81, 0, 1.4, { profile: 'floor', traction: .8, precedingPoint });
  return { plan, link, run, receiver, start: phase.end, speed: incomingSpeed };
}
it('keeps original traction and -.45 native floor failures while the selected actual c6 cone passes', () => {
  const p = pump();
  expect(p.link.points).toHaveLength(97);
  const original = p.link.points.map((point, i) => i >= 82 && i <= 95 ? { ...point, normal: ORIGINAL_EXIT_NORMALS[i - 82]! } : point);
  expect(() => p.run(original)).toThrow(/vertex 90.*required mu=0\.8069910524199455.*available=0\.8/);
  expect(() => p.run()).not.toThrow();
  const f = REJECTED_MINUS45, triangle = new Triangle(...f.vertices.map(v => new Vector3(...v)) as [Vector3, Vector3, Vector3]), center = new Vector3(...f.center);
  const distance = triangle.closestPointToPoint(center, new Vector3()).distanceTo(center);
  expect(distance).toBeLessThan(.3 - .002);
  expect(distance).toBeCloseTo(f.distance, 14);
});
it('the actual c6 packed floor and all own walls support/clear the full.3 sphere at all nodes, quarters and120Hz', () => {
  const p = pump(), run = p.run(), m = p.receiver.mechanism;
  if (m.kind !== 'translating') throw Error('Actual translation cut required');
  const geometry = villageChannelGeometry(p.link.points, p.plan.profile, { start: undefined, end: m.travel });
  const index = geometry.index!, present = new Set<string>();
  for (let i = 0; i < index.count; i += 3) present.add([index.getX(i), index.getX(i + 1), index.getX(i + 2)].join('/'));
  const floorIds: number[] = [];
  for (let i = 1; i < 97; i++) for (const ids of [[(i - 1) * 12 + 11, i * 12 + 11, (i - 1) * 12], [(i - 1) * 12, i * 12 + 11, i * 12]]) {
    expect(present.has(ids.join('/'))).toBe(true); floorIds.push(...ids);
  }
  const floorGeometry = new BufferGeometry().setAttribute('position', geometry.getAttribute('position')).setIndex(floorIds), material = new MeshBasicMaterial();
  const mesh = new Mesh(geometry, material), floor = new Mesh(floorGeometry, material);
  try {
    const probes = solidProbes(mesh, .3), floors = solidProbes(floor, .3), times = new Set<number>();
    let speed = p.speed, start = p.start;
    for (let i = 1; i < p.link.points.length; i++) {
      const a = p.link.points[i - 1]!.position, b = p.link.points[i]!.position, length = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), acceleration = -9.81 * (b[1] - a[1]) / length / 1.4;
      const next = Math.sqrt(speed * speed + 2 * acceleration * length), end = start + 2 * length / (speed + next);
      for (const u of [0, .25, .5, .75, 1]) times.add(u === 0 ? start : u === 1 ? end : start + 2 * u * length / (speed + Math.sqrt(speed * speed + 2 * acceleration * u * length)));
      speed = next; start = end;
    }
    for (let i = Math.ceil(p.start * 120); i / 120 <= p.start + run.duration; i++) times.add(i / 120);
    const center = new Vector3(), normal = new Vector3();
    for (const t of times) { run.sample(t, center, normal); expect(sphereCollision(probes, center, .3), `OWN penetration at${t}`).toBeNull(); expect(sphereSupported(floors, center, normal, .3), `OWN support at${t}`).toBe(true); }
  } finally { floorGeometry.dispose(); geometry.dispose(); material.dispose(); }
});
