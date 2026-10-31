# POC verification

Checked on 31 October 2026 against the Docker development build on port 5180. [AGENTS.md](../AGENTS.md) holds the permanent names and development requirements.

## Automated checks

| Check | Result |
| --- | --- |
| `npm run typecheck` | Pass |
| `npm test` | 109 tests pass across 11 files |
| `npm run build` | Pass, with Vite's large-chunk warning for the Three.js and Rapier bundle |
| `npx playwright test` | 10 journeys pass in Chromium with SwiftShader, using separate saves and real touch and keyboard input |

## Browser scenarios

| Scenario | Evidence |
| --- | --- |
| All nineteen levels through real touch targets, completion cards, Next Level and reload | `tests/e2e/journey.spec.ts` |
| All five types lose through real choices and recover through Undo | `tests/e2e/journey.spec.ts` |
| Current-state hints, restart, mute, local progress, storage-denied fallback and keyboard controls | `tests/e2e/journey.spec.ts` |
| Desktop 1365×900 and narrow phone 320×700 layouts | `tests/e2e/journey.spec.ts` |
| Whole-group touch dragging, invalid drops, cancellation and atomic Undo | `tests/e2e/drag.spec.ts` |
| Tube Sort, Tray Match and Connected Match accept successive moves before animation finishes | `tests/e2e/overlap.spec.ts` |
| Funnel Sort accepts every crate before motion, keeps overflow in the funnel, drains and undoes. It also holds three marbles behind a full fifteen-marble belt with no rescues. | `tests/e2e/reservoir.spec.ts` |
| Loop Sort explains a refused tap: full loop, pour in progress, one-color truck | `tests/e2e/loop.spec.ts` |

The browser tests set the game clock by hand. They check behavior and layout, not frame rate on a phone.

## Physics and capacity

`tests/machine/machine.test.ts` plays every Funnel Sort witness through real Rapier physics and requires zero nudges and teleports. It also covers a physical jam, belt capacity, the time a quick player takes and undo during a pour. Each board gets one scripted run, not a randomized soak.

`tests/loop/machine.test.ts` plays every Loop Sort witness through the scripted loop and checks that a full loop has no visible gap. These runs also catch an earlier stall, where free capacity never lined up with a truck's open end.

## Accessibility

The player asked for plain glossy marbles in natural colors. Yellow and green are separated by brightness as well as hue. Crates, boxes, cargo blocks and hints carry ring, diamond, triangle and star patterns, and the legend sits in the level picker.

Open gap: marbles in Tube Sort, Tray Match and Connected Match sit outside labeled containers, so color is now their main cue on the board. The player has not yet judged those types without marble patterns.

## Screenshots and video

- `scripts/inspect-feedback.mjs` captures every level on a phone, plus grayscale and desktop views of the first level of each type, under `output/current`.
- `scripts/capture-feedback.mjs` records silent 24fps frames of touch dragging, rapid rack picks, connected clearing, overlapping funnel pours and a truck pour under `output/current/video-frames`.
- `scripts/peek.mjs <levelIndex>` captures one level on phone and desktop under `output/rework`.

Git ignores these files. `output/poc9` and the clips and frames in `output/poc12` are still there. Browser test runs during this rework overwrote the `campaign-level*`, `320-level*` and `1365-level*` PNGs in `output/poc12`, so those files now show rework boards. The specs now write to `output/current`.

## Limits

An unfinished board restarts on reload. Completed levels, the selected level and mute stay in local storage, and there is no cloud save. A playtest still has to check frame rate on a phone, the sound, whether the player can tell the colors apart at real screen size, and level difficulty.
