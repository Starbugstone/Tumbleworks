import { describe, expect, it } from 'vitest';
import { CAMPAIGN, PLAY_ORDER } from '../../src/campaign';
import { BOARDS } from '../../src/sim/boards';
import { LOOP_BOARDS } from '../../src/loop/boards';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { hashBoard } from '../../scripts/level-curve';
import { SLOTS } from '../../scripts/level-slots';
import { WORKSHOP_PROJECTS } from '../../src/world/workshop-projects';
import { enterStop, worldProgress } from '../../src/world/progression';
import islandRounds from '../fixtures/campaign-61-80.json';
import firstStretch from '../fixtures/campaign-41-60.json';
import opening from '../fixtures/campaign-first-40.json';

describe('the next twenty rounds', () => {
  it('adds sixty playable levels after the existing campaign without moving saved IDs', () => {
    expect(CAMPAIGN).toHaveLength(240);
    for (const kind of ['conveyor', 'loop', 'tube'] as const) {
      expect(PLAY_ORDER[kind]).toHaveLength(80);
      expect(PLAY_ORDER[kind].slice(0, 40)).toEqual(opening[kind]);
      const prefix = kind === 'conveyor' ? 'board-' : kind + '-';
      expect(PLAY_ORDER[kind].slice(40, 60)).toEqual(firstStretch.filter(row => row.id.startsWith(prefix)).map(row => row.id));
      const islandLevels = islandRounds.filter(row => row.id.startsWith(prefix));
      expect(PLAY_ORDER[kind].slice(60)).toEqual(islandLevels.map(row => row.id));
      // The original thirty-round release may already be complete in an older save.
      for (const id of PLAY_ORDER[kind].slice(40)) expect(Number(id.split('-')[1])).toBeGreaterThan(30);
    }
  });

  it('gives each new island a triangular and a concave belt in both conveyor games', () => {
    for (const [kind, bank] of [['conveyor', BOARDS], ['loop', LOOP_BOARDS]] as const) {
      const shapes = PLAY_ORDER[kind].map(id => bank.find(board => board.id === id)!.trackShape ?? 'oval');
      for (const first of [60, 70]) {
        const island = shapes.slice(first, first + 10);
        expect(island, `${kind} rounds ${first + 1}–${first + 10}`).toEqual(expect.arrayContaining(['delta', 'kidney']));
      }
      expect(shapes.slice(60, 70)).toContain('eight');
    }
  });

  it('teaches the new rules on schedule and returns to them two rounds later', () => {
    const funnel = PLAY_ORDER.conveyor.map(id => BOARDS.find(board => board.id === id)!);
    const loop = PLAY_ORDER.loop.map(id => LOOP_BOARDS.find(board => board.id === id)!);
    const tube = PLAY_ORDER.tube.map(id => TUBE_BOARDS.find(board => board.id === id)!);
    const checkLesson = <T extends { readonly id: string }>(boards: readonly T[], first: number, has: (board: T) => boolean): void => {
      expect(boards.findIndex(has) + 1).toBe(first);
      expect(SLOTS[boards[first - 1]!.id]).toBe('lesson');
      if (first + 2 <= boards.length) expect(has(boards[first + 1]!)).toBe(true);
      if (first + 5 <= boards.length) expect(boards.slice(first + 4).some(has)).toBe(true);
    };
    checkLesson(funnel, 41, board => Boolean(board.pairs?.length));
    checkLesson(funnel, 57, board => Boolean(board.predecessors));
    checkLesson(loop, 43, board => board.lanes.flat().some(truck => Boolean(truck.pourAfter)));
    checkLesson(loop, 59, board => board.lanes.flat().some(truck => (truck.capacity ?? board.truckCapacity) < board.truckCapacity));
    checkLesson(funnel, 73, board => Boolean(board.seals?.length));
    checkLesson(loop, 75, board => Boolean(board.couplings?.length));
    checkLesson(tube, 61, board => board.containers?.some(container => container.role === 'cup') ?? false);
    checkLesson(tube, 45, board => board.containers?.some(container => container.role === 'capped') ?? false);
  });

  it('opens both new islands from a returning player’s save, including completed Workshop projects', () => {
    for (const previous of [180, 210]) {
      const completed = new Set([...CAMPAIGN.slice(0, previous).map(level => level.id), ...WORKSHOP_PROJECTS.map(p => p.id)]);
      const map = worldProgress(CAMPAIGN, completed);
      expect(map.frontier).toBe(previous / 3);
      const next = map.chapters[previous / 30]!.stops[0]!;
      expect(next.completed).toBe(0);
      expect(enterStop(next, completed)).toEqual({ index: previous, replay: false });
    }
    const workshop = new Set(WORKSHOP_PROJECTS.map(p => p.id));
    expect(CAMPAIGN.filter(level => workshop.has(level.id))).toEqual([]);
  });

  it('does not repeat a board under a different title or ID', () => {
    const bank = new Map([...BOARDS, ...LOOP_BOARDS, ...TUBE_BOARDS].map(board => [board.id, board]));
    for (const row of islandRounds) {
      expect(hashBoard(bank.get(row.id)!), row.id).toBe(row.hash);
      expect(SLOTS[row.id], row.id).toBe(row.slot);
    }
    const hashes = CAMPAIGN.map(level => hashBoard(bank.get(level.id)!));
    expect(new Set(hashes).size).toBe(hashes.length);
  });
});
