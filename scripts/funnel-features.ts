import { MachineRules } from '../src/sim/rules';
import { settle } from '../src/sim/solver';
import type { BoardDef } from '../src/sim/types';
import { search } from './funnel-author';

/** Remove only the restriction; retain stable crate actions and all cargo/receiver order. */
export function withoutFunnelFeature(board: BoardDef): BoardDef {
  if (board.pallets?.length) return { ...board, pallets: [] };
  if (board.seals?.length) return { ...board, seals: [] };
  let id = 0;
  const columns = Object.fromEntries(board.supplies.flatMap((queue) => queue.map((_, index) => {
    const crate = id++;
    return [crate, index ? [crate - 1] : []];
  })));
  return { ...board, pairs: [], predecessors: columns };
}

/** An attractive opening has no winning continuation here but wins with the restriction removed. */
export function funnelFeatureTrap(board: BoardDef): number | null {
  if (!board.pairs?.length && !board.predecessors && !board.seals?.length && !board.pallets?.length) return null;
  for (const action of new MachineRules(board).actions()) {
    const rules = new MachineRules(board);
    rules.release(action); settle(rules);
    const found = search(board, 60_000, rules.snapshot());
    if (!found.complete || found.solvable) continue;
    const relaxed = withoutFunnelFeature(board);
    const other = new MachineRules(relaxed);
    if (!other.release(action).ok || !settle(other)) continue;
    if (search(relaxed, 60_000, other.snapshot()).solvable) return action;
  }
  return null;
}
