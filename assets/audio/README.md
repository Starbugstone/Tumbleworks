# Tumbleworks sound effects

The game uses eleven samples by **Kenney**, from [Interface Sounds 1.0](https://kenney.nl/assets/interface-sounds)
and [Impact Sounds 1.0](https://kenney.nl/assets/impact-sounds), both dedicated to the public domain under
[CC0 1.0](https://creativecommons.org/publicdomain/zero/1.0/). The original pack notices are retained beside
the selected source files in `sources/`. No Dustyroom sample or background music is shipped.

`manifest.json` records each creator page, original filename/hash and encoded filename/hash/size.
Only the selected originals (86,148 bytes) are tracked here, not the downloaded packs. Original files are
Ogg Vorbis; the runtime copies are mono MP3 for phone-browser decoding, including iPhones before Ogg
support in Safari 18.4. Original and compressed source quality are distinct: MP3 is a second lossy encode.

## Encoding and bandwidth

Rebuild with `python3 scripts/prepare-sounds.py` from the project root. It needs FFmpeg with libmp3lame
(`FFMPEG=/path/to/ffmpeg` overrides the executable); it adds no runtime dependency. The recorded encoder
is FFmpeg 7.0.2 static, libmp3lame 3.100. The script checks input and output hashes so a toolchain change
cannot silently replace the sounds.

Processing: explicit L/R average for stereo sources, mono at 44.1 kHz, −5 dB headroom, 96 kb/s MP3,
descriptive metadata removed. Short intentional tails remain; no artificial silence or reverb is added.
The eleven player files total **37,470 bytes**. The build checks a **45,000-byte sound ceiling** and also
counts all those bytes toward the unchanged **2,000,000-byte** first-download budget, even though sound
is requested only after a gesture. No gzip savings are assumed for MP3. Vite's `?no-inline` imports keep
each file independently cacheable with a content hash; originals and licence text are not player downloads.
The Apache rule gives hashed MP3 files the same one-year immutable cache as scripts and fonts. The
existing hosting test checks that header on every built asset, including all eleven sounds.

## Cue mapping and mix

| Cue | Source | Use |
| --- | --- | --- |
| tap | Interface/select_008.ogg | Selection |
| release | Interface/drop_002.ogg | Accepted pour/transfer |
| impact-wood | Impact/impactWood_light_000.ogg | Quiet collision body |
| impact-glass | Impact/impactGlass_light_000.ogg | Occasional collision variation |
| landing-light | Interface/glass_002.ogg | First two Funnel contacts, ordinary intake |
| landing-final | Interface/bong_001.ogg | Body on the third Funnel contact |
| complete | Interface/confirmation_003.ogg | Box/truck/tube reward; softer layer on Funnel's final contact |
| blocked | Impact/impactSoft_medium_000.ogg | Refused action |
| undo | Interface/maximize_003.ogg | Undo |
| jam | Interface/minimize_003.ogg | One brief failed-board cue |
| win | Interface/confirmation_004.ogg | Won-board reward |

Mix values live in `src/audio.ts`. Small impacts run at most once per 65 ms, at low gain, with four voices
at most before further impacts are suppressed. Ordinary cues leave four slots in the twelve-voice budget
for rewards. Win/jam cancel old tails before playing. Funnel's first two contacts ascend by two semitones;
its third keeps the weight and reward on actual capture. App suppresses small impacts and Loop intake
while fast forward is held, retaining truck completions and the final Funnel contact.
These choices target a playful toy sound; measured levels and decoding cannot establish subjective fun.

The first gesture starts one asynchronous fetch/decode per sample. Playback never waits for a download,
and readiness never replays an old cue. A short quiet synthesized cue covers loading or a failed sample.
Failures are contained; a failed request is not retried per tick. Reloading the page retries the bank.
Mute prevents loading until enabled and cancels active tails. Undo, Restart, level change, blur and hiding
the page cancel tails. Browser decoding tests and the fake-audio tests cover these interleavings.
