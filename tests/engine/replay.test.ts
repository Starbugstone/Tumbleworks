import { beforeAll, describe, expect, it } from 'vitest';
import { replayLog, type Replayable } from '../../src/engine/replay';
import { LOOP_BOARDS } from '../../src/loop/boards';
import { LoopMachine } from '../../src/loop/machine';
import { initPhysics, Machine } from '../../src/machine/machine';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { TubeRules } from '../../src/puzzles/rules';
import { BOARDS } from '../../src/sim/boards';
import { hintConveyor } from '../../src/sim/solver';
import { FUNNEL_WITNESSES, LOOP_WITNESSES } from '../witnesses';
import { replayed } from '../replay-target';

beforeAll(initPhysics);
const taps = (order: string | undefined): number[] => [...(order ?? '')].map((letter) => letter.charCodeAt(0) - 65);

/** Plays a witness, taking back the second pour once and repeating it, with no regard for what the replay will do. */
function playFunnel(machine: Machine, order: readonly number[], ticks: number): void {
  let next = 0;
  let undone = false;
  for (let tick = 0; tick < ticks; tick++) {
    machine.step();
    if (tick === 40) hintConveyor(machine.rules);
    if (tick % 25 !== 0) continue;
    if (!undone && next === 2) { expect(machine.undo()).toBe(true); undone = true; next = 1; continue; }
    const tap = order[next];
    if (tap !== undefined && machine.rules.funnelCount === 0 && machine.tap(tap).ok) next += 1;
  }
}

describe('a game replays exactly from its actions', () => {
  it.each(['board-1', 'board-15', 'board-30'])('%s reaches the same physics, including across an undo', (id) => {
    const board = BOARDS.find((candidate) => candidate.id === id);
    if (!board) throw new Error(id);
    const live = new Machine(board);
    playFunnel(live, taps(FUNNEL_WITNESSES[id]), 60 * 40);
    const log = replayLog(id, live);
    expect(log.actions.some((action) => action.type === 'undo')).toBe(true);
    const again = replayed(JSON.parse(JSON.stringify(log)));
    expect(again.fingerprint()).toBe(log.fingerprint);
    live.world.free();
    if (again instanceof Machine) again.world.free();
  });

  it('notices a changed action order', () => {
    const board = BOARDS.find((candidate) => candidate.id === 'board-15');
    if (!board) throw new Error('board-15');
    const live = new Machine(board);
    playFunnel(live, taps(FUNNEL_WITNESSES['board-15']), 60 * 20);
    const log = replayLog('board-15', live);
    const later = log.actions.map((action, index) => (index === 0 ? { ...action, step: action.step + 1 } : action));
    let moved: Replayable | undefined;
    try { moved = replayed({ ...log, actions: later }); } catch { moved = undefined; }
    if (moved) expect(moved.fingerprint()).not.toBe(log.fingerprint);
    live.world.free();
    if (moved instanceof Machine) moved.world.free();
  });

  it('replays Loop Sort, including across an undo', () => {
    const board = LOOP_BOARDS.find((candidate) => candidate.id === 'loop-15');
    if (!board) throw new Error('loop-15');
    const live = new LoopMachine(board);
    const order = taps(LOOP_WITNESSES['loop-15']);
    let next = 0;
    let undone = false;
    for (let tick = 0; tick < 60 * 60; tick++) {
      live.step();
      if (tick % 25 !== 0) continue;
      if (!undone && next === 2) { if (live.undo()) { undone = true; next = 1; } continue; }
      const tap = order[next];
      if (tap !== undefined && live.rules.pending === 0 && !live.rules.canDrain() && live.tap(tap).ok) next += 1;
    }
    const log = replayLog('loop-15', live);
    expect(undone).toBe(true);
    expect(replayed(JSON.parse(JSON.stringify(log))).fingerprint()).toBe(log.fingerprint);
  });

  it('replays Tube Sort, including across an undo', () => {
    const board = TUBE_BOARDS.find((candidate) => candidate.id === 'tube-10');
    if (!board) throw new Error('tube-10');
    const live = new TubeRules(board);
    const [first, second] = board.solution;
    if (!first || !second) throw new Error('tube-10 solution');
    live.move(first.from, first.to);
    live.undo();
    for (const move of board.solution) live.move(move.from, move.to);
    const log = replayLog('tube-10', live);
    expect(live.status).toBe('won');
    expect(replayed(JSON.parse(JSON.stringify(log))).fingerprint()).toBe(log.fingerprint);
  });

  it('refuses a log whose action the rules reject', () => {
    expect(() => replayed({ version: 1, level: 'tube-1', steps: 0, fingerprint: '', actions: [{ step: 0, type: 'move', from: 0, to: 0 }] })).toThrow(/diverged/);
    expect(() => replayed({ version: 1, level: 'board-1', steps: 1, fingerprint: '', actions: [{ step: 5, type: 'undo' }] })).toThrow(/unplayed/);
  });
});
