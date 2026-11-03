# Levelling

The difficulty curve the campaign is built to, and the tools that keep it true. It uses the permanent names and marks from
[AGENTS.md](../AGENTS.md). Change a number here and in [scripts/level-curve.ts](../scripts/level-curve.ts) together, never as
a one-off exception. A round is one level of each game, in campaign order Funnel Sort, Loop Sort, Tube Sort.

The branch `levelling/first-stretch` registers rounds 1 to 12, thirty-six levels, for the owner to play on the dev server. All
ninety earlier definitions and witnesses stay in the banks and keep their IDs: nothing retires until the owner has played and
confirmed it. Campaign order is `PLAY_ORDER` in [src/campaign.ts](../src/campaign.ts), and IDs imply nothing about order.

## The numbers

Every level reports the same figures.

- **A:** actions needed: witness length on the conveyors, shortest solution on Tube Sort.
- **F1:** failure of a planner who acts once and waits for it to settle, as 100 × (1 − mean win of depth 1 and 2 with 15% lapses). Exact on the settled graph. The same planners also play the real machine, and the machine's figure replaces it when they differ by more than 15 points.
- **FM:** failure of the same planner tapping 2 or 3 times 0.2 s apart on every turn, on the real machine. Tube Sort has no clock, so its FM equals F1.
- **S**, the rating:

| Game | Formula |
| --- | --- |
| Funnel Sort | `S = F1 + clamp(0.25 × (Ffast − F1), −10, +12)`, `Ffast` the failure of `burst2`, `burst3` and `cheese` together |
| Loop Sort | The same, with `Ffast = FM` |
| Tube Sort | `S = max(F1, min(25, 2.5 × (moves − 4)))` |

## Players

All are seeded and never undo, in [scripts/level-score.ts](../scripts/level-score.ts). A result is a function of board, player and seed.

| Player | Behaviour | Used for |
| --- | --- | --- |
| `patient1`, `patient2` | Planner at depth 1 or 2 with 15% lapses; one action, then wait for everything to settle | Machine check on F1 |
| `burst2`, `burst3` | The same planner taps 2 or 3 times 0.2 s apart, on every turn, then watches until the pile or pour has gone through, at least 0.75 s | FM, the multi-tap gate |
| `mixed` | Loop Sort. The patient planner, except that about 1 turn in 4 is a burst of 2 or 3 taps | Reported beside FM |
| `mixedBrisk` | Loop Sort. As `mixed`, but its other turns keep the burst player's pace: it does not wait for marbles to be absorbed | Reported |
| `single` | Loop Sort. That brisk pace with no bursts at all | Separates what bursting costs from what not waiting costs |
| `cheese` | Funnel Sort. Pours a wanted tray; pours an extra tray whenever nothing can drain and the belt has room | Ceiling, reward, S |
| `spam` | A random legal tap every 0.5 s | Ceiling, reward |
| `brisk` | Funnel Sort. A random tray once the funnel is empty | Reward baseline |

Sample sizes: 60 games per Funnel Sort player and 200 per Loop Sort player. Ceiling and reward use 60 as a screen: pass outright 13 points clear of the limit, otherwise play 200 games and judge the point estimate. Tube Sort's F1 samples 1000 fixed bot games.

## The curve

All games share one table of S. No band builds in a ranking of the games.

| Rounds | Ordinary | Relief | Peak at most | FM gap G | Cheese and spam ceiling |
| --- | --- | --- | --- | --- | --- |
| 1-3 | 0-15 | none | none | none | none |
| 4-6 | 30-45 | 20-30 | 52 | 25 | 85% |
| 7-12 | 40-55 | 28-40 | 62 | 25 | 80% |
| 13-20 | 44-58 | 32-44 | 64 | 25 | 78% |
| 21-30 | 50-64 | 36-48 | 70 | 28 | 74% |
| 31-40 | 56-70 | 40-52 | 76 | 30 | 70% |
| 41-60 | 60-76 | 44-58 | 84 | 30 | 65% |
| 61-80 | 66-82 | 48-62 | 90 | 30 | 60% |
| 81-100 | 70-88 | 54-68 | 96 | 30 | 55% |
| 101-110 | 74-90 | 58-72 | 98 | 30 | 52% |
| 111-118 | 76-92 | 60-74 | 99 | 30 | 50% |
| 119-120 | 80-94 | 64-76 | 100 | 30 | 50% |

