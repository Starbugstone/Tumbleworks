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
    'soft': 'sources/kenney-impact/impactSoft_medium_000.ogg',
    'earshot-glass': 'sources/earshot/glass-tap.wav',
    'earshot-wood': 'sources/earshot/wood-knock.wav',
}
RECIPES = {
    'tap': 'Walnut button: slowed real wood, felt B3 body, 5 ms onset, dry bench',
    'release': 'Arcade crate release: dry latch and a tightening cluster of marble contacts over Earshot wood',
    'impact-wood': 'Real maple contact at 0.91x with damped D4 bench resonance',
    'impact-glass': 'Arcade tube strike: Earshot glass tap over a short, hollow enamel snap',
    'landing-light': 'Arcade marble seat: hard contact over a low damped cup, with Earshot glass and wood',
    'landing-final': 'Full dock settles: D4 wood mass, A4 enamel rim and two quiet real wood contacts',
    'complete': 'Arcade dock payoff: hard seat and an answering D4/A4 felt chord with an Earshot glass accent',
    'truck-complete': 'Arcade truck payoff: low chassis thump and dry latch, followed by a warm A3/E4 flourish',
    'blocked': 'Rubber stop: real soft contact with muted B3 wood, no pitch warning',
    'undo': 'Wooden detent return: E4-D4 soft double contact at 0/75 ms, no reverse',
    'jam': 'Stopped mechanism: B3/A3 damped bodies at 0/135 ms with a dry wood stop',
    'win': 'Workshop win: four rising felt strikes and a full D-major chord with a long resonant body',
    'harbour-bell': 'Little Harbour ship bell: F4 brass modes 1/1.49/2.01/2.74/4.05, felt striker and wooden mount, 720 ms',
}
DURATIONS = dict(zip(RECIPES, (.12, .239, .12, .156, .282, .36, .68, .77, .18, .29, .48, 1.38, .72)))
RECIPE_RECORDINGS = {
    'tap': ('wood',), 'release': ('earshot-wood',), 'impact-wood': ('wood',),
    'impact-glass': ('earshot-glass',), 'landing-light': ('earshot-glass', 'earshot-wood'), 'landing-final': ('wood',),
    'complete': ('earshot-glass',), 'truck-complete': ('earshot-glass', 'earshot-wood'), 'blocked': ('soft',),
    'undo': ('wood',), 'jam': ('wood',), 'win': ('wood',), 'harbour-bell': ('soft', 'wood'),
}
# Surface modes share a bench-sized room; none uses a high bare bell or swept noise.
SURFACES = {
    'wood': ((1, 2.01, 3.87, 6.2), (1, .72, .35, .05), .047, 1450),
    'felt': ((1, 2, 3.93, 7.1), (1, .72, .40, .035), .083, 1700),
    'enamel': ((1, 2.32, 4.12, 6.29), (1, .58, .16, .025), .075, 1600),
    'brass': ((1, 1.49, 2.01, 2.74, 4.05), (1, .50, .34, .14, .045), .205, 1800),
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


def body(hz, duration, surface, seed, velocity=1):
    rng = random.Random(seed)
    ratios, amplitudes, decay, cutoff = SURFACES[surface]
    decay *= (349.23 / hz) ** .2
    result = [0.0] * round(duration * RATE)
    velocity *= rng.uniform(.97, 1.03)
    for mode, (ratio, amplitude) in enumerate(zip(ratios, amplitudes)):
        frequency = hz * ratio * rng.uniform(.999, 1.001)
        if frequency > RATE * .45:
            continue
        tau = decay / (1 + .32 * mode)
        for detune, weight in ((-.0025, .22), (0, .56), (.0025, .22)):
            for i in range(len(result)):
                t = i / RATE
                attack = .5 - .5 * math.cos(math.pi * min(1, t / .005))
                result[i] += velocity * amplitude * weight * attack * math.exp(-t / tau) * math.sin(2 * math.pi * frequency * (1 + detune) * t)
    add(result, felt_strike(seed + 2000), gain=.025 * velocity)
    return lowpass(lowpass(result, cutoff), 2100)


def room(dry, amount):
    # One shared small-room recipe, baked so cancel() stops reflections with their voice.
    result = dry.copy()
    damped = lowpass(lowpass(dry, 1100), 1100)
    for delay, gain in ((.011, .24), (.021, -.17), (.034, .13), (.049, .075), (.071, -.04)):
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


def fade(samples, attack, release):
    n = len(samples)
    for i in range(n):
        amount = min(1.0, i / (attack * RATE), (n - 1 - i) / (release * RATE))
        samples[i] *= 0.5 - 0.5 * math.cos(math.pi * amount)
    return samples


def load_earshot(kind):
    pcm = subprocess.check_output([
        FFMPEG, '-v', 'error', '-nostdin', '-i', str(ROOT / 'assets/audio' / RECORDINGS[kind]), '-ac', '1',
        '-ar', str(RATE), '-f', 'f32le', '-',
    ])
    samples = array('f', pcm)
    if sys.byteorder != 'little':
        samples.byteswap()
    return list(samples)


def arcade_contact(kind, length, cutoff, speed):
    source = lowpass(load_earshot(kind), cutoff)
    threshold = 0.05 * max(map(abs, source))
    first = max(0, next(i for i, x in enumerate(source) if abs(x) > threshold) - round(0.001 * RATE))
    values = []
    for i in range(round(length * RATE)):
        at = first + i * speed
        j = int(at)
        values.append(source[j] + (source[j + 1] - source[j]) * (at - j) if j + 1 < len(source) else 0)
    peak = max(map(abs, values))
    return fade([x / peak for x in values], 0.002, 0.014)


def knock(seconds, modes, seed, crack):
    rng = random.Random(seed)
    noise = lowpass([rng.uniform(-1, 1) for _ in range(round(0.014 * RATE))], 2600)
    noise = fade(noise, 0.001, 0.009)
    y = []
    for i in range(round(seconds * RATE)):
        t = i / RATE
        sample = sum(gain * math.sin(2 * math.pi * hz * t) * math.exp(-t / decay)
                     for hz, gain, decay in modes)
        if i < len(noise):
            sample += crack * noise[i]
        y.append(sample)
    return fade(y, 0.0028, 0.020)


def mix(seconds, layers):
    result = [0.0] * round(seconds * RATE)
    for start, gain, layer in layers:
        offset = round(start * RATE)
        for i, value in enumerate(layer[:len(result) - offset]):
            result[i + offset] += gain * value
    return result


def finish_arcade(samples, cutoff, attack_boost, attack):
    samples = lowpass(samples, cutoff)
    for i, value in enumerate(samples):
        falloff = min(1.0, max(0.0, (i / RATE - 0.016) / 0.022))
        samples[i] = value * (1 + attack_boost * (1 - falloff))
    peak = max(map(abs, samples))
    for drive in (0.63, 0.85, 1.15, 1.45, 1.8, 2.2, 2.6):
        shaped = [math.tanh(drive * sample / peak) for sample in samples]
        mean = sum(shaped) / len(shaped)
        shaped = fade([sample - mean for sample in shaped], attack, 0.024)
        rms = math.sqrt(sum(x * x for x in shaped) / len(shaped))
        gain = 10 ** (-22 / 20) / rms
        if gain * max(map(abs, shaped)) <= 0.63:
            return [x * gain for x in shaped]
    raise ValueError('Could not match the current cue level with peak headroom')


def arcade_cues():
    glass = arcade_contact('earshot-glass', 0.070, 3650, 1.06)
    wood = arcade_contact('earshot-wood', 0.092, 2600, 1.14)
    glass_snap = knock(0.16, [(565, .53, .026), (974, .62, .019), (1560, .36, .010),
                            (2250, .18, .004)], 71, .48)
    marble = knock(0.102, [(493, .65, .020), (826, .57, .014), (1280, .39, .008),
                          (2200, .20, .004)], 72, .43)
    seat = knock(0.244, [(328, .56, .061), (655, .66, .046), (926, .43, .031),
                        (1448, .30, .011)], 73, .41)
    axle = knock(0.265, [(151, .48, .056), (302, .61, .052), (594, .54, .044),
                        (859, .33, .028), (1418, .27, .009)], 74, .53)
    latch = knock(0.12, [(414, .64, .023), (756, .54, .017), (1320, .31, .013),
                         (1810, .28, .007)], 75, .48)
    dock_chord = knock(.48, [(293.66, .54, .14), (440, .72, .119), (587.33, .32, .11),
                             (880, .20, .073), (1174.7, .11, .033)], 76, .035)
    truck_chord = knock(.52, [(220, .53, .145), (329.63, .66, .13), (440, .35, .111),
                              (659.25, .26, .085), (986, .09, .043)], 77, .036)

    cues = {
        'impact-glass': (1900, [(0, 1.0, glass_snap), (0.002, .49, glass), (.019, .10, marble)]),
        'release': (1780, [(0, .71, latch), (0, .34, wood), (.028, .84, marble),
                                 (.060, .57, glass_snap), (.083, .42, marble), (.103, .29, wood),
                                 (.103, .32, marble), (.125, .18, glass_snap)]),
        'landing-light': (1640, [(0, 1.0, seat), (0, .66, marble),
                                       (.004, .32, glass), (.028, .24, wood)]),
        'truck-complete': (1800, [(0, 1.0, axle), (0, .68, wood), (0, .44, marble),
                                        (.055, .58, latch), (.061, .25, glass), (.089, .31, axle),
                                  (.13, .64, truck_chord), (.235, .31, truck_chord)]),
        'complete': (1860, [(0, .92, axle), (0, .71, marble), (.011, .28, glass),
                                  (.049, .50, latch), (.079, .76, dock_chord), (.194, .34, dock_chord)]),
    }
    boosts = {'release': 1.3, 'truck-complete': 0.68, 'complete': 0.85}
    return {cue: finish_arcade(mix(DURATIONS[cue], layers), cutoff, boosts.get(cue, 0.0),
                               0.0068 if cue in ('complete', 'truck-complete') else 0.0042)
            for cue, (cutoff, layers) in cues.items()}


def generate():
    bank = {cue: [0.0] * round(seconds * RATE) for cue, seconds in DURATIONS.items()}
    add(bank['tap'], recording('wood', .12, .73, 1450), gain=.75)
    add(bank['tap'], body(246.94, .12, 'wood', 101), gain=.17)
    add(bank['impact-wood'], recording('wood', .12, .91, 1650), gain=.75)
    add(bank['impact-wood'], body(293.66, .12, 'wood', 102), gain=.12)
    add(bank['landing-final'], body(293.66, .36, 'felt', 112), gain=.8)
    add(bank['landing-final'], body(440, .25, 'enamel', 113), .018, .24)
    for at, gain in ((0, .4), (.036, .14)):
        add(bank['landing-final'], recording('wood', .12, .76, 1350), at, gain)
    add(bank['blocked'], recording('soft', .18, .70, 1000), gain=.7)
    add(bank['blocked'], body(246.94, .18, 'wood', 140), gain=.30)
    for i, hz in enumerate((329.63, 293.66)):
        add(bank['undo'], body(hz, .21, 'wood', 150 + i), .075 * i, .6 - .1 * i)
        add(bank['undo'], recording('wood', .10, .85 - .07 * i, 1200), .075 * i, .22)
    for i, hz in enumerate((246.94, 220)):
        add(bank['jam'], body(hz, .32, 'felt', 160 + i), .135 * i, .7 - .12 * i)
    add(bank['jam'], recording('wood', .14, .68, 1000), gain=.4)
    for i, hz in enumerate((293.66, 369.99, 440, 587.33)):
        add(bank['win'], body(hz, .40, 'felt', 170 + i), .084 * i, .62 + .04 * i)
        add(bank['win'], recording('wood', .10, .8 + i * .06, 1300), .084 * i, .09)
    win_chord = knock(.97, [(293.66, .55, .23), (369.99, .48, .20), (440, .67, .21),
                           (587.33, .33, .19), (739.99, .20, .13), (1174.66, .11, .09)], 178, .026)
    add(bank['win'], win_chord, .33, .60)
    add(bank['win'], body(293.66, .45, 'enamel', 190), .33, .14)
    add(bank['harbour-bell'], body(349.23, .72, 'brass', 200), gain=.75)
    add(bank['harbour-bell'], recording('soft', .10, .8, 1100), gain=.12)
    add(bank['harbour-bell'], recording('wood', .12, .72, 1300), gain=.055)
    GENERATED.mkdir(parents=True, exist_ok=True)
    dependencies = {name: hashlib.sha256((ROOT / 'assets/audio' / path).read_bytes()).hexdigest()
                    for name, path in RECORDINGS.items()}
    arcade = arcade_cues()
    for cue, samples in bank.items():
        rendered = arcade[cue] if cue in arcade else finish(room(samples, .4 if cue in ('win', 'harbour-bell') else .14))
        write_wave(GENERATED / f'{cue}.wav', rendered)
    provenance = {'suite': 'compact-workshop-arcade-v3', 'generator': 'scripts/generate-sounds.py',
                  'generatorSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),
                  'recordings': {RECORDINGS[name]: digest for name, digest in dependencies.items()},
                  'earshot': {
                      'repository': 'https://github.com/Leonxlnx/earshot',
                      'commit': '7a7f7c5c70d4a763a1eca4b3666af7c77e313f97',
                      'inputs': {'earshot-glass': {'sound': 'glass/tap', 'seed': 42, 'mono': True},
                                 'earshot-wood': {'sound': 'knock/wood', 'seed': 42, 'mono': False}},
                  },
                  'recipes': RECIPES, 'durations': DURATIONS, 'surfaces': SURFACES, 'sampleRate': RATE, 'seedPolicy': 'fixed explicit seed per felt strike and modal note'}
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
    if cue in ('tap', 'release', 'impact-wood', 'impact-glass', 'landing-light', 'undo', 'complete', 'truck-complete', 'win', 'harbour-bell') and metrics['spectralCentroidHz'] >= 1500:
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
    assert not failures(measure(finish(body(349.23, .4, 'felt', 1))))
    assert not failures(measure(finish(body(440, .28, 'enamel', 2))), 'landing-light')
    bright = finish(body(2349.32, .56, 'brass', 3))
    assert 'excessive brightness' in failures(measure(bright), 'landing-light')
    assert 'long or abrupt landing' in failures(measure(bright), 'landing-light')
    print('Quality guards reject pure oscillators, stepped attacks and bright/long landings; accept warm modal mallets.')


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--self-test', action='store_true')
    args = parser.parse_args()
    self_test() if args.self_test else generate()
