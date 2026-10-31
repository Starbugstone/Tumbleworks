# Tumbleworks POC

## Scope

The POC is one browser game with one campaign and three gameplay types. The campaign takes one level of each type per round, so it ends with the two longest conveyor levels.

We rebuilt the two conveyor games after a playtest against Voodoo's Marble Sort! and Loop Sort, because the earlier Funnel Sort worked but felt bland. The targets are many marbles on screen, a belt or loop that never stops, an immediate response to a tap, boxes and trucks that clear in bulk, and very little interface over the board. The [research](research/loop-sort-marble-sort-mechanics.md) records the evidence.

## Levels

| Difficulty | Funnel Sort | Loop Sort | Tube Sort |
| --- | --- | --- | --- |
| Getting started | Board 1 has 3 trays, 3 docks and a belt of 15. Board 2 has 5 trays and a belt of 18. | Loop 1 has 2 lanes, 3 trucks and a loop of 12. Loop 2 has 3 lanes, 4 trucks and a loop of 24. | 3 colors, 2 spare tubes |
| Finding a rhythm | Board 3 has 7 trays, 4 docks and a belt of 18. | Loop 3 has 3 lanes, 5 trucks, 120 units and a loop of 34. | 4 colors, 2 spare tubes |
| Thinking ahead | Board 4 has 9 trays. Board 5 has 12 trays and 108 marbles. Both have a belt of 18. | Loop 4 has 4 lanes, 6 trucks and a loop of 30. Loop 5 has 4 lanes, 8 trucks, 192 units and a loop of 56. | 4 colors, 1 spare tube |

`scripts/board-tree.ts` and `scripts/loop-tree.ts` count every tap order once the board has settled.

| Level | Winning orders | Losing orders |
| --- | --- | --- |
| Board 1 | 1 | 2 |
| Board 5 | 19,121 | 1,958 |
| Loop 1 | 2 | 0 |
| Loop 5 | 80 | 66 |

Loop 1 is the tutorial, so it has no losing order. These counts show that choices exist, not how hard a level feels. That still needs a playtest.

## Funnel Sort transport

A crate holds nine marbles in a 3×3 block, and crates hang over a shallow clear dish in receding stacks. A tap opens the front crate, and its marbles fall into the dish.

The pile rests on a closed floor under the drawn neck. When the belt has room and the landing spot is clear, the neck takes the earliest-poured marble resting on it, or else the lowest one nearby. A script then moves that marble down onto the belt. We first tried a physical hole one marble wide, but two or three marbles arched over it. The closed floor removed the need for any rescue. The dish vibrates a little, so the pile keeps rolling toward the neck. Marbles waiting in a crate collide with nothing, so a sliding crate cannot throw one out.

The belt has one lane and never stops. It passes the docks from right to left, and a marble goes to the first docked box of its color with a free slot. A dock asks for its next box as soon as the third slot is reserved, so a matching marble does not have to lap again. Full boxes sink away and the column moves up.

## Loop Sort transport

A rounded-rectangle loop runs around a plateau. Up to three bays face the front straight, and more lanes add a back row. A truck holds twenty-four units packed against its cab, and its open end faces the loop.

The loop has one slot per unit of capacity, and the slots move with it. Each unit is drawn as rows of three tiny marbles that fill its slot, so a full loop looks full. A pouring truck puts each unit into the first empty slot that reaches its open end. It pauses when the loop is full. A tailboard shows moving chevrons while unloading and a pause symbol while waiting for loop space.

A unit a truck wants hops into the open end, and that color's block grows smoothly. The cab keeps the truck’s final color and a contrasting pattern marker, even while it pours another color. Cabs have windows, mirrors and six wheels; the wheels turn during arrival and departure. A complete truck waits for its last unit to land, then drives over the rim and down a ramp. The next truck in the bay rises into place.

## Presentation

Tube Sort uses two columns on a taller platform, with one pattern marker beside every occupied slot. Selected bases and tube rims respond immediately; completed tubes emit a short burst and play their completion sound even when another move follows straight away. Funnel Sort boxes pulse as they fill and burst when complete. These effects never gate input and reset on undo. The phone HUD keeps its level pill, compact counter and sound button in one row.

## Choices the references do not confirm

The research did not settle every rule of the original games, and nobody played a current build for it. We chose these rules ourselves:

- A one-color truck cannot be poured.
- A complete truck drives away and the next one rises into its bay.
- A truck's deepest segment fixes its final color.
- The loop has a fixed slot capacity and speed.
- Lives, boosters and obstacles are left out.

## Undo, hints and saves

Undo restores a full rule snapshot. In Funnel Sort it also restores the physics world and animation state. Restart recreates the level.

A hint searches from the current state within a limit and names a move only if it finds a winning line. That search treats the funnel pile as first in, first out, and it checks competing Loop Sort trucks in lane order, so the real game can differ. If the search finds nothing, the hint tells the player to wait or undo.

The browser validates saved completion, level and mute data. If a write fails, progress stays in memory for the session. An unfinished board restarts on reload.

## Test coverage

[Verification](verification.md) lists the results. The specs cover the following:

- Rule tests play a winning order on all thirteen boards and a losing order on every conveyor board except loop 1. `tests/witnesses.ts` holds the conveyor orders.
- Machine tests play every Funnel Sort winning order through real physics with no rescues, and every Loop Sort winning order through the scripted loop.
- Engine tests register one extra gameplay pack and cover uneven level banks, duplicate registration, the physics landing and storage fallback.
- Browser tests complete all thirteen levels by touch and cover losing and undoing in every type, hints, restart, reload, denied storage, desktop and narrow layouts, and Loop Sort's messages for refused taps.

Browser tests set the game clock by hand so software-rendered runs repeat. They do not measure frame rate on a phone. The sound is synthesized, and a person still has to judge it.
