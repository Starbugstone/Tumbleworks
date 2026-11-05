# Controls

Every game shares one slim top row (level pill, counter, sound) and five round buttons at the bottom in the order Restart, Undo, Hint, ×3, ×5. Fast forward runs only while held.

## Sub-features

- `undo` restores the complete previous action, including the physics of poured marbles; disabled with nothing to undo.
- `restart` reloads the same level from its start.
- `hint` rings the piece to play next, or explains a wait or that no verified move exists. While pouring or collecting is active, Loop Sort suggests holding ×5 and asking again once the transfers finish. It never rings a future truck or queues an automatic hint.
- `fast-forward` holding ×3 or ×5 speeds the machine; each input source releases independently, and the fastest remaining hold wins. Window blur, a hidden tab, changing level or ending the level clears all holds.
- `sound` toggles all sound and remembers the choice.
- `keyboard` `f` and `g` hold fast forward; arrows and Enter pick and play pieces.

## How to get to it (user POV)

- The bottom row on every level; the speaker in the top row.
- Keys `f`, `g`, arrows, Enter on a keyboard.

## Driving it with tw

Preconditions:

- `scripts/doctor.sh` passes.
- The level has an authored winning order, so the journey has a first move.

- **All controls.** Run `tw controls board-31 --run <id>` (and `loop-31`, `tube-31`). Restart establishes the initial game fingerprint with the clock stopped. Undo is disabled; an authored action changes the fingerprint before any tick; after settling, `Undo` restores the exact fingerprint saved just before the action, read without another tick. `Hint` shows the focus ring or a message; holding `Fast forward ×3 (hold)` reports `speed: 3` and `aria-pressed="true"`, releasing reports `speed: 1`; another action changes the game and `Restart` restores the complete initial game fingerprint; `Sound` toggles `aria-pressed`.
- **Proof.** `steps.jsonl` pairs each screenshot with `gameFingerprint`, the inspected board state and `status`. The fingerprint covers physics and machine control as well as rules where the game has them; a HUD counter alone cannot prove restoration.

## Gotchas

- The journey holds ×3 with the mouse and checks speed state. Independent key/pointer sources, ×3/×5 fallback and real touch hold input are covered by [`tests/e2e/input-regressions.spec.ts`](../../../../tests/e2e/input-regressions.spec.ts); [`polish.spec.ts`](../../../../tests/e2e/polish.spec.ts) also covers hold behavior. Report each spec's actual result separately.
- Restart sits leftmost on purpose, so a slip from a held fast-forward button never reloads the level.
- With the manual clock, holding fast forward changes the speed but no ticks run until the journey advances time.
