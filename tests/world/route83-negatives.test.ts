// UNUSED / UNRUN. Permanent negatives: the OLD route laws applied to the NEW
// ports must keep failing, and each helper rejects inputs outside its contract.
// Old connectors are restated verbatim here; the live module no longer carries them.
import { expect, it } from 'vitest';
import { GLASSHOUSE_GARDENS, gradedQuarter, splicePost } from '../../src/world/villages/glasshouse-gardens';
import { connect, station as authorStation, turn } from '../../src/world/villages/author';
import { stationPorts, villageChannelGeometry } from '../../src/view/machine-primitives';
import { validateVillagePlan } from '../../src/world/village-program';
import { villagePort, type VillagePort, type VillageStation } from '../../src/world/village-plan';

const plan = GLASSHOUSE_GARDENS.plan;
const station = (stop: number): VillageStation => plan.stations.find(s => s.stop === stop)!;
const grade = (p: VillagePort) => p.tangent[1] / Math.hypot(p.tangent[0], p.tangent[2]);
/** Verbatim pre-route83 settle (glasshouse-gardens.ts 4d0729a0 / 281aaf47, lines 62-72 / 63-73). */
function oldSettledQuarter(from: VillagePort, to: VillagePort): readonly VillagePort[] {
  const radius = from.position[2] - to.position[2], drop = from.position[1] - to.position[1];
  const slope0 = from.tangent[1] / Math.hypot(from.tangent[0], from.tangent[2]);
  const settling = -2 * drop / slope0;
  return turn([from.position[0], from.position[1], to.position[2]], radius, -Math.PI / 2, Math.PI / 2, 0, 64).map((point, i) => {
    const distance = radius * Math.PI / 2 * i / 64, u = Math.min(1, distance / settling);
    const y = to.position[1] + drop * (1 - u) ** 2, slope = -2 * drop * (1 - u) / settling, norm = Math.hypot(1, slope);
    const x = point.tangent[0], z = point.tangent[2];
    return villagePort([point.position[0], y, point.position[2]], [x / norm, slope / norm, z / norm], [-x * slope / norm, 1 / norm, -z * slope / norm]);
  });
}

it('old 7->6 settle on the raised port misses the level rill by .00519 and the plan rejects it', () => {
  const points = oldSettledQuarter(station(7).exit, station(6).entry);
  expect(points.at(-1)!.position[1] - 5.0).toBeCloseTo(.0051855877, 8);
  expect(grade(points.at(-1)!)).toBeCloseTo(-.0391998719, 8);
  const broken = { ...plan, connectors: plan.connectors.map(l => l.from === 7 ? { ...l, points } : l) };
  expect(() => validateVillagePlan(broken)).toThrow(/port position, frame or width mismatch/);
});

it('the graded quarter refuses the OLD port (ratio 5.69) and every non-monotone or crested case', () => {
  const rill = station(6).entry;
  const at = (y: number, slope: number) => { const n = Math.hypot(1, slope);
    return villagePort([rill.position[0] - 1.4, y, rill.position[2] + 1.4], [1 / n, slope / n, 0], [-slope / n, 1 / n, 0]); };
  const sigma = Math.tan(.35);
  expect(() => gradedQuarter(at(5.141049864494967, -sigma), rill)).toThrow(/monotone/); // old drop .141: start slope 5.69 secants
  expect(() => gradedQuarter(at(5.0, -sigma), rill)).toThrow(/monotone/);                // no drop
  expect(() => gradedQuarter(at(4.9, -sigma), rill)).toThrow(/monotone/);                // climbs
  expect(() => gradedQuarter(at(6.0, -sigma), rill)).toThrow(/monotone/);                // ratio .80 < 1.5: crest at the dock
  expect(() => gradedQuarter(at(5.0 + sigma * 1.4 * Math.PI / 2 / 2.9, -sigma), rill)).not.toThrow(); // ratio 2.9: inside the contract
  expect(() => gradedQuarter(at(5.0 + sigma * 1.4 * Math.PI / 2 / 3.1, -sigma), rill)).toThrow(/monotone/); // ratio 3.1: grade would rise
});

it('the unshifted station-4 anchor leaves only .571 m: no smooth grade keeps a gentle crest there', () => {
  const s = authorStation({ stop: 4, anchor: [6.0, 3.71, -7.0], badge: [5.43, 7.55, -12.97], beat: { start: 0, contact: 0, end: 1 }, color: 0,
    mechanism: { kind: 'tipping', pivot: [0.1, -0.5, 0], axis: [0, 0, 1], angle: -0.35 } });
  const bed = station(3), run = bed.entry.position[0] - s.exit.position[0], D = s.exit.position[1] - bed.entry.position[1];
  expect(run).toBeCloseTo(.5709901973, 9);
  const m0 = grade(s.exit), k0 = (-6 * D - 4 * m0 * run) / run ** 2 / (1 + m0 * m0) ** 1.5;
  expect(-k0).toBeGreaterThan(5.3); // cubic start crest 5.35/m against .993/m on the selected 1.071 m run
  // The old .3/.3 Bezier keeps its endpoints but is the same failure class (rocker69 §8 HAND takeoff).
  const old = connect(s, bed, 0.3, 0.3);
  const [a, b, c] = old.points.slice(0, 3), h = Math.hypot(b!.position[0] - a!.position[0], b!.position[1] - a!.position[1]);
  const turnRate = Math.abs(Math.atan2(c!.tangent[1], c!.tangent[0]) - Math.atan2(a!.tangent[1], a!.tangent[0])) / (2 * h);
  expect(turnRate).toBeGreaterThan(2.0); // rocker69 HAND 2.72/m; never a takeoff pass/fail by itself
  expect(stationPorts(station(4)).exit.position[0]).toBeCloseTo(6.4290098027, 9);
});

it('the old literal splice posts no longer meet the rendered underside of the new connectors', () => {
  const lowest = (points: readonly VillagePort[], x: number, z: number) => {
    const g = villageChannelGeometry(points, plan.profile), p = g.getAttribute('position'); let low = Infinity;
    for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) - x) <= .19 && Math.abs(p.getZ(i) - z) <= .19) low = Math.min(low, p.getY(i));
    g.dispose(); return low;
  };
  const l54 = plan.connectors.find(l => l.from === 5)!, l43 = plan.connectors.find(l => l.from === 4)!;
  expect(Math.abs(lowest(l54.points, 4.459808303309678, -7) - 3.1345410346984863)).toBeGreaterThan(.005);
  expect(Math.abs(lowest(l43.points, 7.038287976377717, -7.071929409504627) - 2.502112865447998)).toBeGreaterThan(.005);
});

it('splicePost rejects a connector that does not run along one line', () => {
  const pts = plan.connectors.find(l => l.from === 7)!.points; // the 7->6 quarter turns from z -1 to z -2.4
  expect(() => splicePost(pts)).toThrow(/along one line/);
});
