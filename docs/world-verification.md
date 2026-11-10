# Valley integration evidence

This ledger records checked behavior, measurement boundaries and retained failed
attempts. Browser measurements are regression proxies, not measurements
of a physical phone.

## Current Blender 3D integration — 7 November

The current village, wider world, causal marble machine, Workshop hammer marker
and animated 3D sign have **25 distinct passing UI journeys**. Evidence is split
across `output/current/world-3d/integrated-ui-final-1/` (19 passes),
`navigation-retry/` (five corrected cases) and `workshop-sign-check/` (three
passes, including two repeats). The original five failures are retained: four
asserted visibility of a zero-height navigation parent whose fixed-position
buttons were visible; one assumed level zero after seeding campaign progress.
Only the harness assumptions were corrected. The original run's 99-file source
audit was unchanged. This is combined case coverage, not a single all-green run.

The journeys cover map-first navigation, three-game returns, wider-world travel,
exact Atelier gate boundaries, locked direct links/reloads, old completed saves,
optional completion isolation and visible reward installation before reload.
Real taps on the map hammer and footer enter the chooser. Actual sign poses are
checked before, during and after the marble's pass in both motion modes.

The focused world unit run passed **100/100**; its machine-readable report is
`output/current/world-3d/world-units-final.json`. Guards check the whole marble
against actual track and mechanism triangles, including continuous rolling
segments, moving carriers, scenery, terrain and installed rewards. Deliberate
crossing and between-sample grazing mutations are rejected. The original phone
clipping reports and pre-fix geometry are retained in `clipping-report/`.

The corrected 25-second run was rendered to 600 frames and inspected at the
loop, spiral, rounded switchbacks, funnel and Workshop. The final review clip is
`output/current/world-3d/motion-final-1/machine-preview.mp4`; `capture.json`
records unchanged source/gameplay state and zero browser errors. This authored
24 fps presentation capture is not performance evidence.

All four isolated realtime 3D World measurements passed on the final combined
tree in **36.7 seconds**, following an earlier pre-cue pass in 35.6 seconds, with
ten retained raw scopes and equal source hashes. Construction reached full
scale through natural App frames; resting map rendering and hidden gameplay
work were zero. Film motion used actual rendered marble and camera positions.
The [measurement report](performance/world-measurements.md) records setup,
submission and RAF timings, natural ratio 1.25 and the browser measurement limits.

Typecheck and lint passed. The latest production build passed at
**2.106 / 2.125 MB**, against the explicitly recorded
[3D download baseline](performance/world-3d-baseline.json); fixed geometry is
118,577 / 120,000 gzip bytes, reward and cue PNGs 72,296 / 100,000 bytes and audio
37,470 / 45,000 bytes. No gameplay frame-time ceiling changed.

The skill driver update is now applied against its checked base and passed its
hidden typecheck; its tsconfig is unchanged. Evidence is retained in
`output/current/verify/atelier-driver-apply-20261107/`. This proves compilation,
not a live journey. The subsequent current live driver pass completed all six
bounded journeys without a failed attempt: doctor, picker, map, chooser, Workshop
win/reload/isolation and jam/Undo. Evidence is under
`output/current/verify/verify-atelier-final-20261107T104045Z/`. Ordinary Workshop
journeys seeded only the exact first 21 campaign IDs and recorded their fixture;
they did not seed a project win or replace the dedicated boundary tests.

All seven real gameplay crops are installed separately from reward artwork;
all six `workshop-projects.spec.ts` cases passed afterward in 1.1 minutes.
Phone/desktop French grayscale captures, image decoding and exact cue paths are
retained in `output/current/world-3d/cue-final/`. The announced full-ring Tube Sort
plaque correction is preserved; all twelve delivered mechanics/guide source
hashes matched through root integration.

The final serial combined run passed **2,081 unit tests across 67 files** in
193.39 seconds, then typecheck, lint, build, **six render-hygiene cases**, the
**unchanged six-case gameplay gate** in 3.2 minutes and the four World cases
above. No skipped/flaky/unexpected browser results, timing overrides or changed
limits occurred. All 297 product/harness hashes and both timing-baseline hashes
stayed unchanged. Raw reports, commands, exit codes and host snapshots are in
`output/current/world-3d/combined-final-20261107T104422Z/`; the
[persisted integration report](performance/world-3d-integrated.json) indexes them.
Sol's final read-only resource/frame/navigation review found no material issues;
it is recorded separately from executed verification.

