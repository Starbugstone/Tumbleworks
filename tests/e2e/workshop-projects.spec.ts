import { mkdirSync } from 'node:fs';
import { expect, test, type Locator, type Page } from '@playwright/test';
import type { Mesh } from 'three';
import { CAMPAIGN } from '../../src/campaign';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
import type { App } from '../../src/view/App';
import type { ValleyOverview } from '../../src/view/valley-overview';
import type { WorldScene } from '../../src/view/world-scene';
import { WORKSHOP_PROJECTS } from '../../src/world/workshop-projects';
import { VARIETY_FUNNEL_WITNESSES } from '../variety-witnesses';
import { DESKTOP, PHONE } from '../fixtures/viewports';

type ProjectApp = Pick<App, 'runtime' | 'stage' | 'advance' | 'debugState' | 'debugTargets' | 'manualClock' | 'replay'> & {
  readonly world: { readonly scene: WorldScene | null; readonly valley: ValleyOverview | null; readonly dirty: boolean };
};
type GameWindow = Window & { tumbleworks: { app: ProjectApp } };
const PROGRESS_KEY = 'tumbleworks.progress.v1';
const FILM_KEY = 'tumbleworks.valley.v1';
const output = 'output/current/workshop-projects';
const campaignIds = (count: number): string[] => CAMPAIGN.slice(0, count).map(level => level.id);
const state = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
const projectCard = (page: Page, id: string): Locator => page.locator(`.wv-experiment[data-workshop="${id}"]`);
const completed = (page: Page): Promise<string[]> => page.evaluate(key => JSON.parse(localStorage.getItem(key)!).completed, PROGRESS_KEY);

async function seed(page: Page, ids: readonly string[], language: 'en' | 'fr' = 'en'): Promise<void> {
  await page.addInitScript(({ ids, language, first }) => {
    if (!localStorage.getItem('tumbleworks.progress.v1')) localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed: ids, current: first, muted: true }));
    if (!localStorage.getItem('tumbleworks.preferences.v1')) localStorage.setItem('tumbleworks.preferences.v1', JSON.stringify({ locale: language, guides: [] }));
    if (!localStorage.getItem('tumbleworks.valley.v1')) localStorage.setItem('tumbleworks.valley.v1', JSON.stringify({ seen: [], chapter: 0 }));
  }, { ids, language, first: CAMPAIGN[0]!.id });
}

async function ready(page: Page, screen: 'map' | 'workshop' | 'game'): Promise<void> {
  await expect(page.locator('#boot')).toBeHidden({ timeout: 120_000 });
  await expect(page.locator('body')).toHaveAttribute('data-screen', screen);
  await expect(page.locator('#journey-transition')).toBeHidden();
  await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.advance(0));
}

async function openWorkshop(page: Page): Promise<void> {
  await page.locator('#world-workshop').tap();
  await ready(page, 'workshop');
  await expect(page.locator('.wv-project-group')).toHaveCount(6);
  await expect(page.locator('.wv-experiment[data-workshop]')).toHaveCount(7);
}

async function tapElement(page: Page, target: Locator): Promise<void> {
  await target.scrollIntoViewIfNeeded();
  const box = await target.boundingBox();
  expect(box).not.toBeNull();
  if (!box) throw new Error('Touch target has no bounds');
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
}

async function tapPiece(page: Page, target: string): Promise<void> {
  const point = await page.evaluate(key => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[key], target);
  expect(point, `real target ${target}`).toBeDefined();
  if (!point) throw new Error(`Missing puzzle target ${target}`);
  expect(point.x).toBeGreaterThan(0); expect(point.x).toBeLessThan(PHONE.width);
  expect(point.y).toBeGreaterThan(35); expect(point.y).toBeLessThan(PHONE.height - 65);
  await page.touchscreen.tap(point.x, point.y);
}

async function settle(page: Page): Promise<void> {
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    for (let tick = 0; tick < 7200; tick++) {
      const current = app.debugState();
      if (!current.busy && !current.settling) { app.advance(0); return; }
      app.advance(1 / 60, false);
    }
    throw new Error(`Project failed to settle: ${JSON.stringify(app.debugState())}`);
  });
}

