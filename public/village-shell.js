// The launcher and cold start load without Three.js, fonts or the physics engine.
(() => {
  const root = document.documentElement;
  const url = new URL(location.href);
  const menu = document.querySelector('[data-demo-menu]');
  const storageKey = 'tumbleworks.visual-island.v1' + (menu || url.searchParams.has('demo') ? '.demo' : '');
  const demo = menu || url.searchParams.has('demo');
  let language = navigator.language.toLowerCase().startsWith('fr') ? 'fr' : 'en';
  try {
    const saved = JSON.parse(localStorage.getItem('tumbleworks.preferences.v1' + (demo ? '.demo' : '')) || 'null');
    if (saved?.locale === 'fr' || saved?.locale === 'en') language = saved.locale;
  } catch { /* The browser language works without saved preferences. */ }
  root.lang = language;
  const status = document.getElementById('boot-message');
  if (status && language === 'fr') status.textContent = 'Préparation de l’atelier…';
  let previous;
  try { previous = localStorage.getItem(storageKey); } catch { /* Storage can be unavailable. */ }
  fetch('./village-themes.json').then(reply => reply.json()).then(themes => {
    function paint() {
      const entry = url.searchParams.get('demo');
      const requested = root.dataset.village || url.searchParams.get('island') || (entry === 'harbour' ? themes[0].id : null);
      const theme = themes.find(v => v.id === requested) ||
        themes.find(v => entry && v.demo?.some(card => card.level === entry)) ||
        (!menu && themes.find(v => v.id === previous)) || themes[0];
      root.dataset.village = theme.id;
      try { localStorage.setItem(storageKey,theme.id); } catch { /* Optional between visits. */ }
      root.style.setProperty('--village-land',theme.terrain);
      root.style.setProperty('--village-roof',theme.roof);
      root.style.setProperty('--village-accent',theme.accent);
      root.style.setProperty('--village-print',theme.print ? 'url("' + theme.print + '")' :
        'linear-gradient(145deg,'+theme.terrain+','+theme.roof+')');
      if (!menu) return;
      const all = menu.querySelector('#all');
      all.href = './?' + new URLSearchParams({ demo: 'levels', island: theme.id });
      menu.querySelectorAll('[data-level]').forEach(card => card.remove());
      for (const card of theme.demo ?? []) {
        const link = document.createElement('a'), image = document.createElement('img');
        link.dataset.level = card.level;
        link.href = './?' + new URLSearchParams({ demo: card.level, island: theme.id });
        image.alt = ''; image.src = card.image;
        link.append(image,card.level === 'village' ? theme.name[language === 'fr' ? 1 : 0] : card.name);
        menu.insertBefore(link,all);
      }
      if (language === 'fr') all.textContent = 'Tous les niveaux';
    }
    paint();
    window.addEventListener('village-theme',paint);
  }).catch(() => { /* The boot status and the All levels link remain usable offline. */ });
})();
