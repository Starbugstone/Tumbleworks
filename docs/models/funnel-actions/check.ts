import assert from 'node:assert/strict';
import { MachineRules, type RulesState } from '../../../src/sim/rules';
import type { BoardDef } from '../../../src/sim/types';

/** Bounded asynchronous exploration of production release, entry, reservation and capture. */
export function checkFunnelActions(board: BoardDef, mutatePair = false): { states: number; refusals: number; openings: number } {
  const rules = new MachineRules(board);
  const pending = [rules.snapshot()];
  const seen = new Set<string>();
  let refusals = 0, openings = 0;
  const enqueue = (state: RulesState) => { if (!seen.has(JSON.stringify(state))) pending.push(state); };
  while (pending.length) {
    const state = pending.pop()!;
    const key = JSON.stringify(state);
    if (seen.has(key)) continue;
    seen.add(key);
    assert(seen.size < 50_000, 'Model bound exhausted');
    rules.restore(state);
    assert(rules.occupancy <= board.beltCapacity);
    assert.equal(new Set(state.pending).size, state.pending.length);
    assert.deepEqual(state.pending.slice().sort(), state.marbles.filter((m) => m.status === 'pouring').map((m) => m.id).sort());
    for (let dock = 0; dock < board.docks.length; dock++) for (let box = 0; box < board.docks[dock]!.length; box++) {
      assert(rules.reserved(dock,box) <= board.boxSize);
      for (const marble of state.marbles.filter((m) => m.dock === dock && m.box === box)) assert.equal(marble.color, board.docks[dock]![box]);
    }
    for (let action = 0; action < board.supplies.flat().length; action++) {
      rules.restore(state);
      const ids = rules.releaseIds(action);
      const result = rules.release(action);
      if (!result.ok) { assert.deepEqual(rules.snapshot(),state); refusals++; }
      else {
        const after = rules.snapshot();
        if (mutatePair && ids.length === 2) after.released.pop();
        for (const id of ids) assert(after.released.includes(id), 'A paired release committed only one member');
        enqueue(after);
        rules.restore(state); assert.deepEqual(rules.snapshot(),state);
      }
    }
    for (const marble of state.marbles) {
      rules.restore(state);
      if (rules.entered(marble.id)) enqueue(rules.snapshot());
      for (let dock=0;dock<board.docks.length;dock++) {
        rules.restore(state);
        const open = rules.dockOpen(dock);
        if (rules.arrive(marble.id,dock).result !== 'deliver') continue;
        assert(open, 'A sealed dock reserved a marble');
        for (const [index, seal] of (board.seals ?? []).entries()) {
          if (rules.reserved(seal.after.dock,seal.after.box) === board.boxSize) {
            assert(rules.state.sealsOpen[index], 'The final reservation must open the shutter before returning');
            openings++;
          }
          if(state.sealsOpen[index]) assert(rules.state.sealsOpen[index], 'An open seal closed');
        }
        enqueue(rules.snapshot());
      }
      rules.restore(state);
      if (marble.status === 'dropping') { rules.captured(marble.id); enqueue(rules.snapshot()); }
    }
  }
  return {states:seen.size,refusals,openings};
}
