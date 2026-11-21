# Compact Workshop demo sound suite

This bank belongs to the dedicated `demo/compact-workshop` checkout. Five arcade cues use short,
close strikes over wooden and enamel bodies. Muted controls and the warmer win cue give the
harder arrivals room to stand out. The Little Harbour bell has its own one-shot cue.

The owner wanted harder impacts after auditioning the warm workshop bank. The arcade layer puts
more of the hit near contact at the existing cue level. The puzzle cues avoid air swishes,
reversed audio and piercing bell tones. The player still hears the established pitch steps.

## Files and provenance

- `src/sounds/*.mp3`: thirteen mono 160 kb/s MP3 player files, imported with Vite `?no-inline`.
- `assets/audio/generated/*.wav`: deterministic 44.1 kHz mono 16-bit PCM masters.
- `assets/audio/generated/provenance.json`: suite ID `compact-workshop-arcade-v3`, fixed-seed policy,
  generator hash, recording hashes, durations, recipes and surface-mode definitions.
- `assets/audio/manifest.json`: exact recording inputs per cue, creators, CC0 notices, source and
  generator hashes, bitrate, and encoded hashes/bytes.
- `assets/audio/measurements.json`: source and actual FFmpeg-decoded MP3 measurements, pinned
  to each encoded hash.
- `output/current/sound/`: generated spectrograms, measurements and focused browser artifacts.

The contact recordings are **Kenney Impact Sounds 1.0**, CC0 1.0:
<https://kenney.nl/assets/impact-sounds>. The original notice remains in
`sources/kenney-impact/License.txt`. This suite uses the tracked light wood and medium soft
recordings. The two Earshot renders are stored in `sources/earshot/` alongside the Kenney sources.
They were rendered from commit `7a7f7c5c70d4a763a1eca4b3666af7c77e313f97` with seed 42.

