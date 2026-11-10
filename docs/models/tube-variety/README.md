# Tube Sort cup exchange and mixed-height homes

`check.ts` explores the complete ordered-container graph of the two Workshop
boards. It is an executable bounded model checked by
`tests/puzzles/tube-variety.test.ts`, not a TLC model:

```sh
docker compose exec -T dev npx vitest run tests/puzzles/tube-variety.test.ts
```

The checked implementation is the working-tree Tube Sort evolution based on
`bd2371f20c2a2818d8443ce732626f23897321e9`. No commit was made for this work.

## State and transitions

State consists of ordered marble stacks and the indexed cap-open and cup-spent
flags. Moves transfer the maximum contiguous matching top run that fits. A cup
becomes spent on its first nonempty-to-empty move. A complete, non-cup home opens
every cap waiting for that colour before status is evaluated. Undo restores the
entire previous state. There are no ticks or presentation delays in these rules.

The model explores every source/destination pair without using `tubeKey` to
merge states. Move count is omitted from reachability identity because it cannot
affect future moves. Every accepted graph edge is replayed through `TubeRules`,
then undone to its exact source snapshot, including move count and commitments.

Independent assertions derive completed colours from the original marble totals,
check maximum transfer size, conservation, local capacity, permanent commitments,
cap prerequisites, terminal status and nonmutation of rejected moves. Reverse
reachability classifies winning and losing states. Every production symmetry
class must agree on that classification; the actual hint search must return a
legal winning continuation exactly for the winning classes.

Three deliberate mutations must fail: treating four of six reds as complete,
reopening a spent cup, and letting a full cup open a cap. These are exercised by
the same test command. The partial-red regression also reproduces the previous
local-fullness predicate returning `true`, while the new predicate returns
`false`; evidence is in `output/current/gameplay-variety/tube/evidence.json`.

## Bounds and authored witnesses

| Board | Ordered states | Canonical states | Accepted edges | Rejected choices | Openings | Closings | Partial-colour full homes |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| tube-210 | 186 | 76 | 551 | 4099 | 1 | 141 | 0 |
| tube-211 | 45 | 30 | 66 | 654 | 0 | 0 | 16 |

The guard rejects graphs reaching 20,000 ordered states. Both complete graphs fit
well below it. This establishes the invariants for these concrete boards and
all their reachable move orders; it is not a proof over every possible authored
board, rendering, touch input or physical-phone performance.

Definitions and shortest wins (nine moves for `tube-210`, ten for `tube-211`) live in
`src/puzzles/variety-boards.ts`. Actual losing paths live in
`tests/puzzles/tube-variety-fixtures.ts`. `tube-210` uses three four-place homes,
an empty two-place cup and a red-capped four-place spare. Move four completes red
and opens the spare while the cup still holds two blues; move nine pours them
into the spare and folds the cup. No reachable move both folds the cup and opens
the spare: the first version did both at once, and the player could read it as
"emptying the cup opens the cap". The opening move `2→3` jams. `tube-211` uses capacities `[6,4,4,4]` and totals red=6, blue=4,
green=4. Its winning path temporarily fills a short home with four reds without
counting them as finished. Moves `0→3, 2→0` jam.

The deterministic author probe used Park–Miller seeds 12 and 8 respectively,
shuffled the fixed colour pools, required a shortest solution of 4–14 moves and
retained only boards with an actual losing edge. The re-authored cup board
(seed 93 of `output/scratch-tube210/probe.ts`, 2026-11-07) instead requires the
spare to open on its own move, the cup to fold on a later one, both to be needed
to win, and no reachable move to do both. With three full homes that order is
the only one possible: folding the cup first leaves no free place.
The reproducible probe, candidate definitions, graph reports, scored files and
winning/jammed replay logs are retained in
`output/current/gameplay-variety/tube/`.
