import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import { App } from './view/App';

const canvas = document.getElementById('scene');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing canvas');

void App.start(canvas).then((app) => {
  if (import.meta.env.DEV) {
    // Browser tests and capture scripts read state and find tap targets through this.
    Object.assign(window, { tumbleworks: { app } });
  }
});
