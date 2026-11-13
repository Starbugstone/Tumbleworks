# Controls

Every game shares one slim top row (level pill, counter, sound) and five round buttons at the bottom in the order Restart, Undo, Hint, ×3, ×5. Fast forward runs only while held.

## Sub-features

- `undo` restores the complete previous action, including the physics of poured marbles; disabled with nothing to undo.
- `restart` reloads the same level from its start.
- `hint` rings the piece to play next, or explains a wait or that no verified move exists. While pouring or collecting is active, Loop Sort suggests holding ×5 and asking again once the transfers finish. It never rings a future truck or queues an automatic hint.
- `fast-forward` holding ×3 or ×5 speeds the machine; each input source releases independently, and the fastest remaining hold wins. Window blur, a hidden tab, changing level or ending the level clears all holds.
- `sound` toggles all sound and remembers the choice. A compressed CC0 sample bank loads once after an unmuted gesture; a quiet immediate fallback covers loading/failure without replaying old cues. Small impacts leave voice space for completion and win sounds.
- `keyboard` `f` and `g` hold fast forward; arrows select a piece, Enter or Space activates it; `u` undoes, `h` hints and `r` restarts. Holding `r` does not repeatedly restart.
- `guide-boundary` tutorial tap hands stay inside gameplay, including when an unseen tutorial's runtime exists behind Workshop. Returning through Map Play restores the hand and Skip guide; [`world-ui-regressions.spec.ts`](../../../../tests/e2e/world-ui-regressions.spec.ts) has a failing-before/passing-after real-touch regression.
- `puzzle-zoom` the board and clipped level name explicitly disable browser touch gestures; both picker scrollers allow vertical panning only. Safari `gesturestart` and `gesturechange` defaults are cancelled during gameplay, including the picker, without cancelling ordinary taps or one-finger scrolling.

## How to get to it (user POV)

- The bottom row on every level; the speaker in the top row.
- Keys `f`, `g`, `u`, `h`, `r`, arrows, Enter and Space on a keyboard.

## Driving it with tw

Preconditions:

- `scripts/doctor.sh` passes.
- The level has an authored winning order, so the journey has a first move.

- **All controls.** Run `tw controls board-31 --run <id>` (and `loop-31`, `tube-31`). Restart establishes the initial game fingerprint with the clock stopped. Undo is disabled; an authored action changes the fingerprint before any tick; after settling, `Undo` restores the exact fingerprint saved just before the action, read without another tick. `Hint` shows the focus ring or a message; holding `Fast forward ×3 (hold)` reports `speed: 3` and `aria-pressed="true"`, releasing reports `speed: 1`; another action changes the game and `Restart` restores the complete initial game fingerprint; `Sound` toggles `aria-pressed`.
- **Proof.** `steps.jsonl` pairs each screenshot with `gameFingerprint`, the inspected board state and `status`. The fingerprint covers physics and machine control as well as rules where the game has them; a HUD counter alone cannot prove restoration. The fingerprint is game state only: it does not show that presentation has come to rest. `tw` waits on `busy`/`settling`, while a Tube Sort board keeps drawing a little longer for dust, the column hop and the win wave, so a capture can still show them.
- **Send-off.** A successful Undo or Hint marks the level as helped, and a win then fires smaller corner fountains (`celebrate(0.65)` instead of `1`); Restart and opening a level clear it. No journey checks this.
- **Sound loading and cancellation.** Run `tests/e2e/audio.spec.ts` for real MP3 decoding, gesture-only requests, persistent mute, cancellation, corrupt-sample fallback, and quiet Loop intake with audible completions under held ×5. `tests/e2e/funnel-payoff.spec.ts` keeps only the final contact audible under held ×5. Use the audible preview or a phone to judge the mix; automated levels and playback calls do not prove that it sounds enjoyable.

## Gotchas

- The journey holds ×3 with the mouse and checks speed state. Independent key/pointer sources, ×3/×5 fallback and real touch hold input are covered by [`tests/e2e/input-regressions.spec.ts`](../../../../tests/e2e/input-regressions.spec.ts); [`polish.spec.ts`](../../../../tests/e2e/polish.spec.ts) also covers hold behavior. Report each spec's actual result separately.
- Restart sits leftmost on purpose, so a slip from a held fast-forward button never reloads the level.
- With the manual clock, holding fast forward changes the speed but no ticks run until the journey advances time.
- [`zoom.spec.ts`](../../../../tests/e2e/zoom.spec.ts) checks computed touch policy and cancellation of synthetic Safari gesture events across the three games, plus the guard's village exclusion. It does not reproduce native iOS zoom. On a real upright iPhone, double-tap pieces and HUD buttons, pinch over the board and picker, and hold ×5 while a second finger plays: `visualViewport.scale` must stay at 1, picker swipes must scroll, and taps must still act. Record the iOS/browser version; Chromium or desktop WebKit results cannot establish the reported iPhone failure is fixed.
