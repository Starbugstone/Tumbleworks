# Shared receiving pallet

`check.ts` explores the production `MachineRules` transitions on a four-marble,
two-dock board. Each dock has two one-place boxes; the belt has one place.
Release, belt entry, box reservation and capture are separate choices. Every
successful transition is followed by snapshot restoration and exact comparison.
Rejected releases must leave state unchanged.

The checker asserts that paired queue indices agree, earlier pairs have every
place reserved, and the current pair cannot have both boxes fully reserved:
the second final reservation must already have advanced both queues. It checks
belt capacity, marble conservation, pending identities, receiver colours and
box capacities. Coverage counts require held boxes, joint advances, captures,
jams and wins. Exploration has an explicit 50,000-state ceiling and fails if it
is exhausted.

Two deliberate transition mutations must fail: advancing one queue when its
box fills, and delaying both queues after the partner's final reservation.
These are rule-state counterexamples. The physical test separately verifies
that both boxes stay until both final captures and leave in the same tick.

Run `docker compose exec -T dev npx vitest run tests/machine/pallet-model.test.ts
tests/machine/pallets.test.ts`. This is a bounded executable model, not a proof
for arbitrary board sizes or an abstraction of Rapier physics. The companion
machine test covers physical undo, action replay and zero recovery on a
twelve-marble board. Authored Workshop fixtures supply larger win and jam
paths.

Result: 2,553 distinct states, 536 joint advance transitions, 2,782 capture transitions, 250 jam states and 24 winning states. Both deliberate mutants are caught. The nine focused model and physical tests pass against the working tree based on bd2371f20c2a2818d8443ce732626f23897321e9; no commit was made.
