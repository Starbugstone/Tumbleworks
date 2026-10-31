# Cleanup proposal — phase 1

Surveyed on 31 October 2026 against HEAD `60eb9461a652e588528acdaf9d629b31acd6c751`. This is a proposal, not authorization to remove anything. Only this file was created; no existing file, process, build or historical artifact was changed. No capture, build or test command was run because those commands can overwrite evidence or compete with the ongoing rework.

The supplied rework plan is the validation baseline: nine-marble supply trays, three docks, cargo segments and preload; rewritten Funnel Sort simulation, machine and scene; another gameplay runtime; instanced marbles; collision-group changes; campaign and HUD changes. The reworking agent has **not** reviewed these recommendations. Every delete row remains conditional on that review and a fresh reference search after the rework lands.

`backup/funnel-sort-v1` exists. Its tag object is `eaf67f86033a35e7d42e1190e230a40cd6f80f55`, resolving to the surveyed HEAD. Tracked obsolete material does not need a second backup. Ignored `output/` artifacts have no Git history in any local ref and are not preserved by that tag.

## Evidence and measurement

For every candidate, searched its full relative path and basename with `rg -n -F` in `src/`, `tests/`, `scripts/`, `docs/`, `package.json`, `compose.yaml`, `playwright.config.ts`, `Dockerfile` and `README.md`. Also checked useful filename stems, exported symbol names and relative module imports. Separately checked `AGENTS.md`, `index.html`, `tsconfig.json`, `vite.config.ts`, `.gitignore`, `.dockerignore` and text artifacts inside ignored `output/`.

“No filename references” below means no matches outside the candidate itself in the required search scope, excluding this proposal. It is not a claim that a document lacks historical value. Directory-wide references, configuration globs, generated paths and command-line entrypoints count as dependencies too. No whole source module outside the protected paths was found unused.

Reproduce a candidate check, substituting both its full path and basename:

```sh
cd /home/stone/dev/Tumbleworks
rg -n --hidden -g '!cleanup-proposal.md' -F \
  -e 'docs/research/conveyor_board_check.py' -e 'conveyor_board_check.py' \
  src tests scripts docs package.json compose.yaml playwright.config.ts Dockerfile README.md
git log -1 --format='%h %ad %s' --date=short -- docs/research/conveyor_board_check.py
```

Sizes are logical file bytes, recursively summed for directories, unless explicitly described as allocated disk space. `output/` contains **253,981,738 B (242.216 MiB)**; allocated space is **259,325,952 B (247.3125 MiB)**, explaining the rounded `du -h` figure of 248M. `dist/` contains **5,134,769 B (4.897 MiB)**, allocated **5,165,056 B**. Directory rows do not overlap unless stated otherwise. Sizes and line numbers are observations, not promises about the concurrent agent's final files.

Commit abbreviations used in the tables:

- `60eb946` — 2026-10-31, “Add four named game modes and responsive marble interactions”.
- `11467ae` — 2026-10-31, “Add nine-level campaign with shared gameplay services”.
- `529936a` — 2026-10-30, “Replace the 2D POC with real 3D physics”.
- `f1ced9a` — 2026-10-30, “Scaffold Tumbleworks with a Docker dev server”.
- “None” means untracked/ignored and no commit found, not an unknown timestamp.

## Earlier research

These five files total **100,255 B**. None has an individual filename reference in the required scope. However, `AGENTS.md:7` explicitly says that `docs/research/` preserves earlier exploration. Consequently, do not describe this directory as wholly unreferenced: the owner must settle that statement before accepting these deletions. The proposal is to retire the obsolete exploration from the working tree, using the existing tag for tracked history.

