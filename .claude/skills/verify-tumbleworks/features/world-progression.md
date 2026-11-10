# World progression and Atelier projects

Six distinct authored villages with procedural terrain and a 3D overview connect three-game construction stops. Play next level resumes the campaign frontier; finishing a stop builds its mechanism and returns to the map. Completed villages offer realtime 3D films with their own camera shots. Optional Atelier projects unlock at declared milestones and add persistent rewards without advancing campaign stops or films. VillagePlans/Scene/Overview and the staged Blender kit are implemented locally with proof pending; earlier World/browser/gameplay and driver passes do not cover this tree.

## Sub-features

- `map-entry` normal boot shows the village, Play action and ten stop targets. A runtime behind the map is paused; its existence alone is not usable gameplay proof. The built count is in the subtitle, not the retired `.wv-progress` line.
- `primary-play` `.wv-play` is `▶ Play next level` / `▶ Jouer le niveau suivant` and resumes the global campaign frontier even from an earlier visited village. Film is secondary while campaign puzzles remain and the sole primary action after campaign completion.
- `round-resume` partial stops resume their first unfinished puzzle. Completed stops replay all three games. Map/overview visits preserve the current unfinished campaign runtime and exact Undo in memory after accepted moves; reload restarts the unfinished puzzle.
- `round-return` Next level stays within the accepted stop. Completing its three games returns to the map; entering another stop requires a player action.
- `village-plans` six VillagePlans define distinct stations, connectors, mechanisms and camera recipes; scene plans also author terrain, construction, scenery and reward placements. Scene and Overview consume the live plan/terrain implementation. Source presence is not acceptance of geometry, visibility or targets.
- `valley-overview` the wider valley uses procedural 3D terrain and authored village definitions with labels and accessible/locked destination behavior, not a static illustration.
- `chapter-film` realtime `WorldFilm` uses the selected village's actual scene, track and moving rigs for 25 seconds, plus a 2.5-second previous-place handoff after the first village. Normal playback uses a moving camera. Reduced motion waits for explicit Play and follows that village's authored fixed shots, at most seven; there is no universal seven-view timeline. There is no HTML video or MP4 network playback.
- `film-return` earned-film completion/skip advances to the next available village; explicit replay returns to the visited village. Film acknowledgement remains separate from campaign and project completion.
- `atelier-entries` `[data-world-workshop]` is the round 44 px hammer over the Workshop building; `#world-workshop` is the retained footer button. Both are named Workshop / Atelier and open the same current-village chooser. The 3D sign reacts to the passing marble; this is not a new physical hit or rope obstacle.
- `project-gates` `src/world/workshop-projects.ts` declares the seven chapter/local-stop thresholds. Every player chooser/direct-query/reload entry checks availability; a locked query opens the chooser and clears the query. A native tap on a locked card is refused. Old saved project completions retain reward and replay access without a campaign prefix.
- `project-reward` a true project win adds its persistent 3D village reward before reload. It must not alter campaign completion/current level, built main stops, village unlocks or film acknowledgements.
- `project-route` selecting a project sets `?workshop=<id>`; returning to chooser/map clears it. Cards retain `[data-workshop="<id>"]` with `data-status` of locked/available/completed. `#film-skip`, `#map-open`, project IDs and the game brands stay stable.
- `guide-boundary` tutorial hands stay inside gameplay. Returning to a still-unseen puzzle restores its hand and Skip guide. Earlier 3D UI coverage included the unseen-guide/Workshop boundary; it is not a fresh pass on the changed village runtime.

## How to get to it (user POV)

- Open normally and tap Play next level or an enabled `.map-stop[data-round="<zero-based global round>"]`.
- Open Valley map (`#map-open`) from the picker to visit the village without discarding accepted in-page moves; The valley opens the 3D overview.
- Tap the building hammer or footer Workshop / Atelier. Use scoped `#world-workshop` when automating the footer; exact accessible name alone now matches two map buttons.
- Finish enough local stops for the desired project, or replay a previously completed project. Thresholds/rewards and old-save exceptions are listed in [`../integration.md`](../integration.md).
- Finish a village for Film. Back to map (`#film-skip`) ends it; reduced motion offers explicit Play film. A locked `?workshop=<id>` is not a bypass.

## Driving it with tw

Preconditions:

- Root owns the source/browser/CPU window for VillagePlans/terrain/Scene repairs. Do only Markdown/evidence work; keep scripts/config/served files and browser/heavy jobs frozen until explicit final handoff. No new driver work is requested; routes/selectors/gates are reported unchanged.
- Workshop driver adaptation was applied/typechecked and live-proven for `board-212` chooser/win/jam on the earlier 297-file snapshot. Those passes do not cover this new tree. See [`../integration.md`](../integration.md) for the historical proof and fixture limits.

