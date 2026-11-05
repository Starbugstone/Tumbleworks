# Campaign expansion decision — 3 November 2026

This is the historical design decision copied from
`output/current/levelling/expansion/decision.md` during the alpha 0.0.1 review on
5 November 2026. The decision below is preserved as written. Its 360 levels,
new-rule schedule and conveyor finales describe the target, not the registered
release: [src/campaign.ts](../src/campaign.ts) currently registers 40 rounds,
120 levels. [Levelling](levelling.md) describes the maintained gates, and
[tests/levelling/curve.test.ts](../tests/levelling/curve.test.ts) checks the
registered campaign against them.

The referenced research, design responses and candidate archive were scratch
artifacts under the ignored expansion directory; they are not all tracked here.
This record preserves the rationale, not a reproducible assembly pipeline. The
scratch `assemble.ts` depends on untracked candidates and plans and is not a
supported authoring command. `PLAY_ORDER`, committed board definitions and their
witnesses are the authority for the shipped selection. Re-assembly requires
recovering those inputs or authoring and scoring new candidates through the
maintained tools.

---

## Original decision: 360 levels

Lead decision, 3 November 2026, after `research.md`, `design-sol.md`, `design-astra.md`, `response-sol.md` and
`response-astra.md`. Where this file and those disagree, this file wins. The owner can overrule any of it.

### Scope

360 levels: 120 rounds of Funnel Sort, Loop Sort and Tube Sort, interleaved as now. Rounds 1–40 (the first 120 levels)
continue the feel of the accepted rounds 1–12; rounds 41–120 (240 more) climb to the ending. Rounds 1–12 stay exactly as
registered on commit da2a8dc. IDs stay permanent; new IDs continue from `board-48`, `loop-50`, `tube-47`.

### Decisions

#### A. Colours

- Black arrives at Tube Sort 25, Funnel Sort 26, Loop Sort 28. White at Tube Sort 49, Funnel Sort 51, Loop Sort 53. Each
  arrives on a lesson with two or three familiar colours; the full six- or seven-colour palette comes in a later lesson.
- Black `#141821` (light `#606978`, dark `#06090f`). White `#f3f5f0` (light `#fffefd`, dark `#b8c2c8`).
- Patterns: **black = three solid dots in a row; white = a heart.** The rendered comparison
  (`patterns/sheet.png`, actual drawing code at 13, 20 and 32 px and on cargo at 13 and 18 px, colour and grayscale) showed
  the stair turning into a blob at 13 px, waves blurring into stripes, and a crescent reading as red's ring. The heart is one
  bold filled shape, distinct from all six others at every size. The owner approves both on the phone before any black or
  white level ships.
- Cargo ink: dark ink on yellow, orange and white; ivory ink on the rest, black included.
- Wording in AGENTS.md becomes "yellow is the brightest chromatic colour; white is a separate, lighter neutral".

#### B. Curve and gates

- `CURVE_120` from `design-astra.md` is the working S curve, with its ceiling column. Rounds 1–12 keep their accepted boards.
- From round 13: no lesson exemption from the +20 rise rule; G capped at 30; Funnel Sort's absolute ceiling applies to spam
  as well as cheese (the +0.10 lesson/relief allowance and the `max(cheese, spam) − brisk ≥ 0.10` reward stay).
- Late bands (41+) are provisional until calibrated with H.

#### C. Strong reference planner H

- Depths 4 and 6 with 3% lapses, seeded, no undo; Tube Sort on its exact graph, the conveyors on the real machines. H is the
  mean failure of the two; per-depth, zero-lapse and first-irreversible-mistake figures are reported beside it.
- Measured from round 13, enforced from round 41 once calibrated: the owner plays nine blind pairs (three per game) and old
  finales serve as anchors. H is never read as a human failure rate.
- Score hashes include scorer version, policy and seeds, so a scoring change invalidates stale rows.

#### D. New rules: three per game, staggered

| Game | Rule 1 | Rule 2 | Rule 3 |
| --- | --- | --- | --- |
| Funnel Sort | **Paired release**, round 41: one tap tips two visibly joined crates (start 6 + 3) | **Forked shelves**, 57: a crate behind two others opens when both have gone | **Sealed dock**, 73: a dock opens when a named box elsewhere completes |
| Loop Sort | **Latched truck**, 43: still receives; can pour only once a named truck completes | **Short trucks**, 59: trucks of 12 units among trucks of 24 | **Coupled unload**, 75: one tap pours two joined trucks' open ends |
| Tube Sort | **Capped spare**, 45: an empty tube opens when a named colour first completes | **Closing cup**, 61: a two-place cup that folds shut the first time it empties | **Collector**, 77: a one-way tube that only takes its colour (ships only if its fixtures show a real trap) |

Each comes from the research: Loop Sort's barriers (latch), Bus Jam / Color Block Jam / Loop Sort curtains (caps, seals),
Marble Sort and Bus Jam ropes and links (paired release, coupled unload), Marble Sort tall boxes and shelves (crate sizes,
forks). Each rule: a lesson on a small board, practice two rounds later, a changed context at +5 or later, combinations only
after both ideas were seen separately, at most two taught restrictions on one board. No new rule after round 77; rounds
78–120 combine and master.

Through round 40, no new rules: data-only variety. Funnel Sort six-marble crates (lesson 17) and three-marble crates (21),
uneven columns, fewer docks than colours, eights. Loop Sort uneven queues, deeper queues on fewer lanes, loaded and empty
starts. Tube Sort one spare, part-full starts (`spread`), five-high, short tight boards.

Cut: shallow buffer well, shared buffer wells, mixed-height homes, concealed layers or hidden cargo, timers, action-count
ice, dual belts or loops, player-switched routes, paired receivers, paired dispatch. Optional, no difficulty credit:
kidney/horseshoe belt and notched loop silhouettes around rounds 65–75 if they read well; conveyor finales stay eights.

#### E. Length

First-play targets: ordinary 60–150 s, relief 30–75 s, peaks under 4 minutes. Action envelopes: Funnel 6–16 taps, Loop 6–20,
Tube 8–26 moves (rare peak to 30). Machine witness time limits stay as they are.

#### F. Production

1. Groundwork: colour registry (done, 0cfe53d); black and white; curve to 120 and gate fixes; H in the scorer; one candidate
   archive assembled into slots, ID-independent rule hash, every attempt logged with stage, duration and reason; the level
   picker in chapters of ten rounds; Next skips completed levels.
2. Author rounds 13–40 (84 levels) with today's rules plus colours; the owner plays them in chunks.
3. Pilot: four boards per game (bridge ordinary, first-rule lesson, late combination peak, seven-colour lesson), 30-minute
   search quotas. If two representative late recipes fail, change construction before bulk work. Never ease a band or the
   burst gate to fill a slot.
4. Each rule ships behind a winning fixture and a trap fixture, complete undo, hints, replay and role-aware search keys, and
   machine-valid rapid play, before its chapter is authored.
5. Author rounds 41–120 chapter by chapter, with the owner playing each chapter.
