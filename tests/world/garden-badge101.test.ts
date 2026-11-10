import { beforeAll, expect, it } from 'vitest';
import { badge101Rows } from './garden-badge101-probe';

let map: ReturnType<typeof badge101Rows>;
beforeAll(() => { map = badge101Rows(); });

it('keeps Gardens disc2 clear of the actual foreign bed, basin and complete pump in all26 map views', () => {
  expect(map.badge0).toEqual([10.4, 4.15, 2.66]);
  expect(map.badge2).toEqual([12, 3.9, -3.85]);
  expect(map.rows).toHaveLength(26);
  for (const row of map.rows) {
    expect(row.actualBadge[2]).toEqual(row.chosen);
    expect(row.currentGuards).toEqual([]);
    for (const distance of row.current) expect(distance).toBeGreaterThanOrEqual(22);
    if (row.width === 375) expect(row.stemLength).toBeLessThanOrEqual(90);
  }
});

it('rejects the original bed overlap and the rejected basin proposal against native projected triangles', () => {
  expect(map.rows.filter(row => row.oldDistances.some(distance => distance < 22))).toHaveLength(18);
  expect(map.rows.some(row => row.oldDistances[0]! < 22)).toBe(true);
  expect(map.rows.some(row => row.wrongDistances[1]! < 22)).toBe(true);
  expect(map.triangleCounts.every(count => count > 0)).toBe(true);
});
