#!/usr/bin/env python3
"""Deterministic CC0 toy foley and modal mallets; Python standard library + FFmpeg.

Original synthesis/arrangements in this script are dedicated to CC0-1.0.
Kenney recordings retain their own tracked CC0 notice. No runtime synthesis.
"""
import argparse
from array import array
import hashlib
import json
import math
import os
from pathlib import Path
import random
import subprocess
import sys
import wave

ROOT = Path(__file__).resolve().parent.parent
RATE = 44100
FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
GENERATED = ROOT / 'assets/audio/generated'
RECORDINGS = {
    'wood': 'sources/kenney-impact/impactWood_light_000.ogg',
    'glass': 'sources/kenney-impact/impactGlass_light_000.ogg',
    'soft': 'sources/kenney-impact/impactSoft_medium_000.ogg',
}
RECIPES = {
    'tap': 'Kenney wood at 0.82x, double low-pass 1600 Hz, 5 ms felt onset',
    'release': 'Four rounded Kenney wood knocks at 0/32/71/118 ms, varied pitch, A3 wooden body; no air',
    'impact-wood': 'Kenney light wood at 0.94x, double low-pass 1800 Hz, 5 ms onset',
    'impact-glass': 'Kenney light glass at 0.87x, double low-pass 1800 Hz, 6 ms onset',
    'landing-light': 'G4 (392 Hz) felt marimba/kalimba, detuned modes, 0.30 s, low-pass 1800 Hz',
    'landing-final': 'D4 (293.66 Hz) felt marimba with audible 587 Hz body partial, 0.40 s',
    'complete': 'D4 A4 D5 warm marimba triplet at 0/85/170 ms, quiet D6 vibraphone accent',
    'blocked': 'Kenney soft/wood at 0.78x/0.72x with D4/587 Hz muted body, low-pass 1250 Hz',
    'undo': 'D4 C4 damped wooden double note at 0/95 ms; no reverse or air',
    'jam': 'Muted marimba A4 D4 descent at 0/160 ms, warm room',
    'win': 'D4 F#4 A4 D5 marimba ascent at 0/120/240/360 ms; warm D-major vibraphone chord at 520 ms, quiet D6 accent',
}


def lowpass(samples, hz):
    a = 1 - math.exp(-2 * math.pi * hz / RATE)
    value = 0.0
    result = []
    for sample in samples:
        value += a * (sample - value)
        result.append(value)
    return result


def soften(samples, attack=.005, release=.020):
    result = []
    for i, sample in enumerate(samples):
        onset = .5 - .5 * math.cos(math.pi * min(1, i / (attack * RATE)))
        tail = .5 - .5 * math.cos(math.pi * min(1, (len(samples) - 1 - i) / (release * RATE)))
        result.append(sample * onset * tail)
    return result


def felt_strike(seed):
    # Only six milliseconds of low-passed excitation, never an air/swish layer.
    rng = random.Random(seed)
    noise = lowpass([rng.uniform(-1, 1) for _ in range(round(.006 * RATE))], 850)
    return soften(noise, .003, .003)

def recording(kind, duration, speed=1, cutoff=6000):
    data = subprocess.check_output([FFMPEG, '-v', 'error', '-i', str(ROOT / 'assets/audio' / RECORDINGS[kind]),
                                    '-af', 'pan=mono|c0=0.5*c0+0.5*c1', '-ar', str(RATE), '-f', 'f32le', '-'])
    samples = array('f')
    samples.frombytes(data)
    if sys.byteorder != 'little':
        samples.byteswap()
    threshold = max(map(abs, samples)) * .015
    onset = next(i for i, x in enumerate(samples) if abs(x) > threshold)
    samples = samples[max(0, onset - 100):]
    result = []
    for i in range(round(duration * RATE)):
        at = i * speed
        j = int(at)
        result.append(samples[j] * (1 - (at - j)) + samples[j + 1] * (at - j) if j + 1 < len(samples) else 0)
    return soften(lowpass(lowpass(result, cutoff), cutoff))


def add(target, sound, at=0, gain=1):
    start = round(at * RATE)
    for i in range(min(len(sound), len(target) - start)):
        target[start + i] += sound[i] * gain


