# Tumbleworks verification map

This directory is the maintained source for verifying what a Tumbleworks player sees and does. Read this index before driving the game, then use the matching feature file as the recipe. The commands come from [`../SKILL.md`](../SKILL.md); `tw` below means:

```sh
docker compose --profile e2e run --rm -e npm_config_cache=/app/output/.npm-cache e2e npx -y tsx@4.23.15 .claude/skills/verify-tumbleworks/scripts/tw.ts
```

## Baseline preconditions

- Launch with a unique run ID: `scripts/launch.sh <id>`. Reuse that ID for `RUN_ID=<id> scripts/doctor.sh`, journey `--run <id>` and `scripts/cleanup.sh <id>`. The `dev` service answers on port 5180 and doctor passes. See the skill for exact-container lease rules; existing servers and other runs are preserved.
- Each journey opens a fresh phone-sized browser context (375x690, touch): level 1, no saved progress, English unless the browser prefers French.
- Nobody is editing `src/` during the run: Vite reloads the page on every save.

## Driving conventions

- Board pieces are named targets from the game: `supply<n>` (Funnel Sort crates by column, or crate ID on fork boards), `lane<n>` (Loop Sort lorries), `tube<n>` (Tube Sort tubes), all zero-based. `tw` taps their projected screen points with real touches.
- HUD controls are found by accessible name: `Restart`, `Undo`, `Hint`, `Fast forward ×3 (hold)`, `Fast forward ×5 (hold)`, `Sound`, `Next level`, `Keep looking`.
- Levels are named by stable ID (`board-n`, `loop-n`, `tube-n`) or by 1-based campaign number. IDs imply nothing about order: `PLAY_ORDER` in `src/campaign.ts` holds it, and older boards such as `board-4` stay in their banks outside the campaign. `tw` opens a bank board with `/?try=<id>`.
- Time moves through the game's own tick path; the journeys never set rule state.

## Proof and skip reporting

- Every journey leaves numbered screenshots, `steps.jsonl` (inspected state and full game fingerprint per screenshot) and `result.json` in `output/current/verify/<run>/`.
- A win is proven by the status, the card, stored completion and the ✓ after a reload, never by the status alone.
- Report a journey that cannot run (no authored order for that level) as not verified, with the reason.
- `tw render` is a settled scene census. It records `busy` and `settling` and never establishes busy-frame cost or phone performance.
- Phone feel, sound and frame rate on a real device are outside what this map can prove: ask the owner for a capture.

## Feature entry contract

Each feature file starts with an H1 title and one paragraph describing the player-visible behavior. It then uses exactly four H2 sections in this order: `Sub-features`, `How to get to it (user POV)`, `Driving it with tw`, `Gotchas`.

## Features

- [Funnel Sort](./funnel-sort.md): crates pour into the funnel, the belt feeds the docks, boxes fill, and a full belt jams.
- [Loop Sort](./loop-sort.md): lorries pour onto the loop and fill from it, with lorry cards, refused taps and jams.
- [Tube Sort](./tube-sort.md): groups move between tubes by two taps or a drag.
- [Controls](./controls.md): Undo, Restart, Hint, held fast forward and Sound on every game.
- [Level picker and progress](./level-picker.md): choosing levels, stored completion, Next level, language and the bug-report copy.

Focused release coverage also lives in [`tests/e2e/input-regressions.spec.ts`](../../../../tests/e2e/input-regressions.spec.ts). The map describes coverage, not a passing release run; record the command, revision and result when it runs.
