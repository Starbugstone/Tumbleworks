# Loop Sort action interleavings

Run `npx vitest run tests/loop/interleavings.test.ts tests/loop/features.test.ts`.
This is an executable bounded state exploration, not a TLA+ model. It checks the
production transition functions against explicit invariants, without browser or
machine timing. `check.ts` explores every tap, single-unit entry and absorption
ordering. Capture is folded into absorption because it changes only presentation
status. Snapshot restoration checks the undo boundary.

The coupled fixture has two three-unit trucks, two loop slots and eight reachable
rule states. The receiving-latch fixture combines two- and three-unit capacities,
a latch, and a loop already carrying one unit. Both must reach completion and
exercise rejected taps. A deliberate mutant that commits only one half of a
coupled pour must fail the atomicity invariant. The check aborts at 50,000 states;
exhaustion is not success.

Invariants: occupancy never exceeds loop capacity; a truck's load never exceeds
its own capacity; a live unit has one owner; every refused tap preserves the
whole snapshot; every accepted pair commits both original open-end segments;
completion clears every reference to its identity before control returns;
restoring the pre-action snapshot restores both members and their dependency
facts. `LoopRules.tapReason`, `tap`, `entered`, `pass`, `snapshot` and `restore`
are the transitions checked.

The larger fixtures in `tests/loop/features.test.ts` separately establish causal
traps, full-but-drainable and irrecoverable jam cases, immediate unlock before
visual departure, undo after unlocking, state-key distinctions, and replay through
`LoopMachine`. A passing finite model does not establish arbitrary-board
liveness, real-phone performance, or the geometry and timing of machine streams.