async function leaveGame(page: Page): Promise<void> {
  await page.locator('#levels-toggle').tap();
  await page.locator('#map-open').tap();
  await ready(page, 'map');
}

async function rewardArt(page: Page, id: string): Promise<void> {
  const art = await page.evaluate(projectId => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    const reward = app.world.scene?.scene.getObjectByName(`project-${projectId}`);
    let meshes = 0, vertices = 0;
    reward?.traverse(object => {
      if (object.type !== 'Mesh') return;
      meshes++;
      vertices += (object as Mesh).geometry.getAttribute('position').count;
    });
    return { name: reward?.name, visible: reward?.visible, meshes, vertices };
  }, id);
  expect(art).toMatchObject({ name: `project-${id}`, visible: true, meshes: 1 });
  expect(art.vertices).toBeGreaterThan(0);
}

async function cardsFit(page: Page): Promise<void> {
  await page.evaluate(async () => { await document.fonts.ready; });
  for (const article of await page.locator('.wv-project').all()) {
    await article.scrollIntoViewIfNeeded();
    const card = article.locator('.wv-experiment');
    const box = (await card.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0); expect(box.x + box.width).toBeLessThanOrEqual(page.viewportSize()!.width);
    const clipped = await article.locator('button, strong, .wv-project-status').evaluateAll(elements => elements.some(element => element.scrollWidth > element.clientWidth + 1));
    expect(clipped, 'project titles, status and actions fit without horizontal clipping').toBe(false);
    const image = article.locator('.wv-project-reward');
    await expect.poll(() => image.evaluate(element => element instanceof HTMLImageElement && element.complete && element.naturalWidth > 0)).toBe(true);
    await expect(image).toHaveAttribute('src', /\/models\/projects\/[^/]+\.png$/);
    const cue = article.locator('.wv-project-cue');
    await expect.poll(() => cue.evaluate(element => element instanceof HTMLImageElement && element.complete && element.naturalWidth === 128)).toBe(true);
    await expect(cue).toHaveAttribute('src', `/models/projects/cues/${await card.getAttribute('data-workshop')}.png`);
    const rewardBox = (await image.boundingBox())!, cueBox = (await cue.boundingBox())!;
    expect(rewardBox.width).toBeGreaterThan(cueBox.width);
    expect(cueBox.y).toBeGreaterThanOrEqual(rewardBox.y + rewardBox.height + 3);
    await expect(card.locator('.wv-project-status')).toContainText('✓');
    await expect(article.locator('[data-project-village]')).toHaveText('Voir le village');
    expect((await article.locator('[data-project-village]').boundingBox())!.height).toBeGreaterThanOrEqual(44);
  }
}

test.use({ viewport: PHONE, deviceScaleFactor: 1 });
test.beforeAll(() => mkdirSync(output, { recursive: true }));

for (const count of [0, 5]) test(`locked project deep link with ${count} campaign completions opens the Workshop and refuses a real touch`, async ({ page }) => {
  const ids = campaignIds(count);
  await seed(page, ids);
  await page.goto('/?workshop=board-210');
  await ready(page, 'workshop');
  expect(new URL(page.url()).searchParams.has('workshop')).toBe(false);
  expect(await state(page)).toMatchObject({ screen: 'workshop', source: 'campaign' });
  expect((await state(page)).levelId).not.toBe('board-210');
  const card = projectCard(page, 'board-210');
  await expect(card).toHaveAttribute('data-status', 'locked');
  await expect(card).toHaveAttribute('aria-disabled', 'true');
  await expect(card.locator('.wv-project-status')).toHaveText(`⚑ Locked · Little Harbour: ${count === 0 ? 0 : 1} of 2 stops built`);
  await expect(card.locator('.wv-project-status')).not.toContainText('🔒');
  await card.locator('.wv-project-status').evaluate(element => {
    const observer = new MutationObserver(() => {
      if (element.classList.contains('wv-required')) {
        document.documentElement.dataset['projectBlocked'] = 'true'; observer.disconnect();
      }
    });
    observer.observe(element, { attributes: true, attributeFilter: ['class'] });
  });
  const before = await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    return { fingerprint: app.runtime.game.fingerprint(), state: app.debugState(), saved: localStorage.getItem('tumbleworks.progress.v1') };
  });
  await tapElement(page, card);
  await expect(page.locator('html')).toHaveAttribute('data-project-blocked', 'true');
  expect(await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    return { fingerprint: app.runtime.game.fingerprint(), state: app.debugState(), saved: localStorage.getItem('tumbleworks.progress.v1') };
  })).toEqual(before);
});

