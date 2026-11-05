# Level picker and progress

The level pill opens the picker: the campaign's chips grouped into chapters with completion counts, the level's title and difficulty, the pattern legend, the language switch and a button that copies the current game for a bug report. Completion is stored on the device and Next level skips completed levels.

## Sub-features

- `picker-open` the pill opens and closes the picker.
- `picker-choose` a chip opens its level.
- `progress-store` a win marks the chip ✓ and survives a reload.
- `next-level` the win card's Next level goes to the next unfinished level.
- `language` English and French switch without restarting the puzzle; the game names stay as brands.
- `replay-copy` "Copy this game for a bug report" copies a replay log that `scripts/replay.ts` plays back.

## How to get to it (user POV)

- Tap the level pill (top left, `#levels-toggle`).
- Win a level and press `Next level` on the card.

## Driving it with tw

Preconditions:

- `scripts/doctor.sh` passes.

- **Picker and language.** Run `tw picker --run <id>`. Every level is listed, the legend has a pattern per colour, `Français` relabels Undo as `Annuler`, and a chip opens its level.
- **Stored completion.** Run `tw win board-1 --run <id>`. `localStorage["tumbleworks.progress.v1"]` lists `board-1`, and after a reload its chip reads ✓.
- **Replay.** Not scripted in `tw` yet: `tests/e2e/replay.spec.ts` copies a game by touch and replays it in Node.
- **Finger scrolling.** [`tests/e2e/input-regressions.spec.ts`](../../../../tests/e2e/input-regressions.spec.ts) swipes the picker's actual scroll area with touch. `tw picker` checks chips and language; clicking a chip through a locator does not prove finger scrolling.

## Gotchas

- Each journey starts from empty storage, so Next level after a single win goes to the following level; with earlier wins stored it skips them.
- French is chosen automatically when the browser prefers it; the journeys run with an English browser.
- The level pill's accessible name is the level's title, not "Levels"; use `#levels-toggle`.
