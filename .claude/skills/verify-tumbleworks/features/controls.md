# Controls

Every game shares one slim top row (level pill, counter, sound) and five round buttons at the bottom in the order Restart, Undo, Hint, ×3, ×5. Fast forward runs only while held.

## Sub-features

- `undo` restores the complete previous action, including the physics of poured marbles; disabled with nothing to undo.
- `restart` reloads the same level from its start.
- `hint` rings the piece to play next, or explains that no safe move exists.
- `fast-forward` holding ×3 or ×5 speeds the machine; releasing, blurring or ending the level returns to normal speed.
- `sound` toggles all sound and remembers the choice.
- `keyboard` `f` and `g` hold fast forward; arrows and Enter pick and play pieces.

## How to get to it (user POV)

- The bottom row on every level; the speaker in the top row.
- Keys `f`, `g`, arrows, Enter on a keyboard.

## Driving it with tw

Preconditions:

- `scripts/doctor.sh` passes.
- The level has an authored winning order, so the journey has a first move.

- **All controls.** Run `tw controls board-31 --run <id>` (and `loop-31`, `tube-31`). Undo is disabled at start; a move changes the state; `Undo` restores `moves` and `occupancy`; `Hint` shows the focus ring or a message; holding `Fast forward ×3 (hold)` reports `speed: 3` and `aria-pressed="true"`, releasing reports `speed: 1`; `Restart` returns to the start; `Sound` toggles `aria-pressed`.
- **Proof.** `steps.jsonl` pairs each screenshot with `moves`, `occupancy` and `status`.

## Gotchas

- The journey holds ×3 with the mouse. Touch holds and a second finger tapping the board while holding are covered by `tests/e2e/polish.spec.ts`.
- Restart sits leftmost on purpose, so a slip from a held fast-forward button never reloads the level.
- With the manual clock, holding fast forward changes the speed but no ticks run until the journey advances time.
