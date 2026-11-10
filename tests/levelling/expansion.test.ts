import { describe, expect, it } from 'vitest';
import { CAMPAIGN, PLAY_ORDER } from '../../src/campaign';
import { BOARDS } from '../../src/sim/boards';
import { LOOP_BOARDS } from '../../src/loop/boards';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { hashBoard } from '../../scripts/level-curve';
import { SLOTS } from '../../scripts/level-slots';
import opening from '../fixtures/campaign-first-40.json';

describe('the next twenty rounds', () => {
  it('adds sixty playable levels after the existing campaign without moving saved IDs', () => {
    expect(CAMPAIGN).toHaveLength(180);
    for (const kind of ['conveyor', 'loop', 'tube'] as const) {
      expect(PLAY_ORDER[kind]).toHaveLength(60);
      expect(PLAY_ORDER[kind].slice(0, 40)).toEqual(opening[kind]);
      // The original thirty-round release may already be complete in an older save.
      for (const id of PLAY_ORDER[kind].slice(40)) expect(Number(id.split('-')[1])).toBeGreaterThan(30);
    }
  });

  it('teaches the new rules on schedule and returns to them two rounds later', () => {
    const funnel = PLAY_ORDER.conveyor.map(id => BOARDS.find(board => board.id === id)!);
    const loop = PLAY_ORDER.loop.map(id => LOOP_BOARDS.find(board => board.id === id)!);
    const tube = PLAY_ORDER.tube.map(id => TUBE_BOARDS.find(board => board.id === id)!);
    const checkLesson = <T extends { readonly id: string }>(boards: readonly T[], first: number, has: (board: T) => boolean): void => {
      expect(boards.findIndex(has) + 1).toBe(first);
      expect(SLOTS[boards[first - 1]!.id]).toBe('lesson');
      if (first + 2 <= 60) expect(has(boards[first + 1]!)).toBe(true);
      if (first + 5 <= 60) expect(boards.slice(first + 4).some(has)).toBe(true);
    };
    checkLesson(funnel, 41, board => Boolean(board.pairs?.length));
    checkLesson(funnel, 57, board => Boolean(board.predecessors));
    checkLesson(loop, 43, board => board.lanes.flat().some(truck => Boolean(truck.pourAfter)));
    checkLesson(loop, 59, board => board.lanes.flat().some(truck => (truck.capacity ?? board.truckCapacity) < board.truckCapacity));
    checkLesson(tube, 45, board => board.containers?.some(container => container.role === 'capped') ?? false);
  });

  it('does not repeat a board under a different title or ID', () => {
    const bank = new Map([...BOARDS, ...LOOP_BOARDS, ...TUBE_BOARDS].map(board => [board.id, board]));
    const hashes = CAMPAIGN.map(level => hashBoard(bank.get(level.id)!));
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});
