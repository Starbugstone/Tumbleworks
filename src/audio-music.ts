import type { WorldLocation } from './world/locations';

export type MusicTheme = WorldLocation['kind'];
export type MusicPcm = { rate: number; samples: Float32Array<ArrayBuffer> };

type Bar = readonly [bass: number, inner: number, top: number, answer: number];
type Score = { readonly beat: number; readonly bars: readonly [Bar, Bar, Bar, Bar] };

// MIDI notes. Each settlement carries a four-bar phrase on the same felt instrument.
const SCORES: Record<MusicTheme, Score> = {
  harbour: { beat: .95, bars: [[50, 57, 66, 69], [47, 57, 62, 66], [43, 55, 62, 71], [45, 55, 64, 69]] },
  garden: { beat: 1.02, bars: [[53, 60, 69, 72], [50, 57, 65, 69], [46, 57, 65, 72], [48, 58, 67, 74]] },
  mill: { beat: .91, bars: [[48, 55, 64, 67], [45, 55, 60, 64], [41, 53, 60, 69], [43, 53, 62, 67]] },
  clock: { beat: .87, bars: [[52, 59, 67, 71], [48, 55, 64, 67], [45, 52, 60, 64], [47, 57, 63, 69]] },
  bridge: { beat: 1.06, bars: [[45, 57, 64, 71], [43, 55, 62, 69], [41, 53, 60, 67], [43, 57, 62, 64]] },
  glass: { beat: .97, bars: [[55, 62, 71, 74], [52, 59, 67, 71], [48, 59, 67, 76], [50, 60, 69, 74]] },
};

const SAMPLE_RATE = 12_000;
const LOOP_RMS = .036;

function note(samples: Float32Array, at: number, midi: number, seconds: number, velocity: number): void {
  const start = Math.round(at * SAMPLE_RATE);
  const length = Math.round(seconds * SAMPLE_RATE);
  const increment = 2 * Math.PI * (440 * 2 ** ((midi - 69) / 12)) / SAMPLE_RATE;
  const decay = Math.exp(-4 / length);
  let phase = 0, tail = velocity;
  for (let i = 0; i < length; i++) {
    const envelope = Math.min(1, i / 260) ** 2 * Math.min(1, (length - i) / 1200) ** 2;
    const wave = Math.sin(phase) + Math.sin(2 * phase) * .22 + Math.sin(3 * phase) * .035;
    const offset = (start + i) % samples.length;
    samples[offset] = samples[offset]! + wave * envelope * tail;
    phase += increment;
    tail *= decay;
  }
}

export function makeMusic(theme: MusicTheme): MusicPcm {
  const { beat, bars } = SCORES[theme];
  const samples = new Float32Array(Math.round(bars.length * 4 * beat * SAMPLE_RATE));
  for (const [bar, [bass, inner, top, answer]] of bars.entries()) {
    const start = bar * 4 * beat;
    note(samples, start, bass, beat * 3.25, .78);
    note(samples, start + beat * .44, inner, beat * 2.7, .52);
    note(samples, start + beat * 1.12, top, beat * 2.6, .53);
    note(samples, start + beat * 2.36, answer, beat * 2.7, .43);
    // Wrap this answering tail around the bar line, including the end of the loop.
    note(samples, start + beat * 3.37, inner + 12, beat * 1.7, .24);
  }
  const energy = samples.reduce((sum, sample) => sum + sample * sample, 0);
  const gain = LOOP_RMS / Math.sqrt(energy / samples.length);
  for (let i = 0; i < samples.length; i++) samples[i] = samples[i]! * gain;
  return { rate: SAMPLE_RATE, samples };
}
