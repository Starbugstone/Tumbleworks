# Workshop gameplay additions

These seven concepts were accepted after the concept films and the folding-cup
revision. They are separate from the calibrated campaign: the campaign owner
retains the 180 registered levels, their order, metrics and difficulty gates.
The map owner exposes the additions through Workshop and owns its completion
storage and navigation. Workshop completion must not advance a campaign stop.

| Stable ID | Concept | State |
| --- | --- | --- |
| board-210 | Forked shelves with six- and nine-marble crates | Playable in Workshop and development bank |
| board-211 | Paired release with a sealed dock | Playable in Workshop and development bank |
| board-212 | Shared receiving pallet | Playable in Workshop and development bank |
| loop-210 | A short truck opens a pouring latch | Playable in Workshop and development bank |
| loop-211 | Coupled unload with unequal truck capacities | Playable in Workshop and development bank |
| tube-210 | Distinct folding cup exchanged for a capped spare | Playable in Workshop and development bank |
| tube-211 | Mixed-height final homes | Playable in Workshop and development bank |

“Bring blue to the front” is existing Loop Sort play, not a new mechanic.
“Make your own spare” / scattered-space boards were rejected. Neither is part
of this work. Mixed Funnel Sort crates means different crate sizes; it does not mean
mixed colours inside one crate.

## Ownership and integration

Definitions belong to src/sim/variety-boards.ts,
src/loop/variety-boards.ts and src/puzzles/variety-boards.ts.
src/workshop.ts exports WORKSHOP_LEVELS as a readonly GameLevel array with the
existing runtime factories, permanent game names and translated metadata.
No entry is appended to PLAY_ORDER. All seven definitions are imported by their
existing banks, with fresh score/hash rows and win/jam fixtures. Open the map’s
Workshop chooser or `/?workshop=<stable-id>` for isolated Workshop play. The
development-only `/?try=<stable-id>` route remains a bank preview, not proof of
Workshop isolation.

The gameplay work does not own App.ts, index.html, progress.ts, world
modules, map modules or tests/fixtures/picker.ts. The campaign baseline lock was released before shared rule/import changes.
Heavy browser and performance checks remain serialized, with imported source
frozen during each browser batch.

## Shared pallet contract

BoardDef.pallets contains disjoint pairs of adjacent dock indices. Each pair
has equally long, nonempty queues. Every front pair shares one visible base.
A full box waits for its partner; it accepts no more marbles and its next box
cannot receive early.

The final reservation in the second box advances both rule queues in the same
transition, before loss evaluation. A seal triggered by either full box still
opens on that box's own final reservation, even if its pallet is waiting.
Reservation remains authoritative; animation never unlocks a rule action.

Presentation waits until both third marbles are captured, then moves both
boxes and their common pallet together. The next pair can receive reservations
while departure continues. The first two captures remain still; each third
capture retains the existing brief box shake and completion sound. Undo restores
both queues, all reservations and the physical snapshot. A local joint lift and
central spark burst mark the second final capture; neither delays the next pair.
Reduced motion removes the lift, shake and sparks. Waiting shared boxes display
enlarged top-facing patterns, reusing their existing decals. A full belt that only
the blocked next boxes could drain is jammed.

No extra mutable pallet flag is needed: the board pairing, dockNext, and each
box's reserved and captured marbles determine all states. Existing settled and
machine keys must retain that information.

## Tube contracts

The cup starts empty and holds two marbles. Its first nonempty-to-empty move
spends it permanently until undo. Its ribbed, squat, folding silhouette must
remain distinct in grayscale; it folds into a closed puck. Completing a real
full-size colour home, never filling the cup, opens the capped spare.

Mixed-height boards declare each colour's required final capacity. Transfers
still move as much of the matching top group as fits. A complete home must be
full and match the required capacity of its colour: four reds in a four-place
tube are not complete when six reds require a six-place home. Every colour
has enough marbles for exactly one full home and a distinct eligible home must
exist. Empty spares are allowed at victory. Default boards keep their existing
validation, state keys and score hashes.

## Acceptance evidence

Checked against the uncommitted integrated working tree based on
`bd2371f20c2a2818d8443ce732626f23897321e9`, on 6 November 2026. Existing user
changes are retained. No commit or push was made.

- `tests/machine/variety.test.ts`, `tests/loop/variety.test.ts` and
  `tests/puzzles/tube-variety.test.ts` prove real-machine wins and actual jams,
  causal rule differences, current-state hints, immutability, exact undo and
  replay. Funnel Sort witnesses keep all recoveries at zero. The focused batch with
  the curve, pallet and model tests passed 62/62 after the seven bank imports.
