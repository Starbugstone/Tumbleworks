import { describe, expect, it } from 'vitest';
import { atan2, cos, hypot, sin } from '../../src/engine/exact-math';

describe('exact math follows Math closely enough to replace it in the rules', () => {
  const angles = Array.from({ length: 4001 }, (_, i) => (i - 2000) * 0.0173);
  it('sin and cos', () => {
    for (const x of [...angles, 0, Math.PI, 1000.123, 43758.5453, -78.233]) {
      expect(Math.abs(sin(x) - Math.sin(x)), `sin ${x}`).toBeLessThan(1e-12);
      expect(Math.abs(cos(x) - Math.cos(x)), `cos ${x}`).toBeLessThan(1e-12);
    }
  });
  it('atan2 in every quadrant and on the axes', () => {
    for (const y of [-50, -3, -1, -0.5, -0.1, 0, 0.1, 0.5, 1, 3, 50]) {
      for (const x of [-50, -3, -1, -0.5, -0.1, 0, 0.1, 0.5, 1, 3, 50]) {
        expect(Math.abs(atan2(y, x) - Math.atan2(y, x)), `atan2 ${y},${x}`).toBeLessThan(1e-12);
      }
    }
  });
  it('hypot', () => {
    expect(hypot(3, 4)).toBe(5);
    expect(hypot(1, 2, 2)).toBe(3);
  });
  it('pins the bits, so a change to these functions is seen as the replay break it is', () => {
    expect([sin(1.7), cos(2.3), sin(100.123), atan2(1.1, 2.2), hypot(1.1, 2.2, 3.3)]).toEqual([
      0.9916648104524686, -0.666276021279824, -0.3967420848926862, 0.4636476090008061, 4.115823125451335,
    ]);
  });
});
