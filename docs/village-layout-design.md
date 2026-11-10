# Six distinct village machines

The user found the first two villages identical. They currently share one terrain
layout and one marble machine, with different landmarks. The replacement must
change landform, route topology, construction composition, track profile and
causal machinery for each of the six registered chapters. Recolouring, rotating
or mirroring a shared route does not satisfy this change.

This document records design decisions before implementation. Astra's proposal
and Opus 5.5 high's UX review agree on the architecture and constraints below.
Fable's creative discussion is complete. The decisions below resolve its changes
against the phone and geometry constraints from Opus; implementation follows
this agreed direction.

## Calling contract and ownership

The campaign, saved stop indices and seven Atelier project IDs/gates keep their
existing owners. A chapter selects an explicit `VillagePlan`, never a location
`kind` or a modulo fallback. Every registered chapter must have its own plan.

Each plan owns terrain footprint/heights/holes, ten stable stop indices with
independent build and badge anchors, mechanical assemblies, explicitly authored
connections, contact timing, scenery, Workshop and reward placements, camera
shots and the previous-village handoff port. Location kind can select dressing
assets; it must not select a recycled layout.

Shared mechanical primitives own both rendered support surfaces and marble
contact frames. Moving carriers return their exact transformed contact point.
Connections terminate at the real carrier boundary and meet across their usable
width. The compiler rejects mismatched port positions, tangents, normals or
profile widths instead of inventing a bridge or blending incompatible frames.
There are no global rules such as “stop 3 is the bucket wheel”.

The options considered were six scene classes or six authored plans compiled
through shared geometry/contact primitives. Plans avoid duplicating the cup,
wheel, support, camera and resource fixes while permitting independent authored
composition. This should remain a small set of concrete primitives, not a
general animation language or a random terrain generator.

## Agreed village identities

| Village | Landform and composition | Signature sequence | Track and supports |
| --- | --- | --- | --- |
| Little Harbour | A low crescent quay around a tidal inlet, boats inside and warehouses outside | Crane release, a bascule pier, opening lock doors and a loading chute into the boat; its boom rings the ship's bell | Plank flume on piles |
| Glasshouse Gardens | Three broad planted terraces, greenhouse rows along the rear | A cascade of rigid tipping troughs, finishing at a basin or fountain | Terracotta troughs on low piers |
| Willow Mill | Unequal riverbanks, a central millwheel and a long millrace | A trip paddle releases the mill's own bucket wheel, then a roof flume, sluice and sack-hoist payoff | Wide timber millrace on trestles |
| Clockmaker’s Hill | A broad foot and narrow radial summit; clock tower beside a slim mast | External helix, a marble-struck spinning top driving the escapement, turntable, pendulum striker and hand turning to twelve | Open twin rails on brass brackets |
| Cloud Bridge | Diagonally separated mesas above a visible low ravine floor, buildings at bridgeheads | Suspended carrier outward, swinging plank crossing back, then a windlass descent raising a banner | Girder deck and cable hangers |
| High Glassworks | An amphitheatre open toward the camera, chimneys behind the tiers | Opposed ramps, tilting marver, ribbed cooling gallery, the six villages' only vertical loop, gathering bowl and a ladle launch into the cooling rack | Steel channel on lattice supports |

Ten construction stops may build supports and parts of one signature assembly.
Each step still adds a visible mass of roughly 1.5 world units at map scale.
Negative space such as the inlet, ravine or basin occupies the lower HUD band;
interactive structures belong above it. Shape and composition must distinguish
the villages in grayscale and in the small wider-world view.

Fable's principal objection was wheel/bell repetition. The large wheel now
belongs to the Mill alone; the Harbour's bell is a small ship-board finale.
Gardens steps sideways and pays off with watering/fountain machinery. The Clock
uses a pendulum striker, leaving the Bridge's suspended carrier distinctive.
The Glassworks finale opens mechanical lantern shutters rather than changing
ambient light or adding emissive materials. Greenhouse/cooling passages use
open frames and visible apertures; an opaque glass-coloured roof must not hide
the marble.

