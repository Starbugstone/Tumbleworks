# Responsive village construction and proof ownership

`StartupLifecycle.tla` models the screen, retained map owner, film-owned previous
owner, sequential build, proof generation, worker message history, staged accept,
atomic native fence, reduced Play and earned Back acknowledgement. H is Harbour;
G is Gardens, whose film owns a previous Harbour. Native geometry and the exact
kernel are checked separately against actual emitted ranges.

Safety has no fairness assumption about the player. Leaving cancels work; returning
can start a fresh generation. A certificate means the native fence passed at issue,
not that an adversarial later write is harmless. Film start checks again.

The checked finite instance uses owner identifiers0..2 (map first allocates1;
previous first allocates0), two proof generations per slot, at most two retained
in-flight reply records and two Back actions. Fresh
identities never wrap. Actions requiring a new identity stop at the bound; stuttering
is legal there, so deadlock checking is disabled explicitly. These bounds are model
limits, not production limits. No state key based on pending task count is used.

`pass-motion.cfg` and `pass-reduced.cfg` check all listed invariants. Each `mut-*`
configuration must find its named unsafe behavior. Each `reach-*` deliberately
violates a Never invariant to produce a positive witness. The liveness configuration
uses system fairness only: construction settles, a worker either replies or fails,
queued delivery runs, and a continuously available acceptance step runs. Conditional
`Settles` covers an already pending proof while the player remains on a complete,
at-rest Harbour map. It does not force player completion/return, require an absent
worker to become available, promise successful certification, or assert that a
fresh-identity bound will be exceeded.

Startup133 evidence is in
`output/current/village-layouts/parallel44/startup-live133/`. The corrected full
motion instance completed 795161 distinct states at depth38; reduced motion
completed 807425. All seven mutants and six positive reachability witnesses were
found. TLC's full temporal check passed on the same 795161-state instance.
The installed TLC rejects `-dumpTrace`; complete textual counterexamples are kept.
Earlier model runs, including an interrupted unbounded owner-guard version, remain
recorded as failures and are not accepted proof.

`check.ts` separately drives the production `VillageOwnership`, `StaticProofOwner`,
`WorkerProofBackend` and cooperative scheduler using scripted scenes/bindings and a
manual scheduler. It replays all111151 concrete action traces through depth4, without
state deduplication; longer scenarios preserve actual job/owner histories and queued
program counters. This bounded executable check does not prove unbounded behavior or
native geometry. `startup-native`, `startup-binding-stages`, `startup-cleanup`,
`startup-transport` and `startup-film-gate` tests cover actual native issuance,
resource ownership and real class boundaries; browser journeys cover real controls,
reduced Play, pending Back and worker lifetime. Their individual receipts and limits
must be read together; none substitutes for a physical-phone performance run.


The worker is also cooperative: it yields between the same ordered hash and exact
operations. A real Chromium trace disproved an immediate physical-stop assumption
for a monolithic handler despite native terminate being called. The corrected
worker stops queued operations at its next task boundary; an already running
atomic operation and native teardown may finish afterward. The model's NoJob and
QuietAway properties describe logical ownership/delivery, not a zero-instruction
hardware preemption guarantee. Physical timing is independently traced and its
remaining tail is recorded in the Startup133 limits.
