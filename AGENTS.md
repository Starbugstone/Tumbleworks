# Tumbleworks development reference

## Permanent game names

Use these exact names in the interface, documentation and development discussions. Keep the internal kind and level IDs stable so existing progress continues to load.

`docs/research/` preserves earlier exploration. This reference and the current registered campaign define the implemented POC.

| Permanent name | Internal kind / level IDs | Meaning and rules | Implementation |
| --- | --- | --- | --- |
| **Funnel Sort** | `conveyor` / `board-1`…`board-3` | The drop, funnel and belt game. Tip supply trays into the funnel; marbles feed a continuously moving belt and fill the requested boxes in order. Multiple dumps may overlap. Excess marbles wait in the funnel until belt space opens. A full belt is a dead end only when it cannot drain. | `src/gameplays/conveyor.ts`, `src/machine/`, `src/sim/`, `src/view/scene.ts` |
| **Tube Sort** | `tube` / `tube-1`…`tube-3` | Move a contiguous matching group from the top of one tube into an empty tube or onto the same pattern. Transfer as many as fit in one action. Support touch dragging and two-tap input. Sort full tubes of one type. | `src/gameplays/tube.ts`, tube sections of `src/puzzles/`, `src/view/tubes.ts` |
| **Tray Match** | `tray` / `tray-1`…`tray-3` | The original layered tray and seven-slot rack. Only exposed marbles can be picked. Any three matching types in the rack clear; filling it with unmatched marbles loses. This is distinct from Connected Match and must remain available. | `src/gameplays/tray.ts`, tray sections of `src/puzzles/`, `src/view/tray.ts` |
| **Connected Match** | `connect` / `connect-1`…`connect-3` | The additional neighboring-group game. Tap a whole group of at least three matching marbles connected horizontally or vertically. Diagonals do not count. Columns collapse without refill or sideways compaction. Clear the board within the move budget; stranded groups or exhausted moves lose. | `src/gameplays/connect.ts`, `src/puzzles/connect*.ts`, `src/view/connect.ts` |

“Drop game” and “belt game” mean Funnel Sort. “Original/older tray” means Tray Match. “New connect version” means Connected Match. Do not replace one matching mode with the other.

## Campaign and shared engine

- Maintain three evolving difficulties for each type: twelve POC levels, interleaved by difficulty in `src/campaign.ts`.
- Use registered `GameplayPack` factories and the `GameRuntime` contract. `App` handles campaign and HUD without branching on gameplay kind.
- Reuse `Stage`, `MarbleFactory`, `PhysicsService`, `BoardView` and `BoardPointer`. Add a new type without copying marble entities, renderer setup, physics initialization or pointer capture.
- Keep rule state authoritative and update it as soon as a legal action is accepted. Animation must allow the next legal action while earlier movement continues. Preserve actor identity and retarget from its current visible position. Undo must cancel presentation safely and restore the complete prior action.
- Funnel Sort uses physics for free falls, including release of waiting marbles from the funnel, with scripted belt transport and delivery. Never pull a waiting pile directly into belt slots. The belt keeps moving. Pending funnel marbles must be retained and included in undo, accounting and diagnostics. Supply trays and receiving boxes must display the matching pattern on the container where it remains visible when filled.
- Color accessibility is required by the player. Every marble, including transient/low-quality actors, must carry a distinct texture/pattern on the model: **red = ring, blue = diamond, green = triangle, yellow = star**. Patterns rotate with the marble. The player rejected large symbols and camera-facing badges because they detract from the marble; do not add them. Use the same shapes on receiving targets and include pattern names in hints. Never rely on hue alone.
- Keep touch, mouse, keyboard, undo, restart, current-state hints and local completion working across types. Test cancelled/invalid drags and rapid successive moves.

## Runtime and checks

The project uses TypeScript, Three.js and Rapier. Use the versions pinned in `package.json`. The development server runs through Docker Compose on port 5180 and is reachable by phones on the same LAN.

```sh
docker compose up --build
docker compose exec -T dev npm run typecheck
docker compose exec -T dev npm test
docker compose exec -T dev npm run build
docker compose --profile e2e run --rm e2e npx playwright test
```

Keep authored winning witnesses and actual losing choices for each difficulty. Verify real browser input, desktop/narrow layouts and grayscale pattern readability. Deterministic browser-clock tests prove behavior, not performance on a physical phone. Preserve pre-existing user processes and historical output artifacts.
