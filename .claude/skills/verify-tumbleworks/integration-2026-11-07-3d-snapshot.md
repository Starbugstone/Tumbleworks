# Historical 7 November 3D snapshot

This ledger predates the six VillagePlans/procedural-terrain integration. Its passing reports apply only to their recorded source hashes. The universal seven-view camera description below is historical; the current runtime authors up to seven reduced-motion shots per village. Read [the current integration handoff](integration.md) before using a recipe.

---

# Current 3D world and Atelier verification

The runtime has Blender-authored village and overview geometry, realtime 3D films
and gated Atelier projects. **The last combined snapshot passed all planned local
checks; a new house-wall/lift flicker report is now under investigation.** Root
owns the new exclusive source/browser/CPU window for the geometry correction.
Keep scripts/config/served files and browser/heavy jobs frozen; do only
Markdown/evidence work. The earlier pass applies to its exact recorded hashes,
not the forthcoming correction. Await root's fresh visual/surface-regression
proof and final contract/hash handoff before changing readiness for that fix.

[The 6 November ledger](integration-2026-11-06.md) preserves earlier evidence,
including the 6/6 gameplay gate, 4/4 native-video measurements, unit/layout passes,
failed attempts and raw attachments. Those results do not validate this later
3D runtime. In particular, zero WebGL work during HTML-video playback is no longer
the film workload, and the former 2 MB build result is not the current ceiling.

## Campaign and ownership

`PLAY_ORDER` in [campaign.ts](../../../src/campaign.ts) remains 60 rounds / 180
levels. Project IDs stay separate from campaign membership. The permanent game
names, stable save IDs, phone reference of 375×690 CSS px and existing desktop
layout still apply. No product edits, commits, pushes or deployment are authorized
by this maintenance update.

The mechanics owner's Funnel/Loop/Tube feature notes have been preserved. They
include column-front taps for paired crates, padlocks/straps on blocked shelves,
sealed-dock lid/key cues, linked-truck partner chips and tall-home pattern plaques.
The current `tube-210` opens its spare on move 4 and folds its cup on a later move;
no reachable move does both. Historical simultaneous cup/cap assertions must not
be reused as current proof.

Mechanics has delivered seven real gameplay crops, grayscale-checked and totalling
33,908 bytes, under
[the retained inset evidence](../../../output/current/verify/insets-20261107T103159/probe/).
Original colour/grayscale captures, per-project state and
[crop rectangles](../../../output/current/verify/insets-20261107T103159/probe/insets/rects.txt)
are retained separately from the reward artwork. They show shelf locks/straps,
the pair handle, a waiting full box's pause sign, a latch, the linked trucks, the
open spare with its cup still holding marbles, and the tall-home ring plaque.
The final `tube-211` plaque correction shows the complete ring above its plate;
mechanics re-proved its browser case after that correction. Root installed the
seven crops at `/models/projects/cues/<id>.png`, with provenance in
[mechanic-insets.json](../../../assets/world-3d/mechanic-insets.json). The larger
72 px `.wv-project-reward` and separate 64 px `.wv-project-cue` remain distinct.
The [final chooser reporter](../../../output/current/world-3d/cue-final/reporter.json)
records six passing cases in 68.8 seconds, including exact gates, locked links,
grandfathered saves, actual reward installation/isolation and French grayscale
phone/desktop cards with both images. This is separate from the skill driver run
below and from final performance acceptance.

## Village, overview and realtime film

[WorldView](../../../src/view/world.ts) uses the Blender scene and overview, with
[WorldFilm](../../../src/view/world-film.ts) for realtime playback. Film runs for
25 local seconds and, after the first village, adds a 2.5-second handoff to the
previous place. Normal motion uses the close moving camera. Reduced motion waits
for explicit Play and uses seven fixed camera views with paired mechanisms between
cuts. It is not the old HTML video/MP4 path: no HTML video element or `/films/*.mp4`
network request is expected.

Earned-film completion/skip advances to the next available village; explicit
replay returns to the visited village. Map/overview visits preserve the current
unfinished campaign runtime and Undo in memory; page reload still restarts the
unfinished puzzle. Keep rule stepping paused while world presentation runs.

Two map controls intentionally share the accessible name Workshop / Atelier:

- `[data-world-workshop]` is a round 44 px hammer over the actual Workshop building.
  It opens the same chooser for the current village. The 3D sign/hammer reacts when
  the film marble passes the building.
- `#world-workshop` is the retained footer entry. Use this scoped selector in the
  ordinary driver; an unscoped exact-name Workshop locator is now ambiguous.