test('finishing the third real puzzle builds the second stop and unlocks its project at the exact boundary', async ({ page }) => {
  await seed(page, campaignIds(5));
  await page.goto('/'); await ready(page, 'map');
  await expect(page.locator('.map-stop[data-status="built"]')).toHaveCount(1);
  await expect(page.locator('#world-workshop .wv-project-notice')).toHaveCount(0);
  await page.locator('.map-stop[data-round="1"]').tap();
  await ready(page, 'game');
  expect(await state(page)).toMatchObject({ source: 'campaign', levelIndex: 5, levelId: CAMPAIGN[5]!.id, kind: 'tube' });
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  const solution = TUBE_BOARDS.find(board => board.id === CAMPAIGN[5]!.id)!.solution;
  for (const move of solution) {
    await tapPiece(page, `tube${move.from}`); await tapPiece(page, `tube${move.to}`); await settle(page);
  }
  await ready(page, 'map');
  await expect(page.locator('.map-stop[data-status="built"]')).toHaveCount(2);
  await expect(page.locator('#world-workshop .wv-project-notice')).toHaveCount(1);
  expect(await completed(page)).toEqual(campaignIds(6));
  await openWorkshop(page);
  const card = projectCard(page, 'board-210');
  await expect(card).toHaveAttribute('data-status', 'available');
  await expect(card).toHaveAttribute('aria-disabled', 'false');
  await card.tap(); await ready(page, 'game');
  expect(await state(page)).toMatchObject({ source: 'workshop', levelId: 'board-210' });
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.runtime.guideId)).toBe('project-board-210');
  await expect(page.locator('#guide-pointer')).toBeVisible();
  await expect(page.locator('#guide-text')).not.toBeEmpty();
  expect(new URL(page.url()).searchParams.get('workshop')).toBe('board-210');
});

test('old completed projects keep every reward and replay without constructing main stops or unlocking villages', async ({ page }) => {
  test.setTimeout(360_000);
  const oldIds = ['tray-1', 'connected-1', ...WORKSHOP_PROJECTS.map(project => project.id)];
  await seed(page, oldIds);
  await page.goto('/'); await ready(page, 'map');
  await expect(page.locator('.map-stop[data-status="built"]')).toHaveCount(0);
  await openWorkshop(page);
  await expect(page.locator('.wv-experiment[data-status="completed"]')).toHaveCount(7);
  for (const project of WORKSHOP_PROJECTS) {
    const card = projectCard(page, project.id);
    await expect(card).toHaveAttribute('aria-disabled', 'false');
    await expect(card.locator('.wv-workshop-check')).toHaveText('✓');
    await page.locator(`[data-project-village="${project.id}"]`).tap(); await ready(page, 'map');
    expect(await state(page)).toMatchObject({ worldChapter: project.chapter, worldView: 'map' });
    await rewardArt(page, project.id);
    await expect(page.locator('.map-stop[data-status="built"]')).toHaveCount(0);
    await expect(page.locator('.map-stop:not(:disabled)')).toHaveCount(project.chapter === 0 ? 1 : 0);
    await openWorkshop(page);
    await projectCard(page, project.id).tap(); await ready(page, 'game');
    expect(await state(page)).toMatchObject({ source: 'workshop', levelId: project.id });
    await leaveGame(page); await openWorkshop(page);
  }
  await page.getByRole('button', { name: 'Back to the village' }).tap(); await ready(page, 'map');
  await page.getByRole('button', { name: 'The valley', exact: true }).tap();
  await page.waitForFunction(() => (window as unknown as GameWindow).tumbleworks.app.world.valley !== null);
  await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.advance(0));
  await expect(page.locator('.wv-location[data-chapter="5"]')).toHaveAttribute('aria-disabled', 'true');
  await expect(page.locator('.wv-location small')).toHaveText(Array(6).fill('0/10'));
  const overview = await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    return { villages: app.world.valley?.scene.children.filter(object => object.name.startsWith('valley-village-') && object.visible).length,
      triangles: app.stage.renderer.info.render.triangles };
  });
  expect(overview.villages).toBe(6); expect(overview.triangles).toBeGreaterThan(0);
  expect(await completed(page)).toEqual(oldIds);
});