def mallet(hz, duration, material, seed, velocity=1):
    rng = random.Random(seed)
    # A small second partial keeps even the low notes audible on phone speakers.
    ratios = (1, 2, 3.93, 9.24) if material == 'marimba' else (1, 2, 3.9, 5.4)
    amplitudes = (1, .65, .55, .09) if material == 'marimba' else (1, .32, .36, .10)
    decay = (.085 if material == 'marimba' else .14) * (392 / hz) ** .22
    result = [0.0] * round(duration * RATE)
    velocity *= rng.uniform(.97, 1.03)
    for mode, (ratio, amplitude) in enumerate(zip(ratios, amplitudes)):
        frequency = hz * ratio * rng.uniform(.999, 1.001)
        if frequency > RATE * .45:
            continue
        tau = decay / (1 + .48 * mode)
        # Three nearby resonances per partial give a little warmth without chorus effects.
        for detune, weight in ((-.003, .22), (0, .56), (.003, .22)):
            for i in range(len(result)):
                t = i / RATE
                attack = .5 - .5 * math.cos(math.pi * min(1, t / .005))
                result[i] += velocity * amplitude * weight * attack * math.exp(-t / tau) * math.sin(2 * math.pi * frequency * (1 + detune) * t)
    add(result, felt_strike(seed + 2000), gain=.035 * velocity)
    return lowpass(lowpass(result, 1800 if material == 'marimba' else 2400), 2400)

def room(dry, amount):
    # One shared small-room recipe, baked so cancel() stops reflections with their voice.
    result = dry.copy()
    damped = lowpass(lowpass(dry, 1400), 1400)
    for delay, gain in ((.013, .30), (.023, -.22), (.037, .18), (.053, .13),
                        (.079, -.09), (.107, .06), (.139, .035)):
        add(result, damped, delay, gain * amount)
    return result


def finish(samples):
    # Gentle saturation rounds transient crests; final linear gain leaves encoder headroom.
    drive = .85 / max(map(abs, samples))
    samples = [math.tanh(x * drive) for x in samples]
    mean = sum(samples) / len(samples)
    samples = [x - mean for x in samples]
    attack, release = round(.006 * RATE), round(.035 * RATE)
    for i in range(len(samples)):
        fade_in = .5 - .5 * math.cos(math.pi * min(1, i / attack))
        fade_out = .5 - .5 * math.cos(math.pi * min(1, (len(samples) - 1 - i) / release))
        samples[i] *= fade_in * fade_out
    rms = math.sqrt(sum(x * x for x in samples) / len(samples))
    gain = min(10 ** (-22 / 20) / rms, .63 / max(map(abs, samples)))
    return [x * gain for x in samples]


def write_wave(path, samples):
    pcm = array('h', (round(x * 32767) for x in samples))
    if sys.byteorder != 'little':
        pcm.byteswap()
    with wave.open(str(path), 'wb') as output:
        output.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
        output.writeframes(pcm.tobytes())


def generate():
    durations = dict(zip(RECIPES, (.14, .27, .14, .18, .30, .40, .65, .22, .32, .64, 1.28)))
    bank = {cue: [0.0] * round(seconds * RATE) for cue, seconds in durations.items()}
    add(bank['tap'], recording('wood', .14, .82, 1600))
    add(bank['impact-wood'], recording('wood', .14, .94, 1800))
    add(bank['impact-glass'], soften(recording('glass', .18, .87, 1800), .006))
    add(bank['blocked'], recording('soft', .22, .78, 1250), gain=.25)
    add(bank['blocked'], recording('wood', .16, .72, 1250), gain=.7)
    add(bank['blocked'], mallet(293.66, .22, 'marimba', 5), gain=.22)
    add(bank['release'], mallet(220, .25, 'marimba', 6), gain=.32)
    for time, speed, gain in ((0, .78, .85), (.032, .94, .65), (.071, .86, .48), (.118, 1.06, .32)):
        add(bank['release'], recording('wood', .13, speed, 1500), time, gain)
    for i, hz in enumerate((293.66, 261.63)):
        add(bank['undo'], mallet(hz, .22, 'marimba', 7 + i), .095 * i, .65 - .12 * i)
    add(bank['landing-light'], mallet(392, .30, 'marimba', 10))
    add(bank['landing-final'], mallet(293.66, .40, 'marimba', 11))
    for i, hz in enumerate((293.66, 440, 587.33)):
        add(bank['complete'], mallet(hz, .46, 'marimba', 20 + i), .085 * i, .80 + .1 * i)
    add(bank['complete'], mallet(1174.66, .40, 'vibes', 23), .17, .045)
    for i, hz in enumerate((440, 293.66)):
        add(bank['jam'], mallet(hz, .46, 'marimba', 30 + i), .16 * i, 1 - .08 * i)
    for i, hz in enumerate((293.66, 369.99, 440, 587.33)):
        add(bank['win'], mallet(hz, .48, 'marimba', 40 + i), .12 * i, .65)
        add(bank['win'], mallet(hz, .75, 'vibes', 50 + i), .52, .40)
    add(bank['win'], mallet(1174.66, .60, 'vibes', 60), .57, .055)
    GENERATED.mkdir(parents=True, exist_ok=True)
    dependencies = {name: hashlib.sha256((ROOT / 'assets/audio' / path).read_bytes()).hexdigest()
                    for name, path in RECORDINGS.items()}
    for cue, samples in bank.items():
        write_wave(GENERATED / f'{cue}.wav', finish(room(samples, .55 if cue in ('complete', 'win') else .22)))
    provenance = {'generator': 'scripts/generate-sounds.py',
                  'generatorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                  'recordings': {RECORDINGS[name]: digest for name, digest in dependencies.items()},
                  'recipes': RECIPES, 'sampleRate': RATE, 'seedPolicy': 'fixed explicit seed per felt strike and modal note'}
    (GENERATED / 'provenance.json').write_text(json.dumps(provenance, indent=2) + '\n')


