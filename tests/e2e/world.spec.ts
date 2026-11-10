import { expect, test, type Page } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';
import type { App } from '../../src/view/App';
import { FUNNEL_WITNESSES, LOOP_WITNESSES } from '../witnesses';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import { DESKTOP } from '../fixtures/viewports';
import { CONNECTION_SECONDS } from '../../src/world/film-timeline';
import type { WorldScene } from '../../src/view/world-scene';
import type { MarbleEntity } from '../../src/engine/marbles';

type FilmProbe = {
  readonly filmTime: number;
  readonly playback: { readonly duration: number } | null;
  readonly scene: WorldScene | null;
};
type GameWindow = Window & { tumbleworks: { app: App } };
// Observe presentation state without changing film time, actor ownership or camera quality.
const filmSnapshot = (page: Page) => page.evaluate(() => {
  const app = (window as unknown as GameWindow).tumbleworks.app;
  const world = (app as unknown as { world: FilmProbe }).world;
  const scene = world.scene;
  // Private actor ownership is observed only by this browser probe.
  const actor = (scene as unknown as { marble: MarbleEntity | null } | null)?.marble;
  return { time: world.filmTime, duration: world.playback?.duration, entities: app.stage.marbles.count,
    position: actor?.mesh.position.toArray() ?? null, visible: actor?.mesh.visible ?? false,
    shots: scene?.filmShots ?? [], localDuration: scene?.machine.route.duration, chapter: scene?.chapter,
    camera: scene ? [...scene.camera.position.toArray(), ...scene.camera.quaternion.toArray(), scene.camera.zoom] : null,
    fingerprint: app.runtime.game.fingerprint(), steps: app.runtime.game.steps, rendererFrame: app.stage.renderer.info.render.frame };
});
async function movingFilm(page: Page, baselineEntities: number, fixedCamera = false): Promise<void> {
  await expect(page.locator('canvas[data-world-playback="realtime-3d"]')).toBeVisible();
  await expect(page.locator('video#world-film')).toHaveCount(0);
  const initial = await filmSnapshot(page);
  if (initial.duration === undefined || initial.localDuration === undefined || initial.chapter === undefined) throw new Error('Film requires a compiled runtime duration');
  const timeout = Math.ceil(initial.duration * 1000) + 30_000;
  expect(initial.duration).toBe(initial.localDuration + (initial.chapter > 0 ? CONNECTION_SECONDS : 0));
  const fixedShot = initial.shots[1] ?? initial.shots[0];
  if (fixedCamera) {
    if (!fixedShot) throw new Error('Village has no authored fixed shot');
    await page.waitForFunction(start => {
      const app = (window as unknown as GameWindow).tumbleworks.app;
      return (app as unknown as { world: FilmProbe }).world.filmTime > start + 0.05;
    }, fixedShot.start, { timeout });
  }
  const before = await filmSnapshot(page);
  await page.waitForFunction(start => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    const world = (app as unknown as { world: FilmProbe }).world;
    const actor = (world.scene as unknown as { marble: MarbleEntity | null } | null)?.marble;
    return world.filmTime > start.time + 0.15 && app.stage.renderer.info.render.frame > start.rendererFrame
      && actor !== null && actor !== undefined
      && actor.mesh.position.toArray().some((coordinate, index) => coordinate !== start.position?.[index]);
  }, before, { timeout });
  const after = await filmSnapshot(page);
  expect(after.position).not.toBeNull(); expect(after.position).not.toEqual(before.position);
  expect(after.time).toBeGreaterThan(before.time);
  expect(after.entities).toBe(baselineEntities + 1);
  expect(after.fingerprint).toBe(initial.fingerprint); expect(after.steps).toBe(initial.steps);
  if (fixedCamera) {
    expect(before.time).toBeGreaterThan(fixedShot!.start);
    expect(after.time).toBeLessThan(fixedShot!.end);
    expect(after.camera).toEqual(before.camera);
  }
}

