-------------------------- MODULE StartupLifecycle --------------------------
(* Startup133 bounded lifecycle model. Extends124's StaticProof design with the
   ownership the source actually has: WorldView retains its built map scene across
   gameplay, Workshop and valley; a film BORROWS that scene and OWNS its previous
   (handoff) scene; construction is cooperative and cancellable; each proof run is a
   generation; leaving the village cancels unfinished construction and proof.

   Chapters: "H" (Little Harbour, has the static proof) and "G" (Glasshouse Gardens, no
   static proof, whose film hands off into a film-owned "H" scene). Slots: "map" (the
   map scene, chapter = mapCh) and "prev" (the film's previous H scene). *)
EXTENDS Naturals, FiniteSets

CONSTANTS MaxGen, Reduced,
          MutStaleGeneration,   \* a reply from an earlier generation is accepted
          MutAwayCPU,           \* leaving the village keeps unfinished work running
          MutFenceSkipped,      \* acceptance issues without the at-rest/intact fence
          MutIncompleteProof,   \* the proof starts for an incomplete (hidden-stop) village
          MutStartPending,      \* the film moves before every rendered scene is ready
          MutAutoplay,          \* reduced motion starts without the Play tap
          MutBackWritesTwice    \* Back during a pending earned film writes progress twice

Chapters == {"H", "G"}
Slots == {"map", "prev"}
None == "none"
NoJob == [s |-> None, o |-> 0, g |-> 0]
Screens == {"map", "film", "overview", "workshop", "hidden"}
Built == {"none", "queued", "building", "built", "failed"}
Phases == {"none", "idle", "snapshot", "worker", "held", "accept", "ready", "failed", "retry"}  \* retry = retryable failure (no worker / crash)

VARIABLES
  screen,    \* WorldView screen
  mapCh,     \* chapter of the map scene/build, or None
  scene,     \* [Slots -> Built]
  phase,     \* [Slots -> Phases] proof owner phase (only H scenes carry a proof)
  gen,       \* [Slots -> 0..MaxGen] current proof generation of the slot's owner
  owner,     \* [Slots -> 0..MaxGen] owner instance (bumped when the slot's scene is disposed/rebuilt)
  inbox,     \* worker messages [s, o (owner), g (generation), k]
  running,   \* worker job [s, o, g] or None
  complete,  \* every Harbour stop built (changes only while away, by playing)
  rest,      \* [Slots -> BOOLEAN] growth done and all builds visible
  intact,    \* [Slots -> BOOLEAN] native bytes equal the sealed issue
  src,       \* [Slots -> 0..MaxGen] ghost: generation of the reply now held/accepted
  basis,     \* [Slots -> BOOLEAN] ghost: acceptance was fenced at rest+intact for its own generation
  film,      \* [s, ch, earned, tap, checked]
  writes,    \* filmDone progress writes in this run
  backs,     \* Back presses from a film
  last
vars == <<screen, mapCh, scene, phase, gen, owner, inbox, running, complete, rest, intact, src, basis, film, writes, backs, last>>

Proofed(s) == IF s = "map" THEN mapCh = "H" ELSE TRUE
Away == screen \in {"overview", "workshop", "hidden"}
Eligible(s) == scene[s] = "built" /\ rest[s] /\ (s = "prev" \/ complete \/ MutIncompleteProof)
Showing(s) == IF s = "map" THEN screen \in {"map", "film"} /\ (screen = "film" => film.ch = mapCh)
              ELSE screen = "film" /\ film.ch = "G"
Busy(s) == phase[s] \in {"snapshot", "worker", "held", "accept"}
NoFilm == [s |-> "none", ch |-> None, earned |-> FALSE, tap |-> FALSE, checked |-> FALSE]

TypeOK ==
  /\ screen \in Screens /\ mapCh \in Chapters \cup {None}
  /\ scene \in [Slots -> Built] /\ phase \in [Slots -> Phases]
  /\ gen \in [Slots -> 0..MaxGen] /\ owner \in [Slots -> 0..MaxGen]
  /\ complete \in BOOLEAN /\ rest \in [Slots -> BOOLEAN] /\ intact \in [Slots -> BOOLEAN] /\ basis \in [Slots -> BOOLEAN]
  /\ src \in [Slots -> 0..MaxGen]
  /\ writes \in 0..4 /\ backs \in 0..4

Init ==
  /\ screen = "hidden" /\ mapCh = None
  /\ scene = [s \in Slots |-> "none"] /\ phase = [s \in Slots |-> "none"]
  /\ gen = [s \in Slots |-> 0] /\ owner = [s \in Slots |-> 0]
  /\ inbox = {} /\ running = NoJob /\ complete \in BOOLEAN
  /\ rest = [s \in Slots |-> TRUE] /\ intact = [s \in Slots |-> TRUE] /\ basis = [s \in Slots |-> FALSE] /\ src = [s \in Slots |-> 0]
  /\ film = NoFilm /\ writes = 0 /\ backs = 0 /\ last = "init"

Bump(o) == o + 1
CanDropPrev == scene["prev"] = "none" \/ owner["prev"] < MaxGen
\* Action guards bound owner instances and generations without aliasing; configs
\* do not install Bounded as a TLC state constraint.
Bounded == \A s \in Slots : owner[s] < MaxGen /\ gen[s] < MaxGen
\* The film's previous scene, its job and its messages are released (endFilm).
DropPrev == /\ owner' = [owner EXCEPT !["prev"] = (IF scene["prev"] = "none" THEN owner["prev"] ELSE Bump(owner["prev"]))]
            /\ running' = IF running.s # None /\ running.s = "prev" THEN NoJob ELSE running

\* ---- player and navigation: NO fairness on any of these ----
ShowMap(ch) ==
  /\ CanDropPrev /\ ((mapCh = ch /\ scene["map"] \in {"built", "building"}) \/ owner["map"] < MaxGen)
  /\ screen' = "map" /\ film' = NoFilm /\ last' = "ShowMap"
  /\ IF mapCh = ch /\ scene["map"] \in {"built", "building"}
       THEN /\ mapCh' = mapCh /\ owner' = [owner EXCEPT !["prev"] = (IF scene["prev"] = "none" THEN owner["prev"] ELSE Bump(owner["prev"]))]
            /\ running' = IF running.s # None /\ running.s = "prev" THEN NoJob ELSE running
            /\ scene' = [scene EXCEPT !["prev"] = "none"]
            /\ phase' = [phase EXCEPT !["prev"] = "none", !["map"] = IF phase["map"] = "retry" /\ Away THEN "idle" ELSE phase["map"]]
            /\ gen' = [gen EXCEPT !["prev"] = 0] /\ basis' = [basis EXCEPT !["prev"] = FALSE]
       ELSE /\ mapCh' = ch /\ owner' = [s \in Slots |-> IF s = "map" THEN Bump(owner[s]) ELSE IF scene[s] = "none" THEN owner[s] ELSE Bump(owner[s])]     \* old map scene disposed: its messages are foreign
            /\ running' = NoJob
            /\ scene' = [s \in Slots |-> IF s = "map" THEN "building" ELSE "none"]
            /\ phase' = [s \in Slots |-> "none"] /\ gen' = [s \in Slots |-> 0] /\ basis' = [s \in Slots |-> FALSE]
  /\ UNCHANGED <<inbox, complete, rest, intact, src, writes, backs>>

\* Gameplay, valley or Workshop: builds cancelled; unfinished proof suspended; built map scene and a
\* ready certificate kept; the film's previous scene released.
Leave(to) ==
  /\ CanDropPrev
  /\ to \in {"overview", "workshop", "hidden"} /\ screen \in {"map", "film"}
  /\ screen' = to /\ film' = NoFilm /\ last' = "Leave"
  /\ owner' = [owner EXCEPT !["prev"] = (IF scene["prev"] = "none" THEN owner["prev"] ELSE Bump(owner["prev"]))]
  /\ IF MutAwayCPU
       THEN /\ UNCHANGED <<scene, phase, running, mapCh>>
       ELSE /\ scene' = [s \in Slots |-> IF s = "prev" \/ scene[s] \in {"building", "queued"} THEN "none" ELSE scene[s]]
            /\ phase' = [s \in Slots |-> IF s = "prev" THEN "none" ELSE IF Busy(s) THEN "idle" ELSE phase[s]]
            /\ running' = NoJob
            /\ mapCh' = IF scene["map"] = "building" THEN None ELSE mapCh
  /\ UNCHANGED <<gen, inbox, complete, rest, intact, src, basis, writes, backs>>

\* Away, the player may finish Harbour's last stop; on return the newest stop rises (not at rest).
Play == screen = "hidden" /\ ~complete /\ complete' = TRUE /\ rest' = [rest EXCEPT !["map"] = FALSE] /\ last' = "Play"
        /\ UNCHANGED <<screen, mapCh, scene, phase, gen, owner, inbox, running, intact, src, basis, film, writes, backs>>

OpenFilm(ch, earned) ==
  /\ screen = "map" /\ mapCh = ch /\ scene["map"] \in {"built", "building"} /\ (ch = "G" \/ complete)
  /\ screen' = "film" /\ film' = [s |-> "waiting", ch |-> ch, earned |-> earned, tap |-> FALSE, checked |-> FALSE]
  /\ rest' = [rest EXCEPT !["map"] = TRUE]                               \* filmBuilt/WorldFilm: finishConstruction()
  /\ scene' = [scene EXCEPT !["prev"] = IF ch = "H" THEN "none" ELSE IF scene["map"] = "built" THEN "building" ELSE "queued"]
  /\ phase' = [phase EXCEPT !["prev"] = "none"] /\ last' = "OpenFilm"
  /\ UNCHANGED <<mapCh, gen, owner, inbox, running, complete, intact, src, basis, writes, backs>>

\* Back during a pending or a playing film is the existing skip: exactly one filmDone write.
Back ==
  /\ CanDropPrev /\ backs < 2
  /\ screen = "film"
  /\ writes' = writes + (IF MutBackWritesTwice /\ film.s = "waiting" THEN 2 ELSE 1) /\ backs' = backs + 1
  /\ screen' = "map" /\ film' = NoFilm /\ DropPrev
  /\ scene' = [scene EXCEPT !["prev"] = "none"] /\ phase' = [phase EXCEPT !["prev"] = "none"] /\ last' = "Back"
  /\ UNCHANGED <<mapCh, gen, inbox, complete, rest, intact, src, basis>>

PlayTap ==
  /\ film.s = "armed" /\ film' = [film EXCEPT !.s = "playing", !.tap = TRUE] /\ last' = "PlayTap"
  /\ UNCHANGED <<screen, mapCh, scene, phase, gen, owner, inbox, running, complete, rest, intact, src, basis, writes, backs>>

\* ---- system: cooperative construction, one build at a time (previous waits for the map) ----
BuildDone(s, ok) ==
  /\ scene[s] = "building" /\ ~Away
  /\ scene' = [x \in Slots |-> IF x = s THEN (IF ok THEN "built" ELSE "failed")
                               ELSE IF x = "prev" /\ scene["prev"] = "queued" /\ ok THEN "building"
                               ELSE IF x = "prev" /\ scene["prev"] = "queued" THEN "failed" ELSE scene[x]]
  /\ phase' = [phase EXCEPT ![s] = IF ok /\ Proofed(s) THEN "idle" ELSE "none"]
  /\ rest' = [rest EXCEPT ![s] = TRUE] /\ intact' = [intact EXCEPT ![s] = TRUE] /\ last' = "BuildDone"
  /\ UNCHANGED <<screen, mapCh, gen, owner, inbox, running, complete, src, basis, film, writes, backs>>

\* ---- system: the proof owner ----
StartProof(s) ==
  /\ gen[s] < MaxGen /\ phase[s] = "idle" /\ Showing(s) /\ Eligible(s)
  /\ gen' = [gen EXCEPT ![s] = gen[s] + 1] /\ phase' = [phase EXCEPT ![s] = "snapshot"] /\ last' = "StartProof"
  /\ UNCHANGED <<screen, mapCh, scene, owner, inbox, running, complete, rest, intact, src, basis, film, writes, backs>>
Snapshotted(s) ==
  /\ phase[s] = "snapshot" /\ running = NoJob
  /\ IF Eligible(s)
       THEN /\ phase' = [phase EXCEPT ![s] = "worker"] /\ running' = [s |-> s, o |-> owner[s], g |-> gen[s]]
       ELSE /\ phase' = [phase EXCEPT ![s] = "idle"] /\ running' = running      \* NotAtRest: no effect, retried later
  /\ last' = "Snapshotted"
  /\ UNCHANGED <<screen, mapCh, scene, gen, owner, inbox, complete, rest, intact, src, basis, film, writes, backs>>
WorkerReply(k) ==
  /\ Cardinality(inbox) < 2 /\ running.s # None /\ k \in {"cert", "rej", "err"}
  /\ inbox' = inbox \cup {[s |-> running.s, o |-> running.o, g |-> running.g, k |-> k]} /\ running' = NoJob
  /\ last' = "WorkerReply"
  /\ UNCHANGED <<screen, mapCh, scene, phase, gen, owner, complete, rest, intact, src, basis, film, writes, backs>>
\* A message for another owner instance or an earlier generation is ignored (late/stale/duplicate).
Deliver(m) ==
  /\ m \in inbox /\ inbox' = inbox \ {m}
  /\ LET s == m.s
         own == m.o = owner[s] /\ phase[s] = "worker" /\ (m.g = gen[s] \/ MutStaleGeneration)
     IN IF own
          THEN /\ phase' = [phase EXCEPT ![s] = CASE m.k = "cert" -> "held" [] m.k = "err" -> "retry" [] OTHER -> "failed"]
               /\ src' = [src EXCEPT ![s] = m.g]
          ELSE UNCHANGED <<phase, src>>
  /\ last' = "Deliver"
  /\ UNCHANGED <<screen, mapCh, scene, gen, owner, running, complete, rest, intact, basis, film, writes, backs>>
\* Staged acceptance: deep pass and structure (phase accept), then ONE fenced issuing step.
Accept(s) ==
  /\ phase[s] \in {"held", "accept"} /\ Showing(s)
  /\ IF ~Eligible(s) /\ ~MutFenceSkipped
       THEN phase' = [phase EXCEPT ![s] = "held"] /\ UNCHANGED basis               \* NotAtRest: back to held
       ELSE IF phase[s] = "held"
         THEN phase' = [phase EXCEPT ![s] = "accept"] /\ UNCHANGED basis
         ELSE IF intact[s] \/ MutFenceSkipped
           THEN /\ phase' = [phase EXCEPT ![s] = "ready"]
                /\ basis' = [basis EXCEPT ![s] = intact[s] /\ Eligible(s) /\ src[s] = gen[s]]
           ELSE phase' = [phase EXCEPT ![s] = "failed"] /\ UNCHANGED basis
  /\ last' = "Accept"
  /\ UNCHANGED <<screen, mapCh, scene, gen, owner, inbox, running, complete, rest, intact, src, film, writes, backs>>

\* Adversarial native write / exact restoration of a built scene; the end of a rising stop.
Mutate(s) == scene[s] = "built" /\ intact' = [intact EXCEPT ![s] = ~intact[s]] /\ last' = "Mutate"
             /\ UNCHANGED <<screen, mapCh, scene, phase, gen, owner, inbox, running, complete, rest, src, basis, film, writes, backs>>
GrowEnd == screen = "map" /\ ~rest["map"] /\ rest' = [rest EXCEPT !["map"] = TRUE] /\ last' = "GrowEnd"
           /\ UNCHANGED <<screen, mapCh, scene, phase, gen, owner, inbox, running, complete, intact, src, basis, film, writes, backs>>

\* ---- film start: every rendered scene built and ready; atomic deep recheck (beginFilm) ----
Rendered(s) == s = "map" \/ film.ch = "G"
FilmReady == \A s \in Slots : Rendered(s) => scene[s] = "built" /\ (Proofed(s) => phase[s] = "ready")
FilmIntact == \A s \in Slots : (Rendered(s) /\ Proofed(s)) => intact[s]
StartFilm ==
  /\ film.s = "waiting" /\ (FilmReady \/ MutStartPending)
  /\ IF FilmReady /\ FilmIntact
       THEN film' = [film EXCEPT !.s = IF Reduced /\ ~MutAutoplay THEN "armed" ELSE "playing", !.checked = TRUE]
       ELSE IF MutStartPending THEN film' = [film EXCEPT !.s = IF Reduced /\ ~MutAutoplay THEN "armed" ELSE "playing"]
       ELSE film' = [film EXCEPT !.s = "failed"]
  /\ last' = "StartFilm"
  /\ UNCHANGED <<screen, mapCh, scene, phase, gen, owner, inbox, running, complete, rest, intact, src, basis, writes, backs>>
FailFilm ==
  /\ film.s = "waiting" /\ \E s \in Slots : Rendered(s) /\ (scene[s] = "failed" \/ phase[s] \in {"failed", "retry"})
  /\ film' = [film EXCEPT !.s = "failed"] /\ last' = "FailFilm"
  /\ UNCHANGED <<screen, mapCh, scene, phase, gen, owner, inbox, running, complete, rest, intact, src, basis, writes, backs>>

Next ==
  \/ \E ch \in Chapters : ShowMap(ch) \/ OpenFilm(ch, TRUE) \/ OpenFilm(ch, FALSE)
  \/ \E to \in {"overview", "workshop", "hidden"} : Leave(to)
  \/ Play \/ Back \/ PlayTap \/ StartFilm \/ FailFilm \/ GrowEnd
  \/ \E s \in Slots : BuildDone(s, TRUE) \/ BuildDone(s, FALSE) \/ StartProof(s) \/ Snapshotted(s) \/ Accept(s) \/ Mutate(s)
  \/ \E k \in {"cert", "rej", "err"} : WorkerReply(k)
  \/ \E m \in inbox : Deliver(m)

Spec == Init /\ [][Next]_vars
\* Fairness ONLY on system work. The player is never assumed to stay, return or finish stops.
LiveSpec == /\ Spec
            /\ \A s \in Slots : WF_vars(StartProof(s)) /\ WF_vars(Snapshotted(s)) /\ SF_vars(Accept(s)) /\ WF_vars(BuildDone(s, TRUE) \/ BuildDone(s, FALSE))
            /\ WF_vars(\E k \in {"cert", "rej", "err"} : WorkerReply(k)) /\ WF_vars(\E m \in inbox : Deliver(m)) /\ WF_vars(GrowEnd)

\* ---- safety ----
Safe == \A s \in Slots : phase[s] = "ready" => basis[s]
QuietAway == Away => /\ \A s \in Slots : scene[s] \notin {"building", "queued"}
                     /\ \A s \in Slots : phase[s] \notin {"snapshot", "worker", "accept"}
                     /\ running = NoJob
ProofNeedsComplete == (mapCh = "H" /\ phase["map"] \in {"snapshot", "worker", "held", "accept", "ready"}) => complete
OneBuild == ~(scene["map"] = "building" /\ scene["prev"] = "building")
FilmGate == film.s \in {"armed", "playing"} => film.checked
ReducedNeedsTap == (Reduced /\ film.s = "playing") => film.tap
BackIsSkip == writes = backs
PrevOwnedByFilm == film.s = "none" => scene["prev"] = "none"
\* ---- conditional liveness: IF the player stays on a complete Harbour map, its proof settles ----
Settles == (<>[](screen = "map" /\ mapCh = "H" /\ complete /\ rest["map"]))
           => ((phase["map"] \in {"snapshot", "worker", "held", "accept"}) ~> (phase["map"] \in {"idle", "ready", "failed", "retry"} \/ scene["map"] = "failed"))
\* ---- reachability witnesses (each must be VIOLATED) ----
NeverReady == phase["map"] # "ready"
NeverReturnFresh == ~(last = "StartProof" /\ gen["map"] > 1)
NeverStaleArrives == ~(\E m \in inbox : m.g < gen[m.s] \/ m.o # owner[m.s])
NeverPrevReady == phase["prev"] # "ready"
NeverArmed == film.s # "armed"
NeverBackWhilePending == ~(last = "Back" /\ phase["map"] \in {"snapshot", "worker", "held", "accept"})
=============================================================================
