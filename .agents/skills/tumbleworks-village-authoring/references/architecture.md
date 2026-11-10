# Architecture and authoring contracts

Source code is authoritative. Read actual interfaces before edits. Historical
fixed-25-second films, universal shots and old mover timing are not live contracts.

| Responsibility | Source |
| --- | --- |
| Plan, mechanism, port and profile types | [village-plan.ts](../../../../src/world/village-plan.ts) |
| Explicit registry, scenery, Workshop/rewards/overview slots | [village-plans.ts](../../../../src/world/village-plans.ts) |
| Authored data and compact helpers | [villages/](../../../../src/world/villages/), [author.ts](../../../../src/world/villages/author.ts) |
| Contact frames, profiles and docking surfaces | [machine-primitives.ts](../../../../src/view/machine-primitives.ts) |
| Validation, compiled timeline and absolute sampling | [village-program.ts](../../../../src/world/village-program.ts), [village-prefix.ts](../../../../src/world/village-prefix.ts) |
| Rolling, moving-floor and coupled gravity contact | [village-rolling.ts](../../../../src/world/village-rolling.ts), [village-moving-contact.ts](../../../../src/world/village-moving-contact.ts), [village-gravity-roll.ts](../../../../src/world/village-gravity-roll.ts) |
| Capture, retained carries, gates and terminal pad | [village-capture.ts](../../../../src/world/village-capture.ts), [village-retained.ts](../../../../src/world/village-retained.ts), [village-gate.ts](../../../../src/world/village-gate.ts), [village-terminal.ts](../../../../src/world/village-terminal.ts) |
| Declared contact law, typed failures and work ledger | [village-contact.ts](../../../../src/world/village-contact.ts) |
| Renderer and cached geometry bounds | [village-machine.ts](../../../../src/view/village-machine.ts) |
| Shared terrain mesh and exact triangle query | [world terrain](../../../../src/world/village-terrain.ts), [terrain renderer](../../../../src/view/village-terrain.ts) |
| Camera, reduced shots, Scene, playback and overview | [village-film-camera.ts](../../../../src/view/village-film-camera.ts), [village-film-shots.ts](../../../../src/view/village-film-shots.ts), [world-scene.ts](../../../../src/view/world-scene.ts), [world-film.ts](../../../../src/view/world-film.ts), [valley-overview.ts](../../../../src/view/valley-overview.ts) |

## Plans and layout

- Key plans by chapter. Location kinds repeat; no modulo, transform or fallback.
  Future campaign registration is a separate decision: adding a plan does not
  register or unlock rounds beyond the campaign. Preserve IDs, stops and gates.
- Ten stable stops run 9→0. Ports are world-space marble-centre frames, with unit
  perpendicular tangent/normal and usable width. Generate moving docks through
  `stationPorts`/`mechanismPorts`. Each connector includes exact source exit and
  destination entry; mismatches must not be blended away.
- Author separate badge literals and stems to true anchors/door. Map/overview
  readability matters alongside film. Use actual sequence/spatial identity tests.
- Primitive geometry is world-space. An extra anchor-translated parent double
  offsets it. Construction wrappers pivot at anchors; scaling spans squashes joints.

## Physics and moving hardware

- `machine.route.duration` is authoritative, `route.plan` is compiled and
  `route.authoredPlan` preserves story metadata. Authored times and
  `VILLAGE_DURATION` are not speed prescriptions or film time warps.
- Consumers read `contacts`, `transfers`, `boundaries` and `handoff`. The suffix
  uses `CONNECTION_SECONDS` and the published physical entry/cause; do not squeeze
  an entire carrier station into it.
- Preserve seek/replay and `marbleOrientation()`. Distance/radius erases actual
  slip/spin or rigid carry. Reduced motion changes camera/construction, not physics.
- Check support/traction on every span and moving seam. Captures need an actual
  floor/head, finite stroke and angular/linear balances. A curved catch cannot
  silently use a planar model; prove the receiving chord/frame/grade/window.
- A source weight needs a connected load path and bounded brake at its actual
  moving guide. Closure, release and carry all spend finite work. A stationary
  slot cannot dissipate carriage motion. Unsupported mechanisms stay typed errors.
- Use disjoint rendered-body inventories. Retained-body inertia is central;
  gravity-lever inertia is about its hinge. Count attached blocks/auxiliaries.
- `contactBounds(stop)` includes complete station/support/linkage extremes;
  outgoing connectors belong to whole-machine `bounds()`. Queries must not seek
  or mutate the visible machine. Include all visible mover IDs; inspect `matrix`
  for objects with `matrixAutoUpdate=false`.

## Terrain, surfaces and art

Compile terrain once for both mesh and height query. Water/void returns
`undefined`, never an invented seabed. Support y is the true top, not marble
centre. Void crossings need real supported spans and bank mounts.

Audit complete foundation bottoms against every intersected terrain cell and
triangle, including interior cuts. Centres/four corners miss slopes. Include
extruded/union feet, prop foundations, and supports crossing other route levels.
Appending frames can move default fractional mounts: pin intended old mounts
with `supportIndices`. Refine actual warped floor facets when needed; preserve
original frames. Do not coarsen curved contact frames to save triangles. Exact
mesh simplification needs oriented coverage, boundary/crease/normal proof and an
unchanged trajectory.

Reuse kit instances with uniform scale, rotation and translation. For real art
changes use [author-world-kit.py](../../../../scripts/author-world-kit.py),
[pack-world-models.py](../../../../scripts/pack-world-models.py) and the Blender
workflow when available. Stage exports, inspect renders, preserve required
streams/palette/scales, and measure compressed art before installing. Depth bias
and renderer settings do not fix overlapping exposed faces.
