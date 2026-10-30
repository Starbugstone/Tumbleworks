import { describe, expect, it } from 'vitest';
import { BOARD_1, BOARD_2 } from '../../src/sim/boards';
import { MachineRules } from '../../src/sim/rules';
import type { RulesEvent, RulesMarble } from '../../src/sim/rules';
import { drain, enumerate, replaySettled } from './drive';
import { colorCounts, invariantChecker } from './helpers';

/** Local xorshift32: all schedules can be reproduced from the board and seed. */
function random(seed: number): (bound: number) => number {
  let value = seed;
  return (bound) => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) % bound;
  };
}

function shuffle<T>(values: readonly T[], pick: (bound: number) => number): T[] {
  const rest = [...values];
  const result: T[] = [];
  while (rest.length > 0) {
    const [value] = rest.splice(pick(rest.length), 1);
    if (value !== undefined) result.push(value);
  }
  return result;
}

function settledProgress(rules: MachineRules) {
  return {
    activeBox: rules.activeBox,
    activeFill: rules.activeFill,
    residualColors: colorCounts(rules.state.marbles.filter((marble) =>
      marble.status === 'pouring' || marble.status === 'on-belt' || marble.status === 'dropping',
    ).map((marble) => marble.color)),
    supplies: rules.state.supplies.map((supply) => supply.map((value) => ({
      color: value.color, count: value.marbles.length,
    }))),
    status: rules.status,
  };
}