| path | size | last git commit touching it | who references it (grep evidence) | proposal | risk note |
| --- | ---: | --- | --- | --- | --- |
| `docs/research/conveyor_board_check.py` | 2,282 B | `f1ced9a` | No filename references; folder reference in `AGENTS.md:7`. Its own `BOX=3`, six-marble packets and capacity checks are self-contained. | delete | Earlier settled color-count model; requires a whole packet to fit before releasing. It does not model the new rules or real timing. Keep the rewritten TypeScript rule tests and new board-authoring tool instead; agent must confirm they cover the useful analysis. |
| `docs/research/marble-sort-research.html` | 69,158 B | `f1ced9a` | No filename references; folder reference in `AGENTS.md:7`. Contains embedded data/scripts and external citations, rather than loading the sibling JSON files. | delete | Historical three-mode/30-level proposal, optional 60-level Funnel Sort bank and old save/physics assumptions. Agent/owner should first identify any design rationale or citations still needed in maintained docs. |
| `docs/research/mixed-campaign-plan.json` | 6,137 B | `f1ced9a` | No filename references, including from the two research HTML files; folder reference in `AGENTS.md:7`. | delete | Thirty-level three-mode exploration, not the registered campaign. The visual HTML embeds its own level data. Do not derive the replacement campaign from this file. |
| `docs/research/mixed-campaign-visual.html` | 15,634 B | `f1ced9a` | No filename references; folder reference in `AGENTS.md:7`; its `mixedLevels` array is inline at line 15. | delete | Historical visualization uses earlier names and progression. No runtime or maintained-document link was found. |
| `docs/research/sources.json` | 7,044 B | `f1ced9a` | No filename references or JSON loads; folder reference in `AGENTS.md:7`. Research HTML includes an inline source register. | delete | Source provenance is useful only if the owner still wants a maintained research bibliography. Retain needed citations in current docs before removal; do not discard on the assumption that the URLs were revalidated here. |

## Maintained documentation

| path | size | last git commit touching it | who references it (grep evidence) | proposal | risk note |
| --- | ---: | --- | --- | --- | --- |
| `docs/poc-plan.md` | 5,236 B | `60eb946` | `README.md:30` links it. | rewrite later | Preserve the maintained scope/witness document. Replace six-marble supplies, three-board counts, single active-box descriptions, old release sequences and tree totals only after the new boards and actual winning/losing witnesses settle. Preserve unchanged puzzle-mode rules and accessibility requirements. |
| `docs/campaign-architecture.md` | 2,825 B | `60eb946` | `README.md:28`; `docs/poc-plan.md:21` links `campaign-architecture.md`. | rewrite later | Retain registration, `GameRuntime`, shared services, input ownership and undo contracts. Recheck twelve-button/four-mode wording, runtime ownership, new instancing and collision groups. Do not remove the shared engine because Funnel Sort's implementation changes. |
| `docs/verification.md` | 4,310 B | `60eb946` | No individual filename reference found. Its lines 15–21 name live browser tests; lines 41–45 name capture scripts and evidence. | rewrite later | This is an evidence record, not dead code. The 140 tests/16 files, nine journeys, capacity 12, gravity details and soak/tree totals describe the previous implementation. Label that scope or replace claims with fresh dated results after the rework. Preserve historical evidence until references are migrated. |

## Scripts and campaign assumptions

| path | size | last git commit touching it | who references it (grep evidence) | proposal | risk note |
| --- | ---: | --- | --- | --- | --- |
| `scripts/inspect-poc.mjs` | 2,014 B | `11467ae` | No filename references outside itself. Lines 3 and 19 write `output/poc9` and inspect indices 0–8; desktop only 0–2. | delete | Explicitly a nine-level tool. Today it would silently inspect only a subset of a larger campaign. The maintained feedback inspector covers its purpose; agent must confirm its replacement before removal. Preserve existing `output/poc9` evidence separately. |
| `scripts/capture-video.mjs` | 3,062 B | `11467ae` | No filename references outside its own run comment. Lines 3, 8 and 60 name `output/poc9`; lines 45 and 54 hardcode old Funnel Sort pours and indices 3–8. | delete | Nine-level/four-mode-incomplete recording path. Its Tube Sort and Tray Match solutions still have legitimate source consumers; do not delete those boards or solution witnesses with the script. Preserve already encoded clips and raw frames. |
| `scripts/inspect-feedback.mjs` | 2,214 B | `60eb946` | `README.md:46`; `docs/verification.md:41`. Lines 3 and 21–28 use `output/poc12`, twelve indices, first four modes and `stage.marbles.useSolidGlass()`. | rewrite later | Twelve-level tool, not obsolete merely because its counts will change. Discover registered levels and representative modes after campaign changes; preserve grayscale and lower-quality pattern checks. Validate the solid-material API against the instanced renderer and selectors against HUD trims. |
| `scripts/capture-feedback.mjs` | 3,046 B | `60eb946` | `README.md:49`; `docs/verification.md:42`. Line 6 writes `output/poc12/video-frames`; lines 35–46 select indices 1–4 and fixed piece/supply actions. | rewrite later | Twelve-level/four-mode representative clip, not an all-level replay. Keep real touch dragging and overlap evidence; replace numeric campaign positions, old Funnel Sort sequence and output naming after the new campaign is agreed. Protect old evidence from overwrites. |
| `scripts/snapshot.sh` | 457 B | `529936a` | No filename reference outside its own run comment. Lines 5 and 7 produce/serve `output/snapshot`; no nine- or twelve-level count. | rewrite later | Count-independent frozen-build helper remains useful. Line 6 runs broad `pkill -f 'vite preview'`, conflicting with preservation of existing processes. Replace process handling with ownership of this helper's own process, and choose an unused port without terminating unrelated previews. Do not run it during this audit. |
| `scripts/board-tree.ts` | 1,398 B at survey | None — newly untracked | No filename reference; imports `BOARDS`, `LOOP_BOARDS`, `MachineRules`, `releaseTree` and includes `board.preload` in totals. `tsconfig.json` includes `scripts`. | keep | Concurrent agent's new board-analysis tool. Its lack of a caller is normal for a CLI entrypoint. Treat it as in flux even though it is outside the originally listed paths; do not retire new authoring/verification work. |

