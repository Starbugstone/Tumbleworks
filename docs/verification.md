# POC verification

Checked on 31 October 2026 against the Docker development build on port 5180 (`main`), after initial isolated verification on port 5181. [AGENTS.md](../AGENTS.md) holds the permanent names and development requirements.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | 97 tests pass across 13 files |
| `npm run build` | Pass, with Vite's large-chunk warning for the Three.js and Rapier bundle |
| `npx playwright test` | 16 journeys pass in Chromium with SwiftShader, using real touch and keyboard input |

Campaign/layout journeys and the final guide/control regressions were run in separate batches.

## Browser scenarios

| Scenario | Evidence |
| --- | --- |
| All seventeen levels through real touch targets, completion cards, Next Level and reload | `tests/e2e/journey.spec.ts` |
| All three types lose through real choices and recover through Undo | `tests/e2e/journey.spec.ts` |
| Current-state hints, restart, mute, local progress, storage-denied fallback and keyboard controls | `tests/e2e/journey.spec.ts` |
| Desktop 1365×900 and narrow phone 320×700 layouts | `tests/e2e/journey.spec.ts` |
| Whole-group touch dragging, invalid drops, cancellation and atomic Undo | `tests/e2e/drag.spec.ts` |
| Tube Sort accepts successive moves before animation finishes | `tests/e2e/overlap.spec.ts` |
| Funnel Sort accepts every crate before motion, keeps overflow in the funnel, drains and undoes. It also holds three marbles behind a full fifteen-marble belt with no rescues. | `tests/e2e/reservoir.spec.ts` |
| Loop Sort explains a refused tap and marks unloading versus waiting for space | `tests/e2e/loop.spec.ts` |
| French browser detection, live language switching without resetting the board, and saved language choice | `tests/e2e/learning.spec.ts` |
| Tap-hand introductions on the first three puzzles, invalid taps, completion, replay, skipping, reload, unseen guides on previously completed levels, and reduced-motion support | `tests/e2e/learning.spec.ts` |

The browser tests set the game clock by hand. They check behavior and layout, not frame rate on a phone.

The polish regression tests cover retired-level save fallback, lorry goal stability during pouring and undo, and Funnel Sort controls following the exposed tray, disappearing when empty and returning on undo.

## Physics and capacity

`tests/machine/machine.test.ts` plays every Funnel Sort witness through real Rapier physics and requires zero nudges and teleports. It also covers a physical jam, belt capacity, the time a quick player takes and undo during a pour. Each board gets one scripted run, not a randomized soak.

`tests/loop/machine.test.ts` plays every Loop Sort witness through the scripted loop and checks that a full loop has no visible gap. These runs also catch an earlier stall, where free capacity never lined up with a truck's open end.

The first two Loop Sort levels accept all intended opening pours without waiting for loop capacity. Their machine tests require a completed exchange within twelve simulated seconds and no pause longer than half a second while pouring.

The four figure-eight levels share their sampled path between transport and rendering. Path tests check arc-length spacing and separate heights at the crossing; the Funnel Sort machine test follows real riders across both passes without swapping branches. All four levels also have winning touch journeys.

The smaller Funnel Sort hopper uses the same four tapered faces for its mesh and collision panels. All seven physical witnesses require zero nudges, teleports and bounces after the geometry change. A separate rapid-pour check released every crate on each board, one row every quarter-second; all seven completed with zero recoveries.

The departure test checks every truck in all seven Loop Sort witnesses: both bay rows stay above the deck and shrink away before disappearing. The former departure path sank through the platform and disappeared at full scale.

## Accessibility

The player asked for plain glossy marbles in natural colors. Yellow and green are separated by brightness as well as hue. Crates, boxes, cargo blocks and hints carry ring, diamond, triangle and star patterns, and the legend sits in the level picker.

Tube Sort now has a pattern rail with one marker per occupied slot. Lorry cabs carry a permanent final-color roof marker. Phone, narrow and desktop captures, including grayscale, are in `output/current/polish`. The player still needs to judge readability at their own phone size.

## Rendering checks

`node scripts/polish-live.mjs` drives Loop Sort with the real browser clock and checks that geometry and texture counts stay stable through repeated level changes. Hidden marbles are excluded from instance draws; lorry body details are batched by material, and wheels and completion sparks are instanced. These checks use SwiftShader and do not establish a phone frame rate.

Funnel Sort crates and boxes interpolate between simulation steps, as the marbles and Loop Sort lorries do. The arcade yard batches repeated trim, keeps perimeter lighting steady and pools completion stamps. Undo clears the stamps and particles.

The phone camera fits and centres the projected playable bounds, with a steeper viewing angle and longer figure-eight lorry bays. `scripts/learning-captures.mjs` samples nine sightlines per cab marker on both figure-eight Loop Sort boards at phone, narrow and desktop sizes. It also checks stable geometry/texture counts across language and scene changes, the French completion card, and switching language while that card is open.

## Screenshots and video

- `scripts/inspect-feedback.mjs` captures every level on a phone, plus grayscale and desktop views of the first level of each type, under `output/current`.
- `scripts/capture-feedback.mjs` records silent 24fps frames of touch dragging, overlapping funnel pours and a truck pour under `output/current/video-frames`.
- `scripts/learning-captures.mjs` captures the tap icons, four bridge levels, French menu and completion card under `output/current/learning`.
- `scripts/peek.mjs <levelIndex>` captures one level on phone and desktop under `output/current/peek`.
- `scripts/arcade-captures.mjs` captures the yard, completions and truck departures at three viewport sizes under `output/current/arcade`, with grayscale phone views and projected departure bounds checks.

Git ignores these files. `output/poc9` and the clips and frames in `output/poc12` are still there. Browser test runs during this rework overwrote the `campaign-level*`, `320-level*` and `1365-level*` PNGs in `output/poc12`, so those files now show rework boards. The specs now write to `output/current`.

## Limits

An unfinished board restarts on reload. Completed levels, the selected level, mute, language and guide completion stay in local storage, and there is no cloud save. A playtest still has to check frame rate on a phone, the sound, whether the player can tell the colors apart at real screen size, and level difficulty.
