# Tumbleworks sound effects

The player bank combines **Kenney Impact Sounds 1.0** recordings with original offline wooden
modal mallets. All sources and arrangements are **CC0 1.0**. Kenney's creator page is
<https://kenney.nl/assets/impact-sounds>; its original notice remains in
`sources/kenney-impact/License.txt`. The generated material's dedication is in `generated/License.txt`.
The older Interface Sounds originals and notice remain archived in `sources/kenney-interface/`;
none is used in the player bank. No new external download or non-CC0 sample was used.

The owner rejected the previous bank's air swishes and thin high bells after listening on a phone.
This revision removes every air/swish layer and all reversed audio. Release is four rounded wood
contacts over a soft low body; Undo is a descending damped wooden double note. Landing-light moves
from D6 to G4 and shortens from 560 to 300 ms. Rewards have warm bodies with quiet upper accents.
**Nobody has listened to this revision.** Measurements and browser decoding cannot establish taste,
perceived loudness, phone-speaker character or the layered gameplay mix.

`manifest.json` records each cue's WAV/hash, recording inputs/hashes/creator page, generator hash,
recipe, bitrate and encoded hash/size. `generated/provenance.json` pins all three recording inputs
and the generator. Only MP3 files under `src/sounds/` reach the player; WAVs, originals, reports and
notices do not.

## Reproduction and quality checks

Run from the project root, with Python 3 standard library and FFmpeg with libmp3lame:

```sh
export FFMPEG=/home/stone/.local/bin/ffmpeg
python3 scripts/generate-sounds.py --self-test
python3 scripts/generate-sounds.py
python3 scripts/prepare-sounds.py
```

The recorded encoder is FFmpeg 7.0.2 static / libmp3lame 3.100. No NumPy or runtime dependency is
added. Fixed seeds produce 44.1 kHz mono 16-bit PCM. Marimba/kalimba bodies use frequency ratios
1:2:3.93:9.24 and amplitudes 1:0.65:0.55:0.09. The second partial keeps low cues audible between
400 and 900 Hz on phone speakers. Vibraphone accents use 1:2:3.9:5.4 and 1:0.32:0.36:0.10.
Each partial has three resonances at −0.3%, centre and +0.3%, weighted 0.22:0.56:0.22, with slight
seeded pitch/velocity variation. Higher notes decay slightly faster; upper partials decay faster too.

Notes and recorded contacts have 5 ms raised-cosine attacks (glass also has a 6 ms onset).
Six milliseconds of quiet 850 Hz low-passed strike excitation gives the mallets a felt attack.
There is no sustained noise layer or frequency sweep. Marimba passes through 1800/2400 Hz low-pass
stages; the quiet vibraphone accents use 2400 Hz. Recorded contacts have two low-pass stages at
1250–1800 Hz. A shared warm room uses two 1400 Hz low-pass stages before early reflections at
13–139 ms, with more room on rewards. Room tails are baked into each voice, so cancellation remains
immediate and needs no runtime convolution.

Gentle tanh saturation rounds transient crests. DC removal, a 6 ms overall onset and 35 ms ending
taper follow; linear gain targets −22 dBFS RMS with a 0.63 peak ceiling for encoder headroom.
There is no hard limiter. Mono **160 kb/s MP3** retains compatibility with older iPhones; metadata
is removed. The three original Ogg recordings undergo a second lossy encode, while modal sources
are lossless. Runtime decoding remains once per sample.

A normal preparation rejects changed source, generator, recording, encoded hashes, sizes or
measurements. After a deliberate recipe change, regenerate and run
`python3 scripts/prepare-sounds.py --update-manifest`, then review the resulting measurements.
Both PCM and decoded MP3 must have peak below −2 dBFS, RMS in −29…−19 dBFS, bank RMS spread below
4 dB, endpoint step below 0.002, first-ms peak below 0.07, onset before 35 ms and strongest partial
below 94% of energy. Repeated cues, Undo and rewards must have centroid below 1500 Hz. Landing-light
must last 250–350 ms, retain a centroid below 1500 Hz at +4 semitones and keep at least 90% of its
energy below 1587 Hz (2000 Hz after that pitch shift). Release must last 200–300 ms.

Centroid is power weighted over Hann 4096-point FFT windows with 50% overlap. Partial share covers
±2 bins around the strongest bin across those windows. These are technical spectral checks, not
perceptual brightness or loudness measurements. The self-test rejects pure tones, stepped attacks
and a bright long bell, and accepts the warm replacement mallet. Unit tests pin all files by hash,
check actual PCM endpoints/levels, duration/brightness/phone-body measurements, gain separation,
loading/failure silence, decode-once, voice limits and unchanged pitch steps. Preparation also writes
per-cue spectrogram PNGs and a JSON report under `output/current/sound/`; this revision makes no
claim of a visual spectrogram review or listening review.

## Cue recipes and measured player files

Measurements are decoded mono MP3, RMS in dBFS and power-weighted centroid in Hz.

