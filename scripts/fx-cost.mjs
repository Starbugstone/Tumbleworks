// Frozen busy frame, GPU-synced: draw time with the finishing pass against a plain draw. SwiftShader numbers are host diagnostics.
// docker compose --profile e2e run --rm e2e node scripts/fx-cost.mjs <levelIndex…>
import { chromium, devices } from 'playwright';
const url = (process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180') + '/?fx=1';
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const context = await browser.newContext({ ...devices['Pixel 7'], viewport: { width: 375, height: 690 }, deviceScaleFactor: 3 });
const page = await context.newPage();
await page.goto(url);
await page.waitForFunction(() => Boolean(window.tumbleworks?.app?.runtime), undefined, { timeout: 90000 });
await page.evaluate(() => { window.tumbleworks.app.manualClock = true; });
for (const index of process.argv.slice(2).map(Number)) {
  const result = await page.evaluate(async (i) => {
    const { app } = window.tumbleworks;
    app['loadBoard'](i);
    const ids = Object.keys(app.runtime.targets()).filter((k) => /^(supply|lane)\d+$/.test(k));
    for (let round = 0; round < 3; round++) for (const id of ids.slice(0, 3)) { app['activate'](id); for (let t = 0; t < 25; t++) app.advance(1 / 60, false); }
    for (let t = 0; t < 120; t++) app.advance(1 / 60, false);
    app.advance(1 / 60, true);
    const r = app.stage.renderer, gl = r.getContext(), view = app.runtime.view, px = new Uint8Array(4);
    const time = (draw) => { const out = []; for (let n = 0; n < 12; n++) { const t = performance.now(); draw(); gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); out.push(performance.now() - t); } out.sort((a, b) => a - b); return out[6]; };
    const withFx = time(() => app.stage.draw(view.scene, view.camera));
    const plain = time(() => r.render(view.scene, view.camera));
    return { effects: app.stage.effects, ratio: r.getPixelRatio(), withFx: +withFx.toFixed(1), plain: +plain.toFixed(1), extraPercent: Math.round((withFx / plain - 1) * 100) };
  }, index);
  console.log(index, JSON.stringify(result));
}
await browser.close();
