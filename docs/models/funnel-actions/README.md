# Funnel Sort release and seal interleavings

Run `npx vitest run tests/machine/interleavings.test.ts tests/machine/features.test.ts`.
`check.ts` explores production `MachineRules` release, single-marble entry,
reservation, capture and snapshot restoration on two two-marble fixtures. It
checks every ordering, including rejected actions and full-belt states, and
aborts at 50,000 distinct snapshots rather than treating exhaustion as proof.

Invariants: a rejected pair changes nothing; an accepted pair releases both
members; pending inventory contains each pouring marble exactly once; belt and
box capacities hold; reservations match receiver colour; a sealed dock never
reserves; the final prerequisite reservation opens its seals before returning;
open seals stay open; restoration restores the whole release and reservation
state. A deliberate partial-pair mutant must fail. The larger lesson fixtures
prove causal traps, FIFO hints, stable keys, exact physics replay, rapid input,
and undo of both a pair and a seal opening.

These are bounded executable state explorations, not an independently written
rules oracle or a proof for arbitrary boards. The existing TLC belt-slot model
is unchanged: the neck arbitration, future landing-slot reservation and landing
transitions are unchanged. Physical pile mixing remains independent of FIFO
settling. See the lesson scores and real Machine witnesses for that boundary.

Checked rule revision: `3a54384`. Presentation and board-validation changes after that revision do not
change the checked transitions. Rerun both tests whenever those transitions change.
