import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { once } from 'node:events';
import { resolve } from 'node:path';

const directory = resolve(process.env.TUMBLEWORKS_FILM_OUTPUT ?? 'public/films');
const bundle = await readFile('output/current/world-film-render/film.js', 'utf8');
const chapters = process.argv.slice(2).map(Number);
if (chapters.some(chapter => !Number.isInteger(chapter) || chapter < 1 || chapter > 12)) throw new Error('Supply chapter numbers 1–12');
await mkdir(directory, { recursive: true });
await mkdir('output/current/world-films', { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
try {
  const page = await browser.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: 1 });
  for (const chapter of chapters.length ? chapters : [1, 2, 3, 4, 5, 6]) {
    const errors = [];
    const onError = error => errors.push(error.message);
    page.on('pageerror', onError);
    // A frozen bundle has no Vite client: other threads can continue editing without reloading an export.
    await page.setContent(`<html><head><style>html,body{margin:0;background:#172e3b;overflow:hidden}canvas{display:block;width:100vw;height:100vh}</style></head><body data-chapter="${chapter - 1}"><canvas id="film"></canvas><script>${bundle.replaceAll('</script', '<\\/script')}</script></body></html>`);
    await page.waitForFunction(() => typeof window.renderValleyFrame === 'function');
    const duration = await page.evaluate(() => window.valleyFilmDuration);
    if (!Number.isFinite(duration) || duration < 10 || duration > 15) throw new Error('Invalid authored film duration');
    const path = resolve(directory, `valley-${chapter}.mp4`);
    const temporary = resolve(directory, `valley-${chapter}.rendering.mp4`);
    const ffmpeg = spawn(process.env.FFMPEG ?? 'ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', '24', '-i', 'pipe:0', '-an', '-c:v', 'libx264', '-threads', '2', '-preset', 'fast', '-crf', '25', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', temporary], { stdio: ['pipe', 'inherit', 'inherit'] });
    const finished = once(ffmpeg, 'close');
    ffmpeg.on('error', error => { throw error; });
    for (let frame = 0; frame < duration * 24; frame++) {
      const encoded = await page.evaluate(seconds => {
        window.renderValleyFrame(seconds);
        return document.getElementById('film').toDataURL('image/png').split(',')[1];
      }, frame / 24);
      const png = Buffer.from(encoded, 'base64');
      if (frame === 0 || frame === 120 || frame === 288) await writeFile(`output/current/world-films/chapter-${chapter}-${frame}.png`, png);
      if (!ffmpeg.stdin.write(png)) await once(ffmpeg.stdin, 'drain');
    }
    ffmpeg.stdin.end();
    const [code] = await finished;
    if (code !== 0 || errors.length) throw new Error(`Chapter ${chapter}: encoder ${code}, browser errors ${errors.join(', ')}`);
    await rename(temporary, path);
    await page.evaluate(() => window.disposeValleyFilm());
    page.off('pageerror', onError);
    console.log(`Rendered chapter ${chapter}: ${path}`);
  }
} finally { await browser.close(); }