No script is currently wired into a package.json capture command. That does not make the README-invoked scripts unused. The new campaign length is not yet settled: the live in-flux board banks currently expose five Funnel Sort boards and five boards for the additional mode, while `AGENTS.md` and README describe twelve total levels. These observations require an owner/agent decision, not automatic deletion of old tests or IDs.

## Ignored output: retain evidence, consolidate deliberately

`AGENTS.md` requires preservation of historical output artifacts and pre-existing user processes. **No existing `output/` row is proposed for deletion.** Moving evidence into one archive is a later organizational action, conditional on the owner's destination choice and repair of affected references. It saves no disk space by itself.

Proposed single archive root: `output/archive/funnel-sort-v1/`, retaining each original relative subtree. Record original path, original HEAD, date and checksums in an archive manifest during phase 2. Do not move a directory while a capture, test or preview is using it. `docker compose ps` showed the existing development service running on port 5180; it was left running. This does not establish that port 5181 or `dist/` has no other consumers.

| path | size | last git commit touching it | who references it (grep evidence) | proposal | risk note |
| --- | ---: | --- | --- | --- | --- |
| `output/capture/` | 42,129,269 B; 40.178 MiB; 25 files | None — ignored | No full directory reference in required scope; filenames checked too. Contains earlier MP4/WebM playthroughs, PNGs and a contact sheet. | archive | Historical captures, not disposable build cache. Move as a unit under the single archive root after owner confirmation. The tag cannot recover them. |
| `output/debug/` | 4,036,893 B; 3.850 MiB; 8 files | None — ignored | No full directory reference in required scope. Extra ignored-script references: `output/debug/look.mjs:12–16` writes four PNGs here; `output/debug/jam.mjs:17` writes `jam.png`. | archive | Six images plus two diagnostic scripts. `jam.mjs` uses old `window.tumbleworks.scene()` and `look.mjs` targets port 5181. Preserve scripts with evidence, marking them historical rather than runnable regression checks. |
| `output/frames/` | 81,390,512 B; 77.620 MiB; 1,331 files | None — ignored | No full directory reference in required scope. Filename/basename matches were checked; generic “frames” variable names are not path references. | archive | Raw historical frames; all 1,331 have distinct SHA-256 content hashes. No producer or guaranteed reconstruction recipe found in maintained scripts. Do not delete because an encoded clip also exists. |
| `output/poc9/` | 75,976,728 B; 72.457 MiB; 1,015 files | None — ignored | `scripts/inspect-poc.mjs:3`; `scripts/capture-video.mjs:3,8,60`; `docs/verification.md:45`. Local `gallery.html` uses absolute `/home/stone/dev/Tumbleworks/output/poc9/...` image paths. | archive | **Referenced by scripts/docs.** First retire the two delete-candidate scripts and revise the historical evidence link. Moving alone breaks gallery paths; relocate/fix links with the archive manifest. Preserve images, diagnostics, clip and frames together. |
| `output/review/` | 326,129 B; 0.311 MiB; 5 files | None — ignored | No full directory reference in required scope. Four selected JPEG frames and `strip.jpg`. | archive | Historical comparison evidence. No maintained recipe found for these particular selections. Keep with capture history. |
| `output/debug-funnel.mjs` | 1,298 B | None — ignored | No path/basename reference in required scope. Its own line 9 writes `output/poc12/debug-before.png`; uses fixed old `[0,0,1]` pours and App diagnostics. | archive | Hand-run diagnostic entrypoint, not a build artifact. Agent must decide whether its useful reproduction belongs in a rewritten test. Archive with original path metadata; do not run it against changing rules or overwrite the referenced PNG. |
| `output/bench/` | 1,930 B; one `rapier-crowd.mjs` | None — ignored | No directory or script-basename reference in required scope; script imports Rapier directly. | archive | Standalone unseeded random-body experiment (100/200/400 bodies, 600 steps); it does not exercise the actual game pipeline. Preserve the experiment, but do not cite it as phone performance evidence or discard it just because it has no importer. |
| `output/poc12/` | 45,035,082 B; 42.949 MiB; 309 files | None — ignored | `README.md:49`; `docs/verification.md:41,43`; `scripts/inspect-feedback.mjs:3`; `scripts/capture-feedback.mjs:6,49`; **`tests/e2e/journey.spec.ts:75,162` writes screenshots here**. Ignored `output/debug-funnel.mjs:9` writes `debug-before.png`; gallery uses absolute image paths. | keep | Active documentation/test output contract and historical evidence coexist here. Keep in place until reworked producers write to a distinct run folder; then evaluate archiving the previous run with updated links. Do not label the current screenshots as evidence for the new rules. |
| `output/snapshot/` | 5,083,852 B; 4.848 MiB; 11 files | None — ignored | `scripts/snapshot.sh:5,7` builds and serves it on 5181; ignored `output/debug/look.mjs:7` targets that port. | keep | Generated, but deliberately a frozen historical game and possibly served by an existing preview. Do not delete or rebuild it as cache. Ask whether to archive it after consumers finish; do not kill a process to free the path/port. |
| `output/playwright/` | 45 B file payload; one `.last-run.json` (8 KiB directory allocation) | None — ignored | **`playwright.config.ts:8`: `outputDir: 'output/playwright'`**; runner writes this directory. | keep | Current runner output. Only the successful last-run marker exists at survey time, with no failure traces to triage. Negligible saving and potential concurrent runner use; do not clean it during the rework. |

