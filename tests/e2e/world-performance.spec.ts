import { expect, test, type Page, type TestInfo } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { cpus, loadavg } from 'node:os';
import { CAMPAIGN } from '../../src/campaign';
import type { App } from '../../src/view/App';
import type { WorldScene } from '../../src/view/world-scene';
import { LEVELS_PER_STOP, STOPS_PER_CHAPTER, worldProgress, type WorldProgress } from '../../src/world/progression';
import { WORKSHOP_PROJECTS } from '../../src/world/workshop-projects';
import { PHONE } from '../fixtures/viewports';

// Measurement and activity guards only. Timing ceilings need a separately recorded baseline.
// Run alone with --project=performance --no-deps --workers=1; two performance files can otherwise overlap.
const CPU = 4;
const WINDOW_MS = 3_000;
const REQUESTED_DRAWS = 12;
const LEVELS = CAMPAIGN.map(({ id, kind }) => ({ id, kind }));
const PROJECT_IDS = WORKSHOP_PROJECTS.map(project => project.id);
const FIRST_PROJECT_IDS = WORKSHOP_PROJECTS.filter(project => project.chapter === 0).map(project => project.id);
const CHAPTER_LEVELS = LEVELS_PER_STOP * STOPS_PER_CHAPTER;
const COMPLETE = worldProgress(LEVELS, new Set(LEVELS.map(level => level.id)));
const SOURCE_FILES = [
  'tests/e2e/world-performance.spec.ts', 'playwright.config.ts', 'package-lock.json', 'index.html',
  'src/view/App.ts', 'src/view/world.ts', 'src/view/world-scene.ts', 'src/view/world.css',
  'src/world/progression.ts', 'src/world/film-progress.ts', 'src/world/locations.ts',
  'src/world/film-timeline.ts', 'src/engine/marbles.ts', 'src/engine/shadow-filter.ts',
  'src/i18n.ts', 'tests/fixtures/viewports.ts',
  'src/engine/stage.ts', 'src/engine/pacing.ts', 'src/progress.ts', 'src/campaign.ts',
  'src/view/world-film.ts', 'src/view/world-assets.ts', 'src/view/valley-overview.ts',
  'src/view/world-rube.ts', 'src/world/rube-sequence.ts', 'src/view/world-film-camera.ts',
  'src/view/project-rewards.ts', 'src/world/workshop-projects.ts', 'src/world/overview-layout.ts',
  'assets/world-3d/terrain-runtime.json', 'assets/world-3d/kit-runtime.json',
  'src/view/workshop-building.ts', 'src/world/workshop-building.ts', 'src/engine/exact-math.ts',
  'src/view/world-kit.ts', 'src/view/world-bake.ts', 'src/view/village-machine.ts', 'src/view/village-film-camera.ts',
  'src/view/machine-primitives.ts', 'src/view/village-terrain.ts', 'src/world/village-terrain.ts',
  'src/world/village-plan.ts', 'src/world/village-program.ts', 'src/world/village-plans.ts',
  'src/world/villages/author.ts', 'src/world/village-motion.ts', 'src/world/village-rolling.ts', 'src/view/village-film-shots.ts',
  ...['little-harbour', 'glasshouse-gardens', 'willow-mill', 'clockmakers-hill', 'cloud-bridge', 'high-glassworks'].map(name => `src/world/villages/${name}.ts`),
];
const sourceHashes = () => Object.fromEntries(SOURCE_FILES.map(path => [path, createHash('sha256').update(readFileSync(path)).digest('hex')]));
const SOURCES = sourceHashes();

