import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'tumbleworks.progress.v1';

function localStorageStub(initial: Record<string, string> = {}): Storage {
  const entries = new Map(Object.entries(initial));
  return {
    get length() { return entries.size; },
    clear: () => entries.clear(),
    getItem: (key) => entries.get(key) ?? null,
    key: (index) => [...entries.keys()][index] ?? null,
    removeItem: (key) => { entries.delete(key); },
    setItem: (key, value) => { entries.set(key, String(value)); },
  };
}

beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.resetModules(); });

describe('shared campaign progress', () => {
  it('preserves old conveyor completions and mute when a new level type is selected', async () => {
    const storage = localStorageStub({ [KEY]: JSON.stringify({ completed: ['board-1'], muted: true }) });
    vi.stubGlobal('localStorage', storage);
    const progress = await import('../../src/progress');
    expect(progress.isCompleted('board-1')).toBe(true);
    expect(progress.isMuted()).toBe(true);
    expect(progress.currentLevel()).toBeNull();
    progress.selectLevel('tube-1');
    progress.markCompleted('tube-1');
    progress.markCompleted('tube-1');
    expect(JSON.parse(storage.getItem(KEY) ?? '{}')).toEqual({ completed: ['board-1', 'tube-1'], muted: true, current: 'tube-1' });
    expect(progress.isCompleted('board-1')).toBe(true);
  });

  it('restores completion, selected level, and mute after the progress module restarts', async () => {
    vi.stubGlobal('localStorage', localStorageStub());
    const progress = await import('../../src/progress');
    progress.markCompleted('board-1');
    progress.markCompleted('tray-1');
    progress.selectLevel('tube-2');
    progress.setMuted(true);
    vi.resetModules();
    const restored = await import('../../src/progress');
    expect(restored.isCompleted('board-1')).toBe(true);
    expect(restored.isCompleted('tray-1')).toBe(true);
    expect(restored.isCompleted('tube-2')).toBe(false);
    expect(restored.currentLevel()).toBe('tube-2');
    expect(restored.isMuted()).toBe(true);
  });

  it.each(['{', 'null', '[]', '42', '"not a record"', '{"completed":"board-1","muted":1,"current":42}'])('handles malformed or invalid storage safely: %s', async (value) => {
    vi.stubGlobal('localStorage', localStorageStub({ [KEY]: value }));
    const progress = await import('../../src/progress');
    expect(progress.isCompleted('board-1')).toBe(false);
    expect(progress.currentLevel()).toBeNull();
    expect(progress.isMuted()).toBe(false);
  });

  it('keeps only string completion IDs and boolean mute without accepting malformed values', async () => {
    vi.stubGlobal('localStorage', localStorageStub({ [KEY]: JSON.stringify({
      completed: ['board-1', null, false, 1, {}, 'tray-1'], muted: 'true', current: ['tube-1'],
    }) }));
    const progress = await import('../../src/progress');
    expect(progress.isCompleted('board-1')).toBe(true);
    expect(progress.isCompleted('tray-1')).toBe(true);
    expect(progress.isCompleted('1')).toBe(false);
    expect(progress.isMuted()).toBe(false);
    expect(progress.currentLevel()).toBeNull();
    progress.selectLevel('tube-1');
    expect(progress.currentLevel()).toBe('tube-1');
  });

  it('keeps progress in this session when all storage access is blocked', async () => {
    const storage = localStorageStub();
    vi.spyOn(storage, 'getItem').mockImplementation(() => { throw new Error('Storage access denied'); });
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('Storage access denied'); });
    vi.stubGlobal('localStorage', storage);
    const progress = await import('../../src/progress');
    progress.selectLevel('tray-1');
    progress.markCompleted('board-1');
    progress.setMuted(true);
    expect(progress.currentLevel()).toBe('tray-1');
    expect(progress.isCompleted('board-1')).toBe(true);
    expect(progress.isMuted()).toBe(true);
  });

  it('keeps current-session progress when writes fail but stale stored progress remains readable', async () => {
    const storage = localStorageStub({ [KEY]: JSON.stringify({ completed: ['board-1'], muted: true }) });
    vi.spyOn(storage, 'setItem').mockImplementation(() => { throw new Error('Storage quota exceeded'); });
    vi.stubGlobal('localStorage', storage);
    const progress = await import('../../src/progress');
    progress.selectLevel('tube-1');
    progress.markCompleted('tube-1');
    expect(progress.isCompleted('board-1')).toBe(true);
    expect(progress.isCompleted('tube-1')).toBe(true);
    expect(progress.currentLevel()).toBe('tube-1');
    expect(progress.isMuted()).toBe(true);
  });
});
