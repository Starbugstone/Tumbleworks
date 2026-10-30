import { MachineRules } from './rules';

const DEFAULT_SEARCH_LIMIT = 5_000;

function clone(rules: MachineRules): MachineRules {
  const result = new MachineRules(rules.board);
  result.restore(rules.snapshot());
  return result;
}

/** Saturate the single receiver queue; travel time changes presentation, not which releases can win. */
function settle(rules: MachineRules): boolean {
  const bound = 2 * rules.state.marbles.length + rules.board.boxes.length + 2;
  for (let round = 0; round < bound; round += 1) {
    for (const marble of rules.state.marbles) {
      if (marble.status === 'pouring') rules.entered(marble.id);
    }
    for (const marble of rules.state.marbles) {
      if (marble.status === 'dropping') rules.captured(marble.id);
    }
    if (rules.state.waitingForSwap) rules.boxSwapped();
    for (const marble of rules.state.marbles) {
      if (marble.status !== 'on-belt' || rules.arrive(marble.id) !== 'deliver') continue;
      rules.captured(marble.id);
      if (rules.state.waitingForSwap) rules.boxSwapped();
    }
    const work = rules.state.waitingForSwap || rules.state.marbles.some((marble) =>
      marble.status === 'pouring' || marble.status === 'dropping' ||
      (rules.status === 'playing' && marble.status === 'on-belt' && marble.color === rules.activeColor),
    );
    if (!work) return true;
  }
  return false;
}

/** Returns an immediately fitting release with a proven continuation, or null if waiting or search is unresolved. */
export function hintConveyor(rules: MachineRules, searchLimit = DEFAULT_SEARCH_LIMIT): number | null {
  if (rules.status !== 'playing' || !Number.isSafeInteger(searchLimit) || searchLimit <= 0) return null;
  const candidates = rules.state.supplies.flatMap((supply, index) => {
    const packet = supply[0];
    return packet && packet.marbles.length <= rules.free ? [index] : [];
  });
  if (!candidates.length) return null;
  const settled = clone(rules);
  if (!settle(settled) || settled.status !== 'playing') return null;
  const visited = new Set<string>();
  let exhausted = false;

  const canWin = (current: MachineRules): boolean => {
    if (current.status === 'won') return true;
    if (current.status === 'jammed' || exhausted) return false;
    const key = JSON.stringify(current.snapshot());
    if (visited.has(key)) return false;
    if (visited.size >= searchLimit) { exhausted = true; return false; }
    visited.add(key);
    for (let supply = 0; supply < current.board.supplies.length; supply += 1) {
      const branch = clone(current);
      if (!branch.release(supply).ok || !settle(branch)) continue;
      if (canWin(branch)) return true;
    }
    return false;
  };

  for (const supply of candidates) {
    const branch = clone(settled);
    if (!branch.release(supply).ok || !settle(branch)) continue;
    if (canWin(branch)) return supply;
    if (exhausted) return null;
  }
  return null;
}
