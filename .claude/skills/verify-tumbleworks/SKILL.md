---
name: verify-tumbleworks
description: Drive the Tumbleworks marble-sorting game (Funnel Sort, Loop Sort, Tube Sort) in a real phone-sized browser and prove a gameplay, HUD, picker or rendering change works. Taps are real touches at the game's own targets, with screenshots, state and stored progress as evidence. Use before claiming a gameplay or UI change works, to reproduce a player report, or for evidence for the owner.
---

# Verify Tumbleworks

Tumbleworks is a phone-first browser game: a Three.js canvas (the toy) under a slim DOM HUD. The player's phone is about 375x690 CSS px held upright; that is the default viewport here. The repo's rules live in `AGENTS.md`; the feature map in [`features/README.md`](features/README.md) lists what to drive.

Everything runs through Docker Compose from the repository root. The dev server (`dev` service, port 5180) serves the working tree through Vite. Journeys run in the repo's Playwright container (`e2e` profile), which reaches the server as `http://game-server:5180` and renders with SwiftShader.

## Launch

```sh
.claude/skills/verify-tumbleworks/scripts/launch.sh
```

- If the `dev` service is already running, the script reuses it. The owner usually leaves it up for their phone.
- If it isn't, the script runs `docker compose up -d --build dev` and records that this run started it.
- It is ready when `http://localhost:5180/` answers. Usable means a browser reaches a board, which `doctor` checks next.
- No data dir or seed is needed: each journey opens a fresh browser context with empty `localStorage`, so it starts on level 1 with no saved progress.

## Doctor

```sh
.claude/skills/verify-tumbleworks/scripts/doctor.sh
```

This check is read-only. It confirms:

- the service is running and port 5180 answers 200;
- which commit, branch and how many changed files are being served (Vite serves uncommitted edits);
- a real browser boot reaches a board, the boot message clears, and the picker lists the whole campaign.

Run it first, and again whenever a journey fails strangely. A boot over 90 s usually means another heavy browser run is sharing the CPU.

## Drive

```sh
docker compose --profile e2e run --rm -e npm_config_cache=/app/output/.npm-cache e2e npx -y tsx@4.23.15 .claude/skills/verify-tumbleworks/scripts/tw.ts <journey> [level] [--desktop] [--run <id>]
```

The project doesn't install `tsx`, so `npx` fetches the pinned version once into `output/.npm-cache` (git-ignored), where the throwaway container keeps it for later runs.

`level` is a stable ID (`board-31`, `loop-41`, `tube-1`) or a 1-based campaign number. A bank board outside the campaign, such as the lesson boards `board-200` or `loop-201`, opens through the game's development route `/?try=<id>`. Use the same `--run <id>` for every journey of one verification, so the evidence lands in one folder.

| Journey | Proves |
| --- | --- |
| `doctor` | The page boots to a board and lists every level. |
| `win <level>` | The authored winning order, played by touch, wins. The card offers Next level, completion is stored, and the chip shows ✓ after a reload. |
| `jam <level>` | The authored losing order jams. The card explains it, Undo asks for attention, and Undo returns to playing. Funnel Sort and Loop Sort only. |
| `controls <level>` | Undo, Hint, holding ×3, Restart and Sound, through their accessible names. |
| `picker` | Level pill, chips, pattern legend, English/French switch, opening a level from a chip. |
| `render <level>` | Draw calls, triangles, shader programs and pixel ratio of a busy frame. |

How the driver plays:

- **Input.** Board taps are `page.touchscreen.tap` at points from `app.debugTargets()`, the game's own projection of `supply<n>` (Funnel crates), `lane<n>` (Loop lorries) and `tube<n>` (tubes). HUD controls go through `getByRole('button', { name })`: `Restart`, `Undo`, `Hint`, `Fast forward ×3 (hold)`, `Fast forward ×5 (hold)`, `Sound`, `Next level`, `Keep looking`. The level pill is `#levels-toggle` and a level chip is `.chip[data-level="<0-based index>"]`.
- **Clock.** The journeys set `app.manualClock` and move time with `app.advance()`, the same path a display frame takes, because software frames take about a quarter of a second. Input is never faked: no journey calls `activate()` or edits rule state.
- **Winning and losing orders** come from `tests/witnesses.ts` (Funnel and Loop) and the Tube Sort solutions in `src/puzzles/levels.ts`. That is the same data the browser specs use.

For a journey the script doesn't have, write it in the same style in `tw.ts` and add it to the feature map. Don't drive the app through internal setters.

## Evidence

Each journey writes to `output/current/verify/<run>/<journey>[-level][-desktop]/`:

- numbered screenshots of the whole phone screen, one after each action that matters;
- `steps.jsonl`, the rule state (`debugState()`) captured with each screenshot;
- `result.json`, with `ok` and every failed check;
- `render.json` for the `render` journey.

The console prints one `PASS` or `FAIL` line per check, then the folder. The exit code is non-zero on any failure.

Proof standards:

- Drive the real user path. Capture the action and the resulting state, not only the final screen.
- Check the side effect a player relies on, such as stored completion surviving a reload.
- Report a journey that could not run (no authored order, a level outside the campaign) as not verified, not as passed through another route.
- To show the owner a visual change, put the screenshots side by side. The owner is colour-blind and judges containers by their patterns: say which pattern and colour each container shows.
- Browser timings here measure SwiftShader, not a phone. For frame cost, use the tools under "Rendering cost" in `docs/verification.md`.

## Cleanup

```sh
.claude/skills/verify-tumbleworks/scripts/cleanup.sh
```

- It stops the dev server only if `launch.sh` started it.
- Journey containers run with `--rm`, so they remove themselves.
- It never deletes `output/current/verify/<run>/`, never touches the owner's snapshot preview on port 5181, and never kills by process name.

## Isolation and limits

- Journeys run in fresh browser contexts, so they never touch the owner's own browser or phone progress.
- Several journeys may run at once, but each SwiftShader page uses a lot of CPU. Run them one at a time beside the full Playwright suite.
- Vite serves the working tree. Edits made while a journey runs reload its page and spoil its evidence.
- Production builds have no `window.tumbleworks` hook, so these journeys need the dev server. `tests/e2e/smoke.spec.ts` shows the production-safe path, which uses the guide's tap hand.
- No real phone is driven here. For a phone check, link the owner to the dev server on the LAN and ask for a capture.

## Maintenance

When a feature, control or level structure changes, update the matching file in `features/` and the journey in `tw.ts` in the same change. `/maintain-verification-skill` audits the map against the code.
