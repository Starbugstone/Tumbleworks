import { expect, test } from '@playwright/test';
import type { App } from '../../src/view/App';

type WinWindow = Window & {
  tumbleworks: { app: App };
  winAge: number;
  ageAtFooter?: number;
};

test('the win sequence and footer keep time through three missed frame intervals', async ({ page }) => {
  await page.clock.install({ time: new Date('2000-01-01') });
  await page.goto('/?demo=loop-1');
  await page.waitForFunction(() => document.getElementById('boot')?.hidden && document.getElementById('journey-transition')?.hidden);
  await page.evaluate(() => { (window as unknown as WinWindow).tumbleworks.app.manualClock = true; });
  for (const lane of [0, 1]) {
    const at = await page.evaluate(i => (window as unknown as WinWindow).tumbleworks.app.debugTargets()[`lane${i}`]!, lane);
    await page.touchscreen.tap(at.x, at.y);
  }
  await page.clock.pauseAt(new Date('2000-01-02'));
  await page.evaluate(() => {
    const probe = window as unknown as WinWindow, app = probe.tumbleworks.app, runtime = app.runtime;
    probe.winAge = 0;
    const advance = runtime.advanceCelebration!.bind(runtime), finish = runtime.finishCelebration!.bind(runtime);
    runtime.advanceCelebration = dt => { probe.winAge += dt; advance(dt); };
    runtime.finishCelebration = () => { probe.ageAtFooter = probe.winAge; finish(); };
    for (let frame = 0; frame < 1800 && (runtime.status === 'playing' || runtime.busy); frame++) app.advance(1 / 60, false);
    if (runtime.status !== 'won' || runtime.busy) throw new Error('Loop did not settle');
    app.manualClock = false;
  });
  let elapsed = 0;
  for (const gap of [400, 440, 350]) {
    elapsed += gap;
    // fastForward delivers at most one missed RAF, like a blocked UI thread.
    await page.clock.fastForward(gap);
    const age = await page.evaluate(() => (window as unknown as WinWindow).winAge);
    expect(Math.abs(age * 1000 - elapsed), `wave after ${elapsed} ms: ${age} s`).toBeLessThan(18);
    await expect(page.locator('#card')).toBeHidden();
  }
  await page.clock.fastForward(60);
  await expect(page.locator('#card')).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as WinWindow).ageAtFooter)).toBeCloseTo(1.25, 6);
});
