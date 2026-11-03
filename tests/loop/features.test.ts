import { describe, expect, it } from 'vitest';
import { LOOP_1, LOOP_200, LOOP_201, LOOP_202 } from '../../src/loop/boards';
import { LoopRules, loopStateKey } from '../../src/loop/rules';
import { LoopMachine } from '../../src/loop/machine';
import { hintLoop, settleLoop } from '../../src/loop/solver';
import type { LoopBoardDef } from '../../src/loop/types';
import { replayLog, replayOnto } from '../../src/engine/replay';
import { generate, search, stateKey, winsEitherWay } from '../../scripts/loop-author';
import { featureTrap } from '../../scripts/loop-features';
import { loopGraphKey, loopOrderKey, tally } from '../../scripts/level-score';
import { FAST_WITNESSES, LOOP_JAMS, LOOP_WITNESSES } from '../witnesses';

const lessons = [LOOP_200, LOOP_201, LOOP_202];
const play = (rules: LoopRules, order: string): void => {
  settleLoop(rules);
  for (const letter of order) { expect(rules.tap(letter.charCodeAt(0) - 65).ok).toBe(true); settleLoop(rules); }
};
const latchedExchange: LoopBoardDef = {
  id: 'latch-intake', title: '', truckCapacity: 4, loopCapacity: 4,
  lanes: [
    [{ id: 'latched', pourAfter: 'key', segments: [{ color: 'red', count: 2 }] }],
    [{ id: 'key', segments: [{ color: 'red', count: 2 }, { color: 'blue', count: 2 }] }],
  ], loop: [{ color: 'blue', count: 2 }],
};

describe('Loop Sort feature lessons', () => {
  for (const [i, board] of lessons.entries()) {
    it(`${board.id} has a machine win and a causal trap`, () => {
      const found = search(board);
      expect(found.solvable).toBe(true);
      expect(found.winning).toBeLessThan(found.orders);
      expect(featureTrap(board, (['latch', 'short', 'coupling'] as const)[i]!, LOOP_JAMS[board.id]!)).toBe(true);
      expect(winsEitherWay(board, LOOP_WITNESSES[board.id]!)).toBe(true);
      const rules = new LoopRules(board);
      play(rules, LOOP_WITNESSES[board.id]!);
      expect(rules.status).toBe('won');
    });
    it(`${board.id} current-state hints win without mutating the caller`, () => {
      const rules = new LoopRules(board);
      for (let turns = 0; turns < 20 && rules.status === 'playing'; turns++) {
        settleLoop(rules);
        if (rules.status !== 'playing') break;
        const saved = rules.snapshot();
        const lane = hintLoop(rules);
        expect(rules.snapshot()).toEqual(saved);
        expect(lane).not.toBeNull();
        expect(rules.tap(lane!).ok).toBe(true);
      }
      settleLoop(rules);
      expect(rules.status).toBe('won');
    });
    it(`${board.id} replays actions and undo exactly`, () => {
      const machine = new LoopMachine(board);
      const lane = machine.rules.actions()[0]!;
      expect(machine.tap(lane).ok).toBe(true);
      for (let tick = 0; tick < 150; tick++) machine.step();
      expect(machine.undo()).toBe(true);
      expect(machine.tap(lane).ok).toBe(true);
      for (let tick = 0; tick < 300; tick++) machine.step();
      const log = replayLog(board.id, machine);
      const replayed = new LoopMachine(board);
      replayOnto(replayed, log);
      expect(replayed.fingerprint()).toBe(log.fingerprint);
    });
  }
  it('reverse-generates the three reproducible feature boards', () => {
    for (const [at, feature] of ['latch', 'short', 'coupling'].entries()) {
      const generated = generate({ id: 'probe', title: '', fr: '', note: '', colors: 3, lanes: [2, 1, 1], segments: 3, capacity: 40, ringMax: 20, seed: 1, win: [0, 1], naiveJams: false,
        ...(feature === 'latch' ? { latch: ['0:0', '1:0'] as const } : feature === 'short' ? { capacities: [[12, 24], [24], [24]] } : { coupling: ['0:0', '1:0'] as const }),
      }, [93, 141, 2][at]!);
      expect(generated).not.toBeNull();
      const board = { ...generated!, loopCapacity: lessons[at]!.loopCapacity };
      expect(board.lanes).toEqual(lessons[at]!.lanes);
      expect(search(board).solvable).toBe(true);
      expect(featureTrap(board, (['latch', 'short', 'coupling'] as const)[at]!, LOOP_JAMS[lessons[at]!.id]!)).toBe(true);
    }
  });
});

