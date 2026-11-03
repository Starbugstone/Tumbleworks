import { readFileSync, writeFileSync } from 'node:fs';
import { BOARDS } from '../src/sim/boards';
import { LOOP_BOARDS } from '../src/loop/boards';
import { TUBE_BOARDS } from '../src/puzzles/levels';
import { hashBoard, type ScoreRow } from './level-curve';

// Explicit migration only: preserve historical S and all measured fields; absent H stays absent.
const file = 'tests/levelling/scores.json';
const rows = JSON.parse(readFileSync(file, 'utf8')) as ScoreRow[];
const boards = new Map<string, object>([...BOARDS, ...LOOP_BOARDS, ...TUBE_BOARDS].map((board) => [board.id, board]));
const migrated = rows.map((row) => {
  const board = boards.get(row.id);
  if (!board) throw new Error(`No board for ${row.id}`);
  return { ...row, hash: hashBoard(board) };
});
writeFileSync(file, `[\n${migrated.map((row) => JSON.stringify(row)).join(',\n')}\n]\n`);
console.log(`Migrated ${migrated.length} hashes; no scores recomputed.`);
