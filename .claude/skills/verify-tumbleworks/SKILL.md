---
name: verify-tumbleworks
description: Drive Tumbleworks (Funnel Sort, Loop Sort, Tube Sort), its village progression and Workshop in a real phone-sized browser. Prove gameplay, navigation, HUD, picker or rendering changes with real touches, screenshots, state and stored progress. Use before claiming a gameplay or UI change works or to reproduce a player report.
---

# Verify Tumbleworks

Tumbleworks is a phone-first browser game: a Three.js canvas (the toy) under a slim DOM HUD. The player's phone is about 375x690 CSS px held upright; that is the default viewport here. The repo's rules live in `AGENTS.md`; the feature map in [`features/README.md`](features/README.md) lists what to drive.

**Current film target:** all six production films use `VillageCinematic`, with
continuous authored motion and path-length timing. Force/torque certificates are
offline research and never gate a film. Complete normal/reduced phone journeys,
desktop replay, geometry and visibility checks are recorded in
`output/current/village-cinematic/HANDOFF.md`. Puzzle physics and progress remain
separate. [`integration.md`](integration.md) and its dated snapshots are historical
records, not an active source/browser lease or a fixed 25-second film contract.

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
- No data dir or manual seed is needed. Each journey opens a fresh browser context; ordinary Workshop gameplay seeds only exact campaign milestone IDs and records them in `fixture.json`, with no project wins. Other journeys start with empty `localStorage`. Normal boot shows the village map with the first stop available; a level journey enters gameplay through the map and picker. Bank `?try=` links open their puzzle directly.

## Doctor

```sh
RUN_ID="$RUN_ID" .claude/skills/verify-tumbleworks/scripts/doctor.sh
```

This check is read-only. It confirms:

- the service is running and port 5180 answers 200;
- which commit, branch and how many changed files are being served (Vite serves uncommitted edits);
- a real browser boot reaches the map, its first stop opens a playable board, the boot message clears, and the picker lists the whole campaign.

Run it first, and again whenever a journey fails strangely. A boot over 90 s usually means another heavy browser run is sharing the CPU.

## Drive

```sh
docker compose --profile e2e run --rm -e npm_config_cache=/app/output/.npm-cache e2e npx -y tsx@4.23.15 .claude/skills/verify-tumbleworks/scripts/tw.ts <journey> [level] --run "$RUN_ID" [--desktop]
```

The project doesn't install `tsx`, so `npx` fetches the pinned version once into `output/.npm-cache` (git-ignored), where the throwaway container keeps it for later runs.

`level` is a stable ID (`board-31`, `loop-41`, `tube-1`) or a 1-based campaign number. A bank board outside the campaign, such as `board-202`, `loop-201` or `tube-201`, opens through the game's development route `/?try=<id>`. Use the same `--run <id>` for every journey of one verification, so the evidence lands in one folder. Campaign membership comes from `PLAY_ORDER`, never the numeric suffix of an ID.

The Workshop API uses a stable ID with `--workshop` on `win`, `jam`, `controls` or `render`, for example `win board-212 --workshop --run "$RUN_ID"`; `workshop board-212 --run "$RUN_ID"` drives the footer/chooser. **Gate support and `board-212` chooser/win/jam were proven on the earlier snapshot; no current VillagePlans live pass is claimed.** The owner reports routes/selectors/gates unchanged, so no new driver adaptation is requested. Ordinary gameplay seeds a disposable fixture of exact campaign milestone IDs, never project wins, and writes its baseline to `fixture.json`. Both footer lookups use `#world-workshop`. The building hammer shares the accessible name Workshop / Atelier, so unscoped name-only calls are ambiguous. Real unlock/reward proof belongs to `workshop-projects.spec.ts`, not that fixture. All seven boards also remain in development banks; the bank route cannot establish player project availability or Workshop isolation. The earlier bounded run did not re-drive every project's mechanism or Workshop controls/render journeys.

