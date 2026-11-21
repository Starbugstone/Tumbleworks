import { App } from './view/App';
import { locale } from './preferences';
import { WORKSHOP_LEVELS } from './workshop';

export async function start() {
  const canvas = document.getElementById('scene');
  if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing canvas');
  document.documentElement.lang = locale();
  const app = await App.start(canvas, WORKSHOP_LEVELS);
  if (import.meta.env.DEV) Object.assign(window, { tumbleworks: { app } });
  return app;
}
