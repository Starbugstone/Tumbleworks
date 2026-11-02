---------------------------- MODULE BeltSlots ----------------------------
(* Belt-slot reservation in Funnel Sort, interleaved with player pours and undo.
   See README.md for how this maps onto src/machine/machine.ts and what it leaves out.
   One Tick is the belt moving one slot, the only moments the neck can pick (nextSlot().aligned). *)
EXTENDS Integers, Sequences, FiniteSets, TLC

CONSTANTS
    Capacity,    \* Belt slots; rules.free counts down from this.
    ChuteTicks,  \* EXIT_STEPS in belt slots: a marble picked now lands this many ticks later.
    NeckTicks,   \* Ticks the neck stays closed behind a pick (FUNNEL.exitSeconds).
    BoxSize,
    Columns,     \* Per supply column, its crates front first; each crate a set of marbles.
    Colour,      \* Marble -> colour.
    Docks,       \* Per dock, its box colours in order.
    DockAt,      \* Per dock, the belt position it stands at. The entry is position 0.
    Mutation     \* "none", or which guarantee to break on purpose. See check-models.sh.

Marbles == DOMAIN Colour
NoSlot == -1
Slots == 0..(Capacity - 1)
DockIds == DOMAIN Docks
ColumnIds == DOMAIN Columns

VARIABLES
    belt,        \* control.belt, in slots.
    where,       \* Marble -> crate, pile, chute, riding, flying or boxed. One place, so never two.
    slot,        \* Marble -> reserved or held belt slot (marble.offset).
    timer,       \* Marble -> ticks left in the chute.
    neck,        \* Ticks until the neck may pick again.
    fronts,      \* Column -> index of its front crate (rules.state.supplies).
    onBelt,      \* rules.occupancy, kept separately so the rules can disagree with the machine.
    dockNext,    \* rules.state.dockNext.
    taken,       \* <<dock, box>> -> marbles reserved for that box (rules.reserved).
    status,      \* playing, won or jammed.
    history,     \* Machine.history: a complete copy of the state before each accepted pour.
    bounces,     \* control.recoveries.bounces: a landing found its slot taken.
    misplaced,   \* A marble landed away from the slot it reserved.
    overfull,    \* A box was given more than BoxSize, or the wrong colour.
    afterUndo    \* The state an undo promised to restore, for exactly one step.

game == <<belt, where, slot, timer, neck, fronts, onBelt, dockNext, taken, status, bounces, misplaced, overfull>>
vars == <<belt, where, slot, timer, neck, fronts, onBelt, dockNext, taken, status, history, bounces, misplaced, overfull, afterUndo>>

Holds(w) == w \in {"chute", "riding"}
Holders == {m \in Marbles : Holds(where[m])}
Pile == {m \in Marbles : where[m] = "pile"}
Position(m) == (slot[m] + belt) % Capacity
Reservable(s) ==
    \A m \in Marbles :
        \/ slot[m] # s
        \/ CASE Mutation = "chute_holds_no_slot" -> where[m] # "riding"
             [] Mutation = "reservation_ignores_riders" -> where[m] # "chute"
             [] OTHER -> ~Holds(where[m])
\* landingOffset(): the belt has already moved this tick when the neck picks.
LandingSlot ==
    IF Mutation = "reserve_ignores_chute" THEN (0 - (belt + 1)) % Capacity
    ELSE (0 - (belt + 1 + ChuteTicks)) % Capacity

DockWants(d, nxt) == IF nxt[d] <= Len(Docks[d]) THEN Docks[d][nxt[d]] ELSE "none"

CanDrain(wh, nxt, tk) ==
    \/ \E m \in Marbles : wh[m] = "flying"
    \/ \E m \in Marbles : Holds(wh[m]) /\ \E d \in DockIds : DockWants(d, nxt) = Colour[m]

Evaluate(st, wh, nxt, tk, count) ==
    IF st # "playing" THEN st
    ELSE IF \A m \in Marbles : wh[m] = "boxed" THEN "won"
    ELSE IF count >= Capacity /\ ~CanDrain(wh, nxt, tk) THEN "jammed"
    ELSE "playing"

