import { STOPS_PER_CHAPTER, LEVELS_PER_STOP } from '../../src/world/progression';
import { expect, test } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';

/** Observe the real mixer requests while going through the campaign map and film controls. */
test('map and film keep the current island soundtrack on every registered island', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.addInitScript(completed => {
    localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed, muted: true }));
  }, CAMPAIGN.map(level => level.id));
  await page.goto('/');
  await expect(page.locator('#boot')).toBeHidden({ timeout: 90_000 });

  const calls = await page.evaluateHandle(async () => {
    const entry = performance.getEntriesByType('resource').find(entry => new URL(entry.name).pathname === '/src/audio.ts');
    if (!entry) throw new Error('The running audio module was not loaded');
    const { sfx } = await import(/* @vite-ignore */ entry.name) as typeof import('../../src/audio');
    const requests: { active: boolean; chapter?: number }[] = [];
    const original = sfx.harbourAmbience.bind(sfx);
    sfx.harbourAmbience = (active, chapter) => {
      requests.push({ active, chapter });
      original(active, chapter);
    };
    return requests;
  });
  for (let chapter = CAMPAIGN.length / (STOPS_PER_CHAPTER * LEVELS_PER_STOP) - 1; chapter >= 0; chapter--) {
    await expect(page.locator('#journey-transition')).toBeHidden();
    await page.getByRole('button', { name: 'Watch your machine' }).tap();
    await expect(page.locator('#scene')).toHaveAttribute('data-world-film', 'ready', { timeout: 30_000 });
    expect(await calls.evaluate(requests => requests.at(-1)), 'film soundtrack').toEqual({ active: true, chapter });
    await calls.evaluate(requests => { requests.length = 0; });
    await page.locator('#film-skip').tap();
    await expect(page.locator('body')).toHaveAttribute('data-screen', 'map');
    expect(await calls.evaluate(requests => requests.at(-1)), 'map soundtrack after the film').toEqual({ active: true, chapter });
    if (chapter > 0) {
      await page.getByRole('button', { name: 'Previous location', exact: true }).tap();
      expect(await calls.evaluate(requests => requests.at(-1)), 'map soundtrack after changing island').toEqual({ active: true, chapter: chapter - 1 });
    }
  }
});