// Read-only presentation observations; no product hooks or clock/quality overrides are added.
type SceneProbe = Pick<WorldScene, 'chapter' | 'draw' | 'scene' | 'machine'> & {
  readonly marble: { readonly mesh: { readonly visible: boolean; readonly position: { readonly x: number; readonly y: number; readonly z: number } } } | null;
  readonly constructionProgress: number;
  readonly builds: readonly { readonly visible: boolean; readonly matrixWorld: { readonly elements: readonly number[] } }[];
};
type WorldApp = Pick<App, 'runtime' | 'stage' | 'advance' | 'debugState' | 'manualClock'> & {
  readonly world: {
    readonly scene: SceneProbe | null;
    readonly dirty: boolean;
    readonly filmTime: number;
    readonly playback: { readonly duration: number } | null;
    show(progress: WorldProgress, chapter: number, construct?: boolean): void;
  };
};
interface Quality { ratio: number; width: number; height: number }
interface FilmState { time: number; duration: number; mode: string | null }
interface Snapshot {
  quality: Quality; cssWidth: number; cssHeight: number; deviceRatio: number; steps: number;
  rendererFrame: number; manualClock: boolean; screen: string; chapter: number | null; built: number;
  film: FilmState | null; seededProjectIds: string[]; seededProjectCount: number; renderedProjectCount: number;
}
interface DrawSample { phase: string; ms: number; calls: number; triangles: number; buildProgress: number | null; buildTransform: number[] | null; filmTime: number | null; marble: number[] | null; camera: number[] }
interface Sample {
  before: Snapshot; after: Snapshot; elapsedMs: number; draws: DrawSample[]; advanceMs: number[]; frameMs: number[];
  drawnAdvances: number; stepCalls: number; gameRenderCalls: number; qualityChanges: number;
  runtimeUnchanged: boolean; fingerprintUnchanged: boolean;
}
interface Probe { phase: string; finish(): Sample }
type GameWindow = Window & { tumbleworks: { app: WorldApp }; worldPerformanceProbe?: Probe };

test.use({ viewport: PHONE, reducedMotion: 'no-preference' });

function observeErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) errors.push(`${response.status()} ${response.url()}`); });
  page.on('requestfailed', request => errors.push(`${request.failure()?.errorText} ${request.url()}`));
  return errors;
}

async function openMap(page: Page, completed: readonly string[], projectIds: readonly string[] = PROJECT_IDS): Promise<void> {
  await page.addInitScript(ids => {
    localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed: ids, muted: true }));
    // Exercise the existing completed-save migration, without an automatic film backlog.
    localStorage.removeItem('tumbleworks.valley.v1');
  }, [...completed, ...projectIds]);
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 120_000 });
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
  await expect(page.locator('#journey-transition')).toBeHidden();
  await page.evaluate(async () => { await document.fonts.ready; });
  await settledMap(page);
}

async function settledMap(page: Page): Promise<void> {
  await page.waitForFunction(() => {
    const app = (window as unknown as GameWindow).tumbleworks?.app;
    return app?.world.scene && app.world.dirty === false;
  }, undefined, { timeout: 30_000 });
}

async function withCpu(page: Page, action: () => Promise<void>): Promise<void> {
  const client = await page.context().newCDPSession(page);
  await client.send('Emulation.setCPUThrottlingRate', { rate: CPU });
  try { await action(); } finally {
    await page.evaluate(() => { (window as unknown as GameWindow).worldPerformanceProbe?.finish(); }).catch(() => undefined);
    await client.send('Emulation.setCPUThrottlingRate', { rate: 1 }).catch(() => undefined);
    await client.detach().catch(() => undefined);
  }
}

