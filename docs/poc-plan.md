# Marble sort POC plan

Agreed with GPT-6.1 Sol (xhigh) over three rounds on 2026-10-30. Nothing here is built yet.

## The idea, in short

One browser game, one campaign, three rulesets: tube, tray and conveyor. They can share marbles, sound, undo and progress, but each ruleset needs its own rules, level checks and tutorial. That makes this roughly three small games behind one front end, so the first thing to prove is that the riskiest of them is worth playing.

## What the POC builds

**The conveyor, not the tube level.** The conveyor is the hook of the games being copied and the only ruleset with timing, a limited buffer and a watch-it-resolve payoff. Tube sorting is the cheapest to build, but it would pass without testing any of that.

This changes build order only. `research/mixed-campaign-plan.json` still lists a tube level first, and campaign order is decided after the POC.

## Tools

| Need | Choice |
| --- | --- |
| Engine | Phaser 4.2.1, pinned |
| Language and build | TypeScript, Vite |
| Rules tests | Vitest |
| End-to-end test | One Playwright journey |
| Physics | None. Motion is authored; the simulation decides outcomes |
| Marble art | Radial-gradient textures generated at boot, plus a contact shadow and upright colour-blind symbols |
| Screen | 720×1280 logical size, `Scale.FIT` |
| Save | `localStorage`, completion only |

Left out on purpose: plugin framework, level generator, level editor, asset pipeline.

This overrides the research brief's Three.js recommendation. The toy look matters, but real 3D is only needed for changing reflections, visible sphere rotation or dimensional machinery. Solid glossy marbles with a fixed highlight don't show rotation, so sprites should hold up. The spike below tests that.

## Rules

- Tap an exposed supply packet to release it. Its whole size reserves belt capacity at once.
- Marbles enter through one gate and circulate. At the delivery gate, a marble that matches the front box delivers; anything else keeps going.
- A filled box leaves immediately and the next one becomes active.
- **Win:** supplies, belt and receiver queue are all empty.
- **Jam:** no packet fits, and no marble on the belt or waiting to enter can ever deliver. A full belt that can still drain is not a jam.
- **Blocked tap:** rejected, never queued. Show "Needs 6 free spaces" with waiting feedback.
- **On a jam:** Undo is live immediately and the belt keeps moving. The explanation appears once waiting marbles have entered, about a second at most, so the cause is on screen when it's described.
- **Undo:** restores a full snapshot from before the last accepted release.

## Levels

Supplies are listed front first. Each packet is 6 marbles, each box holds 3, and the belt holds 12.

### Board 1: the first level

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

How it plays:

1. The player sees the full supply stacks, box queue, belt direction arrows and an occupancy counter.
2. The first tap of the first attempt is locked to A: "Release blue to uncover red."
3. Blue circulates with nowhere to go, and red is now exposed. From here there is no more direction.
4. Tapping red drains the belt in a chain of deliveries, red first and then the waiting blue. Green finishes the level.
5. Tapping green instead jams the belt. The game explains why and highlights Undo.

### Board 2: does it hold up as a game?

Data only, no new code. Shown after the first win, with no guidance.

```text
Supply A: Red ×6 → Blue ×6
Supply B: Yellow ×6 → Red ×6
Supply C: Green ×6
Boxes:    R, R, Y, Y, B, B, R, R, G, G
```

This has 13 winning and 13 jamming tap orders, and every opening can still win. The counts show coverage, not difficulty.

## Architecture

- Rules and simulation are pure TypeScript with no Phaser import. Phaser only draws the state and sends taps.
- Integer ticks with a specified order within each tick. Tween callbacks never decide anything.
- The belt loop has 24 sampling positions. These are not visible slots; capacity stays 12.
- One entry gate with a first-in, first-out queue, one delivery gate, one receiver lane. Capacity includes marbles waiting to enter.

With one lane, the outcome depends only on which packets were released, not when. Boxes are identical and in a fixed order, and free space in real time never exceeds free space in fully settled play. So a simple settled solver can vouch for the real-time game.

## Tests

- **Vitest:** rules, plus a small enumerator that drives the real rules module and asserts both boards' full tap trees.
- **Property test:** random tap timing, compared after draining on box progress and leftover counts, must match settled play.
- **Playwright:** jam → undo → win → reload still shows completion.

## Build order

1. **Half-day spike, before any gameplay.** On a real phone with Phaser 4.2.1: 12 occupied belt positions plus supply and box visuals, rapid taps, resize, and motion at actual size.
2. Rules, simulation and tests, with no rendering.
3. Board 1 rendered and playable, with guidance, undo and jam explanation.
4. Sound and motion polish.
5. Board 2 and saved completion.

**Fallback rules for the spike:**

- Move to Phaser 3 only after reproducing a defect specific to 4 and showing the same harness passes on 3.
- Move to Three.js only if the look fails in a way that needs depth, lighting or geometry sprites can't provide. Weak colours or animation don't justify changing engine.

## The verdict

The POC fails if any of these is true:

- Players can't explain a jam after board 1.
- Travel around the belt feels like dead time.
- The look misses the toy appeal.

It proves nothing about the tube and tray rulesets or the shared shell. Those wait for a second ruleset.

## What has and hasn't been checked

- **Checked:** both boards' tap trees, by two separate enumerators. Re-run with `python3 -I research/conveyor_board_check.py`. It uses the settled model, not game code.
- **Checked by Sol only:** 1,000 randomly timed runs per board on three boards through a throwaway 24-position tick model, with zero mismatches against settled play. This supports the one-lane argument; the real simulation still has to pass the property test.
- **Not checked:** Phaser 4 on a phone, whether the sprites look right, and whether any of this is fun. No code or playtest exists yet.
