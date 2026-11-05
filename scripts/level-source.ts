import type { LoopBoardDef } from '../src/loop/types';
import type { TubeDef } from '../src/puzzles/types';
import type { BoardDef } from '../src/sim/types';

/** Emit the complete definition: reconstructing it with defaults can silently change the scored game. */
function declaration(name: string, type: string, board: object, note: string) {
  const expression = JSON.stringify(board, null, 2);
  return { name, expression, code: `/** ${note.replaceAll('*/', '* /')} */\nexport const ${name}: ${type} = ${expression};` };
}

export const funnelSource = (board: BoardDef, note: string) => declaration(`BOARD_${board.id.split('-')[1]}`, 'BoardDef', board, note);
export const loopSource = (board: LoopBoardDef, note: string) => declaration(`LOOP_${board.id.split('-')[1]}`, 'LoopBoardDef', board, note);
export const tubeSource = (board: TubeDef, note: string, solution: readonly { from: number; to: number }[]): string =>
  `  /** ${note.replaceAll('*/', '* /')} */\n  ${JSON.stringify({ ...board, solution }, null, 2)},`;
