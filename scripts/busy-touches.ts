import type { Page } from '@playwright/test';
import type { ReplayAction } from '../src/engine/replay';

/** Exercise live legal pours through touch, visiting each ready lane before returning to it. */
export async function busyTouches(page: Page, seconds: number) {
  type GameWindow = { tumbleworks: { app: {
    runtime: { game: { actions: readonly ReplayAction[]; rules: { actions(): number[]; occupancy: number; pending?: number; funnelCount?: number } } };
    debugTargets(): Record<string, { x: number; y: number }>;
  } } };
  let previous = -1;
  let attempts = 0;
  let peakLoad = 0;
  const start = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.runtime.game.actions.length);
  const end = Date.now() + seconds * 1000;
  while (Date.now() < end) {
    const next = await page.evaluate((last) => {
      const { app } = (window as unknown as GameWindow).tumbleworks;
      const { rules } = app.runtime.game;
      const actions = rules.actions();
      const action = actions.find((id) => id > last) ?? actions[0];
      const targets = app.debugTargets();
      return {
        action,
        point: action === undefined ? null : targets[`supply${action}`] ?? targets[`lane${action}`],
        load: rules.occupancy + (rules.pending ?? rules.funnelCount ?? 0),
      };
    }, previous);
    peakLoad = Math.max(peakLoad, next.load);
    if (next.point && next.action !== undefined) {
      await page.touchscreen.tap(next.point.x, next.point.y);
      previous = next.action;
      attempts++;
    }
    // Sequential input: no overlapping timer callbacks, and a browser error fails the run.
    await page.waitForTimeout(700);
  }
  const accepted = await page.evaluate((offset) => (window as unknown as GameWindow).tumbleworks.app.runtime.game.actions.slice(offset), start);
  const pours = accepted.filter((action) => action.type === 'tap');
  return { attempts, accepted: pours.length, lanes: [...new Set(pours.map((action) => action.at))], peakLoad };
}