| Journey | Proves |
| --- | --- |
| `doctor` | Normal boot shows the map, a stop opens gameplay, and the picker lists every campaign level. |
| `win <level>` | The authored touch order wins. Next level stays within a stop; finishing a stop returns to the map. Completion survives reload as a campaign chip ✓ or Workshop chooser badge. |
| `jam <level>` | An authored losing order jams; the card explains it, Undo asks for attention, and Undo returns to playing. Funnel/Loop fixtures and the two Tube variety fixtures are supported; classic Tube boards have no stored jam orders. |
| `controls <level>` | A real action changes the full game fingerprint; Undo restores the precise pre-action state and Restart restores the initial state. Also Hint, a mouse-held ×3 and Sound. |
| `picker` | Level pill, chips, pattern legend, English/French switch, opening a level from a chip. |
| `map` | Real touches complete all three games at the first stop, build it, unlock the next stop, persist through reload and require a map tap to enter that next stop. The paused puzzle does not advance on the map. |
| `workshop <level>` | The map footer opens the complete exported chooser, a real touch opens the exact Workshop ID/source, and Valley map returns without changing campaign stops. |
| `render <level>` | A settled scene census: draw calls, triangles, shader programs and pixel ratio after up to three taps, settling after each. This is not a busy-frame or performance measurement. |
| `payoff board-31` | Real touches followed by captures of left/right/middle landings and the completed box's departure. |

How the driver plays:

- **Input.** Board taps are `page.touchscreen.tap` at points from `app.debugTargets()`, the game's own projection of `supply<n>` (Funnel crates), `lane<n>` (Loop lorries) and `tube<n>` (tubes). HUD controls go through `getByRole('button', { name })`: `Restart`, `Undo`, `Hint`, `Fast forward ×3 (hold)`, `Fast forward ×5 (hold)`, `Sound`, `Next level`, `Keep looking`. The level pill is `#levels-toggle` and a level chip is `.chip[data-level="<0-based index>"]`.
- **Map CTA.** `.wv-play` is `▶ Play next level` / `▶ Jouer le niveau suivant` and resumes the campaign frontier. Completed-location Film is secondary while puzzles remain, with accessible name `Film · Watch your machine`; Film becomes the sole primary action when the whole campaign is complete. `world.spec.ts` holds this CTA's browser proof. Existing `tw map` stop-button coverage does not imply it drove the primary CTA.
- **Clock.** The journeys set `app.manualClock` and move time with `app.advance()`, the same path a display frame takes, because software frames take about a quarter of a second. Input is never faked: no journey calls `activate()` or edits rule state.
- **Winning and losing orders** come from `tests/witnesses.ts` and `tests/variety-witnesses.ts` (Funnel and Loop), Tube solutions in `src/puzzles/{levels,variety-boards}.ts`, and the two Tube variety jam paths in `tests/puzzles/tube-variety-fixtures.ts`. That is the same data the browser specs use.

For a journey the script doesn't have, write it in the same style in `tw.ts` and add it to the feature map. Don't drive the app through internal setters.

## Evidence

Each journey writes to `output/current/verify/<run>/<journey>[-level][-desktop]/`:

- numbered screenshots of the whole phone screen, one after each action that matters;
- `steps.jsonl`, the inspected state (`debugState()`) and full game fingerprint captured with each screenshot;
- `result.json`, with `evidenceKind`, `ok` and every failed check;
- `render.json` for the `render` journey, labelled `settled-scene-census`, including `busy` and `settling` at capture.
- `source.json` with the command, start time, URL, Git head/branch and working-tree status. Vite serves dirty files too; keep the product owner's source hashes or snapshot when comparing builds.

A repeated journey in the same run gets an `-attempt-2` (then 3, etc.) directory; earlier screenshots, verdicts and failures remain intact. `source.json` records the start state, so edits during a journey still invalidate it.

The console prints one `PASS` or `FAIL` line per check, then the folder. The exit code is non-zero on any failure.

Proof standards:

