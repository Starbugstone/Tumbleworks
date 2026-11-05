// Same levels, same taps, same ticks: canvas captures for comparing two builds pixel by pixel.
// docker compose --profile e2e run --rm e2e node scripts/frame-captures.mjs <label> [levelIndex…] [--desktop]
// docker compose --profile e2e run --rm e2e node scripts/frame-captures.mjs --compare <labelA> <labelB>
import { chromium, devices } from 'playwright';
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PHONE, DESKTOP } from '../tests/fixtures/viewports.ts';
const url = process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180';
const root = 'output/current/perf-compare';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const desktop = process.argv.includes('--desktop');
const page = await (await browser.newContext({ ...devices['Pixel 7'], viewport: desktop ? DESKTOP : PHONE, deviceScaleFactor: 2 })).newPage();
if (process.argv[2] === '--compare') {
  const [a, b] = process.argv.slice(3);
  await page.setContent('<canvas id=c></canvas>');
  for (const name of readdirSync(`${root}/${a}`).filter((f) => f.endsWith('.png')).sort()) {
    const load = (label) => `data:image/png;base64,${readFileSync(`${root}/${label}/${name}`).toString('base64')}`;
    const result = await page.evaluate(async ([x, y]) => {
      const image = async (src) => { const i = new Image(); i.src = src; await i.decode(); return i; };
      const [p, q] = [await image(x), await image(y)];
      if (p.width !== q.width || p.height !== q.height) throw new Error('Capture sizes differ');
      const c = document.createElement('canvas'); c.width = p.width; c.height = p.height; const g = c.getContext('2d', { willReadFrequently: true });
      g.drawImage(p, 0, 0); const d1 = g.getImageData(0, 0, c.width, c.height).data;
      g.clearRect(0, 0, c.width, c.height); g.drawImage(q, 0, 0); const d2 = g.getImageData(0, 0, c.width, c.height).data;
      let changed = 0, exactChanged = 0, max = 0, sum = 0;
      for (let i = 0; i < d1.length; i += 4) {
        const d = Math.max(Math.abs(d1[i] - d2[i]), Math.abs(d1[i + 1] - d2[i + 1]), Math.abs(d1[i + 2] - d2[i + 2]));
        if (d > 0) exactChanged++;
        if (d > 2) changed++; max = Math.max(max, d); sum += d;
      }
      return { exactChanged, changedPct: +(changed / (d1.length / 4) * 100).toFixed(3), max, mean: +(sum / (d1.length / 4)).toFixed(3) };
    }, [load(a), load(b)]);
    console.log(`${name.padEnd(28)} changed ${String(result.changedPct).padStart(7)}%  max ${String(result.max).padStart(3)}  mean ${result.mean}  exact changed pixels ${result.exactChanged}`);
  }
  await browser.close(); process.exit(0);
}
const label = process.argv[2];
mkdirSync(`${root}/${label}`, { recursive: true });
await page.goto(url);
await page.waitForFunction(() => Boolean(window.tumbleworks?.app?.runtime), undefined, { timeout: 90000 });
await page.evaluate(() => { const { app } = window.tumbleworks; app.manualClock = true; });
for (const index of process.argv.slice(3).filter((arg) => arg !== '--desktop').map(Number)) {
  await page.evaluate((i) => {
    const { app } = window.tumbleworks;
    app['loadBoard'](i);
    const r = app.stage.renderer; r.setPixelRatio(Number(new URLSearchParams(location.search).get('ratio')) || app.stage.pixelRatio); r.setSize(app.stage.canvas.clientWidth, app.stage.canvas.clientHeight, false);
    app.runtime.resize(); app.advance(1 / 60, true);
  }, index);
  const shot = async (step) => {
    // Read immediately after drawing: DOM guide hands and HUD animation are not scene pixels.
    const data = await page.evaluate(() => {
      const { app } = window.tumbleworks;
      app.runtime.render(0, 0);
      return app.stage.canvas.toDataURL('image/png');
    });
    writeFileSync(`${root}/${label}/${String(index).padStart(3, '0')}-${step}.png`, Buffer.from(data.split(',')[1], 'base64'));
  };
  await shot('a');
  const keys = await page.evaluate(() => Object.keys(window.tumbleworks.app.runtime.targets()).filter((k) => /^(supply|lane|tube)\d+$/.test(k)));
  const act = (id, ticks) => page.evaluate(([k, n]) => { const { app } = window.tumbleworks; app['activate'](k); for (let t = 0; t < n; t++) app.advance(1 / 60, t === n - 1); }, [id, ticks]);
  await act(keys[0], 30); await shot('b');
  await act(keys[1] ?? keys[0], 90); await shot('c');
  await act(keys[2] ?? keys[0], 240); await shot('d');
}
await browser.close();
