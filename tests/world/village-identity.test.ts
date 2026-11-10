import { expect, it } from 'vitest';
import { MIN_SEQUENCE_DISTANCE, MIN_SPATIAL_DISTANCE, sequenceDistance, spatialDistance } from './village-identity';
import { CAMPAIGN } from '../../src/campaign';
import { worldProgress } from '../../src/world/progression';
import { VILLAGE_SCENE_PLANS, villageScenePlan } from '../../src/world/village-plans';

const crescent = Array.from({ length: 10 }, (_, index) => ({
  x: 7 * Math.cos(index / 9 * Math.PI * 1.6), y: index * 0.1, z: 10 * Math.sin(index / 9 * Math.PI * 1.6),
}));
const terraces = Array.from({ length: 10 }, (_, index) => ({
  x: (index % 3 - 1) * 7, y: Math.floor(index / 3) * 2, z: Math.floor(index / 3) * 5,
}));

it('rejects copied layouts after translation, arbitrary 3D rotation, reflection or uniform scaling', () => {
  const angle = 0.731, cos = Math.cos(angle), sin = Math.sin(angle);
  const copies = [
    crescent,
    crescent.map(({ x, y, z }) => ({ x: x + 90, y: y - 42, z: z + 13 })),
    crescent.map(({ x, y, z }) => ({ x: cos * x - sin * y, y: sin * x + cos * y, z })),
    crescent.map(({ x, y, z }) => ({ x: -x, y, z })),
    crescent.map(({ x, y, z }) => ({ x: x * 4.2, y: y * 4.2, z: z * 4.2 })),
    crescent.map(({ x, y, z }) => ({ x: 90 - 2 * (cos * x - sin * z), y: 6 + 2 * y, z: 42 + 2 * (sin * x + cos * z) })),
  ];
  for (const copy of copies) {
    expect(spatialDistance(crescent, copy)).toBeLessThan(1e-6);
    expect(spatialDistance(crescent, copy)).toBeLessThan(MIN_SPATIAL_DISTANCE);
  }
  expect(spatialDistance(crescent, terraces)).toBeGreaterThan(MIN_SPATIAL_DISTANCE);
  expect(spatialDistance(terraces, crescent)).toBeCloseTo(spatialDistance(crescent, terraces), 10);
});

it('measures ordered mechanism edits rather than different labels or a different starting index', () => {
  const sequence = ['release', 'channel', 'bridge', 'channel', 'tipping', 'channel', 'striker', 'channel', 'bowl', 'receiver'];
  expect(sequenceDistance(sequence, sequence)).toBe(0);
  expect(sequenceDistance(sequence, [...sequence.slice(1), sequence[0]!])).toBe(2);
  expect(sequenceDistance(sequence, ['release', ...Array<string>(8).fill('wheelbucket'), 'receiver'])).toBeGreaterThanOrEqual(MIN_SEQUENCE_DISTANCE);
  expect(sequenceDistance(['bridge', 'channel'], ['channel', 'bridge'])).toBe(2);
});

it('rejects degenerate and mismatched spatial inputs instead of declaring them distinct', () => {
  expect(() => spatialDistance(crescent, terraces.slice(1))).toThrow('same stable stop');
  expect(() => spatialDistance(Array(10).fill({ x: 0, y: 0, z: 0 }), crescent)).toThrow('noncoincident');
  expect(() => spatialDistance(crescent.map(point => ({ ...point, x: NaN })), crescent)).toThrow('finite');
});

it('requires an explicit independent plan for every registered chapter, with no fallback for unknown chapters', () => {
  const chapters = worldProgress(CAMPAIGN, new Set()).chapters;
  expect(chapters).toHaveLength(6); expect(VILLAGE_SCENE_PLANS).toHaveLength(chapters.length);
  const plans = chapters.map(chapter => villageScenePlan(chapter.index));
  expect(new Set(plans).size).toBe(chapters.length);
  expect(new Set(plans.map(scene => scene.plan)).size).toBe(chapters.length);
  expect(new Set(plans.map(scene => scene.plan.profile))).toEqual(new Set(['plank', 'terracotta', 'timber', 'twinrail', 'girder', 'steel']));
  for (const chapter of chapters) {
    const scene = villageScenePlan(chapter.index);
    expect(scene.chapter).toBe(chapter.index); expect(scene.plan.chapter).toBe(chapter.index);
    expect([...scene.plan.stations].map(station => station.stop).sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  }
  for (const chapter of [-1, 6, 12, NaN, Infinity]) expect(() => villageScenePlan(chapter)).toThrow('no authored village plan');
});

const pairs = Array.from({ length: 6 }, (_, left) => Array.from({ length: 5 - left }, (_, offset) => [left, left + offset + 1] as const)).flat();
it.each(pairs)('villages %i and %i differ in both actual spatial arrangement and ordered mechanisms', (left, right) => {
  const a = [...villageScenePlan(left).plan.stations].sort((a, b) => b.stop - a.stop);
  const b = [...villageScenePlan(right).plan.stations].sort((a, b) => b.stop - a.stop);
  const anchor = (station: typeof a[number]) => ({ x: station.anchor[0], y: station.anchor[1], z: station.anchor[2] });
  expect(spatialDistance(a.map(anchor), b.map(anchor)), `best-fit normalized displacement, villages ${left}/${right}`).toBeGreaterThanOrEqual(MIN_SPATIAL_DISTANCE);
  expect(sequenceDistance(a.map(station => station.mechanism.kind), b.map(station => station.mechanism.kind)),
    `visible ordered mechanism edits, villages ${left}/${right}`).toBeGreaterThanOrEqual(MIN_SEQUENCE_DISTANCE);
});

it('rejects a transformed copy of a real authored village even if its chapter and other metadata change', () => {
  const anchors = villageScenePlan(0).plan.stations.map(station => ({ x: station.anchor[0], y: station.anchor[1], z: station.anchor[2] }));
  const transformed = anchors.map(({ x, y, z }) => ({ x: 17 + z * 2.7, y: 8 + y * 2.7, z: -4 + x * 2.7 }));
  expect(spatialDistance(anchors, transformed)).toBeLessThan(1e-6);
  expect(spatialDistance(anchors, transformed)).toBeLessThan(MIN_SPATIAL_DISTANCE);
});
