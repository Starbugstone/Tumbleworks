import { expect, it } from 'vitest';
import { FiniteDriveLedger, contactEnergy } from '../../src/world/village-drive';
it('rejects an energy label without real source geometry', () => {
  expect(() => new FiniteDriveLedger([{ id: 'weight', kind: 'weight', meshId: 'missing', mass: 1, top: 2, bottom: 1 }], 9.81, () => false)).toThrow('unrendered');
});
it('cannot reuse the same falling weight at each carrier', () => {
  const ledger = new FiniteDriveLedger([{ id: 'weight', kind: 'weight', meshId: 'actual-weight', mass: 1, top: 2, bottom: 1 }], 9.81, () => true);
  ledger.draw('weight', 'lift', 7);
  expect(() => ledger.draw('weight', 'next-launcher', 7)).toThrow('exhausted');
  expect(ledger.available('weight')).toBeCloseTo(2.81);
});
it('subtracts the gate, rotor and impact energy from the actual incoming marble', () => {
  const transfer = contactEnergy(3, 1, 1.4, .02, 1.2, .3, .1, 9.81);
  expect(.7 * transfer.outgoingSpeed ** 2 + transfer.gateWork + .3 + .1).toBeCloseTo(.7 * 9, 12);
  expect(transfer.outgoingSpeed).toBeLessThan(3);
  expect(() => contactEnergy(.1, 1, 1.4, .02, 1.2, .3, .1, 9.81)).toThrow('cannot power');
});
