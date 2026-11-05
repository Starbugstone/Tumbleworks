# Alpha 0.0.1 review

Local release verification passes, including the corrected performance workload
at its recorded limits. **The release is not ready to tag yet:** the third and
final Sol review and hosted CI on the final follow-up commit remain pending.

The review started at `26dda18cd4d5a3449a6d12d8f6335b1278b0e7dc` on
`release/alpha-0.0.1-review`. It covers the whole codebase, with fixes limited to
demonstrated defects, useful regression protection and small maintenance changes.
Graphics speed, fluid motion and player usability are recorded as the first
priorities in [AGENTS.md](../AGENTS.md).

## Decisions

Finding IDs refer to the independent first-round ledgers: Sol (`S`), Opus (`C`),
the independent Sol decisions audit (`D`), and the supervising agent (`P`).

| Findings | Decision and protection |
| --- | --- |
| S1, Fable F01 | Loop hints answer “wait” while current pours or intake can change the board, suggest held ×5, and invite another request after the transfers. Preserve the settled solver; a saved replay and every-bank machine hint journeys reject refused recommendations. A browser journey follows the advice through to an accepted hinted pour. Queued hints are deferred to avoid new lifecycle state in this hardening release. |
| S2, C-22, D07 | Replace repeated first-lane taps with sequential legal touches across lanes, and measure held ×5 too. Accepted actions and workload are reported. All six cases pass three standalone repetitions at the recorded per-case limits; per-tick timing alone does not establish frame fluidity. |
| S3, D03 | Share complete-definition serialization across authoring tools. Round trips cover every bank board, variants, uneven queues, three-marble crates, shapes and quoted text. |
| S4 | Share the rapid-tap predicate between initial and extended tallies. A regression distinguishes a slow win from a rapid win. |
| S5, D02 | Track each held key and pointer separately. Browser checks cover both release orders, simultaneous fingers, board input while holding, and faster-to-slower fallback. |
| S6, D04 | Delete the unused snapshot script that killed unrelated processes. Verification launch and cleanup use explicit run leases and exact container identity; behavioral tests protect reused and replaced servers. |
| S7, D09 | Use the supported 375×690 upright phone and existing desktop layout in active acceptance. Keep historical captures. |
| S9 | Reuse the existing clean-witness predicate in Funnel scoring; a win with a physics recovery must not certify a witness. |
| S10, D08 | Evolve the existing verification skill: exact before-action fingerprints for Undo and Restart, honest settled-scene census labels, current controls and feature coverage. |
| C-01, Opus F-04 | Accept a slid tap that ends on the same target when no drag started. Tube Sort also accepts a wobble that stays inside its source; a drag away and back keeps its cancel meaning. Ignore cancellation from another pointer. Unit and browser checks protect selection, invalid destinations, two-tap moves and cancellation. |
| C-02 | Ignore repeated Restart/Hint shortcuts and hints after play ends. Preserve normal keyboard input. |
| C-03 | Reject Three subpath imports and additional nondeterministic globals in rules code. Lint fixtures demonstrate forbidden and permitted cases; TypeScript rejects unused locals and parameters. |
| C-04, C-05, S13 | Document the registered 40 rounds/120 levels separately from the 120-round target. Correct orange arrival and current track facts. Track the historical campaign decision; retain the full-campaign figure-eight target. The scratch assembler is not a supported rebuild tool. |
| C-06 | Read the Loop truck snapshot once when constructing accessible targets. Keep labels and live state authoritative. |
| C-09, C-10, S11, S12 | Remove the unused wood texture, unreachable clear-marble appearance path, unused fields/imports and redundant expressions. Preserve replay fields, collider creation and separately owned instanced materials. Share the identical seeded generator. |
| C-12, P01 | Fix material sharing between ordinary and instanced lorry meshes, and give instanced shadow casters their own scene-owned depth material. Repair the shader test that previously hid the defect. Share lorry trims within each level, remove the covered arcade floor and merge opaque Funnel rim pieces. Frozen-state draw budgets fail on the original code and pass after these changes; shader and resource checks cover ownership. |
| C-13 | Refused Funnel taps use blocked feedback. |
| C-14 | Check GPU resource counts across repeated changes through all three games, including shader programs. |
| C-15, D06, S8 | Add a focused touch and rendering browser job to the deployment gate. The final sixteen-test subset passes three repetitions (48/48); the job handles fresh-runner ownership and server readiness. Hosted game, browser and hosting jobs pass on checkpoint `34bf302`; the follow-up commit needs its own hosted result. Keep timing benchmarks separate from CI contention. |
| C-20, C-21, C-24, D11 | Align package metadata to 0.0.1, check every registered French title, label the old cleanup proposal historical, and rename the lorry's local `window` material. Duplicate display titles do not threaten ID-keyed progress. |
| D10 | Check lesson membership against the flattened campaign order. A deliberate inserted lesson makes the guard fail. |
| Sol R2-01 | A new Hint request clears the previous blocked-tap ring before displaying its own feedback. The saved Loop case fails before the fix and passes afterward for both the button and `h`, with the feedback timer frozen and the game fingerprint unchanged. |
| Sol R2-02 | Correct the remaining architecture campaign count and Tube jam documentation. Tube boards with no legal move are jammed; the lack of stored Tube losing orders does not change that behavior. |

