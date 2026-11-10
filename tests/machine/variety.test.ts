import { beforeAll, describe, expect, it } from 'vitest';
import { FUNNEL_VARIETY_BOARDS, BOARD_210, BOARD_211 } from '../../src/sim/variety-boards';
import { MachineRules } from '../../src/sim/rules';
import { hintConveyorSearch, settle } from '../../src/sim/solver';
import { initPhysics, Machine } from '../../src/machine/machine';
import { replayLog, replayOnto } from '../../src/engine/replay';
import { naiveOrders, play, playMachine, search } from '../../scripts/funnel-author';
import { funnelFeatureTrap } from '../../scripts/funnel-features';
import { VARIETY_FUNNEL_JAMS, VARIETY_FUNNEL_WITNESSES } from '../variety-witnesses';

beforeAll(initPhysics);
for (const board of FUNNEL_VARIETY_BOARDS) describe(board.id, () => {
  it('has an exhaustively checked win, causal loss and three losing naive orders', () => {
    const found = search(board);
    expect(found.complete).toBe(true);
    expect(found.solvable).toBe(true);
    expect(found.winning / found.orders).toBeGreaterThanOrEqual(0.02);
    expect(found.winning / found.orders).toBeLessThanOrEqual(0.55);
    expect(funnelFeatureTrap(board)).not.toBeNull();
    expect(naiveOrders(board).map((order) => play(board, order))).toEqual(['jammed', 'jammed', 'jammed']);
  });
  it('wins and jams in the physical machine with both brisk and patient taps', { timeout: 120_000 }, async () => {
    for (const patient of [false, true]) {
      const win = await playMachine(board, VARIETY_FUNNEL_WITNESSES[board.id]!, 150, patient);
      expect(win.status).toBe('won'); expect(win.clean).toBe(true);
      const jam = await playMachine(board, VARIETY_FUNNEL_JAMS[board.id]!, 150, patient);
      expect(jam.status).toBe('jammed'); expect(jam.clean).toBe(true);
    }
  });
  it('answers opening and current-state hints without mutating the live rules', () => {
    const rules = new MachineRules(board);
    for (let turn = 0; turn < 12 && rules.status === 'playing'; turn++) {
      settle(rules); if (rules.status !== 'playing') break;
      const saved = rules.snapshot(), started = performance.now();
      const hint = hintConveyorSearch(rules);
      expect(performance.now() - started).toBeLessThan(250);
      expect(rules.snapshot()).toEqual(saved);
      expect(rules.actions()).toContain(hint.supply);
      expect(rules.release(hint.supply!).ok).toBe(true);
    }
    settle(rules); expect(rules.status).toBe('won');
  });
  it('undo restores physics and replay reproduces accepted actions', () => {
    const machine = new Machine(board), before = machine.fingerprint();
    const first = VARIETY_FUNNEL_WITNESSES[board.id]!.charCodeAt(0) - 65;
    expect(machine.tap(first).ok).toBe(true);
    for (let tick = 0; tick < 90; tick++) machine.step();
    expect(machine.undo()).toBe(true); expect(machine.fingerprint()).toBe(before);
    expect(machine.tap(first).ok).toBe(true);
    for (let tick = 0; tick < 180; tick++) machine.step();
    const log = replayLog(board.id, machine), replayed = new Machine(board);
    replayOnto(replayed, log); expect(replayed.fingerprint()).toBe(log.fingerprint);
    expect(machine.recoveries).toEqual({ nudges: 0, teleports: 0, bounces: 0 });
    machine.world.free(); replayed.world.free();
  });
});

it('the mixed short shelf opens only after both accepted supports, before either animation ends', () => {
  const machine = new Machine(BOARD_210), initial = machine.fingerprint();
  expect(machine.tap(1).ok).toBe(false); expect(machine.fingerprint()).toBe(initial);
  expect(machine.tap(0).ok).toBe(true); expect(machine.tap(1).ok).toBe(false);
  expect(machine.tap(2).ok).toBe(true); expect(machine.tap(1).ok).toBe(true);
  expect(machine.tick).toBe(0);
  expect(machine.undo()).toBe(true); expect(machine.undo()).toBe(true);
  expect(machine.tap(1).ok).toBe(false);
  expect(machine.undo()).toBe(true); expect(machine.fingerprint()).toBe(initial);
  machine.world.free();
});

it('the sealed pair accepts either endpoint atomically and one undo restores both', () => {
  const a = new Machine(BOARD_211), b = new Machine(BOARD_211);
  const initial = a.fingerprint();
  expect(a.tap(0).ok).toBe(true); expect(b.tap(2).ok).toBe(true);
  expect(a.fingerprint()).toBe(b.fingerprint());
  expect(a.rules.state.released).toEqual([0, 2]); expect(a.rules.dockOpen(0)).toBe(false);
  const released = a.fingerprint(); expect(a.tap(2).ok).toBe(false); expect(a.fingerprint()).toBe(released);
  expect(a.undo()).toBe(true); expect(a.fingerprint()).toBe(initial);
  a.world.free(); b.world.free();
});