describe('physics callback order independence', () => {
  it.each([BOARD_1, BOARD_2])('$id: 500 adversarial seeded schedules agree with settled accepted releases', (board) => {
    const winningPlans = enumerate(board).wins;
    const coverage = {
      accepted: 0, empty: 0, finished: 0, 'no-space': 0,
      consecutiveReleases: 0, entered: 0, enteredAgain: 0, pouringArrival: 0,
      delivered: 0, passedAgain: 0, captureAgain: 0, reverseCaptures: 0,
      blockedByReservations: 0, dropDelayed: 0, swapDelayed: 0,
      releaseDuringDrop: 0, releaseDuringSwap: 0, canDrain: 0,
      won: 0, jammed: 0,
    };
    for (let seed = 1; seed <= 500; seed += 1) {
      const pick = random(seed);
      // Exercise successful play too: some seeds attempt a known winning plan,
      // still with random entries, gate order, repeats, captures and swaps.
      const plan = seed % 5 === 0
        ? [...(winningPlans[pick(winningPlans.length)] ?? '')].map((letter) => letter.charCodeAt(0) - 65)
        : null;
      const rules = new MachineRules(board);
      const check = invariantChecker(rules);
      const accepted: number[] = [];
      const log: string[] = [];
      const dropDue = new Map<number, number>();
      const passCount = new Map<number, number>();
      let swapDue = Infinity;
      let now = 0;
      let previousWasRelease = false;
      let lastCapturedSlot: number | null = null;
      let lastCapturedBox: number | null = null;
      const record = (message: string) => {
        log.push(`${now}:${message}`);
        if (log.length > 50) log.shift();
        check();
      };
      const events = (values: RulesEvent[]) => {
        if (values.some((event) => event.type === 'boxFull')) swapDue = now + 5 + pick(96);
      };
      const release = (supply: number) => {
        if (previousWasRelease) coverage.consecutiveReleases += 1;
        previousWasRelease = true;
        if (rules.state.marbles.some((marble) => marble.status === 'dropping')) coverage.releaseDuringDrop += 1;
        if (rules.state.waitingForSwap) coverage.releaseDuringSwap += 1;
        const result = rules.release(supply);
        record(`release(${supply})=${result.ok ? 'accepted' : result.reason}`);
        if (result.ok) {
          accepted.push(supply);
          coverage.accepted += 1;
        } else {
          coverage[result.reason] += 1;
          if (result.reason === 'no-space' && result.canDrain) coverage.canDrain += 1;
        }
      };
      const enter = (id: number) => {
        previousWasRelease = false;
        if (rules.state.marbles[id]?.status === 'pouring') coverage.entered += 1;
        else coverage.enteredAgain += 1;
        rules.entered(id);
        record(`entered(${id})`);
      };
      const arrive = (id: number) => {
        previousWasRelease = false;
        const before = rules.state.marbles[id];
        const reserved = rules.state.marbles.filter((marble) => marble.boxIndex === rules.activeBox).length;
        const result = rules.arrive(id);
        record(`arrive(${id})=${result}`);
        if (result === 'deliver') {
          coverage.delivered += 1;
          dropDue.set(id, now + 5 + pick(96));
        } else {
          if (before?.status === 'pouring') coverage.pouringArrival += 1;
          if (before?.status === 'on-belt') {
            if ((passCount.get(id) ?? 0) > 0) coverage.passedAgain += 1;
            passCount.set(id, (passCount.get(id) ?? 0) + 1);
            if (rules.status === 'playing' && before.color === rules.activeColor && reserved === board.boxSize) {
              coverage.blockedByReservations += 1;
            }
          }
        }
      };
      const capture = (id: number) => {
        previousWasRelease = false;
        const before = rules.state.marbles[id];
        if (before?.status === 'dropping') {
          if ((dropDue.get(id) ?? Infinity) > now) return;
          if (lastCapturedBox === before.boxIndex && lastCapturedSlot !== null && lastCapturedSlot > before.slot) {
            coverage.reverseCaptures += 1;
          }
          lastCapturedBox = before.boxIndex;
          lastCapturedSlot = before.slot;
        } else coverage.captureAgain += 1;
        const result = rules.captured(id);
        record(`captured(${id})=${JSON.stringify(result)}`);
        events(result);
      };
      const swap = () => {
        previousWasRelease = false;
        if (rules.state.waitingForSwap && now < swapDue) return;
        const result = rules.boxSwapped();
        record(`boxSwapped()=${JSON.stringify(result)}`);
        events(result);
      };
      const choose = (statuses: readonly RulesMarble['status'][]): number => {
        const candidates = rules.state.marbles.filter((marble) => statuses.includes(marble.status));
        return candidates[pick(Math.max(candidates.length, 1))]?.id ?? -1;
      };

      try {
        check();
        // Capture and swap callbacks are independently delayed by up to 100
        // scheduling steps. Fair sweeps revisit all passes every 47 steps;
        // the intervening arrivals use arbitrary order, including repeats.
        for (now = 0; now < (plan === null ? 600 : 2400); now += 1) {
          if (rules.state.marbles.some((marble) => marble.status === 'dropping')) coverage.dropDelayed += 1;
          if (rules.state.waitingForSwap) coverage.swapDelayed += 1;
          const kind = pick(12);
          if (kind < 4) release(plan?.[accepted.length] ?? pick(board.supplies.length));
          else if (kind === 4) enter(choose(['pouring', 'on-belt']));
          else if (kind < 9) {
            const id = choose(['on-belt', 'pouring']);
            arrive(id);
            if (pick(3) === 0) arrive(id);
          } else if (kind === 9) capture(choose(['dropping', 'in-box']));
          else if (kind === 10) swap();
          else {
            const id = pick(rules.state.marbles.length + 2) - 1;
            enter(id);
            capture(id);
          }
          if (now % 47 === 46) {
            const actions = shuffle(['entry', 'gate', 'capture', 'swap'] as const, pick);
            for (const action of actions) {
              if (action === 'entry') {
                for (const marble of shuffle(rules.state.marbles, pick)) {
                  if (marble.status === 'pouring') enter(marble.id);
                }
              } else if (action === 'gate') {
                for (const marble of shuffle(rules.state.marbles, pick)) {
                  if (marble.status === 'on-belt') arrive(marble.id);
                }
              } else if (action === 'capture') {
                for (const marble of shuffle(rules.state.marbles, pick)) {
                  if (marble.status === 'dropping') capture(marble.id);
                }
              } else swap();
            }
          }
        }
        drain(rules, check);
        check();
        const replay = replaySettled(board, accepted);
        expect(settledProgress(rules)).toEqual(settledProgress(replay));
        if (rules.status !== 'playing') coverage[rules.status] += 1;
      } catch (error) {
        throw new Error(`${board.id}, seed ${seed}, accepted ${accepted.join(',')}, recent calls:\n${log.join('\n')}`, { cause: error });
      }
    }
    for (const [name, count] of Object.entries(coverage)) {
      expect(count, `Missing adversarial coverage: ${name}`).toBeGreaterThan(0);
    }
  }, 60_000);
});
