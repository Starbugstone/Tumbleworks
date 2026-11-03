import { beforeAll, describe, expect, it } from 'vitest';
import { BOARD_200, BOARD_201, BOARD_202 } from '../../src/sim/boards';
import { funnelStateKey, MachineRules } from '../../src/sim/rules';
import { hintConveyor, settle } from '../../src/sim/solver';
import { initPhysics, Machine } from '../../src/machine/machine';
import { replayLog, replayOnto } from '../../src/engine/replay';
import { funnelFeatureTrap } from '../../scripts/funnel-features';
import { generate, search, stateKey, winsEitherWay, FUNNEL_RULE_RECIPES, naiveOrders, play } from '../../scripts/funnel-author';
import { funnelStrongKey } from '../../scripts/level-strong';
import { FUNNEL_WITNESSES } from '../witnesses';
import type { BoardDef } from '../../src/sim/types';

beforeAll(initPhysics);
const lessons = [BOARD_200, BOARD_201, BOARD_202];
for (const [index, board] of lessons.entries()) describe(board.id, () => {
  it('has a winning line and an attractive opening that loses because of its rule', { timeout: 120_000 }, async () => {
    const found = search(board);
    expect(found.complete).toBe(true);
    expect(found.solvable).toBe(true);
    expect(found.winning).toBeLessThan(found.orders);
    expect(naiveOrders(board).map((order) => play(board,order))).toEqual(['jammed','jammed','jammed']);
    expect(funnelFeatureTrap(board)).toBe([4, 0, 1][index]);
    expect(await winsEitherWay(board, FUNNEL_WITNESSES[board.id]!)).toBe(true);
  });
  it('current-state hints return legal stable actions, preserve the caller and win', () => {
    const rules = new MachineRules(board);
    for (let turn = 0; turn < 10; turn++) {
      settle(rules);
      if (rules.status !== 'playing') break;
      const before = rules.snapshot();
      const action = hintConveyor(rules);
      expect(rules.snapshot()).toEqual(before);
      expect(action).not.toBeNull();
      expect(rules.actions()).toContain(action);
      expect(rules.release(action!).ok).toBe(true);
    }
    settle(rules);
    expect(rules.status).toBe('won');
  });
  it('replays a physics game including undo exactly', { timeout: 120_000 }, () => {
    const machine = new Machine(board);
    const action = machine.rules.actions()[0]!;
    machine.tap(action);
    for (let tick = 0; tick < 120; tick++) machine.step();
    expect(machine.undo()).toBe(true);
    machine.tap(action);
    for (let tick = 0; tick < 240; tick++) machine.step();
    const log = replayLog(board.id, machine);
    const replayed = new Machine(board);
    replayOnto(replayed, log);
    expect(replayed.fingerprint()).toBe(log.fingerprint);
    expect(machine.recoveries).toEqual({ nudges: 0, teleports: 0, bounces: 0 });
    machine.world.free(); replayed.world.free();
  });
});

it('regenerates the three lesson boards with the extended recipe', () => {
  for (const [index, board] of lessons.entries()) {
    const recipe = FUNNEL_RULE_RECIPES[index]!;
    const generated = generate(recipe, recipe.seed);
    expect(generated).toEqual(board);
  }
});
it('a pair commits in ID order from either endpoint; refusal changes nothing; undo restores physics', () => {
  const a = new Machine(BOARD_200), b = new Machine(BOARD_200);
  const before = a.fingerprint();
  const result = a.tap(2);
  expect(result.ok && result.packets.map((p) => p.id)).toEqual([0,2]);
  b.tap(0);
  expect(a.fingerprint()).toBe(b.fingerprint());
  const released = a.fingerprint();
  expect(a.tap(2).ok).toBe(false);
  expect(a.fingerprint()).toBe(released);
  expect(a.step().filter((e) => e.type === 'pour').map((e) => e.supply)).toEqual([0,1]);
  expect(a.tap(4).ok).toBe(true); // another accessible crate while both are falling
  expect(a.undo()).toBe(true);
  expect(a.undo()).toBe(true);
  expect(a.fingerprint()).toBe(before);
  a.world.free(); b.world.free();
  const rules = new MachineRules({ ...BOARD_200, pairs: [[1,2]] });
  const saved = rules.snapshot();
  expect(rules.release(2).ok).toBe(false);
  expect(rules.snapshot()).toEqual(saved);
});
it('the shelf join needs both accepted releases, without waiting for animation', () => {
  const machine = new Machine(BOARD_201);
  expect(machine.tap(1).ok).toBe(false);
  expect(machine.tap(0).ok).toBe(true);
  expect(machine.tap(1).ok).toBe(false);
  expect(machine.tap(2).ok).toBe(true);
  expect(machine.tap(1).ok).toBe(true);
  expect(machine.tick).toBe(0);
  machine.world.free();
});
const sealFixture: BoardDef = { id:'seal', title:'', beltCapacity:3, boxSize:3,
  supplies:[[{color:'red',count:3}],[{color:'blue',count:3}]], docks:[['red'],['blue']], seals:[{dock:0,after:{dock:1,box:0}}] };
