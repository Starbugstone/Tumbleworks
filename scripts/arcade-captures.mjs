import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const output = 'output/current/arcade';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [], reports = [];
for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 700 }, { width: 1365, height: 900 }]) {
  const page = await browser.newPage({ viewport, hasTouch: true, deviceScaleFactor: 1 });
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180');
  await page.waitForFunction(() => window.tumbleworks?.app?.runtime);
  await page.evaluate(() => { window.tumbleworks.app.manualClock = true; });
  for (const index of [1, 12, 0]) {
    await page.locator('#levels-toggle').click();
    await page.locator(`.chip[data-level="${index}"]`).click();
    await page.evaluate(() => window.tumbleworks.app.advance(0));
    await page.screenshot({ timeout: 60000, path: `${output}/${viewport.width}-level-${index}.png` });
    if (viewport.width === 390) {
      await page.locator('#scene').evaluate(el => { el.style.filter = 'grayscale(1)'; });
      await page.screenshot({ timeout: 60000, path: `${output}/gray-${index}.png` });
      await page.locator('#scene').evaluate(el => { el.style.filter = ''; });
    }
    if (index === 0) {
      // Overlapping blue/red pours trigger real box completions.
      for (let i = 0; i < 2; i++) {
        const at = await page.evaluate(() => window.tumbleworks.app.debugTargets().supply0);
        await page.touchscreen.tap(at.x, at.y);
      }
    }
    const result = await page.evaluate(async index => {
      const { Box3, Vector3 } = await import('/node_modules/.vite/deps/three.js');
      const app = window.tumbleworks.app;
      const runtime = app.runtime, view = runtime.view;
      const { LOOP_WITNESSES } = await import('/tests/witnesses.ts');
      const taps = [...(LOOP_WITNESSES[index === 12 ? 'loop-5' : 'loop-1'] ?? '')];
      let next = 0;
      let detected = false;
      const bounds = [];
      for (let i = 0; i < 12000; i++) {
        app.advance(1 / 60, false);
        const trucks = index === 0 ? [] : runtime.machine.readTrucks().filter(truck => truck.departing);
        if (trucks.length && i % 5 === 0) {
          app.advance(0);
          for (const truck of trucks) {
            const group = view.trucks.get(`${truck.lane}:${truck.index}`).group;
            group.updateMatrixWorld(true);
            const box = new Box3().setFromObject(group);
            const corners = [];
            for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
              const p = new Vector3(x, y, z).project(view.camera);
              corners.push({ x: (p.x + 1) * innerWidth / 2, y: (1 - p.y) * innerHeight / 2 });
            }
            bounds.push({ lane: truck.lane, scale: truck.scale, corners });
          }
          detected = true;
          if (trucks.some(truck => truck.scale < 0.75)) break;
        }
        if (index !== 0 && i % 10 === 0 && !trucks.length && runtime.machine.rules.pending === 0 && !runtime.machine.rules.canDrain() && taps[next]) {
          runtime.activate(`lane${taps[next++].charCodeAt(0) - 65}`);
        }
        if (index === 0 && view.pops.stamps.some(stamp => stamp.age > 0.2 && stamp.age < 0.5)) { detected = true; app.advance(0); break; }
      }
      if (!detected) throw new Error(`No completion animation found on ${index}: ${JSON.stringify(app.debugState())}`);
      return bounds;
    }, index);
    for (const { corners } of result) for (const p of corners) {
      if (p.x < 10 || p.x > viewport.width - 10 || p.y < 52 || p.y > viewport.height - 85) throw new Error(`Departure clipped at ${JSON.stringify({ viewport, index, p })}`);
    }
    await page.screenshot({ timeout: 60000, path: `${output}/${viewport.width}-action-${index}.png` });
    if (index !== 0) {
      // Follow the rest of every departure; bounds must also hold near the exit.
      const tail = await page.evaluate(async () => {
        const { Box3, Vector3 } = await import('/node_modules/.vite/deps/three.js');
        const app = window.tumbleworks.app, view = app.runtime.view;
        let count = 0;
        for (let tick = 0; tick < 70; tick++) {
          app.advance(1 / 60, false);
          if (tick % 10 !== 0) continue;
          app.advance(0);
          for (const truck of app.runtime.machine.readTrucks().filter(truck => truck.departing)) {
            const group = view.trucks.get(`${truck.lane}:${truck.index}`).group;
            group.updateMatrixWorld(true);
            const box = new Box3().setFromObject(group);
            for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
              const p = new Vector3(x, y, z).project(view.camera);
              if (Math.abs(p.x) > 0.95 || Math.abs(p.y) > 0.88) throw new Error('Late departure clipped');
            }
            count++;
          }
        }
        return count;
      });
      reports.push({ viewport, index, checkedTruckPoses: result.length + tail });
      await page.screenshot({ timeout: 60000, path: `${output}/${viewport.width}-after-${index}.png` });
    }
  }
  await page.close();
}
await browser.close();
writeFileSync(`${output}/checks.json`, JSON.stringify({ reports, errors }, null, 2));
if (errors.length) throw new Error(errors.join('\n'));
console.log(JSON.stringify({ reports, errors }));
