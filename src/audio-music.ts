import type { WorldLocation } from './world/locations';

export type MusicTheme = WorldLocation['kind'];
export type MusicPcm = { rate: number; samples: Float32Array<ArrayBuffer> };

type Rhythm = 'steady' | 'lilt' | 'hold' | 'cadence';
type Bar = readonly [bass: number, inner: number, top: number, answer: number, rhythm: Rhythm];
type Phrase = readonly [Bar, Bar, Bar, Bar];
type Score = { readonly beat: number; readonly phrases: readonly [Phrase, Phrase] };

// MIDI notes in two four-bar phrases. The second phrase changes the harmony and
// register before a cadence leads back into the first.
const SCORES: Record<MusicTheme, Score> = {
  harbour: { beat: .95, phrases: [
    [[50, 57, 66, 69, 'steady'], [47, 57, 62, 66, 'lilt'], [43, 55, 62, 71, 'hold'], [45, 55, 64, 69, 'steady']],
    [[52, 59, 67, 74, 'hold'], [47, 62, 67, 71, 'lilt'], [45, 57, 66, 64, 'steady'], [45, 55, 61, 64, 'cadence']],
  ] },
  garden: { beat: 1.02, phrases: [
    [[53, 60, 69, 72, 'hold'], [50, 57, 65, 69, 'steady'], [46, 57, 65, 72, 'lilt'], [48, 58, 67, 74, 'hold']],
    [[55, 62, 70, 74, 'lilt'], [52, 60, 67, 70, 'steady'], [50, 57, 65, 72, 'hold'], [48, 58, 64, 67, 'cadence']],
  ] },
  mill: { beat: .91, phrases: [
    [[48, 55, 64, 67, 'steady'], [45, 55, 60, 64, 'lilt'], [41, 53, 60, 69, 'steady'], [43, 53, 62, 67, 'hold']],
    [[52, 59, 67, 71, 'lilt'], [53, 60, 65, 69, 'hold'], [50, 57, 65, 72, 'lilt'], [43, 59, 65, 62, 'cadence']],
  ] },
  clock: { beat: .87, phrases: [
    [[52, 59, 67, 71, 'lilt'], [48, 55, 64, 67, 'steady'], [45, 52, 60, 64, 'lilt'], [47, 57, 63, 69, 'hold']],
    [[55, 62, 71, 74, 'steady'], [47, 54, 62, 66, 'hold'], [45, 57, 64, 72, 'lilt'], [47, 57, 63, 66, 'cadence']],
  ] },
  bridge: { beat: 1.06, phrases: [
    [[45, 57, 64, 71, 'hold'], [43, 55, 62, 69, 'steady'], [41, 53, 60, 67, 'hold'], [43, 57, 62, 64, 'lilt']],
    [[50, 57, 65, 72, 'hold'], [48, 55, 64, 67, 'lilt'], [41, 57, 65, 69, 'steady'], [52, 62, 68, 71, 'cadence']],
  ] },
  glass: { beat: .97, phrases: [
    [[55, 62, 71, 74, 'steady'], [52, 59, 67, 71, 'hold'], [48, 59, 67, 76, 'lilt'], [50, 60, 69, 74, 'steady']],
    [[57, 64, 72, 71, 'lilt'], [48, 64, 67, 76, 'hold'], [47, 55, 64, 71, 'steady'], [50, 60, 66, 69, 'cadence']],
  ] },
  saltworks: { beat: 1.10, phrases: [
    [[46, 53, 65, 70, 'hold'], [46, 55, 65, 67, 'steady'], [43, 53, 62, 67, 'hold'], [41, 53, 60, 65, 'lilt']],
    [[48, 55, 67, 70, 'hold'], [43, 55, 62, 65, 'lilt'], [39, 51, 63, 67, 'hold'], [41, 53, 60, 69, 'cadence']],
  ] },
  pottery: { beat: .93, phrases: [
    [[50, 57, 65, 69, 'lilt'], [53, 60, 69, 72, 'lilt'], [48, 55, 64, 67, 'steady'], [50, 57, 65, 62, 'hold']],
    [[55, 62, 70, 74, 'lilt'], [53, 60, 69, 65, 'steady'], [48, 55, 67, 72, 'lilt'], [45, 57, 64, 61, 'cadence']],
  ] },
};

const ENTRANCES: Record<Rhythm, readonly [inner: number, top: number, answer: number, echo: number]> = {
  steady: [.42, 1.17, 2.32, 3.34],
  lilt: [.68, 1.66, 2.08, 3.10],
  hold: [.25, .87, 2.78, 3.55],
  cadence: [.54, 1.45, 2.74, 3.48],
};

const SAMPLE_RATE = 12_000;
const LOOP_RMS = .036;

function note(samples: Float32Array, at: number, midi: number, seconds: number, velocity: number, mallet = false): void {
  const start = Math.round(at * SAMPLE_RATE);
  const length = Math.round(seconds * SAMPLE_RATE);
  const increment = 2 * Math.PI * (440 * 2 ** ((midi - 69) / 12)) / SAMPLE_RATE;
  const sinStep = Math.sin(increment), cosStep = Math.cos(increment);
  const attack = mallet ? 130 : 250;
  const decay = Math.exp((mallet ? -4.5 : -3.5) / length);
  const soften = Math.exp(-1 / (SAMPLE_RATE * (mallet ? .22 : .32)));
  let sine = 0, cosine = 1, tail = velocity, overtones = mallet ? .48 : .34;
  for (let i = 0; i < length; i++) {
    const envelope = Math.min(1, i / attack) ** 2 * Math.min(1, (length - i) / 1200) ** 2;
    // Derive the upper modes from one oscillator. The harder strike loses its overtones first.
    const second = 2 * sine * cosine;
    const third = sine * (3 - 4 * sine * sine);
    const wave = sine + overtones * (second + .28 * third);
    const offset = (start + i) % samples.length;
    samples[offset] = samples[offset]! + wave * envelope * tail;
    const nextSine = sine * cosStep + cosine * sinStep;
    cosine = cosine * cosStep - sine * sinStep;
    sine = nextSine;
    tail *= decay;
    overtones *= soften;
  }
}

export function makeMusic(theme: MusicTheme): MusicPcm {
  const { beat, phrases } = SCORES[theme];
  const bars = [...phrases[0], ...phrases[1]];
  const samples = new Float32Array(Math.round(bars.length * 4 * beat * SAMPLE_RATE));
  for (const [bar, [bass, inner, top, answer, rhythm]] of bars.entries()) {
    const start = bar * 4 * beat;
    const [innerAt, topAt, answerAt, echoAt] = ENTRANCES[rhythm];
    note(samples, start, bass, beat * 3.55, .78);
    note(samples, start + beat * innerAt, inner, beat * 3.02, .58);
    note(samples, start + beat * topAt, top, beat * 2.48, .50, true);
    note(samples, start + beat * answerAt, answer, beat * 2.45, .43, true);
    if (rhythm === 'lilt') note(samples, start + beat * 2.58, bass + 12, beat * 1.35, .25);
    // Carry the cadence into the next cycle through the wrapped note tail.
    note(samples, start + beat * echoAt, rhythm === 'cadence' ? top : inner + 12, beat * 1.72, .25);
  }
  const energy = samples.reduce((sum, sample) => sum + sample * sample, 0);
  const gain = LOOP_RMS / Math.sqrt(energy / samples.length);
  for (let i = 0; i < samples.length; i++) samples[i] = samples[i]! * gain;
  return { rate: SAMPLE_RATE, samples };
}