The archive rows total **203,862,759 B (194.419 MiB)**; keep rows total **50,118,979 B (47.797 MiB)**. These sum to the measured output file payload. Nested detail, **already included** in the parent rows: `output/poc9/video-frames/` is **57,417,669 B** / 968 frames, and `output/poc12/video-frames/` is **15,953,016 B** / 252 frames. The former is named in the old script's ffmpeg command; the latter is produced by the maintained feedback recorder. Both frame sets belong with their clips/metadata. Identical frames can encode intentional holds; content duplication alone is not a deletion criterion.

## Ignored production build

| path | size | last git commit touching it | who references it (grep evidence) | proposal | risk note |
| --- | ---: | --- | --- | --- | --- |
| `dist/` | 5,134,769 B; 4.897 MiB; 11 files | None — ignored | No literal whole-word `dist` reference in required scope. `package.json:8` runs `vite build`, whose default build output is this directory; no `build.outDir` override in `vite.config.ts`. `.gitignore:2` and `.dockerignore:2` name it. Snapshot helper explicitly uses a different output directory. | delete | Rebuildable production output, not “unused source”. Conditional on confirmation that no preview/deployment/process currently serves it and that no capture provenance depends on this particular build. Do not confuse it with `output/snapshot/`. Leave it alone until the reworking agent finishes any build using it. |

## README sections affected by the rework

Each size below is the same complete file size, **not additive**. The run/check commands, LAN access, puzzle-mode descriptions, local progress and accessibility requirements remain useful.

