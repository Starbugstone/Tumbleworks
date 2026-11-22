import { expect, test } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';
import type { App } from '../../src/view/App';
import type { Object3D } from 'three';

type FilmWorld = { filmTime: number; scene: { workshopPass: number; scene: { getObjectByName(name: string): Object3D | undefined } } };
type GameWindow = Window & { tumbleworks: { app: App } };

test('the labelled Workshop footer opens the current island projects and keeps Back in reach', async ({ page }) => {
  await page.addInitScript(ids => localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed: ids, muted: true })), CAMPAIGN.slice(0, 30).map(level => level.id));
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 120_000 });
  await expect(page.locator('#journey-transition')).toBeHidden();
  const workshop = page.locator('[data-world-workshop]');
  await expect(workshop).toBeVisible(); await expect(workshop).toHaveAccessibleName('Workshop');
  await expect(page.locator('.map-stop')).toHaveCount(10);
  const box = (await workshop.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44); expect(box.height).toBeGreaterThanOrEqual(44);
  await page.touchscreen.tap(box.x + box.width / 2, box.y + box.height / 2);
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'workshop');
  await expect(page.locator('#journey-transition')).toBeHidden(); await expect(workshop).toBeHidden();
  await expect(page.locator('.wv-project-group[data-chapter="1"] h2')).toBeInViewport();
  const back = page.getByRole('button', { name: 'Back to the village' });
  const beforeScroll = (await back.boundingBox())!;
  await page.locator('.wv-panel').evaluate(panel => { panel.scrollTop = panel.scrollHeight; });
  expect(await back.boundingBox()).toEqual(beforeScroll);
  await back.tap();
  await expect(page.locator('#journey-transition')).toBeHidden(); await expect(workshop).toBeVisible();
  await page.addStyleTag({ content: '#world, #scene { filter: grayscale(1); }' });
  await page.screenshot({ path: 'output/current/world-3d/workshop-hammer-phone-gray.png' });
  await page.locator('.map-stop[data-round="10"]').tap();
  await expect(page.locator('body')).toHaveAttribute('data-screen', 'game'); await expect(workshop).toBeHidden();
});

test('the visible 3D hammer sign responds to the passing marble in both motion modes', async ({ page }) => {
  await page.addInitScript(ids => localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed: ids, muted: true })), CAMPAIGN.slice(0, 30).map(level => level.id));
  await page.goto('/'); await expect(page.locator('#boot')).toBeHidden({ timeout: 120_000 });
  await expect(page.locator('#journey-transition')).toBeHidden();
  await page.getByRole('button', { name: 'Previous location', exact: true }).tap();
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  for (const reduced of [false, true]) {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await page.getByRole('button', { name: 'Watch your machine' }).tap();
    await expect(page.locator('#scene')).toHaveAttribute('data-world-film', 'ready', { timeout: 30_000 });
    if (reduced) await page.getByRole('button', { name: 'Play film', exact: true }).tap();
    const pass = await page.evaluate(() => ((window as unknown as GameWindow).tumbleworks.app as unknown as { world: FilmWorld }).world.scene.workshopPass);
    const angles: number[] = [];
    for (const time of [pass - 0.07, pass + (reduced ? 0.09 : 0.14), pass + 0.9]) {
      angles.push(await page.evaluate(time => {
        const app = (window as unknown as GameWindow).tumbleworks.app;
        const world = (app as unknown as { world: FilmWorld }).world;
        const fingerprint = app.runtime.game.fingerprint(), steps = app.runtime.game.steps;
        for (let frame = 0; world.filmTime < time - 1e-8; frame++) {
          if (frame > 1000) throw new Error('The film did not reach the Workshop');
          app.advance(Math.min(1 / 30, time - world.filmTime));
        }
        if (fingerprint !== app.runtime.game.fingerprint() || steps !== app.runtime.game.steps) throw new Error('The film advanced gameplay');
        const sign = world.scene.scene.getObjectByName('workshop-hammer-sign');
        if (!sign || !sign.visible) throw new Error('The installed Workshop sign is missing');
        return sign.rotation.z;
      }, time));
      if (angles.length === 2) await page.screenshot({ path: `output/current/world-3d/workshop-sign-${reduced ? 'reduced' : 'normal'}.png` });
    }
    expect(angles[0]).toBe(0); expect(angles[1]).toBeCloseTo(reduced ? -0.25 : -0.45, 8); expect(angles[2]).toBe(0);
    await page.locator('#film-skip').tap(); await expect(page.locator('#journey-transition')).toBeHidden();
  }
});