| Cue | Recipe | Seconds | RMS dBFS | Centroid Hz | Bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| tap | Kenney wood at 0.82x, double low-pass 1600 Hz, 5 ms felt onset | 0.14 | -22.45 | 321 | 4,223 |
| release | Four rounded Kenney wood knocks at 0/32/71/118 ms, varied pitch, A3 wooden body; no air | 0.27 | -22.45 | 302 | 6,835 |
| impact-wood | Kenney light wood at 0.94x, double low-pass 1800 Hz, 5 ms onset | 0.14 | -22.45 | 373 | 4,223 |
| impact-glass | Kenney light glass at 0.87x, double low-pass 1800 Hz, 6 ms onset | 0.18 | -22.44 | 1206 | 4,746 |
| landing-light | G4 (392 Hz) felt marimba/kalimba, detuned modes, 0.30 s, low-pass 1800 Hz | 0.30 | -22.45 | 466 | 7,358 |
| landing-final | D4 (293.66 Hz) felt marimba with audible 587 Hz body partial, 0.40 s | 0.40 | -22.45 | 363 | 9,448 |
| complete | D4 A4 D5 warm marimba triplet at 0/85/170 ms, quiet D6 vibraphone accent | 0.65 | -22.45 | 562 | 14,150 |
| blocked | Kenney soft/wood at 0.78x/0.72x with D4/587 Hz muted body, low-pass 1250 Hz | 0.22 | -22.45 | 347 | 5,791 |
| undo | D4 C4 damped wooden double note at 0/95 ms; no reverse or air | 0.32 | -22.45 | 362 | 7,880 |
| jam | Muted marimba A4 D4 descent at 0/160 ms, warm room | 0.64 | -22.45 | 428 | 14,150 |
| win | D4 F#4 A4 D5 marimba ascent at 0/120/240/360 ms; warm D-major vibraphone chord at 520 ms, quiet D6 accent | 1.28 | -22.45 | 490 | 26,688 |

The bank totals **105,492 bytes**, **16,716 fewer** than the rejected 122,208-byte bank, within the
unchanged **150,000-byte** sound ceiling. All compressed bytes count toward the unchanged
**2,125,000-byte** first-download ceiling, even when fetched after a gesture. The current build is
**1.973 MB / 2.125 MB**. No gzip saving is assumed for MP3. Vite `?no-inline` imports keep samples
individually cacheable by content hash; Apache's immutable MP3 cache rule is unchanged.

Decoded RMS spread is **0.01 dB**. Source endpoints are zero; the largest decoded endpoint step is
**0.000125**, largest first-ms peak **0.00558** and latest onset **1.5 ms**.
Landing-light keeps **99.99%** of measured energy below 1587 Hz; at the existing +4-semitone ceiling
its centroid is approximately **587 Hz**, with that energy still below 2 kHz.
`measurements.json` retains both source and decoded values, peaks and spectral energy fractions.

## Runtime mix and unchanged behavior

Mix values live in `src/audio.ts`. Master gain remains 0.8. Tap gain is 0.36, release 0.38,
Loop delivery 0.26, first/second landings 0.27/0.31, and impacts 0.05–0.15 before variation.
Undo drops to 0.48. Final body/reward remain 0.8/0.4, box completion 0.7, blocked 0.5,
jam 0.65 and win 0.95. Repeated cues are at least **4.8 dB** below standalone box completion,
even at the loudest random variation. Equal file RMS leaves this hierarchy to the runtime mix.
The shared compressor stays at −8 dB threshold, 12 dB knee, 2:1 ratio, 12 ms attack and 180 ms release.
Its perceived behavior needs listening.

Impacts remain throttled to one per 65 ms with at most four active voices before more impacts are
suppressed; every fourth uses glass. Impact pitch varies ±4%, gain ±10%; tap/release pitch ±2%,
gain ±6%. Ordinary cues leave four of twelve voices for rewards. Win/jam cancel old tails.
All public methods and start-time semantics remain unchanged. Existing delivery, landing and chain
pitch steps remain exactly as before. No new rising-per-marble or streak pitch progression was added.
Fast-forward suppression remains in App's existing call sites.

The first gesture starts asynchronous fetch/decode once per sample. Playback never waits;
loading/failure is silent with no oscillator fallback or queued stale actions. Failed samples do
not retry per tick. Mute delays loading and cancels voices. Undo, Restart, level changes, blur and
hidden tabs retain their cancellation paths.

## Verification record — 14 November 2026, warm revision

- Before replacement, the new warmth regression failed on the old release: 4887 Hz source centroid.
- `docker compose exec -T dev npm run typecheck`: passed.
- `docker compose exec -T dev npm run lint`: passed, zero warnings/errors.
- `docker compose exec -T dev npx vitest run tests/engine/audio.test.ts tests/engine/audio-assets.test.ts tests/engine/bundle-budget.test.ts`:
  **20 tests passed**, including the new warmth/duration and mix-gain regressions.
- `docker compose exec -T dev npm run build`: passed; audio **105,492/150,000 bytes**,
  first download **1.973/2.125 MB**. Existing Vite configuration and chunk-size advisories remain.
- `docker compose --profile e2e run --rm e2e npx playwright test tests/e2e/audio.spec.ts --project=game --output=output/current/sound/playwright`:
  **three passed** on the final bank (29.6 s), including real touch-driven actions, Chromium MP3
  decoding, failed downloads, cancellation and fast-forward suppression. The shared-output rerun
  previously failed during `browserContext.close` because a Playwright trace file was missing
  (`ENOENT`); the dedicated output directory avoids shared-artifact interference.
- Generator self-test: passed. Regeneration followed by preparation without `--update-manifest`
  reproduced all locked hashes, sizes and measurements, including the final A3 release body.
- `git diff --check` for the audio files and sound paragraph: passed.

No listening, physical-phone speaker check, perceived-loudness assessment or Safari decoding run
has been performed on this revision. Browser checks do not establish physical-phone performance.