- [Shared pallet model](models/funnel-pallets/README.md): 2,553 distinct bounded
  states; both deliberately broken queue transitions are detected. The physical
  test separately checks capture/departure timing. [Tube models](models/tube-variety/README.md)
  exhaust all 37 and 45 reachable ordered states of the two authored boards,
  including undo on every edge, solver equivalence and three rejected mutants.
- `tests/e2e/workshop-variety.spec.ts`: all seven concepts passed at 375×690
  through real touchscreen input. Each checks the actual chooser and direct
  route, its causal moment, cancelled input, exact undo, a real jam, a hint,
  winning replay and campaign/film-store isolation. Each chooser badge is checked
  before reload; campaign-chip isolation is checked after reload. The separate
  maintenance journey additionally proves board-212’s chooser badge after reload.
  Desktop captures use the existing 1280×800 layout. These are browser touch
  checks, not testing on a physical phone.
- `tests/e2e/variety-motion.spec.ts`: 2/2 passed. Normal shared-pallet departure
  lifts both full boxes together and triggers the local burst. Reduced motion
  suppresses lift/shake/sparks without changing joint departure. The cup and cap
  snap to their completed presentation, and the newly opened spare accepts the
  immediately following move.

The seven causal checks are split across two retained attempts: board-210 passed
in attempt 1; the other six passed in attempt 2. The first board-211 attempt
stopped on a harness assertion that tried to tap a correctly removed paired
crate. Its corrected assertion requires the target to be absent. No product
change was needed. `browser-source-check.json` records unchanged `src/` hashes
through these journeys.

Evidence lives under `output/current/gameplay-variety/`: `focused-bank-tests.log`,
`workshop-suite-1.log`, `workshop-suite-2.log`, `motion-suite.log`, and `browser/`
(phone, grayscale, causal, jam, win and desktop captures, state and replay logs).
The passing board-210 video is in `attempt-1/`; the remaining six passing videos
are in `playwright-attempt-2/`. Historical failed attempts remain intact.
Two six-second rendered gameplay clips, `films/board-212.mp4` and
`films/tube-210.mp4`, show the local arcade payoff at 2× simulation speed.
Their frame reports confirm the intended causal trigger and no page errors.
They use real touches with a deterministic clock, not measured phone playback.
The representative project-skill journeys are separately retained in
`output/current/verify/verify-maintenance-20261106-2023`.

The final integrated board-212 rerun passed after the App query cleanup. It
explicitly checks that leaving Workshop gameplay clears `?workshop`, then
reloads the map, opens the Workshop chooser, verifies its persisted badge and
reopens the exact puzzle. Its causal rules, undo, jam, winning replay and desktop
checks also pass. Doctor and typecheck pass. Evidence is in
`output/current/gameplay-variety/integrated-final-20261106-2146/`; the source
comparison found no runtime/media changes during the run, only the separately
owned, unused World performance test change. The browser slot was returned for
a guide-pointer CSS isolation fix before continuing the remaining checks.

## Campaign graduation remains provisional

Recipes and seeds are retained in `tests/variety-recipes.ts` and
`tests/fixtures/gameplay-variety.json`. Definitions, causal records, raw player
samples and scored files remain in `output/current/gameplay-variety/`. Only seven
new rows were appended to `tests/levelling/scores.json`; existing rows, bank
boards and PLAY_ORDER are unchanged by this work.

| ID | Proposed future round | Measured S | H | Current limitation |
| --- | ---: | ---: | ---: | --- |
| board-210 | 63 | 81.12 | 5.00 | Individual gate passes; neighbors/whole curve unregistered |
| loop-210 | 65 | 26.02 | 0 | Placement and whole-curve acceptance pending |
| tube-210 | 67 | 31.85 | 2.30 | Re-authored 2026-11-07 so the spare opens and the cup folds on separate moves; placement and whole-curve acceptance pending |
| board-211 | 77 | 12.49 | 1.67 | Fails ordinary-slot S and cheese gates; must be reauthored for that slot |
| loop-211 | 79 | 26.90 | 0 | Placement and whole-curve acceptance pending |
| tube-211 | 81, new lesson | 26.40 | 0.55 | New-rule lesson and complete interleaved round required |
| board-212 | 83, new lesson | 54.37 | 1.67 | Individual lesson gate passes; neighbors/whole curve unregistered |