The native picker swipe reproduction disproved D01's proposed CSS defect: the
list scrolled and the newly revealed level opened. Keep the working CSS and the
real-touch regression.

## Changes deliberately deferred

- C-07: change 90 Hz pacing only with device evidence; the current software
  renderer does not establish how a phone feels.
- C-08: redesign scene/shader lifetime only after measuring transition stalls.
- C-11: retain short local scene and clone helpers. A generic scene framework
  would add ownership complexity without a demonstrated benefit.
- C-16, C-17: move drag drawing or hint searches to another scheduler only after
  measuring the affected input path.
- C-18: keep deterministic Loop motion unchanged; a cosmetic adjustment would
  invalidate existing replay fingerprints.
- C-19: new rule variants remain bank lessons, outside the registered campaign.
- C-23, C-25: preserve release-based taps and Tube landing physics during this
  hardening pass. Neither warrants an unmeasured gameplay redesign.
- Opus's final Tube motion concern: starting a drag during an existing transfer
  can settle its presentation abruptly. The behavior predates this review; measure
  it on a phone before changing the retargeting and cancellation presentation.

## Verification recorded so far

Evidence is under `output/current/alpha-0.0.1-review/`; reviewer ledgers are in the
supervising session's local state directory. Results below concern the working
tree, not a published tag.

- Typecheck and lint pass after the final follow-ups. All 1,502 unit tests in 37
  files pass on checkpoint `34bf302`; the subsequent gameplay change only clears
  prior Hint feedback and is covered by the browser regression below.
- Build passes the first-download budget: 1.912 MB against 2 MB.
- All 14 expected formal-model outcomes pass, including deliberate breaks. No
  modeled transition changed.
- Old Funnel and Loop logs replay with matching fingerprints. The Funnel replay
  records zero recoveries.
- The full 59-test browser run passes (38.8 minutes) before the final rendering
  and input follow-ups: all 120 registered campaign levels through real touches
  and saved progress, phone and desktop layouts, invalid/cancelled input,
  accessibility and repeated GPU-resource checks. The checks below cover the
  subsequent changes.
- The corrected four rendering-hygiene checks pass. Appearance comparisons for
  the shader fix are recorded separately from speed claims.
- After the additional rendering changes, the ten touch and rendering checks
  pass three repetitions: 30/30 in 3.6 minutes. Phone and desktop scene captures
  preserve layout and patterns, with small raster differences at overlapping
  edges from batching/material order; they are not all pixel-identical.
- The final shadow depth-packing correction matches eight before/after captures
  exactly. The ten focused gesture and rendering checks pass afterward, including
  the Tube wobble/cancel fix and frozen draw-call budgets. English/French wait-hint
  regressions and a real-touch wait→held ×5→legal hint journey also pass.
- The final sixteen-test CI browser subset passes three consecutive repetitions:
  48/48 in 6.6 minutes after the stale Hint-ring correction and added Tube tap/slide
  parity and dense-board target checks. The earlier fourteen-case checkpoint
  separately passed 42/42.
- All six Funnel/Loop variant browser cases and the three lorry-card, final-colour
  marker and cross-game GPU-resource cases pass again after the final follow-ups.
- All 77 scored Funnel bank witnesses still win cleanly under both brisk and
  patient pacing; the stricter clean-witness predicate changes no stored row.
- The evolved project skill passes launch/doctor, controls for all three games,
  desktop Tube controls and Funnel/Tube settled-scene censuses. Cleanup preserves
  the pre-existing dev server. The profiling command runs for Loop and Tube from
  a fresh output directory.
- The local hosting check builds through the real controller, passes Apache
  routing/cache/certificate checks and passes the production browser smoke test.
- Hosted game, browser and hosting jobs pass on checkpoint `34bf302`, including
  fresh-runner permissions, readiness and checkout cleanup. GitGuardian passes;
  CodeRabbit is skipped, so no CodeRabbit review is claimed.
- The original performance test failed all four cases before production edits.
  The corrected workload exceeds the historical 10 ms tick and 26 ms
  tick-plus-draw limits on both revisions. Valid original and candidate runs pass
  asset and workload checks, but their samples mix two resolutions; they are
  diagnostic evidence rather than calibration. The completed stable-quality
  A/B/B/A/A/B calibration supplies 36 valid samples. The [recorded baseline and
  limits](verification.md#alpha-rendering-baseline--5-november-2026) explain the
  correction; no percentage speedup or whole-frame budget is inferred.
- At those fixed limits, all six performance cases pass three standalone
  repetitions: **18/18 in 11.1 minutes**, without timing overrides. Every sample
  retains the full 375×690 canvas at ratio 1 and passes runtime, asset and activity
  guards. Limits were selected before this validation and were not raised again.
  Frozen-file hashes match the source, tests and baseline used by the run.

No physical phone has been measured. Browser timing and deterministic input
tests cannot establish physical-phone frame rate, heat or perceived fluidity.

## Remaining release work

Complete the third Sol round on the small follow-up diff, then publish that commit
to the draft PR and check its hosted CI. The second Sol round approved the main
implementation with the two follow-ups now addressed. Once the hardening review
is complete, prepare the final release handoff and the team's proposed arcade-feel
additions. No merge, tag or release has been published.
