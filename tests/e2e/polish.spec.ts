import { expect, test } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';
import type { App } from '../../src/view/App';
import { chooseLevel } from '../fixtures/picker';

type GameWindow = Window & { tumbleworks: { app: App } };

test('Funnel Sort controls follow exposed trays, disappear when empty and return on undo', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  const controls = page.locator('#board-controls');
  await controls.getByRole('button', { name: 'Column 1: Diamond (blue)', exact: true }).press('Enter');
  await expect(controls.getByRole('button', { name: 'Column 1: Ring (red)', exact: true })).toHaveCount(1);
  await controls.getByRole('button', { name: 'Column 1: Ring (red)', exact: true }).press('Enter');
  await expect(controls.getByRole('button', { name: /^Column 1:/ })).toHaveCount(0);
  await expect(controls.getByRole('button', { name: 'Column 2: Triangle (green)', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(controls.getByRole('button', { name: 'Column 1: Ring (red)', exact: true })).toHaveCount(1);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(controls.getByRole('button', { name: 'Column 1: Diamond (blue)', exact: true })).toHaveCount(1);
});

test('retired matching levels fall back safely without losing sorting progress or sound preference', async ({ page }) => {
  await page.addInitScript(() => {
    if (!localStorage.getItem('tumbleworks.progress.v1')) localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({
      current: 'tray-2', completed: ['tray-1', 'connect-1', 'tube-1', 'loop-2'], muted: true,
    }));
  });
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState())).toMatchObject({ levelId: 'board-1' });
  await expect(page.getByRole('button', { name: 'Sound', exact: true })).toHaveClass(/muted/);
  await page.locator('#levels-toggle').click();
  await expect(page.locator('.chip')).toHaveCount(CAMPAIGN.length);
  for (const id of ['tube-1', 'loop-2']) {
    await expect(page.locator(`.chip[data-level="${CAMPAIGN.findIndex((level) => level.id === id)}"]`)).toHaveText('✓');
  }
  await expect(page.locator('#levels')).not.toContainText(/Tray Match|Connected Match/);
});

test('lorry final-colour markers survive a pour and undo while the exposed colour changes', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  await chooseLevel(page, CAMPAIGN.findIndex((level) => level.id === 'loop-1'));
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    for (let i = 0; i < 2; i++) app.advance(1 / 60, false);
    app.advance(0);
  });
  const before = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
  expect(before.finalColors).toEqual(['blue', 'red']);
  const at = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugTargets()['lane0']);
  if (!at) throw new Error('Missing lorry');
  await page.touchscreen.tap(at.x, at.y);
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    for (let i = 0; i < 15; i++) app.advance(1 / 60, false);
    app.advance(0);
  });
  const during = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
  expect(during.finalColors).toEqual(before.finalColors);
  expect(during.lanes).not.toEqual(before.lanes);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  const undone = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
  expect(undone.finalColors).toEqual(before.finalColors);
  expect(undone.lanes).toEqual(before.lanes);
  expect(errors).toEqual([]);
});

