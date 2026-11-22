# World progression and Workshop projects

Six authored island villages connect three-game construction stops. Play next level resumes the campaign frontier and completing a stop builds its mechanism. Players can orbit and zoom the village, browse the valley, replay completed villages’ 3D films and unlock optional Workshop projects that add persistent village rewards.

## Sub-features

- **Stops.** A fresh save opens at the Harbour. Available stops resume their first unfinished puzzle and built stops can replay all three. Completing a stop returns to the map. A map visit pauses the puzzle and preserves its in-page moves and Undo.
- **Navigation.** Play next level resumes the frontier even from an earlier village. The valley opens the 3D overview with available and locked destinations. Film is secondary while puzzles remain and becomes the primary action at campaign completion.
- **Village inspection.** Drag with one finger to orbit, even starting on a stop marker. Pinch with two fingers to zoom or move both to pan. Finishing or cancelling a drag leaves the player on the map. Reset village view restores the starting pose. Returning from a film replay restores the inspection pose.
- **Films.** The village’s actual machine and authored camera play in realtime 3D. Duration follows the route and the film ends in its own village. Reduced motion waits for Play film and uses fixed shots. Natural completion fires confetti in normal motion. Completing or skipping an earned film advances to the next available village. Explicit replay returns to the visited village.
- **Workshop.** The building hammer and footer open the same chooser, which lists projects across villages. A project requires its village and exact count of built local stops. Direct links and reload recheck the gate. Existing completed project IDs retain reward and replay access.
- **Project rewards.** Winning adds the village reward immediately and persists it. Campaign completion, built stops, village unlocks and film acknowledgements stay independent. Choosing a project sets `?workshop=<id>` and leaving the puzzle clears it.
- **Guides.** Tutorial hands appear in gameplay. Returning to a still-unseen puzzle restores its hand and Skip guide.

## How to get to it (user POV)

- Open the game normally. Tap Play next level (`.wv-play`) or an enabled `.map-stop[data-round="<zero-based round>"]`. From a campaign puzzle choose Back to village in the level menu.
- Tap The valley to browse villages. Use Reset village view if an inspection takes a marker offscreen.
- Tap the building hammer (`[data-world-workshop]`) or footer (`#world-workshop`). Open an available project or replay a completed one. In a puzzle, Back to workshop returns to the chooser. The chooser’s Back to the village returns to the map.
- Complete a village for Film. Back to map (`#film-skip`) skips it. With reduced motion, tap Play film once it is ready.

## Driving it with tw

- Run `tw map --run <id>` after doctor. It plays all three games from a fresh save, checks the stop builds and pauses the puzzle, then reloads and enters the next stop by touch.
- Run `tw workshop board-212 --run <id>` for the footer, chooser, project’s one-row menu and return path. Run `tw win board-212 --workshop --run <id>` for the project source and persisted badge. See [`workshop-projects.spec.ts`](../../../../tests/e2e/workshop-projects.spec.ts) for the real unlock boundary, locked deep links, and the reward and save isolation checks.
- [`world.spec.ts`](../../../../tests/e2e/world.spec.ts), [`world-navigation.spec.ts`](../../../../tests/e2e/world-navigation.spec.ts) and [`world-ui-regressions.spec.ts`](../../../../tests/e2e/world-ui-regressions.spec.ts) cover the primary CTA, 3D overview, unfinished puzzle return, earned films and the Workshop guide boundary.
- [`village-inspection.spec.ts`](../../../../tests/e2e/village-inspection.spec.ts) drives native orbit from a marker, pinch, pan, cancel, reset, and a film replay from an inspected pose. It checks that inspection leaves the save intact and the map stops drawing after input. Its other cases exercise all six islands and French reduced-motion controls.
- [`village-cinematic.spec.ts`](../../../../tests/e2e/village-cinematic.spec.ts) covers each village’s normal and reduced-motion phone playback and desktop replay. Set `CINE_RUN_LABEL` for a fresh capture folder and `CINEMATIC_NATURAL=1` for clock-driven phone playback. Use the [village authoring checks](../../../../.agents/skills/tumbleworks-village-authoring/references/checks.md) for geometry and whole-route motion. Inspect bends, moving handoffs and the full swept marble and track width against scenery and earned rewards at 375×690.
- [`world-performance.spec.ts`](../../../../tests/e2e/world-performance.spec.ts) exercises active film rendering, paused gameplay and quality guards. Keep timing runs isolated and record their source. See [World and Workshop checks](../integration.md).

## Gotchas

- Wait for `canvas[data-world-scene="ready"]` before using projected stop and building markers, and wait for `#journey-transition` to hide before tapping. Footer navigation, including Workshop, can be available during construction. `unavailable` indicates a failed build.
- For motion wait for `canvas[data-world-film="ready"][data-world-playback="realtime-3d"]`. The waiting screen has Back to map while the scene loads. Back during an earned film acknowledges it once.
- Locked cards use `aria-disabled`. Drive a refusal by tapping their measured bounds. Cards use `[data-workshop="<id>"]` with `data-status` equal to locked, available or completed.
- Workshop fixtures seed only campaign milestone IDs. Use the real boundary spec for claims about unlocking, and preserve storage across reload.
- Proof workers and static certificates belong to physical research routes. Production cinematic checks follow the authored route through the six villages.