def fft(values):
    n = len(values)
    if n == 1:
        return values
    even, odd = fft(values[::2]), fft(values[1::2])
    factors = [complex(math.cos(-2 * math.pi * k / n), math.sin(-2 * math.pi * k / n)) * odd[k] for k in range(n // 2)]
    return [even[k] + factors[k] for k in range(n // 2)] + [even[k] - factors[k] for k in range(n // 2)]


def measure(samples):
    size = 4096
    power = [0.0] * (size // 2)
    # Integrate Hann-windowed power across the entire cue, not just its brightest strike.
    for start in range(0, len(samples), size // 2):
        frame = [samples[start + i] if start + i < len(samples) else 0 for i in range(size)]
        spectrum = fft([x * (.5 - .5 * math.cos(2 * math.pi * i / (size - 1))) for i, x in enumerate(frame)])
        for i in range(1, size // 2):
            power[i] += abs(spectrum[i]) ** 2
    energy = sum(power)
    dominant = max(range(len(power)), key=power.__getitem__)
    peak = max(map(abs, samples))
    rms = math.sqrt(sum(x * x for x in samples) / len(samples))
    return {'durationSeconds': round(len(samples) / RATE, 4), 'peakDbfs': round(20 * math.log10(max(peak, 1e-12)), 2),
            'rmsDbfs': round(20 * math.log10(max(rms, 1e-12)), 2),
            'spectralCentroidHz': round(sum(i * RATE / size * p for i, p in enumerate(power)) / max(energy, 1e-20)),
            'energyBelow1587Hz': round(sum(p for i, p in enumerate(power) if i * RATE / size < 1587) / max(energy, 1e-20), 4),
            'phoneBodyEnergy': round(sum(p for i, p in enumerate(power) if 300 <= i * RATE / size <= 900) / max(energy, 1e-20), 4),
            'dominantPartialEnergy': round(sum(power[max(0, dominant - 2):dominant + 3]) / max(energy, 1e-20), 4),
            'firstMillisecondPeak': round(max(map(abs, samples[:44])), 5),
            'edgeStep': round(max(abs(samples[0]), abs(samples[-1])), 6),
            'onsetSeconds': round(next((i / RATE for i, x in enumerate(samples) if abs(x) > .001), 0), 4)}


def failures(metrics, cue=None):
    result = []
    if not -29 <= metrics['rmsDbfs'] <= -19:
        result.append('RMS outside bank range')
    if metrics['peakDbfs'] > -2:
        result.append('insufficient headroom')
    if metrics['dominantPartialEnergy'] > .94:
        result.append('single pure partial')
    if metrics['edgeStep'] > .002 or metrics['firstMillisecondPeak'] > .07:
        result.append('abrupt attack/endpoint')
    if metrics['onsetSeconds'] > .035:
        result.append('late onset')
    if cue in ('tap', 'release', 'impact-wood', 'impact-glass', 'landing-light', 'undo', 'complete', 'win') and metrics['spectralCentroidHz'] >= 1500:
        result.append('excessive brightness')
    if cue == 'landing-light':
        if not .25 <= metrics['durationSeconds'] <= .35:
            result.append('long or abrupt landing')
        if metrics['spectralCentroidHz'] * 2 ** (4 / 12) >= 1500 or metrics['energyBelow1587Hz'] < .9:
            result.append('bright pitched-up landing')
    if cue == 'release' and not .2 <= metrics['durationSeconds'] <= .3:
        result.append('release duration')
    return result


def self_test():
    tone = [.2 * math.sin(2 * math.pi * 990 * i / RATE) for i in range(RATE // 3)]
    assert 'single pure partial' in failures(measure(tone))
    step = [.3] * (RATE // 3)
    assert 'abrupt attack/endpoint' in failures(measure(step))
    assert not failures(measure(finish(mallet(587.33, .56, 'marimba', 1))))
    assert not failures(measure(finish(mallet(392, .30, 'marimba', 2))), 'landing-light')
    bright = finish(mallet(2349.32, .56, 'vibes', 3))
    assert 'excessive brightness' in failures(measure(bright), 'landing-light')
    assert 'long or abrupt landing' in failures(measure(bright), 'landing-light')
    print('Quality guards reject pure oscillators, stepped attacks and bright/long landings; accept warm modal mallets.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    self_test() if args.self_test else generate()