- `glass-tap.wav` uses Earshot `glass/tap` in mono. Its source is CJspellsfish’s CC0
  [Glass Tap 2](https://freesound.org/people/CJspellsfish/sounds/668383).
- `wood-knock.wav` uses Earshot’s procedural `knock/wood` design. Earshot’s
  [output terms](https://github.com/Leonxlnx/earshot/blob/7a7f7c5c70d4a763a1eca4b3666af7c77e313f97/README.md#licence)
  allow rendered audio to be reused. Original synthesis and arrangements are dedicated to CC0 in
  `generated/License.txt`.

The manifest pins both render hashes. Rebuilding the player cues uses the tracked WAVs and does
not require Earshot, CLAP or a download.

## Reproduce

Python standard library and FFmpeg 7.0.2 static / libmp3lame 3.100:

```sh
export FFMPEG=/home/stone/.local/bin/ffmpeg
python3 scripts/generate-sounds.py --self-test
python3 scripts/generate-sounds.py
python3 scripts/prepare-sounds.py
```

After an intentional recipe change, use `prepare-sounds.py --update-manifest`, review measurements,
then regenerate and prepare normally to prove the locked bytes reproduce. A normal preparation
rejects source, recording, generator, encoded hash/size or measurement drift. Source recordings stay
lossy Ogg; modal masters are lossless WAV. No metadata reaches the encoded MP3 files.

## Sound construction

The arcade release starts with a dry latch and closes the spacing between marble contacts.
The glass strike uses a short hollow snap, while seating leads with a hard contact and
decays into the cup body. Truck completion adds a low chassis hit, a latch and an answering A3/E4 flourish. Dock completion
pairs a hard seat with a D4/A4 felt chord. A full win rises through four felt strikes to a longer
D-major resolution.

Surface resonances use three slightly detuned modes (−0.25%, centre, +0.25%, weights 0.22/0.56/0.22)
per partial, plus small seeded pitch/velocity variation. High notes and upper partials decay faster.
The surface recipes are:

| Surface | Frequency ratios | Relative amplitudes | Base decay | Low-pass |
| --- | --- | --- | --- | --- |
| Wood | 1 / 2.01 / 3.87 / 6.2 | 1 / .72 / .35 / .05 | 47 ms | 1450 Hz |
| Felt | 1 / 2 / 3.93 / 7.1 | 1 / .72 / .40 / .035 | 83 ms | 1700 Hz |
| Enamel | 1 / 2.32 / 4.12 / 6.29 | 1 / .58 / .16 / .025 | 75 ms | 1600 Hz |
| Harbour brass | 1 / 1.49 / 2.01 / 2.74 / 4.05 | 1 / .50 / .34 / .14 / .045 | 205 ms | 1800 Hz |

Modal notes have 5 ms cosine attacks and a very quiet 6 ms, 850 Hz low-passed felt excitation.
Recorded contacts have 5 ms attacks and two low-pass stages. The 220–330 Hz bodies carry a clear
second partial around 440–660 Hz, helping phone audibility. Every body has a second 2400 Hz low-pass.
The warm cues use a small bench room with double 1100 Hz damping and early reflections at 11–71 ms.
The arcade cues use dry, close contacts. The contact fade takes 4.2 ms and the two longer
completion cues use 6.8 ms to control MP3 pre-echo at the frame boundary. Both finishes use tanh saturation and DC removal, with a −22 dBFS source RMS target
and a 0.63 source peak ceiling. The arcade tails taper over 24 ms.

## Recipes and measured player files

Values below are actual FFmpeg-decoded MP3 duration, RMS dBFS and power-weighted centroid Hz.

| Cue | Recipe | Seconds | RMS dBFS | Centroid Hz | Bytes |
| --- | --- | ---: | ---: | ---: | ---: |
| tap | Walnut button: slowed real wood, felt B3 body, 5 ms onset, dry bench | 0.120 | -22.45 | 299 | 3,701 |
| release | Arcade crate release: dry latch and a tightening cluster of marble contacts over Earshot wood | 0.239 | -22.45 | 663 | 6,313 |
| impact-wood | Real maple contact at 0.91x with damped D4 bench resonance | 0.120 | -22.45 | 349 | 3,701 |
| impact-glass | Arcade tube strike: Earshot glass tap over a short, hollow enamel snap | 0.156 | -22.45 | 985 | 4,223 |
| landing-light | Arcade marble seat: hard contact over a low damped cup, with Earshot glass and wood | 0.282 | -22.45 | 525 | 6,835 |
| landing-final | Full dock settles: D4 wood mass, A4 enamel rim and two quiet real wood contacts | 0.360 | -22.45 | 380 | 8,403 |
| complete | Arcade dock payoff: hard seat and an answering D4/A4 felt chord with an Earshot glass accent | 0.680 | -22.45 | 401 | 15,195 |
| truck-complete | Arcade truck payoff: low chassis thump and dry latch, followed by a warm A3/E4 flourish | 0.770 | -22.44 | 341 | 16,762 |
| blocked | Rubber stop: real soft contact with muted B3 wood, no pitch warning | 0.180 | -22.45 | 206 | 4,746 |
| undo | Wooden detent return: E4-D4 soft double contact at 0/75 ms, no reverse | 0.290 | -22.45 | 389 | 7,358 |
| jam | Stopped mechanism: B3/A3 damped bodies at 0/135 ms with a dry wood stop | 0.480 | -22.45 | 315 | 11,015 |
| win | Workshop win: four rising felt strikes and a full D-major chord with a long resonant body | 1.380 | -22.45 | 480 | 28,778 |
| harbour-bell | Little Harbour ship bell: F4 brass modes 1/1.49/2.01/2.74/4.05, felt striker and wooden mount, 720 ms | 0.720 | -22.45 | 375 | 15,717 |

Total player audio is **132,747 / 150,000 bytes**. The
procedural harbour ambience adds no audio downloads. At the existing +4-semitone pitch ceiling,
landing-light retains **99.22%** of its source-band energy below 2 kHz.
Encoded cues remain part of the first-download budget even when fetched after a gesture.

Metrics integrate Hann-windowed 4096-point FFT power with 50% overlap. The dominant-partial guard
covers ±2 bins around the strongest bin. Centroid and energy fractions are technical measurements,
not perceptual brightness or loudness. Preparation verifies both source and decoded signals:
−29…−19 dBFS RMS, peak below −2 dBFS, strongest partial below 94%, first-ms peak below .07,
endpoint step below .002 and onset before 35 ms. Additional warmth, 250–350 ms seat and 200–300 ms
tumble checks run in preparation and the pinned asset tests. The self-test rejects pure tones,
stepped attacks and a bright long bell, while accepting the damped replacement body.

## Runtime mapping and integration handoff

Existing gameplay event integration requires no non-audio source change:

- `tap()` → walnut control; `release()` → packet tumble.
- `impact()` → alternating quiet wood/enamel contacts with existing 65 ms throttle and voice floor.
- `deliver()` and first/second `landing()` → arcade seat, with the existing pitch steps.
- Third `landing()` → heavy full-dock body plus dry dock latch (`landing-final` + `complete`).
- `boxFilled()` → separate heavier chassis/latch (`truck-complete`). This existing shared match method
  serves Loop Sort completion and Tube Sort completion. Its existing chain pitch formula is unchanged.
- `blocked()`, `undo()`, `jam()` and `win()` keep their existing callers and start-time behavior.
- **New `sfx.harbourBell(): void`** plays the 720 ms soft-struck ship bell at gain 0.52, rate 1,
  with reward voice priority. The owner owns the actual strike hook in `src/view/world.ts`; this audio
  task leaves that file untouched. Call once when forward playback crosses the actual strike cue,
  not continuously while the bell is in contact, and skip catch-up/seek/reverse playback. The method
  follows shared mute/loading/cancellation behavior and never queues a stale strike. Use the existing
  gesture unlock and cancellation paths around film playback/navigation.

Master gain remains 0.8. Runtime gains: tap .32, tumble .38, impacts .04–.14 before variation,
Loop seat .24, first/second dock seats .25/.29, final body .8 plus latch .4, truck/match .7,
blocked .4, undo .42, jam .65, win .95, Harbour .52. Repeated cues remain at least 4.8 dB below a
standalone completion even at the loudest random variation. Small contacts retain existing gain and
pitch variation; the compressor stays at −8 dB threshold, 12 dB knee, 2:1, 12 ms attack, 180 ms release.

Each file fetches/decodes once after unlock. Loading/failure is silent; input never waits, failures
never retry each tick, and no stale action plays after load. Ordinary cues leave four of twelve
voices for rewards. Mute, Undo, Restart, navigation, blur and hidden tabs cancel voices, including
the Harbour bell. The App's existing held-fast-forward suppression still skips per-marble contacts
and retains completion rewards. Ambience uses generated buffers and timers outside the frame loop.

## Little Harbour integration handoff

`src/audio.ts` exports `sfx.harbourBell(): void`. It plays the dedicated 720 ms F4 ship-bell cue
at gain 0.52, normal pitch, using a reserved reward voice. It does not interrupt existing voices.
The village owner owns `src/view/world.ts`: call it once at the actual strike during forward film
playback, never from each pose/render frame or on a seek past the cue. Use the shared `sfx.cancel()`
when leaving or restarting playback so the tail cannot leak into another scene.

Audio still needs `sfx.unlock()` from a gesture on the current page. A cold automatic film with no
such gesture stays silent; this method does not bypass autoplay policy or replay a strike after
loading completes. The browser tests invoke the bell after real touch-driven unlock and verify
that it decodes and cancels through the shared audio system. Village event synchronization itself
belongs to the trigger owner and is not claimed as verified by these audio tests.

### Ambience hook

`sfx.harbourAmbience(active: boolean): void` takes the desired Little Harbour state. Call
`true` on entry and `false` on exit or teardown from a single view owner. Calls are idempotent
and can precede unlock. The existing `sfx.unlock()` gesture enables a quiet surf loop and sparse
gull calls. Exiting fades the two out. Muting or hiding the tab stops the loop, call and timers
immediately. Showing the tab or unmuting restores them with a fade if Harbour is still active.
`sfx.cancel()` clears gameplay one-shots, including the bell. It leaves the requested ambience
state to the view owner.

The 12-second surf and the gull call are synthesized once into compact mono Web Audio buffers.
The surf uses band-limited seeded noise and slow wave envelopes. The gull uses two short
pitch-shaped calls. One surf node and at most one gull node share a quiet gain bus into the
existing master. No ambience assets enter the MP3 manifest or first-download transfer.

### Board ambience hook

`sfx.boardAmbience(active: boolean, chapter = 0): void` takes a zero-based chapter. Chapter zero
has a quieter coastal bed with occasional gulls. The inland bed uses a softer, steadier texture.
Call on board entry, chapter changes and exit. Board ambience takes precedence over village
ambience, sharing its decode-free buffers, gesture unlock, mute and visibility behavior. Changes
fade the outgoing theme before starting the incoming one, so the beds do not stack.

`sfx.boardFastForward(active: boolean): void` follows effective game speed above 1×. It ducks the
board bed to 35% and clears pending gull calls. Leaving the board clears the ducking state.

### Film contacts and last load

Call `sfx.harbourRouteCue(cue)` once per forward crossing of Little Harbour's authored markers.
`'cruise'` is a pair of plank and enamel contacts at the first rollers. `'transfer'` is a dry
latch and low wood body at the slipway. `'arrival'` seats the marble in the terminal shoe before
the separate `harbourBell()` strike. Skip markers during seeking or skipped playback.

Call `sfx.finalLoad()` once at the shared board finish, in place of `win()`. A lower, rounded
load contact leads the existing felt win phrase by 180 ms. This payoff still plays when the
last load completes during fast forward. Normal box and truck completions keep their own cues.

Both hooks use the existing bank, voice limits and mixer. Delayed contacts are scheduled on
the audio clock and cancel with the rest of the one-shots. The film keeps the same quiet surf
and gulls. No additional audio is downloaded or decoded.

## Initial workshop-bank verification — 21 November 2026

- Before audio integration, the new thirteen-buffer and distinct reward/bell regression failed
  against the old eleven-file runtime (expected 13 decode calls, received 11).
- `npm run typecheck`: passed.
- `npm run lint`: passed.
- `npx vitest run tests/engine/audio.test.ts tests/engine/audio-assets.test.ts tests/engine/bundle-budget.test.ts`:
  **22 tests passed**.
- `npm run build`: passed; **117,073/150,000 audio bytes**, **1.998/2.125 MB** first download.
  Existing Vite configuration and large-chunk advisories remain.
- Disposable Playwright 1.64.1 container, mounting only this checkout and starting/stopping its own
  Vite test server, ran `npx playwright test tests/e2e/audio.spec.ts --project=game --output=output/current/sound/workshop-playwright`:
  **three passed** (1.0 min) through the demo URLs. All thirteen files actually decoded in Chromium;
  real touch pours, Undo, mute, restart, blur, corrupt downloads and held fast forward passed.
- The test now waits past rule completion for the final seating/completion event. It measures
  intake suppression while actual speed exceeds 1: winning automatically drops speed to normal,
  where the final seating is allowed to sound. Both completion rewards must still be observed.
- A first browser attempt could not reach the host server from Docker (`ERR_CONNECTION_REFUSED`);
  the successful run kept Vite and Chromium inside the same disposable container.
- Regeneration followed by normal preparation reproduced every source/encoded hash and metric.
  All thirteen encoded cues differ from the previous bank. Generator self-test passed.
- Final audio-scope `git diff --check`: passed. The last typecheck/build rerun passed after the
  concurrent unused import in `src/view/tubes.ts` was fixed by its owner.

The full performance suite, hosting and commits belong to the owner and were not performed here.
No listening, physical-phone speaker assessment or Safari decoding check was performed.

## Arcade cues and ambience verification

- Typecheck and lint passed. The 24 focused audio, mixer and bundle tests passed.
- The 13 WAVs, provenance and encoded MP3s reproduced byte-for-byte.
- A separate Chromium run passed all four audio scenarios at 375 × 690. It covered actual MP3
  decoding, touch, fast forward, corrupt downloads, and the ambience API with a real unlock gesture.
  The unit tests cover hidden and visible transitions and timer cleanup.
- The isolated production build passed at 112,894 audio bytes of 150,000 and 2.058 MB first download
  of 2.125 MB. The ambience adds no audio files.