| path | size | last git commit touching it | who references it (grep evidence) | proposal | risk note |
| --- | ---: | --- | --- | --- | --- |
| `README.md:3,5` — campaign and shared workshop introduction | 3,343 B whole file | `60eb946` | Root entry document; says twelve levels/four modes and describes current scripted/physical transport split. | rewrite later | Confirm final registered packs, level count and transport behavior. Do not infer the final additional mode's public name or overwrite the four permanent names. |
| `README.md:17` — Funnel Sort play rule | 3,343 B whole file | `60eb946` | Describes ordered receiving boxes, overflow and dead ends. | rewrite later | Explain nine-marble trays, three docks and preload from accepted final rules; clarify cargo segments for the additional mode. Retain sound current rules rather than replacing the whole Play section. |
| `README.md:22` — shared controls and patterns | 3,343 B whole file | `60eb946` | Explicit four-mode count, input keys, undo/hints and patterned marbles; actual behavior supplied by runtime/HUD. | rewrite later | Check which HUD actions and keyboard paths remain after trims. Preserve the surface ring/diamond/triangle/star requirement for instanced and low-quality actors. Keep local-storage claims tied to actual behavior. |
| `README.md:28,30` — architecture and POC links | 3,343 B whole file | `60eb946` | Links the two maintained docs; registration path is in flux. | rewrite later | Update descriptions with those docs; preserve working links and shared service ownership. Replacing rules does not justify deleting the architecture documentation. |
| `README.md:41,46,49` — checks and visual evidence | 3,343 B whole file | `60eb946` | Names headless physics tests, feedback inspector/recorder and `output/poc12`. | rewrite later | Publish new counts/output paths only after actual checks. Keep distinction between deterministic functional tests and physical-phone performance. Coordinate reference updates before any evidence archive. |

## Source exports outside the protected paths

Searched every named top-level export in the unprotected TypeScript files across the required scope, including uses within its defining file. Relative import resolution found consumers for every unprotected source module; `src/main.ts` is the HTML entrypoint (`index.html:145` at survey), not an orphan. No entire source file is a delete candidate.

| path | size | last git commit touching it | who references it (grep evidence) | proposal | risk note |
| --- | ---: | --- | --- | --- | --- |
| `src/view/art.ts:236` — `symbolTexture` | 223 B function block including trailing whitespace; 9,161 B file | `60eb946` | Whole-word `rg` finds **only its declaration**; no local, src, test, script or doc caller. Neighbor `containerSymbolTexture` is consumed by `src/view/scene.ts:22,398,425,430`. | rewrite later | Confirmed unused function in surveyed tree. After renderer/scene rework settles, remove only this helper if still unreferenced. Do not delete `art.ts`, shared symbol drawing, surface patterns or container marks. Source surgery is deferred, so it is not included among whole-path delete commands. |
| `src/view/art.ts:4,17,18` — `Palette`, `COLOR_NAMES`, `PATTERN_NAMES` exports | 9,161 B whole file, same file as above | `60eb946` | No external symbol references; `Palette` types `COLORS` at line 11; names are read by `marbleName` at line 19. `marbleName` is imported by all four current gameplay adapters. | keep | Unused exports are not unused implementations. Optionally make these declarations local in a later API tidy-up after checking new consumers, but preserve their values/type behavior and accessible hint names. |
| `src/engine/contracts.ts:5` — `GameStatus` export | 2,971 B whole file | `60eb946` | No direct external symbol reference; used by `GameRuntime.status` at line 34. The contract module is imported throughout adapters/views and `tests/engine/registry.test.ts`. | keep | Live shared contract. A locally referenced type is not dead because consumers use it indirectly through an exported interface. |
| `src/puzzles/types.ts:38` — `PuzzleDef` | 42 B declaration; 1,817 B file | `60eb946` | Whole-word search finds only the union declaration. Module itself is imported by puzzle rules, levels, views, adapters and tests. | keep | Unused type, but `src/puzzles/*` explicitly stays as it is. No source cleanup in this protected puzzle bank; reconsider only under a separately authorized change. |
| `src/puzzles/connect.ts:13` — `ConnectPiece` export | 5,961 B whole file | `60eb946` | No external symbol reference; used by `connectPieces` return type (line 14) and `ConnectRules.pieces` (line 24). | keep | Live local type in an unchanged mode. Never remove its implementation or the Connected Match pack. |
| `src/puzzles/rules.ts:50` — `availableTubeMoves` export | 15,781 B whole file | `60eb946` | No external symbol reference; called internally at lines 66 and 120 for status and solving. | keep | Live Tube Sort logic and unchanged path. Removing it would break rules/solver behavior. |
| Other shared source exports, including `frameBoard`, `boxCorners`, `BoardView`, `BoardPointer`, `Stage`, `toyBox`, `label`, `GAME_NAMES`, audio/progress and active art helpers | No deletion unit | `60eb946` for surveyed unprotected modules | Examples: `boxCorners` imported/called in `src/engine/board-view.ts:6,172`; toy helpers imported by `src/view/tubes.ts`, `tray.ts`, `connect.ts`; `woodTexture` imported/called in `src/engine/stage.ts:3,25`; art material/pattern helpers imported by in-flux `src/engine/marbles.ts`. | keep | Existing consumers include in-flux paths, which still count. Re-run after rework; do not predict that an old marble helper becomes unused merely because an instanced path is being added. |