The campaign has 120 rounds, 360 levels: rounds 1-40 continue the accepted opening's feel and rounds 41-120 climb to the
ending (decided 3 November 2026; the reasoning is in `output/current/levelling/expansion/decision.md`, not tracked). Bands
from round 41 are provisional until the strong planner's H is calibrated. From round 13 a lesson is held to the +20 rise like
any other level, G stops at 30, and Funnel Sort's ceiling binds spam as well as cheese.

The curve was set twice on 3 November 2026, both times from the owner's play.

- The owner completed the live campaign's last levels, which score S 70 to 100, and judged them about right or a little easy
  for the end of the game. The top bands were raised so the new campaign does not end easier than the old one.
- The owner then played the first stretch as first registered, with rounds 4 to 12 at S 5 to 40. Only `tube-37` (round 12,
  S 36, the one board there whose planner really fails) was "remotely challenging"; everything else, including `board-2` at
  S 39, was easy. The live campaign's rounds 4 to 12 had sat at S 40 to 77, and the owner had called that campaign good but
  uneven. Rounds 4 onwards were therefore raised: round 4 now starts where `tube-37` sat, rounds 7 to 12 reach the old
  campaign's middle, and the climb from there to the finales is gentler and steadier than the old one. Rounds 1 to 3 stay
  easy, because the owner wants a few easy levels before the ramp.
- Cheese and spam ceilings came down with it, 85% at rounds 4 to 6 falling to 50% at the end: Funnel Sort was the game the
  owner found easiest, because cheese wins too often.
- Tube Sort length counts for at most S 25. The owner found 12- and 13-move boards with two spares, where no move loses,
  easy, so from round 4 Tube Sort difficulty has to come from boards the planner can lose (one spare).

The owner will test with other players, so these numbers stay open.

A human who finishes levels the bots lose 77 to 100% of the time is much stronger than the reference planner, so S loses resolution near the top. The strong reference H below adds deeper lookahead and fewer lapses. It is measured alongside S, not enforced; calibration and the owner’s blind pairs must establish useful late bands before H becomes a gate. A scale where every late level reads 95 or more cannot steer the curve.

A slot chooses the band: tutorials are exempt, a lesson sits between relief's low and the middle of ordinary, a peak between ordinary's low and its maximum.

| Step rule | Value |
| --- | --- |
| Largest rise between a game's consecutive rounds | +20, into a lesson or out of a tutorial excepted |
| Largest fall | −25 |
| After a peak | Next level is not a peak, and in the lower half of ordinary |
| Peak, from round 4 | Funnel `r mod 5 = 4`, Loop `0`, Tube `2`. A lesson there displaces the peak to the next non-lesson round |
| Relief, from round 4 | Funnel `r mod 5 = 1`, Loop `2`, Tube `4`, or straight after a peak or a lesson |
| Three games | Never peak in one round |
| Games kept level | Trailing five-round mean S of any two games within 12 from round 7, within 15 before |
| Flat stretch | Five-round mean never more than 3 below the previous; tutorials are left out of that mean |
| Variety | A Funnel Sort or Loop Sort structure not within 5 rounds of itself, tutorials excepted |

`tests/levelling/curve.test.ts` enforces all of it and shows it rejects an out-of-band board, an auto-win board and the old spikes, and accepts a valid stretch.

## Gates per board

These are the owner's rule that a conveyor board is resolvable by planning, rewards a cheese play and is not an auto win. Tube Sort is exempt.

