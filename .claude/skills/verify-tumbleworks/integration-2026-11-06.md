# Historical verification: 6 November 2026

This preserved ledger predates the Blender village, realtime 3D films and gated Atelier projects. Its passes, MP4 playback workloads, 2 MB ceiling and release statements are historical. Use [the current integration map](integration.md) for current contracts and readiness.

# Verifying concurrent campaign, world and variety work

Use the imported source and the live app to decide what exists. A thread's plan,
an unused module and a concept video do not establish an available player path.
Keep run notes, commands and results in `output/current/verify/<run>/`, including
working-tree changes: a commit SHA alone cannot identify this shared Vite build.

## Campaign

[`PLAY_ORDER`](../../../src/campaign.ts) owns registered membership and ordering.
The current campaign is 60 rounds / 180 levels, preserving the first 120 IDs and
definitions. Lesson placements are paired crates `board-200` at round 41, latch
`loop-200` at 43, capped spare `tube-200` at 45, shelves `board-201` at 57 and
short trucks `loop-95` at 59. Older short fixture `loop-201` remains in its bank.
Bank-only lessons include sealed docks `board-202`, couplings `loop-202` and
closing cup `tube-201`; the numeric ID never implies campaign position.

[`journey.spec.ts`](../../../tests/e2e/journey.spec.ts) derives slices from campaign
length and checks touch wins, saved completion and continuation from an older
40-round save. [`campaign-loop-expansion.spec.ts`](../../../tests/e2e/campaign-loop-expansion.spec.ts)
checks the short-truck lesson. Re-run the all-registered-level phone/desktop
roster cases in [`loop.spec.ts`](../../../tests/e2e/loop.spec.ts) after changes to
boot, picker helpers or layout. A few representative captures cannot replace them.

The pre-map rendering baseline is recorded in
[`campaign-41-60-baseline.json`](../../../docs/performance/campaign-41-60-baseline.json).
Its nine calibration samples passed, but the subsequent pre-map six-case gate had
two passes and four failures under recorded host contention. That historical
failure stays preserved. The later integrated gameplay run now passed all six
cases with unchanged limits, no budget overrides and stable source/harness
hashes; see [`gameplay-variety-integrated.json`](../../../docs/performance/gameplay-variety-integrated.json).
These browser checks do not establish physical-phone performance or the separate
World measurement results.

## World progression integration

[`world-progression.md`](../../../docs/world-progression.md),
[`src/world/`](../../../src/world/) and
[`WorldView`](../../../src/view/world.ts) define the map work. Confirm that App
actually imports and uses them before treating the following as live behavior:

- Normal boot shows `#world`, with `.map-stop[data-round="0"]` using zero-based
  global rounds. `data-status` is `built`, `available` or `locked`; locked stops
  are disabled. A tap resumes that stop's next unfinished stable ID. Completed
  stops replay their three games.
- `.wv-play` is the primary `▶ Play next level` / `▶ Jouer le niveau suivant`
  button. It calls the existing frontier entry/resume action, even when the map
  is showing an earlier location. Completed-location Film is compact and secondary
  in the same `.wv-primary` row, with visible text Film and accessible name
  `Film · Watch your machine` / `Film · Voir votre machine`. When the whole campaign
  is complete, Film is the sole primary action. The built count is in the subtitle;
  `.wv-progress` was removed. This CTA change did not alter App, progression or
  rendering ownership.
- `debugState().screen` distinguishes `map`, `game`, `workshop` and `film`;
  `source` distinguishes campaign and Workshop. An existing runtime behind the
  map is paused, so runtime existence alone does not prove usable gameplay.
- Next level continues within the accepted stop. Finishing all three returns to
  the map after the construction delay; crossing a stop boundary needs a map tap.
  `#map-open` in the picker returns to the map. Peeking at the map and returning
  to the same current unfinished campaign stop after accepted moves preserves the
  exact runtime, state and Undo history in memory. Page refresh still restarts
  the unfinished puzzle; it does not restore a mid-puzzle snapshot from storage.
