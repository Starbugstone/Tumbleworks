# Level picker and progress

The level pill opens the picker: the campaign's chips grouped into chapters with completion counts, the level's title and difficulty, the pattern legend, the language switch and a button that copies the current game for a bug report. Completion is stored by stable ID. Next level resumes an unfinished puzzle within the accepted stop, or steps to the next game in order when a completed stop is being replayed; finishing that stop returns to the village map. A win fires confetti together with the board's own corner fountains.

## Sub-features

- `picker-open` the pill opens and closes the picker.
- `picker-choose` a chip opens its level.
- `progress-store` a win marks the chip ✓ and survives a reload.
- `next-level` the win card's Next level continues within the accepted three-game stop. It cannot cross into the next stop; that needs a map tap.
- `return-map` Valley map (`#map-open`) in the picker returns to the village.
- `map-peek` returning from the village to the current unfinished campaign puzzle retains its accepted moves and Undo in memory. Reloading the page still restarts that unfinished puzzle.
- `play-frontier` the map's Play next level button resumes the campaign frontier, including when viewing an earlier location; the picker remains free-browse access.
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

- Each journey starts from empty storage. If a picker visit opens a later puzzle within a stop, Next level can return to that stop's earlier unfinished puzzle. Never assume the next numeric campaign index or cross-stop progression.
- Language switching relabels the open picker in place and leaves it open. Check `#levels` visibility before another toggle all the same; paused UI clocks must let the picker animation finish. Final corrected regression evidence is linked in [`../integration.md`](../integration.md).
- French is chosen automatically when the browser prefers it; the journeys run with an English browser.
- The level pill's accessible name includes the current number, campaign count and game name (for example `1 / 180 · Funnel Sort`); the authored title is separate. Use `#levels-toggle`.
