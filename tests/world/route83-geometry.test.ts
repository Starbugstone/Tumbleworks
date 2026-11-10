// UNUSED / UNRUN. Cheapest-first geometric invariants of the route83 candidate.
// Plan data and rendered connector buffers only: no compile, scene or motion.
// Passing these proves frame/grade/bank/post-top facts, never dynamics,
// clearance, footing or player acceptance (see route83-actual).
import { expect, it } from 'vitest';
import { GLASSHOUSE_GARDENS } from '../../src/world/villages/glasshouse-gardens';
import { stationPorts, villageChannelGeometry } from '../../src/view/machine-primitives';
import { assertVillagePortMatch, validateVillagePlan } from '../../src/world/village-program';
import { compileTerrain, terrainHeightAt } from '../../src/world/village-terrain';
import type { VillageConnector, VillagePort, VillageStation } from '../../src/world/village-plan';

const plan = GLASSHOUSE_GARDENS.plan;
const station = (stop: number): VillageStation => plan.stations.find(s => s.stop === stop)!;
const link = (from: number, to: number): VillageConnector => plan.connectors.find(l => l.from === from && l.to === to)!;
const grade = (p: VillagePort) => p.tangent[1] / Math.hypot(p.tangent[0], p.tangent[2]);
const dot = (a: readonly number[], b: readonly number[]) => a[0]! * b[0]! + a[1]! * b[1]! + a[2]! * b[2]!;
/** Independent port oracle: rotate the deck edge about the authored pivot by the full stroke. */
function dockedExit(anchor: readonly number[], pivot: readonly number[], angle: number) {
  const c = Math.cos(angle), s = Math.sin(angle), dx = .8 - pivot[0]!, dy = -pivot[1]!;
  return [anchor[0]! + pivot[0]! + dx * c - dy * s, anchor[1]! + pivot[1]! + dx * s + dy * c, anchor[2]!];
}
/** Independent Bernstein form of the cubic grade (height D, slope m0 at 0; 0, 0 at L). */
const bernstein = (D: number, m0: number, L: number, u: number) => {
  const w = 1 - u; return D * w ** 3 + 3 * (D + m0 * L / 3) * w * w * u;
};

it('validates the whole plan: every connector meets its actual station ports', () => {
  expect(() => validateVillagePlan(plan)).not.toThrow();
  for (const stop of [7, 4]) {
    const s = station(stop), ports = stationPorts(s);
    assertVillagePortMatch(s.entry, ports.entry); assertVillagePortMatch(s.exit, ports.exit);
  }
});

it('raises both docked exits by the exact mechanism geometry (independent rotation oracle)', () => {
  for (const [stop, oldAnchor] of [[7, [-4.8, 5.72, -1]], [4, [6.0, 3.71, -7]]] as const) {
    const s = station(stop), m = s.mechanism as { pivot: readonly number[]; angle: number };
    expect(m.pivot).toEqual([.1, -.5, 0]);
    const now = dockedExit(s.anchor, m.pivot, m.angle), old = dockedExit(oldAnchor, [-.8, -.5, 0], m.angle);
    now.forEach((v, k) => expect(Math.abs(v - s.exit.position[k]!)).toBeLessThanOrEqual(1e-12));
    expect(now[1]! - old[1]!).toBeCloseTo(.3086080267, 9);
    expect(now[0]! - old[0]! - (s.anchor[0] - oldAnchor[0])).toBeCloseTo(.0545645584, 9);
  }
  expect(station(4).anchor).toEqual([5.5, 3.71, -7]);
});

