#!/usr/bin/env python3
"""Encode, verify and measure the CC0 bank; --update-manifest deliberately locks new assets."""
import argparse
from array import array
import hashlib
import importlib.util
import json
import os
from pathlib import Path
import subprocess
import sys
import wave

ROOT = Path(__file__).resolve().parent.parent
FFMPEG = os.environ.get('FFMPEG', 'ffmpeg')
spec = importlib.util.spec_from_file_location('toy_sounds', ROOT / 'scripts/generate-sounds.py')
synth = importlib.util.module_from_spec(spec)
spec.loader.exec_module(synth)

RECORDING_CREDITS = {
    'wood': ('Kenney', 'https://kenney.nl/assets/impact-sounds'),
    'soft': ('Kenney', 'https://kenney.nl/assets/impact-sounds'),
    'earshot-glass': ('CJspellsfish / Earshot', 'https://freesound.org/people/CJspellsfish/sounds/668383'),
    'earshot-wood': ('Earshot', 'https://github.com/Leonxlnx/earshot/blob/7a7f7c5c70d4a763a1eca4b3666af7c77e313f97/README.md#licence'),
}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def floats(data, code):
    samples = array(code)
    samples.frombytes(data)
    if sys.byteorder != 'little':
        samples.byteswap()
    return [x / 32768 for x in samples] if code == 'h' else list(samples)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--update-manifest', action='store_true')
    args = parser.parse_args()
    manifest = ROOT / 'assets/audio/manifest.json'
    provenance = json.loads((ROOT / 'assets/audio/generated/provenance.json').read_text())
    if args.update_manifest:
        items = []
        for cue, recipe in synth.RECIPES.items():
            recordings = []
            for kind in synth.RECIPE_RECORDINGS[cue]:
                creator, page = RECORDING_CREDITS[kind]
                source = synth.RECORDINGS[kind]
                recordings.append({'source': source, 'sourceSha256': provenance['recordings'][source],
                                   'creator': creator, 'page': page, 'licence': 'CC0-1.0'})
            creators = dict.fromkeys(recording['creator'] for recording in recordings)
            items.append({'cue': cue, 'source': f'generated/{cue}.wav', 'creator': ' / '.join(('Tumbleworks', *creators)),
                          'page': recordings[0]['page'] if recordings else None,
                          'licence': 'CC0-1.0', 'recipe': recipe, 'generator': provenance['generator'],
                          'generatorSha256': provenance['generatorSha256'],
                          'recordings': recordings,
                          'sourceSha256': sha(ROOT / 'assets/audio' / f'generated/{cue}.wav'),
                          'stereo': False, 'bitrate': 160000, 'encodedSha256': '', 'encodedBytes': 0})
    else:
        items = json.loads(manifest.read_text())
    evidence = ROOT / 'output/current/sound'
    evidence.mkdir(parents=True, exist_ok=True)
    report = []
    for item in items:
        source = ROOT / 'assets/audio' / item['source']
        if sha(source) != item['sourceSha256'] or sha(ROOT / item['generator']) != item['generatorSha256']:
            raise SystemExit(f'Source/generator hash mismatch: {source}')
        for recording in item['recordings']:
            if sha(ROOT / 'assets/audio' / recording['source']) != recording['sourceSha256']:
                raise SystemExit(f'Recording hash mismatch: {recording["source"]}')
        output = ROOT / 'src/sounds' / (item['cue'] + '.mp3')
        subprocess.run([FFMPEG, '-hide_banner', '-loglevel', 'error', '-y', '-i', str(source),
                        '-map_metadata', '-1', '-ac', '1', '-ar', '44100', '-c:a', 'libmp3lame',
                        '-b:a', str(item['bitrate']), str(output)], check=True)
        digest = sha(output)
        if not args.update_manifest and (digest != item['encodedSha256'] or output.stat().st_size != item['encodedBytes']):
            raise SystemExit(f'Encode changed: {output}. Check FFmpeg and update the manifest deliberately.')
        item.update(encodedSha256=digest, encodedBytes=output.stat().st_size)
        decoded = floats(subprocess.check_output([FFMPEG, '-v', 'error', '-i', str(output), '-ar', '44100', '-ac', '1', '-f', 'f32le', '-']), 'f')
        with wave.open(str(source), 'rb') as wav:
            original = floats(wav.readframes(wav.getnframes()), 'h')
        metrics = synth.measure(decoded)
        original_metrics = synth.measure(original)
        errors = synth.failures(metrics, item['cue']) + synth.failures(original_metrics, item['cue'])
        if errors:
            raise SystemExit(f'{item["cue"]}: {errors}; decoded {metrics}; source {original_metrics}')
        report.append({'cue': item['cue'], 'bytes': item['encodedBytes'], 'encodedSha256': digest,
                       'decoded': metrics, 'source': original_metrics})
        subprocess.run([FFMPEG, '-v', 'error', '-y', '-i', str(output), '-lavfi',
                        'showspectrumpic=s=900x420:legend=1:scale=log:fscale=log:color=intensity',
                        '-frames:v', '1', str(evidence / f'{item["cue"]}.png')], check=True)
        print(f'{item["cue"]}: {item["encodedBytes"]} bytes; {metrics}')
    rms = [entry['decoded']['rmsDbfs'] for entry in report]
    if max(rms) - min(rms) > 4:
        raise SystemExit(f'Inconsistent bank RMS: {min(rms)} .. {max(rms)} dBFS')
    (evidence / 'measurements.json').write_text(json.dumps(report, indent=2) + '\n')
    locked_report = ROOT / 'assets/audio/measurements.json'
    if args.update_manifest:
        manifest.write_text(json.dumps(items, indent=2) + '\n')
        locked_report.write_text(json.dumps(report, indent=2) + '\n')
    elif json.loads(locked_report.read_text()) != report:
        raise SystemExit('Measurements changed; check the encoder and update the manifest deliberately.')
    print(f'Total: {sum(item["encodedBytes"] for item in items)} bytes; RMS spread {max(rms) - min(rms):.2f} dB')


if __name__ == '__main__':
    main()