## Protected rework and unchanged modes

Do not clean up `src/sim/*`, `src/machine/*`, `src/view/scene.ts`, `src/gameplays/conveyor.ts`, the new `src/gameplays/loop.ts` and `src/view/loop*.ts`, `src/campaign.ts`, `src/engine/physics.ts`, `src/engine/marbles.ts`, `index.html` or `src/view/App.ts`. Stale imports/type errors during the rewrite are not deletion evidence. The new `scripts/board-tree.ts` is also assigned to the reworking agent by observation of its imports and untracked status.

| path | size | last git commit touching it | who references it (grep evidence) | proposal | risk note |
| --- | ---: | --- | --- | --- | --- |
| `tests/rules/*` | 40,950 B; 7 surveyed files | `60eb946` latest across group | `vite.config.ts` includes `tests/rules/**/*.test.ts`; rule tests import shared `./drive` and `./helpers`. | rewrite later | **Replacement tests are already assigned to the reworking agent. No file here is proposed for deletion.** Preserve new winning witnesses, losing choices, conservation and undo coverage. |
| `tests/machine/*` | 19,162 B; 4 files | `60eb946` latest across group | `vite.config.ts` includes `tests/machine/**/*.test.ts`; current tests import machine/layout/simulation modules. | rewrite later | **Replace for new physical rules; do not delete.** Old capacities and schedules do not make the test responsibility obsolete. |
| `tests/e2e/reservoir.spec.ts` | 2,656 B | `60eb946` | `playwright.config.ts:4` discovers `tests/e2e`; `docs/verification.md:21` cites the scenario. | rewrite later | **Agent-owned replacement, not deletion.** Preserve real browser burst/capacity/undo coverage with the final rules. |
| `tests/e2e/journey.spec.ts` | 8,892 B whole file | `60eb946` | Playwright test directory; `docs/verification.md:15–18`; lines 75/162 produce `output/poc12` images. | rewrite later | Only Funnel Sort portions and necessary campaign expectations are assigned for rework. **No deletion of the file or unchanged puzzle journeys.** Counts/indices/output paths need coordination. |
| `src/puzzles/*`; `src/view/{tubes,tray,connect}.ts`; `src/gameplays/{tube,tray,connect}.ts`; `tests/puzzles/*` | 73,729 B; 14 surveyed files | `60eb946` latest across group | Campaign imports all three runtime/board banks; views/adapters import puzzle rules; browser tests and capture scripts consume authored solutions; `vite.config.ts` includes puzzle tests. | keep | Explicitly unchanged. Tray Match and Connected Match remain distinct. Preserve IDs/progress, touch and keyboard behavior, rapid actions, canceled/invalid drags and atomic undo. |

Compatibility review before phase 2 must confirm that retained code and replacement tests cover nine-marble trays, three docks, segments/preload, falling bodies, undo and current-state hints; that shared contracts/resources still serve the unchanged modes; and that removed script purposes have maintained replacements. This is a comparison against the supplied plan, not a claim to have verified the unfinished implementation. After agreement, repeat reference searches on the resulting tree and run the repository's normal checks for actual source/script/doc changes, writing fresh evidence to a distinct destination. Do not run snapshot.sh unchanged.

## 1. Exact phase 2 commands for delete rows only

