export type Locale = 'en' | 'fr';
interface Preferences { locale: Locale; guides: string[] }
const KEY = 'tumbleworks.preferences.v1';
const browserLocale = (): Locale => typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
let preferences: Preferences = { locale: browserLocale(), guides: [] };
try {
  const saved: unknown = JSON.parse(localStorage.getItem(KEY) ?? 'null');
  if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
    const value = saved as Record<string, unknown>;
    if (value.locale === 'en' || value.locale === 'fr') preferences.locale = value.locale;
    if (Array.isArray(value.guides)) preferences.guides = value.guides.filter((id): id is string => typeof id === 'string').slice(0, 100);
  }
} catch { /* Language and guides still work for this session without storage. */ }
const save = (): void => { try { localStorage.setItem(KEY, JSON.stringify(preferences)); } catch { /* Keep the in-memory choice. */ } };
const listeners = new Set<() => void>();
export const locale = (): Locale => preferences.locale;
export function setLocale(value: Locale): void {
  if (preferences.locale === value) return;
  preferences.locale = value; save();
  for (const listener of listeners) listener();
}
export function onLocaleChange(listener: () => void): () => void { listeners.add(listener); return () => { listeners.delete(listener); }; }
export const guideSeen = (id: string): boolean => preferences.guides.includes(id);
export function setGuideSeen(id: string, seen = true): void {
  preferences.guides = preferences.guides.filter((entry) => entry !== id);
  if (seen) preferences.guides.push(id);
  save();
}
