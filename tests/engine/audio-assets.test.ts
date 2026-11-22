import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import manifest from '../../assets/audio/manifest.json';
import measurements from '../../assets/audio/measurements.json';

const audioFile = (path: string) => readFileSync(new URL(`../../assets/audio/${path}`, import.meta.url));
const hash = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');

it('keeps repeated contacts warm and the replacement gestures short', () => {
  for (const cue of ['tap', 'release', 'impact-wood', 'impact-glass', 'landing-light', 'undo']) {
    const measured = measurements.find(entry => entry.cue === cue)!;
    for (const metrics of [measured.source, measured.decoded]) {
      expect(metrics.spectralCentroidHz, cue).toBeLessThan(1500);
    }
  }
  const light = measurements.find(entry => entry.cue === 'landing-light')!.decoded;
  // Loop intake keeps its existing four-semitone ceiling. Check the brightest playback too.
  expect(light.spectralCentroidHz * 2 ** (4 / 12)).toBeLessThan(1500);
  // At +4 semitones this source band still falls below 2 kHz.
  expect(light.energyBelow1587Hz).toBeGreaterThan(.9);
  expect(light.durationSeconds).toBeGreaterThanOrEqual(.25);
  expect(light.durationSeconds).toBeLessThanOrEqual(.35);
  const release = measurements.find(entry => entry.cue === 'release')!.decoded;
  expect(release.durationSeconds).toBeGreaterThanOrEqual(.2);
  expect(release.durationSeconds).toBeLessThanOrEqual(.3);
  for (const cue of ['complete', 'truck-complete', 'win', 'harbour-bell']) {
    expect(measurements.find(entry => entry.cue === cue)!.decoded.spectralCentroidHz, cue).toBeLessThan(1500);
  }
  for (const cue of ['landing-final', 'undo', 'blocked', 'release']) {
    expect(measurements.find(entry => entry.cue === cue)!.decoded.phoneBodyEnergy, cue).toBeGreaterThan(.1);
  }
});

it('ships the measured CC0 bank with pinned recordings, generator and encoded bytes', () => {
  expect(manifest).toHaveLength(13);
  expect(manifest.reduce((sum, cue) => sum + cue.encodedBytes, 0)).toBeLessThanOrEqual(150_000);
  for (const cue of manifest) {
    expect(cue.licence).toBe('CC0-1.0');
    expect(cue.stereo, cue.cue).toBe(cue.cue === 'win');
    if (!['complete', 'truck-complete', 'win'].includes(cue.cue)) {
      expect(cue.bitrate, cue.cue).toBeLessThanOrEqual(80_000);
    }
    expect(hash(audioFile(cue.source))).toBe(cue.sourceSha256);
    expect(hash(readFileSync(new URL(`../../${cue.generator}`, import.meta.url)))).toBe(cue.generatorSha256);
    for (const original of cue.recordings) expect(hash(audioFile(original.source))).toBe(original.sourceSha256);
    const mp3 = readFileSync(new URL(`../../src/sounds/${cue.cue}.mp3`, import.meta.url));
    expect(hash(mp3)).toBe(cue.encodedSha256);
    expect(mp3.length).toBe(cue.encodedBytes);
    const measured = measurements.find(entry => entry.cue === cue.cue)!;
    expect(measured.encodedSha256).toBe(cue.encodedSha256);
    for (const metrics of [measured.source, measured.decoded]) {
      expect(metrics.peakDbfs, cue.cue).toBeLessThan(-2);
      expect(metrics.dominantPartialEnergy, cue.cue).toBeLessThan(.94);
      expect(metrics.edgeStep, cue.cue).toBeLessThan(.002);
      expect(metrics.firstMillisecondPeak, cue.cue).toBeLessThan(.07);
      expect(metrics.onsetSeconds, cue.cue).toBeLessThan(.035);
    }
  }
  const levels = measurements.map(entry => entry.decoded.rmsDbfs);
  expect(Math.max(...levels) - Math.min(...levels)).toBeLessThan(4);
});

