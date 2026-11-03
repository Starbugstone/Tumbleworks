# Tube Sort commitments

The bounded executable model is
[`tests/puzzles/tube-roles.test.ts`](../../../tests/puzzles/tube-roles.test.ts).
Run it with `npx vitest run tests/puzzles/tube-roles.test.ts`.

State consists of indexed contents, cap-open flags and cup-spent flags. A legal
move transfers the largest matching group that fits, closes an emptied cup,
opens caps for a full home completion, and finally evaluates victory/jam. Undo
restores the whole prior state. There is no time, pending reservation or random
input. Thus successive legal moves in either order are the relevant interleavings;
the marble animation is outside this transition system.

The model explores every ordered-container position reachable on lessons 200 and
201, including cycles, and checks conservation, local capacities, monotone flags,
empty spent cups and identity of every rejected transition. Reverse reachability
from wins classifies every position without the production symmetry key. It then
compares each canonical position's production hint with that classification and
plays each witness. The separate trap checks relax only the rule and replay the
rescuing continuation. This checks the implementation's transition relation and
its key reduction; it is not an independently implemented rules oracle or a proof
for arbitrary boards.

Focused fixtures additionally check equal contents/different flags, undo across
opening and closing, full cups excluded from completion, invalid references,
classic hash stability and replay fingerprints. The initial cap tests failed on
parent `607bd28`: capped destinations were accepted, flags absent, and references
unvalidated. New invariants were checked on the implementation commit introducing
this file; later changes must run the same test again. No existing TLC model was
changed because none covers Tube Sort.
