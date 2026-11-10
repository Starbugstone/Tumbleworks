import { mkdirSync, writeFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';
import type { MarbleEntity } from '../../src/engine/marbles';
import type { App } from '../../src/view/App';
import type { WorldScene } from '../../src/view/world-scene';
import type { VillageMachine } from '../../src/view/village-machine';
import type { VillagePlan } from '../../src/world/village-plan';
import { DESKTOP, PHONE } from '../fixtures/viewports';

const output = process.env.TUMBLEWORKS_WORLD_RUBE_OUTPUT ?? 'output/current/world-3d/rube';
type FilmWorld = { readonly filmTime: number; readonly scene: WorldScene | null };
type SceneProbe = { readonly machine: VillageMachine; readonly plan: VillagePlan; readonly marble: MarbleEntity | null };
type GameWindow = Window & { tumbleworks: { app: App } };

async function snapshot(page: Page) {
  return page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    const world = (app as unknown as { world: FilmWorld }).world;
    const scene = world.scene;
    if (!scene) throw new Error('Film has no current village scene');
    const probe = scene as unknown as SceneProbe, actor = probe.marble;
    const contacts = probe.machine.route.contacts;
    const transforms: Record<string, number[]> = {};
    for (const { moverIds } of contacts) for (const name of moverIds) {
      const object = scene.scene.getObjectByName(name);
      if (!object) throw new Error(`Missing authored village mover ${name}`);
      object.updateWorldMatrix(true, false);
      // Carriers deliberately own their matrices, so position/rotation alone miss real travel.
      transforms[name] = object.matrix.toArray();
    }
    let actorPoint: number[] | null = null;
    if (actor) actorPoint = actor.mesh.getWorldPosition(actor.mesh.position.clone()).project(scene.camera).toArray();
    return { chapter: scene.chapter, time: world.filmTime, contacts, shots: scene.filmShots, duration: probe.machine.route.duration,
      transfers: probe.machine.route.transfers, motionStatus: probe.machine.route.motionStatus, transforms,
      actorPosition: actor?.mesh.position.toArray() ?? null, actorVisible: actor?.mesh.visible ?? false, actorPoint,
      entities: app.stage.marbles.count,
      camera: [...scene.camera.position.toArray(), ...scene.camera.quaternion.toArray(), scene.camera.zoom, scene.camera.fov],
      fingerprint: app.runtime.game.fingerprint(), steps: app.runtime.game.steps,
      progress: localStorage.getItem('tumbleworks.progress.v1'), films: localStorage.getItem('tumbleworks.valley.v1') };
  });
}
type Snapshot = Awaited<ReturnType<typeof snapshot>>;

async function seedAndOpen(page: Page, chapter: number, reduced = false) {
  await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
  // Presentation fixture only: this does not claim that the test won 180 puzzles.
  await page.addInitScript(ids => localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed: ids, muted: true })), CAMPAIGN.map(level => level.id));
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 120_000 });
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
  await expect(page.locator('#journey-transition')).toBeHidden();
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  const current = () => page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    return (app as unknown as { world: FilmWorld }).world.scene?.chapter;
  });
  let shown = await current();
  while (shown !== chapter) {
    if (shown === undefined || shown < chapter) throw new Error(`Expected a completed chapter at or after ${chapter}; found ${shown}`);
    await page.getByRole('button', { name: 'Previous location', exact: true }).tap();
    await expect.poll(current).toBe(shown - 1); shown--;
  }
  const baseline = await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    return { entities: app.stage.marbles.count, fingerprint: app.runtime.game.fingerprint(), steps: app.runtime.game.steps,
      progress: localStorage.getItem('tumbleworks.progress.v1') };
  });
  await startFilm(page, reduced);
  return baseline;
}
async function startFilm(page: Page, reduced = false) {
  await page.getByRole('button', { name: 'Watch your machine' }).tap();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'film');
  await expect(page.locator('canvas[data-world-playback="realtime-3d"]')).toBeVisible();
  if (reduced) await page.getByRole('button', { name: 'Play film', exact: true }).tap();
}
async function advanceTo(page: Page, target: number) {
  await page.evaluate(target => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    const world = (app as unknown as { world: FilmWorld }).world;
    if (target < world.filmTime - 1e-8) throw new Error('Film probes must advance monotonically');
    for (let tick = 0; target - world.filmTime > 1e-8; tick++) {
      if (tick > 1000 || app.debugState().screen !== 'film') throw new Error(`Film stopped before ${target}s`);
      app.advance(Math.min(1 / 30, target - world.filmTime));
    }
  }, target);
  return snapshot(page);
}
function unchangedGame(actual: Snapshot, baseline: { entities: number; fingerprint: string; steps: number; progress: string | null }) {
  expect(actual.entities).toBe(baseline.entities + 1);
  expect(actual.fingerprint).toBe(baseline.fingerprint); expect(actual.steps).toBe(baseline.steps);
  expect(actual.progress).toBe(baseline.progress);
}
function actorFramed(value: Snapshot) {
  expect(value.actorVisible).toBe(true); expect(value.actorPoint).not.toBeNull();
  const [x, y, z] = value.actorPoint!;
  expect(Math.abs(x!)).toBeLessThan(0.95); expect(Math.abs(y!)).toBeLessThan(0.9);
  expect(z!).toBeGreaterThan(-1); expect(z!).toBeLessThan(1);
  expect(value.camera.at(-1)).toBe(34);
}
async function back(page: Page, baselineEntities: number) {
  await page.locator('#film-skip').tap();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
  await expect(page.locator('#journey-transition')).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.stage.marbles.count)).toBe(baselineEntities);
}