`[data-workshop="<id>"]` identifies a project card, with `data-status` of locked,
available or completed. The old dataset-key chooser crash was reproduced and
fixed by the owner; its before-trace remains in `output/current/workshop-return-bug`.
Current gate, chooser, navigation and sign proof is recorded in the
[3D validation ledger](../../../output/current/world-3d/final-validation.json).
The retained before-trace and earlier chooser passes remain separate evidence.

## Project gates and rewards

[workshop-projects.ts](../../../src/world/workshop-projects.ts) owns the gates.
Chapter indices below are zero-based; counts are **fully built local stops**, not
bank ID suffixes or a simple frontier comparison. The village must be available.

| Project | Chapter | Local stops required | 3D reward |
| --- | ---: | ---: | --- |
| `board-210` | 0 | 2 | Cargo gantry |
| `board-212` | 0 | 7 | Twin-bell pavilion |
| `loop-210` | 1 | 3 | Garden waterwheel |
| `tube-210` | 2 | 4 | Rain collector |
| `board-211` | 3 | 3 | Clockwork gate |
| `loop-211` | 4 | 5 | Bridge windmill |
| `tube-211` | 5 | 6 | Glass terrace |

All player Workshop entry, direct-query and reload paths check `canEnterProject`.
A fresh locked `?workshop=<id>` opens the chooser and clears the query; a native
touch on a locked card is refused. Existing saved project completions are
preserved: they retain replay access and their reward even without the campaign
prefix. A project win adds its persistent 3D village reward **before reload** and
must not change campaign completion/current level, main stop construction or film
progress. Development `?try=` bank access is not evidence of a player unlock.

[workshop-projects.spec.ts](../../../tests/e2e/workshop-projects.spec.ts) owns actual
boundary, locked-entry, old-save, reward and isolation proof. Test the exact real
third-puzzle completion at a milestone and the rejected path immediately before
it. For a locked card, real touchscreen input at measured DOM bounds can exercise
the refused tap; locator auto-waiting on `aria-disabled` is not that input proof.

## Driver adaptation and bounded live proof

The authorized patch was applied to `scripts/tw.ts` after checking its exact base
hash and a clean patch application. The hidden driver typecheck exited 0; shell
syntax, Markdown links/feature structure and whitespace checks passed. The
tsconfig hash is unchanged. See the
[application record](../../../output/current/verify/atelier-driver-apply-20261107/application.json)
and its adjacent typecheck log/exit marker. The later bounded live run passed
without any further driver/configuration or product change. Scripts/configuration
remain frozen during root's subsequent wall/lift geometry investigation.

The applied changes scope both footer lookups to `#world-workshop`, and use a
campaign-milestone fixture for ordinary Workshop win/jam/controls/render/chooser
journeys. The fixture contains only the actual `CAMPAIGN` IDs through the target
project's milestone: prior chapters, then the required local stops. It seeds no
Workshop completion, writes its exact IDs and purpose to `fixture.json`, and does
not overwrite storage on reload. This is a disposable presentation/gameplay
precondition, **not unlock proof**. Never seed a project win to prove winning or
immediate reward creation. Compare campaign state with the seeded baseline rather
than assuming the fresh first stop remains available.

The authorized final slot passed all six journeys in
[`verify-atelier-final-20261107T104045Z`](../../../output/current/verify/verify-atelier-final-20261107T104045Z/summary.json):

- `doctor`: normal map boot, a real stop tap into gameplay and all 180 picker chips.
- `picker`: pattern legend, French/English controls, unchanged puzzle fingerprint
  across language switching and a real chip selection.
- `map`: three actual first-stop wins, construction, explicit next-stop entry,
  persistence through reload and no hidden puzzle advance on the map.
- `workshop board-212`: scoped footer/chooser entry, the exact project source/ID
  from a real card touch and return to map without changing the campaign fixture.
- `win board-212 --workshop`: authored real touches win, campaign completion stays
  unchanged, Back returns to the chooser, and the completion badge survives reload.
- `jam board-212 --workshop`: authored real touches jam, the card/Undo attention
  appear, and Undo returns to playing. This journey does not assert the complete
  restored physics snapshot; keep exact-Undo proof separate.

All commands exited 0 on their first attempt. Screenshots, state, results, logs
and exit markers are retained; no failure or correction was discarded. All 297
files matched the frozen
[source baseline](../../../output/current/world-3d/final-source-before.json)
before and after. Each Workshop journey seeded exactly the first 21 campaign IDs
for chapter 0 / seven built stops, never a project win, with its own `fixture.json`.
This proves the ordinary driver route and gameplay under that fixture, not the
unlock boundary or every project's causal mechanic. Dedicated project tests retain
that proof. The run's lease is absent and only the reused dev container remains.
The slot was explicitly released; no further browsers or heavy jobs are scheduled
by this skill. This live run and the later passing combined checks match the same
297-file baseline. They do not establish proof for the new wall/lift correction.
Historical driver results remain tied to their saved sources.

