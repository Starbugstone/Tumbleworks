import assert from 'node:assert/strict';
import { LoopRules, type LoopState } from '../../../src/loop/rules';
import type { LoopBoardDef } from '../../../src/loop/types';

/** Explicit-state exploration of rule events; captures commute with rules and are folded into absorption. */
export function checkActions(board: LoopBoardDef): { states: number; refusals: number; completions: number } {
  const rules = new LoopRules(board);
  const pending = [rules.snapshot()];
  const seen = new Set<string>();
  let refusals = 0, completions = 0;
  const enqueue = (state: LoopState): void => { if (!seen.has(JSON.stringify(state))) pending.push(state); };
  while (pending.length) {
    const state = pending.pop()!;
    const key = JSON.stringify(state);
    if (seen.has(key)) continue;
    seen.add(key);
    assert(seen.size < 50_000, 'Model bound exhausted');
    rules.restore(state);
    assert(rules.occupancy <= board.loopCapacity);
    for (const truck of state.lanes.flat()) assert(rules.load(truck) <= truck.capacity);
    const live = state.lanes.flat().flatMap((truck) => [...truck.unloading, ...truck.segments.flatMap((segment) => segment.marbles)]);
    assert(new Set(live).size === live.length, 'A unit belongs to two trucks');
    for (const marble of state.marbles) {
      if (marble.status === 'on-loop') assert(!live.includes(marble.id), 'A rider still belongs to a truck');
      else if (state.lanes[marble.lane ?? -1]?.some((truck) => truck.index === marble.truck)) assert(live.includes(marble.id), 'A live truck lost its unit');
    }
    for (let lane = 0; lane < board.lanes.length; lane++) {
      rules.restore(state);
      const members = rules.tapLanes(lane);
      const result = rules.tap(lane);
      if (!result.ok) { assert.deepEqual(rules.snapshot(), state); refusals++; }
      else {
        for (const member of members) {
          assert.deepEqual(rules.front(member)!.unloading, state.lanes[member]![0]!.segments[0]!.marbles, 'A coupled pour committed only one half');
        }
        enqueue(rules.snapshot());
        rules.restore(state); // Undo is exactly the pre-action state, including both members and latch facts.
        assert.deepEqual(rules.snapshot(), state);
      }
      rules.restore(state);
      if (rules.entered(lane) !== null) enqueue(rules.snapshot());
      for (const marble of state.marbles.filter((unit) => unit.status === 'on-loop')) {
        rules.restore(state);
        const result = rules.pass(marble.id, lane);
        if (result.result !== 'absorb') continue;
        rules.captured(marble.id);
        for (const event of result.events) if (event.type === 'complete') {
          completions++;
          const id = state.lanes[lane]![0]!.id;
          assert(rules.state.lanes.flat().every((truck) => truck.pourAfter !== id && truck.coupledWith !== id), 'Completion left a stale dependency');
        }
        enqueue(rules.snapshot());
      }
    }
  }
  return { states: seen.size, refusals, completions };
}
