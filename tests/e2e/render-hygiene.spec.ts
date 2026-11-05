import { expect, test, type Page } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';
import type { App } from '../../src/view/App';

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

// Frozen busy states from the alpha rendering baseline, independent of host timing noise.
for (const sample of [
  { id: 'board-57', prefix: 'supply', pours: [0, 1, 2, 3, 0, 1], fingerprint: 'd46abc05', calls: 118 },
  { id: 'loop-70', prefix: 'lane', pours: [0, 1, 2, 3], fingerprint: '5bfa6650', calls: 129 },
]) {
  test(`${sample.id}: a busy scene keeps its recorded draw-call budget`, async ({ page }) => {
    await open(page, CAMPAIGN.findIndex((level) => level.id === sample.id));
    const result = await page.evaluate(({ prefix, pours }) => {
      const { app } = (window as unknown as { tumbleworks: { app: App } }).tumbleworks;
      for (let tick = 0; tick < 240; tick++) {
        const lane = tick % 40 === 0 ? pours[tick / 40] : undefined;
        if (lane !== undefined) app['activate'](`${prefix}${lane}`);
        app.advance(1 / 60, false);
      }
      app.runtime.render(0.5, 0);
      return { fingerprint: app.replay().fingerprint, calls: app.stage.renderer.info.render.calls };
    }, sample);
    expect(result.fingerprint, 'the measured busy state must match its baseline').toBe(sample.fingerprint);
    expect(result.calls).toBeGreaterThan(0);
    expect(result.calls, 'extra draws need measurement and a recorded baseline').toBeLessThanOrEqual(sample.calls);
  });
}

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
      const restore: (() => void)[] = [];
      const observed = new Set<string>();
      renderer.renderBufferDirect = (...args: unknown[]) => {
        const material = args[3] as Material;
        const properties = renderer.properties.get(material);
        if (!observed.has(material.uuid)) {
          observed.add(material.uuid);
          let instancing = properties['instancing'];
          const key = `${material.type} ${material.uuid}`;
          Object.defineProperty(properties, 'instancing', {
            configurable: true,
            get: () => instancing,
            set: (value: unknown) => { instancing = value; lookups.set(key, (lookups.get(key) ?? 0) + 1); },
          });
          restore.push(() => Object.defineProperty(properties, 'instancing', { configurable: true, writable: true, enumerable: true, value: instancing }));
        }
        draw(...args);
      };
      for (let frame = 0; frame < 12; frame++) app.advance(1 / 60, true);
      renderer.renderBufferDirect = draw;
      for (const reset of restore) reset();
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
