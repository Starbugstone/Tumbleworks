import { expect, it, vi } from 'vitest';
import { checkActions } from '../../docs/models/loop-actions/check';
import { LoopRules } from '../../src/loop/rules';
import type { LoopBoardDef } from '../../src/loop/types';

const pair: LoopBoardDef = {
  id: 'pair-model', title: '', truckCapacity: 3, loopCapacity: 2,
  lanes: [
    [{ id: 'a', segments: [{ color: 'blue', count: 1 }, { color: 'red', count: 2 }] }],
    [{ id: 'b', segments: [{ color: 'red', count: 1 }, { color: 'blue', count: 2 }] }],
  ], loop: [], couplings: [['a', 'b']],
};
it('checks every tap, entry and absorption ordering in the bounded coupled model', () => {
  const result = checkActions(pair);
  expect(result.states).toBe(8);
  expect(result.refusals).toBeGreaterThan(0);
  expect(result.completions).toBeGreaterThan(0);
});
it('checks receiving latches and mixed capacities in the same transition explorer', () => {
  const board: LoopBoardDef = { ...pair, couplings: [], lanes: [
    [{ id: 'a', capacity: 2, pourAfter: 'b', segments: [{ color: 'red', count: 1 }] }],
    [{ id: 'b', segments: [{ color: 'red', count: 1 }, { color: 'blue', count: 2 }] }],
  ], loop: [{ color: 'blue', count: 1 }] };
  const result = checkActions(board);
  expect(result.states).toBeGreaterThan(5);
  expect(result.completions).toBeGreaterThan(0);
});

it('the model rejects a deliberately half-committed coupled pour', () => {
  const tap = LoopRules.prototype.tap;
  const spy = vi.spyOn(LoopRules.prototype, 'tap').mockImplementation(function (this: LoopRules, lane) {
    const before = this.snapshot();
    const result = tap.call(this, lane);
    if (result.ok && result.pours.length === 2) {
      const broken = this.snapshot();
      broken.lanes[1] = before.lanes[1]!;
      this.restore(broken);
    }
    return result;
  });
  try { expect(() => checkActions(pair)).toThrow(/only one half/); }
  finally { spy.mockRestore(); }
});
