---
name: verify-tumbleworks
description: Drive the Tumbleworks marble-sorting game (Funnel Sort, Loop Sort, Tube Sort) in a real phone-sized browser and prove a gameplay, HUD, picker or rendering change works. Taps are real touches at the game's own targets, with screenshots, state and stored progress as evidence. Use before claiming a gameplay or UI change works, to reproduce a player report, or for evidence for the owner.
---

# Verify Tumbleworks

Tumbleworks is a phone-first browser game: a Three.js canvas (the toy) under a slim DOM HUD. The player's phone is about 375x690 CSS px held upright; that is the default viewport here. The repo's rules live in `AGENTS.md`; the feature map in [`features/README.md`](features/README.md) lists what to drive.

Everything runs through Docker Compose from the repository root. The dev server (`dev` service, port 5180) serves the working tree through Vite. Journeys run in the repo's Playwright container (`e2e` profile), which reaches the server as `http://game-server:5180` and renders with SwiftShader.

## Launch

```sh
RUN_ID="verify-$(date -u +%Y%m%dT%H%M%S)-$$"
.claude/skills/verify-tumbleworks/scripts/launch.sh "$RUN_ID"
```

- Keep this unique run ID for launch, doctor, every journey and cleanup. Use only letters, digits, underscores and hyphens. Launch refuses an existing lease with the same ID.
- If the `dev` service is already running, the script reuses it. The owner usually leaves it up for their phone. Reuse grants no authority to stop it.
- If it isn't, the script runs `docker compose up -d --build dev`. Under a lock, it records the exact container ID and whether this run started it in `output/current/verify/.sessions/<run>`; reusers also receive a lease.
- It is ready when `http://localhost:5180/` answers. Usable means a browser reaches a board, which `doctor` checks next.
- No data dir or seed is needed: each journey opens a fresh browser context with empty `localStorage`, so it starts on level 1 with no saved progress.

## Doctor

```sh
RUN_ID="$RUN_ID" .claude/skills/verify-tumbleworks/scripts/doctor.sh
```

This check is read-only. It confirms:

- the service is running and port 5180 answers 200;
- which commit, branch and how many changed files are being served (Vite serves uncommitted edits);
- a real browser boot reaches a board, the boot message clears, and the picker lists the whole campaign.

Run it first, and again whenever a journey fails strangely. A boot over 90 s usually means another heavy browser run is sharing the CPU.

## Drive

```sh
docker compose --profile e2e run --rm -e npm_config_cache=/app/output/.npm-cache e2e npx -y tsx@4.23.15 .claude/skills/verify-tumbleworks/scripts/tw.ts <journey> [level] --run "$RUN_ID" [--desktop]
```

The project doesn't install `tsx`, so `npx` fetches the pinned version once into `output/.npm-cache` (git-ignored), where the throwaway container keeps it for later runs.

`level` is a stable ID (`board-31`, `loop-41`, `tube-1`) or a 1-based campaign number. A bank board outside the campaign, such as the lesson boards `board-200` or `loop-201`, opens through the game's development route `/?try=<id>`. Use the same `--run <id>` for every journey of one verification, so the evidence lands in one folder.

| Journey | Proves |
| --- | --- |
| `doctor` | The page boots to a board and lists every level. |
| `win <level>` | The authored winning order, played by touch, wins. The card offers Next level, completion is stored, and the chip shows ✓ after a reload. |
| `jam <level>` | The authored losing order jams. The card explains it, Undo asks for attention, and Undo returns to playing. Funnel Sort and Loop Sort only. |
| `controls <level>` | A real action changes the full game fingerprint; Undo restores the precise pre-action state and Restart restores the initial state. Also Hint, a mouse-held ×3 and Sound. |
| `picker` | Level pill, chips, pattern legend, English/French switch, opening a level from a chip. |
| `render <level>` | A settled scene census: draw calls, triangles, shader programs and pixel ratio after up to three taps, settling after each. This is not a busy-frame or performance measurement. |

How the driver plays:

