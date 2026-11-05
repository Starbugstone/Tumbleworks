import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { CAMPAIGN } from '../../src/campaign';
import { LOOP_BOARDS } from '../../src/loop/boards';
import type { LoopBoardDef } from '../../src/loop/types';
import { BOARDS } from '../../src/sim/boards';
import type { BoardDef } from '../../src/sim/types';
import type { ReplayAction } from '../../src/engine/replay';
import { busyTouches } from '../../scripts/busy-touches';
import { chooseLevel } from '../fixtures/picker';

/**
 * Real clock and real rendering on the busiest levels, with a 4x CPU slowdown standing in for a mid-range
 * phone. Phones can't be driven from here, so this guards against our own code getting slower; it doesn't
 * measure a phone. SwiftShader draws on the CPU, and render submission can include driver stalls.
 * The ceilings apply to one tick plus one draw, not all the work in a displayed frame.
 * Whole-advance duration, ticks per frame, actual quality and accepted actions are reported separately.
 * Baselines and the reasoning behind these ceilings are in docs/verification.md.
 */
const inCampaign = <T extends { readonly id: string }>(bank: readonly T[]): T[] => bank.filter((board) => CAMPAIGN.some((level) => level.id === board.id));
const most = <T>(items: readonly T[], measure: (item: T) => number): T => items.reduce((best, item) => (measure(item) > measure(best) ? item : best));
const marbles = (board: BoardDef): number => board.supplies.flat().reduce((sum, tray) => sum + tray.count, 0);
const ring = (board: LoopBoardDef): number => board.loop.reduce((sum, packet) => sum + packet.count, 0);
const named = (name: string, id: string) => ({ name, id, index: CAMPAIGN.findIndex((level) => level.id === id) });
/** The busiest levels the campaign has now, found from the boards so a new stretch cannot leave them stale. */
const LEVELS = [
  named('Funnel Sort, most marbles', most(inCampaign(BOARDS), marbles).id),
  named('Funnel Sort, longest belt', most(inCampaign(BOARDS), (board) => board.beltCapacity).id),
  named('Loop Sort, fullest loop', most(inCampaign(LOOP_BOARDS), (board) => ring(board) + board.loopCapacity / 100).id),
  named('Loop Sort, longest', most(inCampaign(LOOP_BOARDS), (board) => board.lanes.flat().length + board.loopCapacity / 100).id),
];
const CASES = [
  ...LEVELS.map((level) => ({ ...level, speed: 1 })),
  ...[LEVELS[0]!, LEVELS[3]!].map((level) => ({ ...level, speed: 5 })),
];
const SECONDS = 20;
// A new busiest board needs its own recorded baseline, not a ceiling inherited from another level.
// Read limits from the recorded evidence so changing a ceiling also changes its baseline artifact.
const recordedBaseline = JSON.parse(readFileSync('docs/performance/alpha-0.0.1-baseline.json', 'utf8')) as {
  cases: { level: string; speed: number; limitsMs: { tick: number; tickAndDraw: number } }[];
};
const BUDGETS: Record<string, { tick: number; tickAndDraw: number }> = Object.fromEntries(
  recordedBaseline.cases.map((entry) => [`${entry.level}:${entry.speed}`, entry.limitsMs]),
);
const RATE = Number(process.env.TUMBLEWORKS_CPU_SLOWDOWN ?? 4);

interface Sample {
  ticks: number[]; draws: number[]; frames: number[]; advances: number[]; ticksPerFrame: number[];
  busyFrames: number; peakLoad: number; actions: readonly ReplayAction[]; elapsedMs: number;
  qualityStart: { ratio: number; width: number; height: number };
  qualityEnd: { ratio: number; width: number; height: number };
  state: Record<string, unknown>;
}

