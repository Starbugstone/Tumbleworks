# Verification

## Current scope — alpha 0.0.1 review, 5 November 2026

The registered campaign is **40 rounds, 120 levels**, interleaved Funnel Sort,
Loop Sort and Tube Sort. The 120-round/360-level campaign is the target, not the
current release. `PLAY_ORDER` in [src/campaign.ts](../src/campaign.ts) is the
order authority. The [tracked expansion decision](levelling-decision-2026-11-03.md)
preserves the rationale and identifies the missing scratch assembly inputs.

The hardening checkpoint is `34bf302a7174d92eb3b87065d767c145ba43bdae`.
Its typecheck, lint, 1,502 unit tests, build, focused browser repetitions, variants,
resource checks and local hosting checks pass. Its [hosted CI run](https://github.com/Starbugstone/Tumbleworks/actions/runs/42108426683)
also passes all three jobs. The full 59-test browser run preceded the final input
and rendering follow-ups; their focused checks are recorded separately in the
[alpha review](alpha-0.0.1-review.md). After the final Hint-feedback and test
follow-ups, lint, typecheck, build, 48 repeated input/render cases, six variant
cases, three resource cases and 18 standalone performance cases pass. Sol's third
round approved the final behavior diff at `b647956`. The [pull request](https://github.com/Starbugstone/Tumbleworks/pull/1)
records hosted checks for subsequent heads; the checkpoint run does not certify
them. Historical results below do not certify this revision.

## Alpha rendering baseline — 5 November 2026

The [recorded measurements](performance/alpha-0.0.1-baseline.json) compare original
`26dda18` with candidate `34bf302`, using the same maintained performance harness.
For each case, three samples per revision ran in A/B/B/A/A/B order, alone from
other project tests, builds and browsers. Each sample lasted 20 seconds after the
natural quality reduction and Restart, at a full 375×690 canvas, pixel ratio 1,
4× CPU slowdown and SwiftShader. The machine exposes eight logical CPUs from an
Intel i7-10750H to WSL2; the pinned Playwright image is recorded in the artifact.
All 36 samples passed asset, font, runtime, fixed-quality and real-touch workload
checks. Timing limits were disabled only for that diagnostic collection; it was
not a passing release-budget run.

The table gives the median of three runs, with their min–max in parentheses,
in milliseconds. “Tick + draw” is the sum of the per-tick and per-draw medians,
not the median cost of a whole frame.

| Case | Base tick | Candidate tick | Base tick + draw | Candidate tick + draw | Limits: tick / tick + draw |
| --- | --- | --- | --- | --- | --- |
| `board-57` ×1 | 9.6 (8.7–10.4) | 9.2 (8.1–9.8) | 35.9 (32.1–36.8) | 33.1 (32.8–35.2) | 12 / 40 |
| `board-46` ×1 | 6.6 (6.5–7.4) | 6.5 (6.3–6.6) | 29.0 (28.9–30.4) | 27.6 (26.6–29.0) | 10 / 34 |
| `loop-61` ×1 | 2.2 (2.0–3.0) | 2.4 (2.3–3.1) | 34.8 (31.6–36.1) | 26.0 (25.1–29.3) | 10 / 33 |
| `loop-70` ×1 | 3.5 (3.3–3.8) | 3.7 (3.7–4.9) | 41.3 (38.8–42.9) | 29.2 (28.9–30.0) | 10 / 36 |
| `board-57` ×5 | 7.2 (6.9–7.3) | 7.3 (7.2–7.3) | 36.6 (34.4–37.1) | 33.2 (33.1–33.5) | 10 / 40 |
| `loop-70` ×5 | 3.3 (3.2–3.8) | 4.1 (3.6–4.5) | 43.5 (40.3–44.2) | 30.2 (28.6–31.4) | 10 / 37 |

The combined ceiling is `ceil(max(1.2 × candidate median, 1.1 × candidate max))`.
Existing 10 ms tick limits remain, except `board-57` ×1: the original itself crossed
10 ms, and the same margin rule gives 12 ms. The performance spec reads these
limits from the recorded JSON, rejects a new busiest ID/speed without a baseline,
and checks the full canvas dimensions. All six cases passed three standalone
repetitions at these limits: **18/18 in 11.1 minutes**, without timing overrides.
The source, harness and baseline hashes stayed fixed through the run. The limits
were selected before validation and were not raised again. A future failure
requires investigation, not another margin increase to obtain a pass.

The original combined median exceeds the new limit in all three Loop cases. It
does not in the Funnel cases, where this timing guard catches only larger
regressions. Frozen-state guards separately cap `board-57` at 118 draws and
`loop-70` at 129; the originals make 125 and 130. The shader-churn and resource
checks cover different failure modes. Draw counts alone do not protect every
material-sharing change.

Real-touch timing produces different accepted-action sequences and loads; the
artifact records those counts, busy frames and peak loads for every sample. These
are operational baselines, not matched-state proof of a percentage speedup. In
this saturated software-rendered loop, median ticks per drawn frame are 8 at ×1
and 15 at ×5, so simulation falls behind real time. Complete advance durations
are reported separately and are not the gated proxy. Neither these timings nor
the passing behavioral checks establish physical-phone frame rate, heat or feel.
The earlier asset-invalid or mixed-resolution runs are diagnostic only.

Recheck the gate alone:

```sh
docker compose --profile e2e run --rm e2e npx playwright test tests/e2e/performance.spec.ts --no-deps --workers=1 --repeat-each=3
```

The post-baseline Hint-feedback correction only runs on a Hint request; the
calibration workload never asks for hints. The subsequent harness edits read the
recorded ceilings and assert full canvas dimensions after sampling; they do not
change the timed workload.

## Historical automated checks — 1 November 2026

These results describe the Docker development build on port 5180 (`main`) with
the earlier ninety-level campaign.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | 359 tests pass across 14 files, including every Funnel Sort witness through Rapier physics and every Loop Sort witness through the scripted machine |
| `npm run build` | Pass, with Vite's large-chunk warning for the Three.js and Rapier bundle |
| `scripts/machine-soak.ts` | 30 of 30 Funnel Sort witnesses won with zero nudges, teleports and bounces; the longest took 102 simulated seconds |
| `scripts/loop-soak.ts` | 30 of 30 Loop Sort witnesses won with no rejected taps; the longest took 169 simulated seconds |
| `npx playwright test` | 27 of 28 pass in Chromium with SwiftShader in 21 minutes, including all ninety levels through real touch input in three parallel slices. The instruction-toast test in `tests/e2e/learning.spec.ts` failed under that load and passes alone: its toast's six-second timer can run out before a loaded page checks it |

## Historical replay, models and budgets — 2 November 2026

Recorded when introducing [the development workflow](development-workflow.md).

| Check | Result |
| --- | --- |
| `tests/e2e/replay.spec.ts` | A game played by touch in Chromium replays in Node to the same physics snapshot, run past 500 ticks |
| `bash scripts/check-models.sh` | [Funnel Sort's belt slots](models/funnel-belt/README.md) hold in every config and every deliberate break is caught |
| `tests/machine/slot-invariants.test.ts` | The same guarantees hold on the real machine under seeded arbitrary play, and fail when the code is deliberately broken |
| `npm run build` | First download 1.896 MB gzipped against a 2.000 MB ceiling: page, script, stylesheet and two Latin font files |

**Engine differences.** The first replay test diverged on long runs: Chromium 156's `Math.cos(2.3)` is `-0.6662760212798241` and Node 24's is `-0.666276021279824`, and physics grew that last bit into a different game. Every failing log replayed exactly inside Chromium, which placed the cause. Rules now use `src/engine/exact-math.ts`, built only from operations that are exact in every engine, and lint rejects the `Math` functions that aren't. All thirty witnesses of each conveyor type still win with zero recoveries. Safari and physical phones haven't been checked yet: a log copied from a phone tests that with `scripts/replay.ts`.

**Historical frame cost.** The table below is the early ninety-level measurement, not a baseline for the registered alpha campaign. Its level labels and ceilings belong to that run. The current [performance spec](../tests/e2e/performance.spec.ts) derives its level IDs from registered content; record those IDs, the workload, revision and actual results for a new baseline. It measures the game's own tick/draw work at 4x CPU slowdown in SwiftShader on one development machine. It guards against our code getting slower and doesn't measure a phone. Beside other browsers its timings measure the contention (frame intervals of 750 to 1,470 ms and double the draw time in one full run), so `playwright.config.ts` makes it a separate project that waits for every other test. Frame intervals, 250 to 350 ms here, mostly measure the software renderer, so nothing is claimed about frame rate.

| Level | Tick p50 | Tick and draw p50 | Ceilings: tick, tick and draw |
| --- | --- | --- | --- |
| `board-28`, most marbles | 6.5–7.0 ms | 19.4–23.1 ms | 10 ms, 26 ms |
| `board-30`, longest belt | 6.1–6.6 ms | 19.7–21.4 ms | 10 ms, 26 ms |
| `loop-5`, fullest loop | 0.7–0.8 ms | 12.9–13.6 ms | 10 ms, 26 ms |
| `loop-30`, longest | 1.1–1.4 ms | 14.5–16.3 ms | 10 ms, 26 ms |

At that slowdown a typical tick and draw on the busiest Funnel Sort boards takes more than one 16.7 ms frame. Much of the draw figure is software rendering, so this isn't evidence of a phone problem, but it's the first place to look if one appears.

**Rendering cost — historical November pass.** Older phones ran hot, so that rendering pass measured where drawing time goes before changing anything. Four tools do it, all in SwiftShader on one development machine:

- `scripts/render-profile.mjs` plays the busiest levels at 4x CPU slowdown and reports draw calls, triangles, scene makeup and a CPU profile.
- `scripts/render-ablation.mjs` freezes a busy frame and times GPU-synced draws with one cost removed at a time.
- `scripts/render-cpu.mjs` times the main thread's share of one frame on a tiny canvas, so the software rasteriser stays out of it.
- `scripts/scene-census.mjs` groups a level's meshes by geometry and material.

SwiftShader rasterises on the CPU, so its milliseconds and cost ranking are host diagnostics, not established phone costs. The following measurements and implementation claims describe that historical pass; later release evidence must be recorded separately.

The frozen-frame ablation, before the pass, against the full picture (`board-57`, `loop-61`, `tube-74`):

| Cost removed | Funnel Sort | Loop Sort | Tube Sort |
| --- | --- | --- | --- |
| Pixel ratio 1.5 → 1 | −39% | −43% | −46% |
| Shadows | −23% | −21% | −17% |
| …of which drawing the shadow map | −7% | −7% | −1% |
| …a single-tap shadow lookup instead of five | −18% | −9% | −10% |
| Clearcoat on toy parts, marbles kept | −8% | −7% | −18% |
| Marble spheres at 14×10 | −12% | −14% | — |

Run-to-run noise is about 7%. The pass changed only what draws the same picture: the same frames captured before and after with `scripts/frame-captures.mjs` match pixel for pixel on the toy, apart from the coarser crowd marbles, which differ by under one level in 255 on average and look the same at 3x zoom.

- **Frame pacing.** Display frames under 12.5 ms apart are skipped (`src/engine/pacing.ts`): 120 Hz screens draw at 60 fps, 144 Hz at 72, 90 Hz at 45, and 60 Hz screens draw every frame.
- **Resting boards aren't redrawn.** A runtime may report `still`; Tube Sort does when nothing moves, and the app then draws only after input, a resize or a change. The belts never rest, so conveyor levels still draw every frame.
- **No shader lookups per frame.** Three draws a double-sided transparent material in two passes and rebuilds its shader parameters before each one. The tubes, chute and funnel walls now use two one-sided meshes (`src/engine/glass.ts`), back faces first. Flat glass and the pop rings use one pass.
- **No compiles mid-level.** `Stage.draw` compiles every shader of a new scene, hidden effects included, before its first draw. Before this, the first completion of a level compiled the spark, ring and stamp shaders at the moment it should pay off. Production builds also skip three's shader-log readback, which waits for each compile.
- **Fewer draws.** Each Funnel Sort crate is one mesh, not five. Every box's light pockets share two instanced meshes, one lit and one unlit. Crates, boxes and pattern badges share one material per colour. On `board-57` this took a frame from 189 draw calls to 117.
- **Lighter marbles.** Crowd marbles are 16×12 spheres instead of 22×16, drawn twice a frame because they cast shadows; Tube Sort's larger marbles keep their finer mesh.
- **No layout reads per frame.** `Stage.rect` caches the canvas position until a resize, and the HUD only writes values that changed.
- **Quality steps down sooner.** The pixel ratio steps down when drawn frames average under 40 fps over 2.5 s; it used to wait for 30 fps.

| Measure (frozen busy frame) | Before | After |
| --- | --- | --- |
| `board-57` draw calls, triangles | 189, 196k | 117, 129k |
| `board-57` GPU-synced draw | 325–348 ms | 295 ms |
| `loop-61` triangles, GPU-synced draw | 240k, 401–410 ms | 152k, 369 ms |
| Main-thread render at 4x: Funnel, Loop, Tube | 10.0, 9.8, 6.6 ms | 7.0, 9.4, 5.7 ms |
| HUD refresh at 4x: Funnel, Tube | 0.9, 0.9 ms | 0.1, 0.1 ms |
| Shader programs first compiled after a level loads | 4 | 0 |

The current [render-hygiene spec](../tests/e2e/render-hygiene.spec.ts) covers shader compilation/lookups and resting-board redraws. The historical pass reported the last three measurements above; the spec checks that every material has a compiled shader once a level is first drawn, that no material's shader is looked up on frame after frame, and that a resting Tube Sort board isn't redrawn. Each check failed with its fix removed. `tests/engine/pacing.test.ts` holds the frame rates above.

The owner then accepted four changes to the look, priced by the first table:

- **Pixel ratio 1.25**, stepping down to 1, instead of 1.5.
- **Floors alone receive shadows**: the slab, decks, lanes and belt. Crates, boxes, lorries and tube parts still cast them.
- **One shadow tap**: a single hardware-filtered lookup instead of three's five rotated ones (`src/engine/shadow-filter.ts`), so shadow edges are about one texel wide. The patch throws if a three upgrade changes the shader it replaces, and `tests/engine/shadow-filter.test.ts` holds it.
- **Plain plastic**: toy parts and glass use standard materials. Only the marbles keep clearcoat.

| Same frozen frame | Before the pass, ratio 1.5 | After both steps, ratio 1.25 |
| --- | --- | --- |
| `board-57` | 325–348 ms | 194 ms |
| `loop-61` | 401–410 ms | 227 ms |
| `tube-74` | 252 ms | 140 ms |

## Campaign and authoring

[The registry test](../tests/engine/registry.test.ts) follows the current `PLAY_ORDER` length and order, preserves save IDs and checks that Full spectrum matches orange in board content. IDs carry no round number. In the registered campaign, orange first appears in Funnel Sort round 7 (`board-43`), Loop Sort round 7 (`loop-44`) and Tube Sort round 10 (`tube-44`). `tube-6`, `board-8` and `loop-8` were the introductions in the older banks.

The current Funnel Sort eights are `board-46` and `board-74`; its final three are `board-73` oval, `board-74` eight and `board-75` oval. No Loop Sort eight is registered, though the bank includes eights. Both conveyor games including eights and ending with two of them remains a requirement for the full 120-round target, not a claim about this partial release.

The following recipe commands cover the original banks; the maintained expansion scoring and assembly gates are in [levelling.md](levelling.md). The author scripts provide the rule-level solvability proof for their generated boards. Seeded recipe tables define the candidates and acceptance rules; rejected seeds advance until a candidate passes or the attempt budget is exhausted. Funnel Sort boards 1–2, Loop Sort levels 1–5 and Tube Sort level 1 stay hand-authored, with their guides intact.

| Author script | Generated levels | Acceptance rules |
| --- | --- | --- |
| `scripts/funnel-author.ts`, `FUNNEL_RECIPES` | `board-3`…`board-30` | Random tray and dock orders; exhaustive memoised search over settled rule states must find a winning witness and a losing order. The winning share of complete pour orders must fall in the recipe's `win` band. Column-by-column, round-robin and reverse column-by-column pouring must all jam. The opening in-game hint must return an action within 250 ms. |
| `scripts/loop-author.ts`, `LOOP_RECIPES` | `loop-6`…`loop-30` | Build backwards from solved trucks through mirrored legal moves, then require the same search, witness, losing order, `win` band and opening-hint checks. Lane-by-lane and round-robin tapping must both jam. |
| `scripts/tube-author.ts`, `TUBE_RECIPES` | `tube-2`…`tube-30` | Fix colours, capacity, empties, optional part-full `spread` and a shortest-solution move range. `solveTube` must find a shortest solution in that range within its default in-game search budget and 250 ms. |

Funnel Sort tightens the belt to the least solvable capacity at or above the shape's `MIN_CAPACITY` (oval 14, eight 26, wide eight 30), then adds recipe `slack`. The track is sized to that capacity, and `tests/machine/machine.test.ts` drives every board's jam order to a full belt and checks that every slot is held, evenly spaced, with no two marbles overlapping. Loop Sort tightens in steps of two, with a floor of 20 and room above its starting loop load, then adds `slack` (4 by default). Both cap the result at the recipe's maximum capacity and check the final board again. Exact accepted capacities depend on the generated board.

Random Loop Sort boards are rarely solvable. Its reverse construction brings finished trucks back to the front of a lane, exchanges loop-end marbles between front trucks, exchanges while dropping onto the loop, takes waiting colours from the loop, swaps and merges segments. Between reverse steps the loop holds no colour wanted by a front truck. The exhaustive search still verifies the resulting board.

```sh
docker compose exec -T dev npx tsx scripts/funnel-author.ts stats
docker compose exec -T dev npx tsx scripts/funnel-author.ts emit
docker compose exec -T dev npx tsx scripts/loop-author.ts stats
docker compose exec -T dev npx tsx scripts/loop-author.ts emit
docker compose exec -T dev npx tsx scripts/tube-author.ts batch
docker compose exec -T dev npx tsx scripts/tube-author.ts 5 5 2 1 12 22
```

Append level IDs to conveyor `stats` or `emit` commands to select recipes. `stats` prints one metrics line per accepted recipe. `emit` also prints TypeScript definitions, witness and jam orders, and French titles for pasting into `src/sim/boards.ts` or `src/loop/boards.ts`, `tests/witnesses.ts` and `src/i18n.ts`. Tube `batch` prints definitions with solutions for `src/puzzles/levels.ts` and French titles for `src/i18n.ts`; the single-board form takes colours, capacity, empties, seed, optional minimum and maximum moves, then optional spread. None of these commands writes the board bank itself.

| Metric | Meaning |
| --- | --- |
| `seed` | Accepted seed; generation starts at the recipe seed and advances past rejected candidates. |
| `cap`, `marbles` | Final transport capacity and total rule units to sort. Loop Sort draws each rule unit as rows of three tiny marbles, with more rows for wider slots. |
| `orders`, `win` | Complete terminal action orders counted by the settled-state search, and the rounded percentage that win. Lower winning shares mean harder boards; this is not the share of winning states or a measured player success rate. Loop search excludes branches that revisit a state already on the active path. |
| `lost-states` | Percentage of memoised nonterminal settled states with no winning continuation; distinct from the losing share of complete orders. |
| `hint` | Wall-clock time for the opening in-game hint on the authoring host; candidates over 250 ms or without a hint are rejected. |
| `witness`, `jam` | First winning and losing orders found; letters name supply columns or truck lanes. |
| Tube `moves`, `solve` | Shortest solution length and wall-clock solver time; the trailing time in parentheses covers the whole recipe attempt. |

The scripts' time checks do not establish hint latency on a physical phone. Their solvability proofs concern the rules; machine witnesses and browser journeys verify the corresponding presentation and input. Conveyor witness and jam orders live in `tests/witnesses.ts`, except the first two Loop Sort tutorials deliberately have no losing order. Tube Sort solutions live with the board definitions.

Tube Sort's recipes ramp gently after the player found the early boards too hard. Funnel Sort boards 3–11 and Loop Sort levels 6–11 are re-rolled after most random orders used to win; acceptance now requires a minority of winning orders and tighter capacity.

## Browser scenarios

| Scenario | Evidence |
| --- | --- |
| All registered levels through real touch targets, completion cards, Next level and reload, in bounded parallel slices | [journey.spec.ts](../tests/e2e/journey.spec.ts) |
| All three types reach a stuck or jammed board through real choices and recover through Undo | `tests/e2e/journey.spec.ts` |
| Current-state hints, restart, mute, local progress, storage-denied fallback and keyboard controls | `tests/e2e/journey.spec.ts` |
| Reference upright phone 375×690 and desktop 1365×900 layouts | `tests/e2e/journey.spec.ts` |
| Whole-group touch dragging, invalid drops, cancellation and atomic Undo | `tests/e2e/drag.spec.ts` |
| Tube Sort accepts successive moves before animation finishes | `tests/e2e/overlap.spec.ts` |
| Funnel Sort accepts every crate before motion, keeps overflow in the funnel, drains and undoes. It also holds three marbles behind a full fifteen-marble belt with no rescues. | `tests/e2e/reservoir.spec.ts` |
| Loop Sort explains a refused tap and marks unloading versus waiting for space | `tests/e2e/loop.spec.ts` |
| Every printed number on all registered Loop Sort levels stays readable at the player's 375×690, nothing clips, and the cards print no words | `tests/e2e/loop.spec.ts` |
| The ivory card pours, a waiting card answers without pouring, a card moves up when the lorry ahead leaves, and a `+n` tile opens on one tap | `tests/e2e/loop.spec.ts` |
| Every registered Loop Sort level keeps lorry cards or their folded `+n` tiles on screen and clear of controls at 375×690 and 1365×900 | `tests/e2e/loop.spec.ts` |
| A queued-truck board reports what each lorry carries and what is coming, advances the line through real taps, restores it on Undo and reprints it on a language change | `tests/e2e/loop.spec.ts` |
| Lorry cards release their geometry and textures between levels | `tests/e2e/loop.spec.ts` |
| Picker finger scrolling, same-target slide taps, independent fast-forward holds and release behavior | [input-regressions.spec.ts](../tests/e2e/input-regressions.spec.ts) |
| Latches, short trucks and coupled unloads on bank lessons | [loop-features.spec.ts](../tests/e2e/loop-features.spec.ts) |
| Precompiled shaders, repeated program updates and resting Tube Sort redraws | [render-hygiene.spec.ts](../tests/e2e/render-hygiene.spec.ts) |
| French browser detection, live language switching without resetting the board, and saved language choice | `tests/e2e/learning.spec.ts` |
| Tap-hand introductions on the first three puzzles, invalid taps, completion, replay, skipping, reload, unseen guides on previously completed levels, and reduced-motion support | `tests/e2e/learning.spec.ts` |

`tests/e2e/journey.spec.ts` divides `CAMPAIGN` into bounded slices, so the
number of tests grows with the registry rather than silently covering an old
ninety-level subset. Each level settles before the first tap; some Loop Sort
boards start by collecting from the ring. Each slice checks completion and reload
persistence; the final slice checks the campaign completion card. The picker
scrolls when its chips do not fit. Locator clicks scroll automatically, so only
the real finger-scroll regression establishes that a player can swipe it. Tube
Sort jam recovery and alternative hint openings are chosen from legal rules,
rather than assuming an old ID still occupies the same campaign round.

The browser tests set the game clock by hand. They check behavior and layout, not frame rate on a phone. The table describes test coverage; the recorded pass totals above predate the expanded campaign.

The polish regression tests cover retired-level save fallback, lorry goal stability during pouring and undo, Funnel Sort controls following the exposed tray, disappearing when empty and returning on undo, and hold-to-fast-forward: three ticks per frame only while the button or the `f` key is held, release off the button through pointer capture, and no acceleration once a level has ended.

## Physics and capacity

`tests/machine/machine.test.ts` plays every Funnel Sort witness through real Rapier physics and requires zero nudges and teleports. It also covers a physical jam, belt capacity, the time a quick player takes and undo during a pour. Each board gets one scripted run, not a randomized soak. A spacing test pours three crates in quick succession and checks, every tick, that riders never come closer than one marble spacing, that every marble lands within 0.3 units of the chute mouth, and that nothing slides along the belt after landing; before the slot reservation the worst slide was 2.15 units.

`tests/loop/machine.test.ts` plays every Loop Sort witness through the scripted loop and checks that a full loop has no visible gap. These runs also catch an earlier stall, where free capacity never lined up with a truck's open end.

The first two Loop Sort levels accept all intended opening pours without waiting for loop capacity. Their machine tests require a completed exchange within twelve simulated seconds and no pause longer than half a second while pouring.

Figure-eight levels share their sampled path between transport and rendering. Path tests check arc-length spacing and separate heights at the crossing; the Funnel Sort machine test follows real riders across both passes without swapping branches. The campaign journey covers their winning touch orders.

The smaller Funnel Sort hopper uses the same four tapered faces for its mesh and collision panels. The earlier seven-board physical run completed with zero nudges, teleports and bounces after the geometry change. A separate rapid-pour check released every crate on those boards, one row every quarter-second; all seven completed with zero recoveries. These historical runs do not establish coverage of the expanded bank.

The dish and crate shelf were later lifted clear of the figure-eight bridge ramps, with a clear chute from the neck to the belt entry; on an eight the entry sits on the lower pass before the bridge. The recorded `scripts/machine-soak.ts` run completed the seven witnesses with zero recoveries after the lift. The script plays the registered Funnel Sort bank and requires a fresh run for the expansion.

The recorded departure check covered every truck in the earlier seven Loop Sort witnesses: both bay rows stayed above the deck and shrank away before disappearing. The former departure path sank through the platform and disappeared at full scale.

## Accessibility

The player asked for plain glossy marbles in natural colors. Yellow and green are separated by brightness as well as hue. Crates, boxes, cargo blocks and hints carry ring, diamond, triangle, star, cross, three-dot and heart patterns, and the legend sits in the level picker.

Tube Sort now has a pattern rail with one marker per occupied slot. Lorry cabs carry a permanent final-color roof marker. Historical captures, including grayscale, are in `output/current/polish`; new layout checks use the reference upright phone and desktop. The player still needs to judge readability at their own phone size.

## Rendering checks

`node scripts/polish-live.mjs` drives Loop Sort with the real browser clock and checks that geometry and texture counts stay stable through repeated level changes. Hidden marbles are excluded from instance draws; lorry body details are batched by material, and wheels and completion sparks are instanced. These checks use SwiftShader and do not establish a phone frame rate.

Loop Sort's layout was chosen with a four-model panel at the player's request, and revised after the player tried versions on their phone; proposals, mock-ups and critiques are in `output/current/panel/`. Percentages sit in the lorry cards, drawn by the browser. Current layout and folding are computed by `rosterLayout`; the browser spec measures printed numbers on every registered level at 375×690. The earlier capture set showed 13 CSS px numbers with no folded cards; that is a historical observation.

`tests/loop/machine.test.ts` follows live runtime hints to the end and replays the authored losing orders through the real machine on the boards in its test set, so rule-level claims are held to what happens in play.

Funnel Sort crates and boxes interpolate between simulation steps, as the marbles and Loop Sort lorries do. The ground is one gradient plane with no props; belt motion is one textured strip per board whose plates scroll with belt travel, so there are no per-marker draws for movement. Completion stamps are pooled and perimeter lighting is steady. Undo clears the stamps and particles.

The phone camera fits and centres the projected playable bounds, with a steeper viewing angle and longer figure-eight lorry bays. The historical `scripts/learning-captures.mjs` captures sampled nine sightlines per cab marker on the original two figure-eight Loop Sort boards. The script uses fixed campaign indices, so it is not proof of current Loop Sort eights or complete campaign coverage. Use the current language and resource browser specs for release coverage; inspect its selected IDs before using those captures as evidence.

## Screenshots and video

- `scripts/inspect-feedback.mjs` captures every level on a phone, plus grayscale and desktop views of the first level of each type, under `output/current`.
- `scripts/capture-feedback.mjs` records silent 24fps frames of touch dragging, overlapping funnel pours and a truck pour under `output/current/video-frames`.
- `scripts/learning-captures.mjs` writes selected tap-icon and scene captures under `output/current/learning`; its fixed indices do not establish current bridge coverage.
- `scripts/peek.mjs <levelIndex>` captures one level on phone and desktop under `output/current/peek`.
- `scripts/arcade-captures.mjs` captures the yard, completions and truck departures at phone and desktop sizes under `output/current/arcade`, with grayscale phone views and projected departure bounds checks.

Git ignores these files. `output/poc9` and the clips and frames in `output/poc12` are still there. Browser test runs during this rework overwrote the `campaign-level*`, `320-level*` and `1365-level*` PNGs in `output/poc12`, so those files now show rework boards. The specs now write to `output/current`.

## Project verification skill

The [verification skill](../.claude/skills/verify-tumbleworks/SKILL.md) drives real
touches and stores screenshots, inspected state, full game fingerprints and
verdicts under `output/current/verify/<run>/`. Launch and cleanup require the same
unique run ID and use exact-container leases to preserve existing processes.
The controls journey compares accepted action, Undo and Restart at precise
manual-clock boundaries. Its `render` journey settles after every tap: it is a
**settled scene census**, labelled as such in the result, with `busy` and
`settling` recorded. It provides no busy-frame timing or phone-performance proof.

## Limits

An unfinished board restarts on reload. Completed levels, the selected level, mute, language and guide completion stay in local storage, and there is no cloud save. A playtest still has to check frame rate on a phone, the sound, whether the player can tell the colors apart at real screen size, and level difficulty.
