# Campaign architecture

The registered campaign follows `PLAY_ORDER` in [src/campaign.ts](../src/campaign.ts), interleaving Funnel Sort, Loop Sort and Tube Sort by round. Every level can be completed, undone and restarted through the same interface, and completed levels survive a reload. The current release scope and future campaign target are recorded in [verification.md](verification.md).

## Ownership

- `App` owns the campaign and the HUD. It never reads gameplay state directly.
- `PLAY_ORDER` selects stable level IDs; `CampaignRegistry` resolves their registered gameplay factories.
- A level factory creates a `GameRuntime`, which owns its rules, animation and scene.
- `Stage` keeps one renderer, environment and `MarbleFactory` for the whole campaign. Each scene owns its lighting.
- `MarbleCrowd` draws the many marbles in the two conveyor games with instancing.
- `PhysicsService` owns initialization, world timing and marble body construction.
- `MarbleDrop` is the shared physics landing for Tube Sort.
- `Sparks` pools completion particles in one instanced draw and clears them on undo.
- Funnel Sort has its own physics world, undo snapshots and scripted belt.
- Each conveyor machine owns its belt path. `FigureEightTrack` samples distance, height and tangent; `beltDeck` draws that same path, including the bridge. The original oval paths stay the default.
- Runtimes provide optional `guideId` and current `GuideStep` values. `App` draws a tap icon at the named target without branching on game kind or blocking input.
- `preferences.ts` validates language and seen-guide preferences separately from campaign progress. `i18n.ts` supplies bilingual copy; live language changes update labels and completion textures without recreating the runtime.

We chose registered runtimes over one controller that switches on level kind. This lets a new type arrive without changes to the campaign controller, the marble resources or the physics service. It also keeps the puzzles out of a shared conveyor data model that most of them do not fit.

## Adding a gameplay type

1. Implement a `GameplayPack` whose level factories return a `GameRuntime`.
2. Register the pack in `src/campaign.ts`.
3. Add winning orders, losing choices and a browser journey for it.

Take shared resources from `GameServices`. Do not create another renderer or copy marble materials.

## Persistence

Completed levels and the selected level use validated local storage, with an in-memory fallback. Language and completed/skipped introductions use a separate validated settings key with the same session-only fallback. A board restarts on reload, and there is no cloud sync. Each runtime owns its undo snapshots, and Funnel Sort's snapshots include its physics world.

## Input and animation

`BoardPointer` owns pointer capture, drag thresholds, tap fallback and cancellation. A runtime can add drag behavior. `BoardView` keeps actors by stable ID and retargets a moving actor from where it is on screen, so rule changes never wait for animation. Undo cancels active motion before it restores a layout. Funnel Sort counts marbles waiting in the funnel separately from marbles on the belt.

## Evidence

Unit tests cover the rules, the authored winning orders, registry composition and the physics landing. Browser tests cover each type, losing and undoing, level transitions and reload. Phone performance and audio still need a person to check them.

Retired Tray Match and Connected Match IDs are ignored when selecting a level, without deleting completed sorting levels or the mute setting. Lorry goal markers come from each authored truck’s deepest segment and stay fixed while its exposed cargo changes.