Init ==
    /\ belt = 0
    /\ where = [m \in Marbles |-> "crate"]
    /\ slot = [m \in Marbles |-> NoSlot]
    /\ timer = [m \in Marbles |-> 0]
    /\ neck = 0
    /\ fronts = [c \in ColumnIds |-> 1]
    /\ onBelt = 0
    /\ dockNext = [d \in DockIds |-> 1]
    /\ taken = [d \in DockIds |-> [b \in 1..Len(Docks[d]) |-> 0]]
    /\ status = "playing"
    /\ history = <<>>
    /\ bounces = 0
    /\ misplaced = FALSE
    /\ overfull = FALSE
    /\ afterUndo = <<>>

(* Machine.tap: accepted input lands between ticks, whatever is in the chute at that moment. *)
Pour(c) ==
    /\ status = "playing"
    /\ fronts[c] <= Len(Columns[c])
    /\ history' = Append(history, game)
    /\ where' = [m \in Marbles |-> IF m \in Columns[c][fronts[c]] THEN "pile" ELSE where[m]]
    /\ fronts' = [fronts EXCEPT ![c] = @ + 1]
    /\ afterUndo' = <<>>
    /\ UNCHANGED <<belt, slot, timer, neck, onBelt, dockNext, taken, status, bounces, misplaced, overfull>>

