# Checks and tools

Run from the repository root with pinned dependencies and Docker Compose. One
heavy check/browser/performance job at a time. Read each result before the next.
Check active owners; dated freeze notes do not establish current ownership.

## Reusable runner

```sh
python3 .agents/skills/tumbleworks-village-authoring/scripts/village_check.py status
python3 .agents/skills/tumbleworks-village-authoring/scripts/village_check.py status --chapter 1 --require-physical
python3 .agents/skills/tumbleworks-village-authoring/scripts/village_check.py test --suite physics --dry-run
python3 .agents/skills/tumbleworks-village-authoring/scripts/village_check.py test --suite contract
python3 .agents/skills/tumbleworks-village-authoring/scripts/village_check.py test --suite cinematic
python3 .agents/skills/tumbleworks-village-authoring/scripts/village_check.py test --file tests/world/village-terminal.test.ts --file tests/world/terminal-runout.test.ts
```

`status` reports registered cinematic plans, duration, contacts and transfers.
`--require-physical` explicitly selects offline mechanical research and makes
physical authoring fail. That research result does not gate shipping films. Unknown chapters
fail. This is compilation only, never final acceptance.

`test` runs exactly listed existing specs, one worker, without config merging.
Suites: cinematic, contract, physics, geometry, camera. They cover the chapters in those
specs, not the chapter from a previous status call. Some integration gates fail
on unfinished existing villages; use `--dry-run` to inspect selection first.

The runner never starts a server, edits product files, seeds saves or launches
the whole project suite. Unique source/harness hashes, raw logs, reports and exits
go below `output/current/village-authoring/`. Failed/aborted is not passed. After
interrupting a job, check its exact owned process stopped before handing off CPU;
do not kill the server or other owners' jobs.

## Acceptance order

| Stage | Tools / evidence | Scope |
| --- | --- | --- |
| Structure/originality | village-program, village-identity, village-authoring specs | Ports/frames, explicit registry, distinct composition |
| Cinematic compile | Status; cinematic timeline specs | Complete authored playback, continuous joins and shared carrier frames |
| Optional physical research | Status `--require-physical`; physics suite | Separate mechanical model; no cinematic readiness authority |
| Cheap geometry | villageWorld, surfaceTriangles, trackCrossings, exposedOverlaps, groundFoundations, budget spec | Real Scene/rest geometry, full feet, early cost failures |
| Whole motion | Actual Scene/runtime; village-geometry, triangle-clearance, surface-overlap helpers | Sphere/track width, altered hardware, terrain/scenery/rewards |
| Camera/map | village-camera, village-camera-comfort, village-film-shots specs | Actual-duration framing, zooms, cuts, projected targets |
| Running game | Project launch/doctor/driver, natural films and native input | Real entry, playback, taps and save consequences |
| Final gates | Type/lint, full unit suite, build, hygiene, gameplay/World performance | Only what ran on that final combined source |

Audit coverage: some old tests sample 25 seconds or legacy machinery. Whole-motion
proof covers `route.duration` at nominal 120 Hz plus exact contacts/transfers,
extrema and relevant intermediate poses, both modes. Test altered assemblies
against ALL other solids, not just track. Include all movers, rigid matrices,
cached bounds and earned additions. Pose-controlled fixtures cannot manufacture
missing physical playback states.

Keep old failures as regressions/mutants. Check probe caches/transforms against
raw triangles before repairing product geometry. Static factoring needs exact
matrix/geometry/visibility invariance and raw controls. Preserve raw, intended and
foreign visibility separately. For cinematic visibility, sample the actual visible marble disc (centre and two radial bands), with no floor or sleeve name exemptions. Keep catches, loaded rides and releases readable; short partial strut crossings are diagnostics. See `output/current/village-cinematic/VISIBILITY-NOTES.md` for the agreed weighted-disc and temporal gates. Intended contact needs
identity, actual phase and finite extent; never silently enrol another mechanism
or loosen a visibility threshold to pass.

## Phone, camera and input

Normal travel uses a stable follow distance, soft entry/exit and at most two
zoom-in excursions. No per-contact zoom or target-depth pulses. Keep marble and
active linkage readable. Reduced mode has at most seven still shots, each at
least two seconds, with cuts outside complete active transfers. Check compiled
times, exact rest endpoints, seeks and replay.

Map checks cover 375×690, existing desktop and ±15° yaw: 44 px targets, 48 px
between stops and the current stronger Workshop/stem guards in actual specs.
Inspect stems, disc/scenery association and grayscale. Use native touches/timed
real drags; no fake activation or rule state.

Use existing [verify-tumbleworks](../../../../.claude/skills/verify-tumbleworks/SKILL.md)
launch, doctor, journeys and cleanup. Campaign-complete seeds are presentation
fixtures, not unlock or Workshop-win proof. Freeze source/driver/config during
journeys; close only owned contexts/previews/leases.

Record whole natural normal/reduced phone films and existing desktop playback,
including handoff/return UI. Deterministic stills can use one
`App.advance(target-current)` seek: hundreds of drawn intermediate advances queue
GPU work and can stall screenshots. These stills do not prove natural speed.
Retain raw recordings and source hashes.

## Costs and final commands

Read limits in village-budget.test.ts and scripts/check-bundle-budget.mjs. At
skill creation: map/film 36,160/37,224 triangles, 29/30 meshes; first download
2,125,000 bytes; fixed art 120,000 compressed bytes; previews 100,000 bytes;
audio 45,000 bytes. Do not raise them to pass a change.

```sh
docker compose exec -T dev npm run typecheck
docker compose exec -T dev npm run lint
docker compose exec -T dev npm test
docker compose exec -T dev npm run build
docker compose --profile e2e run --rm e2e npx playwright test tests/e2e/render-hygiene.spec.ts
docker compose --profile e2e run --rm e2e npx playwright test tests/e2e/world-rube.spec.ts
docker compose --profile e2e run --rm e2e npx playwright test tests/e2e/world-performance.spec.ts --no-deps
docker compose --profile e2e run --rm e2e npx playwright test tests/e2e/performance.spec.ts --no-deps
```

Profile frame/tick changes against a recorded baseline, with performance alone.
Keep workload/quality and gameplay guards. Constructor timing, deterministic
captures and SwiftShader intervals are not phone performance or comfort proof.
