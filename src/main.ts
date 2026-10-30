import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import { App } from './view/App';

const canvas = document.getElementById('scene');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing canvas');

void App.start(canvas).then((app) => {
  if (import.meta.env.DEV) Object.assign(window, { tumbleworks: { app } });
}).catch((error: unknown) => {
  console.error(error);
  const boot = document.getElementById('boot');
  if (boot) boot.textContent = 'The workshop could not start. Please refresh to try again.';
});
