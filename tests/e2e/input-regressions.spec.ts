import { expect, test, type Page } from '@playwright/test';
import { CAMPAIGN } from '../../src/campaign';
import type { App } from '../../src/view/App';
import type { LoopRuntime } from '../../src/gameplays/loop';
import { chooseLevel } from '../fixtures/picker';

type GameWindow = Window & { tumbleworks: { app: App } };
type Touch = { x: number; y: number; id: number };
const state = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState());
const actions = (page: Page) => page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.replay().actions);

async function open(page: Page, id = 'board-1') {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as Partial<GameWindow>).tumbleworks?.app));
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  await chooseLevel(page, CAMPAIGN.findIndex((level) => level.id === id));
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
}

async function touches(page: Page) {
  const client = await page.context().newCDPSession(page);
  return (type: 'touchStart' | 'touchMove' | 'touchEnd', touchPoints: Touch[]) => client.send('Input.dispatchTouchEvent', { type, touchPoints });
}

async function cadence(page: Page, speed: number) {
  expect((await state(page))['speed']).toBe(speed);
  const delta = await page.evaluate(() => {
    const { app } = (window as unknown as GameWindow).tumbleworks;
    const before = Number(app.debugState()['tick']);
    for (let i = 0; i < 4; i++) app.advance(1 / 60, i === 3);
    return Number(app.debugState()['tick']) - before;
  });
  expect(delta).toBe(speed * 4);
}

for (const [level, target] of [['board-1', 'supply0'], ['loop-1', 'lane0']] as const) {
  test(`${level}: a finger sliding within its target still pours once`, async ({ page }) => {
    await open(page, level);
    const at = await page.evaluate((id) => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[id]!, target);
    const touch = await touches(page);
    await touch('touchStart', [{ ...at, id: 1 }]);
    await touch('touchMove', [{ x: at.x + 12, y: at.y, id: 1 }]);
    await touch('touchEnd', []);
    expect(await actions(page)).toEqual([{ type: 'tap', step: 0, at: 0 }]);
  });
}

test('Tube Sort accepts a small slid tap but keeps a drag away and back cancelled', async ({ page }) => {
  await open(page, 'tube-1');
  const points = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugTargets());
  const touch = await touches(page);
  const slide = async (target: string) => {
    const at = points[target]!;
    await touch('touchStart', [{ ...at, id: 1 }]);
    await touch('touchMove', [{ x: at.x + 12, y: at.y, id: 1 }]);
    await touch('touchEnd', []);
  };
  await slide('tube0');
  expect((await state(page))['selected']).toBe(0);
  await slide('tube0');
  expect((await state(page))['selected']).toBeNull();
  const before = await state(page);
  for (const away of [points['tube3']!, { x: 5, y: 190 }]) {
    await touch('touchStart', [{ ...points['tube0']!, id: 1 }]);
    await touch('touchMove', [{ ...away, id: 1 }]);
    await touch('touchMove', [{ ...points['tube0']!, id: 1 }]);
    await touch('touchEnd', []);
    expect(await state(page)).toEqual(before);
  }

  const tap = async (target: string) => { const at = points[target]!; await page.touchscreen.tap(at.x, at.y); };
  await tap('tube0'); await slide('tube1');
  expect(await state(page)).toMatchObject({ moves: 0, selected: 1 });
  await tap('tube1');
  expect(await state(page)).toEqual(before);
  await tap('tube0'); await tap('tube3');
  await tap('tube1'); await tap('tube4');
  await page.evaluate(() => {
    const { app } = (window as unknown as GameWindow).tumbleworks;
    for (let i = 0; i < 60; i++) app.advance(1 / 60, i === 59);
  });
  await tap('tube1');
  await slide('tube3');
  expect(await state(page)).toMatchObject({ moves: 3, selected: null, tubes: [['red', 'red'], [], ['green', 'green', 'red', 'red'], ['blue', 'blue', 'blue', 'blue'], ['green', 'green']] });
});

