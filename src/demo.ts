/** A phone demo opens registered boards directly and keeps its own save. */
export const demoEntry = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('demo');

export function saveKey(key: string): string {
  return demoEntry ? key + '.demo' : key;
}
