# Marble sort POC plan

## Where this stands

The first build followed the plan below as originally agreed: Phaser, 2D sprites and no physics. It passed its tests and was rejected the first time it was played: "I was expecting something a lot more visually appealing and also some physics, that's what people want, to see the marbles fall and that they had a physical interaction and see real life reactions on the screen."

That is the plan's own failure test for appeal, so the renderer and the "no physics" decision were replaced. The puzzle design survived unchanged. The 2D build is in git history at commit `fe49016`.

## The idea, in short

One browser game, one campaign, three rulesets: tube, tray and conveyor. They can share marbles, sound, undo and progress, but each ruleset needs its own rules, level checks and tutorial. That makes this roughly three small games behind one front end, so the first thing to prove is that the riskiest of them is worth playing.

## What the POC builds

**The conveyor, not the tube level.** The conveyor is the hook of the games being copied and the only ruleset with timing, a limited buffer and a watch-it-resolve payoff. `docs/research/mixed-campaign-plan.json` still lists a tube level first, and campaign order is decided after the POC.

## The machine

Top to bottom, as a toy on a wooden table:

1. **Trays** hold packets of 6 marbles. Tapping one tips it, and marbles roll off one at a time.
2. **A clear funnel** catches them. They really fall, bounce and knock into each other. **This is the only part that uses physics.**
3. **The belt** carries them in evenly spaced slots at constant speed. It's scripted, and it never stops or pauses.
4. **A selector at the front** sends a marble matching the active box out through the door. Others ride on.
5. **A scripted arc** takes it into its place in the box.
6. **A box** shows a light per marble, then leaves as the next arrives.

Playtesting drove this split. Physics on the belt looked messy and slowed the game down, and pausing the belt to compensate was rejected outright: the game has to stay fluid.

## Tools

| Need | Choice |
| --- | --- |
| Rendering | Three.js 0.187, fixed perspective camera, clear glass marbles |
| Physics | Rapier 3D 0.21 at a fixed 60 ticks per second, for the fall only |
| Language and build | TypeScript, Vite, in a Docker dev server |
| Tests | Vitest for rules and headless physics, one Playwright journey |
| Art | Generated in code: no image or audio files |
| Save | `localStorage`, completion and mute only |

Left out on purpose: bloom and other post-processing, level generator, level editor, asset pipeline.

## Physics decides when, rules decide what

The rules (`src/sim/rules.ts`) are pure code: which release is allowed, how much of the belt is used, which box is active, and what counts as a win or a jam. The machine only reports events such as "this marble reached the gate", and the rules answer.

This is safe because with one receiver queue the outcome depends only on which packets were released, not when. That's what the order-independence test checks, with 500 randomised schedules per level.

## Rules

- Tap a tray to release its packet. Its whole size reserves belt space at once.
- A marble leaves the belt only when it's the active box's colour, and at most 3 are ever reserved per box.
- The selector moves to the next colour as soon as a box's third marble is on its way, so a matching marble behind it doesn't have to ride another lap. It flies a little slower so it arrives with its box.
- **Win:** supplies, belt and boxes all done.
- **Jam:** no packet fits, nothing on the belt matches the active box, and nothing is mid-delivery. A full belt that can still drain is not a jam.
- **Blocked tap:** refused, never queued. Neutral feedback if the belt can still drain, an alarm if not.
- **Undo:** restores a full snapshot of the rules and the physics world from before the last accepted release, with a brief flash.

## Levels

Supplies are listed front first. Each packet is 6 marbles, each box holds 3, and the belt holds 12.

### Level 1

```text
Supply A: Blue ×6 → Red ×6
Supply B: Green ×6
Boxes:    R, R, B, B, G, G
```

| Tap order | Result |
| --- | --- |
| A, A, B | Win |
| A, B | Jam: blue and green fill the belt, and red can't get on |
| B, A | Jam: same reason |

The first tap of the first attempt is locked to A, with a hint. There's no further direction after that.

### Level 2

Shown after the first win, with no guidance. It has 13 winning and 13 jamming tap orders, and every opening can still win.

```text
Supply A: Red ×6 → Blue ×6
Supply B: Yellow ×6 → Red ×6
Supply C: Green ×6
Boxes:    R, R, Y, Y, B, B, R, R, G, G
```

## Keeping marbles moving

Only the fall can go wrong, because everything after it is scripted.

- **Prevention comes first:** marbles pour one at a time, the funnel's outlet is wide, and clear walls contain them.
- **Rescue is the last resort:** a shove if a marble is still falling after 4 seconds, then a teleport. Both are counted.
- **The soak test fails on any teleport** and on more than one shove in a run.

## Tests

- **Rules:** 29 tests, including both levels' full tap trees and the order-independence property.
- **Physics soak:** both levels with varied tap timing and undo. The latest run at `SOAK_RUNS=30` covered 540 games with 0 teleports and 0 shoves.
- **Pace:** a brisk player must win level 1 in under 13 seconds and level 2 in under 16. They currently take 10.9 and 13.5.
- **Browser:** jam → undo → win → reload still shows completion, plus a jam on level 2 and a refused tap.

## The verdict

The POC fails if any of these is true:

- Players can't explain a jam after level 1.
- The game stops feeling fluid, or riding the belt feels like waiting rather than watching.
- It doesn't look like a toy that's worth watching.

It proves nothing about the tube and tray rulesets or the shared shell. Those wait for a second ruleset.

## What hasn't been checked

- **Frame rate on a real phone.** All testing so far used a software renderer on a PC, which says nothing about phone speed. Graphics step down automatically if frames take too long: first resolution, then clear glass. That fallback hasn't been run on a phone either.
- **Sound.** It's synthesised and has never been heard by the person writing it.
- **Whether it's fun.** That needs people playing it.
