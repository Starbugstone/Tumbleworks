import { expect, it } from 'vitest';
import { checkFunnelActions } from '../../docs/models/funnel-actions/check';
import type { BoardDef } from '../../src/sim/types';
const pair: BoardDef = { id:'bounded-pair',title:'',beltCapacity:2,boxSize:1,supplies:[[{color:'red',count:1}],[{color:'blue',count:1}]],docks:[['red'],['blue']],pairs:[[0,1]] };
const seal: BoardDef = {...pair,id:'bounded-seal',pairs:[],seals:[{dock:0,after:{dock:1,box:0}}]};
it('checks every pair/entry/reservation/capture ordering and catches a deliberate partial pair', () => {
  expect(checkFunnelActions(pair).states).toBeGreaterThan(5);
  expect(() => checkFunnelActions(pair,true)).toThrow(/only one member/);
});
it('checks seal reservation closure across every ordering, including belt-full interleavings', () => {
  const result = checkFunnelActions(seal);
  expect(result.openings).toBeGreaterThan(0);
  expect(result.refusals).toBeGreaterThan(0);
});