- A completed ten-stop location offers its film. Newly earned film skip/end moves
  to the next available location. Explicitly replayed film skip/end returns to
  the same visited location. `#film-skip` remains the Back to map control; reduced
  motion shows a static film with a Play film control. Film acknowledgements use
  `tumbleworks.valley.v1`, separately from `tumbleworks.progress.v1` completions.
- Workshop opens from the map footer. Its chooser is the `Workshop puzzles`
  navigation, with `.wv-experiment[data-workshop="<id>"]`. A validated
  `?workshop=<id>` opens that exact puzzle in production and development.
  Workshop wins offer Back to workshop and cannot build a campaign stop or unlock
  a film. Their persisted completion badge is `.wv-workshop-check` within the
  matching chooser item. The level picker always lists campaign chips, even from
  Workshop gameplay. Selecting a puzzle sets `?workshop=<id>`; returning to the
  chooser or map clears it. Back to the village from a direct-query Workshop uses
  `App.showMap`, so subsequent campaign reloads do not reopen Workshop. The
  development-only `?try=<bank-id>` route still bypasses the map.

The map owner maintains [`tests/fixtures/picker.ts`](../../../tests/fixtures/picker.ts).
Reconcile `tw` boot, doctor, picker, reload and win expectations with that helper;
do not silently fall back to direct App setters. Drive map entry, partial-save
resumption, three-game return, old-save migration, film skip/replay, Workshop
isolation, reduced motion, phone and desktop before marking this path verified.
The original four World cases are superseded by the ten-case final evidence below.
The existing driver still uses stop buttons; its historical map pass does not
establish the newly added primary Play CTA.

The map owner has applied the final queued film lifecycle and map-peek changes
and reports 19 world unit/model/timeline/lifecycle checks passed. The intentional
MarbleFactory regression was demonstrated failing before its fix and passing
after; this is owner-reported evidence, not a new run by skill maintenance.
The final full unit run passed **1,970 tests across 48 files**, in 375.72 seconds
with exit 0, recorded in
[`full-unit.log`](../../../output/current/world/full-unit.log) and
[`full-unit.exit`](../../../output/current/world/full-unit.exit). The owner ran it
with a single-worker limit; coverage includes the world lifecycle checks and the
three games' physics, hints, replay, gates and executable model checks. This is
unit/model evidence from the saved run, not native-film or map-resume browser proof.
The final source audit is [`final-source.json`](../../../output/current/world/final-source.json).
It records ten unique World/UI cases and thirty unique existing input/save/
onboarding regression cases passed across retained attempts:

- World/UI: [`cta-final.log`](../../../output/current/world/cta-final.log) retained
  nine passes and a language-menu harness failure; the corrected
  [`cta-final-attempt-2.log`](../../../output/current/world/cta-final-attempt-2.log)
  passed two cases, giving ten unique passes rather than eleven distinct tests.
- Existing regressions: [`final-regression.log`](../../../output/current/world/final-regression.log)
  and [`final-regression-attempt-2.log`](../../../output/current/world/final-regression-attempt-2.log)
  together cover thirty unique cases. The retry advances the paused UI clock before
  picker interaction. The owner reports runtime unchanged through both harness fixes.

World coverage includes native first-film readiness/skip/replay and reduced-motion
opt-in, map-peek fingerprint/exact Undo, query cleanup, the three-game round, and
the primary CTA. All six chapter MP4s are exported and decoder-checked; their hashes
are in the final audit. This does not claim native playback to completion of all
six films, physical-phone performance or a passing performance gate. Unit, TLC
(exit 0), typecheck, lint and build are reported passed; first download is
1.970 MB within the unchanged 2 MB ceiling. The reported return-to-map complaint
concerned production; it is not evidence of a reproduced local navigation failure.

