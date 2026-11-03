import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import type { App } from '../../src/view/App';
import type { ReplayLog } from '../../src/engine/replay';
import { replayed } from '../replay-target';

type GameWindow = Window & { tumbleworks: { app: App } };
const state = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
async function point(page: Page, index: number) {
  const at = await page.evaluate((i) => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[`tube${i}`], index);
  if (!at) throw new Error(`Missing tube ${index}`);
  expect(at.x).toBeGreaterThan(0); expect(at.x).toBeLessThan(page.viewportSize()!.width);
  expect(at.y).toBeGreaterThan(48); expect(at.y).toBeLessThan(page.viewportSize()!.height - 90);
  return at;
}
async function tap(page: Page, i: number) { const at = await point(page, i); await page.touchscreen.tap(at.x, at.y); }
async function move(page: Page, from: number, to: number) { await tap(page, from); await tap(page, to); }
async function advance(page: Page) { await page.evaluate(() => {
  const app = (window as unknown as GameWindow).tumbleworks.app;
  for (let tick = 0; tick < 60; tick++) app.advance(1 / 60, false);
  app.advance(0);
}); }
async function ready(page: Page, id: number) {
  await page.goto(`/?try=tube-${id}`);
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
}
const out = 'output/current/tube-rules';

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 690 });
  await page.addInitScript(() => localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed: [], current: null, muted: true })));
  mkdirSync(out, { recursive: true });
});

test('cap rejects taps, opens during a move, accepts a rapid pour and undoes its latch', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await ready(page, 200);
  await page.screenshot({ path: `${out}/cap-phone.png` });
  await tap(page, 4);
  await expect(page.locator('#message')).toContainText('cap');
  expect(await state(page)).toMatchObject({ moves: 0, opened: [false, false, false, false, false] });
  const source = await point(page, 0); const capped = await point(page, 4);
  await page.mouse.move(source.x, source.y); await page.mouse.down();
  await page.mouse.move(capped.x, capped.y, { steps: 8 }); await page.mouse.up();
  expect(await state(page)).toMatchObject({ moves: 0 });
  await expect(page.locator('#message')).toContainText('cap');
  await page.locator('#levels-toggle').click(); await page.locator('#language-fr').click(); await page.locator('#levels-toggle').click();
  await tap(page, 4); await expect(page.locator('#message')).toContainText('couvercle');
  await move(page, 1, 3); await move(page, 0, 1); await move(page, 0, 3);
  const before = await state(page);
  await move(page, 2, 1);
  expect(await state(page)).toMatchObject({ moves: 4, opened: [false, false, false, false, true] });
  await page.locator('#undo').click();
  expect(await state(page)).toMatchObject({ moves: before.moves, opened: [false, false, false, false, false] });
  await move(page, 2, 1);
  await move(page, 1, 4); // no animation settle: the cap is already legal
  expect(await state(page)).toMatchObject({ moves: 5, opened: [false, false, false, false, true] });
  await advance(page);
  await page.screenshot({ path: `${out}/cap-open-phone.png` });
  await move(page, 0, 2); await advance(page);
  expect(await state(page)).toMatchObject({ status: 'won', moves: 6 });
  const log = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.replay());
  expect(replayed(log as ReplayLog).fingerprint()).toBe(log.fingerprint);
  writeFileSync(`${out}/cap-replay.json`, JSON.stringify(log));
  expect(errors).toEqual([]);
});

test('cup handles drags, cancellation, closure, blocked feedback, undo and a touch win', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', e => errors.push(e.message));
  await ready(page, 201);
  await page.screenshot({ path: `${out}/cup-phone.png` });
  const a = await point(page, 0); const b = await point(page, 4);
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 });
  await page.evaluate(() => document.querySelector('canvas')!.dispatchEvent(new PointerEvent('pointercancel', { pointerId: 1, bubbles: true })));
  await page.mouse.up();
  expect(await state(page)).toMatchObject({ moves: 0, spent: [false, false, false, false, false] });
  await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 8 }); await page.mouse.up();
  expect(await state(page)).toMatchObject({ moves: 1 });
  await move(page, 0, 3); await move(page, 1, 3); await move(page, 2, 1);
  await move(page, 4, 1);
  expect(await state(page)).toMatchObject({ moves: 5, spent: [false, false, false, false, true] });
  await advance(page); await page.screenshot({ path: `${out}/cup-folded-phone.png` });
  await tap(page, 4); await expect(page.locator('#message')).toContainText('folded');
  expect(await state(page)).toMatchObject({ moves: 5 });
  await page.locator('#undo').click();
  expect(await state(page)).toMatchObject({ moves: 4, spent: [false, false, false, false, false] });
  await move(page, 4, 1); await move(page, 0, 2); await advance(page);
  expect(await state(page)).toMatchObject({ status: 'won' });
  const log = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.replay());
  expect(replayed(log as ReplayLog).fingerprint()).toBe(log.fingerprint);
  writeFileSync(`${out}/cup-replay.json`, JSON.stringify(log));
  expect(errors).toEqual([]);
});

test('lessons stay readable in grayscale and on the existing desktop layout', async ({ page }) => {
  for (const id of [200, 201]) {
    await ready(page, id);
    await page.addStyleTag({ content: 'canvas { filter: grayscale(1); }' });
    await page.screenshot({ path: `${out}/tube-${id}-gray.png` });
    await page.setViewportSize({ width: 1280, height: 800 });
    await advance(page);
    for (let i = 0; i < 5; i++) await point(page, i);
    await page.screenshot({ path: `${out}/tube-${id}-desktop.png` });
    await page.setViewportSize({ width: 375, height: 690 });
  }
});
