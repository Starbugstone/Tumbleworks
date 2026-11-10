import { describe, expect, it } from 'vitest';
import { intervalVerdict, refineForeignIntervals, type ForeignObservation } from './active-retainer-intervals';

const coarse = (start: number, end: number, observe: (time: number) => readonly string[]) => {
  const n = Math.ceil((end - start) * 20);
  return Array.from({ length: n + 1 }, (_, i) => { const time = i === 0 ? start : i === n ? end : start + (end - start) * i / n; return { time, names: observe(time) }; });
};
const measure = (observe: (time: number) => readonly string[], start = 0, end = 2, boundary?: number) => {
  const seeds = coarse(start, end, observe);
  if (boundary !== undefined) seeds.push({ time: boundary, names: observe(boundary) });
  seeds.sort((a, b) => a.time - b.time);
  return refineForeignIntervals({ ray: 8, coarse: seeds, filmStart: start, filmEnd: end,
    boundaries: boundary === undefined ? [] : [{ time: boundary, label: 'actual:carryEnd' }],
    observe: (time): ForeignObservation => ({ time, names: observe(time) }) });
};
const brackets = (r: ReturnType<typeof measure>) => { for (const interval of r.intervals) {
  expect(interval.first.latest - interval.first.earliest).toBeLessThanOrEqual(.001);
  expect(interval.last.latest - interval.last.earliest).toBeLessThanOrEqual(.001);
  expect(interval.maximumInteriorStep).toBeLessThanOrEqual(1 / 240);
} };

describe('G-B union first/last visibility bounds', () => {
  it('does not reset the foreign union when the obstructing mesh hands off', () => {
    const r = measure(t => t >= 1 && t <= 1.24 ? [t < 1.12 ? 'A' : 'B'] : []);
    expect(r.intervals).toHaveLength(1); const interval = r.intervals[0]!;
    expect([...interval.names].sort()).toEqual(['A', 'B']);
    expect(interval.lowerDuration).toBeLessThanOrEqual(.24);
    expect(interval.upperDuration).toBeGreaterThanOrEqual(.24);
    expect(interval.verdict).toBe('within-limit'); brackets(r);
  });
  it('inserts the actual allowed carryEnd observation instead of inventing an extra first bin', () => {
    const carryEnd = 2.6243009451553697;
    const r = measure(t => t > carryEnd && t < carryEnd + .224 ? ['source9-trailing-sleeve'] : [], 2.5, 3, carryEnd);
    expect(r.intervals).toHaveLength(1); const interval = r.intervals[0]!;
    expect(interval.first.earliest).toBeGreaterThanOrEqual(carryEnd);
    expect(interval.first.latest).toBeLessThanOrEqual(carryEnd + .001);
    expect(interval.first.boundary).toEqual({ time: carryEnd, label: 'actual:carryEnd' });
    expect(interval.verdict).toBe('within-limit');
    // Source9 is not rescued if its ACTUAL clear transition is later than the boundary.
    const delayed = measure(t => t > carryEnd + .008 && t < carryEnd + .232 ? ['source9-trailing-sleeve'] : [], 2.5, 3, carryEnd);
    expect(delayed.intervals[0]!.first.earliest).toBeGreaterThan(carryEnd + .006); brackets(r); brackets(delayed);
  });
  it('finds an interior clear gap missed by the coarse20Hz samples and splits the actual observed union', () => {
    const r = measure(t => t >= 1 && t <= 1.3 && !(t > 1.116 && t < 1.13) ? ['A'] : []);
    expect(r.intervals).toHaveLength(2);
    expect(r.intervals[0]!.last.latest).toBeLessThan(r.intervals[1]!.first.earliest);
    expect(r.samples.some(s => s.time > 1.116 && s.time < 1.13 && s.names.length === 0)).toBe(true); brackets(r);
  });
  it('never passes a lower-bound-only or rounded near-limit result', () => {
    expect(intervalVerdict(.249, .250001)).toBe('unproven');
    expect(intervalVerdict(.250001, .251)).toBe('exceeds-limit');
    expect(intervalVerdict(.249, .25)).toBe('within-limit');
    expect(intervalVerdict(.249999, .25000000000000006)).toBe('unproven');
    const r = measure(t => t >= 1 && t < 1.251 ? ['source9-trailing-sleeve'] : []);
    expect(r.intervals[0]!.upperDuration).toBeGreaterThan(.25);
    expect(r.intervals[0]!.verdict).not.toBe('within-limit'); brackets(r);
  });
  it('handles genuine film endpoints without making up negative first-bin time', () => {
    const r = measure(t => t < .1 || t > 1.9 ? ['end-stop'] : []);
    expect(r.intervals).toHaveLength(2);
    expect(r.intervals[0]!.first).toMatchObject({ earliest: 0, latest: 0, kind: 'film-start' });
    expect(r.intervals[1]!.last).toMatchObject({ earliest: 2, latest: 2, kind: 'film-end' }); brackets(r);
  });
  it('fails closed if complete bounds or exact current observations are missing', () => {
    expect(() => refineForeignIntervals({ ray: 8, filmStart: 0, filmEnd: 1, coarse: [{ time: .1, names: [] }, { time: 1, names: [] }], boundaries: [], observe: time => ({ time, names: [] }) })).toThrow('bounds');
    expect(() => refineForeignIntervals({ ray: 8, filmStart: 0, filmEnd: 1, coarse: [{ time: 0, names: [] }, { time: 1, names: [] }], boundaries: [], observe: time => ({ time: time + .001, names: [] }) })).toThrow('unavailable');
    expect(() => intervalVerdict(NaN, .2)).toThrow('bounds');
  });
});
