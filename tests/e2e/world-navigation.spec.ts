import { openMenuSettings } from '../fixtures/picker';
import { expect, test, type Page } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';
import type { App } from '../../src/view/App';
import type { ValleyOverview } from '../../src/view/valley-overview';
import { DESKTOP, PHONE } from '../fixtures/viewports';

type ValleyApp = Pick<App, 'stage' | 'runtime' | 'advance' | 'debugState' | 'debugTargets' | 'manualClock' | 'replay'> & {
  readonly world: { readonly valley: ValleyOverview | null; readonly dirty: boolean };
};
type GameWindow = Window & { tumbleworks: { app: ValleyApp } };

const state = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());

async function ready(page: Page): Promise<void> {
  await expect(page.locator('#boot')).toBeHidden({ timeout: 120_000 });
  await expect(page.locator('#journey-transition')).toBeHidden();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
}

async function overview(page: Page, language: 'en' | 'fr' = 'en'): Promise<void> {
  await page.getByRole('button', { name: language === 'en' ? 'Islands' : 'Îles', exact: true }).click();
  const locations = page.getByRole('navigation', { name: language === 'en' ? 'Islands' : 'Îles' });
  await expect(locations).toHaveCount(1);
  // Its projected children are fixed on the canvas; the navigation itself has no layout height.
  await expect(locations.getByRole('button').first()).toBeVisible();
  await page.waitForFunction(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    return app.world.valley !== null && app.world.dirty === false;
  });
  expect(await state(page)).toMatchObject({ screen: 'map', worldView: 'overview' });
}

async function labelsFit(page: Page): Promise<void> {
  await page.evaluate(async () => { await document.fonts.ready; });
  const boxes = await page.locator('.wv-location[data-chapter]').evaluateAll(buttons => buttons.map(button => {
    const rect = button.getBoundingClientRect();
    const style = getComputedStyle(button);
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height,
      clipped: button.scrollWidth > button.clientWidth || button.scrollHeight > button.clientHeight,
      ellipsis: style.textOverflow === 'ellipsis' };
  }));
  expect(boxes).toHaveLength(Math.min(6, Math.ceil(CAMPAIGN.length / 30)));
  const viewport = page.viewportSize()!;
  for (const [index, box] of boxes.entries()) {
    expect(box.width).toBeLessThanOrEqual(150);
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width);
    expect(box.y).toBeGreaterThanOrEqual(120);
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height - 66);
    expect(box.clipped).toBe(false); expect(box.ellipsis).toBe(false);
    for (const other of boxes.slice(index + 1)) {
      expect(box.x + box.width <= other.x || other.x + other.width <= box.x || box.y + box.height <= other.y || other.y + other.height <= box.y,
        'each village label has its own touch area').toBe(true);
    }
  }
}

test('the phone overview shows six compact village labels over resting 3D terrain and explains a locked tap', async ({ page }) => {
  await page.setViewportSize(PHONE);
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/'); await ready(page); await overview(page);
  await labelsFit(page);
  await expect(page.locator('.wv-location[data-chapter="0"]')).toHaveAttribute('aria-current', 'location');
  await expect(page.locator('.wv-location[data-chapter="1"]')).toHaveAttribute('aria-disabled', 'true');
  const art = await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    return { camera: app.world.valley?.camera.type, terrain: app.world.valley?.scene.children.filter(child => child.name.startsWith('valley-village-')).every(child => Boolean(child.getObjectByProperty('type', 'Mesh'))),
      villages: app.world.valley?.scene.children.filter(child => child.name.startsWith('valley-village-') && child.visible).length,
      triangles: app.stage.renderer.info.render.triangles };
  });
  expect(art).toMatchObject({ camera: 'PerspectiveCamera', terrain: true, villages: 6 });
  expect(art.triangles).toBeGreaterThan(10_000); expect(art.triangles).toBeLessThanOrEqual(20_000);
  const before = await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    return { frame: app.stage.renderer.info.render.frame, fingerprint: app.runtime.game.fingerprint(), save: localStorage.getItem('tumbleworks.progress.v1') };
  });
  await page.evaluate(() => { const app = (window as unknown as GameWindow).tumbleworks.app; for (let index = 0; index < 120; index++) app.advance(1 / 60); });
  expect(await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    return { frame: app.stage.renderer.info.render.frame, fingerprint: app.runtime.game.fingerprint(), save: localStorage.getItem('tumbleworks.progress.v1') };
  })).toEqual(before);
  // aria-disabled conveys the lock while a real tap still explains the prerequisite.
  const locked = (await page.locator('.wv-location[data-chapter="1"]').boundingBox())!;
  await page.touchscreen.tap(locked.x + locked.width / 2, locked.y + locked.height / 2);
  await expect(page.locator('.wv-heading p')).toHaveText('Finish Little Harbour to open this island.');
  expect(await state(page)).toMatchObject({ worldChapter: 0, worldView: 'overview' });
  await page.screenshot({ path: 'output/current/world/navigation-phone.png' });
  await page.getByRole('button', { name: 'Back to the village' }).tap();
  await expect(page.locator('.wv-heading h1')).toHaveText('Little Harbour');
  expect(errors).toEqual([]);
});

