import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const KEY = 'tumbleworks.preferences.v1';
beforeEach(() => { vi.resetModules(); });
afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); });
function storage(initial: string | null = null, writable = true): Storage {
  let value = initial;
  return { getItem: () => value, setItem: () => { if (!writable) throw new Error('denied'); }, removeItem: () => { value = null; }, clear: () => { value = null; }, key: () => KEY, length: 1 };
}
describe('language and introduction preferences', () => {
  it('detects French and keeps an explicit English choice and dismissed guides in memory when storage refuses writes', async () => {
    vi.stubGlobal('navigator', { language: 'fr-CA' });
    vi.stubGlobal('localStorage', storage(null, false));
    const p = await import('../../src/preferences');
    expect(p.locale()).toBe('fr');
    const listener = vi.fn(); const off = p.onLocaleChange(listener);
    p.setLocale('en'); p.setGuideSeen('loop-basics');
    expect(p.locale()).toBe('en'); expect(p.guideSeen('loop-basics')).toBe(true);
    expect(listener).toHaveBeenCalledTimes(1);
    off(); p.setLocale('fr'); expect(listener).toHaveBeenCalledTimes(1);
    p.setGuideSeen('loop-basics', false); expect(p.guideSeen('loop-basics')).toBe(false);
  });
  it('honours saved choices and ignores malformed data', async () => {
    vi.stubGlobal('navigator', { language: 'en-GB' });
    vi.stubGlobal('localStorage', storage(JSON.stringify({ locale: 'fr', guides: ['tube-basics', 17, null] })));
    const p = await import('../../src/preferences');
    expect(p.locale()).toBe('fr'); expect(p.guideSeen('tube-basics')).toBe(true);
    vi.resetModules(); vi.stubGlobal('localStorage', storage('{broken'));
    expect((await import('../../src/preferences')).locale()).toBe('en');
  });
});
