import { expect, test, type Page } from '@playwright/test';
import type { App } from '../../src/view/App';
import { TUBE_BOARDS } from '../../src/puzzles/levels';
type GameWindow = Window & { tumbleworks: { app: App } };
/** Uncaught page errors explain a missing target far better than the missing target does. */
const pageErrors = new WeakMap<Page, string[]>();
const ready = async (page: Page) => {
  if (!pageErrors.has(page)) {
    const errors: string[] = [];
    pageErrors.set(page, errors);
    page.on('pageerror', (error) => errors.push(error.message));
  }
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
};
const tap = async (page: Page, id: string) => {
  const point = await page.evaluate(key => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[key], id);
  if (!point) {
    const errors = pageErrors.get(page) ?? [];
    throw new Error(`Missing target ${id}${errors.length ? ` after page errors: ${errors.join(' | ')}` : ''}`);
  }
  await page.touchscreen.tap(point.x, point.y);
};
const select = async (page: Page, index: number) => {
  await page.locator('#levels-toggle').click();
  await page.locator(`.chip[data-level="${index}"]`).click();
};
const settle = async (page: Page) => page.evaluate(() => {
  const app = (window as unknown as GameWindow).tumbleworks.app;
  for (let i = 0; i < 2400; i++) {
    app.advance(1 / 60, false);
    const state = app.debugState();
    if (!state.busy && !state.settling) break;
  }
  app.advance(0);
});

test('French is detected, changing language preserves the live puzzle, and the choice survives reload', async ({ browser }) => {
  const context = await browser.newContext({ locale: 'fr-FR', viewport: { width: 320, height: 700 }, hasTouch: true });
  const page = await context.newPage();
  await ready(page);
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('button', { name: 'Annuler', exact: true })).toBeVisible();
  await expect(page.locator('#guide-pointer svg')).toBeVisible();
  await tap(page, 'supply0');
  await expect(page.locator('#guide-text')).toContainText('caisse rouge');
  const before = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
  await page.locator('#levels-toggle').click();
  await expect(page.locator('#level-help')).toContainText('Touchez');
  await page.getByRole('button', { name: 'English', exact: true }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState())).toEqual(before);
  await expect(page.getByRole('button', { name: 'Undo', exact: true })).toBeVisible();
  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await select(page, 2);
  for (const move of TUBE_BOARDS[0]!.solution) {
    await tap(page, `tube${move.from}`); await settle(page);
    await tap(page, `tube${move.to}`); await settle(page);
  }
  await expect(page.locator('#card-title')).toHaveText('Nicely sorted!');
  await page.locator('#levels-toggle').click();
  await page.getByRole('button', { name: 'Français', exact: true }).click();
  await expect(page.locator('#card-title')).toHaveText('Bien trié !');
  await page.locator('#levels-toggle').click();
  await expect(page.getByRole('button', { name: 'Niveau suivant', exact: true })).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState().status)).toBe('won');
  await context.close();
});

test('the written instruction shows only during onboarding and stays readable behind the level pill', async ({ page }) => {
  await ready(page);
  const instruction = page.locator('#instruction');
  // The first level's guide is unseen, so its instruction shows until the player acts.
  await expect(instruction).toBeVisible();
  await tap(page, 'supply0');
  await expect(instruction).toBeHidden();
  // Levels without a guide never show it, however they are opened.
  for (const index of [3, 24, 89]) {
    await select(page, index);
    await expect(instruction).toBeHidden();
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    await expect(instruction).toBeHidden();
  }
  await page.locator('#levels-toggle').click();
  await expect(page.locator('#level-help')).not.toBeEmpty();
  await page.locator('#levels-toggle').click();
  // Once a guide has been skipped, its level stops showing the instruction too.
  await select(page, 0);
  await expect(instruction).toBeVisible();
  await page.locator('#guide-skip').click();
  await expect(instruction).toBeHidden();
  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  await expect(instruction).toBeHidden();
});

test('tap icons guide the first three puzzles through real actions and remember completed introductions', async ({ page }) => {
  await ready(page);
  await expect(page.locator('#guide-pointer svg')).toBeVisible();
  await tap(page, 'supply0'); await tap(page, 'supply0'); await settle(page);
  await expect(page.locator('#guide')).toBeHidden();
  await select(page, 1);
  await expect(page.locator('#guide-pointer svg')).toBeVisible();
  await tap(page, 'lane0');
  await expect(page.locator('#guide-text')).toContainText('Tap this truck too');
  await tap(page, 'lane1'); await settle(page);
  await expect(page.locator('#guide')).toBeHidden();
  await select(page, 2);
  await expect(page.locator('#guide-pointer svg')).toBeVisible();
  await tap(page, 'tube3'); // An invalid first choice must not complete the guide.
  await expect(page.locator('#guide-pointer svg')).toBeVisible();
  await tap(page, 'tube0');
  await expect(page.locator('#guide-text')).toContainText('empty tube');
  await tap(page, 'tube3');
  await expect(page.locator('#guide')).toBeHidden();
  const seen = await page.evaluate(() => JSON.parse(localStorage.getItem('tumbleworks.preferences.v1') ?? '{}').guides);
  expect(seen).toEqual(expect.arrayContaining(['funnel-basics', 'loop-basics', 'tube-basics']));
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.locator('#guide')).toBeHidden();
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect(page.locator('#guide')).toBeHidden();
  await page.locator('#levels-toggle').click();
  await page.getByRole('button', { name: 'Restart with guide', exact: true }).click();
  await expect(page.locator('#guide-pointer svg')).toBeVisible();
  await page.getByRole('button', { name: 'Skip guide', exact: true }).click();
  await page.reload();
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  await expect(page.locator('#guide')).toBeHidden();
});


test('existing completed levels still show an unseen animated tap guide', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({
    current: 'board-1', completed: ['board-1', 'loop-1', 'tube-1'], muted: true,
  })));
  await ready(page);
  for (const index of [0, 1, 2]) {
    await select(page, index);
    const hand = page.locator('#guide-pointer svg');
    await expect(hand).toBeVisible();
    await expect(hand).toHaveCSS('animation-name', 'guide-tap');
    expect(await hand.evaluate(el => el.getAnimations().some(animation => animation.playState === 'running'))).toBe(true);
  }
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(page.locator('#guide-pointer svg')).toBeVisible();
  await expect(page.locator('#guide-pointer svg')).toHaveCSS('animation-name', 'none');
});
