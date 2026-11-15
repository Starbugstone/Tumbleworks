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
  for (const cue of ['complete', 'win']) {
    expect(measurements.find(entry => entry.cue === cue)!.decoded.spectralCentroidHz, cue).toBeLessThan(1500);
  }
  for (const cue of ['landing-final', 'undo', 'blocked', 'release']) {
    expect(measurements.find(entry => entry.cue === cue)!.decoded.phoneBodyEnergy, cue).toBeGreaterThan(.1);
  }
});

it('ships the measured CC0 bank with pinned recordings, generator and encoded bytes', () => {
  expect(manifest).toHaveLength(11);
  expect(manifest.reduce((sum, cue) => sum + cue.encodedBytes, 0)).toBeLessThanOrEqual(150_000);
  for (const cue of manifest) {
    expect(cue.licence).toBe('CC0-1.0');
    expect(cue.bitrate).toBeGreaterThanOrEqual(128000);
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
    expect(wav.toString('ascii', 0, 4)).toBe('RIFF');
    expect(wav.readUInt16LE(22)).toBe(1);
    expect(wav.readUInt32LE(24)).toBe(44100);
    expect(wav.readUInt16LE(34)).toBe(16);
    const offset = wav.indexOf(Buffer.from('data')) + 8;
    const length = wav.readUInt32LE(offset - 4) / 2;
    let peak = 0, energy = 0;
    for (let i = 0; i < length; i++) {
      const sample = wav.readInt16LE(offset + i * 2) / 32768;
      peak = Math.max(peak, Math.abs(sample)); energy += sample * sample;
      if (i < 44) expect(Math.abs(sample), cue.cue).toBeLessThan(.07);
    }
    expect(wav.readInt16LE(offset), cue.cue).toBe(0);
    expect(wav.readInt16LE(offset + (length - 1) * 2), cue.cue).toBe(0);
    expect(peak, cue.cue).toBeLessThan(.64);
    expect(20 * Math.log10(Math.sqrt(energy / length)), cue.cue).toBeGreaterThan(-27);
  }
});
