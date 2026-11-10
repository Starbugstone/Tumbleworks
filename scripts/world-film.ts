import { Stage } from '../src/engine/stage';
import { WorldFilm } from '../src/view/world-film';

const canvas = document.getElementById('film');
if (!(canvas instanceof HTMLCanvasElement)) throw new Error('Missing film canvas');
const stage = new Stage(canvas);
stage.renderer.setPixelRatio(1);
const chapter = Math.max(0, Math.min(11, Number(document.body.dataset['chapter']) || 0));
const film = new WorldFilm(stage, chapter);
while(film.readiness()==='pending'){film.poster();await new Promise<void>(r=>requestAnimationFrame(()=>r()));}
if(film.readiness()!=='ready'||!film.begin())throw Error('World film could not become ready');
film.render(0);
Object.assign(window, { valleyFilmDuration: film.duration, renderValleyFrame: (seconds: number) => film.render(seconds), disposeValleyFilm: () => { film.dispose(); stage.renderer.dispose(); } });