test('available villages, keyboard navigation and built-stop replay retain their destinations', async ({ page }) => {
  await page.addInitScript(completed => localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed, muted: true })), CAMPAIGN.slice(0, 30).map(level => level.id));
  await page.goto('/'); await ready(page); await overview(page);
  await expect(page.locator('.wv-location[data-chapter="1"]')).toHaveAttribute('aria-current', 'location');
  await page.locator('.wv-location[data-chapter="0"]').tap();
  await expect(page.locator('.wv-heading h1')).toHaveText('Little Harbour');
  await overview(page);
  await page.locator('.wv-location[data-chapter="0"]').focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('.wv-location[data-chapter="1"]')).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.wv-heading h1')).toHaveText('Glasshouse Gardens');
  await overview(page);
  await page.locator('.wv-location[data-chapter="1"]').focus();
  await page.keyboard.press('Escape');
  await expect(page.locator('.wv-heading h1')).toHaveText('Glasshouse Gardens');
  await overview(page);
  await page.locator('.wv-location[data-chapter="0"]').tap();
  await page.locator('.map-stop[data-round="0"]').tap();
  await expect(page.locator('#journey-transition')).toBeHidden();
  expect(await state(page)).toMatchObject({ screen: 'game', source: 'campaign', levelIndex: 0 });
});

test('visiting the wider valley preserves an unfinished puzzle and its Undo state', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await page.getByRole('button', { name: 'Play next level' }).tap();
  await expect(page.locator('#journey-transition')).toBeHidden();
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  const initial = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.replay().fingerprint);
  const at = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugTargets()['supply0']);
  await page.touchscreen.tap(at!.x, at!.y);
  const accepted = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.replay().fingerprint);
  expect(accepted).not.toBe(initial);
  await page.locator('#levels-toggle').click(); await page.locator('#map-open').click();
  await overview(page);
  await page.getByRole('button', { name: 'Back to the village' }).tap();
  await page.getByRole('button', { name: 'Play next level' }).tap();
  await expect(page.locator('#journey-transition')).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.replay().fingerprint)).toBe(accepted);
  await page.getByRole('button', { name: 'Undo', exact: true }).tap();
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.replay().fingerprint)).toBe(initial);
});

test('French overview labels wrap without clipping on the phone and existing desktop layout', async ({ page }) => {
  await page.goto('/'); await ready(page);
  await page.locator('#levels-toggle').click(); await openMenuSettings(page); await page.getByRole('button', { name: 'Français', exact: true }).click();
  if (await page.locator('#levels').isVisible()) await page.locator('#levels-toggle').click();
  await expect(page.getByRole('navigation', { name: 'Étapes de construction' })).toHaveCount(1);
  await overview(page, 'fr');
  await labelsFit(page);
  await expect(page.locator('.wv-location[data-chapter="0"]')).toContainText('Le petit port');
  await page.screenshot({ path: 'output/current/world/navigation-phone-fr.png' });
  const touch = await page.context().newCDPSession(page);
  const label = (chapter: number) => page.locator(`.wv-location[data-chapter="${chapter}"]`);
  const swipe = async (dx: number, dy: number, end: 'touchEnd' | 'touchCancel'): Promise<void> => {
    const box = (await label(4).boundingBox())!;
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await touch.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x + dx, y: y + dy, id: 1 }] });
    await touch.send('Input.dispatchTouchEvent', { type: end, touchPoints: [] });
  };
  await label(0).focus();
  await swipe(0, 90, 'touchCancel');
  await expect(label(0)).toBeFocused();
  await swipe(75, 12, 'touchEnd');
  await expect(label(0)).toBeFocused();
  await expect(page.locator('.wv-heading p')).toBeEmpty();
  await swipe(0, 90, 'touchEnd');
  await touch.detach();
  await expect(label(2)).toBeFocused();
  await expect(label(6)).toHaveAccessibleName('Les marais salants, verrouillée');
  await expect(label(7)).toHaveAccessibleName('Les coteaux des potiers, verrouillée');
  await labelsFit(page);
  await label(7).focus();
  await page.setViewportSize(DESKTOP);
  await labelsFit(page);
  await expect(label(7)).toBeFocused();
  await label(7).hover();
  await page.mouse.wheel(0, 120);
  await expect(label(5)).toBeFocused();
  await label(5).hover();
  await page.mouse.wheel(0, -120);
  await expect(label(5)).toBeFocused();
  await expect(label(7)).toBeVisible();
  // Space and Enter retain native button activation after dragging a label.
  await label(7).focus();
  await page.keyboard.press('Space');
  await expect(page.locator('.wv-heading p')).toContainText('Les marais salants');
  await page.screenshot({ path: 'output/current/world/navigation-desktop-fr.png' });
  await page.getByRole('button', { name: 'Retour au village' }).click();
  await expect(page.locator('.wv-heading h1')).toHaveText('Le petit port');
});