Variety's focused final `board-212` reload proof passed, with doctor passed and
typecheck reported passed. Its current evidence base is
`output/current/gameplay-variety/integrated-final-20261106-2146`; details are below.
Before hygiene, Loop layouts, grayscale or performance began, Variety temporarily
released its browser/source slot to the map owner for a confirmed guide-pointer
CSS fix. That fix is now applied and proved: generic non-game CSS hides the stale
`#guide-pointer` outside gameplay, including Workshop/Film. The new
[`world-ui-regressions.spec.ts`](../../../tests/e2e/world-ui-regressions.spec.ts)
journey visits fresh Map → Workshop → Back to village → Map Play, checking no
hand/instruction in Workshop and restored hand/Skip guide in gameplay.
[`guide-before.log`](../../../output/current/world/guide-before.log) retains the
failed Workshop hidden-hand assertion;
[`guide-after.log`](../../../output/current/world/guide-after.log) records its pass,
and [`guide-typecheck.log`](../../../output/current/world/guide-typecheck.log)
records typecheck output. This is one additional focused regression, not another
run of all ten World cases or direct Film hidden-hand browser proof.

[`post-review-source.json`](../../../output/current/world/post-review-source.json)
supersedes the earlier source snapshot for the guide fix. It links the previous
audit and records the CSS change, new regression and measurement-harness integrity
updates. Variety completed the hygiene, roster, grayscale and fixed-budget checks
listed below, closed its owned browsers/builds, cleaned its lease and preserved
the reused dev server. The four separate World measurements have now passed;
the root owner explicitly released all source/browser/heavy-work locks after
final validation. This maintenance reconciliation remains documentation-only.

## Integrated gameplay and layout checks — passed

[`gameplay-variety-integrated.json`](../../../docs/performance/gameplay-variety-integrated.json)
records **6/6 gameplay budget cases passed** in 3.8 minutes, with
`limitsChanged: false`, `budgetOverrides: false` and `sourceUnchanged: true`.
The actual reports cover `board-57`, `board-89`, `loop-61`, `loop-86` at normal
speed plus `board-57` and `loop-86` at ×5, with activity and quality guards passing.
Raw evidence is retained in
[`integrated-budget-20261106T221241Z/`](../../../output/current/gameplay-variety/integrated-budget-20261106T221241Z/).
The unchanged ceilings and stable hashes are the acceptance evidence; the old
contended run has not been rewritten or reclassified as passing.

Post-review functional/visual evidence is retained separately:

- [`hygiene.log`](../../../output/current/gameplay-variety/integrated-post-review-20261106/hygiene.log):
  six render-hygiene cases passed.
- [`loop-bounds.log`](../../../output/current/gameplay-variety/integrated-post-review-20261106/loop-bounds.log):
  every registered Loop Sort board's card bounds passed at phone and desktop sizes.
- [`loop.log`](../../../output/current/gameplay-variety/integrated-post-review-20261106/loop.log)
  preserves the first 300-second number-readability timeout.
  [`loop-numbers-retry.log`](../../../output/current/gameplay-variety/integrated-post-review-20261106/loop-numbers-retry.log)
  passed all 60 registered IDs with the same 300-second timeout. Successful
  assertions in the first attempt do not turn its timeout into a pass.
- Full-page grayscale captures
  [`loop-210-full-gray.png`](../../../output/current/gameplay-variety/browser/loop-210-full-gray.png)
  and [`loop-211-full-gray.png`](../../../output/current/gameplay-variety/browser/loop-211-full-gray.png)
  were inspected/shown by the variety owner. The saved
  [`full-gray.log`](../../../output/current/gameplay-variety/integrated-post-review-20261106/full-gray.log)
  belongs to those captures, not a timing measurement.
- [`source-after-all.json`](../../../output/current/gameplay-variety/integrated-post-review-20261106/source-after-all.json)
  records no changed sources. The final build remains 1.970 MB within the unchanged
  2 MB ceiling, recorded in
  [`build.log`](../../../output/current/gameplay-variety/integrated-post-review-20261106/build.log).