test('Hint during a Loop pour explains the wait without naming a refused truck', async ({ page }) => {
  await open(page, 'loop-39');
  const at = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugTargets()['lane0']!);
  await page.touchscreen.tap(at.x, at.y);
  expect(await actions(page)).toEqual([{ type: 'tap', step: 0, at: 0 }]);
  const before = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.replay().fingerprint);
  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  await expect(page.locator('#message')).toContainText('Wait');
  await expect(page.locator('#message')).toContainText('Hold ×5');
  await expect(page.locator('#focus-ring')).toBeHidden();
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.replay().fingerprint)).toBe(before);
  await page.keyboard.down('g');
  const settled = await page.evaluate(() => {
    const { app } = (window as unknown as GameWindow).tumbleworks;
    for (let frame = 0; frame < 600 && app.debugState()['settling']; frame++) app.advance(1 / 60, false);
    app.advance(0);
    return !app.debugState()['settling'];
  });
  await page.keyboard.up('g');
  expect(settled, 'held ×5 finishes the current transfers').toBe(true);
  await page.getByRole('button', { name: 'Hint', exact: true }).click();
  await expect(page.locator('#message')).not.toContainText('Wait');
  await expect(page.locator('#focus-ring')).toBeVisible();
  const next = await page.evaluate(() => {
    const { app } = (window as unknown as GameWindow).tumbleworks;
    const target = app['focusTarget'];
    const runtime = app.runtime as LoopRuntime;
    return { target, legal: runtime.machine.rules.actions(), points: app.debugTargets(), actions: app.replay().actions.length };
  });
  expect(next.target).toMatch(/^lane\d+$/);
  expect(next.legal).toContain(Number(next.target!.slice(4)));
  const point = next.points[next.target!]!;
  await page.touchscreen.tap(point.x, point.y);
  expect(await actions(page)).toHaveLength(next.actions + 1);
});

test('same-speed keyboard and touch holds keep independent ownership in either release order', async ({ page }) => {
  await open(page);
  const at = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugTargets()['fast']!);
  const touch = await touches(page);
  for (const releaseKeyFirst of [true, false]) {
    await page.keyboard.down('f');
    await touch('touchStart', [{ ...at, id: 1 }]);
    await cadence(page, 3);
    if (releaseKeyFirst) await page.keyboard.up('f'); else await touch('touchEnd', []);
    await cadence(page, 3);
    if (releaseKeyFirst) await touch('touchEnd', []); else await page.keyboard.up('f');
    await cadence(page, 1);
  }
});

test('two fingers can share a hold while another pours, and the faster hold falls back correctly', async ({ page }) => {
  await open(page);
  const targets = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugTargets());
  const one = { ...targets['fast']!, x: targets['fast']!.x - 8, id: 1 };
  const two = { ...targets['fast']!, x: targets['fast']!.x + 8, id: 2 };
  const pour = { ...targets['supply0']!, id: 3 };
  const faster = { ...targets['faster']!, id: 4 };
  const touch = await touches(page);
  await touch('touchStart', [one]);
  await touch('touchStart', [one, two]);
  // CDP's nonempty touchEnd list identifies the fingers lifting, not those remaining.
  await touch('touchEnd', [one]);
  await cadence(page, 3);
  await touch('touchStart', [two, pour]);
  await touch('touchEnd', [pour]);
  expect((await actions(page)).filter((action) => action.type === 'tap')).toHaveLength(1);
  await cadence(page, 3);
  await touch('touchStart', [two, faster]);
  await cadence(page, 5);
  await touch('touchEnd', [faster]);
  await cadence(page, 3);
  await touch('touchEnd', []);
  await cadence(page, 1);
});

test('a native swipe scrolls the picker and its newly revealed levels remain playable', async ({ page }) => {
  await open(page);
  await page.locator('#levels-toggle').click();
  await page.locator('#levels').evaluate((el) => Promise.all(el.getAnimations().map((animation) => animation.finished)));
  const chips = page.locator('#chips');
  const box = (await chips.boundingBox())!;
  const before = await chips.evaluate((el) => el.scrollTop);
  const touch = await touches(page);
  const x = box.x + box.width / 2;
  const from = box.y + box.height - 20;
  await touch('touchStart', [{ x, y: from, id: 1 }]);
  for (let i = 1; i <= 12; i++) {
    await touch('touchMove', [{ x, y: from - (box.height - 40) * i / 12, id: 1 }]);
    await page.waitForTimeout(25);
  }
  await touch('touchEnd', []);
  await expect.poll(() => chips.evaluate((el) => el.scrollTop)).toBeGreaterThan(before + 80);
  // Stop inertia without scrolling the element programmatically.
  await page.waitForTimeout(500);
  const revealed = await chips.evaluate((el) => {
    const bounds = el.getBoundingClientRect();
    const chip = [...el.querySelectorAll<HTMLElement>('.chip')].filter((candidate) => {
      const rect = candidate.getBoundingClientRect();
      return rect.top > bounds.top + 10 && rect.bottom < bounds.bottom - 10;
    }).at(-1)!;
    const rect = chip.getBoundingClientRect();
    return { index: Number(chip.dataset['level']), x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  });
  expect(revealed.index).toBeGreaterThan(2);
  await page.touchscreen.tap(revealed.x, revealed.y);
  expect((await state(page))['levelIndex']).toBe(revealed.index);
});

test('a repeated restart key does not reload a second time', async ({ page }) => {
  await open(page);
  await page.keyboard.down('r');
  await cadence(page, 1);
  const before = Number((await state(page))['tick']);
  await page.keyboard.down('r');
  expect((await state(page))['tick']).toBe(before);
  await page.keyboard.up('r');
});