| Gate | Rule |
| --- | --- |
| Resolvable | The witness wins clean on the machine in both timings; from round 4 also at least 90% under 20 seeded tap delays of 0 to 1.5 s, and 12 rule-winning orders sampled uniformly win at least 60% in each timing |
| Cheese rewarded, Funnel Sort | `max(cheese, spam) − brisk ≥ 0.10` from round 4 |
| Not an auto win, Funnel Sort | Cheese at most the round's ceiling and at most planner win + 40 points. Relief and lesson get +10 on the ceiling |
| Fast tapping not fatal, Loop Sort | `FM ≤ F1 + G` up to round 12; from round 13 the mixed player's failure (bursts on about one turn in four) ≤ F1 + G, the owner's choice on 3 November 2026 |
| Not an auto win, Loop Sort | Spam at most the same ceiling |
| Fast line exists | From round 4, a recorded `burst2` or `burst3` win in `FAST_WITNESSES` replays to a win on the machine |
| Decisions | From round 4, at least 2 risk positions; a losing order exists |
| Naive orders | Rounds 1-6 not required; 7-30 at least one jams; from 31 all jam on ordinary and peak slots |
| Hint | Opening search visits at most 100 states on Funnel Sort, 75 on Loop Sort, 12,000 on Tube Sort. Milliseconds are printed, never gated |
| Tube Sort graph | At most 40,000 reachable states, so a null hint is a proof; two-spare boards before round 21 have no lost positions |
| Loop Sort trucks | At most three segments, and the stretch's limit |

Never relaxed: exhaustive solvability; a clean witness in both timings; `bounces` at 0; `MIN_CAPACITY`; adjacent same colours rejected; patterns on containers; the first-download ceiling; the empty, stall-free first two Loop Sort levels; no overflow from a capped search counted as exhaustive. Funnel Sort's pile mixing stays, and no board is tightened to stop cheese working.

## Tools

```sh
docker compose exec -T dev npx tsx scripts/level-score.ts score <ids...>   # one JSON per board in output/current/levelling/first-stretch/scores
docker compose exec -T dev npx tsx scripts/level-score.ts merge            # folds them into tests/levelling/scores.json
docker compose exec -T dev npx tsx scripts/level-author.ts run <id> <want> <minutes>   # search one target, resumable
docker compose exec -T dev npx tsx scripts/level-emit.ts <id:seed[:capacity]>...       # writes chosen candidates into the banks
```

Every candidate an author tries leaves a line in `output/current/levelling/first-stretch/candidates/<id>.jsonl`. Scores are keyed by a versioned hash of the scorer policy, seed sets and board rules (excluding ID, title and stored solution): changing a board without a re-score fails `tests/levelling/curve.test.ts`. A full re-score takes hours, so CI checks the table and replays six recorded games per game.

## The first stretch

Rounds 1 to 12 as registered are in `tests/levelling/scores.json` and `PLAY_ORDER`. This is the second version, built on
3 November 2026 after the owner's playtest of the first; the per-level table is in `output/current/levelling/second-stretch.md`
(not tracked).

| Game | Rounds 1-3 | Rounds 4-12 |
| --- | --- | --- |
| Funnel Sort | `board-1`, `board-31`, `board-32` | `board-40` to `board-44`, `board-17`, `board-46`, `board-2`, `board-47` |
| Loop Sort | `loop-1`, `loop-2`, `loop-31` | `loop-41` to `loop-46`, `loop-48`, `loop-39`, `loop-47` |
| Tube Sort | `tube-1`, `tube-31`, `tube-32` | `tube-38` to `tube-44`, `tube-37`, `tube-46` |

The first version's boards (`board-33`…`board-39`, `loop-32`…`loop-40`, `tube-33`…`tube-36`, and the old `board-3`, `tube-2`,
`tube-3`, `tube-4`, `tube-9`) stay in the banks with their witnesses. Candidates for the second version are logged in
`output/current/levelling/second-stretch/candidates/`, and the exact emit is in `emit-choices.txt` beside them.

What changed in building it:

1. **Loop Sort peaks at round 10, its own phrase position, and rounds 11 and 12 are both relief.** The planned round-10 lesson,
   four lanes on an empty loop, produced no board in 1,046 seeds under the multi-tap gate.
2. **`loop-47` is a `loop-43` candidate under its own ID and title.** Scores do not depend on the ID, so `scripts/level-emit.ts`
   accepts `new=source:seed:capacity` and only recomputes the hash.
3. **Orange arrives at round 7 in Funnel Sort and Loop Sort and at round 10 in Tube Sort, always on a lesson.** The first version
   kept five colours out of rounds 1 to 12; the harder bands need them. Yellow arrives at round 5, 4 and 6.
