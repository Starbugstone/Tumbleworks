import { expect, test, type Page } from '@playwright/test';
import type { HarbourRouteCue } from '../../src/audio';
import type { App } from '../../src/view/App';

type Sound = typeof import('../../src/audio')['sfx'];
type AudioWindow = Window & { tumbleworks: { app: App }; observedSound: Pick<Sound, 'finalLoad' | 'deliver' | 'boxFilled' | 'harbourRouteCue' | 'harbourBell' | 'harbourAmbience' | 'boardAmbience'> & {
  buffers: Map<string, AudioBuffer>; voices: Set<AudioScheduledSourceNode>;
  harbour: { surf: AudioBufferSourceNode } | null;
  music: { source: AudioBufferSourceNode; gain: GainNode } | null;
}; audioCounts: { intake: number; complete: number; fastIntake: number; finalLoad: number } };

async function open(page: Page, level = 'board-31', manualClock = true) {
  await page.goto(`/?demo=${level}`);
  await page.waitForFunction(() => Boolean((window as Partial<AudioWindow>).tumbleworks?.app)
    && document.getElementById('boot')?.hidden
    && document.getElementById('journey-transition')?.hidden);
  await page.evaluate(async manualClock => {
    const target = window as unknown as AudioWindow;
    target.tumbleworks.app.manualClock = manualClock;
    const path = performance.getEntriesByType('resource').map(entry => entry.name).find(name => new URL(name).pathname === '/src/audio.ts');
    if (!path) throw new Error('Running audio module not found');
    target.observedSound = (await import(/* @vite-ignore */ path)).sfx;
  }, manualClock);
}
async function tapCrate(page: Page) {
  const point = await page.evaluate(() => (window as unknown as AudioWindow).tumbleworks.app.debugTargets()['supply0']!);
  await expect.poll(() => page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, point)).toBe('scene');
  await page.touchscreen.tap(point.x, point.y);
}

test('real MP3 bank loads once on a gesture, decodes cleanly and follows mute/restart/blur', async ({ page }) => {
  const requests: string[] = [], errors: string[] = [];
  page.on('request', request => { if (request.resourceType() === 'fetch' && /\.mp3(?:\?|$)/.test(request.url())) requests.push(request.url()); });
  page.on('pageerror', error => errors.push(error.message));
  await open(page);
  expect(requests).toHaveLength(0);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as AudioWindow).observedSound.buffers.size)).toBe(13);
  expect(requests).toHaveLength(13);
  expect(new Set(requests).size).toBe(13);
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
    expect(sample.channels, sample.cue).toBe(sample.cue === 'win' ? 2 : 1);
    expect(sample.peak, sample.cue).toBeGreaterThan(.005);
    expect(sample.peak, sample.cue).toBeLessThan(.8);
    expect(sample.onset, sample.cue).toBeGreaterThanOrEqual(0);
    expect(sample.onset, sample.cue).toBeLessThan(.035);
    if (sample.cue === 'win') {
      expect(sample.duration, sample.cue).toBeGreaterThanOrEqual(1.8);
      expect(sample.duration, sample.cue).toBeLessThan(2.1);
    } else expect(sample.duration, sample.cue).toBeLessThan(.95);
  }
  expect(decoded.find(sample => sample.cue === 'harbourBell')!.duration).toBeCloseTo(.72, 2);
  expect(await page.evaluate(() => {
    const sound = (window as unknown as AudioWindow).observedSound;
    sound.harbourBell(); sound.boxFilled(0); return sound.voices.size;
  })).toBe(2);
  await page.evaluate(() => window.dispatchEvent(new Event('blur')));
  expect(await page.evaluate(() => (window as unknown as AudioWindow).observedSound.voices.size)).toBe(0);
  await tapCrate(page);
  expect(await page.evaluate(() => (window as unknown as AudioWindow).tumbleworks.app.debugState()['released'])).toEqual([0]);
  await page.evaluate(() => (window as unknown as AudioWindow).observedSound.finalLoad());
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as AudioWindow).tumbleworks.app.debugState()['released'])).toEqual([]);
  // Undo cancels the reward; only its new, short detent cue may remain.
  expect(await page.evaluate(() => (window as unknown as AudioWindow).observedSound.voices.size)).toBeLessThanOrEqual(1);
  await page.getByRole('button', { name: 'Sound', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as AudioWindow).observedSound.voices.size)).toBe(0);
  await expect(page.getByRole('button', { name: 'Sound', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await open(page);
  await tapCrate(page);
  expect(requests).toHaveLength(13);
  expect(await page.evaluate(() => (window as unknown as AudioWindow).observedSound.buffers.size)).toBe(0);
  await page.getByRole('button', { name: 'Sound', exact: true }).click();
  await expect.poll(() => page.evaluate(() => (window as unknown as AudioWindow).observedSound.buffers.size)).toBe(13);
  // Trigger a long enough reward in the running sound system, then check the real cancellation paths.
  await page.evaluate(() => (window as unknown as AudioWindow).observedSound.finalLoad());
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as AudioWindow).observedSound.voices.size)).toBe(0);
  expect(await page.evaluate(() => {
    const sound = (window as unknown as AudioWindow).observedSound;
    sound.finalLoad(); window.dispatchEvent(new Event('blur')); return sound.voices.size;
  })).toBe(0);
  expect(errors).toEqual([]);
});