it('keeps the actual PCM endpoints rounded and the bank levels within their measured range', () => {
  for (const cue of manifest) {
    const wav = audioFile(cue.source);
    const channels = cue.stereo ? 2 : 1;
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.readUInt16LE(22), cue.cue).toBe(channels);
    expect(wav.readUInt32LE(24)).toBe(44100);
    expect(wav.readUInt16LE(34)).toBe(16);
    const offset = wav.indexOf(Buffer.from('data')) + 8;
    const length = wav.readUInt32LE(offset - 4) / 2;
    let peak = 0, energy = 0;
    for (let i = 0; i < length; i++) {
      const sample = wav.readInt16LE(offset + i * 2) / 32768;
      peak = Math.max(peak, Math.abs(sample)); energy += sample * sample;
      if (i < 44 * channels) expect(Math.abs(sample), cue.cue).toBeLessThan(.07);
    }
    for (let channel = 0; channel < channels; channel++) {
      expect(wav.readInt16LE(offset + channel * 2), cue.cue).toBe(0);
      expect(wav.readInt16LE(offset + (length - channels + channel) * 2), cue.cue).toBe(0);
    }
    expect(peak, cue.cue).toBeLessThan(.64);
    expect(20 * Math.log10(Math.sqrt(energy / length)), cue.cue).toBeGreaterThan(-27);
  }
});


it('keeps the warm workshop bodies and adds measured upper content to the three new rewards', () => {
  const cue = (name: string) => manifest.find(entry => entry.cue === name)!;
  const rewards = ['landing-final', 'complete', 'truck-complete', 'win', 'harbour-bell'];
  expect(new Set(rewards.map(name => cue(name).encodedSha256)).size).toBe(rewards.length);
  for (const name of rewards) {
    const metrics = measurements.find(entry => entry.cue === name)!.decoded;
    expect(metrics.phoneBodyEnergy, name).toBeGreaterThan(.15);
    expect(metrics.spectralCentroidHz, name).toBeLessThan(1500);
  }
  const landing = measurements.find(entry => entry.cue === 'landing-light')!;
  for (const name of ['complete', 'truck-complete', 'win']) {
    const entry = measurements.find(entry => entry.cue === name)!;
    expect(entry.decoded.spectralCentroidHz, name).toBeGreaterThan(landing.decoded.spectralCentroidHz);
    expect(entry.review.above2kDbfs, name).toBeGreaterThanOrEqual(-40);
    expect(entry.review.above2kDeltaDb, name).toBeGreaterThanOrEqual(-18);
    expect(entry.review.above2kDeltaDb, name).toBeGreaterThan(landing.review.above2kDeltaDb);
    expect(cue(name).recordings.some(recording => recording.source.includes('glass_002')
      || recording.source.includes('confirmation_004')), name).toBe(true);
  }
  const win = measurements.find(entry => entry.cue === 'win')!.decoded;
  expect(win.channels).toBe(2);
  expect(win.stereoSideDbfs).toBeGreaterThan(-48);
});

it('gives completion rewards audible tails after ordinary contacts have ended', () => {
  const recoveries = [
    ['complete', .65, .33, .5, -40],
    ['truck-complete', .74, .33, .5, -40],
    ['win', 1.8, 1.15, 1.4, -43],
  ] as const;
  for (const [cue, duration, from, to, minRms] of recoveries) {
    const item = manifest.find(entry => entry.cue === cue)!;
    expect(measurements.find(entry => entry.cue === cue)!.decoded.durationSeconds).toBeGreaterThanOrEqual(duration);
    const wav = audioFile(item.source);
    const rate = wav.readUInt32LE(24);
    const channels = wav.readUInt16LE(22);
    const offset = wav.indexOf(Buffer.from('data')) + 8;
    const first = Math.round(from * rate) * channels, last = Math.round(to * rate) * channels;
    let energy = 0;
    for (let i = first; i < last; i++) energy += (wav.readInt16LE(offset + i * 2) / 32768) ** 2;
    expect(10 * Math.log10(energy / (last - first)), cue).toBeGreaterThan(minRms);
  }
});
