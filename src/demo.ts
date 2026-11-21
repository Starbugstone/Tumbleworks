import themes from './world/village-themes.json' with { type: 'json' };

/** A phone demo opens registered boards directly and keeps its own save. */
export const demoEntry = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('demo');

// The original harbour link remains valid. New film cards use the theme's stable island ID.
const requestedIsland = typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('island');
export const demoFilmChapter = demoEntry === 'harbour' ? 0 : demoEntry === 'village'
  ? themes.findIndex(theme => theme.id === (requestedIsland ?? themes[0]!.id)) : -1;

export function demoMenuUrl(): string {
  const island = themes.find(theme => theme.id === requestedIsland)?.id;
  return island && island !== themes[0]!.id ? './demo.html?island=' + encodeURIComponent(island) : './demo.html';
}

export function saveKey(key: string): string {
  return demoEntry ? key + '.demo' : key;
}
