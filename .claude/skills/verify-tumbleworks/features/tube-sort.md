# Tube Sort

The player moves the contiguous same-colour group on top of one tube onto an empty tube or onto the same colour, by tapping the source then the destination, or by dragging. A tube full of one colour completes with sparks; every tube sorted wins. Tube slot rails show each marble's pattern.

## Sub-features

- `tube-select` the first tap selects a tube and raises its rim.
- `tube-move` the second tap moves as many of the group as fit.
- `tube-refuse` a move onto a different colour or a full tube is refused with a message, and the destination becomes the new selection.
- `tube-drag` dragging the group onto a tube moves it; releasing elsewhere changes nothing.
- `tube-win` the stored shortest solution sorts every tube.
- `tube-roles` capped spares and closing cups (lesson boards from `tube-200`).

## How to get to it (user POV)

- Level 3 (`tube-1`) is the first Tube Sort level, with a guide.
- Any `tube-n` chip in the level picker.

## Driving it with tw

Preconditions:

- `scripts/doctor.sh` passes.
- The board has a `solution` in `src/puzzles/levels.ts`.

- **Win by taps.** Run `tw win tube-1 --run <id>`. Each pair of taps is one move; the last state has `status: "won"` and the chip shows ✓ after a reload.
- **Controls.** Run `tw controls tube-1 --run <id>`. The first move selects and moves a group, and Undo returns it.
- **Proof.** The screenshots show the selected rim raised after the first tap and the group in its new tube after the second.

## Gotchas

- `tw` has no drag journey yet; `tests/e2e/drag.spec.ts` shows how to drag with touch (`page.touchscreen` move sequence) and covers cancellation.
- A resting Tube Sort board isn't redrawn until something changes; a screenshot taken without a tick or input shows the last drawn frame, which is correct.
- Tube Sort has no losing order: a stuck board is undone, not jammed by design.
