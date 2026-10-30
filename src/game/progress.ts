const KEY = 'tumbleworks.progress.v1';

interface Progress {
  completed: string[];
  muted: boolean;
}

function read(): Progress {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? '{}');
    const record = (parsed ?? {}) as Partial<Progress>;
    return {
      completed: Array.isArray(record.completed) ? record.completed.filter((id) => typeof id === 'string') : [],
      muted: record.muted === true,
    };
  } catch {
    return { completed: [], muted: false };
  }
}

function write(progress: Progress): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(progress));
  } catch {
    // Private browsing can refuse storage. The game still plays; progress just won't survive a reload.
  }
}

export const isCompleted = (boardId: string): boolean => read().completed.includes(boardId);

export function markCompleted(boardId: string): void {
  const progress = read();
  if (!progress.completed.includes(boardId)) write({ ...progress, completed: [...progress.completed, boardId] });
}

export const isMuted = (): boolean => read().muted;
export const setMuted = (muted: boolean): void => write({ ...read(), muted });
