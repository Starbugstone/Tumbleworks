import { describe, expect, it } from 'vitest';
import { BOARD_1, BOARD_2 } from '../../src/sim/boards';
import { ConveyorSim } from '../../src/sim/conveyor';
import type { BoardDef, ReleaseResult, SimEvent } from '../../src/sim/types';
import { replaySettled, settle } from './enumerate';
import { colorCounts, invariantChecker } from './helpers';

/** Local xorshift32. Integer seeds and arithmetic make failures reproducible. */
function random(seed: number): (bound: number) => number {
  let value = seed;
  return (bound) => {
    value ^= value << 13;
    value ^= value >>> 17;
    value ^= value << 5;
    return (value >>> 0) % bound;
  };
}

function settledProgress(sim: ConveyorSim) {
  return {
    frontBox: sim.state.frontBox,
    frontBoxFill: sim.state.frontBoxFill,
    residualColors: colorCounts([...sim.state.belt, ...sim.state.pending].map((marble) => marble.color)),
    supplies: sim.state.supplies.map((supply) => supply.map((packet) => ({ color: packet.color, count: packet.marbles.length }))),
    status: sim.state.status,
  };
}

describe('timing independence', () => {
  it.each([BOARD_1, BOARD_2])('$id: 500 seeded runs agree with settled replay after draining', (board) => {
    const coverage = { zeroGap: 0, accepted: 0, empty: 0, finished: 0, 'no-space': 0, won: 0, jammed: 0 };
    for (let seed = 1; seed <= 500; seed += 1) {
      const pick = random(seed);
      const sim = new ConveyorSim(board);
      const check = invariantChecker(sim);
      const accepted: number[] = [];
      try {
        check();
        for (let attempt = 0; attempt < 48; attempt += 1) {
          const gapKind = pick(4);
          const gap = gapKind === 0 ? 0
            : gapKind === 1 ? pick(sim.config.ticksPerStep + 1)
            : pick(sim.config.beltPositions * sim.config.ticksPerStep * gapKind + 1);
          if (gap === 0) coverage.zeroGap += 1;
          for (let index = 0; index < gap; index += 1) {
            sim.tick();
            check();
          }
          const supply = pick(board.supplies.length);
          const result = sim.release(supply);
          check();
          if (result.ok) {
            accepted.push(supply);
            coverage.accepted += 1;
          } else {
            coverage[result.reason] += 1;
          }
        }
        settle(sim, check);
        check();
        const replay = replaySettled(board, accepted);
        // Compare only after draining: clock, positions and immediate status can
        // differ while the same accepted packet sequence is still in flight.
        expect(settledProgress(sim)).toEqual(settledProgress(replay));
        if (sim.state.status !== 'playing') coverage[sim.state.status] += 1;
      } catch (error) {
        throw new Error(`${board.id}, seed ${seed}, accepted ${accepted.join(',')}`, { cause: error });
      }
    }
    for (const count of Object.values(coverage)) expect(count).toBeGreaterThan(0);
  }, 60_000);
});

type Action = { type: 'tick'; count: number } | { type: 'release'; supply: number } | { type: 'undo' } | { type: 'reset' };

function run(board: BoardDef, actions: readonly Action[]) {
  const sim = new ConveyorSim(board);
  const log: { tick: number; result: ReleaseResult | SimEvent[] | boolean | 'reset' }[] = [];
  const states = [structuredClone(sim.state)];
  for (const action of actions) {
    if (action.type === 'tick') {
      for (let index = 0; index < action.count; index += 1) {
        log.push({ tick: sim.state.tick + 1, result: sim.tick() });
        states.push(structuredClone(sim.state));
      }
    } else {
      const result = action.type === 'release' ? sim.release(action.supply)
        : action.type === 'undo' ? sim.undo()
        : (sim.reset(), 'reset' as const);
      log.push({ tick: sim.state.tick, result });
      states.push(structuredClone(sim.state));
    }
  }
  return { state: structuredClone(sim.state), states, log };
}

describe('determinism', () => {
  it.each([BOARD_1, BOARD_2])('$id: identical actions at identical ticks give identical states and event logs', (board) => {
    const actions: Action[] = [
      { type: 'tick', count: 5 },
      { type: 'release', supply: 0 },
      { type: 'release', supply: 1 },
      { type: 'release', supply: 0 },
      { type: 'tick', count: 111 },
      { type: 'undo' },
      { type: 'tick', count: 19 },
      { type: 'release', supply: 0 },
      { type: 'tick', count: 613 },
      { type: 'release', supply: 1 },
      { type: 'tick', count: 421 },
      { type: 'release', supply: 2 },
      { type: 'tick', count: 707 },
      { type: 'reset' },
      { type: 'release', supply: 0 },
      { type: 'tick', count: 7 },
    ];
    const first = run(board, actions);
    expect(run(board, actions)).toEqual(first);
    expect(first.log.some((entry) => Array.isArray(entry.result) && entry.result.some((event) => event.type === 'delivered'))).toBe(true);
    expect(first.log.some((entry) => Array.isArray(entry.result) && entry.result.some((event) => event.type === 'entered'))).toBe(true);
  });
});
