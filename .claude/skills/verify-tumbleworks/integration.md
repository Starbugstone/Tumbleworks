# World and Workshop checks

Use the [World progression feature recipe](features/world-progression.md) to drive the map, inspection controls, Workshop and films. Record the source, commands and evidence for the build under review.

## Source map

| Contract | Source |
| --- | --- |
| Village definitions, authored stations, ports, connectors, mechanisms and camera shots | [village-plans.ts](../../../src/world/village-plans.ts), [villages/](../../../src/world/villages/) and [village-plan.ts](../../../src/world/village-plan.ts) |
| Cinematic route, timing and playback | [village-cinematic.ts](../../../src/world/village-cinematic.ts), [village-machine.ts](../../../src/view/village-machine.ts) and [world-film.ts](../../../src/view/world-film.ts) |
| Island terrain and inspection camera | [village-terrain.ts](../../../src/view/village-terrain.ts), [tropical-island.ts](../../../src/view/tropical-island.ts) and [village-orbit.ts](../../../src/view/village-orbit.ts) |
| Map, Workshop chooser and valley overview | [world.ts](../../../src/view/world.ts), [world-scene.ts](../../../src/view/world-scene.ts) and [valley-overview.ts](../../../src/view/valley-overview.ts) |
| Blender kit and baking | [world-kit.ts](../../../src/view/world-kit.ts) and [world-bake.ts](../../../src/view/world-bake.ts) |

## Campaign and Workshop

[`PLAY_ORDER`](../../../src/campaign.ts) registers 60 rounds and 180 puzzles. The village selects a round. Its level menu shows that round’s three puzzles. The [project registry](../../../src/world/workshop-projects.ts) owns each Workshop gate.

| Project | Chapter (zero-based) | Built local stops |
| --- | ---: | ---: |
| `board-210` | 0 | 2 |
| `board-212` | 0 | 7 |
| `loop-210` | 1 | 3 |
| `tube-210` | 2 | 4 |
| `board-211` | 3 | 3 |
| `loop-211` | 4 | 5 |
| `tube-211` | 5 | 6 |

Use [`workshop-projects.spec.ts`](../../../tests/e2e/workshop-projects.spec.ts) for the actual gate, direct-query and reload behavior, immediate reward and save isolation. Use [`workshop-variety.spec.ts`](../../../tests/e2e/workshop-variety.spec.ts) for the puzzle mechanisms, including the separate spare opening and later cup fold on `tube-210`.

## Geometry and measurement

Use the [village authoring checks](../../../.agents/skills/tumbleworks-village-authoring/references/checks.md) for complete motion, timing, camera, clearance and coplanar surfaces. Check the actual swept width, intentional contacts and exposed surfaces according to [AGENTS.md](../../../AGENTS.md). Use [`village-inspection.spec.ts`](../../../tests/e2e/village-inspection.spec.ts) for the island and map controls and [`village-cinematic.spec.ts`](../../../tests/e2e/village-cinematic.spec.ts) for playback.

Keep World and puzzle workload measurements independent. Use [`world-performance.spec.ts`](../../../tests/e2e/world-performance.spec.ts), raw Playwright JSON and the [measurement summarizer](../../../scripts/summarize-world-measurements.mjs). Follow the [rendering cost procedure](../../../docs/verification.md) for the puzzle frame budget. Record source and harness revisions alongside the result.

## Earlier snapshots

The [7 November 3D snapshot](integration-2026-11-07-3d-snapshot.md) preserves its source hashes, 2,081 unit checks, World and gameplay measurements, and driver results. The [6 November snapshot](integration-2026-11-06.md) covers the earlier native-video and campaign work. Each result applies to its recorded tree.