These results close the reported integrated gameplay/layout gates. The four
World cases also passed independently, with retained raw evidence below.

## World rendering measurements — four cases passed

[`world-performance.spec.ts`](../../../tests/e2e/world-performance.spec.ts) and
[`world-measurements.md`](../../../docs/performance/world-measurements.md) define
four separate measurement cases. All four passed twice on unchanged source/tests/
configuration: the first list-only run took 48.3 seconds; the retained JSON-reporter
run took 33.4 seconds. These are two validation runs, not a measured speedup.
There are still no World timing ceilings.

The first run did not retain passing body attachments, so its green test status
cannot replace the second run's raw evidence. The retained run has
[`reporter.json`](../../../output/current/world/measurements-final-20261106T2219/reporter.json),
ten raw scope reports in
[`attachments/`](../../../output/current/world/measurements-final-20261106T2219/attachments/),
[`summary.json`](../../../output/current/world/measurements-final-20261106T2219/summary.json)
and [`summary.md`](../../../output/current/world/measurements-final-20261106T2219/summary.md).
The reporter records four expected passes, zero unexpected, zero skipped and zero
flaky cases; the summary alone is not proof of test success. All ten scope hash
comparisons passed, and the final audit confirms 91 unchanged broad source hashes.

- Earned-construction presentation through natural animation frames. This injects
  completed progress into `WorldView.show`, so it is a presentation microbenchmark;
  the actual three-game completion proof remains in `world.spec.ts` and `tw map`.
- Fully built geometry for every registered chapter, reporting setup and twelve
  explicitly requested draws per chapter. These draws do not describe idle behavior.
- Real-clock idle, requiring zero gameplay steps/renders, Stage submissions and
  renderer frame increments while the App clock continues running.
- Actual first-film video playback, separating bootstrap from steady video frames
  and requiring zero hidden gameplay or continuing map draws. Fallback rendering
  cannot pass as video. Scope remains the first film only; exporting/decoding
  films 2–6 does not add their playback to this harness.

Retained activity evidence includes 25 distinct construction scales, twelve
requested draws for each of the six fully built chapters, and a three-second idle
sample with 183 App advances but zero Stage submissions, renderer-frame increments
or gameplay work. The first-MP4 steady sample advanced 72 presented video frames
in about three seconds with zero ongoing Stage submissions or gameplay work.
Requested chapter draws remain a microbenchmark; they do not describe idle work.

The harness uses 375×690, 4× CPU slowdown and the natural 1.25 pixel ratio, without
manual-clock or quality overrides. Attachments retain source/harness/video hashes,
host load and raw samples; changed sources invalidate measurements. Do not compare
these costs directly with gameplay measurements at ratio 1 or report them as
physical-phone performance. The actual backing buffer was 468×862 at 375×690 CSS
pixels, with no quality changes.
The post-review harness additionally hashes active presentation dependencies and
requires total video frames minus dropped frames to increase, so wholly dropped
video cannot satisfy the presentation guard. The passing World evidence is
separate from the completed fixed-budget gameplay gate.

After the source freeze and browser handoff, run each file separately on a quiet
host, with one worker:

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

The versioned [`summarize-world-measurements.mjs`](../../../scripts/summarize-world-measurements.mjs)
accepts reporter JSON or an attachment directory, retains raw scopes, writes JSON
and Markdown summaries, refuses existing outputs and rejects zero reports. The
owner checked its zero-report rejection and valid ten-scope export. Explicit
`PLAYWRIGHT_JSON_OUTPUT_FILE` and `--reporter=list,json` preserve passing body
attachments; do not rely on list-only output for raw evidence.

The existing performance-project filename regex matches both files, so project
isolation alone does not prevent them overlapping. The gameplay file has its
recorded six-case pass above; these World measurements cannot replace that gate,
and that gameplay pass cannot establish the World results.

## Seven approved variety boards