const state = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
async function ready(page: Page): Promise<void> {
  await expect(page.locator('#boot')).toBeHidden({ timeout: 120_000 });
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app));
  await expect(page.locator('canvas[data-world-scene="ready"]')).toBeVisible({ timeout: 120_000 });
  await expect(page.locator('#journey-transition')).toBeHidden();
}
async function primaryFits(page: Page): Promise<void> {
  const row = page.locator('.wv-primary');
  await expect(row).toBeVisible();
  const box = await row.boundingBox(); expect(box).not.toBeNull();
  if (!box) return;
  const viewport = page.viewportSize()!;
  expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
  expect(box.y + box.height).toBeLessThan(viewport.height);
  for (const button of await row.getByRole('button').all()) {
    const rect = (await button.boundingBox())!;
    expect(rect.height).toBeGreaterThanOrEqual(44); expect(rect.height).toBeLessThanOrEqual(50);
    expect(await button.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
    for (const stop of await page.locator('.map-stop').all()) {
      const target = (await stop.boundingBox())!;
      const overlaps = rect.x < target.x + target.width + 7 && rect.x + rect.width > target.x - 7 && rect.y < target.y + target.height + 7 && rect.y + rect.height > target.y - 7;
      expect(overlaps, 'the primary row clears every construction target and its outline').toBe(false);
    }
  }
}
async function settle(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    for (let tick = 0; tick < 7200; tick++) {
      const snapshot = app.debugState();
      if (!snapshot.busy && !snapshot.settling) { app.advance(0); return; }
      app.advance(1 / 60, false);
    }
    throw new Error('The level did not settle');
  });
}
async function tap(page: Page, id: string): Promise<void> {
  const at = await page.evaluate(id => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[id], id);
  if (!at) throw new Error(`Missing target ${id}`);
  await page.touchscreen.tap(at.x, at.y); await settle(page);
}
async function solve(page: Page, index: number): Promise<void> {
  const level = CAMPAIGN[index]!;
  await settle(page);
  if (level.kind === 'conveyor' || level.kind === 'loop') {
    const witness = (level.kind === 'conveyor' ? FUNNEL_WITNESSES : LOOP_WITNESSES)[level.id];
    if (!witness) throw new Error(`Missing witness ${level.id}`);
    for (const letter of witness) await tap(page, `${level.kind === 'conveyor' ? 'supply' : 'lane'}${letter.charCodeAt(0) - 65}`);
  } else {
    const solution = TUBE_BOARDS.find(board => board.id === level.id)?.solution;
    if (!solution) throw new Error(`Missing solution ${level.id}`);
    for (const move of solution) { await tap(page, `tube${move.from}`); await tap(page, `tube${move.to}`); }
  }
  expect(await state(page)).toMatchObject({ status: 'won', busy: false });
}

test('the phone map has ten reachable targets, stays still, and requires a stop tap', async ({ page }) => {
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  const films: string[] = []; page.on('request', request => { if (request.url().includes('/films/')) films.push(request.url()); });
  await page.goto('/'); await ready(page);
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
  await expect(page.locator('.map-stop')).toHaveCount(10);
  await expect(page.locator('.map-stop:not(:disabled)')).toHaveCount(1);
  for (const button of await page.locator('.map-stop').all()) {
    const box = await button.boundingBox();
    expect(box).not.toBeNull(); if (!box) continue;
    expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(375);
    expect(box.y).toBeGreaterThan(110); expect(box.y + box.height).toBeLessThan(600);
  }
  const before = await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    return { fingerprint: app.runtime.game.fingerprint(), calls: app.stage.renderer.info.render.calls, frame: app.stage.renderer.info.render.frame };
  });
  await page.evaluate(() => { const app = (window as unknown as GameWindow).tumbleworks.app; for (let i = 0; i < 120; i++) app.advance(1 / 60); });
  expect(await page.evaluate(() => { const app = (window as unknown as GameWindow).tumbleworks.app; return { fingerprint: app.runtime.game.fingerprint(), calls: app.stage.renderer.info.render.calls, frame: app.stage.renderer.info.render.frame }; })).toEqual(before);
  expect(films).toEqual([]);
  await page.screenshot({ path: 'output/current/world/map-phone.png' });
  await primaryFits(page);
  await page.getByRole('button', { name: 'Play next level' }).tap();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'game');
  await expect(page.locator('#journey-transition')).toBeHidden();
  expect(await state(page)).toMatchObject({ levelIndex: 0, source: 'campaign' });
  expect(errors).toEqual([]);
});

