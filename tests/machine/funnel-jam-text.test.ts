import { describe, expect, it } from 'vitest';
import { funnelJamReason } from '../../src/gameplays/conveyor';
import { BOARDS } from '../../src/sim/boards';
import { MachineRules } from '../../src/sim/rules';
import { settle } from '../../src/sim/solver';
import { FUNNEL_JAMS } from '../witnesses';
import { VARIETY_FUNNEL_JAMS } from '../variety-witnesses';

const jams: Record<string, string> = { ...FUNNEL_JAMS, ...VARIETY_FUNNEL_JAMS };
// The general machine witness for the paired board jams after its dock opens.
const coveredJams: Record<string, string> = { ...jams, 'board-109': 'AD' };

describe('the Funnel Sort jam card', () => {
  for (const board of BOARDS.filter((entry) => entry.seals?.length)) it(`${board.id} names the covered dock's wait when a seal is still shut`, () => {
    const rules = new MachineRules(board);
    for (const letter of coveredJams[board.id]!) { expect(rules.release(letter.charCodeAt(0) - 65).ok).toBe(true); settle(rules); }
    expect(rules.status).toBe('jammed');
    const shut = board.seals!.filter((seal) => !rules.dockOpen(seal.dock));
    expect(shut.length).toBeGreaterThan(0);
    const text = funnelJamReason(rules); expect(text, text).toContain('covered dock waits for the');
  });
  it('keeps the plain message after the paired board opens its sealed dock', () => {
    const board = BOARDS.find(entry => entry.id === 'board-109')!;
    const rules = new MachineRules(board);
    for (const letter of jams[board.id]!) {
      expect(rules.release(letter.charCodeAt(0) - 65).ok).toBe(true);
      settle(rules);
    }
    expect(rules.status).toBe('jammed');
    expect(board.seals!.every(seal => rules.dockOpen(seal.dock))).toBe(true);
    expect(funnelJamReason(rules)).not.toMatch(/covered/);
  });
  it('keeps the plain message on a board without seals', () => {
    const board = BOARDS.find((entry) => !entry.seals && jams[entry.id])!;
    const rules = new MachineRules(board);
    for (const letter of jams[board.id]!) { rules.release(board.pairs || board.predecessors ? letter.charCodeAt(0) - 65 : letter.charCodeAt(0) - 65); settle(rules); }
    expect(funnelJamReason(rules)).not.toMatch(/covered/);
  });
});
