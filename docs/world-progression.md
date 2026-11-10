# The valley journey

**Goal / done when:** a map stop launches one round of Funnel Sort, Loop Sort and
Tube Sort. Its three stable level IDs must all be completed before the next stop
opens. Returning to the map installs a piece of the local marble machine. Ten
stops finish a location and unlock its short, replayable film. The map never
advances a puzzle, and the player explicitly taps the next stop.

**Interaction:** map → tap an available stop → resume its first unfinished puzzle
→ finish the round → construction appears on the map → tap the next stop. A
completed stop replays all three games. A partially completed round survives a
reload through the existing ID-based completion store. An unfinished puzzle
restarts, as before.

The map's yellow **Play next level** button starts the earliest unfinished
campaign puzzle through that same stop-entry path. It also resumes a paused
puzzle in-page. Numbered stops remain available for a specific stop or replay.
When viewing an earlier completed location, Play continues the campaign and
**Film** replays that location's machine. With the whole campaign complete,
film replay becomes the sole primary action. The local built count sits beside
the location's subtitle.

This hierarchy was agreed with Claude Opus 5.5 at high effort on 6 November 2026:
one primary action, compact secondary Film, no added footer row or animation,
and no scene/camera change unless phone captures demonstrate an overlap.

**Ownership:** `CAMPAIGN` owns ordering and membership. `world/progression.ts`
projects its IDs into rounds and chapters without interpreting bank numbers.
`App` owns the current screen and the accepted round. `WorldView` owns map input
and presentation. Gameplay rules do not know about the map. Workshop levels are
outside the campaign and cannot build a stop or unlock a film.

The completion store stays at `tumbleworks.progress.v1`. Film acknowledgements
use `tumbleworks.valley.v1`, keyed by a chapter's first and last stable level IDs.
On migration, already completed chapters are built and their films are available
for replay, without automatically showing every historical film. A newly earned
film stays pending until watched or skipped. Storage failures retain the current
session, as the existing game does.

An in-page map visit retains the current unfinished runtime and its undo history
when the player has already made accepted actions. A page reload still restarts
that puzzle. Newly earned films move to the next available location; an explicit
replay returns to the location being revisited.

**Rendering choice:** reuse the pinned Three.js renderer for a miniature village
and its growing track. A second graphics library or an always-running simulation
would add lifecycle and download costs without helping this journey. Map scenes
draw on entry, resize, construction and interaction, then rest. The game does not
step while on the map or watching a film. The live 3D film uses the same scene
art, one borrowed pooled marble and an authored timeline; no native video or
MP4 network request is needed. All timers and input captures are cleared at a
screen transition, and a completed film returns to a map that requires the next
stop's tap. Reduced motion waits for explicit Play and uses seven fixed shots,
with cuts at connector times and viewport-aware framing of the whole marble.

The map's hammer button (`[data-world-workshop]`) and footer Workshop button
(`#world-workshop`) both enter Atelier. Their accessible names intentionally
match; automated journeys must scope those selectors. The Workshop house's 3D
hammer sign responds near the marble's route-derived closest approach. This is
a restrained proximity response, without a physical cord or invented impact;
reduced motion uses a smaller swing without overshoot.

**Integration:** the calibrated campaign expansion owns the 180 registered levels
(60 rounds, six locations). The seven approved variety boards have separate stable
Workshop IDs. Their winning fixtures, hints and undo use the same runtime contract.
No campaign difficulty ceiling is raised to fit an optional experiment.

**Checks:** pure round/film migration tests; bounded exploration of progression
interleavings; real-touch map→round→construction journeys, partial-save resumption,
old-save migration, chapter film skip/replay, Workshop isolation, phone/desktop and
reduced-motion layouts; build/download and isolated gameplay frame budgets compared
with the recorded pre-map baseline. Browser performance is not physical-phone proof.

## The live marble run

`WorldFilm` runs the authored 25-second Rube Goldberg sequence, then gives later
locations a 2.5-second handoff into the preceding village. `RubeRoute` owns the
marble path and surface frames; moving cups and driven mechanisms use the same
authored time. Camera poses are seekable and return to the map rest. The seven
reduced-motion shots remain fixed between their authored cuts and widen for the
actual viewport aspect.

No unintended clipping is permitted. Geometry checks must cover the swept marble,
full channel width, moving surfaces, scenery and earned additions, with explicit
intentional contacts. Continuous capsule checks and 120 Hz moving-surface samples
have different coverage; neither a path-centre check nor a sampled pass replaces
inspection of the complete motion at the upright phone viewport.

Earlier H.264 export commands and decoder manifests belong to the previous
presentation. Runtime playback now renders through the shared Three.js stage;
those historical video results do not validate the current machine. Current
integration checks, counts and pending measurements are recorded in
[the 3D integration notes](world-3d.md).
