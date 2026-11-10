# Funnel Sort

The player taps a crate of marbles; it tips into a clear funnel, the neck feeds one marble at a time onto a belt that never stops, and each dock's front box takes its colour as marbles pass. A full belt nobody can take from is a jam. Every crate and box shows its colour's pattern (ring, diamond, triangle, star, cross, three dots, heart).

## Sub-features

- `funnel-pour` a tapped front crate pours within a tenth of a second and the next crate in its column becomes tappable.
- `funnel-fill` boxes fill left → right → middle. The first two landings have light contact sounds; only the third landing triggers a brief box shake, sparks and a rounded resolving sound. Full boxes accelerate out while their replacements remain usable. There are no arrival rings or completion-word stamps.
- `funnel-win` the authored winning order empties every crate and fills every box.
- `funnel-jam` the authored losing order fills the belt with colours no dock wants.
- `funnel-variants` paired crates (`board-200`, campaign round 41), forked shelves (`board-201`, round 57), and sealed docks (`board-202`, bank-only). Pairs release both endpoints atomically and one Undo restores both. On paired boards a touch on a back crate pours its column's front crate (and that crate's partner), and only front crates are debug targets; to touch a back crate, project it with the runtime view's `toScreen`. The handle is a dark arch with a gold grip. A sealed dock's front box wears a slate lid with a padlock and the prerequisite's pattern; the key tab sits on the prerequisite box. Shelf access follows accepted predecessor releases, so the next legal crate works while animation continues. A locked shelf crate shows a padlock strapped to each crate still in its way; tipping a blocker removes its strap at once, the padlock pops when the last goes, and a refused tap shakes the padlock and flashes its straps (no message). A seal opens on its prerequisite's final reservation, before jam evaluation; a hypothetical future unlock cannot rescue a jam.
- `funnel-pallet` Workshop `board-212` links adjacent receiving boxes. One full box waits for its partner. The partner's final reservation advances both rule queues atomically, while their visible departure waits for both final captures. Undo restores reservations, queues and physics together. `board-210` and `board-211` combine the existing shelf/size and pair/seal rules.

## How to get to it (user POV)

- Tap the first village stop to open level 1, Funnel Sort, with a tap-hand guide on the first crate.
- Any `board-n` chip in the level picker.
- Choose `board-200` or `board-201` through the picker for campaign lessons. `tw win board-202` uses `/?try=board-202` for the bank-only sealed-dock lesson.

## Driving it with tw

Preconditions:

- `scripts/doctor.sh` passes.
- The level has an entry in `FUNNEL_WITNESSES` / `FUNNEL_JAMS` in `tests/witnesses.ts`, or `VARIETY_FUNNEL_WITNESSES` / `VARIETY_FUNNEL_JAMS` in `tests/variety-witnesses.ts`. Exported Workshop levels require `--workshop`.

- **Win.** Run `tw win board-1 --run <id>`. The steps show each pour; `result.json` is `ok`, the last state has `status: "won"`, the card offers `Next level` within its stop, and the picker shows ✓ after reload. A completed stop returns to the map instead.
- **Jam.** Run `tw jam board-1 --run <id>`. The last state has `status: "jammed"`, the card reads `A little tangled!`, Undo carries the `attention` class, and after Undo the status is `playing`.
- **Settled scene census.** Run `tw render board-57 --run <id>` for draw calls and triangles after up to three pours, settling after each (`render.json`). It does not measure moving marbles or frame time.
- **Landing payoff.** Run `tw payoff board-31 --run <id>` for touch-driven screenshots of the first three landings and the departure. Check the front box in the middle dock: left, then right, then middle. `tests/e2e/funnel-payoff.spec.ts` checks rendered positions, contact-time audio events, reduced motion and cancellation on Undo.
- **Shared-pallet payoff.** [`variety-motion.spec.ts`](../../../../tests/e2e/variety-motion.spec.ts) checks the joint normal lift and local burst, then suppression of lift/shake/sparks under reduced motion without changing joint departure. Mechanics reported these motion checks passed and delivered real grayscale-checked Funnel cue crops. Chooser checks and the bounded `board-212` win/reload-badge/jam-Undo run passed on the earlier snapshot, alongside its combined units/hygiene/gameplay budgets. These passes do not cover the new VillagePlans tree; see [`../integration.md`](../integration.md) for implemented/pending-proof status.
- **Variants.** Run `tw controls board-200 --run <id>` for paired release and exact physics Undo, `tw win board-201 --run <id>` for shelf access, and `tw win board-202 --run <id>` for the sealed-dock bank route. [`tests/e2e/funnel-features.spec.ts`](../../../../tests/e2e/funnel-features.spec.ts) exercises refused endpoints, immediate shelf access and seal timing. `tw win board-212 --workshop --run <id>` uses the new source; its held-box and joint-departure moments need the causal checks in [`workshop-variety.spec.ts`](../../../../tests/e2e/workshop-variety.spec.ts). Record those results separately in [`../integration.md`](../integration.md).
- **Proof.** Look at the screenshots: crates and boxes carry their pattern badges, the belt is visibly full when `occupancy` equals capacity.

## Gotchas

- Taps settle the machine before the next tap; a real player can tap faster. `tests/e2e/reservoir.spec.ts` covers rapid taps.
- The first three levels show a guide; it follows real taps and doesn't block them.
- Witness letters are columns (`A` is `supply0`), or stable crate IDs on paired and fork boards. Do not infer accessibility from a column on those boards.
- A win needs zero physics recoveries; `scripts/machine-soak.ts` checks that outside the browser.
- The drawn slots and departure curve are projected from the original machine poses; rule allocation, physics and replay fingerprints retain their original order and timing.
- Shared-pallet queued boxes use a larger, top-facing existing pattern decal while empty. The current phone/grayscale proof belongs to `workshop-variety.spec.ts`; earlier maintenance screenshots predate that adjustment.
