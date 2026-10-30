# Tumbleworks

A browser marble game with one nine-level campaign: three conveyor puzzles, three tube-sorting puzzles, and three tray-matching puzzles. Each type returns at an increasing difficulty. Every level is available from the numbered row for POC playtesting.

The workshop shares its glass marbles, rendering, input, undo/restart, hints, sound and saved completion. The conveyor keeps real physics for the tray-to-funnel fall; its belt and delivery arcs stay scripted and never stop. Tube and tray transfers use the same reusable physical landing service.

## Run

```sh
docker compose up --build
```

Open <http://localhost:5180>. On a phone connected to the same network, use `http://<your-computer's-LAN-address>:5180`.

## Play

- **Conveyor:** tip supplies, fill the receiving boxes in order, and preserve enough belt space for the next useful pour.
- **Tubes:** select a tube, then an empty tube or a matching top color. Complete a full tube for each color.
- **Tray:** pick exposed marbles into the seven-slot rack. Matching triples clear immediately; finish sets before filling the rack.

Undo, restart and hints work for all three. Keyboard: arrow keys select a piece, Enter/Space acts, U undoes, H hints, R restarts. Completion, the selected level and mute persist locally; an unfinished board starts fresh on reload. There is no account or cloud sync.

## Architecture

[The engine and extension contract](docs/campaign-architecture.md) explains ownership. Register another gameplay pack in `src/campaign.ts`; it supplies level factories implementing `GameRuntime`. The campaign controller has no switch on gameplay kind. Shared marble resources and physics remain in `src/engine`.

[The POC plan](docs/poc-plan.md) records the nine boards and verification boundaries.

## Checks

```sh
docker compose exec -T dev npm test
docker compose exec -T dev npm run typecheck
docker compose exec -T dev npm run build
docker compose --profile e2e run --rm e2e npx playwright test
```

Browser journeys use real canvas touch targets and advance the real fixed-tick runtime deterministically. They check functionality and screenshots, not phone frame rates. Rules tests replay every authored solution; headless physics tests exercise the conveyor and shared landing service.

## Visual evidence

```sh
docker compose --profile e2e run --rm e2e node scripts/inspect-poc.mjs
```

This captures phone and desktop boards into `output/poc9`. `scripts/capture-video.mjs` records a representative playthrough, advancing the game frame by frame so a software renderer does not change playback speed.
