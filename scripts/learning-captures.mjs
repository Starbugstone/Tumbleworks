import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
const output = 'output/current/learning';
mkdirSync(output, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const errors = [], resources = [], markers = [];
for (const [name, viewport, locale] of [
  ['phone-en', { width: 390, height: 844 }, 'en-GB'], ['narrow-fr', { width: 320, height: 700 }, 'fr-FR'], ['desktop', { width: 1365, height: 900 }, 'en-GB'],
]) {
  const page = await browser.newPage({ viewport, locale, hasTouch: true, deviceScaleFactor: 1 });
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(process.env.TUMBLEWORKS_URL ?? 'http://game-server:5180');
  await page.waitForFunction(() => window.tumbleworks?.app?.runtime);
  await page.evaluate(() => { window.tumbleworks.app.manualClock = true; });
  const select = async index => {
    await page.locator('#levels-toggle').click();
    await page.locator(`.chip[data-level="${index}"]`).click();
    await page.evaluate(() => window.tumbleworks.app.advance(0));
  };
  for (const index of [0, 1, 2, 13, 14, 15, 16]) {
    await select(index);
    if (index === 14 || index === 16) {
      const visible = await page.evaluate(async () => {
        const { Vector3, Raycaster } = await import('/node_modules/.vite/deps/three.js');
        const app = window.tumbleworks.app, view = app.runtime.view;
        view.scene.updateMatrixWorld(true);
        const camera = view.camera.getWorldPosition(new Vector3());
        let checked = 0;
        for (const truck of app.runtime.machine.readTrucks().filter(truck => truck.visible)) {
          const marker = view.trucks.get(`${truck.lane}:${truck.index}`).group.getObjectByName('final-colour-marker');
          for (const x of [-0.2, 0, 0.2]) for (const y of [-0.2, 0, 0.2]) {
            const at = marker.localToWorld(new Vector3(x, y, 0));
            const ray = new Raycaster(camera, at.clone().sub(camera).normalize(), 0, camera.distanceTo(at) - 0.01);
            ray.camera = view.camera;
            const blockers = ray.intersectObjects(view.scene.children, true).filter(hit => {
              if (hit.object === marker || !hit.object.material) return false;
              for (let node = hit.object; node; node = node.parent) if (!node.visible) return false;
              const materials = Array.isArray(hit.object.material) ? hit.object.material : [hit.object.material];
              return materials.some(material => material.visible && material.opacity > 0.5);
            });
            if (blockers.length) throw new Error(`Cab marker hidden on lane ${truck.lane}: ${blockers[0].object.type}`);
            checked++;
          }
        }
        return checked;
      });
      markers.push({ name, index, checked: visible });
    }
    await page.screenshot({ path: `${output}/${name}-${index}.png` });
    if (index < 3) {
      const at = await page.evaluate(i => window.tumbleworks.app.debugTargets()[i === 0 ? 'supply0' : i === 1 ? 'lane0' : 'tube0'], index);
      await page.touchscreen.tap(at.x, at.y);
      await page.screenshot({ path: `${output}/${name}-${index}-tap.png` });
    } else if (name !== 'desktop') {
      const at = await page.evaluate(i => window.tumbleworks.app.debugTargets()[i % 2 ? 'supply0' : 'lane0'], index);
      await page.touchscreen.tap(at.x, at.y);
      await page.evaluate(() => { for (let i = 0; i < 600; i++) window.tumbleworks.app.advance(1 / 60, i === 599); });
      await page.screenshot({ path: `${output}/${name}-${index}-crossing.png` });
    }
  }
  if (name === 'narrow-fr') {
    await page.locator('#levels-toggle').click();
    await page.screenshot({ path: `${output}/french-menu.png` });
    await page.locator('#levels-toggle').click();
    for (let cycle = 0; cycle < 3; cycle++) {
      for (const level of [0, 2, 16]) {
        await select(level);
        await page.locator('#levels-toggle').click();
        await page.locator(cycle % 2 ? '#language-fr' : '#language-en').click();
        await page.locator('#levels-toggle').click();
      }
      resources.push(await page.evaluate(() => ({ ...window.tumbleworks.app.stage.renderer.info.memory })));
    }
    await select(2);
    await page.locator('#levels-toggle').click();
    await page.locator('#language-fr').click();
    await page.locator('#levels-toggle').click();
    const solution = await page.evaluate(async () => (await import('/src/puzzles/levels.ts')).TUBE_BOARDS[0].solution);
    for (const move of solution) for (const index of [move.from, move.to]) {
      const at = await page.evaluate(index => window.tumbleworks.app.debugTargets()[`tube${index}`], index);
      await page.touchscreen.tap(at.x, at.y);
      await page.evaluate(() => { for (let i = 0; i < 45; i++) window.tumbleworks.app.advance(1 / 60, i === 44); });
    }
    await page.locator('#card').waitFor({ state: 'visible' });
    if (await page.locator('#card-title').textContent() !== 'Bien trié !') throw new Error('French completion title missing');
    const card = await page.locator('#card').boundingBox(), button = await page.locator('#card-action').boundingBox();
    if (button.x < card.x || button.x + button.width > card.x + card.width) throw new Error('French card action overflowed');
    await page.screenshot({ path: `${output}/french-complete.png` });
    await page.locator('#levels-toggle').click();
    await page.locator('#language-en').click();
    if (await page.locator('#card-title').textContent() !== 'Nicely sorted!') throw new Error('Open completion card did not change language');
  }
  await page.close();
}
await browser.close();
writeFileSync(`${output}/checks.json`, JSON.stringify({ errors, resources, markers }, null, 2));
if (errors.length) throw new Error(errors.join('\n'));
if (resources.some(value => value.geometries !== resources[0].geometries || value.textures !== resources[0].textures)) throw new Error('Resources grew across language and scene changes');
console.log(JSON.stringify({ errors, resources, markers }));