**Not run.** These commands are conditional on the owner/reworking agent resolving the questions below, migrating needed research citations, settling `AGENTS.md:7`, confirming replacement capture tools, rechecking references, and establishing that `dist/` is not being served or written. They remove only the seven tracked delete candidates and the rebuildable production directory. The tracked files total **105,331 B**; including `dist/`, the candidate file payload is **5,240,100 B (4.997 MiB)**. Archiving output is intentionally absent from these deletion commands.

```sh
cd /home/stone/dev/Tumbleworks
rm -- \
  docs/research/conveyor_board_check.py \
  docs/research/marble-sort-research.html \
  docs/research/mixed-campaign-plan.json \
  docs/research/mixed-campaign-visual.html \
  docs/research/sources.json \
  scripts/inspect-poc.mjs \
  scripts/capture-video.mjs
rm -rf -- dist
```

## 2. Questions requiring the owner or reworking agent

1. **Reworking agent:** Do you confirm that none of the seven tracked delete candidates is needed by the new rules, authoring work or capture workflow? Is `scripts/board-tree.ts` the maintained replacement for the old Python exploration, and are the feedback scripts the maintained capture entrypoints?
2. **Owner:** May the earlier research be removed from the working tree, with `AGENTS.md:7` revised accordingly? Which design decisions or source citations, if any, should be retained in maintained docs for their continuing value?
3. **Owner and reworking agent:** What are the final campaign length, difficulty structure and public name for the additional mode? The supplied plan/new board banks and the current twelve-level/four-mode reference differ. Which changes to AGENTS, docs, numeric selectors and test expectations are intentional? Confirm stable existing kind/level IDs and saved-progress compatibility.
4. **Reworking agent:** What exact dock, preload, segment, belt-drain and hint semantics should replace the older Funnel Sort prose? Which HUD controls, keyboard actions, debug APIs and lower-quality renderer API remain supported?
5. **Owner:** Is `output/archive/funnel-sort-v1/` the desired single archive destination, or should the archive live outside `output/`? Confirm retention of raw frames, clips, diagnostics, debug scripts and the bench experiment. Can gallery links and historical documentation references be repaired together when evidence is moved?
6. **Owner/reworking agent:** Are any captures/tests currently writing `output/poc9`, `output/poc12` or other listed paths, and is any existing preview/deployment serving `dist/` or `output/snapshot/`? Which consumers must finish before deletion or archiving? The existing dev service and all other user processes must remain running.
7. **Reworking agent:** Will new captures use a distinct destination/run folder so current `output/poc12` evidence is preserved? Who will update README/verification references and repair absolute gallery links before archiving the old evidence?
8. **Reworking agent:** After the new scene/instanced renderer lands, is `src/view/art.ts::symbolTexture` still unused? Confirm before a later surgical removal, preserving all surface and container patterns. No source edit is included in this phase's delete commands.

## Phase 2 outcome (reworking agent, 31 October 2026)

Validated against the finished rework and applied:

- Removed the seven tracked candidates: the five `docs/research/` exploration files (the new reference research lives in `docs/research/loop-sort-marble-sort-mechanics.md`), `scripts/inspect-poc.mjs` and `scripts/capture-video.mjs`. Authoring moved to `scripts/board-tree.ts`, `scripts/loop-tree.ts`, `scripts/machine-soak.ts` and `scripts/loop-soak.ts`; quick captures to `scripts/peek.mjs`.
- Removed the unused `symbolTexture` export from `src/view/art.ts`; every surface and container pattern remains.
- Replaced, not deleted, the old Funnel Sort unit tests (`tests/rules`, `tests/machine`) and the browser specs for the new rules. Tube Sort, Tray Match and Connected Match are unchanged.
- Kept `dist/` (rebuilt by `npm run build`), `output/` in full (historical evidence, as AGENTS.md requires; archiving is the owner's call) and `scripts/inspect-feedback.mjs` / `scripts/capture-feedback.mjs`, which now discover levels from the campaign and write to `output/current`.
- Answers to the open questions: campaign is five Funnel Sort, five Loop Sort, three each of the other three, interleaved by round; kind and level IDs `conveyor/board-*`, `tube-*`, `tray-*`, `connect-*` are unchanged and `loop/loop-*` is new, so saved progress still loads; the HUD now keeps only the level pill, counter, sound and three icon buttons, with the picker, legend and help behind the pill.
