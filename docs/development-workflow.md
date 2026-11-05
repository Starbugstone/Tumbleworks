# Game development workflow

Deliver a small playable change with evidence for its acceptance check. These
defaults apply without invoking a full orchestration workflow. Use only the
stages the change needs; ordinary edits do not need a review panel or a model.

## Start with observable behavior

Describe what the player should see or be able to do, the authoritative state
owner, and the check that would reject a broken implementation. Preserve the
permanent names, saved IDs, accessibility requirements and supported devices in
[AGENTS.md](../AGENTS.md). Review at about 375×690 CSS px and on the existing
desktop layout. Keep unsupported small and landscape phones out of new work.

For a bug, reproduce the failure before changing it. Keep the smallest useful
regression fixture with the fix. For a feature, implement one complete player
action through rules, presentation and input before expanding it.

## Replay every failure

Every game replays exactly from its accepted actions and the tick each landed on.
A bug report is a replay log, not a description. The level picker's **Copy this
game for a bug report** button produces the log, on a phone too:

```sh
docker compose exec -T dev npx tsx scripts/replay.ts <log.json>
```

`MATCH` means the state the player saw has been reproduced and can be stepped
through. Build the regression from the log with `replayOnto` and
[tests/replay-target.ts](../tests/replay-target.ts). Rules changes legitimately
invalidate old logs. `DIVERGED` on an unchanged build means that device simulates
differently, which is itself worth reporting: Chromium and Node are proven to match,
Safari and real phones aren't yet.

[tests/engine/replay.test.ts](../tests/engine/replay.test.ts) and
[tests/e2e/replay.spec.ts](../tests/e2e/replay.spec.ts) keep this true. Lint keeps
randomness and clocks out of the rules, along with `Math.sin`, `Math.cos` and the like:
those can differ in the last bit between browsers, and physics grows that bit into a
different game. Rules use [src/engine/exact-math.ts](../src/engine/exact-math.ts).

## Turn repeated mistakes into checks

Every issue found ends with something that catches it next time. Use a lint rule
([.oxlintrc.json](../.oxlintrc.json), run by `npm run lint` and in CI) or a type
constraint for a violation that can be checked reliably. Use a behavioral regression
for gameplay, timing, persistence or input. Show that the check rejects the original
failure and accepts a valid case, as [tests/engine/lint.test.ts](../tests/engine/lint.test.ts)
does for the determinism rule. ESLint isn't used because `typescript-eslint` doesn't
support TypeScript 7. A visual preference still needs visual review; a source-text
assertion does not establish what the player sees.

Keep comments explaining constraints or reasons that names cannot express. PR
counts and comment removal are not acceptance criteria.

## Check rules and presentation together

The project already has headless difficulty checks: authoring scripts search
settled states and retain winning and losing orders. Keep the recipe bands,
capacity floors and hint budgets in [AGENTS.md](../AGENTS.md). A solver witness
must also succeed in the real machine; physics and absorption timing can differ
from the settled approximation. Keep witnesses and jams in
[tests/witnesses.ts](../tests/witnesses.ts), and Tube Sort solutions with their boards.

For a changed gameplay path, exercise its real browser input and the relevant
undo, restart, invalid/cancelled input and successive-action behavior. Use the
existing Docker commands and browser specs. Put fresh captures in `output/current`.
Documentation-only changes need content and link checks rather than a gameplay run.

## Model consequential state transitions

Each major state machine gets a checked model in `docs/models/<system>/`, starting
with [Funnel Sort's belt slots](models/funnel-belt/README.md). The next candidates
are Loop Sort pours with undo and sound jam detection. A model belongs with any
change to the transitions it covers. Run all of them with:

```sh
bash scripts/check-models.sh
```

Name `pass-*` configs that must hold, `mut-*` configs that break a guarantee on
purpose and must be caught, and `reach-*` configs that prove the interesting cases are
explored. Record state bounds, assumptions, code correspondence and the checked
commit in the model's README. A passing bounded model establishes only that scope, so
pair it with a test of the same guarantee on the real code, like
[tests/machine/slot-invariants.test.ts](../tests/machine/slot-invariants.test.ts).
Replay any counterexample against the implementation before calling it a game bug.

## Hold the performance and download budgets

**Frame cost:** `tests/e2e/performance.spec.ts` plays the busiest levels through real
touches at a 4x CPU slowdown. It waits for adaptive resolution to settle, then
restarts and samples at a fixed full-phone canvas size. Its timing guard covers
one tick plus one draw; complete advance time and ticks per frame are reported
separately. Draw submission can include SwiftShader stalls, so this is a regression
proxy, not a measurement of a phone or the whole displayed frame. A new busiest
level requires its own recorded baseline. Other load skews it, so it is its own Playwright project that the full run starts only
after every other test has finished; run it by itself with `--no-deps`, or Playwright runs the rest first. A browser test can't measure
a phone, so feel on the player's phone remains a separate check, and frame intervals
under SwiftShader mostly measure the software renderer. Profile before changing
frame or tick code, and raise a ceiling only with the new baseline recorded in
[verification.md](verification.md). A `.hot.ts` allocation rule isn't adopted: nothing
measured yet shows garbage collection is the problem, and it needs that evidence first.

**First download:** `npm run build` fails when the gzipped first download passes its
ceiling in [scripts/check-bundle-budget.mjs](../scripts/check-bundle-budget.mjs).
Raise it on purpose, with the reason.

Report the result, relevant checks actually run, and any verification limits.
Follow existing delivery authorization; this workflow adds no merge or deployment grant.

## Source and adaptation

These defaults adapt [Poteto's game workflow post of 1 November 2026](https://x.com/poteto/status/2117043478140276847).
Its text was retrieved through the [FxTwitter mirror](https://api.fxtwitter.com/poteto/status/2117043478140276847).
The post describes bug-prevention lint rules, TLA+, allocation restrictions,
deterministic replay, build budgets and headless difficulty tuning. Its delivery
and performance figures are the author's reports, not measurements of this game.
The workflow here reuses our engine and phone requirements. Its comment ban and
per-file allocation rule aren't adopted, and there is no server replay validation.
