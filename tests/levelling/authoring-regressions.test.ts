import { expect, it } from 'vitest';
import { extendTally, tally, type GameResult } from '../../scripts/level-score';
import { strongTubeGraph } from '../../scripts/level-strong';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { solveTube, TubeRules } from '../../src/puzzles/rules';
import { hashBoard } from '../../scripts/level-curve';
import scores from './scores.json';

it('extending a rapid-win tally rejects slow wins and keeps the first genuine rapid win', () => {
  const play = (seed: number): GameResult => ({
    status: seed === 1 ? 'jammed' : 'won', seconds: 3, recoveries: 0, steps: 180,
    actions: seed === 3 ? [[1, 0], [13, 1]] : [[1, 0], [100, 1]],
  });
  const start = tally(play, 1, true);
  const slow = extendTally(start, play, 2, true);
  expect(slow).toEqual(tally(play, 2, true));
  expect(slow.fast).toBeNull();
  const rapid = extendTally(slow, play, 3, true);
  expect(rapid).toEqual(tally(play, 3, true));
  expect(rapid.fast).toEqual(play(3));
});

it('the strong Tube scorer distinguishes a fresh cup from a spent cup with the same contents', () => {
  const board = TUBE_BOARDS.find((candidate) => candidate.id === 'tube-201')!;
  const fresh = new TubeRules(board);
  expect(fresh.move(0, 3).ok).toBe(true);
  const spent = new TubeRules(board);
  expect(spent.move(0, 4).ok).toBe(true);
  expect(spent.move(4, 3).ok).toBe(true);
  expect(fresh.state.tubes).toEqual(spent.state.tubes);
  expect(solveTube(board, fresh.state)).not.toBeNull();
  expect(solveTube(board, spent.state)).toBeNull();
  const graph = strongTubeGraph(board);
  const freshId = graph.add(fresh.snapshot());
  const spentId = graph.add(spent.snapshot());
  expect(spentId).not.toBe(freshId);
  expect(graph.solvable(freshId)).toBe(true);
  expect(graph.solvable(spentId)).toBe(false);
});

it.each(['tube-200', 'tube-201'])('%s has fresh measurements from the role-aware scorer', (id) => {
  const board = TUBE_BOARDS.find((candidate) => candidate.id === id)!;
  const row = scores.find((candidate) => candidate.id === id)!;
  expect(row.hash).toBe(hashBoard(board));
  expect(row.strong).toBeDefined();
});
