import { readFileSync } from 'node:fs';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { CAMPAIGN } from '../../src/campaign';
import { replayOnto } from '../../src/engine/replay';
import { LOOP_BOARDS } from '../../src/loop/boards';
import { LoopMachine } from '../../src/loop/machine';
import { LoopRules } from '../../src/loop/rules';
import { hintLoopSearch, settleLoop } from '../../src/loop/solver';
import { initPhysics, Machine } from '../../src/machine/machine';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { funnelStateKey, MachineRules } from '../../src/sim/rules';
import { BOARDS } from '../../src/sim/boards';
import { hintConveyorSearch, settle } from '../../src/sim/solver';
import { HINT_STATE_CAP, TUBE_GRAPH_CAP, type ScoreRow } from '../../scripts/level-curve';
import { extendTally, funnelGame, loopGame, scoreTube, tally } from '../../scripts/level-score';
import { reachableTubeStates } from '../../scripts/tube-author';
import { stateKey as loopStateKey } from '../../scripts/loop-author';
import { FAST_WITNESSES } from '../witnesses';

beforeAll(initPhysics);

const table = new Map((JSON.parse(readFileSync('tests/levelling/scores.json', 'utf8')) as ScoreRow[]).map((row) => [row.id, row]));
const inCampaign = new Set(CAMPAIGN.map((level) => level.id));
const campaignFunnel = BOARDS.filter((board) => inCampaign.has(board.id));
const campaignLoop = LOOP_BOARDS.filter((board) => inCampaign.has(board.id));
const roundOf = (id: string): number => CAMPAIGN.filter((level) => level.kind === CAMPAIGN.find((other) => other.id === id)?.kind).findIndex((level) => level.id === id) + 1;
const expandReplay = (id: string): { steps: number; actions: { step: number; type: 'tap'; at: number }[] } => {
  const stored = FAST_WITNESSES[id];
  if (!stored) throw new Error(`${id} has no recorded multi-tap win`);
  return { steps: stored.steps, actions: stored.taps.map(([step, at]) => ({ step, type: 'tap', at })) };
};

describe('every conveyor board from round 4 has a recorded multi-tap win', () => {
  it.each(campaignFunnel.filter((board) => roundOf(board.id) >= 4))('$id wins on the physics machine', (board) => {
    const machine = new Machine(board);
    replayOnto(machine, expandReplay(board.id));
    expect(machine.rules.status).toBe('won');
    machine.world.free();
  }, 120_000);
  it.each(campaignLoop.filter((board) => roundOf(board.id) >= 4))('$id wins on the scripted machine', (board) => {
    const machine = new LoopMachine(board);
    replayOnto(machine, expandReplay(board.id));
    expect(machine.rules.status).toBe('won');
  });
  it('really taps within the same pour, so it is not a slow game in disguise', () => {
    for (const board of [...campaignFunnel, ...campaignLoop].filter((candidate) => roundOf(candidate.id) >= 4)) {
      const steps = expandReplay(board.id).actions.map((action) => action.step);
      expect(steps.some((step, at) => at > 0 && step - steps[at - 1]! <= 12), board.id).toBe(true);
    }
  });
});

describe('the score table is what the code measures', () => {
  // A full re-score takes hours, so one level per game replays its first six recorded games.
  it('Funnel Sort', () => {
    const board = campaignFunnel.find((candidate) => candidate.id === 'board-46')!;
    const played = [1, 2, 3, 4, 5, 6].map((seed) => (funnelGame(board, 'burst2', seed).status === 'won' ? 'W' : 'L')).join('');
    expect(played).toBe(table.get(board.id)?.probe);
  }, 120_000);
  it('Loop Sort', () => {
    const board = campaignLoop.find((candidate) => candidate.id === 'loop-48')!;
    const played = [1, 2, 3, 4, 5, 6].map((seed) => (loopGame(board, 'burst2', seed).status === 'won' ? 'W' : 'L')).join('');
    expect(played).toBe(table.get(board.id)?.probe);
  });
  it('Tube Sort', () => {
    const board = TUBE_BOARDS.find((candidate) => candidate.id === 'tube-37')!;
    expect(scoreTube(board)?.F1).toBeCloseTo(table.get(board.id)?.F1 ?? -1, 6);
  });
});

describe('opening hints are capped by states searched', () => {
  it.each(campaignFunnel)('$id', (board) => {
    const { supply, states } = hintConveyorSearch(new MachineRules(board));
    expect(supply).not.toBeNull();
    expect(states).toBeLessThanOrEqual(HINT_STATE_CAP.funnel);
    expect(states).toBe(table.get(board.id)?.hintStates);
  });
  it.each(campaignLoop)('$id', (board) => {
    const { lane, states } = hintLoopSearch(new LoopRules(board));
    expect(lane).not.toBeNull();
    expect(states).toBeLessThanOrEqual(HINT_STATE_CAP.loop);
    expect(states).toBe(table.get(board.id)?.hintStates);
  });
});

