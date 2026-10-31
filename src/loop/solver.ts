import { LoopRules } from './rules';

const DEFAULT_SEARCH_LIMIT = 4_000;

function clone(rules: LoopRules): LoopRules {
  const result = new LoopRules(rules.board);
  result.restore(rules.snapshot());
  return result;
}

/**
 * Let the loop run: unloading marbles join while there is room, and every loop marble a truck
 * wants is absorbed, lanes checked in order. The real loop decides ties by position; this is close.
 */
export function settleLoop(rules: LoopRules): boolean {
  const bound = 3 * rules.state.marbles.length + 4;
  for (let round = 0; round < bound; round += 1) {
    if (rules.status !== 'playing') return true;
    const before = JSON.stringify(rules.state);
    for (let lane = 0; lane < rules.board.lanes.length; lane++) while (rules.entered(lane) !== null) { /* drain */ }
    for (const marble of rules.state.marbles) {
      if (marble.status !== 'on-loop') continue;
      for (let lane = 0; lane < rules.board.lanes.length; lane++) {
        if (rules.pass(marble.id, lane).result !== 'absorb') continue;
        rules.captured(marble.id);
        break;
      }
    }
    if (JSON.stringify(rules.state) === before) return true;
  }
  return false;
}

/** Returns a lane whose tap has a verified winning continuation, without touching the live game. */
export function hintLoop(rules: LoopRules, searchLimit = DEFAULT_SEARCH_LIMIT): number | null {
  if (rules.status !== 'playing' || !Number.isSafeInteger(searchLimit) || searchLimit <= 0) return null;
  const settled = clone(rules);
  if (!settleLoop(settled) || settled.status !== 'playing') return null;
  const visited = new Set<string>();
  let exhausted = false;
  const canWin = (current: LoopRules): boolean => {
    if (current.status === 'won') return true;
    if (current.status === 'jammed' || exhausted) return false;
    const key = JSON.stringify(current.snapshot());
    if (visited.has(key)) return false;
    if (visited.size >= searchLimit) { exhausted = true; return false; }
    visited.add(key);
    for (let lane = 0; lane < current.board.lanes.length; lane += 1) {
      const branch = clone(current);
      if (!branch.tap(lane).ok || !settleLoop(branch)) continue;
      if (canWin(branch)) return true;
    }
    return false;
  };
  for (let lane = 0; lane < rules.board.lanes.length; lane += 1) {
    const branch = clone(settled);
    if (!branch.tap(lane).ok || !settleLoop(branch)) continue;
    if (canWin(branch)) return lane;
    if (exhausted) return null;
  }
  return null;
}

/** Every settled tap order, for authoring. */
export function loopTree(rules: LoopRules, limit = 100_000): { wins: number; jams: number; dead: number; win: string | null; jam: string | null } {
  const result = { wins: 0, jams: 0, dead: 0, win: null as string | null, jam: null as string | null };
  let visited = 0;
  const seen = new Set<string>();
  const walk = (current: LoopRules, path: string): void => {
    if (visited++ > limit) return;
    if (current.status === 'won') { result.wins++; result.win ??= path; return; }
    if (current.status === 'jammed') { result.jams++; result.jam ??= path; return; }
    const key = JSON.stringify(current.state.lanes) + current.occupancy;
    if (seen.has(key)) return;
    seen.add(key);
    let moved = false;
    for (let lane = 0; lane < current.board.lanes.length; lane++) {
      const branch = clone(current);
      if (!branch.tap(lane).ok) continue;
      if (!settleLoop(branch)) throw new Error(`Unsettled after ${path}${lane}`);
      moved = true;
      walk(branch, path + String.fromCharCode(65 + lane));
    }
    if (!moved) result.dead++;
  };
  const start = clone(rules);
  settleLoop(start);
  walk(start, '');
  return result;
}