Board-210’s near-boundary reward margin was confirmed with 200 samples each for
cheese/spam/brisk, retaining and reproducing the original 60 samples. The final
shares are 0.18/0.075/0.025; S=81.117172309 and the board hash is unchanged.
Neither that confirmation nor a winning share establishes a registered campaign
placement. The campaign owner retains assembly and difficulty-gate authority.

## Final integrated checks

All checks below ran against the integrated working tree; the complete
post-review source/harness hash comparison remained unchanged. The source and
browser slot was explicitly released after the performance runner exited.

| Check | Result | Evidence under output/current/gameplay-variety/ |
| --- | --- | --- |
| Corrected Workshop reload, board-212 | Pass, including persisted chooser badge | integrated-final-20261106-2146/workshop.log |
| Rendering hygiene | 6/6 pass | integrated-post-review-20261106/hygiene.log |
| All 60 Loop Sort levels, phone numbers | Pass on unchanged-limit retry, 1.8 minutes | integrated-post-review-20261106/loop-numbers-retry.log |
| All 60 Loop Sort levels, phone and desktop card bounds | Pass, 6 minutes | integrated-post-review-20261106/loop-bounds.log |
| Full-page grayscale, both new Loop Sort boards | Inspected; patterns, latch reference and numbers remain legible | browser/loop-210-full-gray.png and loop-211-full-gray.png |
| Final typecheck and production build | Pass; first download 1.970 MB / 2.000 MB | integrated-post-review-20261106/build.log |
| Gameplay performance, fixed six cases | 6/6 pass, 3.8 minutes; no overrides or ceiling changes | integrated-budget-20261106T221241Z/ |

The first number-readability attempt hit its unchanged 300-second timeout under
high host load. Its trace contains 2,630 successful assertions across all 60
registered IDs, but its overall result remains a failure. The independent
card-bounds sweep then passed, followed by a successful number-test retry under
lower load. Both attempts and the trace analysis remain in the evidence folder.
The retry did not change the test, timeout, boards or renderer.

The gameplay gate preserves every existing activity and quality guard, uses
4× CPU slowdown and a fixed 375×690 canvas at ratio 1, and runs with one worker
and no other owned browser/build jobs. Its reports, exact command, source hashes
and host-load references are retained in
[gameplay-variety-integrated.json](performance/gameplay-variety-integrated.json).
Host load during that run ranged from 6.75 to 13.33; raw CPU counters and the
initial Docker CPU snapshot are retained. The earlier campaign baseline run
still records two passes and four failures under contention; that history and
its limits are unchanged. This is a separate integrated passing run.

The combined single-worker unit run passed all 1,970 tests in 48 files in 375.72
seconds, exit 0 (`output/current/world/full-unit.log` and `full-unit.exit`). This
also resolves the earlier Tube Sort 12/15/16 timeouts under unchanged limits.
Lint passed with zero warnings/errors (`final-lint.log`); the map owner’s retained
post-review snapshot records the passing TLC model run and guide-pointer
regression. The separate World measurement batch also passed all four cases.
Its retained JSON-reporter run took 33.4 seconds and preserves ten raw scopes in
`output/current/world/measurements-final-20261106T2219/`. The earlier 48.3-second
run also passed, but its list reporter did not retain passing body attachments;
that evidence-retention issue was corrected without changing source or tests.

World construction traversed 25 distinct scales from 0.05 to 1. During three
seconds at rest, 183 App advances produced zero Stage submissions, renderer
frames or gameplay work. Steady playback of the first MP4 presented 72 additional
frames over three seconds, with zero continuing Stage or gameplay work. All
samples retained natural ratio 1.25 and a 468×862 backing buffer at 375×690 CSS
pixels with 4× CPU slowdown. The World measurements introduce no timing ceilings;
the six gameplay cases retain their existing separate limits. See the
[World measurement results](performance/world-measurements.md) and
[integration ledger](world-verification.md).

`output/current/world/final-validation.json` records all 91 broad source hashes
unchanged and the complete final validation. The durable
[measurement summarizer](../scripts/summarize-world-measurements.mjs) retains the
raw scopes and rejects an empty input. All six films were encoded and decoder
checked; the playback measurement above covers the first film only. World
validation is complete, and all source/browser/heavy-work locks are released.

These browser checks prove the stated behavior and regression budgets. They do
not establish physical-phone frame rate, thermal behavior or touch feel.
Nothing was committed, pushed or deployed by this work. The seven concepts stay
available through Workshop; campaign graduation still requires the gates above.
