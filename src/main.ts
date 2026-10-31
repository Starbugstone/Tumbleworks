import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import { App } from './view/App';
import { t } from './i18n';
import { locale } from './preferences';

const canvas = document.getElementById('scene');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing canvas');
document.documentElement.lang = locale();
const boot = document.getElementById('boot');
if (boot) boot.textContent = t('Setting up the workshop…', 'Préparation de l’atelier…');

void App.start(canvas).then((app) => {
  if (import.meta.env.DEV) Object.assign(window, { tumbleworks: { app } });
}).catch((error: unknown) => {
  console.error(error);
  const boot = document.getElementById('boot');
  if (boot) boot.textContent = t('The workshop could not start. Please refresh to try again.', 'L’atelier n’a pas pu démarrer. Actualisez la page pour réessayer.');
});
