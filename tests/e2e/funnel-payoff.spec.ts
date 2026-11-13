import { expect, test } from '@playwright/test';
import type { Group } from 'three';
import { CAMPAIGN } from '../../src/campaign';
import type { Feedback, GameRuntime } from '../../src/engine/contracts';
import type { MarbleCrowd } from '../../src/engine/crowd';
import type { Machine, MachineEvent } from '../../src/machine/machine';
import type { App } from '../../src/view/App';
import { chooseLevel } from '../fixtures/picker';

type GameWindow = Window & { tumbleworks: { app: App } };
// Read the rendered pieces at the browser boundary; all player actions use real touch/HUD input.
interface ObservedRuntime extends GameRuntime {
  machine: Machine;
  view: { boxes: Map<string, { group: Group }>; crowd: MarbleCrowd };
}

test('held ×5 keeps only the final landing sound and Restart cancels its tail', async ({ page }) => {
  await page.goto('/');
  await page.waitForFunction(() => Boolean((window as Partial<GameWindow>).tumbleworks?.app));
  await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
  await chooseLevel(page, CAMPAIGN.findIndex(level => level.id === 'board-31'));
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await page.evaluate(async () => {
    const path = performance.getEntriesByType('resource').map(entry => entry.name)
      .find(name => new URL(name).pathname === '/src/audio.ts');
    if (!path) throw new Error('The running app did not load its audio module');
    const { sfx } = await import(/* @vite-ignore */ path) as typeof import('../../src/audio');
    const observed = window as unknown as { audioProbe: { landings: number[]; cancellations: number } };
    observed.audioProbe = { landings: [], cancellations: 0 };
    const landing = sfx.landing.bind(sfx);
    const cancel = sfx.cancel.bind(sfx);
    sfx.landing = arrival => { observed.audioProbe.landings.push(arrival); landing(arrival); };
    sfx.cancel = () => { observed.audioProbe.cancellations++; cancel(); };
  });
  for (const column of [0, 0, 1, 1]) {
    const point = await page.evaluate(id => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[`supply${id}`]!, column);
    await page.touchscreen.tap(point.x, point.y);
  }
  await page.keyboard.down('g');
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState()['speed'])).toBe(5);
  const played = await page.evaluate(() => {
    const { app } = (window as unknown as GameWindow).tumbleworks;
    for (let frame = 0; frame < 80; frame++) app.advance(1 / 60, frame % 10 === 0);
    return (window as unknown as { audioProbe: { landings: number[] } }).audioProbe.landings;
  });
  await page.keyboard.up('g');
  expect(played.length).toBeGreaterThan(0);
  expect(played.every(arrival => arrival === 3)).toBe(true);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as { audioProbe: { cancellations: number } }).audioProbe.cancellations)).toBeGreaterThan(0);
  expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugState()['speed'])).toBe(1);
});

