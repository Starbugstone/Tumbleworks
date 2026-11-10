import { expect, it } from 'vitest';
import { VillageStrike } from '../../src/world/village-strike';
it('pays striker rigid-body energy from the marble impact and stops at its physical endpoint', () => {
  const strike = new VillageStrike(1, 3, .02, 1.4, { mass: .001, inertia: .000095, friction: .05, stroke: .5 });
  expect(.5 * .02 * 1.4 * strike.outgoingSpeed ** 2 + strike.transferredEnergy).toBeCloseTo(.5 * .02 * 1.4 * 9, 12);
  expect(strike.outgoingSpeed).toBeGreaterThan(0);
  expect(strike.outgoingSpeed).toBeLessThan(3);
  strike.sample(.9); expect(strike.distance).toBe(0);
  strike.sample(strike.end); expect(strike.distance).toBe(.5);
  strike.sample(100); expect(strike.distance).toBe(.5);
});
