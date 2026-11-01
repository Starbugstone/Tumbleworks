# Tumbleworks

Tumbleworks is a browser marble game with one ninety-level campaign: thirty levels each of Funnel Sort, Loop Sort and Tube Sort. Each round takes one level of each type in that order, preserving the original seventeen's order and existing save IDs. Orange first appears in `tube-6`, then `board-8` and `loop-8`. The difficulty tiers are Getting started, Finding a rhythm, Thinking ahead and Full spectrum; any board containing orange is Full spectrum. The scrolling level picker behind the top-left pill opens any level.

Funnel Sort uses physics for the fall from a crate and for the pile in the funnel. A script moves marbles through the neck, along the belt and into the boxes. Loop Sort is fully scripted. Tube Sort uses the shared physics landing for its transfers.

## Run

```sh
docker compose up --build
```

Open <http://localhost:5180>. On a phone on the same network, use `http://<your-computer's-LAN-address>:5180`.

## Play

Choose **English** or **Français** in the level menu. The first launch follows your browser language. The first three levels use gently tapping hand icons to guide a real move; you can skip them or restart a guide from the menu. Language and completed guides are saved on this device.

- **Funnel Sort.** Tap a crate of nine. The marbles fall into the funnel, and the neck feeds them onto the belt one at a time while the belt has room. Each dock has a queue of three-slot boxes. The front box takes its color as it passes, and the queue moves up when the box is full. You lose if the belt is full and no box wants anything on it.
- **Loop Sort.** A truck takes the color at its loop end as that color passes. Tap a truck to pour that color onto the loop and reach the color behind it. The color and pattern on its cab show the final color it needs. Moving arrows at its open end mean unloading; a pause mark means the full loop is holding it up. A truck full of that color drives away. You lose if the loop is full and no truck can take anything from it.
- **Tube Sort.** Drag a top group into an empty tube or onto the same color, or tap the two tubes. As many marbles as fit move in one action. You win when each color fills its own tube.

Every type accepts the next legal action while earlier animation runs. Marbles are plain, glossy and naturally colored, and every pair of colors differs in brightness. Crates, boxes, cargo blocks, truck cabs and the slot rail beside each tube carry ring, diamond, triangle, star or cross marks, and the level picker shows the legend.

The first two Loop Sort boards start with an empty belt and room for the intended pours. Each conveyor game includes figure-eight boards with a raised bridge, including its final two levels.

Funnel Sort and Loop Sort sit in an arcade loading yard with steady edge lighting. A filled box or truck gets a short completion stamp and sound at its loading point. Trucks leave across raised exit pads; they stay above the platform as they disappear.

Undo, restart and hints work in every type. On a keyboard, arrow keys select a piece, Enter or Space acts, U undoes, H shows a hint and R restarts.

The browser stores completed levels, the selected level and the mute setting. An unfinished board restarts on reload. There are no accounts and no cloud sync.

## Project documents

- [AGENTS.md](AGENTS.md) sets the permanent names, rules and development requirements.
- [Campaign architecture](docs/campaign-architecture.md) explains which module owns what and how to add a gameplay type.
- [The POC plan](docs/poc-plan.md) records the levels, transport design and test coverage.
- [Verification](docs/verification.md) records the latest check results and known gaps.
- [The mechanics research](docs/research/loop-sort-marble-sort-mechanics.md) records what is known about Marble Sort! and Loop Sort.

## Checks

```sh
docker compose exec -T dev npm test
docker compose exec -T dev npm run typecheck
docker compose exec -T dev npm run build
docker compose --profile e2e run --rm e2e npx playwright test
```

Browser tests tap real canvas targets and advance the game clock by hand. They check behavior and layout, not phone frame rates.

The authoring scripts generate boards from seeded recipe tables and reject candidates that fail their solver checks. Funnel Sort boards 3–30 and Loop Sort levels 6–30 need a winning witness, a losing order, a recipe-specific winning share, jams from simple repeated pour orders and an opening hint within 250 ms. Their capacities are tightened to the least solvable value plus recipe slack, capped at the recipe maximum. Loop Sort builds backwards from solved trucks through mirrored legal moves. Tube Sort levels 2–30 need a verified shortest solution inside the recipe's move range, found within the default in-game solver budget and 250 ms; recipes can spread marbles over part-full tubes. Earlier boards stay hand-authored and keep their guides.

```sh
docker compose exec -T dev npx tsx scripts/funnel-author.ts stats
docker compose exec -T dev npx tsx scripts/funnel-author.ts emit
docker compose exec -T dev npx tsx scripts/loop-author.ts stats
docker compose exec -T dev npx tsx scripts/loop-author.ts emit
docker compose exec -T dev npx tsx scripts/tube-author.ts batch
docker compose exec -T dev npx tsx scripts/tube-author.ts 5 5 2 1 12 22
```

Append level IDs to `stats` or `emit` to select recipes; omit them to process all recipes. Conveyor `emit` output supplies definitions for `src/sim/boards.ts` or `src/loop/boards.ts`, witness and jam orders for `tests/witnesses.ts`, and French titles for `src/i18n.ts`. Tube `batch` emits definitions with solutions for `src/puzzles/levels.ts` and French titles for `src/i18n.ts`. The single-board Tube Sort form takes colours, capacity, empties, seed, optional minimum and maximum moves, then optional spread. These commands print output for review and pasting; they do not edit the campaign.

Tube Sort's bank ramps gently after the player found its early boards too hard. Funnel Sort boards 3–11 and Loop Sort levels 6–11 are re-rolled for tighter capacity and a minority of winning orders. `scripts/board-tree.ts` and `scripts/loop-tree.ts` remain available to inspect registered conveyor levels. [Verification](docs/verification.md) explains the authoring metrics and acceptance rules.

## Screenshots and video

```sh
docker compose --profile e2e run --rm e2e node scripts/inspect-feedback.mjs
```

This writes every level, plus grayscale and desktop views of the first level of each type, to `output/current`. `scripts/capture-feedback.mjs` records a short playthrough frame by frame, so a slow software renderer does not change its speed. `scripts/peek.mjs <levelIndex>` writes phone and desktop captures of one level to `output/current/peek`.
