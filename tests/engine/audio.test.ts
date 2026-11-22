import themes from '../../src/world/village-themes.json' with { type: 'json' };
import { afterEach, beforeEach, expect, it, vi } from 'vitest';

class Param {
  value = 0;
  setValueAtTime = vi.fn();
  setTargetAtTime = vi.fn();
  cancelScheduledValues = vi.fn();
  exponentialRampToValueAtTime = vi.fn();
}
class Node {
  gain = new Param();
  threshold = new Param();
  knee = new Param();
  ratio = new Param();
  attack = new Param();
  release = new Param();
  connect(node: Node) { return node; }
  disconnect = vi.fn();
}
class Source extends Node {
  envelope: Node | null = null;
  override connect(node: Node) { this.envelope = node; return node; }
  buffer: unknown = null;
  playbackRate = new Param();
  loop = false;
  loopStart = 0;
  frequency = new Param();
  type = 'sine';
  start = vi.fn();
  stop = vi.fn();
  onended: (() => void) | null = null;
}
class MusicWorker {
  onmessage: ((event: { data: { rate: number; samples: Float32Array<ArrayBuffer> } }) => void) | null = null;
  postMessage = vi.fn();
  terminate = vi.fn();
  constructor() { workers.push(this); }
  complete() { this.onmessage?.({ data: { rate: 12000, samples: new Float32Array([0, .03, 0]) } }); }
}
const workers: MusicWorker[] = [];
const buffers: Source[] = [], oscillators: Source[] = [], contexts: Context[] = [];
const coastalSounds = () => buffers.filter(source => !source.loop || source.loopStart > 0);
const musicLoops = () => buffers.filter(source => source.loop && source.loopStart === 0);
const compressors: Node[] = [];
class Context {
  currentTime = 1;
  state = 'running';
  destination = new Node();
  resume = vi.fn(async () => {});
  constructor() { contexts.push(this); }
  createDynamicsCompressor() { const compressor = new Node(); compressors.push(compressor); return compressor; }
  createGain() { return new Node(); }
  createOscillator() { const source = new Source(); oscillators.push(source); return source; }
  createBufferSource() { const source = new Source(); buffers.push(source); return source; }
  createBuffer(_channels: number, length: number, rate: number) {
    const samples = new Float32Array(length);
    return { duration: length / rate, getChannelData: () => samples, copyToChannel: (source: Float32Array) => samples.set(source) };
  }
  decodeAudioData = vi.fn(async (bytes: ArrayBuffer) => ({ duration: .3, bytes }));
}
const fetchSound = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }));
const loaded = async () => { await vi.waitFor(() => expect(contexts[0]?.decodeAudioData).toHaveBeenCalledTimes(13)); await new Promise(resolve => setTimeout(resolve, 0)); };
beforeEach(() => {
  buffers.length = oscillators.length = contexts.length = compressors.length = 0;
  workers.length = 0;
  fetchSound.mockClear(); vi.resetModules();
  vi.stubGlobal('AudioContext', Context); vi.stubGlobal('fetch', fetchSound);
  vi.stubGlobal('Worker', MusicWorker);
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('does not load before interaction and fetches/decodes the bank only once', async () => {
  const { sfx } = await import('../../src/audio');
  sfx.tap(); expect(fetchSound).not.toHaveBeenCalled();
  sfx.unlock(); sfx.unlock(); await loaded();
  expect(fetchSound).toHaveBeenCalledTimes(13);
  expect(contexts).toHaveLength(1);
  sfx.tap();
  expect(buffers).toHaveLength(1);
  expect(buffers[0]!.start).toHaveBeenCalledWith(1);
});

it('uses the same light sample at ascending pitch, then a different body and reward on the final landing', async () => {
  const { sfx } = await import('../../src/audio');
  sfx.unlock(); await loaded();
  sfx.landing(1); sfx.landing(2); sfx.landing(3);
  expect(buffers).toHaveLength(4);
  expect(buffers[0]!.buffer).toBe(buffers[1]!.buffer);
  expect(buffers[1]!.playbackRate.value).toBeGreaterThan(buffers[0]!.playbackRate.value);
  expect(buffers[2]!.buffer).not.toBe(buffers[0]!.buffer);
  expect(buffers[3]!.buffer).not.toBe(buffers[2]!.buffer);
  expect(buffers.every(source => source.start.mock.calls[0]?.[0] === 1)).toBe(true);
});

it('bounds busy playback, leaves room for rewards, and makes the win audible', async () => {
  const { sfx } = await import('../../src/audio');
  sfx.unlock(); await loaded();
  for (let i = 0; i < 100; i++) sfx.release();
  expect(buffers.length).toBeLessThanOrEqual(8);
  const ordinary = buffers.length;
  sfx.landing(3); expect(buffers.length).toBe(ordinary + 2);
  for (let i = 0; i < 100; i++) sfx.boxFilled(i);
  expect(buffers.length).toBeLessThanOrEqual(12);
  const beforeWin = buffers.length;
  sfx.win(); expect(buffers.length).toBe(beforeWin + 1);
  expect(buffers.slice(0, beforeWin).every(source => source.stop.mock.calls.length)).toBe(true);
  buffers.at(-1)!.onended?.();
  expect(buffers.at(-1)!.disconnect).toHaveBeenCalled();
});

it('keeps input immediate during loading without replaying stale cues after cancel or mute', async () => {
  let finish!: (value: { ok: boolean; arrayBuffer(): Promise<ArrayBuffer> }) => void;
  fetchSound.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
  const { sfx } = await import('../../src/audio');
  sfx.unlock(); sfx.tap();
  expect(oscillators).toHaveLength(0);
  sfx.cancel(); sfx.toggleMute();
  finish({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }); await loaded();
  expect(buffers).toHaveLength(0);
  sfx.toggleMute(); sfx.tap(); expect(buffers).toHaveLength(1);
  expect(fetchSound).toHaveBeenCalledTimes(13);
});

it('muting stops existing tails and does not fetch when starting muted', async () => {
  const { sfx } = await import('../../src/audio');
  sfx.toggleMute(); sfx.unlock(); sfx.release();
  expect(fetchSound).not.toHaveBeenCalled(); expect(oscillators).toHaveLength(0);
  sfx.toggleMute(); await loaded(); sfx.release(); sfx.toggleMute();
  expect(buffers[0]!.stop).toHaveBeenCalled();
  sfx.tap(); expect(buffers).toHaveLength(1);
});

it('throttles physical impacts, but does not throttle a final landing', async () => {
  const { sfx } = await import('../../src/audio');
  sfx.unlock(); await loaded();
  for (let i = 0; i < 50; i++) sfx.impact(.8);
  expect(buffers).toHaveLength(1);
  sfx.landing(3); expect(buffers).toHaveLength(3);
  contexts[0]!.currentTime += .1; sfx.impact(.8); expect(buffers).toHaveLength(4);
});

it('schedules distinct film contacts and keeps them silent during fast forward or in a hidden tab', async () => {
  const page = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('document', page);
  const { sfx } = await import('../../src/audio');
  sfx.harbourRouteCue('cruise');
  sfx.unlock(); await loaded();
  expect(buffers).toHaveLength(0);

  sfx.boardFastForward(true);
  sfx.harbourRouteCue('transfer');
  sfx.boardFastForward(false);
  page.hidden = true;
  sfx.harbourRouteCue('arrival');
  expect(buffers).toHaveLength(0);

  page.hidden = false;
  sfx.harbourRouteCue('cruise');
  contexts[0]!.currentTime = 11;
  sfx.harbourRouteCue('transfer');
  contexts[0]!.currentTime = 17;
  sfx.harbourRouteCue('arrival');
  sfx.harbourBell();
  expect(buffers.map(source => source.start.mock.calls[0]?.[0]))
    .toEqual([1, 1.13, 11, 11.1, 17, 17.08, 17]);
  expect(new Set(buffers.map(source => source.buffer)).size).toBe(6);
  expect(fetchSound).toHaveBeenCalledTimes(13);
});

it('seats the last load ahead of the win phrase and cancels both voices on mute', async () => {
  const { sfx } = await import('../../src/audio');
  sfx.unlock(); await loaded();
  sfx.boxFilled(0);
  sfx.boardFastForward(true);
  sfx.finalLoad();
  expect(buffers).toHaveLength(3);
  expect(buffers[0]!.stop).toHaveBeenCalledOnce();
  expect(buffers[1]!.start).toHaveBeenCalledWith(1);
  expect(buffers[1]!.playbackRate.value).toBe(0.75);
  expect(buffers[2]!.start).toHaveBeenCalledWith(1.18);
  expect(buffers[2]!.buffer).not.toBe(buffers[1]!.buffer);
  sfx.toggleMute();
  expect(buffers[1]!.stop).toHaveBeenCalledOnce();
  expect(buffers[2]!.stop).toHaveBeenCalledOnce();
  sfx.finalLoad();
  expect(buffers).toHaveLength(3);
});

it('contains download/decode failures, stays silent and never retries per cue', async () => {
  fetchSound.mockRejectedValueOnce(new Error('offline'));
  const { sfx } = await import('../../src/audio');
  sfx.unlock();
  await vi.waitFor(() => expect(fetchSound).toHaveBeenCalledTimes(13));
  await new Promise(resolve => setTimeout(resolve, 0));
  sfx.tap(); expect(oscillators).toHaveLength(0); expect(buffers).toHaveLength(0);
  sfx.unlock(); sfx.tap(); expect(fetchSound).toHaveBeenCalledTimes(13);
  contexts[0]!.state = 'suspended'; contexts[0]!.resume.mockRejectedValueOnce(new Error('blocked'));
  sfx.unlock(); await new Promise(resolve => setTimeout(resolve, 0));
});

it('varies small contacts without changing the established landing and chain pitch steps', async () => {
  const { sfx } = await import('../../src/audio');
  sfx.unlock(); await loaded();
  vi.spyOn(Math, 'random').mockReturnValueOnce(0).mockReturnValueOnce(0)
    .mockReturnValueOnce(1).mockReturnValueOnce(1);
  sfx.tap(); sfx.tap();
  expect(buffers[0]!.buffer).toBe(buffers[1]!.buffer);
  expect(buffers[0]!.playbackRate.value).toBe(.98);
  expect(buffers[1]!.playbackRate.value).toBe(1.02);
  sfx.cancel();
  for (const slot of [0, 1, 4, 9]) sfx.deliver(slot);
  expect(buffers.slice(2).map(source => source.playbackRate.value)).toEqual([1, 2 ** (1 / 12), 2 ** (4 / 12), 2 ** (4 / 12)]);
  sfx.cancel();
  for (const chain of [0, 1, 7, 10]) sfx.boxFilled(chain);
  expect(buffers.slice(6).map(source => source.playbackRate.value)).toEqual([1, 2 ** (1 / 12), 2 ** (7 / 12), 2 ** (7 / 12)]);
  expect(compressors[0]!.threshold.value).toBe(-8);
  expect(compressors[0]!.ratio.value).toBe(2);
  expect(compressors[0]!.release.value).toBe(.18);
});

it('keeps repeated cue gains clearly below rewards with their existing timing and landing steps', async () => {
  const { sfx } = await import('../../src/audio');
  sfx.unlock(); await loaded();
  vi.spyOn(Math, 'random').mockReturnValue(1);
  sfx.tap(); sfx.release(); sfx.deliver(4); sfx.landing(1); sfx.landing(2);
  const repeated = buffers.map(source => source.envelope!.gain.value);
  sfx.cancel(); sfx.impact(1);
  expect(buffers.at(-1)!.envelope!.gain.value).toBeLessThan(.17);
  sfx.cancel(); sfx.boxFilled(0);
  const reward = buffers.at(-1)!.envelope!.gain.value;
  // At least 4.5 dB separation even at the loudest random variation.
  expect(Math.max(...repeated)).toBeLessThan(reward * .6);
  expect(buffers.slice(2, 5).map(source => source.playbackRate.value)).toEqual([2 ** (4 / 12), 1, 2 ** (2 / 12)]);
  expect(buffers.every(source => source.start.mock.calls[0]?.[0] === 1)).toBe(true);
});


it('gives a seated dock, departing truck and harbour bell distinct samples with cancellable tails', async () => {
  const { sfx } = await import('../../src/audio');
  sfx.unlock(); await loaded();
  sfx.landing(3); sfx.boxFilled(0); sfx.harbourBell();
  expect(buffers).toHaveLength(4);
  expect(new Set(buffers.map(source => source.buffer)).size).toBe(4);
  expect(buffers.every(source => source.start.mock.calls[0]?.[0] === 1)).toBe(true);
  sfx.toggleMute();
  expect(buffers.every(source => source.stop.mock.calls.length === 1)).toBe(true);
  sfx.harbourBell(); expect(buffers).toHaveLength(4);
});

it('fades one harbour loop after unlock and reuses it during rapid exit and re-entry', async () => {
  vi.useFakeTimers();
  const { sfx } = await import('../../src/audio');
  sfx.harbourAmbience(true);
  expect(contexts).toHaveLength(0);
  expect(fetchSound).not.toHaveBeenCalled();
  sfx.unlock();
  sfx.harbourAmbience(true);
  expect(coastalSounds()).toHaveLength(1);
  const surf = coastalSounds()[0]!;
  expect(surf.loop).toBe(true);
  expect(surf.start).toHaveBeenCalledTimes(1);
  expect(surf.envelope!.gain.setTargetAtTime.mock.calls[0]?.[0]).toBeGreaterThan(0);
  sfx.cancel();
  expect(surf.stop).not.toHaveBeenCalled();
  sfx.harbourAmbience(false);
  expect(surf.envelope!.gain.setTargetAtTime).toHaveBeenLastCalledWith(0, 1, expect.any(Number));
  vi.advanceTimersByTime(200);
  sfx.harbourAmbience(true);
  vi.advanceTimersByTime(600);
  expect(surf.stop).not.toHaveBeenCalled();
  expect(coastalSounds()).toHaveLength(1);
  sfx.harbourAmbience(false);
  vi.advanceTimersByTime(600);
  expect(surf.stop).toHaveBeenCalledTimes(1);
  expect(surf.disconnect).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  expect(fetchSound).toHaveBeenCalledTimes(13);
});

it('stops harbour and scheduled gulls while muted or hidden and restores only an active harbour', async () => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const page = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('document', page);
  const { sfx } = await import('../../src/audio');
  sfx.harbourAmbience(true);
  sfx.unlock();
  workers[0]!.complete();
  vi.advanceTimersByTime(6500);
  expect(coastalSounds().map(source => source.loop)).toEqual([true, false]);
  const [surf, gull] = coastalSounds();
  vi.advanceTimersByTime(30000);
  expect(coastalSounds()).toHaveLength(2);
  gull!.onended?.();
  expect(vi.getTimerCount()).toBe(1);

  page.hidden = true;
  page.dispatchEvent(new Event('visibilitychange'));
  expect(surf!.stop).toHaveBeenCalledTimes(1);
  expect(musicLoops()[0]!.stop).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  vi.advanceTimersByTime(30000);
  expect(coastalSounds()).toHaveLength(2);
  expect(musicLoops()).toHaveLength(1);
  page.hidden = false;
  page.dispatchEvent(new Event('visibilitychange'));
  expect(coastalSounds()).toHaveLength(3);
  expect(coastalSounds()[2]!.buffer).toBe(surf!.buffer);
  vi.advanceTimersByTime(6500);
  expect(coastalSounds()).toHaveLength(4);
  sfx.toggleMute();
  expect(coastalSounds()[2]!.stop).toHaveBeenCalledTimes(1);
  expect(coastalSounds()[3]!.stop).toHaveBeenCalledTimes(1);
  expect(musicLoops()[1]!.stop).toHaveBeenCalledTimes(1);
  expect(vi.getTimerCount()).toBe(0);
  sfx.harbourAmbience(false);
  sfx.toggleMute();
  expect(coastalSounds()).toHaveLength(4);
  expect(musicLoops()).toHaveLength(2);
  expect(vi.getTimerCount()).toBe(0);
});

it.each([0, themes.length])('hands off one board bed and ducks it during fast forward in chapter %i', async chapter => {
  vi.useFakeTimers();
  vi.spyOn(Math, 'random').mockReturnValue(0);
  const { sfx } = await import('../../src/audio');
  sfx.harbourAmbience(true);
  sfx.boardAmbience(true, chapter);
  expect(contexts).toHaveLength(0);
  sfx.unlock();
  expect(coastalSounds()).toHaveLength(1);
  const coast = coastalSounds()[0]!;
  expect(coast.envelope!.gain.setTargetAtTime).toHaveBeenLastCalledWith(.15, 1, .16);
  sfx.boardFastForward(true);
  expect(coast.envelope!.gain.setTargetAtTime.mock.lastCall?.[0]).toBeCloseTo(.0525);
  vi.advanceTimersByTime(30_000);
  expect(coastalSounds()).toHaveLength(1);

  sfx.boardFastForward(false);
  expect(coast.envelope!.gain.setTargetAtTime).toHaveBeenLastCalledWith(.15, 1, .16);
  sfx.boardAmbience(true, 2);
  expect(coastalSounds()).toHaveLength(1);
  vi.advanceTimersByTime(540);
  expect(coast.stop).toHaveBeenCalledOnce();
  const inland = coastalSounds()[1]!;
  expect(inland.buffer).not.toBe(coast.buffer);
  expect(inland.envelope!.gain.setTargetAtTime).toHaveBeenLastCalledWith(.13, 1, .16);
  vi.advanceTimersByTime(30_000);
  expect(coastalSounds()).toHaveLength(2);
  sfx.boardAmbience(false);
  vi.advanceTimersByTime(540);
  expect(inland.stop).toHaveBeenCalledOnce();
  expect(coastalSounds()[2]!.buffer).toBe(coast.buffer);
  expect(coastalSounds()[2]!.envelope!.gain.setTargetAtTime).toHaveBeenLastCalledWith(.22, 1, .16);
  sfx.harbourAmbience(false);
  vi.advanceTimersByTime(540);
  expect(vi.getTimerCount()).toBe(0);
});

it('switches island scores without layering them, and keeps one score in a same-island handoff', async () => {
  vi.useFakeTimers();
  const { sfx } = await import('../../src/audio');
  sfx.harbourAmbience(true, 2);
  expect(buffers).toHaveLength(0);
  sfx.unlock();
  expect(workers[0]!.postMessage).toHaveBeenCalledWith('mill');
  workers[0]!.complete();
  const [mill] = musicLoops();
  expect(coastalSounds()).toHaveLength(0);
  sfx.boardAmbience(true, 2);
  expect(musicLoops()).toHaveLength(1);
  sfx.harbourAmbience(false);
  sfx.boardAmbience(true, 3);
  expect(musicLoops()).toHaveLength(1);
  vi.advanceTimersByTime(450);
  expect(mill!.stop).toHaveBeenCalledOnce();
  workers[1]!.complete();
  const clock = musicLoops()[1]!;
  expect(clock.buffer).not.toBe(mill!.buffer);
  sfx.boardAmbience(false);
  vi.advanceTimersByTime(450);
  expect(clock.stop).toHaveBeenCalledOnce();
  vi.advanceTimersByTime(90);
  expect(vi.getTimerCount()).toBe(0);
});

it('ducks music under rewards without shortening an overlapping reward or cancelling fast-forward attenuation', async () => {
  const { sfx } = await import('../../src/audio');
  sfx.boardAmbience(true, 2);
  sfx.unlock(); await loaded();
  workers[0]!.complete();
  const gain = musicLoops()[0]!.envelope!.gain;
  expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(.68, 1, .20);
  sfx.finalLoad();
  expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(.68, 1.48, .25);
  contexts[0]!.currentTime = 1.02;
  sfx.boxFilled(0);
  expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(.68, 1.48, .25);
  sfx.boardFastForward(true);
  expect(gain.setTargetAtTime).toHaveBeenNthCalledWith(gain.setTargetAtTime.mock.calls.length - 1, .21 * .30, 1.02, .045);
  expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(.21, 1.48, .25);
  sfx.cancel();
  expect(gain.setTargetAtTime).toHaveBeenLastCalledWith(.21, 1.02, .20);
  sfx.toggleMute();
  expect(musicLoops()[0]!.stop).toHaveBeenCalledOnce();
});

it('starts synthesis off the gesture path and drops obsolete results across chapter, mute and visibility changes', async () => {
  const page = Object.assign(new EventTarget(), { hidden: false });
  vi.stubGlobal('document', page);
  const { sfx } = await import('../../src/audio');
  sfx.harbourAmbience(true, 1);
  expect(workers).toHaveLength(0);
  sfx.unlock(); sfx.unlock();
  expect(workers).toHaveLength(1);
  expect(musicLoops()).toHaveLength(0);

  sfx.harbourAmbience(true, 4);
  expect(workers[0]!.terminate).toHaveBeenCalledOnce();
  workers[0]!.complete();
  expect(musicLoops()).toHaveLength(0);

  sfx.toggleMute();
  expect(workers[1]!.terminate).toHaveBeenCalledOnce();
  workers[1]!.complete();
  expect(musicLoops()).toHaveLength(0);
  sfx.toggleMute();
  page.hidden = true;
  page.dispatchEvent(new Event('visibilitychange'));
  expect(workers[2]!.terminate).toHaveBeenCalledOnce();
  workers[2]!.complete();
  expect(musicLoops()).toHaveLength(0);

  page.hidden = false;
  page.dispatchEvent(new Event('visibilitychange'));
  expect(workers[3]!.postMessage).toHaveBeenCalledWith('bridge');
  workers[3]!.complete();
  expect(musicLoops()).toHaveLength(1);
  expect(workers[3]!.terminate).toHaveBeenCalledOnce();
  sfx.boardAmbience(true, 4);
  expect(musicLoops()).toHaveLength(1);
  expect(workers).toHaveLength(4);
});
