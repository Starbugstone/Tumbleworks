import { MachineRules } from '../../src/sim/rules';
import type { BoardDef } from '../../src/sim/types';

/** Enter pours and revisit every circulating marble until only passes remain. */
export function drain(rules: MachineRules, afterCall: () => void = () => {}): void {
  const bound = 2 * rules.state.marbles.length + rules.board.boxes.length + 2;
  for (let round = 0; round < bound; round += 1) {
    if (rules.status !== 'playing') return;
    const before = JSON.stringify(rules.state);
    for (const id of [...rules.state.pending]) {
      const entered = rules.entered(id);
      afterCall();
      if (!entered) break;
    }
    for (const marble of rules.state.marbles) {
      if (marble.status === 'dropping') {
        rules.captured(marble.id);
        afterCall();
      }
    }
    if (rules.state.waitingForSwap) {
      rules.boxSwapped();
      afterCall();
    }
    for (const marble of rules.state.marbles) {
      if (marble.status !== 'on-belt') continue;
      const result = rules.arrive(marble.id);
      afterCall();
      if (result === 'deliver') {
        rules.captured(marble.id);
        afterCall();
        if (rules.state.waitingForSwap) {
          rules.boxSwapped();
          afterCall();
        }
      }
    }
    if (JSON.stringify(rules.state) === before) return;
  }
  throw new Error(`Rules failed to drain within ${bound} rounds: ${JSON.stringify(rules.state)}`);
}

export function replaySettled(board: BoardDef, releases: readonly number[]): MachineRules {
  const rules = new MachineRules(board);
  for (const supply of releases) {
    const result = rules.release(supply);
    if (!result.ok) throw new Error(`Replay rejected ${releases.join(',')} at ${supply}: ${result.reason}`);
    drain(rules);
  }
  return rules;
}

export function enumerate(board: BoardDef): { wins: string[]; jams: string[] } {
  const tree = { wins: [] as string[], jams: [] as string[] };
  const maxDepth = board.supplies.reduce((count, supply) => count + supply.length, 0);
  function visit(rules: MachineRules, sequence: string): void {
    if (sequence.length > maxDepth) throw new Error(`Tree exceeded packet count: ${sequence}`);
    if (rules.status === 'won') { tree.wins.push(sequence); return; }
    if (rules.status === 'jammed') { tree.jams.push(sequence); return; }
    let branches = 0;
    for (let supply = 0; supply < board.supplies.length; supply += 1) {
      const branch = new MachineRules(board);
      branch.restore(rules.snapshot());
      if (!branch.release(supply).ok) continue;
      branches += 1;
      drain(branch);
      visit(branch, sequence + String.fromCharCode(65 + supply));
    }
    if (branches === 0) throw new Error(`Playing leaf without a release: ${sequence}`);
  }
  visit(new MachineRules(board), '');
  tree.wins.sort();
  tree.jams.sort();
  return tree;
}