test('returning players can pan the island chart and enter the new campaign stops', async ({ page }) => {
  await page.addInitScript(completed => localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed, muted: true })), CAMPAIGN.slice(0, 180).map(level => level.id));
  await page.goto('/');
  await ready(page);
  await expect(page.locator('.wv-heading h1')).toHaveText('Saltmere Pans');
  await overview(page);
  const chart = () => page.evaluate(() => {
    const valley = (window as unknown as GameWindow).tumbleworks.app.world.valley!;
    return (valley.scene.background as import('three').CanvasTexture).image.toDataURL();
  });
  await page.locator('.wv-location[data-chapter="2"]').focus();
  await page.keyboard.press('ArrowDown');
  await expect(page.locator('.wv-location[data-chapter="0"]')).toBeFocused();
  const first = await chart();
  await page.locator('.wv-location[data-chapter="4"]').focus();
  await page.keyboard.press('ArrowUp');
  await expect(page.locator('.wv-location[data-chapter="6"]')).toBeFocused();
  expect(await chart()).not.toBe(first);
  await labelsFit(page);
  await page.keyboard.press('Enter');
  await expect(page.locator('.wv-heading h1')).toHaveText('Saltmere Pans');
  await page.getByRole('button', { name: 'Play next level' }).tap();
  await expect(page.locator('#journey-transition')).toBeHidden();
  expect(await state(page)).toMatchObject({ screen: 'game', source: 'campaign', levelIndex: 180 });
});

for (const [wins, previous, next] of [
  [180, 'high-glassworks', 'saltmere-pans'], [210, 'saltmere-pans', 'potters-reach'],
] as const) test(`a returning player with ${wins} wins can finish the pending film and resume the next island`, async ({ page }) => {
  const completed = CAMPAIGN.slice(0, wins).map(level => level.id);
  const filmKeys = completed.filter((_, i) => i % 30 === 0).map((first, chapter) => `valley:${first}:${completed[chapter * 30 + 29]}`);
  await page.addInitScript(({ completed, seen }) => {
    if (localStorage.getItem('tumbleworks.progress.v1')) return;
    localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed, muted: true }));
    localStorage.setItem('tumbleworks.valley.v1', JSON.stringify({ seen, chapter: seen.length }));
  }, { completed, seen: filmKeys.slice(0, -1) });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const film = async () => {
    await expect(page.locator('#boot')).toBeHidden({ timeout: 120_000 });
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'film');
    await expect(page.locator('html')).toHaveAttribute('data-village', previous);
    await expect(page.locator('#scene')).toHaveAttribute('data-world-film', 'ready', { timeout: 60_000 });
  };
  await film();
  await page.reload();
  await film();
  await page.locator('#film-skip').tap();
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('data-village', next);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tumbleworks.valley.v1')!).seen)).toEqual(filmKeys);
  await page.reload(); await ready(page);
  await expect(page.locator('html')).toHaveAttribute('data-village', next);
  await page.locator('#world-workshop').tap();
  await expect(page.locator('.wv-project-group')).toHaveCount(6);
  await expect(page.locator('.wv-project-group').first().getByRole('button').first()).toBeInViewport();
  await page.getByRole('button', { name: 'Back to the village' }).tap();
  await page.getByRole('button', { name: 'Play next level' }).tap();
  expect(await state(page)).toMatchObject({ screen: 'game', source: 'campaign', levelIndex: wins });
});
