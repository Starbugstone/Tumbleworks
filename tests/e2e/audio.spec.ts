import { expect, test, type Page } from '@playwright/test';
import type { App } from '../../src/view/App';

type Sound = typeof import('../../src/audio')['sfx'];
type AudioWindow = Window & { tumbleworks: { app: App }; observedSound: Pick<Sound, 'win' | 'deliver' | 'boxFilled'> & {
  buffers: Map<string, AudioBuffer>; voices: Set<AudioScheduledSourceNode>;
}; audioCounts: { intake: number; complete: number } };

async function open(page: Page, level = 'board-31') {
  await page.goto(`/?try=${level}`);
  await page.waitForFunction(() => Boolean((window as Partial<AudioWindow>).tumbleworks?.app));
  await page.evaluate(async () => {
    const target = window as unknown as AudioWindow;
    target.tumbleworks.app.manualClock = true;
    const path = performance.getEntriesByType('resource').map(entry => entry.name).find(name => new URL(name).pathname === '/src/audio.ts');
    if (!path) throw new Error('Running audio module not found');
    target.observedSound = (await import(/* @vite-ignore */ path)).sfx;
  });
}
async function tapCrate(page: Page) {
  const point = await page.evaluate(() => (window as unknown as AudioWindow).tumbleworks.app.debugTargets()['supply0']!);
  await page.touchscreen.tap(point.x, point.y);
}

test('real MP3 bank loads once on a gesture, decodes cleanly and follows mute/restart/blur', async ({ page }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on('request', request => { if (request.resourceType() === 'fetch' && /\.mp3(?:\?|$)/.test(request.url())) requests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await open(page);
  expect(requests).toHaveLength(0);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as AudioWindow).observedSound.buffers.size)).toBe(11);
  expect(requests).toHaveLength(11);
  expect(new Set(requests).size).toBe(11);
  const decoded = await page.evaluate(() => [...(window as unknown as AudioWindow).observedSound.buffers].map(([cue, buffer]) => {
    const samples = buffer.getChannelData(0);
    let peak = 0, first = -1;
    for (let i = 0; i < samples.length; i++) {
      peak = Math.max(peak, Math.abs(samples[i]!));
      if (first < 0 && Math.abs(samples[i]!) > .001) first = i;
    }
    return { cue, channels: buffer.numberOfChannels, duration: buffer.duration, peak, onset: first / buffer.sampleRate };
  }));
  for (const sample of decoded) {
    expect(sample.channels, sample.cue).toBe(1);
    expect(sample.peak, sample.cue).toBeGreaterThan(.005);
    expect(sample.peak, sample.cue).toBeLessThan(.8);
    expect(sample.onset, sample.cue).toBeGreaterThanOrEqual(0);
    expect(sample.onset, sample.cue).toBeLessThan(.035);
    expect(sample.duration, sample.cue).toBeLessThan(.6);
  }
  await tapCrate(page);
  expect(await page.evaluate(() => (window as unknown as AudioWindow).tumbleworks.app.debugState()['released'])).toEqual([0]);
  await page.getByRole('button', { name: 'Sound', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as AudioWindow).observedSound.voices.size)).toBe(0);
  await expect(page.getByRole('button', { name: 'Sound', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await open(page);
  await tapCrate(page);
  expect(requests).toHaveLength(11);
  expect(await page.evaluate(() => (window as unknown as AudioWindow).observedSound.buffers.size)).toBe(0);
  await page.getByRole('button', { name: 'Sound', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as AudioWindow).observedSound.buffers.size)).toBe(11);
  // Trigger a long enough reward in the running sound system, then check the real cancellation paths.
  await page.evaluate(() => (window as unknown as AudioWindow).observedSound.win());
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as AudioWindow).observedSound.voices.size)).toBe(0);
  expect(await page.evaluate(() => {
    const sound = (window as unknown as AudioWindow).observedSound;
    sound.win(); window.dispatchEvent(new Event('blur')); return sound.voices.size;
  })).toBe(0);
  expect(errors).toEqual([]);
});

test('corrupt audio never blocks a real pour or replays a delayed cue', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/\.mp3(?:\?|$)/, route => route.request().resourceType() === 'fetch'
    ? route.fulfill({ contentType: 'audio/mpeg', body: 'corrupt sample' }) : route.continue());
  await open(page);
  await tapCrate(page);
  expect(await page.evaluate(() => (window as unknown as AudioWindow).tumbleworks.app.debugState()['released'])).toEqual([0]);
  await expect.poll(() => page.evaluate(() => performance.getEntriesByType('resource').filter(entry =>
    (entry as PerformanceResourceTiming).initiatorType === 'fetch' && /\.mp3(?:\?|$)/.test(entry.name)).length)).toBe(11);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as AudioWindow).observedSound.buffers.size)).toBe(0);
  expect(await page.evaluate(() => (window as unknown as AudioWindow).observedSound.voices.size)).toBe(0);
  expect(errors).toEqual([]);
});

test('held fast forward silences Loop intake in every lane but keeps truck completions', async ({ page }) => {
  await open(page, 'loop-1');
  await page.evaluate(() => {
    const target = window as unknown as AudioWindow;
    target.audioCounts = { intake: 0, complete: 0 };
    const sound = target.observedSound;
    const deliver = sound.deliver.bind(sound), complete = sound.boxFilled.bind(sound);
    sound.deliver = slot => { target.audioCounts.intake++; deliver(slot); };
    sound.boxFilled = chain => { target.audioCounts.complete++; complete(chain); };
  });
  for (const speed of [1, 5]) {
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    await page.evaluate(() => { (window as unknown as AudioWindow).audioCounts = { intake: 0, complete: 0 }; });
    for (const lane of [0, 1]) {
      const at = await page.evaluate(id => (window as unknown as AudioWindow).tumbleworks.app.debugTargets()[`lane${id}`]!, lane);
      await page.touchscreen.tap(at.x, at.y);
    }
    if (speed === 5) await page.keyboard.down('g');
    const result = await page.evaluate(() => {
      const target = window as unknown as AudioWindow, app = target.tumbleworks.app;
      for (let frame = 0; frame < 1800 && app.runtime.status === 'playing'; frame++) app.advance(1 / 60, false);
      return { ...target.audioCounts, status: app.runtime.status };
    });
    if (speed === 5) await page.keyboard.up('g');
    expect(result.status).toBe('won');
    expect(result.complete).toBe(2);
    if (speed === 1) expect(result.intake).toBeGreaterThan(0);
    else expect(result.intake).toBe(0);
  }
});