test('three actual games construct one stop and require a new map touch', async ({ page }) => {
  test.setTimeout(360_000);
  await page.goto('/'); await ready(page);
  await page.locator('.map-stop[data-round="0"]').tap();
  await expect(page.locator('#journey-transition')).toBeHidden();
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  for (let index = 0; index < 3; index++) {
    await solve(page, index);
    if (index < 2) { await page.getByRole('button', { name: 'Next level', exact: true }).click(); await expect(page.locator('#journey-transition')).toBeHidden(); }
  }
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
  await expect(page.locator('.map-stop[data-round="0"]')).toHaveAttribute('data-status', 'built');
  await expect(page.locator('.map-stop[data-round="1"]')).toBeEnabled();
  expect((await state(page)).levelIndex).toBe(2);
  const completed = await page.evaluate(() => JSON.parse(localStorage.getItem('tumbleworks.progress.v1')!).completed);
  expect(completed).toEqual(CAMPAIGN.slice(0, 3).map(level => level.id));
  await page.locator('.map-stop[data-round="1"]').tap();
  expect(await state(page)).toMatchObject({ screen: 'game', levelIndex: 3 });
});

test('a partial old save resumes its missing game and retains retired completion', async ({ page }) => {
  await page.addInitScript(completed => {
    if (!localStorage.getItem('tumbleworks.progress.v1')) localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed, current: completed[1], muted: true }));
  }, [CAMPAIGN[0]!.id, CAMPAIGN[1]!.id, 'tray-1']);
  await page.goto('/'); await ready(page);
  await expect(page.locator('.map-stop[data-round="0"]')).toHaveAttribute('aria-label', 'Construction stop 1, 2 of 3 puzzles completed');
  await page.getByRole('button', { name: 'Play next level' }).tap();
  expect(await state(page)).toMatchObject({ screen: 'game', levelIndex: 2 });
  await page.reload(); await ready(page);
  await page.locator('.map-stop[data-round="0"]').tap();
  expect((await state(page)).levelIndex).toBe(2);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tumbleworks.progress.v1')!).completed)).toContain('tray-1');
});

test('a map visit preserves an unfinished puzzle and its exact undo history', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await page.locator('.map-stop[data-round="0"]').tap();
  await expect(page.locator('#journey-transition')).toBeHidden();
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  const initial = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.replay().fingerprint);
  const at = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugTargets()['supply0']);
  await page.touchscreen.tap(at!.x, at!.y);
  const accepted = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.replay().fingerprint);
  expect(accepted).not.toBe(initial);
  await page.locator('#levels-toggle').click(); await page.locator('#map-open').click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
  await page.getByRole('button', { name: 'Play next level' }).tap();
  await expect(page.locator('#journey-transition')).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.replay().fingerprint)).toBe(accepted);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.replay().fingerprint)).toBe(initial);
});

test('Workshop deep links and the village Back button keep reloads in the chosen source', async ({ page }) => {
  const milestone = CAMPAIGN.slice(0, 21).map(level => level.id);
  await page.addInitScript(completed => {
    if (!localStorage.getItem('tumbleworks.progress.v1')) localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed, muted: true }));
  }, milestone);
  await page.goto('/?workshop=board-212'); await ready(page);
  expect(await state(page)).toMatchObject({ screen: 'game', source: 'workshop', levelId: 'board-212' });
  await page.locator('#levels-toggle').click(); await page.locator('#map-open').click();
  expect(new URL(page.url()).searchParams.has('workshop')).toBe(false);
  await page.locator('#world-workshop').click();
  await page.getByRole('button', { name: 'Back to the village' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
  await page.locator('.map-stop[data-round="0"]').tap();
  await page.reload(); await ready(page);
  expect(await state(page)).toMatchObject({ screen: 'map', source: 'campaign', levelIndex: milestone.length });
  await page.locator('#world-workshop').click();
  await page.locator('.wv-experiment[data-workshop="board-212"]').tap();
  expect(new URL(page.url()).searchParams.get('workshop')).toBe('board-212');
  await page.reload(); await ready(page);
  expect(await state(page)).toMatchObject({ screen: 'game', source: 'workshop', levelId: 'board-212' });
});