These seven definitions are exported through `WORKSHOP_LEVELS` and injected by
main. Their individual causal browser checks live in
[`workshop-variety.spec.ts`](../../../tests/e2e/workshop-variety.spec.ts). All seven
now have passing causal journeys across the two preserved attempts below. The
separate reduced-motion/payoff cases also passed; performance remains a separate
gate.

| ID | Behavior to prove |
| --- | --- |
| `board-210` | Forked shelves expose mixed six/nine-marble crates on accepted releases. |
| `board-211` | Atomic paired release combines with a sealed dock and same-transition opening. |
| `board-212` | One full box waits for its pallet partner; both queues advance atomically and both captured boxes depart together. |
| `loop-210` | Completing a short truck opens another truck's pouring latch; receiving stays legal. |
| `loop-211` | Unequal-capacity coupled trucks pour together; one Undo restores both. |
| `tube-210` | The squat ribbed cup folds on first emptying; completing the required home opens the capped spare. |
| `tube-211` | A six-marble colour requires its six-place home; four in a four-place tube does not complete that colour. |

The definitions live in `src/{sim,loop,puzzles}/variety-boards.ts`, exported through
`WORKSHOP_LEVELS: readonly GameLevel[]` in `src/workshop.ts` and injected by main.
Funnel/Loop win and jam fixtures live in `tests/variety-witnesses.ts`; Tube solutions
are with their definitions and Tube jam paths are in
`tests/puzzles/tube-variety-fixtures.ts`. `tw` imports these real fixtures and uses
an explicit `--workshop` source.
All seven definitions are now also imported into their development banks, with
fresh score/hash rows in [`scores.json`](../../../tests/levelling/scores.json).
The common [`tests/witnesses.ts`](../../../tests/witnesses.ts) exports merge the
variety win, jam and fast-play fixtures. A development `?try=<id>` link can open
the bank version; use `--workshop` when proving Workshop source and completion
isolation. Bank registration and scoring do not add levels to `PLAY_ORDER`: the
registered campaign remains 180. Source availability does not establish live
proof. Campaign graduation follows measured difficulty and complete interleaved
rounds in [`levelling.md`](../../../docs/levelling.md); proposed later slots are
not registered coverage.

For each board, prove real chooser touches, its causal rule effect, exact Undo,
hint and replay, a winning continuation and an actual losing choice. Capture the
container patterns at 375×690 and in grayscale, plus the existing desktop layout.
Generic winning orders alone do not establish optional cup use, cap receiving or
the pallet's waiting state. Keep the rejected queued-receiver and make-your-own-spare
ideas out of the feature map. Follow [`gameplay-variety.md`](../../../docs/gameplay-variety.md)
for the accepted contracts.

The maintenance pass uses representative `doctor`, `picker`, three `controls`,
`map`, `workshop board-212`, `win board-212 --workshop` and `jam tube-210 --workshop`
journeys. The variety owner runs the seven-board causal suite separately, including
phone/grayscale/desktop captures and video. Record its actual result rather than
duplicating the full suite during skill maintenance. Film media/skip/replay,
all-registered roster checks and quiet-host performance are separate integration
gates; none is established by those representative journeys.

The seven-board causal suite passed with one worker and video: `board-210` passed
in [`workshop-suite-1.log`](../../../output/current/gameplay-variety/workshop-suite-1.log),
then the remaining six passed in
[`workshop-suite-2.log`](../../../output/current/gameplay-variety/workshop-suite-2.log).
Attempt 1 is retained with its failed `board-211` test assertion: the atomic pair
had already removed `supply0`, so the corrected test checks its absence. The owner
reports unchanged runtime throughout; this was a test-only correction.