describe('latch transitions and jams', () => {
  it('rejects without changing state and opens on the prerequisite reservation, before departure', () => {
    const machine = new LoopMachine(LOOP_200);
    const before = machine.fingerprint();
    expect(machine.tap(0)).toEqual({ ok: false, reason: 'latched' });
    expect(machine.fingerprint()).toBe(before);
    expect(machine.actions).toEqual([]);
    let secondBefore = '';
    for (let poured = 0; poured < 2; poured++) {
      secondBefore = machine.fingerprint();
      expect(machine.tap(1).ok).toBe(true);
      for (let tick = 0; tick < 2400; tick++) {
        machine.step();
        if (poured === 1 && machine.rules.front(0)?.pourAfter === null) break;
        if (poured === 0 && !machine.rules.pending && !machine.rules.canDrain() && !machine.transferring) break;
      }
    }
    expect(machine.rules.front(0)?.pourAfter).toBeNull();
    expect(machine.readTrucks().find((truck) => truck.lane === 1)?.visible).toBe(true);
    expect(machine.rules.status).toBe('playing');
    expect(machine.undo()).toBe(true);
    expect(machine.fingerprint()).toBe(secondBefore);
    expect(machine.rules.front(0)?.pourAfter).toBe('1:0');
  });
  it('allows a latched one-colour truck to receive and complete before its prerequisite', () => {
    const rules = new LoopRules(latchedExchange);
    expect(rules.wants(0)).toBe('red');
    expect(rules.tap(1).ok).toBe(true);
    const first = rules.entered(1)!;
    rules.pass(first, 0);
    const last = rules.entered(1)!;
    expect(rules.pass(last, 0)).toMatchObject({ result: 'absorb', events: [expect.objectContaining({ type: 'complete', lane: 0 })] });
    expect(rules.front(0)).toBeNull();
    expect(rules.front(1)).not.toBeNull();
    settleLoop(rules);
    expect(rules.status).toBe('won');
  });
  it('a full loop can drain into a latch; hypothetical future unlocking alone is no rescue', () => {
    const rules = new LoopRules({ ...latchedExchange, loopCapacity: 2 });
    expect(rules.status).toBe('jammed'); // Only blue circulates; key is full and latched truck wants red.
    const receiving = new LoopRules({ ...latchedExchange, loopCapacity: 2, lanes: [[{ id: 'latched', pourAfter: 'key', segments: [{ color: 'blue', count: 2 }] }], [{ id: 'key', segments: [{ color: 'blue', count: 2 }, { color: 'red', count: 2 }] }]], loop: [{ color: 'red', count: 2 }] });
    expect(receiving.status).toBe('jammed');
    // Pouring key before the loop fills makes its red available to the latched receiver.
    const live = new LoopRules(latchedExchange);
    live.tap(1);
    live.entered(1); live.entered(1);
    expect(live.free).toBe(0);
    expect(live.canDrain()).toBe(true);
    expect(live.status).toBe('playing');
    settleLoop(live);
    expect(live.status).toBe('won');
    const allLatched = { ...LOOP_200, lanes: LOOP_200.lanes.map((queue, lane) => queue.map((truck, index) => index === 0 && lane > 0 ? { ...truck, pourAfter: '0:1' } : truck)) };
    expect(new LoopRules(allLatched).status).toBe('jammed');
  });
  it('a full loop whose only receiver is latched remains live', () => {
    const board: LoopBoardDef = { id: 'only-latch-drains', title: '', truckCapacity: 4, loopCapacity: 2, lanes: [
      [{ id: 'locked', pourAfter: 'key', segments: [{ color: 'red', count: 2 }] }],
      [{ id: 'key', segments: [{ color: 'green', count: 2 }, { color: 'blue', count: 2 }] }],
      [{ segments: [{ color: 'blue', count: 2 }, { color: 'green', count: 2 }] }],
    ], loop: [{ color: 'red', count: 2 }] };
    const rules = new LoopRules(board);
    expect(rules.free).toBe(0);
    expect([rules.wants(0), rules.wants(1), rules.wants(2)]).toEqual(['red', null, null]);
    expect(rules.status).toBe('playing');
    settleLoop(rules);
    expect(rules.front(0)).toBeNull();
    expect(rules.status).toBe('playing');
  });
  it('opens all dependencies before checking the otherwise terminal no-pour state', () => {
    const board: LoopBoardDef = { id: 'unlock-before-jam', title: '', truckCapacity: 4, loopCapacity: 2, lanes: [
      [{ id: 'a', capacity: 2, pourAfter: 'key', segments: [{ color: 'green', count: 1 }, { color: 'red', count: 1 }] }],
      [{ id: 'b', capacity: 2, pourAfter: 'key', segments: [{ color: 'red', count: 1 }, { color: 'green', count: 1 }] }],
      [{ id: 'key', segments: [{ color: 'blue', count: 3 }] }],
    ], loop: [{ color: 'blue', count: 1 }] };
    const rules = new LoopRules(board);
    expect(rules.canPour()).toBe(false);
    const unit = rules.state.marbles.find((marble) => marble.status === 'on-loop')!;
    expect(rules.pass(unit.id, 2)).toMatchObject({ events: [{ type: 'complete' }] });
    expect(rules.status).toBe('playing');
    expect(rules.actions()).toEqual([0, 1]);
    play(rules, 'AB');
    expect(rules.status).toBe('won');
  });
  it('rejects cycles, unknown identities and overlapping couplings', () => {
    expect(() => new LoopRules({ ...latchedExchange, lanes: [[{ ...latchedExchange.lanes[0]![0]!, pourAfter: 'unknown' }], latchedExchange.lanes[1]!] })).toThrow(/Unknown/);
    expect(() => new LoopRules({ ...latchedExchange, lanes: [latchedExchange.lanes[0]!, [{ ...latchedExchange.lanes[1]![0]!, pourAfter: 'latched' }]] })).toThrow(/Cyclic/);
    expect(() => new LoopRules({ ...LOOP_202, couplings: [['0:0', '1:0'], ['1:0', '2:0']] })).toThrow(/disjoint/);
  });
});

