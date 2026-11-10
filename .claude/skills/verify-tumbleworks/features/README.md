# Tumbleworks verification map

This directory is the maintained source for verifying what a Tumbleworks player sees and does. Read this index before driving the game, then use the matching feature file as the recipe. The commands come from [`../SKILL.md`](../SKILL.md); `tw` below means:

```sh
docker compose --profile e2e run --rm -e npm_config_cache=/app/output/.npm-cache e2e npx -y tsx@4.23.15 .claude/skills/verify-tumbleworks/scripts/tw.ts
```

## Baseline preconditions

- Six distinct VillagePlans, procedural terrain, Scene/Overview and the staged Blender kit are live locally, with integrated proof pending. The owner reports initial Scene checks at 39 passed / 29 failed out of 68; repairs continue. Root owns source/browser/CPU until explicit final handoff: scripts/config/served files and browser/heavy jobs stay frozen, Markdown/evidence only. Navigation/chooser/selectors/gates are reported unchanged and no new driver work is requested. Read [`../integration.md`](../integration.md); historical World/browser/gameplay and driver passes do not cover this tree.

- Launch with a unique run ID: `scripts/launch.sh <id>`. Reuse that ID for `RUN_ID=<id> scripts/doctor.sh`, journey `--run <id>` and `scripts/cleanup.sh <id>`. The `dev` service answers on port 5180 and doctor passes. See the skill for exact-container lease rules; existing servers and other runs are preserved.
- Each journey opens a fresh phone-sized browser context (375x690, touch) and an English browser. Ordinary Workshop gameplay seeds only the exact campaign milestone IDs needed for the project, with no project wins; `fixture.json` records this disposable precondition. Other journeys start without saved progress. Normal boot shows the village map; a stop opens gameplay. Direct bank links bypass the map.
- Agree a shared source freeze before driving: no runtime, import, style, configuration or skill-script saves. A hidden skill tsconfig can also reload Vite. See the skill for permitted concurrent scratch/docs work and serial browser ownership.

## Driving conventions

- Board pieces are named targets from the game: `supply<n>` (Funnel Sort crates by column, or crate ID on fork boards), `lane<n>` (Loop Sort lorries), `tube<n>` (Tube Sort tubes), all zero-based. `tw` taps their projected screen points with real touches.
- HUD controls are found by accessible name: `Restart`, `Undo`, `Hint`, `Fast forward ×3 (hold)`, `Fast forward ×5 (hold)`, `Sound`, `Next level`, `Keep looking`.
- Levels are named by stable ID (`board-n`, `loop-n`, `tube-n`) or by 1-based campaign number. IDs imply nothing about order: `PLAY_ORDER` in `src/campaign.ts` holds it, and older boards such as `board-4` stay in their banks outside the campaign. `tw` opens a bank board with `/?try=<id>`.
- Workshop is explicit: its driver API uses `--workshop` or `tw workshop <id>`. Applied gate/selector support has earlier-snapshot chooser/win/jam proof on `board-212`, not a current VillagePlans live pass. `WORKSHOP_LEVELS` owns puzzle membership; `src/world/workshop-projects.ts` owns milestone availability and rewards. Stored project wins cannot unlock campaign stops. Use `#world-workshop` for the footer; `[data-world-workshop]` is the separate 44 px building hammer with the same accessible name. Seeded milestone journeys do not prove unlocking through play.
- Time moves through the game's own tick path; the journeys never set rule state.

## Proof and skip reporting

- Every journey leaves numbered screenshots, `steps.jsonl` (inspected state and full game fingerprint per screenshot) and `result.json` in `output/current/verify/<run>/`.
- A win is proven by status, the expected card or map return, stored completion and the ✓ after reload. Next level stays within the accepted stop; a finished stop returns to the map.
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
- [World progression](./world-progression.md): village stops, three-game rounds, construction, films and the Workshop boundary. See [`../integration.md`](../integration.md) for final integration evidence, measurement recipes and the seven approved variety boards.

Focused release coverage also lives in [`tests/e2e/input-regressions.spec.ts`](../../../../tests/e2e/input-regressions.spec.ts). The map describes coverage, not a passing release run; record the command, revision and result when it runs.
