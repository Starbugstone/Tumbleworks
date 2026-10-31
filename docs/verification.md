# POC verification

Checked on 31 October 2026 against the Docker development build on port 5180 (`main`), after initial isolated verification on port 5181. [AGENTS.md](../AGENTS.md) holds the permanent names and development requirements.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | 85 tests pass across 11 files |
| `npm run build` | Pass, with Vite's large-chunk warning for the Three.js and Rapier bundle |
| `npx playwright test` | 12 journeys pass in Chromium with SwiftShader, using real touch and keyboard input |

## Browser scenarios

| Scenario | Evidence |
| --- | --- |
| All thirteen levels through real touch targets, completion cards, Next Level and reload | `tests/e2e/journey.spec.ts` |
| All three types lose through real choices and recover through Undo | `tests/e2e/journey.spec.ts` |
| Current-state hints, restart, mute, local progress, storage-denied fallback and keyboard controls | `tests/e2e/journey.spec.ts` |
| Desktop 1365×900 and narrow phone 320×700 layouts | `tests/e2e/journey.spec.ts` |
| Whole-group touch dragging, invalid drops, cancellation and atomic Undo | `tests/e2e/drag.spec.ts` |
| Tube Sort accepts successive moves before animation finishes | `tests/e2e/overlap.spec.ts` |
| Funnel Sort accepts every crate before motion, keeps overflow in the funnel, drains and undoes. It also holds three marbles behind a full fifteen-marble belt with no rescues. | `tests/e2e/reservoir.spec.ts` |
| Loop Sort explains a refused tap and marks unloading versus waiting for space | `tests/e2e/loop.spec.ts` |

The browser tests set the game clock by hand. They check behavior and layout, not frame rate on a phone.

The polish regression tests cover retired-level save fallback and lorry goal stability during pouring and undo.

## Physics and capacity

`tests/machine/machine.test.ts` plays every Funnel Sort witness through real Rapier physics and requires zero nudges and teleports. It also covers a physical jam, belt capacity, the time a quick player takes and undo during a pour. Each board gets one scripted run, not a randomized soak.

`tests/loop/machine.test.ts` plays every Loop Sort witness through the scripted loop and checks that a full loop has no visible gap. These runs also catch an earlier stall, where free capacity never lined up with a truck's open end.

## Accessibility

The player asked for plain glossy marbles in natural colors. Yellow and green are separated by brightness as well as hue. Crates, boxes, cargo blocks and hints carry ring, diamond, triangle and star patterns, and the legend sits in the level picker.

Tube Sort now has a pattern rail with one marker per occupied slot. Lorry cabs carry a permanent final-color roof marker. Phone, narrow and desktop captures, including grayscale, are in `output/current/polish`. The player still needs to judge readability at their own phone size.

## Rendering checks

`node scripts/polish-live.mjs` drives Loop Sort with the real browser clock and checks that geometry and texture counts stay stable through repeated level changes. Hidden marbles are excluded from instance draws; lorry body details are batched by material, and wheels and completion sparks are instanced. These checks use SwiftShader and do not establish a phone frame rate.

## Screenshots and video

- `scripts/inspect-feedback.mjs` captures every level on a phone, plus grayscale and desktop views of the first level of each type, under `output/current`.
- `scripts/capture-feedback.mjs` records silent 24fps frames of touch dragging, overlapping funnel pours and a truck pour under `output/current/video-frames`.
- `scripts/peek.mjs <levelIndex>` captures one level on phone and desktop under `output/current/peek`.

Git ignores these files. `output/poc9` and the clips and frames in `output/poc12` are still there. Browser test runs during this rework overwrote the `campaign-level*`, `320-level*` and `1365-level*` PNGs in `output/poc12`, so those files now show rework boards. The specs now write to `output/current`.

## Limits

An unfinished board restarts on reload. Completed levels, the selected level and mute stay in local storage, and there is no cloud save. A playtest still has to check frame rate on a phone, the sound, whether the player can tell the colors apart at real screen size, and level difficulty.
