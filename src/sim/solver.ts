import { MachineRules } from './rules';

const DEFAULT_SEARCH_LIMIT = 5_000;

function clone(rules: MachineRules): MachineRules {
  const result = new MachineRules(rules.board);
  result.restore(rules.snapshot());
  return result;
}

/**
 * Let everything already released finish: the funnel feeds the belt while there is room, and every
 * belt marble a dock wants is delivered. The funnel's physical order is approximated as first in,
 * first out. Travel time changes presentation, not which releases can still win.
 */
export function settle(rules: MachineRules): boolean {
  const bound = 2 * rules.state.marbles.length + rules.board.docks.flat().length + 2;
  for (let round = 0; round < bound; round += 1) {
    if (rules.status !== 'playing') return true;
    const before = JSON.stringify(rules.state);
    for (const id of [...rules.state.pending]) if (!rules.entered(id)) break;
    for (const marble of rules.state.marbles) if (marble.status === 'dropping') rules.captured(marble.id);
    for (const marble of rules.state.marbles) {
      if (marble.status !== 'on-belt') continue;
      for (let dock = 0; dock < rules.board.docks.length; dock++) {
        if (rules.arrive(marble.id, dock).result !== 'deliver') continue;
        rules.captured(marble.id);
        break;
      }
    }
    if (JSON.stringify(rules.state) === before) return true;
  }
  return false;
}

/** Returns a supply whose release has a verified winning continuation, without touching the live game. */
export function hintConveyor(rules: MachineRules, searchLimit = DEFAULT_SEARCH_LIMIT): number | null {
  if (rules.status !== 'playing' || !Number.isSafeInteger(searchLimit) || searchLimit <= 0) return null;
  const candidates = rules.state.supplies.flatMap((supply, index) => (supply[0] ? [index] : []));
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

/** Every settled release order, for authoring: how many win, how many jam, and one witness of each. */
export function releaseTree(rules: MachineRules, limit = 200_000): { wins: number; jams: number; win: string | null; jam: string | null } {
  const result = { wins: 0, jams: 0, win: null as string | null, jam: null as string | null };
  let visited = 0;
  const walk = (current: MachineRules, path: string): void => {
    if (visited++ > limit) return;
    if (current.status === 'won') { result.wins++; result.win ??= path; return; }
    if (current.status === 'jammed') { result.jams++; result.jam ??= path; return; }
    for (let supply = 0; supply < current.board.supplies.length; supply++) {
      const branch = clone(current);
      if (!branch.release(supply).ok) continue;
      if (!settle(branch)) throw new Error(`Unsettled state after ${path}${supply}`);
      walk(branch, path + String.fromCharCode(65 + supply));
    }
  };
  const start = clone(rules);
  settle(start);
  walk(start, '');
  return result;
}
