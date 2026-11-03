import { LoopRules } from '../src/loop/rules';
import { settleLoop } from '../src/loop/solver';
import type { LoopBoardDef } from '../src/loop/types';
import { search } from './loop-author';

export type LoopFeature = 'latch' | 'short' | 'coupling';

/** Counterfactuals preserve colour conservation. Short/long homes exchange capacity, never cargo. */
export function withoutFeature(board: LoopBoardDef, feature: LoopFeature): LoopBoardDef[] {
  if (feature === 'latch') return [{ ...board, lanes: board.lanes.map((queue) => queue.map(({ pourAfter: _, ...truck }) => truck)) }];
  if (feature === 'coupling') return [{ ...board, couplings: [] }];
  const trucks = board.lanes.flat();
  const short = trucks.find((truck) => truck.capacity === 12);
  if (!short) return [];
  return trucks.filter((truck) => truck !== short && (truck.capacity ?? board.truckCapacity) === 24 && truck.segments.at(-1)!.color === short.segments.at(-1)!.color && truck.segments.reduce((n, s) => n + s.count, 0) <= 12).map((other) => ({
    ...board, lanes: board.lanes.map((queue) => queue.map((truck) => truck === short ? { ...truck, capacity: 24 } : truck === other ? { ...truck, capacity: 12 } : truck)),
  }));
}

function after(board: LoopBoardDef, order: string): LoopRules | null {
  const rules = new LoopRules(board);
  settleLoop(rules);
  for (const letter of order) {
    if (!rules.tap(letter.charCodeAt(0) - 65).ok) return null;
    settleLoop(rules);
  }
  return rules;
}

/** A legal tempting line loses here but still has a winning continuation with the restriction removed. */
export function featureTrap(board: LoopBoardDef, feature: LoopFeature, order: string): boolean {
  const lost = after(board, order);
  if (!lost || lost.status !== 'jammed') return false;
  return withoutFeature(board, feature).some((counterfactual) => {
    const state = after(counterfactual, order);
    return state !== null && search(counterfactual, 60_000, state.snapshot()).solvable;
  });
}
