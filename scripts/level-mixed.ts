import { writeFileSync } from 'node:fs';
import { LOOP_BOARDS } from '../src/loop/boards';
import type { LoopBoardDef } from '../src/loop/types';
import { LOOP_CAPACITY_MAX, loopRating, multiTapFailure } from './level-curve';
import { loopGame, settledLoop, tally, type LoopPlayer } from './level-score';

/**
 * Would the multi-tap gate have decided differently against the mixed player? The gate itself stays on burst2 and burst3.
 *   npx tsx scripts/level-mixed.ts retired <out.json>     the 18 Loop Sort retirements, at their capacity and widened
 */
const GAMES = 100;
const figures = (board: LoopBoardDef, games = GAMES) => {
  const failure = (player: LoopPlayer): number => 100 * (1 - tally((seed) => loopGame(board, player, seed), games).win);
  const F1 = settledLoop(board).F1;
  const FM = multiTapFailure(tally((seed) => loopGame(board, 'burst2', seed), games).win, tally((seed) => loopGame(board, 'burst3', seed), games).win);
  return { F1, FM, mixed: failure('mixed'), mixedBrisk: failure('mixedBrisk'), single: failure('single'), spam: tally((seed) => loopGame(board, 'spam', seed), games).win, S: loopRating(F1, FM) };
};
const RETIRED = [3, 5, 7, 8, 12, 13, 14, 15, 17, 18, 19, 20, 21, 24, 26, 27, 28, 30].map((n) => `loop-${n}`);
const [, out = '/dev/null'] = process.argv.slice(2);
const rows: unknown[] = [];
{
  for (const id of RETIRED) {
    const board = LOOP_BOARDS.find((candidate) => candidate.id === id)!;
    const room = [0, 2, 4, 6, 8, 16].flatMap((extra) => {
      const capacity = board.loopCapacity + extra;
      if (capacity > LOOP_CAPACITY_MAX) return [];
      const wide = { ...board, loopCapacity: capacity };
      const result = figures(wide);
      return [{ extra, capacity, ...result, burstGap: result.FM - result.F1, mixedGap: result.mixed - result.F1, briskGap: result.mixedBrisk - result.F1 }];
    });
    const row = { id, room };
    rows.push(row);
    console.error(id, room.map((entry) => `+${entry.extra} F1 ${entry.F1.toFixed(0)} FM ${entry.FM.toFixed(0)} mixed ${entry.mixed.toFixed(0)} brisk ${entry.mixedBrisk.toFixed(0)} single ${entry.single.toFixed(0)} spam ${entry.spam.toFixed(2)}`).join(' | '));
    writeFileSync(out, JSON.stringify(rows));
  }
}