The current integration checks are complete. All owned browser/CPU jobs are
closed and the shared dev server is preserved. Earlier passes below belong to
the 6 November source and native-video implementation and retain their original
scope. No commits, pushes or deployment have been performed.

## Historical 6 November baseline

The campaign owner registered 180 levels (60 rounds), preserving the original
120 IDs, definitions and order. The pre-map App source hash is
`fd0cbbbe48db84b30f885c7e5e31b25246e3086360faf3429607dc68b76f4fa8`.
The source archive is `output/current/campaign-41-60/pre-map-source.tar.gz`.
Nine isolated calibration samples passed. The subsequent normal six-case gate
passed two and failed four during recorded unrelated host contention; its
limits were retained. See
[`campaign-41-60-baseline.json`](performance/campaign-41-60-baseline.json).

## Historical 6 November integrated checks

The clean single-worker unit run passed **48 files / 1,970 tests** in 375.72
seconds, exit 0. Its retained log and exit marker are
`output/current/world/full-unit.{log,exit}`. This includes the previously timed-out
Tube Sort 12/15/16 cases without raising their limits.

The world subset passed 19 progression, film-store, timeline and lifecycle tests. They
cover complete triples, locked future entry, within-round Next, partial saves,
out-of-order historical completions, Workshop/retired-ID exclusion, 180/360-level
projection, stable film keys, old-save migration and unavailable storage. The
bounded progression model explores all 64 two-round completion subsets and
rejects deliberate future-entry and cross-round mutations. The film actor
lifecycle check failed before the correction and now proves that the shared
MarbleFactory lends and reclaims its actor. `bash scripts/check-models.sh` also
finished with exit 0: every holding/liveness configuration passed, and each
deliberate mutation/reachability configuration failed as required.

The pre-CTA frozen-tree `world.spec.ts` run passed all **eight cases** in
2.0 minutes (`output/current/world/final-world.log`). It covers 44 CSS-pixel
phone map targets, no idle Stage/gameplay work or startup film request, three
real-touch wins and round boundaries, partial old-save reload with retired IDs,
desktop/French navigation, exact Undo after visiting the map, Workshop query
navigation across reloads, earned-film advance/replay and explicit reduced-motion
playback.

The final map action layout was agreed with Claude Opus 5.5 at high effort:
**Play next level** is primary and enters the existing campaign frontier, Film
is a compact secondary action, and a completed campaign makes Film the sole
primary action. Progress appears in the subtitle. All **ten unique World browser
cases** are green across `output/current/world/cta-final.log` (nine passed) and
`output/current/world/cta-final-attempt-2.log` (two passed, including one desktop
repeat). The first attempt's remaining case failed in the harness: it reopened
the language picker after changing locale had already closed it. The corrected
English/French case passed with product source unchanged. The earlier Vite-reload
interruption remains historical evidence, not a product failure or passing run.

The bounded existing input, save, onboarding and navigation batch passed
**30 unique cases**: `output/current/world/final-regression.log` records 18 passes
before stopping on a paused-browser-clock picker helper, and
`output/current/world/final-regression-attempt-2.log` records 13 passes in 3.9
minutes with one overlapping case. Only the clock/picker helper changed between
those attempts; neither partial attempt is described as a complete suite run.

The pre-guide-fix source and harness hashes and check summary are retained in
`output/current/world/final-source.json`. The post-review snapshot is
`output/current/world/post-review-source.json`: changes are the generic non-game
`#guide-pointer` CSS selector, the new `world-ui-regressions.spec.ts`, and the
World measurement harness strengthened with source hashes and
presented-video-frame guards. Rules and campaign source are unchanged. The earlier
`output/current/world/integrated-source.json` predates the World CTA changes in
`world.ts` and `world.css`. The reported missing-map incident was a production
versus localhost mix-up: no product bug was reproduced. Normal
`http://localhost:5180/` boot, three wins and map progress update passed. Nothing
has been deployed as part of this verification.

