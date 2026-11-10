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
  await page.getByRole('button', { name: language === 'en' ? 'The valley' : 'La vallée', exact: true }).click();
  const locations = page.getByRole('navigation', { name: language === 'en' ? 'Valley locations' : 'Lieux de la vallée' });
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
    return { camera: app.world.valley?.camera.type, terrain: Boolean(app.world.valley?.scene.getObjectByName('valley-terrain')),
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
  await expect(page.locator('.wv-heading p')).toHaveText('Finish Little Harbour to open this village.');
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
  await page.locator('#levels-toggle').click(); await page.getByRole('button', { name: 'Français', exact: true }).click();
  if (await page.locator('#levels').isVisible()) await page.locator('#levels-toggle').click();
  await overview(page, 'fr');
  await labelsFit(page);
  await expect(page.locator('.wv-location[data-chapter="0"]')).toContainText('Le petit port');
  await page.screenshot({ path: 'output/current/world/navigation-phone-fr.png' });
  await page.setViewportSize(DESKTOP);
  await labelsFit(page);
  await page.screenshot({ path: 'output/current/world/navigation-desktop-fr.png' });
  await page.getByRole('button', { name: 'Retour au village' }).click();
  await expect(page.locator('.wv-heading h1')).toHaveText('Le petit port');
});