Coverage includes real phone touches through chooser and direct Workshop routes,
causal rule moments, exact Undo, jams, Hint, wins and replay, completion/source
isolation, chooser completion marks, reload source/isolation and desktop layout.
Phone/grayscale/desktop screenshots and state/replay JSON are in
[`browser/`](../../../output/current/gameplay-variety/browser/); videos are retained
in [`attempt-1/`](../../../output/current/gameplay-variety/attempt-1/) and
[`playwright-attempt-2/`](../../../output/current/gameplay-variety/playwright-attempt-2/).
The shared-pallet empty queued-box decal has a current phone/grayscale capture;
the maintenance review inspected `board-212-gray.png`. Earlier maintenance
captures still predate that presentation change.

The historical seven-board suite checked chooser badges before reload and
campaign-chip isolation after reload. The maintenance `board-212` win separately
reopened the chooser and checked its badge after reload. After Workshop query
cleanup, the updated suite now follows cleared query → reload to map → Workshop
chooser → persisted badge → exact selected puzzle/source.

The focused final `board-212` run passed that updated path in
[`workshop.log`](../../../output/current/gameplay-variety/integrated-final-20261106-2146/workshop.log).
Its health check passed in
[`doctor.log`](../../../output/current/gameplay-variety/integrated-final-20261106-2146/doctor.log).
Screenshots/state/replay evidence are in
[`browser/`](../../../output/current/gameplay-variety/integrated-final-20261106-2146/browser/)
and browser artifacts in
[`workshop-playwright/`](../../../output/current/gameplay-variety/integrated-final-20261106-2146/workshop-playwright/).
Only `board-212` has been re-run with the new reload assertions; their presence
in the shared test is not proof that all seven were re-run. This evidence also
predates the guide-pointer CSS fix documented above.

[`variety-motion.spec.ts`](../../../tests/e2e/variety-motion.spec.ts) passed both
cases, recorded in [`motion-suite.log`](../../../output/current/gameplay-variety/motion-suite.log).
Normal shared-pallet departure lifts both full boxes together with a local burst;
reduced motion suppresses lift, shake and sparks while preserving joint departure.
The reduced-motion cup/cap exchange snaps to its finished presentation, and the
opened spare accepts the immediately following move. Current captures are in
`browser/board-212-motion-{arcade,reduced}.png` and
`browser/tube-210-reduced-motion.png` under the evidence folder above.

[`browser-source-check.json`](../../../output/current/gameplay-variety/browser-source-check.json)
records `changedSrc: []` and `sameRuntime: true` against the saved runtime hashes
through the seven causal tests, two payoff tests and two deterministic clips.
The completed six-second clips are
[`board-212.mp4`](../../../output/current/gameplay-variety/films/board-212.mp4) and
[`tube-210.mp4`](../../../output/current/gameplay-variety/films/tube-210.mp4).
They use real touches and 2× simulation cadence; their encoded playback does not
establish real-time or physical-phone performance. Reports/replays are retained
beside their frame folders. These gameplay payoff clips are separate from the
valley's chapter-film assets and their playback checks.

The variety owner reports lint passed and has explicitly released its browser
and source slot to the map owner: owned browser containers are closed and its
lease is cleaned, with the reused dev server preserved. The map owner now owns
the applied App/world changes and final World/UI evidence above. The saved variety
hash audit covers the earlier pre-handoff runtime. The focused `board-212` pass
above now proves the updated reload contract. The browser/source slot is now
released to the map owner after Variety's completed post-guide-fix hygiene, both
all-registered Loop roster checks, full-page grayscale and unchanged six-case
gameplay budget pass. The separate four-case World run is now complete too.
[`final-validation.json`](../../../output/current/world/final-validation.json)
records the final scope: 1,970 unit tests / 48 files, ten World journeys plus the
guide-isolation regression, thirty existing regression cases, six hygiene cases,
both all-60 Loop checks, six fixed gameplay budget cases and four World measurement
cases with ten retained scopes. Type/lint/TLC and the 1.970/2 MB build are green;
all six chapter films are exported and decoder-checked. All locks are released.
No commits, pushes or deployment were made. Physical-phone performance remains
outside this evidence, and no World timing ceilings were added.