- Drive the real user path. Capture the action and the resulting state, not only the final screen.
- Check the side effect a player relies on, such as stored completion surviving a reload.
- The controls journey restarts with the manual clock stopped, records the fingerprint just before the accepted action, proves a change before any tick, lets the motion settle, then reads Undo immediately without advancing another tick. Restart is compared against the original tick-zero fingerprint. The fingerprints cover Funnel Sort physics, rules and machine control, Loop Sort rules and machine control, and the full Tube Sort rule state.
- Report a journey that could not run (no authored order or an unknown board ID) as not verified, not as passed through another route. Known bank boards outside the campaign use `/?try=<id>`; exported Workshop levels require `--workshop` and their own source. Workshop wins check Back to workshop, unchanged campaign completion, saved completion and `.wv-workshop-check` in the chooser after reload. The level picker always lists campaign chips, including when opened from a Workshop game.
- To show the owner a visual change, put the screenshots side by side. The owner is colour-blind and judges containers by their patterns: say which pattern and colour each container shows.
- Browser timings here measure SwiftShader, not a phone. For frame cost, use the tools under "Rendering cost" in `docs/verification.md`.
- World rendering uses [`world-performance.spec.ts`](../../../tests/e2e/world-performance.spec.ts). Historical World/browser/gameplay passes do not validate the live VillagePlans/terrain/Scene tree. Each village's actual machine and authored camera require fresh source-matched evidence after repairs. Keep active rendering separate from hidden gameplay work, and retain workload/quality guards. After explicit handoff, use separate single-worker runs and raw JSON reporting (`PLAYWRIGHT_JSON_OUTPUT_FILE`, `--reporter=list,json`) plus the versioned summarizer, with source/harness hashes. See [`integration.md`](integration.md) and the [earlier 3D snapshot](integration-2026-11-07-3d-snapshot.md); browser measurements add no World timing ceilings or physical-phone claims.

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
- Run journeys serially and coordinate the browser slot with other active threads. Performance measurements must run completely alone; unrelated host load can still invalidate their timing.
- Vite serves the working tree. Freeze runtime/import/style/configuration changes during a journey, including this skill's scripts and `scripts/tsconfig.json`: even a new hidden tsconfig can trigger a full reload. Limit concurrent work to agreed unused tests, Markdown and ignored scratch. An HMR-interrupted journey is invalidated evidence and needs a stable-tree rerun.
- Production builds have no `window.tumbleworks` hook, so these journeys need the dev server. `tests/e2e/smoke.spec.ts` shows the production-safe path, which uses the guide's tap hand.
- The focused release input coverage lives in [`tests/e2e/input-regressions.spec.ts`](../../../tests/e2e/input-regressions.spec.ts): picker finger scrolling, same-target slide taps and independent fast-forward holds. It complements these journeys; record its actual run result separately. [Drag](../../../tests/e2e/drag.spec.ts), [overlapping moves](../../../tests/e2e/overlap.spec.ts), [render hygiene](../../../tests/e2e/render-hygiene.spec.ts), [Funnel Sort variants](../../../tests/e2e/funnel-features.spec.ts), [Loop Sort variants](../../../tests/e2e/loop-features.spec.ts) and [Tube Sort roles](../../../tests/e2e/tube-roles.spec.ts) have their own specs.
- No real phone is driven here. For a phone check, link the owner to the dev server on the LAN and ask for a capture.

## Maintenance

When a feature, control, entry screen, save contract or level structure changes, update the matching file in `features/` and its journey in `tw.ts` in the same change. `/maintain-verification-skill` audits the map against source and the running game. Read [`integration.md`](integration.md) before verifying this shared checkout: it tracks the active campaign, world and variety work and its outstanding proof.

The normal project typecheck does not include this hidden skill directory. Check its driver explicitly after edits:

```sh
docker compose exec -T dev npx tsc --project .claude/skills/verify-tumbleworks/scripts/tsconfig.json
```

During concurrent work, read each active project thread before reconciling its changes. Reserve one owner for this skill directory, obtain entry routes/selectors and evidence from the product owners, and serialize browsers with their performance runs. Recheck the actual imports and registry after each ready signal: an unused module or concept film is not playable coverage. Keep pending recipes labelled until driven against the integrated build. Record the source revision/working-tree state, commands, failures and evidence paths; a prior thread's passing run is historical evidence, not a rerun of the current tree. Do not create recurring maintenance schedules unless requested.

Preserve the owner's no-clipping rule: actual swept marble/track width must clear geometry, moving supports and earned additions, with intentional contacts explicit. Exposed trim, panes and mechanism floors need real surface separation or one shared surface, including moving handoffs. Keep collision and coplanar-overlap regressions; renderer depth settings must not conceal defective geometry. Inspect complete motion at the upright phone viewport. During a browser freeze, stage code patches outside watched imports and label them unapplied; do not save a skill tsconfig or driver until the owner releases the slot.
