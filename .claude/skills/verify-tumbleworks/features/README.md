# Tumbleworks verification map

Start with [the verification skill](../SKILL.md) for launch, doctor and cleanup. Then use the feature recipe below. In those recipes, `tw` means the following command prefix.

```sh
docker compose --profile e2e run --rm -e npm_config_cache=/app/output/.npm-cache e2e npx -y tsx@4.23.15 .claude/skills/verify-tumbleworks/scripts/tw.ts
```

## Baseline preconditions

- Use one unique run ID for launch, doctor, journey `--run` and cleanup. Coordinate shared browser time and keep runtime, styles, configuration and skill scripts stable during each drive.
- Each journey opens a fresh English browser at 375×690 CSS px with touch. Earlier campaign rounds and Workshop milestones may be seeded in that disposable context. Read `fixture.json` to see which IDs were seeded.
- Open campaign levels through an enabled village stop and its three-row menu. Numeric arguments to `tw` are 1-based campaign positions. Stable IDs select through [`CAMPAIGN`](../../../../src/campaign.ts) or go through the development-only `/?try=<id>` route for bank boards.
- Use `tw workshop <id>` for the chooser, or `--workshop` with a supported gameplay journey for the project source. For milestone and reward proof use the focused spec in [World progression](world-progression.md).

## Driving conventions

- Board pieces use projected touch targets. `supply<n>` names Funnel Sort crates by column or crate ID on fork boards. `lane<n>` names Loop Sort lorries and `tube<n>` names Tube Sort tubes. Target numbers start at zero.
- Look up HUD buttons by accessible name. Use `#levels-toggle` for the level menu and `#world-workshop` for the Workshop footer.
- The driver makes real inputs and advances time through the game’s tick path.

## Proof and skip reporting

- Each journey writes numbered screenshots, `steps.jsonl` with game state and fingerprint, `result.json`, and `source.json` under `output/current/verify/<run>/`.
- A win check follows the destination UI and stored completion after reload. Check the completed menu row for campaign or trials and the chooser badge for Workshop.
- If a stored witness is missing, record the unverified journey and the reason. `tw render` reports a settled scene census. Record device feel, audio mix and frame rate separately on a real phone.

## Feature entry contract

Each feature file starts with an H1 title and a paragraph describing the player-visible behavior. Then use exactly four H2 sections in order. Use `Sub-features`, `How to get to it (user POV)`, `Driving it with tw`, and `Gotchas`.

## Features

- [Funnel Sort](funnel-sort.md) covers crate pours, boxes and jams.
- [Loop Sort](loop-sort.md) covers truck pours, queue cards and jams.
- [Tube Sort](tube-sort.md) covers transferring groups by taps or drags.
- [Controls](controls.md) covers Undo, Restart, Hint, held fast forward and Sound.
- [Level menu and progress](level-picker.md) covers level selection, Settings and help, and persisted wins.
- [World progression](world-progression.md) covers village stops, map inspection, films and Workshop. See [World and Workshop checks](../integration.md) for source references and earlier snapshots.
