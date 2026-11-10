import { describe, expect, it } from 'vitest';
import { LOOP_VARIETY_BOARDS, LOOP_210, LOOP_211 } from '../../src/loop/variety-boards';
import { LoopRules } from '../../src/loop/rules';
import { LoopMachine } from '../../src/loop/machine';
import { hintLoopSearch, settleLoop } from '../../src/loop/solver';
import { replayLog, replayOnto } from '../../src/engine/replay';
import { laneByLane, playMachine, roundRobin, search } from '../../scripts/loop-author';
import { featureTrap } from '../../scripts/loop-features';
import { VARIETY_LOOP_JAMS, VARIETY_LOOP_WITNESSES } from '../variety-witnesses';

for (const board of LOOP_VARIETY_BOARDS) describe(board.id, () => {
  it('has a complete search, causal trap and real machine win/jam at both tapping cadences', () => {
    const found = search(board);
    expect(found.solvable).toBe(true);
    expect(found.winning / found.orders).toBeGreaterThanOrEqual(0.02);
    expect(found.winning / found.orders).toBeLessThanOrEqual(0.55);
    expect(laneByLane(board)).toBe('jammed'); expect(roundRobin(board)).toBe('jammed');
    expect(featureTrap(board, board.id === 'loop-210' ? 'latch' : 'coupling', VARIETY_LOOP_JAMS[board.id]!)).toBe(true);
    for (const patient of [false, true]) {
      expect(playMachine(board, VARIETY_LOOP_WITNESSES[board.id]!, 185, patient)).toMatchObject({ status: 'won', done: true });
      expect(playMachine(board, VARIETY_LOOP_JAMS[board.id]!, 185, patient)).toMatchObject({ status: 'jammed', done: true });
    }
  });
  it('wins through current-state hints without altering the caller', () => {
    const rules = new LoopRules(board);
    for (let turn = 0; turn < 15 && rules.status === 'playing'; turn++) {
      settleLoop(rules); if (rules.status !== 'playing') break;
      const saved = rules.snapshot(), started = performance.now(), hint = hintLoopSearch(rules);
      expect(performance.now() - started).toBeLessThan(250); expect(rules.snapshot()).toEqual(saved);
      expect(rules.actions()).toContain(hint.lane); expect(rules.tap(hint.lane!).ok).toBe(true);
    }
    settleLoop(rules); expect(rules.status).toBe('won');
  });
  it('restores the full pre-action state and replays exactly through undo', () => {
    const machine = new LoopMachine(board), initial = machine.fingerprint();
    expect(machine.tap(0).ok).toBe(true);
    for (let tick = 0; tick < 120; tick++) machine.step();
    expect(machine.undo()).toBe(true); expect(machine.fingerprint()).toBe(initial);
    expect(machine.tap(0).ok).toBe(true);
    for (let tick = 0; tick < 240; tick++) machine.step();
    const log = replayLog(board.id, machine), restored = new LoopMachine(board);
    replayOnto(restored, log); expect(restored.fingerprint()).toBe(log.fingerprint);
  });
});

it('finishing the short truck opens the long truck latch before departure, and undo restores it', () => {
  const machine = new LoopMachine(LOOP_210);
  expect(machine.rules.front(0)?.capacity).toBe(12); expect(machine.rules.front(1)?.capacity).toBe(24);
  const initial = machine.fingerprint(); expect(machine.tap(1)).toEqual({ ok: false, reason: 'latched' });
  expect(machine.fingerprint()).toBe(initial);
  let opened = false;
  for (const letter of VARIETY_LOOP_WITNESSES[LOOP_210.id]!) {
    const before = machine.fingerprint(); expect(machine.tap(letter.charCodeAt(0) - 65).ok).toBe(true);
    for (let tick = 0; tick < 2400; tick++) {
      machine.step();
      if (machine.rules.front(1)?.pourAfter === null) { opened = true; break; }
      if (!machine.transferring && !machine.rules.pending && !machine.rules.canDrain()) break;
    }
    if (opened) {
      expect(machine.readTrucks().some(truck => truck.lane === 0 && truck.index === 0 && truck.visible)).toBe(true);
      expect(machine.undo()).toBe(true); expect(machine.fingerprint()).toBe(before);
      expect(machine.rules.front(1)?.pourAfter).toBe('0:0'); break;
    }
  }
  expect(opened).toBe(true);
});

it('unequal beds pour together from either endpoint and a refused repeat changes nothing', () => {
  const a = new LoopMachine(LOOP_211), b = new LoopMachine(LOOP_211), initial = a.fingerprint();
  expect(a.tap(0).ok).toBe(true); expect(b.tap(1).ok).toBe(true);
  expect(a.fingerprint()).toBe(b.fingerprint());
  expect(a.rules.front(0)?.unloading).toHaveLength(2); expect(a.rules.front(1)?.unloading).toHaveLength(8);
  const poured = a.fingerprint(); expect(a.tap(1).ok).toBe(false); expect(a.fingerprint()).toBe(poured);
  expect(a.undo()).toBe(true); expect(a.fingerprint()).toBe(initial);
});
