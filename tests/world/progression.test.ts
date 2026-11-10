import { describe, expect, it } from 'vitest';
import { enterStop, nextInStop, worldProgress, type WorldLevel } from '../../src/world/progression';

const levels = (rounds: number): WorldLevel[] => Array.from({ length: rounds }, (_, round) => [
  { id: `crate-${round * 7 + 4}`, kind: 'conveyor' }, { id: `lorry-${round * 11 + 9}`, kind: 'loop' }, { id: `tube-${round * 3 + 1}`, kind: 'tube' },
]).flat();

describe('valley construction follows stable campaign IDs', () => {
  it('builds six ten-stop locations for the 180-level campaign and twelve for its target', () => {
    const current = worldProgress(levels(60), new Set());
    expect(current.chapters).toHaveLength(6);
    expect(current.chapters.every(chapter => chapter.stops.length === 10)).toBe(true);
    expect(worldProgress(levels(120), new Set()).chapters).toHaveLength(12);
    expect(current.stops.filter(stop => stop.status === 'available').map(stop => stop.index)).toEqual([0]);
  });

  it('requires all three games and refuses a future stop without changing progress', () => {
    const boards = levels(2);
    const completed = new Set(boards.slice(0, 2).map(level => level.id));
    const progress = worldProgress(boards, completed);
    expect(progress.stops[0]!.completed).toBe(2);
    expect(enterStop(progress.stops[0]!, completed)).toEqual({ index: 2, replay: false });
    expect(enterStop(progress.stops[1]!, completed)).toBeNull();
    expect([...completed]).toEqual(boards.slice(0, 2).map(level => level.id));
    completed.add(boards[2]!.id);
    expect(worldProgress(boards, completed).stops[1]!.status).toBe('available');
  });

  it('cannot cross a round boundary on Next, including at a chapter boundary', () => {
    const boards = levels(11);
    for (const index of [0, 8, 9, 10]) {
      const completed = new Set(boards.slice(0, (index + 1) * 3).map(level => level.id));
      const stop = worldProgress(boards, completed).stops[index]!;
      expect(nextInStop(stop, index * 3 + 2, completed, false)).toBeNull();
      expect(nextInStop(stop, index * 3 + 2, completed, true)).toBeNull();
    }
  });

  it('resumes a partial round and replays each game of an already built stop', () => {
    const boards = levels(1);
    const completed = new Set([boards[0]!.id]);
    let stop = worldProgress(boards, completed).stops[0]!;
    expect(enterStop(stop, completed)).toEqual({ index: 1, replay: false });
    completed.add(boards[1]!.id);
    expect(nextInStop(stop, 1, completed, false)).toBe(2);
    completed.add(boards[2]!.id);
    stop = worldProgress(boards, completed).stops[0]!;
    expect(enterStop(stop, completed)).toEqual({ index: 0, replay: true });
    expect(nextInStop(stop, 0, completed, true)).toBe(1);
    expect(nextInStop(stop, 1, completed, true)).toBe(2);
    expect(nextInStop(stop, 2, completed, true)).toBeNull();
  });

  it('preserves old out-of-order saves without treating Workshop or retired IDs as construction', () => {
    const boards = levels(12);
    const completed = new Set(['board-212', 'tube-211', 'tray-1', ...boards.slice(0, 30).map(level => level.id), boards[34]!.id]);
    const progress = worldProgress(boards, completed);
    expect(progress.chapters[0]!.complete).toBe(true);
    expect(progress.frontier).toBe(10);
    expect(progress.stops[11]!.status).toBe('available');
    expect(enterStop(progress.stops[11]!, completed)).toEqual({ index: 33, replay: false });
    expect(worldProgress(boards, new Set(['board-212', 'tube-211', 'tray-1'])).frontier).toBe(0);
  });

  it('keeps a chapter film key stable when later chapters are added', () => {
    expect(worldProgress(levels(10), new Set()).chapters[0]!.key).toBe(worldProgress(levels(60), new Set()).chapters[0]!.key);
  });

  it('rejects invalid round membership instead of silently assigning a Workshop level', () => {
    expect(() => worldProgress(levels(1).slice(0, 2), new Set())).toThrow('complete rounds');
    expect(() => worldProgress([...levels(1)].reverse(), new Set())).toThrow('in order');
    expect(() => worldProgress([...levels(1), ...levels(1)], new Set())).toThrow('Duplicate');
    const stop = worldProgress(levels(2), new Set()).stops[0]!;
    expect(() => nextInStop(stop, 4, new Set(), false)).toThrow('another construction stop');
  });
});

/** Exhaust every completion order, double completion and stale map click in a two-stop chapter. */
it('checks bounded progression interleavings against an independent prefix oracle', () => {
  const boards = levels(2);
  let states = 0, rejected = 0;
  for (let mask = 0; mask < 1 << boards.length; mask++) {
    const completed = new Set(boards.filter((_, index) => mask & (1 << index)).map(level => level.id));
    const progress = worldProgress(boards, completed);
    const counts = [0, 1].map(round => boards.slice(round * 3, round * 3 + 3).filter(level => completed.has(level.id)).length);
    const frontier = counts[0] !== 3 ? 0 : counts[1] !== 3 ? 1 : 2;
    expect(progress.frontier).toBe(frontier);
    states++;
    for (const stop of progress.stops) {
      const entry = enterStop(stop, completed);
      if (!entry) { rejected++; expect(stop.completed).toBe(0); expect(stop.index).toBeGreaterThan(frontier); continue; }
      expect(entry.index).toBeGreaterThanOrEqual(stop.firstLevel);
      expect(entry.index).toBeLessThan(stop.firstLevel + 3);
      const duplicate = new Set([...completed, ...completed]);
      expect(worldProgress(boards, duplicate)).toEqual(progress);
      for (const level of stop.levels) {
        const accepted = new Set(completed).add(level.id);
        const rebuilt = worldProgress(boards, accepted);
        expect(rebuilt.stops[stop.index]!.completed).toBeGreaterThanOrEqual(stop.completed);
        if (rebuilt.stops[stop.index]!.completed === 3) expect(nextInStop(stop, boards.findIndex(board => board.id === level.id), accepted, false)).toBeNull();
      }
    }
  }
  expect(states).toBe(64);
  expect(rejected).toBeGreaterThan(0);
});

it('the safety checks catch deliberate future-entry and cross-round-Next mutations', () => {
  const boards = levels(2);
  const progress = worldProgress(boards, new Set());
  const checkEntry = (transition: typeof enterStop): void => {
    const result = transition(progress.stops[1]!, new Set());
    if (result !== null) throw new Error('A future map tap started a level');
  };
  checkEntry(enterStop);
  expect(() => checkEntry(stop => ({ index: stop.firstLevel, replay: false }))).toThrow('future map tap');
  const completed = new Set(boards.slice(0, 3).map(level => level.id));
  const stop = worldProgress(boards, completed).stops[0]!;
  const checkNext = (transition: typeof nextInStop): void => {
    if (transition(stop, 2, completed, false) !== null) throw new Error('Next crossed the round boundary');
  };
  checkNext(nextInStop);
  expect(() => checkNext((_stop, current) => current + 1)).toThrow('round boundary');
});
