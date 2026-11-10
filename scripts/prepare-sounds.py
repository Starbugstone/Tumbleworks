#!/usr/bin/env python3
"""Rebuild the small CC0 player sound bank from its tracked source samples."""
import hashlib
import json
import os
from pathlib import Path
import subprocess

ROOT = Path(__file__).resolve().parent.parent
for item in json.loads((ROOT / 'assets/audio/manifest.json').read_text()):
    source = ROOT / 'assets/audio' / item['source']
    if hashlib.sha256(source.read_bytes()).hexdigest() != item['sourceSha256']:
        raise SystemExit(f'Source hash mismatch: {source}')
    output = ROOT / 'src/sounds' / (item['cue'] + '.mp3')
    filters = ('pan=mono|c0=0.5*c0+0.5*c1,' if item['stereo'] else '') + 'volume=-5dB'
    subprocess.run([os.environ.get('FFMPEG', 'ffmpeg'), '-hide_banner', '-loglevel', 'error', '-y',
                    '-i', str(source), '-map_metadata', '-1', '-ac', '1', '-ar', '44100',
                    '-af', filters, '-c:a', 'libmp3lame', '-b:a', '96k', str(output)], check=True)
    digest = hashlib.sha256(output.read_bytes()).hexdigest()
    if digest != item['encodedSha256']:
        raise SystemExit(f'Encode changed: {output}. Check the FFmpeg version, audition it and update the manifest deliberately.')
    print(f"{item['cue']}: {output.stat().st_size} bytes")
