# Tumbleworks

Tumbleworks is a browser marble game with 180 campaign levels across Funnel Sort, Loop Sort and Tube Sort. A valley map groups them into 60 construction stops: each stop plays one level of each game in that order. Finishing a stop builds part of the local marble machine; ten stops finish a location. The original 120 levels keep their IDs, content and order. The target is 360 levels; later rounds are not registered yet.

Funnel Sort uses physics for the fall from a crate and for the pile in the funnel. A script moves marbles through the neck, along the belt and into the boxes. Loop Sort is fully scripted. Tube Sort uses the shared physics landing for its transfers.

## Run

```sh
docker compose up --build
```

Open <http://localhost:5180>. On a phone on the same network, use `http://<your-computer's-LAN-address>:5180`.

## Play

Tap **Play next level** on the map, or choose an available construction stop.
Finish its three puzzles, return to see the new piece installed, then tap Play
again. A partial round
resumes at its first unfinished puzzle. Completed stops replay all three games.
The map rests between interactions and pauses the game underneath it.

Every 30 campaign levels, the location's finished contraption earns a short,
skippable film. Completed locations and their films remain visitable. The valley
overview connects the locations, while the level picker behind the top-left pill
still opens individual puzzles. Existing saves build their completed locations
without automatically playing a backlog of old films.

The map's **Workshop** opens seven additional puzzles with new rule combinations,
shared pallets and mixed-height Tube Sort homes. Their completion is stored by
stable ID separately from campaign construction. They can graduate into later
campaign slots only after passing the authoring gates; see
[the variety plan](docs/gameplay-variety.md).

Choose **English** or **Français** in the level menu. The first launch follows your browser language. The first three levels use gently tapping hand icons to guide a real move; you can skip them or restart a guide from the menu. Language and completed guides are saved on this device.

- **Funnel Sort.** Tap a crate of nine. The marbles fall into the funnel, and the neck feeds them onto the belt one at a time while the belt has room. Each dock has a queue of three-slot boxes. The front box takes its color as it passes, and the queue moves up when the box is full. You lose if the belt is full and no box wants anything on it.
- **Loop Sort.** A truck takes the color at its loop end as that color passes. Tap a truck to pour that color onto the loop and reach the color behind it. The color and pattern on its cab show the final color it needs. Moving arrows at its open end mean unloading; a pause mark means the full loop is holding it up. A truck full of that color drives away. You lose if the loop is full and no truck can take anything from it.
- **Tube Sort.** Drag a top group into an empty tube or onto the same color, or tap the two tubes. As many marbles as fit move in one action. You win when each color fills its own tube.

Every type accepts the next legal action while earlier animation runs. Marbles are plain, glossy and naturally colored, and every pair of colors differs in brightness. Crates, boxes, cargo blocks, truck cabs and tube slot rails carry ring, diamond, triangle, star, cross, three-dot or heart marks, and the level picker shows the legend.

The first two Loop Sort boards start with an empty belt and room for the intended pours. The registered campaign includes Funnel Sort figure-eights; Loop Sort eights remain in the bank. The full target campaign's final two levels of each conveyor type should be eights, an outstanding assembly target.

Funnel Sort and Loop Sort use calm teal platforms with steady lighting. Funnel Sort boxes fill left, right, then middle; the final capture gives the completed box a brief shake and sound. Reduced motion suppresses the shake. Trucks leave across raised exit pads and stay above the platform as they disappear.

Undo, restart and hints work in every type. On a keyboard, arrow keys select a piece, Enter or Space acts, U undoes, H shows a hint and R restarts.

The browser stores completed levels, the selected level and the mute setting. An unfinished board restarts on reload. There are no accounts and no cloud sync.

## Project documents

- [AGENTS.md](AGENTS.md) sets the permanent names, rules and development requirements.
- [Development workflow](docs/development-workflow.md) defines acceptance checks, replaying failures, prevention of recurring bugs, state models and performance budgets.
- [Campaign architecture](docs/campaign-architecture.md) explains which module owns what and how to add a gameplay type.
- [World progression](docs/world-progression.md) describes the map, round boundaries, saves, films and Workshop separation.
- [The POC plan](docs/poc-plan.md) records the levels, transport design and test coverage.
- [Verification](docs/verification.md) records the latest check results and known gaps.
- [Deployment](docs/deployment.md) explains how a push to `main` reaches <https://tumbleworks.starbugstone.com> and holds the o2switch setup and maintenance commands.
- [The mechanics research](docs/research/loop-sort-marble-sort-mechanics.md) records what is known about Marble Sort! and Loop Sort.

## Checks

```sh
docker compose exec -T dev npm test
docker compose exec -T dev npm run typecheck
docker compose exec -T dev npm run build
docker compose --profile e2e run --rm e2e npx playwright test
```

Browser tests tap real canvas targets and advance the game clock by hand. They check behavior and layout, not phone frame rates.

Village films use authored cinematic motion. `npm test` covers the shipping
cinematic timeline, geometry, visibility, cameras, scene lifecycle and Workshop,
alongside all puzzle and engine tests. The earlier force/torque and native
mechanical-certificate experiments are separate: `npm run test:research` runs
those archived tests, some of which require local receipts under `output/current`
and intentionally retain unfinished physical-model failures. They do not gate
cinematic playback or deployment. No puzzle physics is replaced by film animation.

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
