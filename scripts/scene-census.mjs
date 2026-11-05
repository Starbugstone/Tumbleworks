// Groups a level's meshes by geometry and material, with triangle, shadow and update counts.
import { chromium, devices } from 'playwright';
const url = process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 375, height: 690 } })).newPage();
await page.goto(url);
await page.waitForFunction(() => Boolean(window.tumbleworks?.app?.runtime), undefined, { timeout: 90000 });
await page.evaluate(() => { window.tumbleworks.app.manualClock = true; });
for (const index of process.argv.slice(2).map(Number)) {
  const out = await page.evaluate((i) => {
    const { app } = window.tumbleworks;
    app['loadBoard'](i);
    const before = app.stage.renderer.info.programs.length;
    const ids = Object.keys(app.runtime.targets()).filter((k) => /^(supply|lane)\d+$/.test(k));
    for (const id of ids.slice(0, 3)) { app['activate'](id); for (let t = 0; t < 60; t++) app.advance(1 / 60, true); }
    const scene = app.runtime.view.scene;
    const groups = new Map();
    let objects = 0, autoUpdate = 0, textures = new Set();
    scene.traverse((o) => {
      objects++; if (o.matrixAutoUpdate) autoUpdate++;
      if (!o.isMesh) return;
      for (const m of [o.material].flat()) for (const k of ['map', 'alphaMap', 'emissiveMap']) if (m[k]) textures.add(m[k].uuid);
      const m = [o.material].flat()[0];
      const tris = Math.round((o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3);
      const key = `${o.isInstancedMesh ? 'Inst ' : ''}${o.geometry.type} ${m.type}${m.clearcoat ? '+cc' : ''}${m.transparent ? ' transp' : ''}${m.side === 2 ? ' 2side' : ''}${m.visible === false ? ' invisible' : ''}`;
      const g = groups.get(key) ?? { n: 0, visible: 0, tris: 0, casters: 0, receivers: 0, materials: new Set() };
      g.n++; let vis = true; for (let p = o; p; p = p.parent) if (!p.visible) vis = false;
      if (vis) { g.visible++; g.tris += tris * (o.isInstancedMesh ? o.count : 1); }
      if (o.castShadow) g.casters++; if (o.receiveShadow) g.receivers++; g.materials.add(m.uuid);
      groups.set(key, g);
    });
    return { id: app.debugState().levelId, objects, autoUpdate, textures: textures.size, programsAtLoad: before, programsAfterPlay: app.stage.renderer.info.programs.length,
      rows: [...groups].map(([k, g]) => ({ k, ...g, materials: g.materials.size })).sort((a, b) => b.tris - a.tris) };
  }, index);
  console.log(`\n${out.id}: objects ${out.objects} (autoUpdate ${out.autoUpdate}), textures ${out.textures}, programs at load ${out.programsAtLoad} → after play ${out.programsAfterPlay}`);
  for (const r of out.rows) console.log(`  ${String(r.n).padStart(3)} (${String(r.visible).padStart(3)} vis) ${String(r.tris).padStart(7)} tris  cast ${String(r.casters).padStart(3)} recv ${String(r.receivers).padStart(3)} mats ${String(r.materials).padStart(3)}  ${r.k}`);
}
await browser.close();