test('desktop and French map navigation preserve the campaign and phone-independent controls', async ({ page }) => {
  await page.setViewportSize(DESKTOP); await page.goto('/'); await ready(page);
  await page.screenshot({ path: 'output/current/world/map-desktop.png' });
  await page.getByRole('button', { name: 'The valley', exact: true }).click();
  await expect(page.locator('.wv-location')).toHaveCount(Math.ceil(CAMPAIGN.length / 30));
  await page.locator('.wv-location[data-chapter="0"]').click();
  await page.locator('#levels-toggle').click();
  await page.getByRole('button', { name: 'Français', exact: true }).click();
  if (await page.locator('#levels').isVisible()) await page.locator('#levels-toggle').click();
  await expect(page.locator('.wv-heading h1')).toHaveText('Le petit port');
  await expect(page.getByRole('button', { name: 'La vallée', exact: true })).toBeVisible();
  await primaryFits(page);
  await page.getByRole('button', { name: 'Jouer le niveau suivant' }).click();
  expect(await state(page)).toMatchObject({ screen: 'game', levelIndex: 0 });
});

test('Play continues from an earlier location in English and French with Film secondary', async ({ page }) => {
  await page.addInitScript(completed => localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed, muted: true })), [...CAMPAIGN.slice(0, 31).map(level => level.id), CAMPAIGN[36]!.id]);
  await page.goto('/'); await ready(page);
  await page.getByRole('button', { name: 'Previous location', exact: true }).click();
  await expect(page.locator('.wv-primary .wv-play')).toHaveCount(1);
  await expect(page.getByRole('button', { name: 'Watch your machine' })).toHaveText('Film');
  await primaryFits(page);
  await page.screenshot({ path: 'output/current/world/map-phone-completed.png' });
  await page.locator('#levels-toggle').click(); await page.getByRole('button', { name: 'Français', exact: true }).click();
  if (await page.locator('#levels').isVisible()) await page.locator('#levels-toggle').click();
  await primaryFits(page);
  await page.screenshot({ path: 'output/current/world/map-phone-fr.png' });
  await page.getByRole('button', { name: 'Jouer le niveau suivant' }).tap();
  expect(await state(page)).toMatchObject({ screen: 'game', source: 'campaign', levelIndex: 31 });
});

test('a completed campaign makes its film the single primary action', async ({ page }) => {
  await page.addInitScript(completed => localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed, muted: true })), CAMPAIGN.map(level => level.id));
  await page.goto('/'); await ready(page);
  await expect(page.locator('.wv-play')).toHaveCount(0);
  await expect(page.locator('.wv-primary .wv-film-button')).toHaveCount(1);
  await primaryFits(page);
  await page.getByRole('button', { name: 'Watch your machine' }).tap();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'film');
  await page.locator('#film-skip').tap();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
});