Captures are under `output/current/world/`. Type checking and lint passed, and a
fresh post-guide-CSS production build passed at **1.970 MB / 2.000 MB** first
download, with the ceiling unchanged. All six silent portrait H.264 films decoded successfully:
540×960 at 24 fps, 11 seconds for the first and 13.5 seconds for later locations,
333–422 KB each. They load only on demand. Exact byte counts, frame counts,
durations and SHA256 values are in `output/current/world-films/manifest.json`.

A fresh-map → Workshop journey reproduced a tutorial hand leaking onto the map
before the fix. The correction only changes the generic non-game
`#guide-pointer` CSS selector. The same real-touch regression then passed in
31.3 seconds, including Back, Play restoring the guide, and Skip. Evidence:
`output/current/world/guide-before.log`, `guide-after.log` and
`guide-typecheck.log`. Typecheck also passed after the fix. Rules and campaign source did not change.

The verification-maintenance thread separately passed nine representative
journeys, including controls across all three games, map/chooser entry, a shared
pallet win with zero recoveries, campaign isolation, persisted Workshop badge,
and the single-use-cup jam/undo. Its original reload assertion incorrectly used a
campaign chip and is retained as harness-failure evidence. The corrected run is
under `output/current/verify/verify-maintenance-20261106-2023/`.

The seven-concept causal Workshop journeys and both payoff/reduced-motion cases
also passed. Their evidence and retained harness correction are described in
[`gameplay-variety.md`](gameplay-variety.md). The focused `board-212` win/reload rerun after the query-navigation correction
passed in 2.6 minutes, following map → chooser. Its evidence is under
`output/current/gameplay-variety/integrated-final-20261106-2146/`; the verification
doctor also passed.

Render hygiene passed **six cases in 2.3 minutes** on the unchanged post-review
source snapshot. All 60 registered Loop Sort levels passed phone and desktop
card-bound checks in **6.1 minutes**. Logs are
`output/current/gameplay-variety/integrated-post-review-20261106/hygiene.log`
and `loop-bounds.log` in the same directory.

The separate Loop Sort number-readability case **failed its unchanged 300-second
timeout**. `number-timeout-analysis.json` in that directory records 2,630
successful assertions covering all 60 IDs and no font/clipping assertion failure;
that evidence does not reclassify the failed test. The unchanged-limit retry
passed in **1.9 minutes** under lower entry load (9.16), with identical source
and the same 300-second limit (`loop-numbers-retry.log`). Full-page grayscale
captures were also inspected. These checks and the fresh build are retained under
`output/current/gameplay-variety/integrated-post-review-20261106/`.

The final isolated six-case gameplay performance gate passed **six of six in
3.8 minutes**, with original ceilings, no environment overrides, and all activity
and quality guards passing. The source-frozen audit remained unchanged. Evidence:
`output/current/gameplay-variety/integrated-budget-20261106T221241Z/` and
[the integrated gameplay report](performance/gameplay-variety-integrated.json).
This new integrated run resolves the pending gameplay gate; the earlier contended
pre-map two-pass/four-fail run remains historical evidence.

## Historical native-video World measurements

All four isolated World cases passed twice: 48.3 seconds initially, then 33.4
seconds with `--reporter=list,json` to retain passing body attachments. No
source/test/configuration changes occurred between runs. The first list-only run
lacked persisted raw body attachments; the second retains ten raw scopes,
reporter JSON and summaries under
`output/current/world/measurements-final-20261106T2219/`. All ten scope hash
comparisons and all 91 broad post-review source hashes matched.

At real clock, 4× CPU slowdown and unchanged natural ratio 1.25 (375×690 CSS,
468×862 backing), construction showed 25 distinct scales from 0.05 to 1 and 24
natural draws plus its event draw. Natural draw p50/p95/max was
4.6/16.8/17.4 ms. Each of six chapters completed twelve requested draws; idle
made 183 App advances over 3,028.5 ms with zero Stage submissions, renderer-frame
increments or gameplay work. The first MP4 advanced 3.0291 seconds during its
3,026.6 ms steady window, with 73 total frames, one dropped and 72 presented;
continuing Stage submissions, renderer-frame increments and gameplay work were
zero. Full timings, host load and uneven frame intervals are recorded in the
[measurement report](performance/world-measurements.md). No timing ceiling was
invented, and these browser results establish no physical-phone performance.

The scoped 6 November checks listed in this historical section were complete.
Current 3D integration status and remaining work are recorded at the top.