- **Driver adaptation.** The applied patch scopes both footer lookups to `#world-workshop` and seeds exact campaign milestone IDs for ordinary project gameplay. It never seeds a project win. This disposable presentation fixture is not evidence of unlocking through play. The [application record](../../../../output/current/verify/atelier-driver-apply-20261107/application.json) records hidden typecheck exit 0; the [bounded live summary](../../../../output/current/verify/verify-atelier-final-20261107T104045Z/summary.json) records all six journeys passed without corrections. `board-212` used exactly 21 campaign IDs for seven local stops. Win persisted the chooser badge; jam Undo returned to playing, without asserting a full physics fingerprint.
- **Real gates and rewards.** [`workshop-projects.spec.ts`](../../../../tests/e2e/workshop-projects.spec.ts) covers the real third-puzzle milestone, one-step-before refusal, direct-query/reload gating, old completed IDs, immediate visible reward, reload persistence, campaign/film/current isolation and French/grayscale/reduced-motion cards. Earlier passing cases are historical for their hashes; the changed integration needs fresh evidence after handoff. A seeded ordinary-gameplay journey cannot replace boundary checks.
- **3D entry and navigation.** [`world-navigation.spec.ts`](../../../../tests/e2e/world-navigation.spec.ts), [`world.spec.ts`](../../../../tests/e2e/world.spec.ts) and [`world-ui-regressions.spec.ts`](../../../../tests/e2e/world-ui-regressions.spec.ts) own current overview, CTA, map-peek, query and tutorial boundaries. `[data-world-workshop]` and `#world-workshop` must reach the same chooser/current village.
- **Causal film and camera.** Read the actual selected plan in [`village-plans.ts`](../../../../src/world/village-plans.ts) and its authored shots, then use the relevant travel/camera/Scene browser checks after handoff. The new [`village-camera.test.ts`](../../../../tests/world/village-camera.test.ts) and [`village-travel.test.ts`](../../../../tests/world/village-travel.test.ts) complement actual motion inspection; their presence is not a pass. Observe `canvas[data-world-playback="realtime-3d"]`; do not use old universal-shot or MP4 assertions as current Film proof.
- **Rendering measurements pending.** The earlier World 4/4 and gameplay/hygiene 6/6 results belong to a different tree. Each live village machine/terrain/camera needs fresh source-matched evidence and workload/quality checks; active film draws remain expected and hidden gameplay must remain paused. Keep the established gameplay ceilings and raw World scopes. See [`../integration.md`](../integration.md).
- **No clipping or coplanar overlap.** Check actual swept marble/track width, moving rigs, terrain, scenery/rewards and exposed trim/panes/floors, including moving handoffs, then inspect complete motion at 375×690. Require real surface separation or one shared surface; renderer depth settings must not conceal defective geometry. Keep collision and coplanar-overlap regressions. Source/test paths are in [`../integration.md`](../integration.md); a clear centreline or still image is insufficient.

## Gotchas

- Gates count built local stops and village availability, not bank numbers. Grandfathered project completion is a replay/reward exception, not a campaign unlock.
- Locked cards may carry `aria-disabled`; a locator can wait instead of performing the refusal tap. Boundary specs use real touchscreen input at measured bounds.
- Campaign-milestone fixtures must seed only actual campaign IDs and preserve storage on reload. Never seed Workshop completion to claim a win, reward creation or gate behavior.
- The `tube-210` cap opens on move 4 and its cup folds later; old simultaneous-event expectations are stale. Preserve the mechanics owner's updated Funnel/Loop/Tube notes.
- Wait for `#journey-transition` to be hidden before input. Language switching may close the picker; paused UI clocks must allow its pop-in to finish.
- Earlier build bytes, geometry/preview/audio counts and frame timings apply only to their recorded source. They do not establish a current VillagePlans download or performance pass.
- The owner reports core typecheck/focused regressions passed, but the initial full Scene batch was 39 passed / 29 failed out of 68, with clipping/visibility/targets/Clock geometry under repair. No current integrated World/browser/gameplay pass is claimed. The [earlier ledger](../integration-2026-11-07-3d-snapshot.md) retains the prior 2,081-unit combined proof and six driver journeys. Functional and performance proof stay separate; browser measurements establish no physical-phone claim.


## Responsive construction and proof readiness (Startup133)

The map heading and footer appear while native construction runs. Wait for
`canvas[data-world-scene="ready"]` before asserting badge/building placement;
`building` deliberately hides those targets and leaves footer navigation usable.
`unavailable` is a construction failure, not a completed map. Workshop may open
against the plain background before any village scene exists.

Film opens its own screen immediately. `canvas[data-world-film="waiting"]` has
one status line and Back to map; it is not motion readiness. Wait for
`canvas[data-world-film="ready"][data-world-playback="realtime-3d"]` before
observing motion. `unavailable` must never play. Reduced motion still requires
native Play film after ready. Back while waiting is the existing skip and must
acknowledge an earned film exactly once; a repeated callback must not advance twice.

For cancellation journeys, leave during construction, snapshot/hash, worker or
acceptance via the real footer/puzzle controls. Confirm no worker/build remains
while away. Return to a retained complete scene: an unfinished proof must use a
fresh generation/request; a completed certificate remains scene-local with deep
native invalidation. A partially built first Harbour defers its proof intentionally;
its earlier first frame is not evidence of faster completed proof work. Keep the
actual native camera/physical failures separate from these lifecycle checks.
