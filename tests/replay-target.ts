import type { Replayable, ReplayLog } from '../src/engine/replay';
import { replayOnto } from '../src/engine/replay';
import { LOOP_BOARDS } from '../src/loop/boards';
import { LoopMachine } from '../src/loop/machine';
import { Machine } from '../src/machine/machine';
import { TUBE_BOARDS } from '../src/puzzles/levels';
import { TubeRules } from '../src/puzzles/rules';
import { BOARDS } from '../src/sim/boards';

/** The headless rules behind a campaign level, for replays and tests. Call initPhysics first. */
export function gameFor(level: string): Replayable {
  const funnel = BOARDS.find((board) => board.id === level);
  if (funnel) return new Machine(funnel);
  const loop = LOOP_BOARDS.find((board) => board.id === level);
  if (loop) return new LoopMachine(loop);
  const tube = TUBE_BOARDS.find((board) => board.id === level);
  if (tube) return new TubeRules(tube);
  throw new Error(`No level ${level}`);
}

export function replayed(log: ReplayLog): Replayable {
  const game = gameFor(log.level);
  replayOnto(game, log);
  return game;
}