it('7->6 grades monotonically from the docked slope to the unchanged level rill, sagging throughout', () => {
  const points = link(7, 6).points, from = station(7).exit, to = station(6).entry;
  expect(points.length).toBe(65); expect(to.position[1]).toBe(5.0);
  expect(points.at(-1)!.position[1]).toBe(5.0); expect(grade(points.at(-1)!)).toBe(0);
  const D = from.position[1] - to.position[1], L = 1.4 * Math.PI / 2, m0 = grade(from);
  expect(-m0 * L / D).toBeGreaterThanOrEqual(1.5); expect(-m0 * L / D).toBeLessThanOrEqual(3);
  points.forEach((p, i) => {
    expect(Math.abs(p.position[1] - to.position[1] - bernstein(D, m0, L, i / 64))).toBeLessThanOrEqual(1e-12);
    expect(Math.hypot(p.position[0] - from.position[0], p.position[2] - to.position[2])).toBeCloseTo(1.4, 12);
    expect(Math.abs(dot(p.tangent, p.normal))).toBeLessThanOrEqual(1e-12);
    if (i) {
      expect(p.position[1]).toBeLessThanOrEqual(points[i - 1]!.position[1]);
      expect(grade(p)).toBeGreaterThanOrEqual(grade(points[i - 1]!));
    }
  });
});

it('4->3 runs a full metre along one line with the cubic grade and a continuous 0 -> .35 bank', () => {
  const points = link(4, 3).points, from = station(4).exit, to = station(3).entry, run = to.position[0] - from.position[0];
  expect(run).toBeGreaterThan(1.07); expect(run).toBeLessThan(1.072); expect(points.length).toBe(33);
  const D = from.position[1] - to.position[1], m0 = grade(from);
  let steepest = 0;
  points.forEach((p, i) => {
    expect(p.position[2]).toBe(-7);
    expect(Math.abs(p.position[0] - from.position[0] - run * i / 32)).toBeLessThanOrEqual(1e-12);
    expect(Math.abs(p.position[1] - to.position[1] - bernstein(D, m0, run, i / 32))).toBeLessThanOrEqual(1e-12);
    if (i) expect(p.position[1]).toBeLessThanOrEqual(points[i - 1]!.position[1]);
    steepest = Math.max(steepest, -grade(p));
  });
  expect(Math.atan(steepest)).toBeLessThanOrEqual(Math.atan(.6148));
  // Bank about the tangent: zero at the dock, the bed's .35 at its entry, never reversing.
  const bank = (p: VillagePort) => {
    const h = Math.hypot(p.tangent[0], p.tangent[2]), side = [-p.tangent[2] / h, 0, p.tangent[0] / h];
    const up = [-p.tangent[0] * p.tangent[1] / h, h, -p.tangent[2] * p.tangent[1] / h];
    return Math.atan2(dot(p.normal, side), dot(p.normal, up));
  };
  expect(Math.abs(bank(points[0]!))).toBeLessThanOrEqual(1e-12);
  expect(Math.abs(bank(points.at(-1)!) - .35)).toBeLessThanOrEqual(1e-9);
  for (let i = 1; i < points.length; i++) expect(bank(points[i]!)).toBeGreaterThanOrEqual(bank(points[i - 1]!) - 1e-12);
});

it('5->4 is the existing crest helper between the actual lids exit and the shifted trough entry', () => {
  const points = link(5, 4).points, from = station(5).exit, to = station(4).entry;
  expect(points.length).toBe(65);
  expect(to.position).toEqual([4.7, 3.71, -7]);
  expect(from.position[1]).toBeLessThan(to.position[1]); // the crest climbs .1532, as before (rocker69 said .01: corrected)
  points.forEach((p, i) => { expect(p.position[2]).toBe(-7); expect(Math.abs(p.position[0] - from.position[0] - (to.position[0] - from.position[0]) * i / 64)).toBeLessThanOrEqual(1e-12); });
});

/** Independent lowest rendered point over an axis-aligned square: rendered vertices
 * inside it, rendered edges crossing its four sides, and triangle planes at its corners. */
