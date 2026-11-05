# Loop Sort

The player taps a docked lorry to pour its open-end stretch onto a moving loop; lorries take their current open-end colour as it passes, and a lorry full of one colour leaves for the next in its lane. The deepest stretch fixes the finishing colour shown on the cab. Below the toy, numbered lorry cards show every lane's queue with the stretches and percentages in packing order. A full loop nobody can take from is a jam; so is an undrainable loop with nothing left for any front truck to pour.

## Sub-features

- `loop-pour` tapping a docked lorry or its raised ivory card pours its open-end stretch.
- `loop-refuse` a one-colour lorry, a lorry pouring, or a full loop refuses the tap with a message naming the reason.
- `loop-cards` waiting cards answer a tap without pouring; `+n` tiles unfold folded lorries.
- `loop-win` the authored winning order sends every lorry away full.
- `loop-jam` the authored losing order leaves a full loop that no front lorry can take from.
- `loop-variants` latches, short lorries and coupled unloads (`loop-200` to `loop-202`, at `/?try=<id>`).

## How to get to it (user POV)

- Level 2 (`loop-1`) is the first Loop Sort level, with a guide.
- Any `loop-n` chip in the level picker.

## Driving it with tw

Preconditions:

- `scripts/doctor.sh` passes.
- The level has an entry in `LOOP_WITNESSES` (and `LOOP_JAMS` for a jam) in `tests/witnesses.ts`.

- **Win.** Run `tw win loop-31 --run <id>`. Screens show the cards updating as lorries pour and leave; `result.json` is `ok` and the chip shows ✓ after a reload.
- **Jam.** Run `tw jam loop-41 --run <id>`. The last state is `jammed`; Undo brings it back to `playing`.
- **Cards.** Open any later level (`tw render loop-61 --run <id>`) and check in the settled screenshot that every lane has a numbered row, the docked card is raised and ivory, and each stretch prints a whole percentage. The render report is a settled scene census, not a busy-frame or performance measurement.

## Gotchas

- `loop-1` and `loop-2` have no losing order by design, and the campaign's first losing order is `loop-41`; `tw jam` on a level without one reports not verified.
- Lane `n` in a witness letter is `lane<n>`, zero-based: `A` is `lane0`.
- Waiting lorries are never drawn on the toy, only in the cards; tapping a waiting card plays the blocked sound and pours nothing.
- Card readability at the player's phone across all levels is checked by `tests/e2e/loop.spec.ts`, not by this journey.