async function beginSample(page: Page, phase: string, buildIndex: number | null = null): Promise<void> {
  await page.evaluate(({ phase, buildIndex, projectIds }) => {
    const target = window as unknown as GameWindow;
    if (target.worldPerformanceProbe) throw new Error('A world measurement is already active');
    const { app } = target.tumbleworks;
    const { stage, runtime } = app;
    const quality = (): Quality => ({ ratio: stage.renderer.getPixelRatio(), width: stage.canvas.width, height: stage.canvas.height });
    const saved = JSON.parse(localStorage.getItem('tumbleworks.progress.v1') ?? '{}') as { completed?: string[] };
    const seededProjectIds = projectIds.filter(id => saved.completed?.includes(id));
    const snapshot = (): Snapshot => {
      return {
        quality: quality(), cssWidth: stage.canvas.clientWidth, cssHeight: stage.canvas.clientHeight, deviceRatio: devicePixelRatio,
        steps: app.runtime.game.steps, rendererFrame: stage.renderer.info.render.frame, manualClock: app.manualClock,
        screen: String(app.debugState()['screen']), chapter: app.world.scene?.chapter ?? null,
        built: app.world.scene?.builds.filter(build => build.visible).length ?? 0,
        seededProjectIds, seededProjectCount: seededProjectIds.length,
        renderedProjectCount: app.world.scene?.scene.children.filter(child => child.name.startsWith('project-')).length ?? 0,
        film: app.world.playback ? { time: app.world.filmTime, duration: app.world.playback.duration, mode: stage.canvas.dataset['worldPlayback'] ?? null } : null,
      };
    };
    const before = snapshot();
    const fingerprint = runtime.game.fingerprint();
    const draws: DrawSample[] = [], advanceMs: number[] = [], frameMs: number[] = [];
    let stepCalls = 0, gameRenderCalls = 0, drawnAdvances = 0, qualityChanges = 0;
    const originalDraw = stage.draw, originalAdvance = app.advance, originalStep = runtime.step, originalRender = runtime.render;
    let frame = 0, finished = false;
    const started = performance.now();
    let lastFrame = started;
    const probe: Probe = {
      phase,
      finish: () => {
        if (finished) throw new Error('World measurement already finished');
        finished = true; cancelAnimationFrame(frame);
        stage.draw = originalDraw; app.advance = originalAdvance; runtime.step = originalStep; runtime.render = originalRender;
        delete target.worldPerformanceProbe;
        return {
          before, after: snapshot(), elapsedMs: performance.now() - started, draws, advanceMs, frameMs,
          drawnAdvances, stepCalls, gameRenderCalls, qualityChanges,
          runtimeUnchanged: app.runtime === runtime, fingerprintUnchanged: app.runtime.game.fingerprint() === fingerprint,
        };
      },
    };
    stage.draw = (scene, camera) => {
      const start = performance.now(); originalDraw.call(stage, scene, camera); const ms = performance.now() - start;
      const now = quality();
      if (now.ratio !== before.quality.ratio || now.width !== before.quality.width || now.height !== before.quality.height) qualityChanges++;
      const marble = app.world.scene?.marble?.mesh;
      draws.push({ phase: probe.phase, ms, calls: stage.renderer.info.render.calls, triangles: stage.renderer.info.render.triangles,
        buildProgress: buildIndex === null ? null : app.world.scene?.constructionProgress ?? null,
        buildTransform: buildIndex === null ? null : [...(app.world.scene?.builds[buildIndex]?.matrixWorld.elements ?? [])],
        filmTime: app.world.playback ? app.world.filmTime : null,
        marble: marble?.visible ? [marble.position.x, marble.position.y, marble.position.z] : null,
        camera: [...camera.matrixWorld.elements, ...camera.projectionMatrix.elements] });
    };
    app.advance = (seconds, draw) => {
      const start = performance.now(); const drawn = originalAdvance.call(app, seconds, draw);
      advanceMs.push(performance.now() - start); if (drawn) drawnAdvances++; return drawn;
    };
    runtime.step = () => { stepCalls++; return originalStep.call(runtime); };
    runtime.render = (alpha, seconds) => { gameRenderCalls++; originalRender.call(runtime, alpha, seconds); };
    const tick = (now: number): void => { frameMs.push(now - lastFrame); lastFrame = now; frame = requestAnimationFrame(tick); };
    target.worldPerformanceProbe = probe;
    frame = requestAnimationFrame(tick);
  }, { phase, buildIndex, projectIds: PROJECT_IDS });
}

async function endSample(page: Page): Promise<Sample> {
  return page.evaluate(() => {
    const probe = (window as unknown as GameWindow).worldPerformanceProbe;
    if (!probe) throw new Error('No world measurement to finish');
    return probe.finish();
  });
}

const distribution = (values: readonly number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const at = (p: number) => sorted.length ? Number(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!.toFixed(3)) : null;
  return { samples: sorted.length, p50: at(0.5), p95: at(0.95), max: at(1) };
};