- **Input.** Board taps are `page.touchscreen.tap` at points from `app.debugTargets()`, the game's own projection of `supply<n>` (Funnel crates), `lane<n>` (Loop lorries) and `tube<n>` (tubes). HUD controls go through `getByRole('button', { name })`: `Restart`, `Undo`, `Hint`, `Fast forward ×3 (hold)`, `Fast forward ×5 (hold)`, `Sound`, `Next level`, `Keep looking`. The level pill is `#levels-toggle` and a level chip is `.chip[data-level="<0-based index>"]`.
- **Clock.** The journeys set `app.manualClock` and move time with `app.advance()`, the same path a display frame takes, because software frames take about a quarter of a second. Input is never faked: no journey calls `activate()` or edits rule state.
- **Winning and losing orders** come from `tests/witnesses.ts` (Funnel and Loop) and the Tube Sort solutions in `src/puzzles/levels.ts`. That is the same data the browser specs use.

For a journey the script doesn't have, write it in the same style in `tw.ts` and add it to the feature map. Don't drive the app through internal setters.

## Evidence

Each journey writes to `output/current/verify/<run>/<journey>[-level][-desktop]/`:

- numbered screenshots of the whole phone screen, one after each action that matters;
- `steps.jsonl`, the inspected state (`debugState()`) and full game fingerprint captured with each screenshot;
- `result.json`, with `evidenceKind`, `ok` and every failed check;
- `render.json` for the `render` journey, labelled `settled-scene-census`, including `busy` and `settling` at capture.

The console prints one `PASS` or `FAIL` line per check, then the folder. The exit code is non-zero on any failure.

Proof standards:

- Drive the real user path. Capture the action and the resulting state, not only the final screen.
- Check the side effect a player relies on, such as stored completion surviving a reload.
- The controls journey restarts with the manual clock stopped, records the fingerprint just before the accepted action, proves a change before any tick, lets the motion settle, then reads Undo immediately without advancing another tick. Restart is compared against the original tick-zero fingerprint. The fingerprints cover Funnel Sort physics, rules and machine control, Loop Sort rules and machine control, and the full Tube Sort rule state.
- Report a journey that could not run (no authored order or an unknown board ID) as not verified, not as passed through another route. Known bank boards outside the campaign are supported through `/?try=<id>`.
- To show the owner a visual change, put the screenshots side by side. The owner is colour-blind and judges containers by their patterns: say which pattern and colour each container shows.
- Browser timings here measure SwiftShader, not a phone. For frame cost, use the tools under "Rendering cost" in `docs/verification.md`.

## Cleanup

```sh
.claude/skills/verify-tumbleworks/scripts/cleanup.sh "$RUN_ID"
```

- Cleanup requires the same run ID used by launch. It removes only that run's lease. It stops a container only if this run started it, its exact ID still matches the running dev container, and no other run has a lease for it.
- A reused server, a replacement container and an unknown run are left running. If the starting run cleans up while another run still has a lease, it leaves the server running; ownership is not transferred to the reuser, so the final reuser also leaves it running. Preserve that server for its owner to manage.
- If launch times out after recording a lease, keep its run ID for cleanup. Never remove another run's marker or stop a container by service or process name to compensate.
- Journey containers run with `--rm`, so they remove themselves.
- It never deletes `output/current/verify/<run>/`, never touches the owner's snapshot preview on port 5181, and never kills by process name.

## Isolation and limits

- Journeys run in fresh browser contexts, so they never touch the owner's own browser or phone progress.
- Several journeys may run at once, but each SwiftShader page uses a lot of CPU. Run them one at a time beside the full Playwright suite.
- Vite serves the working tree. Edits made while a journey runs reload its page and spoil its evidence.
- Production builds have no `window.tumbleworks` hook, so these journeys need the dev server. `tests/e2e/smoke.spec.ts` shows the production-safe path, which uses the guide's tap hand.
- The focused release input coverage lives in [`tests/e2e/input-regressions.spec.ts`](../../../tests/e2e/input-regressions.spec.ts): picker finger scrolling, same-target slide taps and independent fast-forward holds. It complements these journeys; record its actual run result separately. [Drag](../../../tests/e2e/drag.spec.ts), [overlapping moves](../../../tests/e2e/overlap.spec.ts), [render hygiene](../../../tests/e2e/render-hygiene.spec.ts) and [Loop Sort variants](../../../tests/e2e/loop-features.spec.ts) have their own specs.
- No real phone is driven here. For a phone check, link the owner to the dev server on the LAN and ask for a capture.

## Maintenance

When a feature, control or level structure changes, update the matching file in `features/` and the journey in `tw.ts` in the same change. `/maintain-verification-skill` audits the map against the code.
