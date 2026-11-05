import { expect, test, type Page } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';

/**
 * Work the renderer must not repeat on every frame. Each check failed before the rendering pass that added
 * it: double-sided glass rebuilt shader parameters twice a frame, completion effects compiled their shaders
 * at the first completion, and a resting Tube Sort board was drawn sixty times a second.
 */
const last = (kind: string): number => CAMPAIGN.reduce((found, level, index) => (level.kind === kind ? index : found), -1);
const LEVELS = [
  { kind: 'conveyor', index: last('conveyor') },
  { kind: 'loop', index: last('loop') },
  { kind: 'tube', index: last('tube') },
];

async function open(page: Page, index: number): Promise<void> {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as never as { tumbleworks?: unknown }).tumbleworks), undefined, { timeout: 60_000 });
  await page.evaluate((level) => {
    const { app } = (window as never as { tumbleworks: { app: { manualClock: boolean; loadBoard(i: number): void } } }).tumbleworks;
    app.manualClock = true;
    app.loadBoard(level);
  }, index);
}

for (const level of LEVELS) {
  test(`${level.kind} (${level.index}): every shader is ready at load and none is looked up again each frame`, async ({ page }) => {
    test.setTimeout(180_000);
    await open(page, level.index);
    const result = await page.evaluate(() => {
      type Material = { uuid: string; type: string; version: number };
      type Renderer = {
        properties: { get(material: Material): Record<string, unknown> };
        renderBufferDirect(...args: unknown[]): void;
      };
      type Object3D = { isMesh?: boolean; isSprite?: boolean; material?: Material | Material[]; traverse(fn: (o: Object3D) => void): void };
      const { app } = (window as never as { tumbleworks: { app: {
        stage: { renderer: Renderer };
        runtime: { view: { scene: Object3D }; targets(): Record<string, unknown> };
        advance(seconds: number, draw?: boolean): boolean;
        activate(target: string): void;
      } } }).tumbleworks;
      const renderer = app.stage.renderer;
      // Hidden effects included: a level's first completion must not wait on a compile.
      const missing: string[] = [];
      app.runtime.view.scene.traverse((object) => {
        if (!object.isMesh && !object.isSprite) return;
        for (const material of [object.material ?? []].flat()) {
          if (!renderer.properties.get(material)['currentProgram']) missing.push(material.type);
        }
      });
      const ids = Object.keys(app.runtime.targets()).filter((key) => /^(supply|lane|tube)\d+$/.test(key));
      for (const id of ids.slice(0, 2)) { app.activate(id); for (let t = 0; t < 20; t++) app.advance(1 / 60, false); }
      // A shader lookup leaves its mark on the material's renderer properties; count whose frames repeat one.
      const lookups = new Map<string, number>();
      const draw = renderer.renderBufferDirect.bind(renderer);
      renderer.renderBufferDirect = (...args: unknown[]) => {
        const material = args[3] as Material;
        const properties = renderer.properties.get(material);
        const before = properties['instancing'];
        properties['instancing'] = 'probe';
        draw(...args);
        if (properties['instancing'] === 'probe') properties['instancing'] = before;
        else lookups.set(`${material.type} ${material.uuid}`, (lookups.get(`${material.type} ${material.uuid}`) ?? 0) + 1);
      };
      for (let frame = 0; frame < 12; frame++) app.advance(1 / 60, true);
      renderer.renderBufferDirect = draw;
      return { missing, repeated: [...lookups].filter(([, count]) => count > 1).map(([key, count]) => `${key} ×${count}`) };
    });
    expect(result.missing, 'materials drawn without a compiled shader at load').toEqual([]);
    expect(result.repeated, 'materials whose shader is looked up again frame after frame').toEqual([]);
  });
}

test('a resting Tube Sort board is not redrawn until something moves', async ({ page }) => {
  test.setTimeout(120_000);
  await open(page, last('tube'));
  const draws = await page.evaluate(() => {
    const { app } = (window as never as { tumbleworks: { app: {
      stage: { renderer: { render(...args: unknown[]): void } };
      advance(seconds: number, draw?: boolean): boolean;
      activate(target: string): void;
    } } }).tumbleworks;
    const renderer = app.stage.renderer;
    const render = renderer.render.bind(renderer);
    let count = 0;
    renderer.render = (...args: unknown[]) => { count++; render(...args); };
    const run = (frames: number): number => { count = 0; for (let i = 0; i < frames; i++) app.advance(1 / 60, true); return count; };
    run(30);
    const resting = run(30);
    app.activate('tube0');
    const selected = run(1);
    run(120);
    const settled = run(30);
    renderer.render = render;
    return { resting, selected, settled };
  });
  expect(draws.resting, 'draws while nothing moves').toBe(0);
  expect(draws.selected, 'a tap is drawn on the next frame').toBe(1);
  expect(draws.settled, 'drawing stops again once the board settles').toBe(0);
});
