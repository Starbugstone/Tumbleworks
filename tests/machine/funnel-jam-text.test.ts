import { describe, expect, it } from 'vitest';
import { funnelJamReason } from '../../src/gameplays/conveyor';
import { BOARDS } from '../../src/sim/boards';
import { MachineRules } from '../../src/sim/rules';
import { settle } from '../../src/sim/solver';
import { FUNNEL_JAMS } from '../witnesses';
import { VARIETY_FUNNEL_JAMS } from '../variety-witnesses';

const jams: Record<string, string> = { ...FUNNEL_JAMS, ...VARIETY_FUNNEL_JAMS };

describe('the Funnel Sort jam card', () => {
  for (const board of BOARDS.filter((entry) => entry.seals?.length)) it(`${board.id} names the covered dock's wait when a seal is still shut`, () => {
    const rules = new MachineRules(board);
    for (const letter of jams[board.id]!) { expect(rules.release(letter.charCodeAt(0) - 65).ok).toBe(true); settle(rules); }
    expect(rules.status).toBe('jammed');
    const shut = board.seals!.filter((seal) => !rules.dockOpen(seal.dock));
    expect(shut.length).toBeGreaterThan(0);
    const text = funnelJamReason(rules); expect(text, text).toContain('covered dock waits for the');
  });
  it('keeps the plain message on a board without seals', () => {
    const board = BOARDS.find((entry) => !entry.seals && jams[entry.id])!;
    const rules = new MachineRules(board);
    for (const letter of jams[board.id]!) { rules.release(board.pairs || board.predecessors ? letter.charCodeAt(0) - 65 : letter.charCodeAt(0) - 65); settle(rules); }
    expect(funnelJamReason(rules)).not.toMatch(/covered/);
  });
});
