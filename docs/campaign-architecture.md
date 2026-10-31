# Twelve-level POC

**Goal / done when:** one campaign contains three increasing difficulties each for Funnel Sort, Tube Sort, Tray Match and Connected Match. Each can be completed, undone and restarted through the same interface, and completions survive reload. Conveyor motion remains continuous; only free falls use physics.

**Caller sketch:** open the next unfinished level → read its rule cue → tap the board → undo/restart or complete → advance to the next kind. The twelve level buttons also allow direct POC playtesting.

**Shape:** `App` owns the campaign and HUD. `CampaignRegistry` interleaves registered gameplay packs. Each level factory creates a `GameRuntime`; App never inspects tube, tray or conveyor state to drive gameplay. A runtime owns its rules, animation and level-specific scene. `Stage` owns one renderer, lighting setup and `MarbleFactory` across the campaign. `PhysicsService` owns initialization, world timing and marble body construction. `MarbleDrop` is the common physics landing used by the new puzzles. Conveyor keeps its established funnel world, snapshots and scripted belt.

**Options considered:** one large controller switching on level kind, or registered runtime adapters. Chose adapters because a fourth type must be addable without editing the campaign controller, shared marble resources, or physics service. The adapters expose the actual differences rather than forcing all puzzles into a conveyor data model.

**Persistence:** completion and selected level use validated local storage with an in-memory fallback. Board attempts restart on reload; there is no cloud sync. Undo snapshots belong to the current runtime and include conveyor physics.

**Evidence:** unit tests validate rules, all authored solution witnesses, registry composition and physics landing. Browser journeys exercise each type, failure/undo, campaign transitions and reload. The running Docker URL stays on port 5180. Actual phone performance and audio remain user playtest checks.

**Extension:** implement a new `GameplayPack` with level factories implementing `GameRuntime`, register the pack in `campaign.ts`, and add its rule witnesses and browser journey. Shared resources are supplied through `GameServices`; do not construct another renderer or copy marble materials into the new gameplay.

## Input and animation

`BoardPointer` owns capture, drag thresholds, tap fallback and cancellation. A runtime optionally supplies drag semantics. `BoardView` keeps actors by stable ID and retargets existing motion from the visible position; rule actions do not wait for animation. Undo cancels active motion before restoring a layout. Funnel Sort separately accounts for accepted funnel backlog and occupied belt slots. See [AGENTS.md](../AGENTS.md) for canonical names and gameplay requirements.