for (const reduced of [false, true]) {
  test(`Funnel lands left/right/middle and only completes on contact (reduced motion ${reduced})`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: reduced ? 'reduce' : 'no-preference' });
    await page.goto('/');
    await page.waitForFunction(() => Boolean((window as Partial<GameWindow>).tumbleworks?.app));
    await page.evaluate(() => { (window as unknown as GameWindow).tumbleworks.app.manualClock = true; });
    await chooseLevel(page, CAMPAIGN.findIndex(level => level.id === 'board-31'));
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    for (const column of [0, 0, 1]) {
      const at = await page.evaluate(id => (window as unknown as GameWindow).tumbleworks.app.debugTargets()[`supply${id}`]!, column);
      await page.touchscreen.tap(at.x, at.y);
    }
    const before = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.replay().fingerprint);
    const target = await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.debugTargets()['supply1']!);
    await page.touchscreen.tap(target.x, target.y);
    const result = await page.evaluate(() => {
      const { app } = (window as unknown as GameWindow).tumbleworks;
      const runtime = app.runtime as ObservedRuntime;
      const machineStep = runtime.machine.step.bind(runtime.machine);
      const step = runtime.step.bind(runtime);
      const drawMarble = runtime.view.crowd.set.bind(runtime.view.crowd);
      let events: readonly MachineEvent[] = [];
      let feedback: readonly Feedback[] = [];
      const positions = new Map<number, { x: number; y: number }>();
      runtime.machine.step = () => (events = machineStep());
      runtime.step = () => (feedback = step());
      runtime.view.crowd.set = (id, x, y, z, ...rotation) => {
        positions.set(id, { x, y });
        drawMarble(id, x, y, z, ...rotation);
      };
      const landings: { fill: number; x: number; stretch: number; shift: number; feedback: readonly Feedback[]; expected: Feedback[] }[] = [];
      let dock = -1;
      let prematureSounds = 0;
      for (let tick = 0; tick < 1800 && landings.length < 3; tick++) {
        app.advance(1 / 60, false);
        const captured = events.find(e => e.type === 'captured' && (dock < 0 || e.dock === dock));
        if (!captured && feedback.some(e => e.type === 'deliver' || e.type === 'match')) prematureSounds++;
        if (captured?.type !== 'captured') continue;
        dock = captured.dock;
        runtime.render(1, 1 / 60);
        const box = runtime.view.boxes.get(`${dock}:0`)!.group;
        const physical = runtime.machine.readBoxes().find(b => b.dock === dock && b.index === 0)!;
        const marble = positions.get(captured.marbleId)!;
        landings.push({ fill: captured.fill, x: (marble.x - box.position.x) / box.scale.x,
          stretch: box.scale.x / box.scale.y, shift: Math.abs(box.position.x - physical.x) + Math.abs(box.position.y - physical.y),
          feedback, expected: events.filter(e => e.type === 'captured').map(e => ({ type: 'landing', arrival: e.fill })) });
      }
      const box = runtime.view.boxes.get(`${dock}:0`)!.group;
      const physical = runtime.machine.readBoxes().find(b => b.dock === dock && b.index === 0)!;
      const displacement = [];
      for (let frame = 0; frame < 18; frame++) {
        runtime.render(1, 1 / 60);
        displacement.push(Math.abs(box.position.x - physical.x));
      }
      // Reach another actual completion, then undo while its feedback is still active.
      let completing = false;
      for (let tick = 0; tick < 600 && !completing; tick++) {
        app.advance(1 / 60, false);
        completing = events.some(e => e.type === 'captured' && e.fill === 3);
      }
      runtime.render(1, 1 / 60);
      const activeShake = [...runtime.view.boxes.values()].some(({ group }) =>
        runtime.machine.readBoxes().some(b => runtime.view.boxes.get(`${b.dock}:${b.index}`)?.group === group && Math.abs(group.position.x - b.x) > .001));
      runtime.machine.step = machineStep;
      runtime.step = step;
      runtime.view.crowd.set = drawMarble;
      return { landings, prematureSounds, displacement, completing, activeShake };
    });
    expect(result.landings.map(e => e.fill)).toEqual([1, 2, 3]);
    for (const [index, x] of [-0.7, 0.7, 0].entries()) expect(result.landings[index]!.x).toBeCloseTo(x, 4);
    expect(result.landings.slice(0, 2).map(e => e.stretch)).toEqual([1, 1]);
    // The first two landings only dip the box under the marble; the shake belongs to the third.
    for (const landing of result.landings.slice(0, 2)) expect(landing.shift).toBeLessThan(reduced ? 0.0001 : 0.1);
    expect(result.prematureSounds).toBe(0);
    for (const landing of result.landings) expect(landing.feedback.filter(f => f.type !== 'impact')).toEqual(landing.expected);
    if (reduced) expect(Math.max(...result.displacement)).toBe(0);
    if (!reduced) expect(Math.max(...result.displacement)).toBeGreaterThan(0.015);
    expect(result.displacement.at(-1)).toBe(0);
    expect(result.completing).toBe(true);
    expect(result.activeShake).toBe(!reduced);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    expect(await page.evaluate(() => (window as unknown as GameWindow).tumbleworks.app.replay().fingerprint)).toBe(before);
    expect(await page.evaluate(() => {
      const runtime = (window as unknown as GameWindow).tumbleworks.app.runtime as ObservedRuntime;
      return runtime.machine.readBoxes().every(box => runtime.view.boxes.get(`${box.dock}:${box.index}`)!.group.position.x === box.x);
    })).toBe(true);
  });
}
