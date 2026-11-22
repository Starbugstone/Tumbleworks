# Level menu and progress

The level pill opens a compact menu with the village and round and its three named puzzles. Settings and help contains the pattern legend, language switch, How to play, and a button to copy the current game for a bug report. Wins are stored by stable ID. Next level resumes an unfinished puzzle within the current stop, or steps to the next puzzle when replaying a built stop. Finishing the stop returns to the village.

## Sub-features

- The level pill opens the menu. The close button, Escape, an outside touch and tapping the current row dismiss it while preserving the puzzle.
- Each row opens its puzzle in the current round. A Workshop project or development trial has a single row.
- An inactive completed row shows ✓. The active completed row keeps its number and exposes completion in its accessible name. Both carry `.completed`.
- Back to village returns to the current round’s village. In a Workshop project, Back to workshop returns to the chooser.
- A village visit preserves the in-page puzzle and Undo when returning to that unfinished game. Reload starts the puzzle again.
- Switching English and French preserves the puzzle and the game names. How to play reveals the authored title, difficulty and instructions. The replay copy produces a log that `scripts/replay.ts` can play back.

## How to get to it (user POV)

- Tap Open level menu (`#levels-toggle`). To change rounds, return to the village and tap another available stop.
- Tap Settings and help (`#menu-settings`) for language, patterns and replay copy. Back to levels (`#menu-back`) returns to the rows.

## Driving it with tw

- Run `tw picker --run <id>` after doctor. It checks the three game names, opens Settings and help, checks all seven patterns, switches to French and back without changing the puzzle, then opens the Tube Sort row by touch.
- Run `tw win board-1 --run <id>` for persistence. Check the stable ID in `tumbleworks.progress.v1` and its completed row after reload. Run `tw map --run <id>` to follow Next level through a full stop.
- [`picker.spec.ts`](../../../../tests/e2e/picker.spec.ts) covers late rounds, French row readability, dismissal, keyboard focus and the trial menu. [`input-regressions.spec.ts`](../../../../tests/e2e/input-regressions.spec.ts) swipes the compact menu, checks that the underlying board stays unchanged and then selects a row by touch.
- [`replay.spec.ts`](../../../../tests/e2e/replay.spec.ts) copies a game through Settings and help and replays it in Node.

## Gotchas

- The three-row menu fits without scrolling. Settings and help can scroll if its contents overflow.
- The pill's visible text includes the number, count and game name. Its accessible name is Open level menu or Ouvrir le menu des niveaux. Use `#levels-toggle`.
- Next level follows the stop’s remaining puzzles, so playing a later row first can send the player back to an earlier unfinished row.
