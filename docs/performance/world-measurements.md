# World rendering measurements

The Blender-built perspective map and realtime 3D film passed the four isolated
measurement cases on the final combined tree on 7 November in **36.7 seconds**.
The reporter and ten extracted raw scopes are retained in
`output/current/world-3d/combined-final-20261107T104422Z/`; `world-summary.json`
and `world-summary.md` index the raw files. Every scope retained equal before/after source hashes, zero
gameplay work, the real clock and unchanged natural quality: 375×690 CSS px,
ratio 1.25, 468×862 backing buffer and 4× CPU slowdown. No timing ceilings were
added. The separate final gameplay gate passed all six cases with unchanged
limits and no overrides. All 297 combined product/harness hashes stayed unchanged;
commands, reports and host snapshots are indexed by
[the final integration report](world-3d-integrated.json).

The earlier pre-cue realtime 3D run passed four cases in 35.6 seconds, with ten
raw scopes retained in `output/current/world-3d/measurements-final-1/`. That run
remains separate from this final combined-tree run and the historical MP4 work.

## Current realtime 3D results

| Scope | Observed workload and result |
| --- | --- |
| Construction | Event setup 13.3 ms; 29 natural animation draws, reaching full scale. Natural submission p50/p95/max 2.1/5.5/5.7 ms. |
| Six fully built villages | Fresh setup 181.7–260.2 ms. Each collected twelve requested draws; requested submission p95 2.5–10.4 ms. These are requested-draw microbenchmarks, not idle activity. |
| Idle | 3,025.7 ms and 183 App advances; zero Stage submissions, renderer-frame increments or gameplay work. |
| First film bootstrap | 3,916.8 ms through the authored opening hold and first release; 66 submissions. Submission p50/p95/max 2.4/8.2/24.7 ms. |
| First film steady window | 3,062.4 ms, 52 natural submissions, 52 distinct marble positions and camera poses. Submission p50/p95/max 1.6/3.8/6.3 ms. Authored film time advanced from 2.4499 to 4.7328 seconds. |

Completed villages submitted 28–29 calls and 34,200–36,160 triangles per draw,
including the appropriate earned optional additions. All project completions in
these measurement saves are explicitly seeded presentation fixtures, not puzzle
win evidence. The film bootstrap and steady window are separate workloads.

CPU submission cost does not describe the whole frame: steady-film RAF intervals
were p50/p95/max 50.0/100.0/133.3 ms under this browser/software renderer, and
construction intervals were 16.7/100.0/100.0 ms. Setup and frame intervals remain
in the raw reports. Host load snapshots ranged from 7.95–8.93 for one minute,
5.31–5.61 for five minutes and 3.85–3.98 for fifteen minutes. These observations neither establish physical-phone frame rate
nor a measured speedup over the different historical native-video workload.

## Historical native-video baseline

`tests/e2e/world-performance.spec.ts` passed all **four cases**, first in 48.3
seconds and then in 33.4 seconds with explicit JSON reporting to retain raw body
attachments. Source, tests and configuration did not change between runs. The
first list-only run did not persist passing body attachments; its test pass does
not replace the second run's retained raw evidence. There are no map timing
ceilings, and gameplay limits remain unchanged.

The retained evidence directory is
`output/current/world/measurements-final-20261106T2219/`: `reporter.json`, ten raw
scope reports in `attachments/`, `summary.json`, `summary.md`, `run.log` and
`host-after.json`. All ten scope hash comparisons passed; all 91 broad source
hashes still matched `output/current/world/post-review-source.json`.

### Recorded historical results

All samples used the real clock, 4× CPU slowdown, 375×690 CSS px, natural ratio
1.25 and a 468×862 backing buffer, with no quality changes or gameplay work.

| Scope | Observed workload and result |
| --- | --- |
| Construction | 25 distinct scales from 0.05 to 1; one event draw and 24 natural draws. Event 14.3 ms; natural draw p50/p95/max 4.6/16.8/17.4 ms. |
| Six fully built chapters | Fresh setup 127.8–217.5 ms; first draw 12.5–78.2 ms. Twelve requested draws per chapter, collected in 197.6–1,136 ms; requested-draw p95 11.5–23.3 ms. |
| Idle | 3,028.5 ms and 183 App advances; zero Stage submissions, renderer-frame increments or gameplay work. |
| First MP4 steady playback | 3,026.6 ms window, 3.0291 s video progress, 73 total frames and one dropped frame: 72 additional presented frames. Zero continuing Stage submissions, renderer-frame increments or gameplay work. |

Chapter scenes submitted 91–93 draw calls and 12,356–12,932 triangles per draw;
construction submitted 94 calls and 13,080 triangles. These are CPU submission
measurements, not GPU timings. Frame intervals were uneven: chapter p95 values
ranged from 16.7 to 216.7 ms; construction p95 was 116.7 ms. Host load averages
across the two runs were 7.25/12.48/22.45 initially and 3.98/10.12/20.37 afterward. This is a recorded
browser/software-renderer baseline, not physical-phone performance.

The nine pre-map isolated calibrations passed, but the subsequent normal
six-case gameplay gate passed two and failed four under recorded host contention.
That historical run is not a pass. The [replacement integrated six-case gate](gameplay-variety-integrated.json)
now passes with unchanged limits, no overrides and stable source hashes.
The World measurement activity guards also passed; functional browser passes and
the passing 1.970 / 2.000 MB build budget alone do not establish map frame-time performance. See the
[integration ledger](../world-verification.md) and
[pre-map baseline](campaign-41-60-baseline.json).

