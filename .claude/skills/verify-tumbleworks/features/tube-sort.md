# Tube Sort

The player moves the contiguous same-colour group on top of one tube onto an empty tube or onto the same colour, by tapping the source then the destination, or by dragging. A completed home must be full, uniform and match its colour's required final capacity. Victory permits empty spares, requires cups empty, and never counts a cup as a completed home. Tube slot rails show each marble's pattern.

## Sub-features

- `tube-select` the first tap selects a tube, turns its plum base gold and enlarges its rim.
- `tube-look` the hull is ivory with a gold step and a dark plum deck; tube bases are plum, never ivory, so yellow and white marbles are not seen against a light surface. A marble in the air is drawn slightly tall and leaves a trail. A finished tube throws fine dust with small twinkles and its whole column hops once; there is no label and no pattern icon. A tube holding one colour and one marble short of full has a steady warm glow. On a win the remaining tube rims pulse one after another.
- `tube-move` the second tap moves as many of the group as fit.
- `tube-refuse` a move onto a different colour or a full tube is refused with a message, and the destination becomes the new selection.
- `tube-drag` dragging the group onto a tube moves it; releasing elsewhere changes nothing.
- `tube-win` the stored shortest solution sorts every tube.
- `tube-roles` the capped-spare lesson `tube-200` is at campaign round 45, with practice at rounds 47, 50, 55 and 58. A cap opens permanently when its prerequisite colour completes a full home, in the same accepted move before status evaluation. The two-place closing cup in bank-only `tube-201` is spent on its first nonempty-to-empty move; filling it never counts as a home or opens a cap. Undo restores cap and cup commitments. Workshop `tube-210` opens its spare on move 4 and folds its cup on a later move; no reachable move does both. Workshop `tube-211` shows red's ring on a plaque above the tall home, which pulses when four reds fill a short tube.
- `tube-variety` Workshop `tube-210` combines a visibly squat ribbed folding cup with a capped spare. `tube-211` requires six red marbles in a six-place home; four reds in a short home do not count as completed or unlock a cap. Ordinary boards retain their existing full-home rule.

## How to get to it (user POV)

- Level 3 (`tube-1`) is the first Tube Sort level, with a guide.
- Any `tube-n` chip in the level picker.

## Driving it with tw

Preconditions:

- `scripts/doctor.sh` passes.
- The board has a `solution` in `src/puzzles/levels.ts` or `src/puzzles/variety-boards.ts`; the latter uses `--workshop` for its exported source.

- **Win by taps.** Run `tw win tube-1 --run <id>`. Each pair of taps is one move; the last state has `status: "won"` and the chip shows ✓ after a reload.
- **Controls.** Run `tw controls tube-1 --run <id>`. The first move selects and moves a group, and Undo returns it.
- **Proof.** The screenshots show the selected base/rim after the first tap and the group in its new tube after the second.
- **Container commitments.** Run [`tests/e2e/tube-roles.spec.ts`](../../../../tests/e2e/tube-roles.spec.ts) for blocked caps, French refusal feedback, opening followed by immediate receiving, cup emptying/closure/refusal, Undo, replay and phone/desktop/grayscale captures. `tw win tube-200` alone does not prove use of the spare or cup: authored solutions can avoid them. The folding-cup and mixed-height causal passes and remaining checks are recorded in [`../integration.md`](../integration.md).
- **Workshop commitments.** `tw win tube-210 --workshop --run <id>` plays the cup/cap solution; `tw win tube-211 --workshop --run <id>` plays the tall-home solution. Their exact causal moments, drag and replay checks live in [`workshop-variety.spec.ts`](../../../../tests/e2e/workshop-variety.spec.ts); keep that suite's actual result separate from generic journey wins.
- **Reduced-motion exchange and home plaque.** The earlier `variety-motion.spec.ts` pass belongs to the old fixture. Mechanics reported the separate spare-opening/later-cup-fold motion checks passed, and re-proved `tube-211` after correcting the plaque to show its complete ring. Real colour/grayscale crops are installed; chooser and combined unit/hygiene/gameplay checks passed on their recorded snapshot. The bounded skill run did not repeat these Tube mechanics; the old simultaneous-event pass does not validate re-authored `tube-210`. The new VillagePlans integration awaits fresh proof; see [`../integration.md`](../integration.md).

## Gotchas

- `tw` has no drag journey yet; `tests/e2e/drag.spec.ts` drives native touch events through CDP and covers cancellation.
- A resting Tube Sort board isn't redrawn until something changes; a screenshot taken without a tick or input shows the last drawn frame, which is correct.
- Tube Sort becomes jammed when no legal moves remain; Undo or Restart lets the player recover. Classic boards have no stored losing-order table. Workshop `tube-210` and `tube-211` have real jam fixtures; `tw jam tube-210 --workshop --run <id>` drives that path.
