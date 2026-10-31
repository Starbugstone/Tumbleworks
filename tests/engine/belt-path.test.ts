import { describe, expect, it } from 'vitest';
import { FigureEightTrack } from '../../src/engine/belt-path';

describe('figure-eight transport paths', () => {
  it.each([true, false])('keeps the crossing separated, wraps continuously and travels at uniform speed (vertical=%s)', (vertical) => {
    const path = new FigureEightTrack(5.4, 4, 0, vertical);
    const upper = path.point(0), lower = path.point(path.length / 2);
    expect(Math.hypot(upper.x - lower.x, upper.z - lower.z)).toBeLessThan(0.001);
    expect(upper.y - lower.y).toBeGreaterThan(2);
    expect(path.point(path.nearest(0, 0).distance).y).toBeLessThan(0.001);
    expect(path.point(path.length)).toEqual(upper);
    for (let d = -0.1; d < path.length; d += 0.1) {
      const a = path.point(d), b = path.point(d + 0.1);
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeGreaterThan(0.098);
      expect(Math.hypot(b.x - a.x, b.y - a.y, b.z - a.z)).toBeLessThan(0.101);
      expect(Math.hypot(a.tx, a.tz)).toBeCloseTo(1, 6);
    }
  });
});