test('harbour ambience starts on gesture, reuses its loop, fades out and follows Sound', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await open(page);
  const running = () => page.evaluate(() => Boolean((window as unknown as AudioWindow).observedSound.harbour));
  await page.evaluate(() => (window as unknown as AudioWindow).observedSound.harbourAmbience(true));
  expect(await running()).toBe(false);
  await tapCrate(page);
  await expect.poll(running).toBe(true);
  const sample = await page.evaluate(() => {
    const sound = (window as unknown as AudioWindow).observedSound;
    const first = sound.harbour?.surf;
    if (!first?.buffer) throw new Error('Harbour surf buffer missing');
    sound.harbourAmbience(true);
    const data = first.buffer.getChannelData(0);
    const rms = Math.sqrt(data.reduce((sum, x) => sum + x * x, 0) / data.length);
    return { same: sound.harbour?.surf === first, loop: first.loop, seconds: first.buffer.duration,
      rms, seam: Math.abs(data[data.length - 1]! - data[Math.round(first.loopStart * first.buffer.sampleRate)]!) };
  });
  expect(sample).toMatchObject({ same: true, loop: true, seconds: 12 });
  expect(sample.rms).toBeGreaterThan(.015);
  expect(sample.rms).toBeLessThan(.10);
  expect(sample.seam).toBeLessThan(.04);
  await expect.poll(() => page.evaluate(() => Boolean((window as unknown as AudioWindow).observedSound.music))).toBe(true);
  const music = await page.evaluate(async () => {
    const active = (window as unknown as AudioWindow).observedSound.music;
    if (!active?.source.buffer) throw new Error('Island music buffer missing');
    const buffer = active.source.buffer;
    // Measure one settled cycle at the board gain and the shared master gain.
    const offline = new OfflineAudioContext(1, 48_000 * buffer.duration, 48_000);
    const loop = offline.createBufferSource(), gain = offline.createGain();
    loop.buffer = buffer;
    gain.gain.value = .68 * .8;
    loop.connect(gain).connect(offline.destination);
    loop.start();
    const samples = (await offline.startRendering()).getChannelData(0);
    const rms = Math.sqrt(samples.reduce((sum, value) => sum + value * value, 0) / samples.length);
    const source = buffer.getChannelData(0);
    return { loop: active.source.loop, rmsDbfs: 20 * Math.log10(rms),
      seam: Math.abs(source[0]! - source[source.length - 1]!) };
  });
  expect(music.loop).toBe(true);
  expect(music.rmsDbfs).toBeGreaterThanOrEqual(-36);
  expect(music.seam).toBeLessThan(.003);
  await page.getByRole('button', { name: 'Sound', exact: true }).click();
  expect(await running()).toBe(false);
  expect(await page.evaluate(() => (window as unknown as AudioWindow).observedSound.music)).toBeNull();
  await page.getByRole('button', { name: 'Sound', exact: true }).click();
  await expect.poll(running).toBe(true);
  expect(await page.evaluate(() => {
    const sound = (window as unknown as AudioWindow).observedSound;
    sound.harbourAmbience(false);
    const boardKeptLoop = Boolean(sound.harbour);
    sound.boardAmbience(false);
    return boardKeptLoop && Boolean(sound.harbour);
  })).toBe(true);
  await expect.poll(running).toBe(false);
  expect(errors).toEqual([]);
});

test('corrupt audio never blocks a real pour or replays a delayed cue', async ({ page }) => {
  const errors: string[] = [];
  const corrupted = new Set<string>();
  page.on('pageerror', error => errors.push(error.message));
  await page.route(/\.mp3(?:\?|$)/, async route => {
    const request = route.request();
    if (request.resourceType() !== 'fetch') return route.continue();
    await route.fulfill({ contentType: 'audio/mpeg', body: 'corrupt sample' });
    corrupted.add(new URL(request.url()).pathname);
  });
  await open(page);
  await tapCrate(page);
  expect(await page.evaluate(() => (window as unknown as AudioWindow).tumbleworks.app.debugState()['released'])).toEqual([0]);
  await expect.poll(() => corrupted.size).toBe(13);
  await page.getByRole('button', { name: 'Restart', exact: true }).click();
  expect(await page.evaluate(() => (window as unknown as AudioWindow).observedSound.buffers.size)).toBe(0);
  expect(await page.evaluate(() => (window as unknown as AudioWindow).observedSound.voices.size)).toBe(0);
  expect(errors).toEqual([]);
});