4. **No Funnel Sort board before round 10 may be an eight**, because `board-46` there teaches it. The curve rules do not cover
   lessons, so the assembler enforces it.
5. **`board-45` was authored and not used**: `board-17` from the old campaign took the round-9 peak.

## Retirements, confirmed at n=200

Nothing has been retired on this branch. With the committed players at 200 games each, every Funnel Sort retirement still fails
its stated gate: cheese is an auto win on `board-6` (1.00), `board-7` (1.00) and `board-9` (0.85 against a planner win of 17);
cheese or spam beats careful play by under 0.10 on `board-4`, `board-10`, `board-11`, `board-14`, `board-21`, `board-22`,
`board-23`, `board-24` and `board-27`. Loop Sort figures are at 200 games in the score table; how the mixed player changes
those calls is below.

## Multi-tap and the mixed player

The decision rated Loop Sort's fast play with `burst2` and `burst3`, players who burst on every turn. The owner asked for a
mixed player beside them; the gate stays on the burst players until the owner decides.

- On the twelve Loop Sort levels of the stretch, the gate would have decided differently for two: `loop-32` (F1 10, mixed 37)
  and `loop-40` (F1 17, mixed 42) pass `FM ≤ F1 + 25` with FM 1 but would fail it against the mixed player. The planner that
  bursts now and then fails more than one that bursts every time on these boards, because the boards that pass the gate are
  roomy enough that a burst rarely hurts while a lapse still does.
- While authoring, the gate rejected 335 Loop Sort candidates (board and capacity) that had passed every cheaper check. 237 of
  them would have passed against the mixed player, and 17 that passed would have failed. For `loop-32` and the first part of
  `loop-34`'s search the logged mixed figure is the older definition, now `mixedBrisk`.
- Of the 18 Loop Sort retirements, the burst gate passes some capacity for `loop-14` and `loop-27` only. Against the mixed
  player, `loop-5`, `loop-7`, `loop-8`, `loop-12`, `loop-18`, `loop-20` and `loop-21` would also have a capacity inside the gap,
  before their bands and other gates are checked. Raw figures: `output/current/levelling/first-stretch/mixed-retired.json`.
- Most of what kills fast play on old Loop Sort boards is not bursting but not waiting: `single`, which never bursts but taps as
  soon as a pour has left its truck, fails about as often as `burst2` on most of them. The burst players also make their first
  tap on the first tick, before any player could, which is fatal on boards that start with a full ring (`loop-3`).

## Deviations from the decision

Each was found while building and is recorded here rather than worked around.

1. **A peak has a floor.** The decision gives only "peak at most". A peak is now held between ordinary's low and that maximum, so
   a peak cannot be easier than an ordinary level.
2. **`board-2` is the round-9 peak** and the new `board-37` the round-8 ordinary level. `board-2` (S 39) is above every new
   four-colour, three-column board the authors produced inside the kept-level rule, so as ordinary at round 8 it stood above
   the peak after it.
3. **`tube-9` sits at round 11, as relief after the five-high lesson.** At round 7 or 8 it would teach five-high tubes before
   `tube-4`'s lesson at 10. Relief is therefore allowed straight after a lesson as well as after a peak.
4. **The variety rule does not hold for Tube Sort in this stretch.** The structure table allows only three colours, four high,
   two spares for rounds 1 to 5 and four colours four high for 6 to 8, so "not within five rounds of itself" cannot be met.
   The check skips Tube Sort for now; exact duplicates are still rejected. `loop-31` repeats `loop-2`'s structure, which a
   three-truck, depth-1, empty-ring board must, so tutorials are left out of the rule.
5. **Rounds 2 and 3 are trivially easy for every bot** (`board-31`, `board-32`, `loop-31`: S 0). The table's structures at the
   slack it asks for produce nothing harder; whether they are "easy but not silly" is the owner's first check.
6. **Loop Sort's spam ceiling gets the same +10 on relief and lesson as Funnel Sort's cheese ceiling.** The decision says "the
   same ceiling"; without it no round-4 queued-truck lesson with generous room passed.
