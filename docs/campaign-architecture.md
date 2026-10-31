# Campaign architecture

The campaign has five levels each of Funnel Sort and Loop Sort, and three of Tube Sort. Every level can be completed, undone and restarted through the same interface, and completed levels survive a reload.

## Ownership

- `App` owns the campaign and the HUD. It never reads gameplay state directly.
- `CampaignRegistry` interleaves the registered gameplay packs by round.
- A level factory creates a `GameRuntime`, which owns its rules, animation and scene.
- `Stage` keeps one renderer, the lighting setup and `MarbleFactory` for the whole campaign.
- `MarbleCrowd` draws the many marbles in the two conveyor games with instancing.
- `PhysicsService` owns initialization, world timing and marble body construction.
- `MarbleDrop` is the shared physics landing for Tube Sort.
- `Sparks` pools completion particles in one instanced draw and clears them on undo.
- Funnel Sort has its own physics world, undo snapshots and scripted belt.

We chose registered runtimes over one controller that switches on level kind. This lets a new type arrive without changes to the campaign controller, the marble resources or the physics service. It also keeps the puzzles out of a shared conveyor data model that most of them do not fit.

## Adding a gameplay type

1. Implement a `GameplayPack` whose level factories return a `GameRuntime`.
2. Register the pack in `src/campaign.ts`.
3. Add winning orders, losing choices and a browser journey for it.

Take shared resources from `GameServices`. Do not create another renderer or copy marble materials.

## Persistence

Completed levels and the selected level use validated local storage, with an in-memory fallback. A board restarts on reload, and there is no cloud sync. Each runtime owns its undo snapshots, and Funnel Sort's snapshots include its physics world.

## Input and animation

`BoardPointer` owns pointer capture, drag thresholds, tap fallback and cancellation. A runtime can add drag behavior. `BoardView` keeps actors by stable ID and retargets a moving actor from where it is on screen, so rule changes never wait for animation. Undo cancels active motion before it restores a layout. Funnel Sort counts marbles waiting in the funnel separately from marbles on the belt.

## Evidence

Unit tests cover the rules, the authored winning orders, registry composition and the physics landing. Browser tests cover each type, losing and undoing, level transitions and reload. Phone performance and audio still need a person to check them.

Retired Tray Match and Connected Match IDs are ignored when selecting a level, without deleting completed sorting levels or the mute setting. Lorry goal markers come from each authored truck’s deepest segment and stay fixed while its exposed cargo changes.
