import type { WorldChapter } from './progression';

const KEY = 'tumbleworks.valley.v1';
interface FilmProgress { seen: string[]; chapter: number }
let memory: FilmProgress = { seen: [], chapter: 0 };
let unsaved = false;

function read(): FilmProgress | null {
  if (unsaved) return memory;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw === null) return null;
    const value: unknown = JSON.parse(raw);
    if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
    const record: Record<string, unknown> = value as Record<string, unknown>;
    return {
      seen: Array.isArray(record['seen']) ? record['seen'].filter((id): id is string => typeof id === 'string').slice(0, 1000) : [],
      chapter: typeof record['chapter'] === 'number' && Number.isSafeInteger(record['chapter']) && record['chapter'] >= 0 ? record['chapter'] : 0,
    };
  } catch { return unsaved ? memory : null; }
}
function write(value: FilmProgress): void {
  memory = value;
  try { localStorage.setItem(KEY, JSON.stringify(value)); } catch { unsaved = true; }
}

/** An old save arrives with its existing buildings intact, without a backlog of automatic films. */
export function initializeValley(chapters: readonly WorldChapter[]): void {
  if (read() === null) write({ seen: chapters.filter(chapter => chapter.complete).map(chapter => chapter.key), chapter: 0 });
}
export const filmSeen = (key: string): boolean => (read() ?? memory).seen.includes(key);
export function markFilmSeen(key: string): void {
  const value = read() ?? memory;
  if (!value.seen.includes(key)) write({ ...value, seen: [...value.seen, key] });
}
export function rememberChapter(chapter: number): void { write({ ...(read() ?? memory), chapter }); }
