import { describe, expect, it } from 'vitest';
import { BOARD_1, BOARD_2 } from '../../src/sim/boards';
import { MachineRules } from '../../src/sim/rules';
import { drain, enumerate } from './drive';
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

describe('FIFO funnel callback order independence', () => {
  it.each([BOARD_1, BOARD_2])('$id: 500 seeded callback schedules preserve burst release outcomes and capacity', (board) => {
    const coverage = { won: 0, jammed: 0, entered: 0, refusedEntry: 0, delivered: 0, fullWithBacklog: 0 };
    const wins = enumerate(board).wins;
    for (let seed = 1; seed <= 500; seed += 1) {
      const pick = random(seed);
      const rules = new MachineRules(board);
      const check = invariantChecker(rules);
      const plan = seed % 3 === 0 ? [...(wins[pick(wins.length)] ?? '')].map((letter) => letter.charCodeAt(0) - 65) : [];
      let index = 0;
      while (rules.state.supplies.some((supply) => supply.length)) {
        const available = rules.state.supplies.flatMap((supply, supplyIndex) => supply.length ? [supplyIndex] : []);
        const supply = plan[index++] ?? available[pick(available.length)];
        if (supply === undefined) throw new Error('No remaining supply');
        expect(rules.release(supply).ok).toBe(true);
        check();
      }
      const reference = new MachineRules(board);
      reference.restore(rules.snapshot());
      drain(reference);
      const enter = (id: number): void => {
        if (rules.entered(id)) coverage.entered += 1;
        else coverage.refusedEntry += 1;
        check();
      };
      const arrive = (id: number): void => {
        if (rules.arrive(id) === 'deliver') coverage.delivered += 1;
        check();
      };
      const capture = (id: number): void => { rules.captured(id); check(); };
      const swap = (): void => { rules.boxSwapped(); check(); };
      for (let now = 0; rules.status === 'playing' && now < 350; now += 1) {
        const id = pick(rules.state.marbles.length + 2) - 1;
        switch (pick(5)) {
          case 0: enter(id); break;
          case 1: arrive(id); break;
          case 2: capture(id); break;
          case 3: swap(); break;
          default: enter(rules.state.pending[0] ?? -1); break;
        }
        if (rules.occupancy === board.beltCapacity && rules.funnelCount > 0) coverage.fullWithBacklog += 1;
        if (now % 19 === 18) {
          for (const action of shuffle(['entry', 'gate', 'capture', 'swap'] as const, pick)) {
            if (action === 'entry') for (const pending of shuffle(rules.state.pending, pick)) enter(pending);
            else if (action === 'gate') for (const marble of shuffle(rules.state.marbles, pick)) arrive(marble.id);
            else if (action === 'capture') for (const marble of shuffle(rules.state.marbles, pick)) capture(marble.id);
            else swap();
          }
        }
      }
      drain(rules, check);
      expect(settledProgress(rules), `seed ${seed}`).toEqual(settledProgress(reference));
      expect(rules.status).not.toBe('playing');
      if (rules.status === 'won' || rules.status === 'jammed') coverage[rules.status] += 1;
    }
    for (const [name, count] of Object.entries(coverage)) expect(count, `Missing callback coverage: ${name}`).toBeGreaterThan(0);
  }, 60_000);
});
