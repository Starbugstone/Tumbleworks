# Tumbleworks

Tumbleworks is a browser marble game with one seventeen-level campaign. It has seven levels each of Funnel Sort and Loop Sort, and three of Tube Sort. The campaign takes one level of each type per round. The level picker behind the top-left pill opens any level.

Funnel Sort uses physics for the fall from a crate and for the pile in the funnel. A script moves marbles through the neck, along the belt and into the boxes. Loop Sort is fully scripted. Tube Sort uses the shared physics landing for their transfers.

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

Every type accepts the next legal action while earlier animation runs. Marbles are plain, glossy and naturally colored, and every pair of colors differs in brightness. Crates, boxes, cargo blocks, truck cabs and the slot rail beside each tube carry ring, diamond, triangle or star marks, and the level picker shows the legend.

The first two Loop Sort boards start with an empty belt and room for the intended pours. Each conveyor game has two later figure-eight boards with a raised bridge; they occupy campaign levels 14–17.

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

To author levels, `scripts/board-tree.ts` and `scripts/loop-tree.ts` count the winning and losing tap orders of each conveyor level.

## Screenshots and video

```sh
docker compose --profile e2e run --rm e2e node scripts/inspect-feedback.mjs
```

This writes every level, plus grayscale and desktop views of the first level of each type, to `output/current`. `scripts/capture-feedback.mjs` records a short playthrough frame by frame, so a slow software renderer does not change its speed. `scripts/peek.mjs <levelIndex>` writes phone and desktop captures of one level to `output/current/peek`.
