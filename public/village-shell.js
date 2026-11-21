// Both screens use the same island art before the game engine starts.
(() => {
  const root = document.documentElement;
  const menu = document.querySelector('nav[data-demo-menu]');
  const isMenu = () => location.pathname.endsWith('/demo.html');
  const demo = isMenu() || new URLSearchParams(location.search).has('demo');
  const storageKey = 'tumbleworks.visual-island.v1' + (demo ? '.demo' : '');
  let previous, language = navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  try {
    previous = localStorage.getItem(storageKey);
    const saved = JSON.parse(localStorage.getItem('tumbleworks.preferences.v1' + (demo ? '.demo' : '')) || 'null');
    if (saved?.locale === 'fr' || saved?.locale === 'en') language = saved.locale;
  } catch { /* Fall back to the browser language. */ }
  root.lang = language;
  if (language === 'fr') document.getElementById('boot-message').textContent = 'Préparation de l’atelier…';
  fetch('./village-themes.json').then(reply => reply.json()).then(themes => {
    function paint() {
      const params = new URLSearchParams(location.search), entry = params.get('demo');
      const requested = isMenu() ? params.get('island') || themes[0].id : root.dataset.village || params.get('island');
      const theme = themes.find(v => v.id === requested) ||
        themes.find(v => entry && v.demo?.some(card => card.level === entry)) ||
        (entry !== 'harbour' && themes.find(v => v.id === previous)) || themes[0];
      root.dataset.village = theme.id;
      try { localStorage.setItem(storageKey, theme.id); } catch { /* Optional between visits. */ }
      for (const [key, value] of [['land', theme.terrain], ['roof', theme.roof], ['accent', theme.accent]]) root.style.setProperty('--village-' + key, value);
      root.style.setProperty('--village-print', theme.print ? 'url("' + new URL(theme.print, document.baseURI).href + '")' : 'linear-gradient(145deg,'+theme.terrain+','+theme.roof+')');
      if (!isMenu() || !menu) return;
      const french = root.lang === 'fr';
      document.getElementById('demo-island').textContent = theme.name[french ? 1 : 0];
      const all = menu.querySelector('#all');
      all.href = './?' + new URLSearchParams({ demo: 'levels', island: theme.id });
      all.textContent = french ? 'Tous les niveaux' : 'All levels';
      for (const card of menu.querySelectorAll('[data-level]')) card.remove();
      for (const card of theme.demo ?? []) {
        const link = document.createElement('a'), image = document.createElement('img');
        link.dataset.level = card.level;
        link.href = './?' + new URLSearchParams({ demo: card.level, island: theme.id });
        image.alt = ''; image.src = card.image;
        link.append(image, card.level === 'village' ? theme.name[french ? 1 : 0] : card.name);
        menu.insertBefore(link, all);
      }
    }
    paint();
    window.addEventListener('village-theme', paint);
    window.addEventListener('demo-menu-open', paint);
  }).catch(() => { /* All levels stays available if the art manifest cannot load. */ });
})();
