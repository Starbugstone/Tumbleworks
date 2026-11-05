# Funnel Sort

The player taps a crate of marbles; it tips into a clear funnel, the neck feeds one marble at a time onto a belt that never stops, and each dock's front box takes its colour as marbles pass. A full belt nobody can take from is a jam. Every crate and box shows its colour's pattern (ring, diamond, triangle, star, cross, three dots, heart).

## Sub-features

- `funnel-pour` a tapped front crate pours within a tenth of a second and the next crate in its column becomes tappable.
- `funnel-fill` boxes light one pocket per marble and leave the queue when full.
- `funnel-win` the authored winning order empties every crate and fills every box.
- `funnel-jam` the authored losing order fills the belt with colours no dock wants.
- `funnel-variants` paired crates, forked shelves and sealed docks (bank lessons `board-200` to `board-202`, played at `/?try=<id>`).

## How to get to it (user POV)

- Level 1 opens on Funnel Sort with a tap-hand guide on the first crate.
- Any `board-n` chip in the level picker.
- `/?try=board-200` (and 201, 202) for the lesson boards outside the campaign; `tw win board-200` opens them that way.

## Driving it with tw

Preconditions:

- `scripts/doctor.sh` passes.
- The level has an entry in `FUNNEL_WITNESSES` (and `FUNNEL_JAMS` for a jam) in `tests/witnesses.ts`.

- **Win.** Run `tw win board-1 --run <id>`. The steps show each pour; `result.json` is `ok`, the last state has `status: "won"`, the card offers `Next level`, and the picker shows ✓ on that chip after a reload.
- **Jam.** Run `tw jam board-1 --run <id>`. The last state has `status: "jammed"`, the card reads `A little tangled!`, Undo carries the `attention` class, and after Undo the status is `playing`.
- **Settled scene census.** Run `tw render board-57 --run <id>` for draw calls and triangles after up to three pours, settling after each (`render.json`). It does not measure moving marbles or frame time.
- **Proof.** Look at the screenshots: crates and boxes carry their pattern badges, the belt is visibly full when `occupancy` equals capacity.

## Gotchas

- Taps settle the machine before the next tap; a real player can tap faster. `tests/e2e/reservoir.spec.ts` covers rapid taps.
- The first three levels show a guide; it follows real taps and doesn't block them.
- Witness letters are columns (`A` is `supply0`), or crate IDs on fork boards.
- A win needs zero physics recoveries; `scripts/machine-soak.ts` checks that outside the browser.
