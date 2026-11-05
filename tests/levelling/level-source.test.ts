import { stripTypeScriptTypes } from 'node:module';
import { expect, it } from 'vitest';
import { funnelSource, loopSource, tubeSource } from '../../scripts/level-source';
import { BOARDS } from '../../src/sim/boards';
import { LOOP_BOARDS } from '../../src/loop/boards';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { hashBoard } from '../../scripts/level-curve';

function evaluate(source: { name: string; code: string }): unknown {
  const js = stripTypeScriptTypes(source.code).replace('export const ', 'const ');
  return new Function(`${js}\nreturn ${source.name};`)();
}

it.each(BOARDS)('Funnel emitter preserves all rules on $id', (board) => {
  const emitted = evaluate(funnelSource(board, 'Round-trip'));
  expect(emitted).toEqual(board);
  expect(hashBoard(emitted as object)).toBe(hashBoard(board));
});

it.each(LOOP_BOARDS)('Loop emitter preserves all rules on $id', (board) => {
  const emitted = evaluate(loopSource(board, 'Round-trip'));
  expect(emitted).toEqual(board);
  expect(hashBoard(emitted as object)).toBe(hashBoard(board));
});

it.each(TUBE_BOARDS)('Tube emitter preserves roles and its solution on $id', (board) => {
  const emitted = new Function(`return [${tubeSource(board, 'Round-trip', board.solution)}][0];`)();
  expect(emitted).toEqual(board);
});

it('preserves increasing dock lengths, exact tray counts, preloads, capacities and quoted titles', () => {
  const funnel = { ...BOARDS[0]!, title: "A 'quote' and a \\ path\nnext line", supplies: [[{ color: 'red' as const, count: 3 }]], docks: [['red' as const], ['blue' as const, 'red' as const]], preload: [{ color: 'red' as const, count: 1 }] };
  expect(evaluate(funnelSource(funnel, 'Round-trip'))).toEqual(funnel);
  const loop = { ...LOOP_BOARDS[0]!, truckCapacity: 12, trackShape: 'wide-eight' as const };
  expect(evaluate(loopSource(loop, 'Round-trip'))).toEqual(loop);
});
