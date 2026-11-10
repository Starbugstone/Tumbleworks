import assert from 'node:assert/strict';
import { MachineRules, type RulesState } from '../../../src/sim/rules';
import type { BoardDef } from '../../../src/sim/types';

/** Production transitions, exhaustively interleaved on a bounded four-marble board. */
export function checkPalletInterleavings(board: BoardDef, mutant?: 'advance-one' | 'delay-advance') {
  const rules = new MachineRules(board);
  const stack = [rules.snapshot()], seen = new Set<string>();
  let waiting = 0, advances = 0, captures = 0, jams = 0, wins = 0;
  const assertState = (state: RulesState): void => {
    rules.restore(state);
    assert(rules.occupancy <= board.beltCapacity);
    assert.equal(state.marbles.length, board.supplies.flat().reduce((n,p)=>n+p.count,0));
    assert.deepEqual([...state.pending].sort(),state.marbles.filter(m=>m.status==='pouring').map(m=>m.id).sort());
    for (const [a,b] of board.pallets ?? []) {
      assert.equal(state.dockNext[a],state.dockNext[b],'A pallet advanced only one queue');
      const next = state.dockNext[a]!;
      for(let previous=0;previous<next;previous++){
        assert.equal(rules.reserved(a,previous),board.boxSize,'A queue advanced before both reservations');
        assert.equal(rules.reserved(b,previous),board.boxSize,'A queue advanced before both reservations');
      }
      if(next < board.docks[a]!.length) {
        const fullA=rules.reserved(a,next)===board.boxSize,fullB=rules.reserved(b,next)===board.boxSize;
        assert(!(fullA&&fullB),'Both full reservations must advance before capture');
        if(fullA!==fullB)waiting++;
      }
    }
    for(let dock=0;dock<board.docks.length;dock++)for(let box=0;box<board.docks[dock]!.length;box++){
      assert(rules.reserved(dock,box)<=board.boxSize);
      for(const m of state.marbles.filter(m=>m.dock===dock&&m.box===box))assert.equal(m.color,board.docks[dock]![box]);
    }
  };
  const enqueue = (before:RulesState,after:RulesState):void => {
    for(const [a,b] of board.pallets??[])if(after.dockNext[a]!==before.dockNext[a]){
      advances++;
      if(mutant==='delay-advance'){after.dockNext[a]=before.dockNext[a]!;after.dockNext[b]=before.dockNext[b]!;}
    }
    if(mutant==='advance-one'){
      rules.restore(after);
      for(const [a,b] of board.pallets??[]){
        const next=after.dockNext[a]!;
        if(next<board.docks[a]!.length&&rules.reserved(a,next)===board.boxSize&&rules.reserved(b,next)<board.boxSize)after.dockNext[a]=next+1;
      }
    }
    assertState(after);
    if(!seen.has(JSON.stringify(after)))stack.push(after);
    rules.restore(before);assert.deepEqual(rules.snapshot(),before,'Snapshot restoration must undo the entire transition');
  };
  while(stack.length){
    const state=stack.pop()!,key=JSON.stringify(state);if(seen.has(key))continue;
    seen.add(key);assert(seen.size<=50_000,'Pallet exploration exhausted its bound');assertState(state);
    if(state.status==='jammed')jams++;
    if(state.status==='won')wins++;
    for(let action=0;action<board.supplies.length;action++){
      rules.restore(state);const result=rules.release(action);
      if(result.ok)enqueue(state,rules.snapshot());else assert.deepEqual(rules.snapshot(),state);
    }
    for(const marble of state.marbles){
      rules.restore(state);if(rules.entered(marble.id))enqueue(state,rules.snapshot());
      for(let dock=0;dock<board.docks.length;dock++){
        rules.restore(state);if(rules.arrive(marble.id,dock).result==='deliver')enqueue(state,rules.snapshot());
      }
      if(marble.status==='dropping'){rules.restore(state);rules.captured(marble.id);captures++;enqueue(state,rules.snapshot());}
    }
  }
  return {states:seen.size,waiting,advances,captures,jams,wins};
}
