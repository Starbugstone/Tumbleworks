// Render cost survey: draw calls, triangles, scene makeup and a CPU profile per busy level.
// docker compose --profile e2e run --rm e2e node scripts/render-profile.mjs [levelIndex…]
import { chromium, devices } from 'playwright';
import { writeFileSync } from 'node:fs';
const url = process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180';
const RATE = Number(process.env.CPU_RATE ?? 4);
const SECONDS = Number(process.env.SECONDS ?? 8);
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext(devices['Pixel 7']);
const page = await context.newPage();
await page.goto(url);
await page.waitForFunction(() => Boolean(window.tumbleworks?.app?.runtime), undefined, { timeout: 90000 });
const levels = process.argv.slice(2).length ? process.argv.slice(2).map(Number)
  : await page.evaluate(() => [0, 1, 2]);
const results = [];
for (const index of levels) {
  await page.evaluate((i) => window.tumbleworks.app['loadBoard'](i), index);
  await page.waitForTimeout(500);
  const scene = await page.evaluate(() => {
    const { app } = window.tumbleworks;
    const view = app.runtime.view;
    const s = view.scene;
    const stats = { meshes: 0, instanced: 0, instances: 0, casters: 0, receivers: 0, transparent: 0, physical: 0, standard: 0, basic: 0, triangles: 0, casterTriangles: 0, materials: new Set(), lights: 0 };
    s.traverse((o) => {
      if (o.isLight) stats.lights++;
      if (!o.isMesh || !o.visible) return;
      stats.meshes++;
      const m = Array.isArray(o.material) ? o.material[0] : o.material;
      stats.materials.add(m.uuid);
      const tris = (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
      stats.triangles += tris;
      if (o.isInstancedMesh) { stats.instanced++; stats.instances += o.count; }
      if (o.castShadow) { stats.casters++; stats.casterTriangles += tris; }
      if (o.receiveShadow) stats.receivers++;
      if (m.transparent) stats.transparent++;
      if (m.isMeshPhysicalMaterial) stats.physical++; else if (m.isMeshStandardMaterial) stats.standard++; else stats.basic++;
    });
    return { ...stats, materials: stats.materials.size, kind: app.debugState().kind, id: app.debugState().levelId,
      pixelRatio: app.stage.renderer.getPixelRatio(), size: [app.stage.canvas.width, app.stage.canvas.height] };
  });
  const client = await context.newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: RATE });
  const pour = setInterval(() => {
    void page.evaluate(() => window.tumbleworks.app.debugTargets()).then((targets) => {
      const crate = Object.entries(targets).find(([id]) => /^(supply|lane)\d+$/.test(id))?.[1];
      return crate ? page.touchscreen.tap(crate.x, crate.y) : undefined;
    }).catch(() => undefined);
  }, 700);
  await client.send('Profiler.enable');
  await client.send('Profiler.setSamplingInterval', { interval: 200 });
  await client.send('Profiler.start');
  const sample = await page.evaluate(async (seconds) => {
    const { app } = window.tumbleworks;
    const r = app.stage.renderer;
    const out = { ticks: [], draws: [], refresh: [], frames: [], calls: [], tris: [], rendersPerFrame: [] };
    const { runtime } = app;
    const step = runtime.step.bind(runtime), render = runtime.render.bind(runtime);
    const refresh = app['refresh'].bind(app);
    const rr = r.render.bind(r);
    let renders = 0;
    r.render = (s, c) => { rr(s, c); renders++; out.calls.push(r.info.render.calls); out.tris.push(r.info.render.triangles); };
    runtime.step = () => { const t = performance.now(); const e = step(); out.ticks.push(performance.now() - t); return e; };
    runtime.render = (a, s) => { const t = performance.now(); render(a, s); out.draws.push(performance.now() - t); };
    app['refresh'] = () => { const t = performance.now(); refresh(); out.refresh.push(performance.now() - t); };
    await new Promise((resolve) => {
      let last = performance.now(); const end = last + seconds * 1000;
      const tick = (now) => { out.frames.push(now - last); out.rendersPerFrame.push(renders); renders = 0; last = now; if (now < end) requestAnimationFrame(tick); else resolve(); };
      requestAnimationFrame(tick);
    });
    runtime.step = step; runtime.render = render; app['refresh'] = refresh; r.render = rr;
    return { ...out, programs: r.info.programs.length, textures: r.info.memory.textures, geometries: r.info.memory.geometries, state: app.debugState() };
  }, SECONDS);
  clearInterval(pour);
  const { profile } = await client.send('Profiler.stop');
  await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  // Self time by function.
  const self = new Map();
  const byId = new Map(profile.nodes.map((n) => [n.id, n]));
  const dt = profile.timeDeltas; const total = (profile.endTime - profile.startTime) / 1000;
  const counts = new Map();
  for (const id of profile.samples) counts.set(id, (counts.get(id) ?? 0) + 1);
  const perSample = total / profile.samples.length;
  for (const [id, n] of counts) {
    const node = byId.get(id); const f = node.callFrame;
    const key = `${f.functionName || '(anon)'} ${f.url.split('/').slice(-2).join('/').replace(/\?.*/, '')}:${f.lineNumber + 1}`;
    self.set(key, (self.get(key) ?? 0) + n * perSample);
  }
  const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([k, v]) => `${v.toFixed(0).padStart(6)}ms ${k}`);
  const p = (v, at) => +([...v].sort((a, b) => a - b)[Math.floor(v.length * at)] ?? 0).toFixed(2);
  const avg = (v) => +(v.reduce((a, b) => a + b, 0) / Math.max(1, v.length)).toFixed(2);
  const result = { index, ...scene, programs: sample.programs, textures: sample.textures, geometries: sample.geometries,
    callsP50: p(sample.calls, 0.5), callsMax: Math.max(...sample.calls), trisP50: p(sample.tris, 0.5),
    tickP50: p(sample.ticks, 0.5), tickP95: p(sample.ticks, 0.95), ticksPerFrame: +(sample.ticks.length / sample.frames.length).toFixed(2),
    drawP50: p(sample.draws, 0.5), drawP95: p(sample.draws, 0.95), refreshP50: p(sample.refresh, 0.5), refreshAvg: avg(sample.refresh),
    frameP50: p(sample.frames, 0.5), frames: sample.frames.length, onBelt: sample.state.occupancy, top };
  results.push(result);
  console.log(JSON.stringify({ ...result, top: undefined }));
  console.log(top.join('\n'));
}
writeFileSync(`output/current/profile/render-profile-${process.env.LABEL ?? 'run'}.json`, JSON.stringify(results, null, 2));
await browser.close();
