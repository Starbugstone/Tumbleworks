// UNUSED / UNRUN pure interpolation regression. No physical producer claim.
import { expect, it } from 'vitest';
import { hermite, hermiteRate } from '../../src/world/village-gravity-rocker';

it('retains the exact held seat angle and zero rate at every subinterval query', () => {
  for (const angle of [0, -.35]) {
    for (const duration of [1 / 480, .413, 1]) {
      for (let i = 0; i <= 4097; i++) {
        const u = i / 4097;
        expect(Object.is(hermite(angle, angle, 0, 0, duration, u), angle)).toBe(true);
        expect(Object.is(hermiteRate(angle, angle, 0, 0, duration, u), 0)).toBe(true);
      }
    }
  }
});