test('a true project win adds its visible village reward before reload and preserves campaign and film progress', async ({ page }) => {
  test.setTimeout(360_000);
  const main = campaignIds(21);
  await seed(page, main);
  await page.goto('/'); await ready(page, 'map');
  await openWorkshop(page);
  await expect(projectCard(page, 'board-212')).toHaveAttribute('data-status', 'available');
  const saved = await page.evaluate(key => localStorage.getItem(key), FILM_KEY);
  const current = await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).current, PROGRESS_KEY);
  await projectCard(page, 'board-212').tap(); await ready(page, 'game');
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  if (await page.locator('#guide-skip').isVisible()) await page.locator('#guide-skip').tap();
  await page.locator('#restart').tap();
  await settle(page);
  for (const letter of VARIETY_FUNNEL_WITNESSES['board-212']!) {
    await tapPiece(page, `supply${letter.charCodeAt(0) - 65}`); await settle(page);
  }
  expect(await state(page)).toMatchObject({ screen: 'game', source: 'workshop', levelId: 'board-212', status: 'won', busy: false });
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.replay().actions.filter(action => action.type === 'tap').length)).toBe(6);
  await page.getByRole('button', { name: 'Back to workshop', exact: true }).tap(); await ready(page, 'workshop');
  await expect(projectCard(page, 'board-212')).toHaveAttribute('data-status', 'completed');
  await page.locator('[data-project-village="board-212"]').tap(); await ready(page, 'map');
  await rewardArt(page, 'board-212');
  await expect(page.locator('.map-stop[data-status="built"]')).toHaveCount(7);
  expect(await completed(page)).toEqual([...main, 'board-212']);
  expect(await page.evaluate(key => JSON.parse(localStorage.getItem(key)!).current, PROGRESS_KEY)).toBe(current);
  expect(await page.evaluate(key => localStorage.getItem(key), FILM_KEY)).toBe(saved);
  await page.screenshot({ path: `${output}/earned-bells-phone.png` });
  await page.reload(); await ready(page, 'map'); await rewardArt(page, 'board-212');
  await openWorkshop(page);
  await expect(projectCard(page, 'board-212')).toHaveAttribute('data-status', 'completed');
  expect(await completed(page)).toEqual([...main, 'board-212']);
  expect(await page.evaluate(key => localStorage.getItem(key), FILM_KEY)).toBe(saved);
});

test('French project cards retain real previews, check marks and reachable actions in grayscale with reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await seed(page, WORKSHOP_PROJECTS.map(project => project.id), 'fr');
  await page.goto('/'); await ready(page, 'map'); await openWorkshop(page);
  await expect(page.locator('.wv-heading h1')).toHaveText('L’atelier');
  await expect(page.locator('.wv-project-group[data-chapter="5"] h2')).toHaveText('La verrerie des hauteurs');
  await page.addStyleTag({ content: '#world, #scene { filter: grayscale(1); }' });
  await cardsFit(page);
  await projectCard(page, 'board-210').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/phone-fr-grayscale.png` });
  await page.setViewportSize(DESKTOP);
  await cardsFit(page);
  await projectCard(page, 'board-210').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${output}/desktop-fr-grayscale.png` });
});
