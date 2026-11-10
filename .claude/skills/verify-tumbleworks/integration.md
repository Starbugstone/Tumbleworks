# Current VillagePlans and Atelier verification

**Implemented locally; integrated proof pending.** Six distinct VillagePlans,
procedural terrain, Scene/Overview integration and the staged Blender kit are live
on the working tree. Root owns the exclusive source/browser/CPU window while
repairs continue. Keep skill scripts/configuration, served files, browser and
heavy jobs frozen. Markdown/evidence work only until explicit final handoff.
No new driver work is requested by this coordination update.

The owner reports core typecheck and focused regressions passed. The initial full
Scene batch was **39 passed / 29 failed out of 68 checks**, covering unresolved
clipping, visibility, targets and Clock geometry. Repairs are underway. This
maintenance update has not rerun those checks or opened a browser; implemented
source is not passing acceptance.

The [earlier 7 November ledger](integration-2026-11-07-3d-snapshot.md) preserves the
completed 2,081-unit, hygiene/gameplay/World and six-driver-journey snapshot. The
[6 November ledger](integration-2026-11-06.md) preserves the earlier native-video
and campaign work. **Neither ledger's passes cover this new tree.** Their source
hashes, failures, raw reports and fixture boundaries remain intact.

## Live implementation and source map

| Contract | Source |
| --- | --- |
| Authored stations, ports, connectors, mechanisms and per-village camera shots | [village-plan.ts](../../../src/world/village-plan.ts) |
| Compiled village program | [village-program.ts](../../../src/world/village-program.ts) |
| Six scene plans, construction styles, scenery, rewards and overview definitions | [village-plans.ts](../../../src/world/village-plans.ts), [villages/](../../../src/world/villages/) |
| Procedural terrain definition and rendering | [world/village-terrain.ts](../../../src/world/village-terrain.ts), [view/village-terrain.ts](../../../src/view/village-terrain.ts) |
| Runtime machine and camera | [village-machine.ts](../../../src/view/village-machine.ts), [village-film-camera.ts](../../../src/view/village-film-camera.ts) |
| Scene and overview consumers | [world-scene.ts](../../../src/view/world-scene.ts), [valley-overview.ts](../../../src/view/valley-overview.ts) |
| Blender kit and baking | [world-kit.ts](../../../src/view/world-kit.ts), [world-bake.ts](../../../src/view/world-bake.ts) |

The six definitions in `src/world/villages/` are selected by chapter. Their
geometry, mechanisms, terrain and camera recipes must be checked as authored
villages; passing one shared scene is not coverage of all six.

## Film and navigation contracts

[WorldFilm](../../../src/view/world-film.ts) remains realtime 3D: 25 seconds of
local machine playback, plus the 2.5-second previous-place handoff after the first
village. There is no HTML-video or MP4-network playback. Normal motion uses the
moving camera. Reduced motion waits for explicit Play and uses the selected
village's authored fixed shots, **at most seven**, rather than one universal
seven-view timeline. Read that plan's `camera` intervals when checking framing,
cuts and visibility through complete moving contacts.

The owner reports navigation, chooser, selectors and gates unchanged:

- `.wv-play` resumes the campaign frontier; Film stays secondary while campaign
  puzzles remain and becomes primary when the campaign is complete.
- Earned-film completion/skip advances to the next available village; explicit
  replay returns to the visited village.
- Map/overview visits preserve the unfinished campaign runtime and Undo in-page;
  reload restarts the unfinished puzzle.
- `[data-world-workshop]` is the building hammer and `#world-workshop` is the footer.
  Both retain the name Workshop / Atelier. Keep driver footer lookups scoped.
- `.wv-experiment[data-workshop="<id>"]` identifies the project, with
  `data-status=locked|available|completed` and `.wv-workshop-check` for completion.
  Selecting it sets `?workshop=<id>`; leaving clears the query.
- Reward `.wv-project-reward` and mechanic `.wv-project-cue` remain distinct
  images. Existing cue provenance is in
  [mechanic-insets.json](../../../assets/world-3d/mechanic-insets.json).

These are retained contracts, not fresh browser passes on the changed runtime.

## Campaign, projects and the unchanged driver

[campaign.ts](../../../src/campaign.ts) remains 60 rounds / 180 levels by stable
ID. No campaign assembly or lesson change is requested here. The mechanics
owner's Funnel/Loop/Tube feature notes remain preserved, including separate
`tube-210` cap opening and later cup folding.

[workshop-projects.ts](../../../src/world/workshop-projects.ts) remains the gate
authority. Chapters are zero-based and thresholds count fully built local stops;
the village must also be available.

| Project | Chapter | Built local stops |
| --- | ---: | ---: |
| `board-210` | 0 | 2 |
| `board-212` | 0 | 7 |
| `loop-210` | 1 | 3 |
| `tube-210` | 2 | 4 |
| `board-211` | 3 | 3 |
| `loop-211` | 4 | 5 |
| `tube-211` | 5 | 6 |

Retain chooser/direct-query/reload gating, refused locked touches, grandfathered
completed projects, immediate persistent rewards and campaign/film/current
isolation. [workshop-projects.spec.ts](../../../tests/e2e/workshop-projects.spec.ts)
holds their actual behavior checks; the historical passing result does not prove
the new integration.

The applied driver remains unchanged. Its
[hidden typecheck record](../../../output/current/verify/atelier-driver-apply-20261107/application.json)
and [six live journeys](../../../output/current/verify/verify-atelier-final-20261107T104045Z/summary.json)
belong to the earlier source snapshot, not this VillagePlans tree. Workshop
fixtures seed only the exact campaign milestone IDs, never a project win, and
write `fixture.json`; they are ordinary gameplay prerequisites, not unlock proof.
Do not modify or re-drive the harness until the owner explicitly hands over a
bounded slot. No selector adaptation is currently requested.

## Geometry, camera and acceptance requirements

The [AGENTS.md](../../../AGENTS.md) hard rule covers both clipping and coplanar
surfaces. The complete swept marble and track width must clear real geometry,
moving carriers, scenery and earned additions. Curves and surface frames must
join continuously, with intentional contacts/joints explicit. A clear centreline
or a still image is insufficient.

Exposed trim, panes and mechanism floors must have real surface separation or
one shared surface, including moving handoffs. Keep coplanar-overlap regressions;
renderer depth settings must not hide defective geometry. This rule also applies
to the reported house-wall and elevator/lift flicker.

Relevant checks now include [village clearance](../../../tests/world/village-clearance.test.ts),
[travel](../../../tests/world/village-travel.test.ts),
[terrain](../../../tests/world/village-terrain.test.ts),
[camera](../../../tests/world/village-camera.test.ts),
[scene identity](../../../tests/world/village-identity.test.ts),
[house surfaces](../../../tests/world/house-surfaces.test.ts) and
[lift surfaces](../../../tests/world/lift-surfaces.test.ts). Their presence is not
a passing run. Retain failing regressions and inspect the full machine motion at
375×690 after repairs, using each village's real camera and targets.

Current integrated Scene/browser/World/gameplay acceptance remains pending final
owner evidence. Old build bytes and timing results cannot establish this tree's
download or frame-time pass. Keep source/harness hashes, workload/quality checks,
raw scopes and the fixed gameplay budgets; do not transfer old native-video or
World results, invent timing ceilings or claim physical-phone performance.
No commit, push or deployment is authorized by this skill maintenance update.