async function report(info: TestInfo, scope: string, samples: readonly Sample[], workload: unknown, errors: readonly string[]): Promise<void> {
  const sourcesAfter = sourceHashes();
  const summaries = samples.map(sample => ({
    screen: sample.after.screen, chapter: sample.after.chapter, elapsedMs: sample.elapsedMs,
    qualityStart: sample.before.quality, qualityEnd: sample.after.quality, advanceMs: distribution(sample.advanceMs),
    drawMs: distribution(sample.draws.map(draw => draw.ms)), naturalDrawMs: distribution(sample.draws.filter(draw => draw.phase === 'natural').map(draw => draw.ms)),
    requestedDrawMs: distribution(sample.draws.filter(draw => draw.phase === 'requested').map(draw => draw.ms)), frameMs: distribution(sample.frameMs),
    calls: distribution(sample.draws.map(draw => draw.calls)), triangles: distribution(sample.draws.map(draw => draw.triangles)),
    seededProjectIds: sample.after.seededProjectIds, seededProjectCount: sample.after.seededProjectCount,
    renderedProjectCount: sample.after.renderedProjectCount,
    filmStart: sample.before.film, filmEnd: sample.after.film,
    filmAdvanceSeconds: sample.before.film && sample.after.film ? sample.after.film.time - sample.before.film.time : null,
    visibleMarbleDraws: sample.draws.filter(draw => draw.marble !== null).length,
    distinctMarblePositions: new Set(sample.draws.filter(draw => draw.marble !== null).map(draw => JSON.stringify(draw.marble))).size,
    distinctCameraPoses: new Set(sample.draws.map(draw => JSON.stringify(draw.camera))).size,
    stepCalls: sample.stepCalls, gameRenderCalls: sample.gameRenderCalls, rendererFrames: sample.after.rendererFrame - sample.before.rendererFrame,
  }));
  const metadata = { scope, recordedAt: new Date().toISOString(), cpuSlowdown: CPU, viewport: PHONE,
    host: { model: cpus()[0]?.model, logicalCpus: cpus().length, loadAverage: loadavg() },
    timingLimits: null, errors: [...errors], errorCount: errors.length, sourceSha256: SOURCES, sourceSha256After: sourcesAfter,
    fixture: 'Seeded campaign and Workshop completion IDs are presentation fixtures, not measured puzzle wins.',
    boundary: 'Browser/software-renderer measurements; no physical-phone claim. Requested draws are not normal idle rendering.', workload, summaries };
  await info.attach(`${scope}.json`, { body: JSON.stringify({ ...metadata, samples }, null, 2), contentType: 'application/json' });
  console.log(JSON.stringify({ scope, cpuSlowdown: CPU, workload, summaries }));
  expect(sourcesAfter, 'source and harness stayed frozen throughout measurement').toEqual(SOURCES);
}

function assertPaused(sample: Sample, screen: string): void {
  expect(sample.before.manualClock).toBe(false); expect(sample.after.manualClock).toBe(false);
  expect(sample.advanceMs.length, 'the real App clock kept running').toBeGreaterThan(0);
  expect(sample.frameMs.length, 'real browser frames were observed').toBeGreaterThan(0);
  expect(sample.after.screen).toBe(screen);
  expect(sample.runtimeUnchanged).toBe(true); expect(sample.fingerprintUnchanged).toBe(true);
  expect(sample.stepCalls).toBe(0); expect(sample.gameRenderCalls).toBe(0);
  expect(sample.after.steps).toBe(sample.before.steps);
  expect(sample.before.quality).toEqual({ ratio: 1.25, width: Math.floor(PHONE.width * 1.25), height: Math.floor(PHONE.height * 1.25) });
  expect([sample.before.cssWidth, sample.before.cssHeight]).toEqual([PHONE.width, PHONE.height]);
  expect([sample.after.cssWidth, sample.after.cssHeight]).toEqual([PHONE.width, PHONE.height]);
  expect(sample.after.quality).toEqual(sample.before.quality); expect(sample.qualityChanges).toBe(0);
}

test('earned map construction animates through the real frame path at natural quality', async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors = observeErrors(page);
  const chapter = COMPLETE.chapters[0]!;
  const buildIndex = chapter.stops.length - 1;
  expect(buildIndex).toBeGreaterThan(0);
  await openMap(page, LEVELS.slice(0, buildIndex * LEVELS_PER_STOP).map(level => level.id), FIRST_PROJECT_IDS);
  await expect(page.locator('.map-stop[data-status="built"]')).toHaveCount(buildIndex);
  const earned = worldProgress(LEVELS, new Set(LEVELS.slice(0, chapter.stops.length * LEVELS_PER_STOP).map(level => level.id)));
  await withCpu(page, async () => {
    await beginSample(page, 'construction-event', buildIndex);
    const eventMs = await page.evaluate(progress => {
      const target = window as unknown as GameWindow;
      const start = performance.now(); target.tumbleworks.app.world.show(progress, 0, true);
      const elapsed = performance.now() - start;
      target.worldPerformanceProbe!.phase = 'natural'; return elapsed;
    }, earned);
    const completed = await page.waitForFunction(index => {
      const app = (window as unknown as GameWindow).tumbleworks.app;
      return app.world.scene?.builds[index]?.visible && app.world.scene.constructionProgress === 1 && !app.world.dirty;
    }, buildIndex, { timeout: 30_000 }).then(() => true, () => false);
    const sample = await endSample(page);
    await report(info, 'world-construction', [sample], {
      kind: 'presentation-injection microbenchmark, not a gameplay-completion journey', chapter: 0, buildIndex, eventMs,
      expectedConstructionSeconds: 0.65, completed, deadlineMs: 30_000,
    }, errors);
    expect(completed, 'construction completed before the collection deadline; partial samples are attached').toBe(true);
    assertPaused(sample, 'map');
    const progress = sample.draws.map(draw => draw.buildProgress).filter((value): value is number => value !== null);
    const transforms = sample.draws.map(draw => JSON.stringify(draw.buildTransform));
    expect(progress[0], 'the earned construction starts before its rest pose').toBeLessThan(1);
    expect(progress.at(-1), 'the structure reaches its completed rest pose').toBe(1);
    expect(new Set(progress).size, 'intermediate construction frames were actually drawn').toBeGreaterThan(2);
    expect(new Set(transforms).size, 'the actual structure moved during construction').toBeGreaterThan(2);
    expect(sample.drawnAdvances).toBeGreaterThan(1);
    expect(sample.after.built).toBe(chapter.stops.length);
    expect(sample.after.renderedProjectCount).toBe(FIRST_PROJECT_IDS.length);
    expect(sample.draws.every(draw => draw.calls > 0 && draw.triangles > 0)).toBe(true);
    expect(errors).toEqual([]);
  });
});

