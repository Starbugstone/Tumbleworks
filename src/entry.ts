import type { App } from './view/App';

const root = document.documentElement;
const demoSession = location.pathname.endsWith('/demo.html') || new URLSearchParams(location.search).has('demo');
const boot = document.getElementById('boot')!;
let game: App | undefined;
let starting: Promise<App> | undefined;
let routeNumber = 0;
let visibleUrl = location.href;
if (demoSession) root.dataset.demoSession = 'true';

async function route() {
  visibleUrl = location.href;
  const current = ++routeNumber;
  const menu = location.pathname.endsWith('/demo.html');
  root.toggleAttribute('data-demo-menu', menu);
  if (menu) {
    game?.pauseForDemos();
    boot.hidden = true;
    window.dispatchEvent(new Event('demo-menu-open'));
    if (game) document.querySelector<HTMLElement>('#demo-home a')?.focus({ preventScroll: true });
    return;
  }
  if (game) { game.openDemoRoute(); return; }
  boot.hidden = false;
  try {
    starting ??= import('./main').then(module => module.start());
    game = await starting;
    if (current !== routeNumber) {
      if (location.pathname.endsWith('/demo.html')) game.pauseForDemos();
      else game.openDemoRoute();
    }
  } catch (error) {
    console.error(error);
    const french = root.lang === 'fr';
    boot.dataset.error = '';
    document.getElementById('boot-message')!.textContent = french ? 'L’atelier n’a pas pu démarrer.' : 'The workshop could not start.';
    const retry = document.getElementById('boot-retry') as HTMLButtonElement;
    retry.textContent = french ? 'Réessayer' : 'Retry';
    retry.hidden = false;
    retry.onclick = () => location.reload();
  }
}
if (demoSession) {
  document.getElementById('demo-home')!.addEventListener('click', event => {
    const link = event.target instanceof Element ? event.target.closest('a') : null;
    if (!link || event.ctrlKey || event.shiftKey || event.altKey || event.metaKey) return;
    event.preventDefault();
    history.pushState({ fromDemoMenu: true }, '', link.href);
    void route();
  });
  window.addEventListener('demo-route', () => void route());
  window.addEventListener('popstate', () => {
    if (game && visibleUrl === location.href && !location.pathname.endsWith('/demo.html')) {
      game.restoreDemoOverlay(history.state?.overlay);
    } else void route();
  });
}
void route();
