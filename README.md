# Tumbleworks

A browser marble game with one twelve-level campaign: three difficulties each of **Funnel Sort**, **Tube Sort**, **Tray Match**, and **Connected Match**. Each type returns at an increasing difficulty. Every level is available from the numbered row for POC playtesting.

The workshop shares its glass marbles, rendering, input, undo/restart, hints, sound and saved completion. The conveyor keeps real physics for the tray-to-funnel fall; its belt and delivery arcs stay scripted and never stop. Tube and tray transfers use the same reusable physical landing service.

## Run

```sh
docker compose up --build
```

Open <http://localhost:5180>. On a phone connected to the same network, use `http://<your-computer's-LAN-address>:5180`.

## Play

- **Funnel Sort:** dump multiple trays into the funnel while earlier pours continue. Excess waits in the funnel until the moving belt has space. Fill the receiving boxes in order; a full belt that cannot drain is a dead end.
- **Tube Sort:** drag a matching top group into an empty tube or onto the same pattern. Two-tap input also works. Transfer as many as fit in one action and complete a tube for each type.
- **Tray Match:** the original layered puzzle: pick exposed marbles into the seven-slot rack. Any matching triple clears; finish sets before filling the rack.
- **Connected Match:** tap groups of three or more matching marbles connected along their sides. Columns collapse without refill. Clear the board within the move limit; stranded groups lose.

All four accept the next legal action while earlier animation continues. Every marble carries rings, diamonds, triangles or stars as distinct surface textures that rotate with the model. Undo, restart and hints work for all four. Keyboard: arrow keys select a piece, Enter/Space acts, U undoes, H hints, R restarts. Completion, the selected level and mute persist locally; an unfinished board starts fresh on reload. There is no account or cloud sync.

## Architecture

[AGENTS.md](AGENTS.md) fixes the permanent names, rules and development requirements.

[The engine and extension contract](docs/campaign-architecture.md) explains ownership. Register another gameplay pack in `src/campaign.ts`; it supplies level factories implementing `GameRuntime`. The campaign controller has no switch on gameplay kind. Shared marble resources and physics remain in `src/engine`.

[The POC plan](docs/poc-plan.md) records the twelve boards and verification boundaries.

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
docker compose --profile e2e run --rm e2e node scripts/inspect-feedback.mjs
```

This captures all twelve boards, desktop layouts and grayscale/low-quality checks into `output/poc12`. `scripts/capture-feedback.mjs` records a representative playthrough, advancing the game frame by frame so a software renderer does not change playback speed.