test('fully built chapter scenes report setup and bounded requested draws', async ({ page }, info) => {
  test.setTimeout(300_000);
  const errors = observeErrors(page);
  await openMap(page, LEVELS.map(level => level.id));
  await withCpu(page, async () => {
    for (const chapter of COMPLETE.chapters) {
      await beginSample(page, 'scene-setup');
      const setup = await page.evaluate(({ progress, chapter }) => {
        const target = window as unknown as GameWindow, world = target.tumbleworks.app.world;
        const reusedScene = world.scene?.chapter === chapter;
        const start = performance.now(); world.show(progress, chapter);
        const setupMs = performance.now() - start;
        target.worldPerformanceProbe!.phase = 'natural'; return { setupMs, reusedScene };
      }, { progress: COMPLETE, chapter: chapter.index });
      const mapSettled = await settledMap(page).then(() => true, () => false);
      const requested = mapSettled ? await page.evaluate(async count => {
        const target = window as unknown as GameWindow;
        const started = performance.now(); let completed = 0;
        for (; completed < count; completed++) {
          await new Promise<void>(resolve => requestAnimationFrame(() => resolve()));
          if (performance.now() - started > 15_000) break;
          target.worldPerformanceProbe!.phase = 'requested';
          target.tumbleworks.app.world.scene!.draw();
          target.worldPerformanceProbe!.phase = 'natural';
        }
        return { completed, requested: count, elapsedMs: performance.now() - started, deadlineMs: 15_000 };
      }, REQUESTED_DRAWS) : { completed: 0, requested: REQUESTED_DRAWS, elapsedMs: 0, deadlineMs: 15_000 };
      const sample = await endSample(page);
      await report(info, `world-built-chapter-${chapter.index + 1}`, [sample], {
        kind: 'requested-draw microbenchmark; the resting map normally draws nothing', chapter: chapter.index, builtStops: chapter.stops.length, mapSettled, ...setup, ...requested,
      }, errors);
      expect(mapSettled, 'the chapter settled before requested draws; partial samples are attached').toBe(true);
      assertPaused(sample, 'map');
      expect(sample.after.chapter).toBe(chapter.index); expect(sample.after.built).toBe(chapter.stops.length);
      expect(sample.after.seededProjectIds).toEqual(PROJECT_IDS);
      expect(sample.after.renderedProjectCount).toBe(WORKSHOP_PROJECTS.filter(project => project.chapter === chapter.index).length);
      expect(requested.completed, 'bounded collection produced the requested samples').toBe(REQUESTED_DRAWS);
      const draws = sample.draws.filter(draw => draw.phase === 'requested');
      expect(draws).toHaveLength(REQUESTED_DRAWS);
      expect(draws.every(draw => draw.calls > 0 && draw.triangles > 0)).toBe(true);
      expect(errors).toEqual([]);
    }
  });
});

test('an idle fully built map makes no render submissions or gameplay steps with its clock running', async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors = observeErrors(page);
  await openMap(page, LEVELS.map(level => level.id));
  await withCpu(page, async () => {
    await beginSample(page, 'idle');
    await page.evaluate(ms => new Promise<void>(resolve => window.setTimeout(resolve, ms)), WINDOW_MS);
    const sample = await endSample(page);
    await report(info, 'world-idle', [sample], { kind: 'natural resting map', requestedWindowMs: WINDOW_MS }, errors);
    assertPaused(sample, 'map');
    expect(sample.elapsedMs).toBeGreaterThanOrEqual(WINDOW_MS);
    expect(sample.draws).toHaveLength(0); expect(sample.drawnAdvances).toBe(0);
    expect(sample.after.rendererFrame).toBe(sample.before.rendererFrame);
    expect(errors).toEqual([]);
  });
});

