---------------------------- MODULE MCBeltSlots ----------------------------
(* The board TLC checks: two crates poured in either order, one dock asking for blue then red. On a
   two-slot belt the wrong order fills it and jams; on larger ones up to four marbles share the belt
   and the chute, enough to collide if reservations were wrong. *)
EXTENDS BeltSlots
ModelColour == [m \in {"r1", "r2", "b1", "b2"} |-> IF m \in {"r1", "r2"} THEN "red" ELSE "blue"]
ModelColumns == <<<<{"r1", "r2"}>>, <<{"b1", "b2"}>>>>
ModelDocks == <<<<"blue", "red">>>>
ModelDockAt == <<1>>
=============================================================================
