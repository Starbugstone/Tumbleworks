import { afterEach, beforeEach, expect, it, vi } from 'vitest';

class Param {
  value = 0;
  setValueAtTime = vi.fn();
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
  frequency = new Param();
  type = 'sine';
  start = vi.fn();
  stop = vi.fn();
  onended: (() => void) | null = null;
}
const buffers: Source[] = [], oscillators: Source[] = [], contexts: Context[] = [];
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
  decodeAudioData = vi.fn(async (bytes: ArrayBuffer) => ({ duration: .3, bytes }));
}
const fetchSound = vi.fn(async () => ({ ok: true, arrayBuffer: async () => new ArrayBuffer(1) }));
const loaded = async () => { await vi.waitFor(() => expect(contexts[0]?.decodeAudioData).toHaveBeenCalledTimes(11)); await new Promise(resolve => setTimeout(resolve, 0)); };
beforeEach(() => {
  buffers.length = oscillators.length = contexts.length = compressors.length = 0;
  fetchSound.mockClear(); vi.resetModules();
  vi.stubGlobal('AudioContext', Context); vi.stubGlobal('fetch', fetchSound);
});
afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

it('does not load before interaction and fetches/decodes the bank only once', async () => {
  const { sfx } = await import('../../src/audio');
  sfx.tap(); expect(fetchSound).not.toHaveBeenCalled();
  sfx.unlock(); sfx.unlock(); await loaded();
  expect(fetchSound).toHaveBeenCalledTimes(11);
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
  expect(fetchSound).toHaveBeenCalledTimes(11);
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

it('contains download/decode failures, stays silent and never retries per cue', async () => {
  fetchSound.mockRejectedValueOnce(new Error('offline'));
  const { sfx } = await import('../../src/audio');
  sfx.unlock();
  await vi.waitFor(() => expect(fetchSound).toHaveBeenCalledTimes(11));
  await new Promise(resolve => setTimeout(resolve, 0));
  sfx.tap(); expect(oscillators).toHaveLength(0); expect(buffers).toHaveLength(0);
  sfx.unlock(); sfx.tap(); expect(fetchSound).toHaveBeenCalledTimes(11);
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