(* Machine.undo: everything comes back from the copy, with the marbles' reservations and the belt. *)
Undo ==
    /\ status # "won"
    /\ Len(history) > 0
    /\ LET saved == history[Len(history)]
       IN  /\ history' = SubSeq(history, 1, Len(history) - 1)
           /\ afterUndo' = saved
           /\ belt' = IF Mutation = "undo_keeps_belt" THEN belt ELSE saved[1]
           /\ where' = saved[2]
           /\ slot' = saved[3]
           /\ timer' = saved[4]
           /\ neck' = saved[5]
           /\ fronts' = saved[6]
           /\ onBelt' = IF Mutation = "undo_keeps_occupancy" THEN onBelt ELSE saved[7]
           /\ dockNext' = saved[8]
           /\ taken' = saved[9]
           /\ status' = saved[10]
           /\ bounces' = saved[11]
           /\ misplaced' = saved[12]
           /\ overfull' = saved[13]

(* Machine.step, one aligned tick: chute landings, then deliveries, then the neck. pick is the marble
   the pile happens to offer, or "none" because nothing is resting on the neck yet: physics decides. *)
TickWith(pick) ==
    LET nb == (belt + 1) % Capacity
        landing == {m \in Marbles : where[m] = "chute" /\ timer[m] = 1}
        bumped == {m \in landing : \E o \in Marbles :
                      /\ o # m /\ slot[o] = slot[m]
                      /\ where[o] = "riding" }
        \* slotFree(marble.offset): one marble per dock per tick, because slots are exclusive.
        passing(d) == {m \in Marbles :
                      /\ where[m] = "riding"
                      /\ status = "playing"
                      /\ (slot[m] + nb) % Capacity = DockAt[d]
                      /\ DockWants(d, dockNext) = Colour[m]
                      /\ taken[d][dockNext[d]] < BoxSize}
        chosen == [d \in DockIds |-> IF passing(d) = {} THEN "none" ELSE CHOOSE m \in passing(d) : TRUE]
        delivered == {chosen[d] : d \in {e \in DockIds : chosen[e] # "none"}}
        nt == [d \in DockIds |-> [b \in DOMAIN taken[d] |->
                 IF b = dockNext[d] /\ chosen[d] # "none" THEN taken[d][b] + 1 ELSE taken[d][b]]]
        nn == [d \in DockIds |->
                 IF chosen[d] # "none" /\ nt[d][dockNext[d]] >= BoxSize THEN dockNext[d] + 1 ELSE dockNext[d]]
        mid == [m \in Marbles |->
                 CASE where[m] = "flying" -> "boxed"
                   [] m \in delivered     -> "flying"
                   [] m \in landing       -> "riding"
                   [] OTHER               -> where[m]]
        count1 == onBelt - Cardinality(delivered)
        nw == IF pick = "none" THEN mid ELSE [mid EXCEPT ![pick] = "chute"]
        count2 == IF pick = "none" THEN count1 ELSE count1 + 1
    IN  /\ belt' = nb
        /\ where' = nw
        /\ slot' = IF pick = "none" THEN slot ELSE [slot EXCEPT ![pick] = LandingSlot]
        /\ timer' = [m \in Marbles |->
                       IF m = pick THEN ChuteTicks
                       ELSE IF where[m] = "chute" THEN timer[m] - 1 ELSE 0]
        /\ neck' = IF pick = "none" THEN (IF neck > 0 THEN neck - 1 ELSE 0) ELSE NeckTicks
        /\ onBelt' = count2
        /\ dockNext' = nn
        /\ taken' = nt
        /\ status' = Evaluate(status, nw, nn, nt, count2)
        /\ bounces' = bounces + Cardinality(bumped)
        /\ misplaced' = (misplaced \/ \E m \in landing : (slot[m] + nb) % Capacity # 0)
        /\ overfull' = (overfull \/ \E d \in DockIds :
              \/ Cardinality(passing(d)) > 1
              \/ \E b \in DOMAIN nt[d] : nt[d][b] > BoxSize)
        /\ afterUndo' = <<>>
        /\ UNCHANGED <<fronts, history>>

(* canEnter: the rules have room, the neck is clear and the slot about to pass is free. *)
NeckOpen ==
    /\ status = "playing"
    /\ neck = 0
    /\ onBelt < Capacity
    /\ Reservable(LandingSlot)

Idle == TickWith("none")
Pick == /\ NeckOpen
        /\ \E m \in Pile : TickWith(m)

Next ==
    \/ \E c \in ColumnIds : Pour(c)
    \/ Undo
    \/ Idle
    \/ Pick

Spec == Init /\ [][Next]_vars
(* The belt never stops, and a pile resting on the neck is eventually offered. *)
FairSpec == Spec /\ WF_vars(Idle \/ Pick) /\ SF_vars(Pick)

----------------------------------------------------------------------------
TypeOK ==
    /\ belt \in Slots
    /\ where \in [Marbles -> {"crate", "pile", "chute", "riding", "flying", "boxed"}]
    /\ status \in {"playing", "won", "jammed"}

\* Two marbles on the belt or on their way to it never hold the same slot.
SlotsAreExclusive ==
    \A m, n \in Holders : m # n => slot[m] # slot[n]

\* A marble reaching the end of the chute always finds its reserved slot free (bounces stays 0, as soaks check).
LandingsNeverBounce == bounces = 0

\* A marble reaching the end of the chute lands on the belt exactly where it reserved.
LandingsAreInPlace == ~misplaced

\* The rules' count of marbles on the belt always equals the slots actually held, and never exceeds capacity.
RulesAgreeWithSlots == onBelt = Cardinality(Holders) /\ onBelt <= Capacity

\* Free room in the rules always means a slot nobody holds, which comes round within a lap.
FreeRoomMeansFreeSlot == onBelt < Capacity => \E s \in Slots : Reservable(s)

\* Every box gets at most BoxSize marbles, of its own colour, in order.
BoxesNeverOverfill == ~overfull

\* Undo restores the complete state it saved: reservations, belt, rules and all.
UndoRestoresEverything == afterUndo = <<>> \/ game = afterUndo

\* A game never ends won with marbles elsewhere.
WinMeansAllBoxed == status = "won" => \A m \in Marbles : where[m] = "boxed"

\* Each of these must fail, as proof the checked runs include a jam, a win and an undo with a marble in the chute.
NeverJams == status # "jammed"
NeverWins == status # "won"
NeverUndoesWithMarbleInChute == afterUndo = <<>> \/ \A m \in Marbles : where[m] # "chute"

\* Liveness: marbles waiting with room on the belt get onto it, unless the player takes the pour back.
WaitingMarblesEnter ==
    (status = "playing" /\ Pile # {} /\ onBelt < Capacity)
        ~> (Pile = {} \/ onBelt = Capacity \/ status # "playing" \/ \E m \in Marbles : where[m] = "chute")
=============================================================================