test('the first realtime 3D film draws moving cargo and camera without gameplay work', async ({ page }, info) => {
  test.setTimeout(180_000);
  const errors = observeErrors(page);
  await openMap(page, LEVELS.slice(0, CHAPTER_LEVELS).map(level => level.id));
  if (COMPLETE.chapters.length > 1) await page.getByRole('button', { name: 'Previous location', exact: true }).tap();
  await settledMap(page);
  const timing = await page.evaluate(() => {
    const scene = (window as unknown as GameWindow).tumbleworks.app.world.scene;
    if (!scene) throw new Error('Film measurement requires the actual current village');
    const route = scene.machine.route, first = route.contacts.find(contact => contact.stop === 9);
    if (!first || !Number.isFinite(first.contact)) throw new Error('Film measurement requires a compiled first contact');
    return { firstContactSeconds: first.contact, steadyStartSeconds: first.contact + 0.05,
      physicalDurationSeconds: route.duration, motionStatus: route.motionStatus };
  });
  await withCpu(page, async () => {
    await beginSample(page, 'film-bootstrap');
    await page.getByRole('button', { name: 'Watch your machine' }).tap();
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'film');
    const playbackReady = await page.waitForFunction(releasedAt => {
      const { app } = (window as unknown as GameWindow).tumbleworks;
      return app.world.playback && app.world.filmTime > releasedAt && app.world.scene?.marble?.mesh.visible;
    }, timing.steadyStartSeconds, { timeout: 30_000 }).then(() => true, () => false);
    const bootstrap = await endSample(page);
    await report(info, 'world-film-bootstrap', [bootstrap], {
      kind: 'real UI realtime-3D setup through compiled first contact', chapter: 0, playbackReady,
      steadyStartsAfterCompiledContact: true, ...timing,
      durationSeconds: bootstrap.after.film?.duration ?? null,
    }, errors);
    expect(playbackReady, 'visible cargo reached the compiled first contact before collection deadline').toBe(true);
    assertPaused(bootstrap, 'film');
    expect(bootstrap.draws.length).toBeGreaterThan(0);
    expect(bootstrap.after.film?.mode).toBe('realtime-3d');
    const initialFilm = bootstrap.after.film!;
    expect(initialFilm.time + WINDOW_MS / 1000, 'the physical film has enough remaining time for the sample').toBeLessThan(initialFilm.duration);
    await beginSample(page, 'natural');
    await page.evaluate(ms => new Promise<void>(resolve => window.setTimeout(resolve, ms)), WINDOW_MS);
    const sample = await endSample(page);
    await report(info, 'world-film-realtime-3d', [sample], {
      kind: 'natural App.frame realtime-3D film; no requested draws or simulation clock override',
      chapter: 0, durationSeconds: initialFilm.duration, requestedWindowMs: WINDOW_MS,
      steadyStartsAfterCompiledContact: true, ...timing,
    }, errors);
    assertPaused(sample, 'film');
    expect(sample.after.seededProjectIds).toEqual(PROJECT_IDS);
    expect(sample.after.renderedProjectCount).toBe(FIRST_PROJECT_IDS.length);
    expect(sample.after.film?.mode).toBe('realtime-3d');
    expect(sample.after.film!.time).toBeGreaterThan(sample.before.film!.time);
    expect(sample.elapsedMs).toBeGreaterThanOrEqual(WINDOW_MS);
    expect(sample.drawnAdvances).toBeGreaterThan(1);
    expect(sample.draws.length).toBeGreaterThan(1);
    expect(sample.draws.every(draw => draw.phase === 'natural' && draw.calls > 0 && draw.triangles > 0)).toBe(true);
    expect(new Set(sample.draws.filter(draw => draw.marble !== null).map(draw => JSON.stringify(draw.marble))).size,
      'visible cargo travelled through rendered frames').toBeGreaterThan(2);
    expect(new Set(sample.draws.map(draw => JSON.stringify(draw.camera))).size,
      'the normal film camera moved through rendered frames').toBeGreaterThan(1);
    expect(sample.after.rendererFrame).toBeGreaterThan(sample.before.rendererFrame);
    expect(errors).toEqual([]);
    await page.locator('#film-skip').tap();
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
  });
});
