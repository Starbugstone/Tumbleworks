import { describe, expect, it } from 'vitest';
import { BOARD_1, BOARD_2 } from '../../src/sim/boards';
import { MachineRules } from '../../src/sim/rules';
import { drain } from './drive';
import { invariantChecker } from './helpers';

describe('separate conveyor and funnel capacity', () => {
  it('accepts a burst of every available tray without counting queued falls as belt occupancy', () => {
    const rules = new MachineRules(BOARD_2);
    const released = [0, 0, 1, 1, 2].map((supply) => rules.release(supply).ok);
    expect(released).toEqual([true, true, true, true, true]);
    expect(rules.occupancy).toBe(0);
    expect(rules.state.marbles.filter((marble) => marble.status === 'pouring')).toHaveLength(30);
    expect(rules.status).toBe('playing');
  });

  it('reserves one belt position atomically at entry and leaves overflow in the funnel', () => {
    const rules = new MachineRules(BOARD_1);
    rules.release(0); rules.release(0); rules.release(1);
    for (let id = 0; id < 12; id += 1) expect(rules.entered(id)).toBe(true);
    expect(rules.occupancy).toBe(12);
    expect(rules.entered(12)).toBe(false);
    expect(rules.state.marbles[12]?.status).toBe('pouring');
    expect(rules.occupancy).toBe(12);
  });

  it('does not let a later matching color overtake the accepted funnel order', () => {
    const rules = new MachineRules(BOARD_1);
    rules.release(0); rules.release(0);
    const before = rules.snapshot();
    expect(rules.entered(6)).toBe(false);
    expect(rules.state).toEqual(before);
    expect(rules.entered(0)).toBe(true);
    expect(rules.occupancy).toBe(1);
    expect(rules.funnelCount).toBe(11);
    expect(rules.entered(0)).toBe(false);
  });

  it('does not count a matching color waiting behind a full blocked belt as a drain', () => {
    const rules = new MachineRules(BOARD_1);
    for (const supply of [0, 1, 0]) expect(rules.release(supply).ok).toBe(true);
    expect(rules.status).toBe('playing');
    drain(rules, invariantChecker(rules));
    expect(rules.status).toBe('jammed');
    expect(rules.occupancy).toBe(12);
    expect(rules.funnelCount).toBe(6);
    expect(rules.state.pending.every((id) => rules.state.marbles[id]?.color === 'red')).toBe(true);
    expect(rules.entered(rules.state.pending[0] ?? -1)).toBe(false);
  });

  it('feeds one new marble as soon as a delivery reserves its box slot', () => {
    const rules = new MachineRules(BOARD_1);
    for (const supply of [0, 0, 1]) rules.release(supply);
    for (let id = 0; id < 12; id += 1) expect(rules.entered(id)).toBe(true);
    expect(rules.arrive(6)).toBe('deliver');
    expect(rules.free).toBe(1);
    expect(rules.entered(12)).toBe(true);
    expect(rules.occupancy).toBe(12);
    expect(rules.funnelCount).toBe(5);
    expect(rules.status).toBe('playing');
  });

  it('snapshots preserve the release queue independently of supply-first IDs', () => {
    const rules = new MachineRules(BOARD_1);
    rules.release(1); rules.release(0);
    const checkpoint = rules.snapshot();
    expect(checkpoint.pending).toEqual([12, 13, 14, 15, 16, 17, 0, 1, 2, 3, 4, 5]);
    rules.entered(12); rules.entered(13);
    rules.restore(checkpoint);
    expect(rules.snapshot()).toEqual(checkpoint);
    checkpoint.pending.length = 0;
    expect(rules.funnelCount).toBe(12);
  });
});
