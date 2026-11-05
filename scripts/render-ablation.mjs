// Freezes a busy frame and times GPU-synced renders with one cost removed at a time.
// SwiftShader rasterises on the CPU: the ranking points at GPU work, the milliseconds are not a phone's.
// docker compose --profile e2e run --rm e2e node scripts/render-ablation.mjs [levelIndex…]
import { chromium, devices } from 'playwright';
const url = process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 375, height: 690 }, deviceScaleFactor: 3 });
const page = await context.newPage();
await page.goto(url);
await page.waitForFunction(() => Boolean(window.tumbleworks?.app?.runtime), undefined, { timeout: 90000 });
await page.evaluate(() => { window.tumbleworks.app.manualClock = true; });
const VARIANTS = (process.env.VARIANTS ?? 'base,noShadows,shadowFrozen,noClearcoatToy,noClearcoat,lowPolyMarbles,noTransparent,pr1,pr2,base').split(',');
for (const index of process.argv.slice(2).map(Number)) {
  await page.evaluate((i) => {
    const { app } = window.tumbleworks;
    app['loadBoard'](i);
    const ids = Object.keys(app.runtime.targets()).filter((k) => /^(supply|lane)\d+$/.test(k));
    for (let round = 0; round < 3; round++) {
      for (const id of ids.slice(0, 3)) { app['activate'](id); for (let t = 0; t < 25; t++) app.advance(1 / 60, false); }
    }
    for (let t = 0; t < 120; t++) app.advance(1 / 60, false);
    app.advance(1 / 60, true);
  }, index);
  const results = {};
  for (const variant of VARIANTS) {
    results[variant] = await page.evaluate(async (variant) => {
      const { app } = window.tumbleworks;
      const r = app.stage.renderer;
      const view = app.runtime.view;
      const scene = view.scene, camera = view.camera;
      const gl = r.getContext();
      const undo = [];
      const each = (fn) => scene.traverse((o) => { if (o.isMesh) for (const m of [o.material].flat()) fn(o, m); });
      const set = (obj, key, value) => { const old = obj[key]; undo.push(() => { obj[key] = old; if (obj.isMaterial) obj.needsUpdate = true; }); obj[key] = value; if (obj.isMaterial) obj.needsUpdate = true; };
      r.setPixelRatio(1.5); r.setSize(app.stage.canvas.clientWidth, app.stage.canvas.clientHeight, false);
      if (variant === 'noShadows') { set(r.shadowMap, 'enabled', false); each((o, m) => { m.needsUpdate = true; }); undo.push(() => each((o, m) => { m.needsUpdate = true; })); }
      if (variant === 'shadowFrozen') { r.render(scene, camera); set(r.shadowMap, 'autoUpdate', false); }
      if (variant === 'noClearcoat') each((o, m) => { if (m.isMeshPhysicalMaterial && m.clearcoat > 0) set(m, 'clearcoat', 0); });
      if (variant === 'noClearcoatToy') each((o, m) => { if (m.isMeshPhysicalMaterial && m.clearcoat > 0 && !o.isInstancedMesh) set(m, 'clearcoat', 0); });
      if (variant === 'lowPolyMarbles') each((o) => { if (o.isInstancedMesh && o.geometry.type === 'SphereGeometry') { const p = o.geometry.parameters; set(o, 'geometry', new o.geometry.constructor(p.radius, 12, 8)); } });
      if (variant === 'floorReceivesOnly') each((o) => { if (o.receiveShadow && /RoundedBox|Sphere|Cylinder|Torus/.test(o.geometry.type)) set(o, 'receiveShadow', false); });
      if (variant === 'basicShadow') { set(r.shadowMap, 'type', 0); each((o, m) => { m.needsUpdate = true; }); scene.traverse((o) => { if (o.isLight && o.shadow?.map) { o.shadow.map.dispose(); o.shadow.map = null; } }); undo.push(() => scene.traverse((o) => { if (o.isLight && o.shadow?.map) { o.shadow.map.dispose(); o.shadow.map = null; } })); }
      if (variant === 'shadow512') scene.traverse((o) => { if (o.isLight && o.castShadow) { o.shadow.mapSize.set(512, 512); o.shadow.map?.dispose(); o.shadow.map = null; undo.push(() => { o.shadow.mapSize.set(1024, 1024); o.shadow.map?.dispose(); o.shadow.map = null; }); } });
      if (variant === 'singlePassGlass') each((o, m) => { if (m.transparent && m.side === 2 && !m.forceSinglePass) set(m, 'forceSinglePass', true); });
      if (variant === 'noTransparent') each((o, m) => { if (m.transparent && o.visible) set(o, 'visible', false); });
      if (variant === 'pr1' || variant === 'pr2' || variant === 'pr125') { r.setPixelRatio(variant === 'pr1' ? 1 : variant === 'pr125' ? 1.25 : 2); r.setSize(app.stage.canvas.clientWidth, app.stage.canvas.clientHeight, false); }
      const pixel = new Uint8Array(4);
      const once = () => { const t = performance.now(); r.render(scene, camera); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel); return performance.now() - t; };
      for (let i = 0; i < 4; i++) once();
      const times = []; for (let i = 0; i < 25; i++) times.push(once());
      const calls = r.info.render.calls, tris = r.info.render.triangles;
      for (const f of undo.reverse()) f();
      r.setPixelRatio(1.5); r.setSize(app.stage.canvas.clientWidth, app.stage.canvas.clientHeight, false);
      times.sort((a, b) => a - b);
      return { ms: +times[12].toFixed(1), calls, tris };
    }, variant);
  }
  const base = results.base.ms;
  console.log(`level ${index} ${await page.evaluate(() => window.tumbleworks.app.debugState().levelId)}`);
  for (const [k, v] of Object.entries(results)) console.log(`  ${k.padEnd(16)} ${String(v.ms).padStart(6)} ms  ${((v.ms / base - 1) * 100).toFixed(0).padStart(4)}%  calls ${v.calls}  tris ${v.tris}`);
}
await browser.close();