test.use({ viewport: PHONE, deviceScaleFactor: 1 });
test.beforeAll(() => mkdirSync(output, { recursive: true }));

for (let chapter = 0; chapter < 6; chapter++) {
  test(`village ${chapter + 1}: its actual marble causes its own mechanisms and replay is identical`, async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const baseline = await seedAndOpen(page, chapter);
    const initial = await snapshot(page), contacts = [...initial.contacts].sort((a, b) => a.contact - b.contact);
    expect(initial.chapter).toBe(chapter); expect(contacts).toHaveLength(10);
    const times = [...new Set([0, ...contacts.flatMap(contact => [Math.max(0, contact.contact - 0.001), contact.contact,
      contact.contact + (contact.end - contact.contact) * 0.4, Math.min(contact.end, initial.duration - 0.000001)]), Math.max(0, initial.duration - 0.4)])].sort((a, b) => a - b);
    const frames: Snapshot[] = [];
    for (const time of times) {
      const value = await advanceTo(page, time); frames.push(value); unchangedGame(value, baseline);
      expect(value.films).toBe(initial.films); actorFramed(value);
      for (const future of contacts) if (time < future.contact) for (const id of future.moverIds) {
        expect(value.transforms[id], `${id} remains still until its causal contact`).toEqual(initial.transforms[id]);
      }
      const contact = contacts.find(contact => time === contact.contact + (contact.end - contact.contact) * 0.4);
      if (contact) await page.screenshot({ path: `${output}/phone-village-${chapter + 1}-contact-${contact.stop}.png` });
    }
    const at = (time: number) => frames[times.indexOf(time)]!;
    for (const contact of contacts) {
      const before = at(Math.max(0, contact.contact - 0.001));
      const after = at(contact.contact + (contact.end - contact.contact) * 0.4);
      for (const id of contact.moverIds) expect(before.transforms[id], `${id} waits for its cause`).toEqual(initial.transforms[id]);
      if (contact.moverIds.length) expect(contact.moverIds.some(id => JSON.stringify(after.transforms[id]) !== JSON.stringify(before.transforms[id])),
        `stop ${contact.stop} visibly responds after marble contact`).toBe(true);
      expect(after.actorPosition).not.toEqual(before.actorPosition);
    }
    writeFileSync(`${output}/phone-village-${chapter + 1}-causal-snapshots.json`, JSON.stringify(frames, null, 2));
    await back(page, baseline.entities); await startFilm(page);
    for (const [index, time] of times.entries()) {
      const replay = await advanceTo(page, time);
      // Returning to the map may acknowledge the film; replay preserves all mechanical and gameplay state.
      expect({ ...replay, films: null }).toEqual({ ...frames[index]!, films: null });
    }
    await page.addStyleTag({ content: '#scene { filter: grayscale(1); }' });
    await page.screenshot({ path: `${output}/phone-village-${chapter + 1}-grayscale.png` });
    await back(page, baseline.entities); expect(errors).toEqual([]);
  });

  test(`village ${chapter + 1}: reduced film uses its compiled still shots on phone and desktop`, async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
    const baseline = await seedAndOpen(page, chapter, true), initial = await snapshot(page);
    expect(initial.shots.length).toBeLessThanOrEqual(7);
    for (const [label, viewport] of [['phone', PHONE], ['desktop', DESKTOP]] as const) {
      if (label === 'desktop') { await page.setViewportSize(viewport); await startFilm(page, true); }
      const frames: Snapshot[] = [];
      const times = [...new Set([...initial.shots.flatMap(shot => [shot.start + 0.1, shot.start + 0.25]),
        ...initial.contacts.flatMap(contact => [contact.contact, contact.contact + (contact.end - contact.contact) * 0.4])])].sort((a, b) => a - b);
      for (const time of times) {
        const frame = await advanceTo(page, time); unchangedGame(frame, baseline); actorFramed(frame); frames.push(frame);
        if (initial.shots.some(shot => time === shot.start + 0.1)) {
          await page.screenshot({ path: `${output}/${label}-village-${chapter + 1}-reduced-${time}.png` });
        }
      }
      for (const shot of initial.shots) {
        expect(shot.end - shot.start).toBeGreaterThanOrEqual(2);
        const first = frames[times.indexOf(shot.start + 0.1)]!, second = frames[times.indexOf(shot.start + 0.25)]!;
        expect(second.camera, `fixed shot ${shot.start}`).toEqual(first.camera);
      }
      for (const transfer of initial.transfers) expect(initial.shots.slice(1).every(shot => shot.start < transfer.start || shot.start > transfer.end)).toBe(true);
      for (const contact of initial.contacts) expect(initial.shots.slice(1).every(shot => shot.start <= contact.contact - 0.3 || shot.start > contact.contact)).toBe(true);
      expect(initial.shots[0]!.start).toBe(0); expect(initial.shots.at(-1)!.end).toBe(initial.duration);
      writeFileSync(`${output}/${label}-village-${chapter + 1}-reduced-snapshots.json`, JSON.stringify(frames, null, 2));
      await back(page, baseline.entities);
    }
    expect(errors).toEqual([]);
  });
}