test('fast forward runs the machine three times faster only while held, and never after the level ends', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  const fast = page.getByRole('button', { name: 'Fast forward ×3 (hold)', exact: true });
  const ticks = () => page.evaluate(() => Number((window as unknown as GameWindow).tumbleworks.app.debugState()['tick']));
  const advance = (frames: number) => page.evaluate((n) => { for (let i = 0; i < n; i++) (window as unknown as GameWindow).tumbleworks.app.advance(1 / 60, i === n - 1); }, frames);
  await expect(fast).toBeEnabled();
  const box = await fast.boundingBox();
  if (!box) throw new Error('Fast forward button is not visible');
  const before = await ticks();
  await advance(10);
  expect(await ticks() - before).toBe(10);
  // Press and hold: pointer capture keeps the speed until the finger lifts, even off the button.
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(fast).toHaveAttribute('aria-pressed', 'true');
  const held = await ticks();
  await advance(10);
  expect(await ticks() - held).toBe(30);
  await page.mouse.move(box.x - 80, box.y - 80);
  await page.mouse.up();
  await expect(fast).toHaveAttribute('aria-pressed', 'false');
  const released = await ticks();
  await advance(10);
  expect(await ticks() - released).toBe(10);
  // The keyboard equivalent is a held key.
  await page.keyboard.down('f');
  await expect(fast).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.up('f');
  await expect(fast).toHaveAttribute('aria-pressed', 'false');
  // The ×5 button holds the same way, wins while both are held, and falls back to ×3 when it lifts.
  const faster = page.getByRole('button', { name: 'Fast forward ×5 (hold)', exact: true });
  const fasterBox = await faster.boundingBox();
  if (!fasterBox) throw new Error('Fast forward ×5 button is not visible');
  expect(fasterBox.x).toBeGreaterThan(box.x + box.width);
  await page.mouse.move(fasterBox.x + fasterBox.width / 2, fasterBox.y + fasterBox.height / 2);
  await page.mouse.down();
  await expect(faster).toHaveAttribute('aria-pressed', 'true');
  await expect(fast).toHaveAttribute('aria-pressed', 'false');
  const flat = await ticks();
  await advance(10);
  expect(await ticks() - flat).toBe(50);
  await page.mouse.up();
  await expect(faster).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.down('f');
  await page.keyboard.down('g');
  await expect(faster).toHaveAttribute('aria-pressed', 'true');
  await page.keyboard.up('g');
  await expect(fast).toHaveAttribute('aria-pressed', 'true');
  await expect(faster).toHaveAttribute('aria-pressed', 'false');
  await page.keyboard.up('f');
  await expect(fast).toHaveAttribute('aria-pressed', 'false');
  // Holding through a jam stops accelerating as soon as the ending is reached.
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    app.setFast(true);
    for (let tick = 0; tick < 60 * 120 && app.debugState()['status'] === 'playing'; tick++) {
      const targets = Object.keys(app.debugTargets()).filter((key) => /^supply\d+$/.test(key));
      if (targets.length && !app.debugState()['busy']) app.runtime.activate(targets[targets.length - 1]!);
      app.advance(1 / 60, false);
    }
    app.advance(0);
  });
  await expect(fast).toBeDisabled();
  await expect(page.getByRole('button', { name: 'Fast forward ×5 (hold)', exact: true })).toBeDisabled();
  await expect(fast).toHaveAttribute('aria-pressed', 'false');
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState()['speed'])).toBe(1);
});

test('a second finger can pour while the first holds fast forward', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as unknown as Partial<GameWindow>).tumbleworks?.app?.runtime));
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  const fast = page.getByRole('button', { name: 'Fast forward ×3 (hold)', exact: true });
  const box = await fast.boundingBox();
  if (!box) throw new Error('Fast forward button is not visible');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect(fast).toHaveAttribute('aria-pressed', 'true');
  const before = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
  // Playwright's touchscreen only taps alone, so the second finger is a synthetic non-primary pointer on the board.
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    const at = app.debugTargets()['supply0'];
    if (!at) throw new Error('No crate to tap');
    const canvas = document.getElementById('scene');
    if (!canvas) throw new Error('No board');
    const init = { pointerId: 7, pointerType: 'touch', isPrimary: false, clientX: at.x, clientY: at.y, button: 0, buttons: 1, bubbles: true };
    canvas.dispatchEvent(new PointerEvent('pointerdown', init));
    canvas.dispatchEvent(new PointerEvent('pointerup', { ...init, buttons: 0 }));
  });
  const after = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
  expect(after['supplies']).not.toEqual(before['supplies']);
  await expect(fast).toHaveAttribute('aria-pressed', 'true');
  await page.mouse.up();
  await expect(fast).toHaveAttribute('aria-pressed', 'false');
});