7. **Accepted Loop Sort boards often have FM far below F1** (`loop-36`: F1 36, FM 0). The gate selects boards roomy enough for
   bursts, and there fast tapping is the safer line for the bots. A player who double-taps is not punished there at all.
8. **Sample sizes.** Loop Sort players play 200 games each, not 60 to 120: they are cheap. Old Funnel Sort boards outside the
   stretch were re-scored without the machine planners (`board-30` included), so their F1 is settled; the decision's own
   machine runs found only `board-30` off by more than 15.
9. **Not built:** the Next button that skips completed levels (section 6) is left as it is, so the owner plays the thirty-six
   in order; the definite "can't be sorted" hint text (section 8) is left, though its proof test exists; tiers still come from
   `hasOrange` and position (section 9 ships later).
10. **The hash now includes scorer identity.** `scripts/level-policy.ts` holds the scorer version, policies, budgets and seed sets. IDs, titles and stored Tube Sort solutions do not change the hash.


## Strong reference H (measured, not gated)

`scripts/level-strong.ts` runs depths 4 and 6 with 3% uniform legal-action lapses and the existing observable heuristic.
H is their mean failure percentage. Tube Sort uses its exact graph modulo interchangeable tubes; conveyors use the
real physics `Machine` and scripted `LoopMachine`, with settled-rule lookahead as the older players do. A conveyor
row's H is the patient result. Settled, patient, burst2 and burst3 measurements, each depth and matching zero-lapse
runs are retained in `row.strong`. Nothing here changes S or a gate.

The fixed samples are seeds 1–60 for each conveyor setting and 1–1000 for each Tube Sort setting. Every setting reports
terminal jams, proven silent losses, censored runs, oracle exhaustion and the first action that changes a solvable
position into an unsolvable one (0 means the starting position was already lost). The Tube Sort diagnosis is exact;
conveyor diagnoses are explicitly settled-model proxies, and wins after a proxy loss are reported. The diagnostic
oracle never supplies a planner value. A null diagnostic is not evidence that no mistake happened.

Search caches state/depth values with their path context and prunes immediate reversals and forecast-path cycles.
A lapse still samples all legal actions. Logical node work is charged even on cache hits, so cache warmth cannot change
a budget result. Search is capped at 100,000 logical nodes per choice, the oracle at 40,000 states per query, the retained
graph at 200,000 states (40,000 for tubes), and play at 120 actions or 14,400 ticks. Every budget exit is `exhausted`,
never a loss. A measurement with any censored trial has H `null` and explicit lower/upper failure bounds. Proven lost
Tube positions may still have legal moves: these are silent losses, not budget exits.

Machine traces are reusable because physics and timing are deterministic given the taps. Every seeded planner decision
is evaluated again; only an already observed identical tap path can reuse a machine outcome. The caller still gets a
full trial count. CPU time is logged for authoring cost and never used as a stopping rule.

Run `npx tsx scripts/calibrate-h.ts [ids...]` for the 36 registered boards plus old finale anchors; results are resumable
under `output/current/levelling/expansion/h/`. `--smoke` uses three seeds in a separate folder.
`npx tsx scripts/report-h.ts [report-path]` validates the complete calibration and writes its tables and provisional bands. The calibration report
chooses provisional bands for playtesting; H is not a human failure rate.

The H introduction migrated all 139 existing score hashes without rescoring, by explicit owner instruction. Those
historical rows deliberately lack H; this migration does not claim they were measured with H. Future scorer changes
must invalidate stale rows and trigger measurement. `scripts/rehash-scores.ts` is an explicit migration tool, not a
substitute for rescoring changed rules or scoring semantics.

## Loop Sort rule lessons in the bank

The expansion decision adds **latched trucks at round 43**, **short trucks at 59**
and **coupled unload at 75**. The implementation fixtures are `loop-200`,
`loop-201` and `loop-202`. They are bank boards, not campaign placements. Open
`/?try=loop-200`, `/?try=loop-201` or `/?try=loop-202` to play them.

The card latch includes its prerequisite lane number, so two cabs with the same
pattern are unambiguous. Refusal feedback names and points to that lane. The toy
latch carries only the pattern.