## Clearance and evidence requirements

The updated [AGENTS.md](../../../AGENTS.md) hard rule forbids unintended 3D
clipping. The marble must follow the real track and moving cup/lever/lift surfaces;
its swept volume and the full track width must clear walls, supports, crossing
track, scenery and earned additions. Curves and surface frames must join smoothly.
Intentional contacts/joints must be explicit; keep each reported collision as a
failing regression. A clear path centre is insufficient.

Current guards include [actual track triangles and swept capsules](../../../tests/world/track-clearance.test.ts),
[moving rig/contact geometry](../../../tests/world/rube-geometry.test.ts),
[terrain clearance](../../../tests/world/terrain-clearance.test.ts) and
[scenery/earned-addition clearance](../../../tests/world/scenery-clearance.test.ts).
They complement complete-motion inspection at the upright phone viewport; unit
checks alone do not establish the absence of visible clipping or phone smoothness.

## Last completed snapshot and current follow-up

The [integrated proof](../../../docs/performance/world-3d-integrated.json) and
[root ledger](../../../output/current/world-3d/final-validation.json) record the
completed combined run at
[`combined-final-20261107T104422Z`](../../../output/current/world-3d/combined-final-20261107T104422Z/).
Its planned pending list was cleared before the later flicker report.

| Check | Result for that recorded snapshot |
| --- | --- |
| Full units | 2,081 tests / 67 files passed in 193.39 seconds; none failed or skipped. |
| Typecheck / lint / build | All exited 0. |
| Render hygiene | 6/6 passed. |
| Fixed gameplay gate | 6/6 passed in 192.1 seconds (3.2 minutes), at unchanged ceilings with no overrides. |
| Realtime World measurements | 4/4 passed in 36.7 seconds; ten raw scopes retained. |
| Source and baselines | All 297 source/harness hashes and both timing-baseline hashes unchanged. |

The three final browser reporters have no skipped, flaky or unexpected results.
All six gameplay cases performed accepted actions and met the active-work guards.
The final [World raw summary](../../../output/current/world-3d/combined-final-20261107T104422Z/world-summary.json)
retains equal source hashes, zero gameplay work and natural ratio 1.25,
468×862 backing / 375×690 CSS px at 4× CPU slowdown. Active realtime film rendering
is expected; idle rendering is zero. These World measurements add no timing
ceilings and do not establish physical-phone performance or a measured speedup.

Earlier focused proof remains indexed separately: 100/100 world unit checks,
25 distinct UI passes across three reports, the six final chooser cases and the
six bounded skill live journeys. The 25 UI cases are combined coverage, not one
all-green run; five corrected harness failures remain retained. The earlier
35.6-second World run remains in `measurements-final-1/`. The 25-second, 600-frame
authored motion clip remains visual evidence only. These earlier results are not
summed into the final full-unit count or substituted for the final measurements.

The completed build was 2.106 MB under the explicitly recorded 2.125 MB ceiling in
[world-3d-baseline.json](../../../docs/performance/world-3d-baseline.json), replacing
the former 2 MB ceiling for this authorized 3D change. The baseline records the
old-ceiling failure, not a retroactive pass. Runtime geometry gzip is
118,577 / 120,000 bytes; combined reward/cue PNGs were 72,296 / 100,000 bytes
(38,388 reward + 33,908 cue); audio was 37,470 / 45,000 bytes. These asset counts
belong to that snapshot and are not frame-time measurements. Gameplay frame
ceilings were unchanged.

[world-performance.spec.ts](../../../tests/e2e/world-performance.spec.ts) now
observes realtime 3D cargo and camera motion with no gameplay work, alongside
construction, built chapters and idle. The old native-video assertion of no
continuing Stage draws cannot validate realtime film rendering. Retain raw samples,
source/harness hashes, workload/activity/quality checks and an explicit baseline.
All owned jobs/containers were closed after the completed checks; reused dev was
preserved. No commit, push or deployment occurred. Root then received the new
house-wall and elevator/lift z-fighting/flicker report and opened a fresh exclusive
window to correct actual coplanar geometry. **That correction and its fresh visual
and surface-regression proof remain pending.** Await the final contract/hash
handoff and assess any further checks against its actual changed scope. Do not
carry either the completed combined run or older native-video evidence across
new source hashes as current acceptance.
