import { expect, test } from '@playwright/test';

/**
 * Real clock and real rendering on the busiest levels, with a 4x CPU slowdown standing in for a mid-range
 * phone. Phones can't be driven from here, so this guards against our own code getting slower; it doesn't
 * measure a phone. SwiftShader draws on the CPU, so frame intervals mostly measure the software renderer:
 * they're printed for comparison, and the ceilings apply to one tick and one draw of the game's own work.
 * Baselines and the reasoning behind these ceilings are in docs/verification.md.
 */
/** Their place in the campaign's interleaving: three levels per round. */
const LEVELS = [
  { name: 'Funnel Sort, most marbles', id: 'board-28', index: 81 },
  { name: 'Funnel Sort, longest belt', id: 'board-30', index: 87 },
  { name: 'Loop Sort, fullest loop', id: 'loop-5', index: 13 },
  { name: 'Loop Sort, longest', id: 'loop-30', index: 88 },
];
const SECONDS = 20;
const TICK_MS = Number(process.env.TUMBLEWORKS_TICK_MS ?? 10);
const TICK_AND_DRAW_MS = Number(process.env.TUMBLEWORKS_FRAME_MS ?? 26);
const RATE = Number(process.env.TUMBLEWORKS_CPU_SLOWDOWN ?? 4);

interface Sample { ticks: number[]; draws: number[]; frames: number[]; state: Record<string, unknown> }

for (const level of LEVELS) {
  test(`${level.name} (${level.id}) stays inside its frame budget`, async ({ page }) => {
    test.setTimeout(180_000);
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as never as { tumbleworks?: unknown }).tumbleworks), undefined, { timeout: 60_000 });
    await page.locator('#levels-toggle').click();
    await page.locator(`.chip[data-level="${level.index}"]`).click();
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: RATE });

    // Pours every crate it can through real touches, so the toy is as busy as a hurried player makes it.
    const pour = setInterval(() => {
      void page.evaluate(() => (window as never as { tumbleworks: { app: { debugTargets(): Record<string, { x: number; y: number }> } } }).tumbleworks.app.debugTargets())
        .then((targets) => {
          const crate = Object.entries(targets).find(([id]) => /^(supply|lane)\d+$/.test(id))?.[1];
          return crate ? page.touchscreen.tap(crate.x, crate.y) : undefined;
        }).catch(() => undefined);
    }, 700);

    const sample = await page.evaluate(async (seconds): Promise<Sample> => {
      const { app } = (window as never as { tumbleworks: { app: { runtime: { step(): unknown; render(a: number, s: number): void }; debugState(): Record<string, unknown> } } }).tumbleworks;
      const ticks: number[] = [];
      const draws: number[] = [];
      const frames: number[] = [];
      const { runtime } = app;
      const step = runtime.step.bind(runtime);
      const render = runtime.render.bind(runtime);
      runtime.step = () => { const start = performance.now(); const events = step(); ticks.push(performance.now() - start); return events; };
      runtime.render = (alpha, time) => { const start = performance.now(); render(alpha, time); draws.push(performance.now() - start); };
      await new Promise<void>((resolve) => {
        let last = performance.now();
        const end = last + seconds * 1000;
        const tick = (now: number) => {
          frames.push(now - last);
          last = now;
          if (now < end) requestAnimationFrame(tick); else resolve();
        };
        requestAnimationFrame(tick);
      });
      return { ticks, draws, frames, state: app.debugState() };
    }, SECONDS);
    clearInterval(pour);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });

    const p = (values: number[], at: number) => [...values].sort((a, b) => a - b)[Math.floor(values.length * at)] ?? 0;
    const report = { level: level.id, cpu: RATE, tickP50: +p(sample.ticks, 0.5).toFixed(2), tickP95: +p(sample.ticks, 0.95).toFixed(2), drawP50: +p(sample.draws, 0.5).toFixed(2), drawP95: +p(sample.draws, 0.95).toFixed(2), frames: sample.frames.length, frameP50: +p(sample.frames, 0.5).toFixed(1), frameP95: +p(sample.frames, 0.95).toFixed(1), ticks: sample.ticks.length, onBelt: sample.state['occupancy'], funnel: sample.state['funnel'] };
    console.log(JSON.stringify(report));
    expect(sample.ticks.length, 'the game ran').toBeGreaterThan(20);
    expect(report.tickP50, 'a typical tick of rules and physics').toBeLessThan(TICK_MS);
    expect(report.tickP50 + report.drawP50, 'a typical tick and draw').toBeLessThan(TICK_AND_DRAW_MS);
  });
}
