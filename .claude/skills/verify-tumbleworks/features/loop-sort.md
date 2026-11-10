# Loop Sort

The player taps a docked lorry to pour its open-end stretch onto a moving loop; lorries take their current open-end colour as it passes, and a lorry full of one colour leaves for the next in its lane. The deepest stretch fixes the finishing colour shown on the cab. Below the toy, numbered lorry cards show every lane's queue with the stretches and percentages in packing order. A full loop nobody can take from is a jam; so is an undrainable loop with nothing left for any front truck to pour.

## Sub-features

- `loop-pour` tapping a docked lorry or its raised ivory card pours its open-end stretch.
- `loop-refuse` a one-colour, latched or already-pouring lorry refuses the tap with a reason. A legal pour can wait for loop space; the pause symbol means the full loop is holding it. A full undrainable loop jams.
- `loop-cards` waiting cards answer a tap without pouring; `+n` tiles unfold folded lorries.
- `loop-win` the authored winning order sends every lorry away full.
- `loop-jam` the authored losing order leaves a full loop that no front lorry can take from.
- `loop-variants` the latch lesson is `loop-200` at campaign round 43; the short-truck lesson is `loop-95` at round 59. Older short lesson `loop-201` and coupled lesson `loop-202` remain bank-only. A latch blocks pouring, never receiving, and opens when its prerequisite completes before jam evaluation. Coupled open-end stretches pour atomically; one Undo restores both. Completing either truck removes the link immediately. The toy bar is dark with a light stripe; each linked card shows a `.lr-link` chip with the partner's lane. A refused tap on either linked truck while the pair pours says "Still pouring." (or the loop-full sentence).
- `loop-roster-layout` percentages use each truck's own capacity, including short beds. The shared layout reduces toy height, then row height, then folds farthest-back cards into `+n`; docked and next cards retain their numbers.

## How to get to it (user POV)

- Level 2 (`loop-1`) is the first Loop Sort level, with a guide.
- Any `loop-n` chip in the level picker.

## Driving it with tw

Preconditions:

- `scripts/doctor.sh` passes.
- The level has an entry in `LOOP_WITNESSES` / `LOOP_JAMS` in `tests/witnesses.ts`, or `VARIETY_LOOP_WITNESSES` / `VARIETY_LOOP_JAMS` in `tests/variety-witnesses.ts`. Exported Workshop levels require `--workshop`.

- **Win.** Run `tw win loop-31 --run <id>`. Screens show the cards updating as lorries pour and leave; `result.json` is `ok` and the chip shows ✓ after a reload.
- **Jam.** Run `tw jam loop-41 --run <id>`. The last state is `jammed`; Undo brings it back to `playing`.
- **Cards.** Open any later level (`tw render loop-61 --run <id>`) and check in the settled screenshot that every lane has a numbered row, the docked card is raised and ivory, and each stretch prints a whole percentage. The render report is a settled scene census, not a busy-frame or performance measurement.
- **Variants.** Run `tw controls loop-200 --run <id>`, `tw win loop-95 --run <id>` and `tw win loop-202 --run <id>`. [`tests/e2e/loop-features.spec.ts`](../../../../tests/e2e/loop-features.spec.ts) checks refused latch feedback naming the prerequisite lane, opening and Undo, plus coupled input. [`tests/e2e/campaign-loop-expansion.spec.ts`](../../../../tests/e2e/campaign-loop-expansion.spec.ts) checks the short lesson's bed size, readable exact shares and real tap/Undo. The combined Workshop boards' passing causal evidence and remaining gates are tracked in [`../integration.md`](../integration.md).
- **Combined Workshop boards.** Use `tw win loop-210 --workshop --run <id>` for short-truck/latch and `tw win loop-211 --workshop --run <id>` for unequal coupled loads. [`workshop-variety.spec.ts`](../../../../tests/e2e/workshop-variety.spec.ts) owns their causal latch/completion/coupling checks, which a generic win alone cannot establish.
- **Historical roster and cues.** Before the partner-chip/3D changes, both all-registered-level cases passed across 60 IDs, with the initial 300-second readability timeout retained and the same-timeout retry passing. Earlier full-page grayscale captures remain in the historical ledger. Mechanics reported linked-card/partner-lane and refused-mid-pour checks passed, with real grayscale-checked latch/link crops delivered. Chooser checks and combined unit/hygiene/gameplay gates passed on their recorded snapshot. The bounded skill run did not repeat Loop mechanics/roster coverage; none of these older integrated passes certifies the new VillagePlans tree. See [`../integration.md`](../integration.md) for the current proof boundary.

## Gotchas

- `loop-1` and `loop-2` have no losing order by design, and the campaign's first losing order is `loop-41`; `tw jam` on a level without one reports not verified.
- Lane `n` in a witness letter is `lane<n>`, zero-based: `A` is `lane0`.
- Waiting lorries are never drawn on the toy, only in the cards; tapping a waiting card plays the blocked sound and pours nothing.
- Card readability at the player's phone across every registered level is checked by `tests/e2e/loop.spec.ts`, not by this journey. `tests/loop/roster-layout.test.ts` additionally covers every bank board and invented larger queues; this unit coverage does not prove their browser layout.
