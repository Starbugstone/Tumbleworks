# Valley progression

The executable bounded model is
[`tests/world/progression.test.ts`](../../../tests/world/progression.test.ts).
Run `npx vitest run tests/world` in the development container.

The invariant is: a new construction stop is available only when every earlier
campaign round has all three stable IDs completed. Previously completed or
partially played stops remain visitable for old saves. A win can advance only
within the round accepted by a map tap; crossing a round boundary returns to the
map and requires a new tap. Workshop and retired IDs never count towards a stop.
Repeated completion is idempotent. A completed stop can replay all three levels.

The bounded test explores all 64 completion subsets of a two-round campaign,
including out-of-order historical saves, duplicate completions, rejected future
clicks and legal in-round wins. Its independent prefix/count oracle checks the
production projection and permitted entry. The focused tests cover chapter
boundaries, 180/360-level membership, invalid inputs and stable chapter film keys.
Deliberate mutations that accept a future stop or let Next cross a round boundary
are passed to the same behavioral safety checks and must be rejected.
Film-store tests separately cover old-save migration, reload and unavailable
storage. This checks a finite projection of the production transition relation;
it is not a proof for arbitrary campaign changes or browser scheduling.

Browser journeys exercise real map touches, round completion, reloads and film
skip/replay. Presentation callbacks cannot grant completion: only the gameplay's
existing accepted win transition writes a completed level ID.
