# Nine-level POC verification

Verified 31 October 2026 (Europe/Paris), using the Docker dev build on port 5180 and a successful production build.

## Automated checks

- `docker compose exec -T dev npm test`: 104 passing tests across rules, level witnesses, current-state hints, physics, camera framing, extension registration and saving.
- `docker compose exec -T dev npm run typecheck`: pass.
- `docker compose exec -T dev npm run build`: pass. Vite emits its advisory large-chunk warning for the Three.js/Rapier bundle.
- Five browser journeys pass in the complete journey run; the added keyboard journey passes in its targeted run. All use real browser input and the actual game runtime.

## Browser scenarios

| Scenario | Result |
| --- | --- |
| Complete all nine boards through touch hit targets and Next level | Pass |
| Each gameplay's actual jam, shared Undo, and tray seventh-slot triple recovery | Pass |
| Current-state hint without auto-playing, restart, mute and selected-level reload | Pass |
| Desktop 1365×900 and narrow phone 320×700 board targets and controls | Pass |
| Storage write denial preserves in-session completion and permits Next level | Pass |
| Keyboard selection after a level-navigation click, transfer, undo and hint | Pass |

The browser runner uses Chromium/SwiftShader and explicitly advances the real fixed simulation clock between inputs. This is functional and layout evidence, not a physical-phone frame-rate measurement. The player save is isolated from every test context.

## Physics and extension evidence

The conveyor soak covers 192 varied games, including undo, across all three conveyor boards: zero nudges and zero teleports. The shared landing tests cover real floor contact at several drop heights. A synthetic fourth gameplay pack integrates with the same registry and services, exercises input, completion, undo, drawing and disposal, and requires no change to App, MarbleFactory or PhysicsService.

## Visual evidence

`scripts/inspect-poc.mjs` captures all nine phone-sized boards and representative desktop boards, with zero page errors. `scripts/capture-video.mjs` records the three introductory boards followed by previews of the remaining difficulties. Local evidence is under `output/poc9` (ignored by Git and reproducible with the scripts).

## Limits

- Current attempts restart after reload; completion, level selection and mute persist locally.
- Physical-phone frame rate and listening quality need an actual device playtest.
- The three difficulty steps are authored and solver-verified; player difficulty and enjoyment still need playtesting.
