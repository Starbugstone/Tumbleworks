# POC verification

The recorded check results below are from 1 November 2026 against the Docker development build on port 5180 (`main`) with the ninety-level campaign.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | 226 tests pass across 13 files, including every Funnel Sort witness through Rapier physics and every Loop Sort witness through the scripted machine |
| `npm run build` | Pass, with Vite's large-chunk warning for the Three.js and Rapier bundle |
| `scripts/machine-soak.ts` | 30 of 30 Funnel Sort witnesses won with zero nudges, teleports and bounces; the longest took 75 simulated seconds |
| `scripts/loop-soak.ts` | 30 of 30 Loop Sort witnesses won with no rejected taps; the longest took 169 simulated seconds |
| `npx playwright test` | 20 journeys pass in Chromium with SwiftShader in 23 minutes, including all ninety levels through real touch input in three parallel slices (18 to 22 minutes each) |

## Campaign and authoring

The campaign contains thirty levels of each type, ninety total, interleaved by round as `board-n`, `loop-n`, `tube-n`. `tests/engine/registry.test.ts` expects all ninety IDs in order, preserves existing save IDs and checks that Full spectrum matches orange in the board content. Orange first appears in `tube-6`, then `board-8` and `loop-8`; later boards without orange keep another difficulty tier.

The author scripts provide the rule-level solvability proof for every generated board. Seeded recipe tables define the candidates and acceptance rules; rejected seeds advance until a candidate passes or the attempt budget is exhausted. Funnel Sort boards 1–2, Loop Sort levels 1–7 and Tube Sort level 1 stay hand-authored, with their guides intact.

| Author script | Generated levels | Acceptance rules |
| --- | --- | --- |
| `scripts/funnel-author.ts`, `FUNNEL_RECIPES` | `board-3`…`board-30` | Random tray and dock orders; exhaustive memoised search over settled rule states must find a winning witness and a losing order. The winning share of complete pour orders must fall in the recipe's `win` band. Column-by-column, round-robin and reverse column-by-column pouring must all jam. The opening in-game hint must return an action within 250 ms. |
| `scripts/loop-author.ts`, `LOOP_RECIPES` | `loop-6`…`loop-30` | Build backwards from solved trucks through mirrored legal moves, then require the same search, witness, losing order, `win` band and opening-hint checks. Lane-by-lane and round-robin tapping must both jam. |
| `scripts/tube-author.ts`, `TUBE_RECIPES` | `tube-2`…`tube-30` | Fix colours, capacity, empties, optional part-full `spread` and a shortest-solution move range. `solveTube` must find a shortest solution in that range within its default in-game search budget and 250 ms. |

Funnel Sort tightens the belt to the least solvable capacity at or above one full tray plus three, then adds recipe `slack`. Loop Sort tightens in steps of two, with a floor of 20 and room above its starting loop load, then adds `slack` (4 by default). Both cap the result at the recipe's maximum capacity and check the final board again. Exact accepted capacities depend on the generated board.

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
| All ninety levels through real touch targets, completion cards, Next Level and reload, in three parallel slices | `tests/e2e/journey.spec.ts` |
| All three types lose through real choices and recover through Undo | `tests/e2e/journey.spec.ts` |
| Current-state hints, restart, mute, local progress, storage-denied fallback and keyboard controls | `tests/e2e/journey.spec.ts` |
| Desktop 1365×900 and narrow phone 320×700 layouts | `tests/e2e/journey.spec.ts` |
| Whole-group touch dragging, invalid drops, cancellation and atomic Undo | `tests/e2e/drag.spec.ts` |
| Tube Sort accepts successive moves before animation finishes | `tests/e2e/overlap.spec.ts` |
| Funnel Sort accepts every crate before motion, keeps overflow in the funnel, drains and undoes. It also holds three marbles behind a full fifteen-marble belt with no rescues. | `tests/e2e/reservoir.spec.ts` |
| Loop Sort explains a refused tap and marks unloading versus waiting for space | `tests/e2e/loop.spec.ts` |
| French browser detection, live language switching without resetting the board, and saved language choice | `tests/e2e/learning.spec.ts` |
| Tap-hand introductions on the first three puzzles, invalid taps, completion, replay, skipping, reload, unseen guides on previously completed levels, and reduced-motion support | `tests/e2e/learning.spec.ts` |

`tests/e2e/journey.spec.ts` divides the campaign into three slices with `test.describe.configure({ mode: 'parallel' })`, so one worker does not play all ninety levels. Each level is left to come to rest before its first tap (some Loop Sort boards open with a truck filling from the ring and leaving), and a tap is retried only when the board did not react at all, with diagnostics logged. Each slice checks completion and reload persistence; the final slice checks the campaign completion card. The level picker scrolls when its ninety chips do not fit. The Tube Sort jam-recovery journey finds a legal one-move jam from the rules instead of hard-coding `tube-3`. Tube hint tests choose an alternative solvable opening from the rules when one exists, falling back to the authored opening.

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

The player asked for plain glossy marbles in natural colors. Yellow and green are separated by brightness as well as hue. Crates, boxes, cargo blocks and hints carry ring, diamond, triangle, star and cross patterns, and the legend sits in the level picker.

Tube Sort now has a pattern rail with one marker per occupied slot. Lorry cabs carry a permanent final-color roof marker. Phone, narrow and desktop captures, including grayscale, are in `output/current/polish`. The player still needs to judge readability at their own phone size.

## Rendering checks

`node scripts/polish-live.mjs` drives Loop Sort with the real browser clock and checks that geometry and texture counts stay stable through repeated level changes. Hidden marbles are excluded from instance draws; lorry body details are batched by material, and wheels and completion sparks are instanced. These checks use SwiftShader and do not establish a phone frame rate.

Funnel Sort crates and boxes interpolate between simulation steps, as the marbles and Loop Sort lorries do. The ground is one gradient plane with no props; belt motion is one textured strip per board whose plates scroll with belt travel, so there are no per-marker draws for movement. Completion stamps are pooled and perimeter lighting is steady. Undo clears the stamps and particles.

The phone camera fits and centres the projected playable bounds, with a steeper viewing angle and longer figure-eight lorry bays. `scripts/learning-captures.mjs` samples nine sightlines per cab marker on the original two figure-eight Loop Sort boards at phone, narrow and desktop sizes. It also checks stable geometry/texture counts across language and scene changes, the French completion card, and switching language while that card is open.

## Screenshots and video

- `scripts/inspect-feedback.mjs` captures every level on a phone, plus grayscale and desktop views of the first level of each type, under `output/current`.
- `scripts/capture-feedback.mjs` records silent 24fps frames of touch dragging, overlapping funnel pours and a truck pour under `output/current/video-frames`.
- `scripts/learning-captures.mjs` captures the tap icons, the original four bridge levels, French menu and completion card under `output/current/learning`.
- `scripts/peek.mjs <levelIndex>` captures one level on phone and desktop under `output/current/peek`.
- `scripts/arcade-captures.mjs` captures the yard, completions and truck departures at three viewport sizes under `output/current/arcade`, with grayscale phone views and projected departure bounds checks.

Git ignores these files. `output/poc9` and the clips and frames in `output/poc12` are still there. Browser test runs during this rework overwrote the `campaign-level*`, `320-level*` and `1365-level*` PNGs in `output/poc12`, so those files now show rework boards. The specs now write to `output/current`.

## Limits

An unfinished board restarts on reload. Completed levels, the selected level, mute, language and guide completion stay in local storage, and there is no cloud save. A playtest still has to check frame rate on a phone, the sound, whether the player can tell the colors apart at real screen size, and level difficulty.
