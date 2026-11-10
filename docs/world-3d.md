# Blender world and optional village projects

The village, marble run and valley overview share the game's Three.js renderer.
Terrain, houses and landmarks are meshes authored in Blender. Their depth,
lighting and camera projection come from geometry. PNGs appear only in Atelier
cards, where they preview the permanent additions.

## Authoring and import

`scripts/author-world-terrain.py` builds the terraced terrain, river and ten
construction anchors. `scripts/author-world-kit.py` builds the reusable houses,
landmarks and mechanisms. The editable sources are
`assets/world-3d/terrain.blend` and `assets/world-3d/village-kit.blend`.
[The kit contract](../assets/world-3d/README.md) documents axes, origins and pivots.

`scripts/pack-world-models.py` packs integer mesh streams losslessly into the two
runtime JSON files in `assets/world-3d/`. Positions, authored normals, palette
indices and triangle indices survive an exact round trip. `WorldAssets` builds
scene-owned geometry from those streams; the renderer needs no additional loader
library. The GLB files remain available as interchange exports.

`WorldScene` merges static pieces with a shared vertex-colour material. Moving
parts keep their own pivots. The map rests between construction or camera input.
Its bounded drag returns to the framing used by the ten construction buttons.
Reduced motion returns immediately. `ValleyOverview` shows six real village
clusters at a time and can pan by rows if the campaign later adds more villages.

The completion film renders the 3D Rube Goldberg machine directly for 25 seconds.
Later locations add a 2.5-second handoff into the preceding village. It borrows
one plain marble from `MarbleFactory`, pauses gameplay, and returns that actor
before changing scenes or leaving playback. No native video or MP4 request is
part of this presentation. Reduced motion waits for explicit Play, then uses seven
fixed shots: wide opening and ending views, with five paired-mechanism views
between them. Distances fit the complete marble at the current viewport aspect;
shots cut only at the authored connector times and never pan within a shot.
The earlier MP4 measurements describe the previous presentation.

The Workshop house has a hammer map button (`[data-world-workshop]`) as well as
the footer button (`#world-workshop`). Both have the accessible name Workshop
(or Atelier); browser journeys must scope their selector or use these IDs rather
than assume the name is unique. The raised cream hammer sits on a dark teal 3D
medallion in front of the house. Its response is timed from the actual route's
closest approach, with no physical cord or claimed marble strike. The normal
swing settles after a small return; reduced motion uses a shorter, smaller swing
without overshoot. The bracket is static and the sign is one merged mesh.

No unintended 3D clipping is allowed. The actual swept marble volume and the
track's full width must clear walls, supports, other channels, scenery and earned
additions. Intentional contact surfaces and connected joints must be explicit.
Continuous capsule checks cover rolling spans; moving cups and mechanisms have
120 Hz sampled checks and their stated sampling limits. A clear path centre or
passing sampled checks alone do not prove complete geometric clearance. Keep
collision regressions and inspect the complete upright-phone motion.

## Atelier progression

Each project requires a number of fully built stops in its own available village.
A stop still requires all three campaign puzzles. The chooser, direct Workshop
query and runtime entry all check the same project metadata.

| Stable ID | Village | Required local stops | Permanent addition |
| --- | --- | --- | --- |
| board-210 | 1 | 2 | Cargo gantry |
| board-212 | 1 | 7 | Twin-bell pavilion |
| loop-210 | 2 | 3 | Garden waterwheel |
| tube-210 | 3 | 4 | Rain collector |
| board-211 | 4 | 3 | Clockwork gate |
| loop-211 | 5 | 5 | Bridge windmill |
| tube-211 | 6 | 6 | Glass terrace |

Completed Workshop IDs in older saves retain their rewards and replay access,
even if the new village requirement has not been reached. A Workshop win never
completes a campaign puzzle, constructs a campaign stop or changes film eligibility.
The addition appears on the existing village scene before reload and survives
reload through the saved stable ID. The overview includes earned additions too.

`assets/world-3d/project-recipes.json` defines the reward compositions used by
both `createProjectReward` and the Blender preview exporter. The seven preview
PNGs therefore depict the same meshes installed in the village. Project guides
use accepted gameplay actions, retain undo and restart, and remain separate from
campaign tutorial preferences.

Each chooser card pairs its larger reward render with a separate, smaller crop
of the real mechanic: shelf straps, paired handle, pallet pause, receiving latch,
coupling bar, open spare with a filled cup, or tall-home ring plaque. Crops keep
their original aspect ratio inside their inset. Their provenance is recorded in
[`mechanic-insets.json`](../assets/world-3d/mechanic-insets.json); they add 33,908
bytes within the shared project-image budget. They are presentation captures,
not evidence that a development bank route unlocked a project.

## Budgets and proof

The pre-3D first download passed at 1.970 MB under 2.000 MB. The first integrated
Blender version measured 2.092 MB and failed that earlier ceiling. The agreed new
ceiling is 2.125 MB; the change is recorded explicitly in
[the 3D baseline](performance/world-3d-baseline.json).

Independent guards cap compressed runtime geometry at 120,000 bytes and optional
project PNGs at 100,000 bytes. Geometry imported into JavaScript is already part
of the first-download total and is not added a second time. The audio ceiling
remains 45,000 bytes, and gameplay frame-time ceilings remain unchanged.

The current Rube rig contains **24,660 triangles across 25 meshes**; the separate
Workshop sign adds **116 triangles and one draw**. Compressed fixed art is
**118,577 / 120,000 bytes**, with that ceiling unchanged. The final combined build
passed at **2.106 / 2.125 MB**, with audio **37,470 / 45,000 bytes** and reward/cue
PNGs **72,296 / 100,000 bytes**. The full single-worker suite passed **2,081 tests
across 67 files**, followed by typecheck and lint. These asset counts are not a
frame-rate result.

All 100 focused world unit checks passed together. Browser proof
covers 25 distinct UI journeys: 19 of 24 passed initially, five passed after
harness corrections, and an additional real 3D-sign journey passed in both motion
modes. Targeted Rube/reduced-motion/resize checks also passed. Evidence is under
`output/current/world-3d/integrated-ui-final-1/`, `navigation-retry/` and
`workshop-sign-check/`. The corrected complete 600-frame motion capture and all
four isolated realtime World measurements passed. All six Atelier project cases
also passed after cue installation, including real gate/win/reward paths and
French grayscale cards on phone and desktop. Their current report is
`output/current/world-3d/cue-final/reporter.json`. The final combined gameplay
budget passed all six cases with unchanged limits and no overrides. All four
World measurements also passed again on this final tree. The six current skill live journeys
passed with all 297 source/harness hashes unchanged, and render hygiene passed
six cases. The full-unit/build checks above use this final combined tree. The
[persisted final report](performance/world-3d-integrated.json) indexes commands,
raw reports and the unchanged-source audit.
These scoped results do not establish physical-phone performance. See
[world measurements](performance/world-measurements.md) for workload definitions
and separately scoped historical results.