Generic support, channel and carrier primitives remain reusable. A literal
two-village cap on every primitive would contradict the shared geometry contract
and is not adopted. Distinctness is enforced on the visible mechanism sequences,
spatial arrangement, profiles and landforms instead. Likewise, film order stays
9→0 as agreed with Opus; no campaign or save change is needed to swap positions.
The crane/weight supplies the only initial release, and later lifts show a
visible power source. No signature effect may run before its causal contact.

Possible new Blender templates are one warehouse and one willow. Genuinely
unused spiral and mill-rotor geometry can be retired from the runtime export
after a usage audit; editable source remains. Add no fixed art beyond the
existing ceiling. Preserve the corrected house surfaces and all seven real
gameplay cue PNGs when regenerating assets.

## Settled phone and motion constraints

The reference remains 375×690 upright, plus the existing desktop layout. Stop
targets remain 44 CSS px; stop centres stay at least 48 px apart. The existing
Workshop marker's stronger stop/stem separation checks remain. All badges,
stems, build masses and Workshop door/marker must clear the HUD across ±15° map
yaw. A badge must not sit on another stop's visible construction.

The film remains 25 seconds plus the 2.5-second previous-village handoff. It
enters at stable stop 9 and ends at stop 0. Each stop has a contact, with contact
windows of 0.8–4 seconds, no plain connector longer than 2.5 seconds, first
contact by 2.5 seconds and the finale resolved at least 1.2 seconds before the
end. A part moves only after visible contact or a mechanically driven cause.
Carriers hand off at a dwell or extreme with zero relative velocity.

Camera FOV stays 34°, elevation 32–50°, rest yaw zero. Follow shots may use
smooth yaw within ±20° and must fit the complete active linkage as well as the
marble. Reduced motion uses at most seven fixed shots of at least two seconds;
cuts happen between contacts. The clock helix surrounds a slim mast, never an
opaque tower. The ravine has a visible low floor; the glassworks stays open at
the front. Spans must not squash during construction; each plan declares a
bounded rise/drop/swing transform, with snapping under reduced motion.

Blender kit instances use uniform scale, rotation and translation to retain
their corrected proportions and surface gaps. Procedural terrain replaces the
shared terrain asset in the runtime rather than adding six terrain downloads.
Ground-height and occupied-region queries come from the plan, including holes,
so supports cannot rely on neighbouring stop heights.

## Required proof

- Every registered chapter has a plan. No fallback silently reuses a layout.
- Replacing one plan with a rotated, mirrored, translated or scaled copy fails
  the spatial-identity check. Ordered mechanism-kind sequences differ by at least
  five edits out of ten; normalized anchor arrangements must also differ.
- Port mismatch mutants fail. All plans pass swept sphere/track/support/scenery,
  earned-reward and exposed coplanar-face checks, including moving handoffs.
- Actual support is checked across the full usable mouth width. The repaired
  houseposts/panes, cup floors, layered spokes and bucket mouths stay covered.
- At every contact the marble and active linkage are visible. Static-geometry
  raycasts reject continuous cargo occlusion over 0.25 seconds, in both motion
  modes and both viewports. Safe-area and badge tests cover the yaw range.
- Distinct overview silhouettes and full local sequences are inspected in
  grayscale. Seeded presentation saves are labelled and do not prove game wins.
- Fixed geometry stays merged per stop, with roughly eight moving groups per
  plan. Calls and triangles stay within the recorded scene workload. The resting
  map draws nothing. All existing download and gameplay timing ceilings remain.

## Current repair baseline and implementation boundary

The geometry repair beneath this design passed 123 focused tests, typecheck,
lint, a 2.107 / 2.125 MB build, manual before/after phone probes and both complete
playback/replay/reduced-motion journeys. Evidence is
`output/current/world-z-fighting/verification.json`. Fixed art is
118,970 / 120,000 gzip bytes, reward/cue PNGs 72,368 / 100,000 bytes, audio
37,470 / 45,000 bytes. No new frame-time measurement or physical-phone performance
claim follows from these checks.

Implement a complete Harbour/Gardens pair first to prove the contract and visual
difference, then finish the remaining four. Two finished villages do not complete
the six-village request. Final browser and performance checks follow the combined
implementation on a frozen source tree.
