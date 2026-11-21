import themes from './world/village-themes.json' with { type: 'json' };

function query() {
  return new URLSearchParams(typeof location === 'undefined' ? '' : location.search);
}
export let demoEntry = query().get('demo');
let requestedIsland = query().get('island');
function filmChapter() {
  if (demoEntry === 'harbour') return 0;
  return demoEntry === 'village' ? themes.findIndex(theme => theme.id === (requestedIsland ?? themes[0]!.id)) : -1;
}
export let demoFilmChapter = filmChapter();

export function readDemoRoute(): void {
  demoEntry = query().get('demo');
  requestedIsland = query().get('island');
  demoFilmChapter = filmChapter();
}

export function returnToDemoMenu(): void {
  const island = themes.find(theme => theme.id === requestedIsland);
  const menu = island && island !== themes[0] ? './demo.html?island=' + encodeURIComponent(island.id) : './demo.html';
  if (history.state?.fromDemoMenu) {
    history.go(history.state.overlay ? -2 : -1);
    return;
  }
  if (history.state?.overlay) history.replaceState(null, '', menu);
  else history.pushState(null, '', menu);
  window.dispatchEvent(new Event('demo-route'));
}

export function saveKey(key: string): string {
  const session = typeof document !== 'undefined' && document.documentElement.dataset.demoSession === 'true';
  return demoEntry || session ? key + '.demo' : key;
}
