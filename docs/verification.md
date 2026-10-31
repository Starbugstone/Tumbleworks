# Twelve-level POC verification

Verified 31 October 2026 (Europe/Paris), Docker development build on port 5180. Canonical names and development requirements are in [AGENTS.md](../AGENTS.md).

## Automated checks

- Full unit suite: **140 tests pass across 16 files**.
- TypeScript check and production build: pass. Vite retains its advisory large-chunk warning for the Three.js/Rapier bundle.
- Browser suite: **nine journeys pass**, using Chromium/SwiftShader, isolated saves and real browser touch/keyboard input.

## Browser scenarios

| Scenario | Evidence |
| --- | --- |
| All twelve levels through real touch targets, completion cards, Next Level and reload | `tests/e2e/journey.spec.ts` |
| All four types lose through real choices and recover through Undo | `tests/e2e/journey.spec.ts` |
| Current-state hints, restart, mute, local progress, storage-denied fallback and keyboard controls | `tests/e2e/journey.spec.ts` |
| Desktop 1365×900 and narrow phone 320×700 layouts | `tests/e2e/journey.spec.ts` |
| Whole-group touch dragging, invalid drops, cancellation and atomic Undo | `tests/e2e/drag.spec.ts` |
| Tube Sort, Tray Match and Connected Match accept successive moves before animation finishes | `tests/e2e/overlap.spec.ts` |
| Funnel Sort accepts all dumps before motion, preserves backlog, drains, undoes and holds six extra marbles behind a genuinely full twelve-marble belt | `tests/e2e/reservoir.spec.ts` |

The browser tests advance the real fixed simulation clock explicitly. They verify functionality and layout; they do not measure a physical phone's frame rate.

## Gravity and capacity

The gravity regression first reproduced an airborne belt entry at center height 3.534 versus a belt rest height of 2.6, and a held marble skipping its fall. The fix requires Rapier floor contact near rest height before admission. Waiting marbles resume as dynamic bodies at their current poses, fall through multiple ticks, then make a short horizontal slot merge. The artificial upward hop and reservoir row compaction are removed.

`tests/machine/gravity.test.ts` observes real bodies and floor contacts for all thirty marbles in a burst, verifies descent before admission and rejects bulk held-group admission. Reservoir tests cover overlapping supply trays, zero/15/45-tick bursts, stable full-belt jams, complete physical Undo and the final box swap before idle. Holding positions remain scripted; the release fall uses gravity. Belt transport and box delivery stay scripted.

The physical soak covers 192 varied runs across the three Funnel Sort boards, including Undo, with zero nudges and teleports. Another 1,000 seeded logical callback schedules preserve FIFO outcomes and capacity. Existing settled winning/jam trees remain valid.

## Accessibility and extension

All marble actors share the same factory and repeated surface textures: rings, diamonds, triangles and stars. Textures rotate with the model and remain in the lower-quality material. The player rejected large camera-facing badges; those are absent. Supply trays and receiving boxes carry the corresponding symbol on their faces, with a second mark on the receiving floor. Hints name the pattern as well as color.

Phone captures cover all twelve boards; grayscale and solid-material grayscale captures cover the four introductory modes. Browser capture diagnostics contain zero page errors, console errors and failed requests. A synthetic fifth gameplay pack still registers and runs without gameplay branches in App or copies of shared entities/physics.

## Reproducible visual evidence

- `scripts/inspect-feedback.mjs`: twelve phone boards, representative desktop layouts and grayscale checks, under `output/poc12`.
- `scripts/capture-feedback.mjs`: silent 24fps fixed-clock clip of touch dragging, rapid rack picks, connected clearing and overlapping funnel dumps.
- `output/poc12/tumbleworks-four-modes.mp4`: encoded 10.5-second clip.

Output artifacts are ignored by Git. Historical `output/poc9` evidence remains available.

## Limits

Attempts restart on reload; completion, selected level and mute persist locally. There is no cloud save. Physical-phone frame rate, listening quality, pattern recognition at actual screen size and whether the three difficulty steps feel enjoyable still need player feedback.
