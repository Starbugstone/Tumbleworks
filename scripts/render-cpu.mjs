// Main-thread cost of drawing one frozen busy frame, on a tiny canvas so the software rasteriser stays out of it.
// docker compose --profile e2e run --rm e2e node scripts/render-cpu.mjs [levelIndex…]
import { chromium, devices } from 'playwright';
const url = process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180';
const RATE = Number(process.env.CPU_RATE ?? 4);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 375, height: 690 } });
const page = await context.newPage();
await page.goto(url);
await page.waitForFunction(() => Boolean(window.tumbleworks?.app?.runtime), undefined, { timeout: 90000 });
await page.evaluate(() => { window.tumbleworks.app.manualClock = true; });
const client = await context.newCDPSession(page);
for (const index of process.argv.slice(2).map(Number)) {
  await page.evaluate((i) => {
    const { app } = window.tumbleworks;
    app['loadBoard'](i);
    const ids = Object.keys(app.runtime.targets()).filter((k) => /^(supply|lane)\d+$/.test(k));
    for (let round = 0; round < 3; round++) for (const id of ids.slice(0, 3)) { app['activate'](id); for (let t = 0; t < 25; t++) app.advance(1 / 60, false); }
    for (let t = 0; t < 120; t++) app.advance(1 / 60, true);
    app.stage.renderer.setPixelRatio(1); app.stage.renderer.setSize(8, 8, false);
    for (let t = 0; t < 10; t++) app.advance(1 / 60, true);
  }, index);
  await client.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  await client.send('Profiler.enable'); await client.send('Profiler.setSamplingInterval', { interval: 100 }); await client.send('Profiler.start');
  const timing = await page.evaluate(() => {
    const { app } = window.tumbleworks;
    const r = app.stage.renderer; const gl = r.getContext(); const px = new Uint8Array(4);
    const out = { render: [], step: [], refresh: [] };
    for (let i = 0; i < 60; i++) {
      let t = performance.now(); app.runtime.step(); out.step.push(performance.now() - t);
      t = performance.now(); app.runtime.render(0.5, 1 / 60); out.render.push(performance.now() - t);
      t = performance.now(); app['refresh'](); out.refresh.push(performance.now() - t);
      gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
    }
    const med = (v) => +[...v].sort((a, b) => a - b)[v.length >> 1].toFixed(2);
    return { step: med(out.step), render: med(out.render), refresh: med(out.refresh), calls: r.info.render.calls, id: app.debugState().levelId };
  });
  const { profile } = await client.send('Profiler.stop');
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const parent = new Map(); for (const n of profile.nodes) for (const c of n.children ?? []) parent.set(c, n.id);
  const counts = new Map(); for (const id of profile.samples) counts.set(id, (counts.get(id) ?? 0) + 1);
  const per = (profile.endTime - profile.startTime) / 1000 / profile.samples.length;
  const name = (n) => `${n.callFrame.functionName || '(anon)'} ${n.callFrame.url.split('/').pop().replace(/\?.*/, '')}:${n.callFrame.lineNumber + 1}`;
  const self = new Map(), incl = new Map(), callers = new Map();
  for (const [id, c] of counts) {
    const k = name(byId.get(id)); self.set(k, (self.get(k) ?? 0) + c * per);
    const seen = new Set();
    for (let p = id; p !== undefined; p = parent.get(p)) { const pk = name(byId.get(p)); if (!seen.has(pk)) { seen.add(pk); incl.set(pk, (incl.get(pk) ?? 0) + c * per); } }
  }
  for (const [id, c] of counts) {
    const n = byId.get(id); if (!/getParameters|getProgram\b|getProgramCacheKey/.test(n.callFrame.functionName)) continue;
    let chain = []; for (let p = parent.get(id); p !== undefined && chain.length < 4; p = parent.get(p)) chain.push(byId.get(p).callFrame.functionName || '(anon)');
    const k = `${n.callFrame.functionName} ← ${chain.join(' ← ')}`; callers.set(k, (callers.get(k) ?? 0) + c * per);
  }
  console.log(`\n${timing.id}: per frame at ${RATE}x  step ${timing.step} ms  render ${timing.render} ms  refresh ${timing.refresh} ms  calls ${timing.calls}`);
  console.log(' self:'); for (const [k, v] of [...self].sort((a, b) => b[1] - a[1]).slice(0, 22)) console.log(`  ${(v / 60).toFixed(2).padStart(6)} ms/frame ${k}`);
  console.log(' inclusive:'); for (const [k, v] of [...incl].sort((a, b) => b[1] - a[1]).slice(0, 30)) console.log(`  ${(v / 60).toFixed(2).padStart(6)} ms/frame ${k}`);
  console.log(' program lookups:'); for (const [k, v] of [...callers].sort((a, b) => b[1] - a[1]).slice(0, 6)) console.log(`  ${(v / 60).toFixed(2).padStart(6)} ms/frame ${k}`);
}
await browser.close();