function lowestOver(points: readonly VillagePort[], x: number, z: number, half: number): number {
  const g = villageChannelGeometry(points, plan.profile, { start: undefined, end: undefined });
  const pos = g.getAttribute('position'), index = g.getIndex()!;
  const v = (k: number) => [pos.getX(k), pos.getY(k), pos.getZ(k)] as const;
  const inside = (p: readonly number[]) => Math.abs(p[0]! - x) <= half && Math.abs(p[2]! - z) <= half;
  let low = Infinity;
  for (let i = 0; i < index.count; i += 3) {
    const t = [v(index.getX(i)), v(index.getX(i + 1)), v(index.getX(i + 2))] as const;
    for (const p of t) if (inside(p)) low = Math.min(low, p[1]);
    for (let e = 0; e < 3; e++) {
      const a = t[e]!, b = t[(e + 1) % 3]!;
      for (const [axis, value] of [[0, x - half], [0, x + half], [2, z - half], [2, z + half]] as const) {
        if ((a[axis] - value) * (b[axis] - value) > 0 || a[axis] === b[axis]) continue;
        const u = (value - a[axis]) / (b[axis] - a[axis]), p = [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u];
        if (inside(p.map((c, k) => k === axis ? (axis === 0 ? x : z) : c))) low = Math.min(low, p[1]!);
      }
    }
    for (const cx of [x - half, x + half]) for (const cz of [z - half, z + half]) {
      const [a, b, c] = t;
      const det = (b[0]! - a[0]!) * (c[2]! - a[2]!) - (c[0]! - a[0]!) * (b[2]! - a[2]!); if (det === 0) continue;
      const s = ((cx - a[0]!) * (c[2]! - a[2]!) - (c[0]! - a[0]!) * (cz - a[2]!)) / det, r = ((b[0]! - a[0]!) * (cz - a[2]!) - (cx - a[0]!) * (b[2]! - a[2]!)) / det;
      if (s >= 0 && r >= 0 && s + r <= 1) low = Math.min(low, a[1]! + s * (b[1]! - a[1]!) + r * (c[1]! - a[1]!));
    }
  }
  g.dispose(); return low;
}

it('each splice post sits at its chord midpoint and its top meets, never enters, the rendered underside', () => {
  for (const [from, to] of [[5, 4], [4, 3]] as const) {
    const l = link(from, to), a = l.points[0]!.position, b = l.points.at(-1)!.position;
    expect(l.supports).toHaveLength(1);
    const [x, top, z] = l.supports![0]!;
    expect(x).toBe((a[0] + b[0]) / 2); expect(z).toBe(-7); expect(Math.fround(top)).toBe(top);
    const low = lowestOver(l.points, x, z, .19);
    expect(top).toBeLessThanOrEqual(low);
    expect(low - top).toBeLessThanOrEqual(2 ** -22 * Math.max(1, Math.abs(low))); // within one stored-float step
  }
});

it('cheap prefilters only: post footprints between the dock ends and over flat 1.4 / 4.2 terrace queries', () => {
  const terrain = compileTerrain(GLASSHOUSE_GARDENS.terrain);
  const level = (x: number, z: number, h: number) => { const y = terrainHeightAt(terrain, x, z); expect(y).toBeDefined(); expect(Math.abs(y! - h)).toBeLessThanOrEqual(2 ** -20); };
  const corners = (x: number, z: number, h: number) => [[x - h, z - h], [x + h, z - h], [x - h, z + h], [x + h, z + h], [x, z]] as const;
  const [px54] = link(5, 4).supports![0]!, [px43] = link(4, 3).supports![0]!;
  expect(px54 - .19).toBeGreaterThan(station(5).exit.position[0]); expect(px54 + .19).toBeLessThan(station(4).entry.position[0]);
  expect(px43 - .19).toBeGreaterThan(station(4).exit.position[0]); expect(px43 + .19).toBeLessThan(station(3).entry.position[0]);
  for (const x of [px54, px43]) for (const [cx, cz] of corners(x, -7, .19)) level(cx, cz, 1.4);
  for (const s of station(6).supports!) for (const [cx, cz] of corners(s[0], s[2], .19)) level(cx, cz, 4.2);
  // Station-4 outboard posts (optin72 hinge kit): x' = 0 +- .15 about the shifted pivot.
  const pivotX = station(4).anchor[0] + .1;
  for (const cz of [-7.64, -7.52, -6.48, -6.36]) for (const cx of [pivotX - .15, pivotX + .15]) level(cx, cz, 1.4);
  // These are point queries. Full footprints with interior cuts, every solid and the
  // moving body remain owed to route83-actual and the 72/80 native checks.
});