describe('Tube Sort stays small enough that a null hint is a proof', () => {
  it.each(TUBE_BOARDS)('$id has a small reachable graph', (board) => {
    expect(reachableTubeStates(board)).toBeLessThanOrEqual(TUBE_GRAPH_CAP);
  });
  it('rejects an oversized graph', () => {
    const board = TUBE_BOARDS.find((candidate) => candidate.id === 'tube-1')!;
    expect(reachableTubeStates(board, 5)).toBe(5);
  });
});

describe('a declared jam is truly dead', () => {
  type Machineish = { status: string; actions(): number[]; snapshot(): { status: string }; restore(value: unknown): void };
  /**
   * With the jam check off, nothing within reach of a declared jam can still win. States are keyed the way the authoring
   * search keys them (marbles of one colour are interchangeable), so twelve-crate boards finish in seconds.
   */
  const explore = <R extends Machineish>(make: () => R, act: (rules: R, choice: number) => boolean, proto: Record<'evaluateStatus', () => void>, won: (rules: R) => boolean, key: (rules: R) => string): { jams: number; live: number; dead: number } => {
    const rules = make();
    const seen = new Set<string>();
    const stack = [rules.snapshot()];
    let jams = 0;
    let live = 0;
    let dead = 0;
    while (stack.length) {
      const here = stack.pop()!;
      rules.restore(here);
      const id = `${rules.status}|${key(rules)}`;
      if (seen.has(id)) continue;
      seen.add(id);
      if (rules.status === 'won') continue;
      if (rules.status === 'jammed') {
        jams += 1;
        const spy = vi.spyOn(proto, 'evaluateStatus').mockImplementation(() => undefined);
        const probe = make();
        const opened = { ...structuredClone(here), status: 'playing' };
        const inner = new Set<string>();
        const frontier = [opened];
        while (frontier.length && inner.size < 150) {
          const at = frontier.pop()!;
          probe.restore(at);
          const atKey = key(probe);
          if (inner.has(atKey)) continue;
          inner.add(atKey);
          if (won(probe)) { live += 1; break; }
          for (const choice of probe.actions()) {
            probe.restore(at);
            if (act(probe, choice)) frontier.push(probe.snapshot());
          }
        }
        spy.mockRestore();
        continue;
      }
      let moved = false;
      for (const choice of rules.actions()) {
        rules.restore(here);
        if (act(rules, choice)) { moved = true; stack.push(rules.snapshot()); }
      }
      if (!moved) dead += 1;
    }
    return { jams, live, dead };
  };
  it.each(campaignFunnel)('$id', (board) => {
    const result = explore(() => new MachineRules(board) as unknown as Machineish & MachineRules, (rules, choice) => { if (!rules.release(choice).ok) return false; settle(rules); return true; }, MachineRules.prototype as unknown as Record<'evaluateStatus', () => void>, (rules) => rules.state.marbles.every((marble) => marble.status === 'in-box'), (rules) => funnelStateKey(rules));
    expect(result.live).toBe(0);
    expect(result.dead).toBe(0);
  }, 60_000);
  it.each(campaignLoop)('$id', (board) => {
    const result = explore(() => new LoopRules(board) as unknown as Machineish & LoopRules, (rules, choice) => { if (!rules.tap(choice).ok) return false; settleLoop(rules); return true; }, LoopRules.prototype as unknown as Record<'evaluateStatus', () => void>, (rules) => rules.state.lanes.every((queue) => queue.length === 0), (rules) => loopStateKey(rules));
    expect(result.live).toBe(0);
  }, 60_000);
});

describe('the machine keeps a whole recorded game', () => {
  it('replays board-1 from its actions', () => {
    const board = BOARDS[0]!;
    const live = new Machine(board);
    for (let tick = 0; tick < 200; tick++) { live.step(); if (tick === 30) live.tap(0); }
    const again = new Machine(board);
    replayOnto(again, { steps: live.steps, actions: live.actions });
    expect(again.fingerprint()).toBe(live.fingerprint());
    live.world.free();
    again.world.free();
  });
});

describe('a screen that grows', () => {
  it('extends a short tally to the same result as playing every game at once', () => {
    const board = campaignLoop.find((candidate) => candidate.id === 'loop-41')!;
    const play = (seed: number) => loopGame(board, 'mixed', seed);
    const whole = tally(play, 14, true);
    const grown = extendTally(tally(play, 5, true), play, 14, true);
    expect(grown).toEqual(whole);
  }, 60_000);
});
