import { describe, expect, it } from 'vitest';
import { checkPalletInterleavings } from '../../docs/models/funnel-pallets/check';
import type { BoardDef } from '../../src/sim/types';

const board: BoardDef = {
  id: 'pallet-interleavings', title: '', beltCapacity: 1, boxSize: 1,
  supplies: [[{ color: 'red', count: 1 }], [{ color: 'blue', count: 1 }], [{ color: 'green', count: 1 }], [{ color: 'yellow', count: 1 }]],
  docks: [['red', 'green'], ['blue', 'yellow']], pallets: [[0, 1]],
};
describe('shared pallet bounded interleavings', () => {
  it('checks release, entry, reservation, capture and snapshot restoration in every order', () => {
    const explored = checkPalletInterleavings(board);
    expect(explored.states).toBeGreaterThan(100);
    expect(explored.waiting).toBeGreaterThan(0);
    expect(explored.advances).toBeGreaterThan(0);
    expect(explored.captures).toBeGreaterThan(0);
    expect(explored.jams).toBeGreaterThan(0);
    expect(explored.wins).toBeGreaterThan(0);
  });
  it.each(['advance-one', 'delay-advance'] as const)('rejects the %s broken transition', (mutant) => {
    expect(() => checkPalletInterleavings(board, mutant)).toThrow(/pallet|reservations|capture/i);
  });
});