for (const level of CASES) {
  test(`${level.name} (${level.id}, ×${level.speed}) stays inside its frame budget`, async ({ page }) => {
    test.setTimeout(180_000);
    const baseline = BUDGETS[`${level.id}:${level.speed}`];
    expect(baseline, 'new busiest level: recalibrate with a recorded baseline in docs/verification.md').toBeDefined();
    if (!baseline) throw new Error(`No recorded baseline for ${level.id} at ×${level.speed}`);
    const limits = {
      tick: Number(process.env.TUMBLEWORKS_TICK_MS ?? baseline.tick),
      tickAndDraw: Number(process.env.TUMBLEWORKS_FRAME_MS ?? baseline.tickAndDraw),
    };
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('response', (response) => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
    page.on('requestfailed', (request) => errors.push(`${request.failure()?.errorText} ${request.url()}`));
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as never as { tumbleworks?: unknown }).tumbleworks), undefined, { timeout: 60_000 });
    await page.evaluate(async () => { await document.fonts.ready; });
    await chooseLevel(page, level.index);
    expect(errors, 'the measured game and its assets loaded successfully').toEqual([]);
    const client = await page.context().newCDPSession(page);
    await client.send('Emulation.setCPUThrottlingRate', { rate: RATE });
    // Let the normal adaptive policy settle before restarting the workload. Quality survives Restart.
    // At this full phone viewport SwiftShader reaches ratio 1; mixing 1.25 and 1 would bias comparisons.
    await page.waitForFunction(() => (window as never as { tumbleworks: { app: {
      stage: { renderer: { getPixelRatio(): number } };
    } } }).tumbleworks.app.stage.renderer.getPixelRatio() === 1, undefined, { timeout: 45_000 });
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    if (level.speed === 5) await page.keyboard.down('g');

    const [sample, workload] = await Promise.all([page.evaluate(async (seconds): Promise<Sample> => {
      const { app } = (window as never as { tumbleworks: { app: {
        runtime: { status: string; busy: boolean; game: { steps: number; actions: readonly ReplayAction[];
          rules: { occupancy: number; pending?: number; funnelCount?: number } };
          step(): unknown; render(a: number, s: number): void };
        stage: { canvas: HTMLCanvasElement; renderer: { getPixelRatio(): number } };
        advance(seconds: number, draw?: boolean): boolean;
        debugState(): Record<string, unknown>;
      } } }).tumbleworks;
      const ticks: number[] = [];
      const draws: number[] = [];
      const frames: number[] = [];
      const advances: number[] = [];
      const ticksPerFrame: number[] = [];
      let busyFrames = 0;
      let peakLoad = 0;
      const { runtime } = app;
      const actionStart = runtime.game.actions.length;
      const quality = () => ({ ratio: app.stage.renderer.getPixelRatio(), width: app.stage.canvas.width, height: app.stage.canvas.height });
      const qualityStart = quality();
      const started = performance.now();
      const step = runtime.step.bind(runtime);
      const render = runtime.render.bind(runtime);
      const advance = app.advance.bind(app);
      runtime.step = () => { const start = performance.now(); const events = step(); if (runtime.status === 'playing') ticks.push(performance.now() - start); return events; };
      runtime.render = (alpha, time) => { const start = performance.now(); render(alpha, time); if (runtime.status === 'playing') draws.push(performance.now() - start); };
      app.advance = (seconds, draw) => {
        const before = runtime.game.steps;
        const start = performance.now();
        const drawn = advance(seconds, draw);
        const duration = performance.now() - start;
        if (drawn && runtime.status === 'playing') {
          advances.push(duration);
          ticksPerFrame.push(runtime.game.steps - before);
          if (runtime.busy) busyFrames++;
          const { rules } = runtime.game;
          peakLoad = Math.max(peakLoad, rules.occupancy + (rules.pending ?? rules.funnelCount ?? 0));
        }
        return drawn;
      };
      try {
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
        return { ticks, draws, frames, advances, ticksPerFrame, busyFrames, peakLoad,
          actions: runtime.game.actions.slice(actionStart), elapsedMs: performance.now() - started,
          qualityStart, qualityEnd: quality(), state: app.debugState() };
      } finally {
        runtime.step = step; runtime.render = render; app.advance = advance;
      }
    }, SECONDS), busyTouches(page, SECONDS)]).finally(async () => {
      if (level.speed === 5) await page.keyboard.up('g');
      await client.send('Emulation.setCPUThrottlingRate', { rate: 1 });
    });

    const p = (values: number[], at: number) => [...values].sort((a, b) => a - b)[Math.floor(values.length * at)] ?? 0;
    const accepted = sample.actions.filter((action) => action.type === 'tap');
    const report = { level: level.id, cpu: RATE, speed: level.speed, limits, workload,
      window: { elapsedMs: sample.elapsedMs, actions: accepted, busyFrames: sample.busyFrames, peakLoad: sample.peakLoad },
      qualityStart: sample.qualityStart, qualityEnd: sample.qualityEnd,
      advanceP50: +p(sample.advances, 0.5).toFixed(2), advanceP95: +p(sample.advances, 0.95).toFixed(2),
      ticksPerFrameP50: p(sample.ticksPerFrame, 0.5), ticksPerFrameP95: p(sample.ticksPerFrame, 0.95),
      tickP50: +p(sample.ticks, 0.5).toFixed(2), tickP95: +p(sample.ticks, 0.95).toFixed(2), drawP50: +p(sample.draws, 0.5).toFixed(2), drawP95: +p(sample.draws, 0.95).toFixed(2), frames: sample.frames.length, frameP50: +p(sample.frames, 0.5).toFixed(1), frameP95: +p(sample.frames, 0.95).toFixed(1), ticks: sample.ticks.length, onBelt: sample.state['occupancy'], funnel: sample.state['funnel'] };
    console.log(JSON.stringify(report));
    expect(errors, 'the measured game remained free of runtime and asset errors').toEqual([]);
    expect(sample.qualityStart, 'the warmed-up full-size phone canvas').toEqual({ ratio: 1, width: 375, height: 690 });
    expect(sample.qualityEnd, 'quality and canvas dimensions must stay fixed during the sample').toEqual(sample.qualityStart);
    expect(accepted.length, 'touches accepted inside the measured window').toBeGreaterThanOrEqual(3);
    expect(new Set(accepted.map((action) => action.at)).size, 'several lanes poured inside the measured window').toBeGreaterThanOrEqual(2);
    expect(sample.peakLoad, 'marbles moved through the machine').toBeGreaterThan(0);
    expect(sample.busyFrames, 'frames included active transfers').toBeGreaterThan(0);
    expect(sample.draws.length, 'active game frames were drawn').toBeGreaterThan(20);
    expect(sample.ticks.length, 'the game ran').toBeGreaterThan(20);
    expect(report.tickP50, 'a typical tick of rules and physics').toBeLessThan(limits.tick);
    expect(report.tickP50 + report.drawP50, 'a typical tick and draw').toBeLessThan(limits.tickAndDraw);
  });
}
