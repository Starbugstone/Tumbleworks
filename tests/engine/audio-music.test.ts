import { expect, it } from 'vitest';
import { makeMusic, type MusicTheme } from '../../src/audio-music';

const tempos = [
  ['harbour', .95], ['garden', 1.02], ['mill', .91],
  ['clock', .87], ['bridge', 1.06], ['glass', .97], ['saltworks', 1.10], ['pottery', .93],
] satisfies [MusicTheme, number][];

it.each(tempos)('renders two distinct, level-matched phrases for %s', (theme, beat) => {
  const { samples, rate } = makeMusic(theme);
  expect(samples.length).toBe(Math.round(8 * 4 * beat * rate));
  const half = samples.length / 2;
  let energy = 0, contrast = 0, peak = 0;
  for (let i = 0; i < half; i++) {
    const first = samples[i]!, second = samples[i + half]!;
    energy += first ** 2 + second ** 2;
    contrast += (first - second) ** 2;
    peak = Math.max(peak, Math.abs(first), Math.abs(second));
  }
  expect(Math.sqrt(energy / samples.length)).toBeCloseTo(.036, 5);
  expect(contrast / energy).toBeGreaterThan(.6);
  expect(peak).toBeLessThan(.25);
  expect(Math.abs(samples[0]! - samples[samples.length - 1]!)).toBeLessThan(.003);
});
