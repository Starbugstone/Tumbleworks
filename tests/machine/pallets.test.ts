import { beforeAll, describe, expect, it } from 'vitest';
import { MachineRules, funnelStateKey } from '../../src/sim/rules';
import { hintConveyor, settle } from '../../src/sim/solver';
import { initPhysics, Machine } from '../../src/machine/machine';
import { replayLog, replayOnto } from '../../src/engine/replay';
import { validateDockPallets } from '../../src/sim/dock-pallets';
import type { BoardDef } from '../../src/sim/types';

const board: BoardDef = {
  id: 'pallet-proof', title: '', beltCapacity: 14, boxSize: 3,
  supplies: [[{color:'red',count:3}],[{color:'blue',count:3}],[{color:'green',count:3}],[{color:'yellow',count:3}]],
  docks: [['red','green'],['blue','yellow']], pallets:[[0,1]],
};
const tiny: BoardDef = {...board,beltCapacity:1,boxSize:1,supplies:board.supplies.map(q=>q.map(p=>({...p,count:1})))};
function release(rules:MachineRules,action:number){expect(rules.release(action).ok).toBe(true);for(const id of [...rules.state.pending])expect(rules.entered(id)).toBe(true);}

beforeAll(initPhysics);
describe('shared receiving pallets',()=>{
  it('holds the first full box and advances both queues in the second final reservation',()=>{
    const rules=new MachineRules(board);release(rules,0);
    for(const marble of rules.state.marbles.filter(m=>m.color==='red'))expect(rules.arrive(marble.id,0).result).toBe('deliver');
    expect(rules.state.dockNext).toEqual([0,0]);
    expect(rules.dockColor(0)).toBeNull();
    expect(rules.boxFill(0,0)).toBe(0);
    expect(rules.dockFor('green')).toBeNull();
    const held=rules.snapshot(),key=funnelStateKey(rules);
    release(rules,1);
    const blue=rules.state.marbles.filter(m=>m.color==='blue');
    rules.arrive(blue[0]!.id,1);rules.arrive(blue[1]!.id,1);
    expect(rules.state.dockNext).toEqual([0,0]);
    const result=rules.arrive(blue[2]!.id,1);
    expect(result).toMatchObject({result:'deliver',events:[{type:'boxFull',dock:1,box:0}]});
    expect(rules.state.dockNext).toEqual([1,1]);
    expect(rules.boxFill(0,0)+rules.boxFill(1,0)).toBe(0);
    expect(rules.dockFor('green')).toBe(0);expect(rules.dockFor('yellow')).toBe(1);
    expect(funnelStateKey(rules)).not.toBe(key);
    rules.restore(held);expect(rules.state.dockNext).toEqual([0,0]);expect(funnelStateKey(rules)).toBe(key);
  });
  it('opens seals on their own prerequisite, without waiting for the pallet partner',()=>{
    const rules=new MachineRules({...tiny,beltCapacity:2,seals:[{dock:1,after:{dock:0,box:0}}]});
    release(rules,0);expect(rules.dockOpen(1)).toBe(false);
    rules.arrive(0,0);
    expect(rules.dockOpen(1)).toBe(true);expect(rules.state.dockNext).toEqual([0,0]);
    release(rules,1);rules.arrive(1,1);
    expect(rules.state.dockNext).toEqual([1,1]);expect(rules.status).toBe('playing');
  });
  it('declares a full belt wanted only by the blocked next boxes jammed',()=>{
    const rules=new MachineRules(tiny);release(rules,0);rules.arrive(0,0);rules.captured(0);
    expect(rules.actions()).toContain(1);expect(hintConveyor(rules)).toBe(1);
    release(rules,2);expect(rules.status).toBe('jammed');expect(rules.canDrain()).toBe(false);
    const before=rules.snapshot();expect(rules.release(1).ok).toBe(false);expect(rules.snapshot()).toEqual(before);
  });
  it('settles repeated pairs, stays conserved and follows current-state hints to a win',()=>{
    const rules=new MachineRules(board);
    for(let turn=0;turn<8&&rules.status==='playing';turn++){
      const saved=rules.snapshot(),action=hintConveyor(rules);expect(rules.snapshot()).toEqual(saved);
      expect(action).not.toBeNull();expect(rules.release(action!).ok).toBe(true);expect(settle(rules)).toBe(true);
      expect(rules.state.dockNext[0]).toBe(rules.state.dockNext[1]);
    }
    expect(rules.status).toBe('won');expect(rules.state.dockNext).toEqual([2,2]);
    expect(rules.state.marbles).toHaveLength(12);
    expect(rules.state.marbles.every(m=>m.status==='in-box')).toBe(true);
  });
  it('rejects crossing, reused, unknown and unequal queue pairs',()=>{
    expect(()=>validateDockPallets(board.docks,[[0,0]])).toThrow(/adjacent/);
    expect(()=>validateDockPallets([...board.docks,[]],[[0,2]])).toThrow(/adjacent/);
    expect(()=>validateDockPallets([...board.docks,[]],[[0,1],[1,2]])).toThrow(/Overlapping/);
    expect(()=>validateDockPallets(board.docks,[[0,9]])).toThrow(/Unknown/);
    expect(()=>validateDockPallets([['red'],['blue','yellow']],[[0,1]])).toThrow(/equal/);
  });
  it('waits for both physical landings, departs together, undoes and replays exactly',{timeout:120_000},()=>{
    const machine=new Machine(board);expect(machine.tap(0).ok).toBe(true);
    for(let tick=0;tick<1800;tick++){machine.step();if(!machine.transferring&&machine.rules.boxFill(0,0)===3)break;}
    const red=machine.readBoxes().find(b=>b.dock===0&&b.index===0)!;
    expect(red.fill).toBe(3);expect(red.docked).toBe(true);expect(red.departure).toBeNull();
    const before=machine.fingerprint();expect(machine.tap(1).ok).toBe(true);
    let departure=false;
    for(let tick=0;tick<1800;tick++){
      machine.step();const pair=machine.readBoxes().filter(b=>b.index===0);
      if(pair.some(b=>b.fill<3))expect(pair.every(b=>b.departure===null)).toBe(true);
      if(pair.some(b=>b.departure!==null)){expect(pair[0]!.departure).toBe(pair[1]!.departure);departure=true;break;}
    }
    expect(departure).toBe(true);
    expect(machine.undo()).toBe(true);expect(machine.fingerprint()).toBe(before);
    expect(machine.rules.state.dockNext).toEqual([0,0]);
    expect(machine.tap(1).ok).toBe(true);for(let tick=0;tick<300;tick++)machine.step();
    const log=replayLog(board.id,machine),replayed=new Machine(board);replayOnto(replayed,log);
    expect(replayed.fingerprint()).toBe(log.fingerprint);
    expect(machine.recoveries).toEqual({nudges:0,teleports:0,bounces:0});
    machine.world.free();replayed.world.free();
  });
});
