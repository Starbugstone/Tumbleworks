import { Vector3 } from 'three';
import { expect, it } from 'vitest';
import { VillageProgram } from '../../src/world/village-program';
import { CLOCKMAKERS_HILL } from '../../src/world/villages/clockmakers-hill';
import type { VillagePort } from '../../src/world/village-plan';

it('keeps authored connector travel identical when its mesh intervals are subdivided', () => {
  const plan = CLOCKMAKERS_HILL.plan, link = plan.connectors.find(link => link.from === 9)!;
  const points: VillagePort[] = [];
  link.points.forEach((point, index) => {
    points.push(point); const next = link.points[index + 1]; if (!next) return;
    // Refine only the curved mesh, keeping both two-interval dock leads intact.
    if (index < 2 || index >= link.points.length - 3) return;
    const tangent = new Vector3(...point.tangent).add(new Vector3(...next.tangent)).normalize();
    const normal = new Vector3(...point.normal).add(new Vector3(...next.normal));
    normal.addScaledVector(tangent, -normal.dot(tangent)).normalize();
    const position = new Vector3(...point.position).lerp(new Vector3(...next.position), 0.5);
    points.push({ position: [position.x, position.y, position.z], tangent: [tangent.x, tangent.y, tangent.z],
      normal: [normal.x, normal.y, normal.z], width: point.width });
  });
  const original = new VillageProgram(plan);
  const refined = new VillageProgram({ ...plan, connectors: plan.connectors.map(value => value === link ? { ...value, points } : value) });
  const from = original.plan.stations.find(station => station.stop === link.from)!, to = original.plan.stations.find(station => station.stop === link.to)!;
  const left = new Vector3(), right = new Vector3();
  for (let sample = 0; sample <= 100; sample++) {
    const time = from.end + (to.start - from.end) * sample / 100;
    original.sample(time, left); refined.sample(time, right);
    expect(left.distanceTo(right), `travel changed at ${time}`).toBeLessThan(1e-9);
  }
});

it('retains positive continuous velocity at the real Clock release and gate approach joins', () => {
  const plan = CLOCKMAKERS_HILL.plan, program = new VillageProgram(plan);
  const before = new Vector3(), at = new Vector3(), after = new Vector3(), epsilon = 1e-5;
  for (const time of [program.plan.stations.find(station => station.stop === 9)!.end, program.plan.stations.find(station => station.stop === 8)!.start]) {
    program.sample(time - epsilon, before); program.sample(time, at); program.sample(time + epsilon, after);
    const incoming = before.distanceTo(at) / epsilon, outgoing = after.distanceTo(at) / epsilon;
    expect(incoming, `incoming speed at ${time}`).toBeGreaterThan(.2);
    expect(outgoing, `outgoing speed at ${time}`).toBeGreaterThan(.2);
    expect(Math.abs(incoming - outgoing), `ordinary join changes speed at ${time}`).toBeLessThan(.005);
  }
});
