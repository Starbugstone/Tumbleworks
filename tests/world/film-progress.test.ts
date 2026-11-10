import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { worldProgress } from '../../src/world/progression';

const KEY = 'tumbleworks.valley.v1';
const boards = Array.from({ length: 20 }, (_, index) => ['conveyor', 'loop', 'tube'].map(kind => ({ id: `${kind}-${index}`, kind }))).flat();
let entries: Map<string, string>;
beforeEach(() => {
  vi.resetModules(); entries = new Map();
  vi.stubGlobal('localStorage', { getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => entries.set(key, value) });
});
afterEach(() => { vi.unstubAllGlobals(); });

it('migrates old completed locations without suppressing the next earned film', async () => {
  const films = await import('../../src/world/film-progress');
  const world = worldProgress(boards, new Set(boards.slice(0, 30).map(board => board.id)));
  films.initializeValley(world.chapters);
  expect(films.filmSeen(world.chapters[0]!.key)).toBe(true);
  expect(films.filmSeen(world.chapters[1]!.key)).toBe(false);
  films.initializeValley(worldProgress(boards, new Set(boards.map(board => board.id))).chapters);
  expect(films.filmSeen(world.chapters[1]!.key)).toBe(false);
  films.markFilmSeen(world.chapters[1]!.key);
  films.markFilmSeen(world.chapters[1]!.key);
  expect(JSON.parse(entries.get(KEY)!).seen).toHaveLength(2);
  vi.resetModules();
  expect((await import('../../src/world/film-progress')).filmSeen(world.chapters[1]!.key)).toBe(true);
});

it.each(['null', '{', '[]', '42', '{"seen":[null,2],"chapter":-3}'])('recovers invalid map storage: %s', async raw => {
  entries.set(KEY, raw);
  const films = await import('../../src/world/film-progress');
  films.initializeValley(worldProgress(boards, new Set()).chapters);
  expect(films.filmSeen('unknown')).toBe(false);
  films.markFilmSeen('earned');
  expect(films.filmSeen('earned')).toBe(true);
});

it('retains film acknowledgement when storage writes fail', async () => {
  vi.stubGlobal('localStorage', { getItem: () => null, setItem: () => { throw new Error('Quota'); } });
  const films = await import('../../src/world/film-progress');
  films.initializeValley(worldProgress(boards, new Set()).chapters);
  films.markFilmSeen('earned');
  films.rememberChapter(2);
  expect(films.filmSeen('earned')).toBe(true);
});