describe('coupled atomicity and short capacity', () => {
  it('either endpoint starts the same two pours; a rapid tap changes nothing; undo restores both', () => {
    const a = new LoopMachine(LOOP_202), b = new LoopMachine(LOOP_202);
    const before = a.fingerprint();
    expect(a.tap(0)).toMatchObject({ ok: true, pours: [{ lane: 0 }, { lane: 1 }] });
    expect(b.tap(1).ok).toBe(true);
    expect(a.fingerprint()).toBe(b.fingerprint());
    const pouring = a.fingerprint();
    expect(a.tap(1).ok).toBe(false);
    expect(a.fingerprint()).toBe(pouring);
    expect(a.step().filter((event) => event.type === 'pour').map((event) => event.lane)).toEqual([0, 1]);
    expect(a.undo()).toBe(true);
    expect(a.fingerprint()).toBe(before);
  });
  it('blocks if the partner is waiting, latched, single-colour or unloading, and uncouples on completion', () => {
    const rules = new LoopRules(LOOP_202);
    const original = rules.snapshot();
    for (const restriction of ['waiting', 'latched', 'single', 'busy']) {
      const state = structuredClone(original);
      const partner = state.lanes[1]![0]!;
      if (restriction === 'waiting') state.lanes[1]!.unshift({ ...structuredClone(partner), id: 'other' });
      if (restriction === 'latched') partner.pourAfter = '2:0';
      if (restriction === 'single') partner.segments = partner.segments.slice(-1);
      if (restriction === 'busy') partner.unloading = [partner.segments[0]!.marbles[0]!];
      rules.restore(state);
      expect(rules.tap(0).ok).toBe(false);
      expect(rules.snapshot()).toEqual(state);
    }
    rules.restore(original); play(rules, 'A');
    expect(rules.front(1)?.coupledWith).toBeNull();
    expect(rules.tapLanes(1)).toEqual([1]);
  });
  it('keys latch state and capacity even with identical cargo, and uses the same identity in every graph', () => {
    const rules = new LoopRules(LOOP_200);
    const key = stateKey(rules);
    expect(loopGraphKey(rules)).toBe(key);
    expect(loopOrderKey(rules.state)).toBe(key);
    const opened = rules.snapshot(); opened.lanes[0]![0]!.pourAfter = null;
    expect(loopStateKey(opened)).not.toBe(key);
    const short = new LoopRules(LOOP_201).snapshot();
    const longer = { ...short, lanes: short.lanes.map((queue, lane) => lane ? queue : queue.map((truck, i) => i ? truck : { ...truck, capacity: 24 })) };
    expect(loopStateKey(short)).not.toBe(loopStateKey(longer));
  });
  it('short beds retain unit scale, report their own percentages and conserve capacities by colour', () => {
    const machine = new LoopMachine(LOOP_201);
    const truck = machine.readTrucks()[0]!;
    expect(truck.capacity).toBe(12);
    expect(truck.bedLength).toBe(machine.bedLength(1, 0) / 2);
    expect(machine.loadOf([{ color: 'red', units: 6 }], truck.capacity)).toEqual({ shares: [{ color: 'red', percent: 50 }], freePercent: 50 });
    expect(() => new LoopRules({ ...LOOP_1, lanes: [[{ ...LOOP_1.lanes[0]![0]!, capacity: 12 }], LOOP_1.lanes[1]!] })).toThrow();
  });
});

it('the occasional-burst gate keeps a genuinely fast win, not an earlier patient win', () => {
  const result = tally((seed) => ({ status: 'won', seconds: 1, recoveries: 0, steps: 100, actions: seed === 1 ? [[0, 0], [60, 1]] : [[0, 0], [6, 1]] }), 2, true);
  expect(result.win).toBe(1);
  expect(result.fast?.actions).toEqual([[0, 0], [6, 1]]);
});
it('undo before a tick cancels both pending pour events', () => {
  const machine = new LoopMachine(LOOP_202);
  machine.tap(0); machine.undo();
  expect(machine.step().filter((event) => event.type === 'pour')).toEqual([]);
});

it('all three lessons retain a winning rapid-tap replay', () => {
  for (const board of lessons) {
    const fast = FAST_WITNESSES[board.id]!;
    expect(fast.taps.some(([tick], at) => at > 0 && tick - fast.taps[at - 1]![0] <= 12)).toBe(true);
    const machine = new LoopMachine(board);
    replayOnto(machine, { steps: fast.steps, actions: fast.taps.map(([step, at]) => ({ step, type: 'tap', at })) });
    expect(machine.rules.status).toBe('won');
  }
});