it('a full belt wanting only a sealed dock jams; a real unlock opens before loss and capture', () => {
  const jam = new MachineRules(sealFixture);
  jam.release(0);
  for (const id of [...jam.state.pending]) jam.entered(id);
  expect(jam.status).toBe('jammed');
  expect(jam.dockFor('red')).toBeNull();
  const rules = new MachineRules(sealFixture);
  rules.release(1);
  for (const id of [...rules.state.pending]) rules.entered(id);
  expect(rules.status).toBe('playing'); // full but drainable
  const blue = rules.state.marbles.filter((m) => m.color === 'blue');
  for (const m of blue.slice(0,2)) rules.arrive(m.id,1);
  expect(rules.dockOpen(0)).toBe(false);
  expect(rules.arrive(blue[2]!.id,1).result).toBe('deliver');
  expect(rules.dockOpen(0)).toBe(true);
  expect(rules.state.marbles.filter((m) => m.status === 'in-box')).toHaveLength(0);
  const opened = rules.snapshot();
  rules.release(0); settle(rules);
  expect(rules.status).toBe('won');
  rules.restore(opened);
  expect(rules.dockOpen(0)).toBe(true);
});
it('undo after the final reservation restores a closed seal and the complete physics state', {timeout:120_000}, () => {
  const machine = new Machine({ ...sealFixture, beltCapacity:14 });
  const before = machine.fingerprint();
  machine.tap(1);
  for(let tick=0;tick<1800 && !machine.rules.dockOpen(0);tick++) machine.step();
  expect(machine.rules.dockOpen(0)).toBe(true);
  expect(machine.undo()).toBe(true);
  expect(machine.rules.dockOpen(0)).toBe(false);
  expect(machine.fingerprint()).toBe(before);
  machine.world.free();
});
it('settled and strong keys distinguish released sets and seals with equal queue lengths', () => {
  const rules = new MachineRules(BOARD_201);
  const original = rules.snapshot();
  const changed = structuredClone(original); changed.released = [0];
  const key = stateKey(rules); rules.restore(changed);
  expect(funnelStateKey(rules)).not.toBe(key);
  expect(funnelStrongKey(changed)).not.toBe(funnelStrongKey(original));
  const sealed = new MachineRules(BOARD_202); const before = stateKey(sealed);
  const opened = sealed.snapshot(); opened.sealsOpen[0] = true; sealed.restore(opened);
  expect(stateKey(sealed)).not.toBe(before);
  const closed = structuredClone(opened); closed.sealsOpen[0] = false;
  expect(funnelStrongKey(closed)).not.toBe(funnelStrongKey(opened));
});
it('rejects cycles, bad references and overlapping pairs', () => {
  expect(() => new MachineRules({...BOARD_201,predecessors:{0:[1],1:[0]}})).toThrow(/cyclic/);
  expect(() => new MachineRules({...BOARD_201,predecessors:{0:[99]}})).toThrow(/Invalid/);
  expect(() => new MachineRules({...BOARD_200,pairs:[[0,2],[2,4]]})).toThrow(/overlapping/);
  expect(() => new MachineRules({...BOARD_202,seals:[{dock:0,after:{dock:1,box:0}},{dock:1,after:{dock:0,box:0}}]})).toThrow(/Cyclic/);
});
it('rejects a shelf wider than four exposed crates', () => {
  const board: BoardDef = { id:'too-wide',title:'',beltCapacity:14,boxSize:3,supplies:Array.from({length:5},()=>[{color:'red',count:3}]),docks:[Array.from({length:5},()=> 'red')],predecessors:{} };
  expect(()=>new MachineRules(board)).toThrow(/more than four/);
});
