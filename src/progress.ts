const KEY = 'tumbleworks.progress.v1';
interface Progress { completed: string[]; muted: boolean; current: string | null }
let memory: Progress = { completed: [], muted: false, current: null };
let unsaved = false;
const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null && !Array.isArray(value);

function read(): Progress {
  if (unsaved) return memory;
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    if (!isRecord(parsed)) return memory;
    memory = {
      completed: Array.isArray(parsed.completed) ? parsed.completed.filter((id): id is string => typeof id === 'string').slice(0, 1000) : [],
      muted: parsed.muted === true,
      current: typeof parsed.current === 'string' ? parsed.current : null,
    };
  } catch { /* Keep this session playable when storage is unavailable. */ }
  return memory;
}
function write(progress: Progress): void {
  memory = progress;
  try { localStorage.setItem(KEY, JSON.stringify(progress)); } catch { unsaved = true; }
}
export const isCompleted = (id: string): boolean => read().completed.includes(id);
export const completedLevels = (): readonly string[] => [...read().completed];
export function markCompleted(id: string): void {
  const progress = read();
  if (!progress.completed.includes(id)) write({ ...progress, completed: [...progress.completed, id] });
}
export const currentLevel = (): string | null => read().current;
export const selectLevel = (id: string): void => write({ ...read(), current: id });
export const isMuted = (): boolean => read().muted;
export const setMuted = (muted: boolean): void => write({ ...read(), muted });
