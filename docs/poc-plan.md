# Tumbleworks POC

## Current scope

One browser game, one campaign, four gameplay types, three difficulties each. Levels alternate Funnel Sort, Tube Sort, Tray Match, Connected Match, then repeat at the next difficulty. All twelve are directly selectable for playtesting, and Next level advances through that order.

The earlier Phaser build was replaced after playtesting called for a more appealing physical toy. Three.js renders the shared workshop and glass marbles. Rapier provides real free falls. The conveyor belt and delivery arc are scripted; the belt never stops.

## Difficulty banks

| Difficulty | Funnel Sort | Tube Sort | Tray Match | Connected Match |
| --- | --- | --- | --- | --- |
| Getting started | 3 pours, 18 marbles, 2 supplies | 3 colors, 2 spare tubes, 4-group witness | 12 marbles, simple matching covers | 4×4, 5 moves, 4-group witness |
| Finding a rhythm | 5 pours, 30 marbles, 3 supplies | 4 colors, 2 spares, 9-group witness | 18 marbles, cross-color covers | 5×5, 5 moves, 5-group witness |
| Thinking ahead | 7 pours, 42 marbles, 3 deeper supplies | 4 colors, 1 spare, 13-group witness | 24 marbles, more interleaved dependencies | 6×6, 7 moves, 7-group witness |

Tube move counts are verified winning witnesses, not claims of human difficulty or minimum length. Tray racks always hold seven marbles, and triples resolve before checking fullness. Every type has real dead ends and undo recovery. User playtesting still determines whether these difficulty steps feel right.

## Shared engine

See [campaign-architecture.md](campaign-architecture.md). `App` owns campaign progression and feedback through `GameRuntime`; it does not know gameplay-specific state. Registered adapters own rules and scene layout. `Stage`, `MarbleFactory`, `PhysicsService`, `MarbleDrop`, and `BoardView` own reusable rendering, marble entities, body construction, picking, framing and transfer animation.

The fifth-gameplay contract is exercised by a synthetic pack in the engine tests. This establishes registration and runtime integration without changing App; a real new mechanic still needs its own rules, level authoring and tests.

## Conveyor transport

Supplies hold packets of six. Real marbles tip into the funnel, then join evenly spaced moving slots. Matching marbles take a scripted arc into a three-slot box. Incoming marbles approach their belt slot on a short raised path to reduce overlap with circulating marbles. Accepted dumps stay in an ordered funnel backlog; belt occupancy is reserved one marble at entry; animation never changes the puzzle's color accounting.

Board 1: supplies A blue/red, B green; box pairs red, blue, green. A-A-B wins; A-B jams.

Board 2: A red/blue, B yellow/red, C green; box pairs red, yellow, blue, red, green. The full settled tree has both winning and jamming choices.

Board 3: A blue/red/yellow, B green/blue, C yellow/red; box pairs red, blue, yellow, green, red, blue, yellow. A-A-C-B-C-B-A wins; A-B jams. There are 19 settled winning release sequences and 23 jam sequences.

## Recovery and hints

The shared controls call the active runtime. Undo restores a full rule snapshot; conveyor undo additionally restores Rapier state and animation control. Restart recreates the level. Hints search the current state with a bound and only recommend a verified continuation. If unresolved or currently blocked, the game suggests waiting or undoing rather than inventing a move.

Completion, selected level and mute are validated in local storage. A failed write leaves this session's progress in memory. Unfinished attempts restart after reload; no cloud save is claimed.

## Verification

- Rule tests: all twelve winning witnesses; legal and illegal actions; conservation; real jams; undo; current-state hints; tray seventh-slot triple; malformed snapshot rejection.
- Engine tests: a fourth gameplay pack and uneven banks, duplicate registration, shared Rapier body/landing behavior, and storage fallback/migration.
- Conveyor tests: varied real-physics schedules, undo during transport, recovery counts and existing pace limits.
- Browser journeys: all twelve boards through real touch hit targets, Next transitions, all-type jam/undo, hints and restart, reload, storage denial, desktop and narrow-phone layouts.

Browser tests advance the actual fixed simulation clock explicitly to make software-rendered runs repeatable. This proves those interactions, not frame-rate performance on a physical phone. Audio is synthesized; listening quality still needs a user check.

## Names and matching variants

[AGENTS.md](../AGENTS.md) defines the permanent names. Tray Match retains its layered board and rack. Connected Match is an additional pack; it does not replace Tray Match. Its group tapping follows the interaction used by [Toon Blast](https://peakgames.helpshift.com/hc/en/4-toon-blast/faq/5-how-to-play/), adapted here to a minimum of three, a finite board, no refill and authored move limits.

Tube Sort supports contiguous group transfers, mobile drag/drop and tap fallback. Shared actors can be retargeted while moving. Every quality mode keeps repeated surface patterns on the model; hints and receivers use the same ring/diamond/triangle/star mapping.