A truck may declare `id`, `capacity` and `pourAfter`. Without an explicit ID its
identity is its original `lane:index`, unaffected by departures. A latch names
another truck's identity; unknown IDs and dependency cycles are rejected. The
latched truck receives its exposed colour normally and may complete through
intake. It cannot pour until the prerequisite's final intake reservation opens
its latch. Opening happens before jam evaluation, not after the departure
animation. One-colour trucks still cannot pour.

A short truck has `capacity: 12` among ordinary 24-unit trucks. Intake, completion,
percentages and conservation use the individual capacity. The total of a colour
must equal the sum of capacities of trucks whose deepest segment has that colour.
The bed is shorter, while cab, pattern badge and touch floor retain their size.
`rosterLayout` and `placeLane` reserve latch badge room and size shorter cards
without shrinking the percentage font or its minimum stretch width.

A board's `couplings` is a list of disjoint `[truckId, truckId]` pairs. A tap on
either member starts both exposed pours in one rules transaction only if both
are fronts, unlatched, idle and contain at least two segments. Otherwise the
whole action is refused with blocked feedback. Each stream retains its own unit
slots and cadence. Completion of either member dissolves the connection before
jam evaluation; the surviving member then accepts ordinary taps. One history
entry covers both pours, and undo restores their streams and any opened latches.
Hints name both trucks. The physical bar joins only currently docked tailboards.

Latches do not change `wants`: a full loop with a matching latched receiver can
drain. A full loop with no receiver is dead even if a prerequisite might finish
in some hypothetical future. Starting a pour cannot help there: unloading blocks
that truck's intake, and no unit can leave it without loop room. With spare room,
pending units or a legal whole action may still make progress. An all-latched
front row without useful intake, pending units or another legal action is dead.
Completion removes dependencies before this test. The [bounded action check](models/loop-actions/README.md)
and `tests/loop/features.test.ts` cover these cases.

`LoopTarget` / `LoopRecipe` accept `capacities` (a grid matching lanes), `latch`
(a truck/prerequisite pair), and `coupling` (two truck IDs). Set the target's
`feature` to `latch`, `short` or `coupling` to require a causal trap. Reverse
construction respects individual capacities; restrictions are applied afterward,
so its output must still pass exhaustive forward search. Variant capacity
search enumerates candidates rather than assuming monotonic solvability.
`LoopRules.actions()` emits one successor for a coupled pair. The hint, author,
score graphs and strong planner all preserve the new state. Board emission keeps
the metadata, and structural signatures include capacities and dependencies.

`featureTrap` requires an accepted losing line with a winning continuation in a
conserved counterfactual: remove the latch or coupling, or swap short/full
capacities between same-colour finishing trucks without moving cargo. A
truncated search cannot certify that continuation. Reproducible seeds are 93,
141 and 2 with three colours, lanes `[2,1,1]`, three segments, construction
capacity 40 and ring maximum 20. The fixture loop capacities are 28, 20 and 24.
Winning orders are `BBAACA`, `AAABCC`, `AABCC`; causal traps are `BCB`, `AABC`,
`ACC`. Both machine timings win, each saved witness passes 20/20 jitter runs,
and sampled settled-winning orders pass in both timings. The occasional-burst
and existing authoring gates remain in force. A saved fast win must actually
contain taps no more than 12 ticks apart; a patient win sampled by the mixed
player is insufficient. These small rule fixtures are not calibrated campaign
candidates and do not waive the placement, risk or naive-order gates.

Scores were generated with the default scorer and merged while preserving the
existing rows:

```sh
SCORE_DIR=output/current/loop-rules/scores npx tsx scripts/level-score.ts score loop-200 loop-201 loop-202
SCORE_DIR=output/current/loop-rules/scores npx tsx scripts/level-score.ts merge
```

The merge command replaces the table with the directory's rows: seed that
worktree-local directory with the existing table rows before merging a partial
batch. No main-checkout artifacts are needed. New captures belong under
`output/current/videos/`; `VIDEO_FPS` (default 30) and `VIDEO_SCALE` (default 2)
allow lighter recording on a shared host. Pass the same `VIDEO_FPS` to the encoder.
Recording advances browser timers with the game clock so feedback remains
visible for its intended duration even when frame capture is slow.