test('finishing a location earns its film, skip connects to the next location, and replay survives reload', async ({ page }) => {
  test.setTimeout(240_000);
  await page.addInitScript(completed => {
    if (!localStorage.getItem('tumbleworks.progress.v1')) localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed, current: completed.at(-1), muted: true }));
  }, CAMPAIGN.slice(0, 29).map(level => level.id));
  const filmRequests: string[] = [];
  page.on('request', request => { if (/\/films\/|\.mp4(?:\?|$)/.test(request.url())) filmRequests.push(request.url()); });
  await page.goto('/'); await ready(page);
  await page.locator('.map-stop[data-round="9"]').tap();
  await expect(page.locator('#journey-transition')).toBeHidden();
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  await solve(page, 29);
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'film');
  expect(await page.evaluate(() => {
    const world = ((window as unknown as GameWindow).tumbleworks.app as unknown as { world: FilmProbe }).world;
    return world.scene?.constructionProgress;
  }), 'the earned structure is fully constructed before carrying its marble').toBe(1);
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = false; });
  const filmEntities = (await filmSnapshot(page)).entities;
  await movingFilm(page, filmEntities - 1);
  await page.locator('#film-skip').tap();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
  await expect(page.locator('.wv-heading h1')).toHaveText('Glasshouse Gardens');
  expect((await filmSnapshot(page)).entities).toBe(filmEntities - 1);
  await expect(page.locator('.map-stop[data-round="10"]')).toBeEnabled();
  await page.reload(); await ready(page);
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
  await page.getByRole('button', { name: 'Previous location', exact: true }).click();
  const replayEntities = (await filmSnapshot(page)).entities;
  await page.getByRole('button', { name: 'Watch your machine' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'film');
  await movingFilm(page, replayEntities);
  await page.locator('#film-skip').click();
  expect((await filmSnapshot(page)).entities).toBe(replayEntities);
  await expect(page.locator('#journey-transition')).toBeHidden();
  await expect(page.locator('.wv-heading h1')).toHaveText('Little Harbour');
  await page.getByRole('button', { name: 'Next location', exact: true }).click();
  await page.locator('.map-stop[data-round="10"]').tap();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'game');
  await expect(page.locator('canvas[data-world-playback]')).toHaveCount(0);
  expect(filmRequests).toEqual([]);
  expect(await state(page)).toMatchObject({ source: 'campaign', levelIndex: 30, screen: 'game' });
});

test('reduced motion keeps a chapter replay still until Play film is explicitly tapped', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(completed => localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed, muted: true })), CAMPAIGN.slice(0, 30).map(level => level.id));
  await page.goto('/'); await ready(page);
  await page.getByRole('button', { name: 'Previous location', exact: true }).click();
  await page.getByRole('button', { name: 'Watch your machine' }).click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'film');
  const still = await filmSnapshot(page);
  expect(still.time).toBe(0);
  await page.evaluate(() => { const app = (window as unknown as GameWindow).tumbleworks.app; for (let i = 0; i < 60; i++) app.advance(1 / 60); });
  expect(await filmSnapshot(page)).toEqual(still);
  // Resizing clears the renderer's backing buffer even while explicit playback is paused.
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    const draw = app.stage.draw;
    const probe = window as unknown as Window & { pausedFilmDraws: number; restorePausedFilmDraw: () => void };
    probe.pausedFilmDraws = 0;
    app.stage.draw = (...args) => { probe.pausedFilmDraws++; return draw.apply(app.stage, args); };
    probe.restorePausedFilmDraw = () => { app.stage.draw = draw; };
  });
  try {
    await page.setViewportSize({ width: 390, height: 720 });
    await expect.poll(() => page.evaluate(() => (window as unknown as Window & { pausedFilmDraws: number }).pausedFilmDraws),
      { message: 'a paused film redraws its cleared canvas once after resize' }).toBe(1);
    const resized = await filmSnapshot(page);
    expect(resized.time).toBe(still.time);
    expect(resized.position).toEqual(still.position);
    expect(resized.camera?.slice(3, 7)).toEqual(still.camera?.slice(3, 7));
    expect(resized.fingerprint).toBe(still.fingerprint); expect(resized.steps).toBe(still.steps);
    await page.evaluate(() => { const app = (window as unknown as GameWindow).tumbleworks.app; for (let i = 0; i < 60; i++) app.advance(1 / 60); });
    expect(await page.evaluate(() => (window as unknown as Window & { pausedFilmDraws: number }).pausedFilmDraws)).toBe(1);
    expect(await filmSnapshot(page)).toEqual(resized);
  } finally {
    await page.evaluate(() => (window as unknown as Window & { restorePausedFilmDraw: () => void }).restorePausedFilmDraw());
    await page.setViewportSize({ width: 375, height: 690 });
  }
  await page.getByRole('button', { name: 'Play film', exact: true }).click();
  await movingFilm(page, still.entities - 1, true);
  await page.locator('#film-skip').click();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
});
