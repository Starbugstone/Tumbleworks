# Tumbleworks development reference

## Permanent game names

Use these exact names in the interface, documentation and development discussions. Keep the internal kind and level IDs stable so existing progress continues to load.

`docs/research/` holds the reference research on the inspiring games. This reference and the current registered campaign define the implemented POC.

| Permanent name | Internal kind / level IDs | Meaning and rules | Implementation |
| --- | --- | --- | --- |
| **Funnel Sort** | `conveyor` / `board-1`…`board-7` | The Marble Sort style game. Tap a crate of nine marbles; they fall with physics into a clear funnel and pile there. The neck takes one marble at a time onto a belt that never stops, while the belt has room; the rest wait in the pile. Every dock has its own visible queue of three-slot boxes; the front box takes its colour as it passes, then the queue scrolls up. A full belt that cannot drain is a dead end. | `src/sim/` (rules, hint search, boards), `src/machine/`, `src/view/scene.ts`, `src/gameplays/conveyor.ts` |
| **Loop Sort** | `loop` / `loop-1`…`loop-7` | The truck game: tube sorting on a ring. Trucks park in bays facing the loop; each bed holds colour segments packed against the cab. A truck takes its loop-end colour automatically as it passes the mouth. Tap a truck to pour its loop-end segment onto the loop and reach the segment behind it; a one-colour truck cannot be poured. A truck full of one colour clears the line and the next truck in the bay rolls up. The deepest segment fixes a truck's final colour, shown permanently by the cab paint and roof pattern. Moving tailboard chevrons indicate unloading; a pause symbol indicates that the full loop is holding the pour. The loop has a capacity; a full loop nobody can take from is a dead end. Rules count units. The loop is divided into capacity slots that travel with it, and each unit is drawn as rows of three tiny marbles filling its slot, so a full loop looks full. | `src/loop/` (rules, hint search, boards, layout, machine), `src/view/loop-scene.ts`, `src/gameplays/loop.ts` |
| **Tube Sort** | `tube` / `tube-1`…`tube-3` | Move a contiguous matching group from the top of one tube into an empty tube or onto the same colour. Transfer as many as fit in one action. Support touch dragging and two-tap input. Sort full tubes of one type. | `src/gameplays/tube.ts`, tube sections of `src/puzzles/`, `src/view/tubes.ts` |

“Drop game”, “belt game” and “Marble Sort style” mean Funnel Sort. “Truck game” means Loop Sort. Tray Match and Connected Match have been retired at the player’s request. Keep their saved IDs harmless; do not restore them to the campaign.

Reference material: Voodoo's Marble Sort! (funnel, belt, box columns) and Loop Sort (trucks on a loop). The feel targets taken from them: many marbles on screen, continuous motion, a tap that pays off within a tenth of a second, bulk resolution when a box or truck completes, and almost no interface over the toy.

## Campaign and shared engine

- Funnel Sort and Loop Sort each have seven levels; Tube Sort has three, for seventeen levels total. The registry interleaves them by round in `src/campaign.ts`.
- Use registered `GameplayPack` factories and the `GameRuntime` contract. `App` handles campaign and HUD without branching on gameplay kind.
- Reuse `Stage`, `MarbleFactory`, `MarbleCrowd` (instanced marbles for the two conveyor games), `PhysicsService`, `BoardView` and `BoardPointer`. Add a new type without copying marble entities, renderer setup, physics initialization or pointer capture.
- Keep rule state authoritative and update it as soon as a legal action is accepted. Animation must allow the next legal action while earlier movement continues. Preserve actor identity and retarget from its current visible position. Undo must cancel presentation safely and restore the complete prior action.
- Funnel Sort uses physics for the fall out of the crate and for the pile in the funnel. The neck is a closed floor with a scripted single-file exit (the earliest pour first among the marbles resting on it), because a physical hole of one marble width arches. Belt transport and delivery are scripted and the belt keeps moving. Waiting marbles in the pile must be retained and included in undo, accounting and diagnostics; the hint search approximates the pile as first in, first out. Loop Sort is fully scripted. Crates, boxes and cargo blocks must display the matching pattern on the container where it remains visible when filled.
- Color accessibility is required by the player, who is colour-blind and found yellow and green too close. The palette keeps a luminance gap between every pair: yellow is by far the brightest, green is a deep teal. Marbles themselves are plain glossy spheres in their natural colour: the player rejected surface textures, large symbols and camera-facing badges on marbles. The pattern language lives on the containers instead: crates, boxes, cargo blocks, truck cabs, tube slot rails and hints use **red = ring, blue = diamond, green = triangle, yellow = star**, and the legend sits in the level picker. Never rely on hue alone for a container.
- Keep touch, mouse, keyboard, undo, restart, current-state hints and local completion working across types. Test cancelled/invalid drags and rapid successive moves.
- Keep the interface out of the way: one slim top row (level pill, counter, sound), three round icon buttons at the bottom, a short instruction toast. The level picker, title, difficulty and pattern legend live behind the level pill. The player asked for the toy to fill the screen.
- The first three campaign levels teach their controls with small gently animated tap-hand icons over real targets, not visible text instructions. Guides follow accepted rule state, can be skipped or restarted, and remember completion. Existing level completion must not hide an unseen guide. Respect reduced-motion settings. English and French can be switched without restarting a puzzle. Keep the permanent game names as brands in both languages.
- The first two Loop Sort levels start empty and fit all intended pours without a capacity stall. Keep congestion for later levels. Each conveyor type ends with two figure-eight levels; movement and the raised bridge must use the same per-machine path as the mesh.
- Frame mobile views around playable pieces rather than decorative bases, keeping touch targets and departures clear of the HUD.
- Keep ambient and perimeter lighting steady. The player rejected flashing or chasing side lights. Put motion and completion feedback at the active truck, crate or receiving box.

## Runtime and checks

The project uses TypeScript, Three.js and Rapier. Use the versions pinned in `package.json`. The development server runs through Docker Compose on port 5180 and is reachable by phones on the same LAN.

```sh
docker compose up --build
docker compose exec -T dev npm run typecheck
docker compose exec -T dev npm test
docker compose exec -T dev npm run build
docker compose --profile e2e run --rm e2e npx playwright test
docker compose exec -T dev npx tsx scripts/board-tree.ts      # Funnel Sort release trees, for authoring
docker compose exec -T dev npx tsx scripts/loop-tree.ts       # Loop Sort tap trees, for authoring
docker compose exec -T dev npx tsx scripts/machine-soak.ts    # physical Funnel Sort witnesses, recoveries must stay 0
docker compose exec -T dev npx tsx scripts/loop-soak.ts       # scripted Loop Sort witnesses
docker compose --profile e2e run --rm e2e node scripts/peek.mjs <levelIndex>   # phone and desktop captures into output/current/peek
```

Keep authored winning witnesses and actual losing choices for each difficulty. Verify real browser input, desktop/narrow layouts and grayscale readability of colors and container patterns. Deterministic browser-clock tests prove behavior, not performance on a physical phone. Preserve pre-existing user processes and historical output artifacts: specs and capture scripts write to `output/current`, never into `output/poc9` or `output/poc12`.