Run only after the source is frozen and the other browser, authoring and build
jobs have stopped. Run the established six-case gameplay gate and the new world
measurements separately, with one worker:

```sh
docker compose --profile e2e run --rm e2e npx playwright test tests/e2e/performance.spec.ts --project=performance --no-deps --workers=1

measurement_dir="output/current/world/measurements-$(date -u +%Y%m%dT%H%M%SZ)"
mkdir -p "$measurement_dir"
docker compose --profile e2e run --rm \
  -e PLAYWRIGHT_JSON_OUTPUT_FILE="$measurement_dir/reporter.json" \
  e2e npx playwright test tests/e2e/world-performance.spec.ts \
  --project=performance --no-deps --workers=1 --reporter=list,json \
  --output="$measurement_dir/playwright"
node scripts/summarize-world-measurements.mjs \
  "$measurement_dir/reporter.json" "$measurement_dir/summary"
```

The [exporter](../../scripts/summarize-world-measurements.mjs) accepts a reporter
JSON file or output directory and a new output prefix. It retains raw scopes and
writes JSON and Markdown summaries, rejects missing measurements, and preserves
existing outputs. Its rejection was checked against the first list-only run;
the retained reporter and attachment directory each exported all ten scopes.

The existing filename regex selects both specs for the performance project.
Project isolation alone does not serialize different files: retain `--workers=1`.
World measurements do not substitute for the separately verified gameplay gate.

## Current measured workloads

The six independent village layouts are still being implemented. Their adapted
harness observes construction transforms and authored camera cuts; a fresh run
is pending. The results above apply to their recorded earlier source trees.

The completed-chapter, idle and first-film saves seed all seven
`WORKSHOP_PROJECTS` IDs alongside the campaign fixture. Construction seeds the
two first-village project IDs alongside its nine completed stops. These are
seeded presentation fixtures, not claims of puzzle wins. Raw snapshots and scope
summaries retain seeded project IDs/counts, the current scene's rendered project
count, and per-draw triangle counts. Each completed chapter must contain its
actual earned additions. Source hashes include the Rube chain, sequence and film
camera implementations as well as the Blender mesh assets.

- **Construction:** a save has nine built stops. The harness injects the next
  completed `WorldProgress` into the real `WorldView.show(..., true)` presentation
  path, then leaves `App.frame` running. It observes the tenth structure's actual
  construction transform and progress
  through intermediate rendered states to its completed rest pose. This is a presentation
  microbenchmark; the real three-puzzle touch/completion journey is covered in
  `world.spec.ts`. Event/setup cost and natural animation draws are reported
  separately. A 30-second deadline bounds collection without inventing a frame
  budget.
- **Fully built chapters:** every registered chapter is visited with its actual
  completed geometry. Scene setup and first draw are timed, with reuse reported.
  Each scene then receives twelve deliberately requested draws, paced by real
  animation frames and bounded to fifteen seconds. Their cost is a render
  microbenchmark, not a claim that an idle map continuously renders.
- **Idle:** a fully built map rests for three real seconds. The App clock must
  keep calling `advance`, while Stage draws, renderer frame increments, gameplay
  `step`/`render` calls and game-state changes remain zero.
- **First realtime 3D film:** the real replay button starts `WorldFilm` through
  the existing App clock. Bootstrap is separate from a three-real-second natural
  playback window. Readiness waits for visible cargo after the first authored
  first village's authored contact plus 0.05 seconds, with the existing thirty-second
  collection deadline. Bootstrap therefore includes the intentional opening hold;
  it is not labelled steady movement. Both scopes record the contact and steady
  start times and `steadyStartsAfterAuthoredRelease`. The steady window still
  requires multiple actual rendered cargo positions, not just advancing film time.
  The harness reads the playback object's authored duration,
  rather than assuming an eleven-second film. It records film time, the visible
  marble's position and the actual Stage camera matrices on each draw. Multiple
  cargo positions and camera poses must be rendered, with nonzero calls and
  triangles, while gameplay `step`/`render` and gameplay-state changes stay zero.
  Continuing Stage submissions are expected for this realtime workload. The
  historical MP4's zero-WebGL-playback result is not its acceptance condition.

The four cases deliberately do not time valley overview, manual orbit, reduced
motion or every chapter's film. Their functional coverage must be reported
separately; no timing or smoothness claim for them follows from these samples.

## Measurement boundaries

All windows run at the supported 375×690 viewport and 4× CPU slowdown. The map's
natural pixel ratio is **1.25**, with its actual backing-buffer and CSS dimensions
recorded and checked. The harness never changes quality or enables `manualClock`.
It must not be compared directly with gameplay measurements warmed to ratio 1.
Initial application boot is outside the windows; subsequent scene setup is
measured at the throttled rate.

Per-scope JSON attachments retain source/harness/Blender asset hashes, host load,
elapsed windows, raw draw/advance/frame samples, draw calls, triangles, active
construction transforms and progress, film time, rendered cargo positions and camera matrices,
and activity/quality invariants. Sources are
hashed again after every sample; changed source invalidates the measurement.
Explicit JSON reporting retains passing body attachments in `reporter.json` for
extraction; list-only reporting must not be assumed to persist those bodies.
Keep both the reporter JSON and extracted raw scopes under `output/current`.

Stage timings measure CPU-side render submission and can include driver stalls;
they are not GPU timer queries. Frame intervals and complete App advances are
reported separately. Sparse samples, host contention, quality changes and failed
activity guards must stay visible. These browser/SwiftShader measurements do not
establish physical-phone frame rate, thermal behavior or touch feel. Establish
repeatable baselines before adding any map timing ceiling.
