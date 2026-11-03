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
| Tube Sort | `S = max(F1, min(45, 2.5 × (moves − 4)))` |

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
| 4-6 | 10-30 | 5-15 | 35 | 25 | 90% |
| 7-12 | 20-40 | 10-25 | 50 | 25 | 90% |
| 13-20 | 25-45 | 15-30 | 55 | 30 | 85% |
| 21-30 | 30-50 | 20-35 | 60 | 30 | 80% |
| 31-45 | 35-55 | 25-40 | 65 | 35 | 75% |
| 46-60 | 40-60 | 30-45 | 72 | 40 | 70% |
| 61-75 | 45-65 | 35-50 | 78 | 45 | 65% |
| 76-88 | 50-70 | 40-55 | 85 | 50 | 60% |
| 89-90 | 55-80 | none | 85 | 50 | 60% |

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
| Fast tapping not fatal, Loop Sort | `FM ≤ F1 + G` |
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

Every candidate an author tries leaves a line in `output/current/levelling/first-stretch/candidates/<id>.jsonl`. Scores are keyed by a hash of the board's rules: changing a board without a re-score fails `tests/levelling/curve.test.ts`. A full re-score takes hours, so CI checks the table and replays six recorded games per game.

## The first stretch

Rounds 1 to 12 as registered, with every figure, are in `output/current/levelling/first-stretch.md` (not tracked) and in
`tests/levelling/scores.json`. Old boards used: `board-1`, `board-2`, `board-3`, `loop-1`, `loop-2`, `tube-1`, `tube-2`,
`tube-3`, `tube-4`, `tube-9`. New: `board-31`…`board-39`, `loop-31`…`loop-40`, `tube-31`…`tube-37`. `loop-31` is
hand-authored; the rest came from `scripts/level-author.ts`. `tests/levelling/curve.test.ts` passes on all thirty-six, and
the same check found 201 violations on today's ninety.

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
10. **The hash covers the rules only.** A board's title and Tube Sort's stored solution do not change its score.
