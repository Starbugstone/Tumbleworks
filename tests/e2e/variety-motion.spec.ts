import { expect, test, type Page } from '@playwright/test';
import type { App } from '../../src/view/App';
import type { GameRuntime } from '../../src/engine/contracts';
import type { Machine } from '../../src/machine/machine';
import { TUBE_210 } from '../../src/puzzles/variety-boards';
import { CAMPAIGN } from '../../src/campaign';
import { WORKSHOP_PROJECTS } from '../../src/world/workshop-projects';

type GameWindow = Window & { tumbleworks: { app: App } };
// Read presentation at the browser boundary; all accepted moves use real touches.
interface TubeObserved extends GameRuntime {
  view: {
    cups: Map<number, { progress: number; lid: { visible: boolean } }>;
    caps: Map<number, { progress: number; mesh: { visible: boolean } }>;
    sparks: { active: boolean };
  };
}
interface PalletObserved extends GameRuntime {
  view: {
    boxes: Map<string, { offsetX: number; group: { position: { y: number } } }>;
    sparks: { active: boolean };
  };
}
const out = 'output/current/gameplay-variety/browser';
/**
 * Atelier gates are live: a disposable save completes exactly the registered campaign stops a project's milestone needs
 * (chapters before it, then its threshold). This opens the project for presentation checks only; it is not proof that
 * real play unlocks it, which tests/e2e/workshop-projects.spec.ts covers. Workshop completion itself is never seeded.
 */
const milestoneIds = (id: string): string[] => {
  const project = WORKSHOP_PROJECTS.find((entry) => entry.id === id);
  if (!project) throw new Error(`No Atelier project ${id}`);
  return CAMPAIGN.slice(0, (project.chapter * 10 + project.stops) * 3).map((level) => level.id);
};
async function seedMilestone(page: Page, id: string): Promise<string[]> {
  const ids = milestoneIds(id);
  await page.addInitScript(({ ids, first }) => {
    if (!localStorage.getItem('tumbleworks.progress.v1')) localStorage.setItem('tumbleworks.progress.v1', JSON.stringify({ completed: ids, current: first, muted: true }));
    if (!localStorage.getItem('tumbleworks.valley.v1')) localStorage.setItem('tumbleworks.valley.v1', JSON.stringify({ seen: [], chapter: 0 }));
  }, { ids, first: CAMPAIGN[0]!.id });
  return ids;
}
async function ready(page: Page, id: string) {
  await seedMilestone(page, id);
  await page.goto('/?workshop=' + id);
  await page.waitForFunction(id => (window as unknown as Partial<GameWindow>).tumbleworks?.app?.debugState().levelId === id, id);
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  await page.locator('#restart').click();
}
async function tap(page: Page, key: string) {
  const at = await page.evaluate(k => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[k], key);
  expect(at).toBeDefined();
  await page.touchscreen.tap(at!.x, at!.y);
}
async function settle(page: Page) {
  await page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app;
    for (let n = 0; n < 6000; n++) {
      const state = app.debugState();
      if (!state.busy && !state.settling) { app.advance(0); return; }
      app.advance(1 / 60, false);
    }
    throw Error('Did not settle');
  });
}
test.use({ viewport: { width: 375, height: 690 }, deviceScaleFactor: 1 });

test('reduced motion snaps the spare opening and the later cup fold, and suppresses their bursts', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await ready(page, 'tube-210');
  for (const { from, to } of TUBE_210.solution.slice(0, 3)) {
    await tap(page, 'tube' + from); await tap(page, 'tube' + to); await settle(page);
  }
  const effect = () => page.evaluate(() => {
    const app = (window as unknown as GameWindow).tumbleworks.app, runtime = app.runtime as TubeObserved;
    app.advance(0);
    return {
      state: app.debugState(), cup: runtime.view.cups.get(3)!.progress, lid: runtime.view.cups.get(3)!.lid.visible,
      cap: runtime.view.caps.get(4)!.progress, capVisible: runtime.view.caps.get(4)!.mesh.visible, sparks: runtime.view.sparks.active,
    };
  });
  // Finishing red opens the spare; the cup still holds its blues.
  await tap(page, 'tube2'); await tap(page, 'tube0');
  expect(await effect()).toMatchObject({ lid: false, cap: 1, capVisible: false, sparks: false,
    state: { spent: [false, false, false, false, false], opened: [false, false, false, false, true] } });
  await settle(page);
  // Emptying the cup into the open spare folds it on its own move.
  await tap(page, 'tube3'); await tap(page, 'tube4');
  expect(await effect()).toMatchObject({ cup: 1, lid: true, sparks: false,
    state: { spent: [false, false, false, true, false], opened: [false, false, false, false, true] } });
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState().moves)).toBe(5);
  await settle(page);
  await page.screenshot({ path: out + '/tube-210-reduced-motion.png' });
});

test('shared pallet lift stays local and reduced motion removes it while retaining joint departure', async ({ page }) => {
  for (const reduced of [false, true]) {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await ready(page, 'board-212');
    await tap(page, 'supply0'); await settle(page); await tap(page, 'supply0'); await settle(page); await tap(page, 'supply2');
    const effect = await page.evaluate(() => {
      const app = (window as unknown as GameWindow).tumbleworks.app;
      const game = app.runtime.game as Machine, view = (app.runtime as PalletObserved).view;
      for (let n = 0; n < 2400; n++) {
        app.advance(1 / 60, false);
        const pair = game.readBoxes().filter(b => b.index === 0);
        if (pair.some(b => b.departure !== null)) {
          for (let k = 0; k < 4; k++) app.advance(1 / 60, false);
          app.advance(0);
          const now = game.readBoxes().filter(b => b.index === 0);
          return { boxes: now.map(b => ({ fill: b.fill, departure: b.departure,
            y: view.boxes.get(`${b.dock}:0`)!.group.position.y, shake: view.boxes.get(`${b.dock}:0`)!.offsetX })),
          sparks: view.sparks.active };
        }
      }
      throw Error('Pallet never departed');
    });
    expect(effect.boxes.every(b => b.fill === 3)).toBe(true);
    expect(effect.boxes[0]!.departure).toBe(effect.boxes[1]!.departure);
    if (reduced) {
      expect(effect.sparks).toBe(false);
      expect(effect.boxes.every(b => b.y <= 0 && b.shake === 0)).toBe(true);
    } else {
      expect(effect.sparks).toBe(true);
      expect(effect.boxes.every(b => b.y > 0)).toBe(true);
    }
    await page.screenshot({ path: out + `/board-212-motion-${reduced ? 'reduced' : 'arcade'}.png` });
  }
});
