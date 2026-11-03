import { writeFileSync } from 'node:fs';
import { expect, test } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';
import type { ReplayLog } from '../../src/engine/replay';
import { initPhysics } from '../../src/machine/machine';
import { replayed } from '../replay-target';

const LEVEL = 'board-39';

test('a game played by touch and copied from the picker replays to the same physics', async ({ page }) => {
  test.setTimeout(180_000);
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as never as { tumbleworks?: unknown }).tumbleworks), undefined, { timeout: 60_000 });
  await page.locator('#levels-toggle').click();
  await page.locator(`.chip[data-level="${CAMPAIGN.findIndex((level) => level.id === LEVEL)}"]`).click();

  const target = () => page.evaluate(() => {
    const { app } = (window as never as { tumbleworks: { app: { debugTargets(): Record<string, { x: number; y: number }> } } }).tumbleworks;
    return Object.entries(app.debugTargets()).find(([id]) => /^supply\d+$/.test(id))?.[1];
  });
  const pour = async () => {
    const crate = await target();
    if (!crate) throw new Error('No crate to pour');
    await page.touchscreen.tap(crate.x, crate.y);
  };
  await pour();
  await page.waitForTimeout(400);
  await pour();
  await page.waitForTimeout(250);
  await page.locator('#undo').click();
  await page.waitForTimeout(300);
  await pour();
  // Long enough for marbles to reach the shaken dish and the belt: engine differences only show there.
  await page.waitForFunction(() => (window as never as { tumbleworks: { app: { runtime: { game: { steps: number } } } } }).tumbleworks.app.runtime.game.steps > 500, undefined, { timeout: 120_000 });

  const copied = new Promise<string>((resolve) => {
    page.once('dialog', (dialog) => { resolve(dialog.defaultValue()); void dialog.dismiss(); });
  });
  await page.locator('#levels-toggle').click();
  await page.locator('#copy-replay').click();
  const log = JSON.parse(await copied) as ReplayLog;

  expect(log.level).toBe(LEVEL);
  expect(log.actions.map((action) => action.type)).toEqual(['tap', 'tap', 'undo', 'tap']);
  await initPhysics();
  const fingerprint = replayed(log).fingerprint();
  // A divergence is a real bug in the game, and this log is its reproduction.
  if (fingerprint !== log.fingerprint) writeFileSync(`output/current/diverged-${log.fingerprint}.json`, JSON.stringify(log));
  expect(fingerprint).toBe(log.fingerprint);
});