test('Little Harbour plays each route cue once at its forward crossing', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await open(page, 'harbour', false);
  await expect(page.locator('#scene')).toHaveAttribute('data-world-film', 'ready');
  await page.evaluate(() => { (window as unknown as AudioWindow).tumbleworks.app.manualClock = true; });
  await page.getByRole('button', { name: 'Play film', exact: true }).tap();
  await expect.poll(() => page.evaluate(() => (window as unknown as AudioWindow).observedSound.buffers.size)).toBe(13);
  const heard = await page.evaluate(() => {
    const { tumbleworks: { app }, observedSound: sound } = window as unknown as AudioWindow;
    const world = (app as unknown as { world: {
      filmTime: number;
      playback: { routeCues: { at: number; cue: HarbourRouteCue }[]; bellStrike: number };
    } }).world;
    const calls: { cue: HarbourRouteCue | 'bell'; time: number; voices: number }[] = [];
    const route = sound.harbourRouteCue.bind(sound), bell = sound.harbourBell.bind(sound);
    sound.harbourRouteCue = cue => {
      const before = sound.voices.size;
      route(cue);
      calls.push({ cue, time: world.filmTime, voices: sound.voices.size - before });
    };
    sound.harbourBell = () => {
      const before = sound.voices.size;
      bell();
      calls.push({ cue: 'bell', time: world.filmTime, voices: sound.voices.size - before });
    };
    const markers = [...world.playback.routeCues.map(cue => cue.at), world.playback.bellStrike];
    for (const time of markers) {
      app.advance(time - world.filmTime - .01);
      app.advance(.02);
      app.advance(.01);
    }
    return { calls, markers };
  });
  expect(heard.calls.map(({ cue }) => cue)).toEqual(['cruise', 'transfer', 'arrival', 'bell']);
  expect(heard.calls.map(({ voices }) => voices)).toEqual([2, 2, 2, 1]);
  for (const [index, call] of heard.calls.entries()) {
    expect(call.time).toBeCloseTo(heard.markers[index]! + .01, 4);
  }
});

test('held fast forward silences Loop intake in every lane but keeps truck completions', async ({ page }) => {
  await open(page, 'loop-1');
  await page.evaluate(() => {
    const target = window as unknown as AudioWindow;
    target.audioCounts = { intake: 0, complete: 0, fastIntake: 0, finalLoad: 0 };
    const sound = target.observedSound;
    const deliver = sound.deliver.bind(sound), complete = sound.boxFilled.bind(sound);
    sound.deliver = slot => {
      target.audioCounts.intake++;
      if (Number(target.tumbleworks.app.debugState()['speed']) > 1) target.audioCounts.fastIntake++;
      deliver(slot);
    };
    sound.boxFilled = chain => { target.audioCounts.complete++; complete(chain); };
    const finalLoad = sound.finalLoad.bind(sound);
    sound.finalLoad = () => { target.audioCounts.finalLoad++; finalLoad(); };
  });
  for (const speed of [1, 5]) {
    await page.getByRole('button', { name: 'Restart', exact: true }).click();
    await page.evaluate(() => { (window as unknown as AudioWindow).audioCounts = { intake: 0, complete: 0, fastIntake: 0, finalLoad: 0 }; });
    for (const lane of [0, 1]) {
      const at = await page.evaluate(id => (window as unknown as AudioWindow).tumbleworks.app.debugTargets()[`lane${id}`]!, lane);
      await page.touchscreen.tap(at.x, at.y);
    }
    if (speed === 5) await page.keyboard.down('g');
    expect(await page.evaluate(() => (window as unknown as AudioWindow).tumbleworks.app.debugState()['speed'])).toBe(speed);
    const result = await page.evaluate(() => {
      const target = window as unknown as AudioWindow, app = target.tumbleworks.app;
      // Rule completion precedes the last marble seating and its completion sound.
      for (let frame = 0; frame < 1800 && (app.runtime.status === 'playing' || app.runtime.busy); frame++) app.advance(1 / 60, false);
      return { ...target.audioCounts, status: app.runtime.status, busy: app.runtime.busy };
    });
    if (speed === 5) await page.keyboard.up('g');
    expect(result.status).toBe('won');
    expect(result.busy).toBe(false);
    expect(result.complete).toBe(2);
    expect(result.finalLoad).toBe(1);
    if (speed === 1) expect(result.intake).toBeGreaterThan(0);
    // Winning automatically releases fast forward; final seating can then sound at normal speed.
    expect(result.fastIntake).toBe(0);
  }
});
