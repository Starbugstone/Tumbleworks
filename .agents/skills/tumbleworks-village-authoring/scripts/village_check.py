#!/usr/bin/env python3
"""Run an explicit village compilation report or exact focused specs in dev."""
import argparse
import hashlib
import json
import re
import shlex
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from secrets import token_hex

ROOT = Path(__file__).resolve().parents[4]
SKILL = Path(__file__).resolve().parents[1]
SUITES = {
    "cinematic": ["village-cinematic", "village-cinematic-scene", "village-cinematic-camera", "village-cinematic-hardware", "village-cinematic-visibility"],
    "contract": ["village-program", "village-authoring", "village-identity"],
    "physics": ["village-rolling", "village-all-span-support", "village-moving-contact",
                "village-gravity-independent", "village-capture", "village-carry-timing",
                "village-gate", "village-held", "village-spin", "village-terminal"],
    "geometry": ["village-clearance", "ground-foundations", "village-budget"],
    "camera": ["village-camera", "village-camera-comfort", "village-film-shots", "app-film-clock"],
}


def source_hashes():
    paths = [p for p in (ROOT / "src").rglob("*") if p.is_file()]
    paths += list((ROOT / "assets/world-3d").glob("*.json"))
    paths += [p for p in SKILL.rglob("*") if p.is_file() and "__pycache__" not in p.parts]
    paths += [ROOT / name for name in ("AGENTS.md", "package.json", "package-lock.json",
                                      "vite.config.ts", "tsconfig.json", "index.html")]
    return {p.relative_to(ROOT).as_posix(): hashlib.sha256(p.read_bytes()).hexdigest()
            for p in sorted(set(paths)) if p.is_file()}


def write_json(path, value):
    with path.open("x") as handle:
        json.dump(value, handle, indent=2)
        handle.write("\n")


def status_probe(chapter, require_physical):
    # The generated fixture lives four directories below the repository root.
    return """import {it,expect} from 'vitest';
import {writeFileSync} from 'node:fs';
import {VILLAGE_SCENE_PLANS} from '../../../../src/world/village-plans';
import {VillageProgram,validateVillagePlan} from '../../../../src/world/village-program';
import {VillageCinematic} from '../../../../src/world/village-cinematic';
it('reports the explicitly selected village motion model',()=>{
 const chapter=CHAPTER;
 const selected=VILLAGE_SCENE_PLANS.filter(s=>chapter===null||s.chapter===chapter);
 expect(selected.length,'Unknown/unregistered chapter; no fallback is permitted').toBeGreaterThan(0);
 const rows=selected.map(scene=>{
  validateVillagePlan(scene.plan);const physical=REQUIRE?new VillageProgram(scene.plan):undefined,route=physical??new VillageCinematic(scene.plan),ledger=physical?.physicalLedger??[];
  return {chapter:scene.chapter,profile:scene.plan.profile,mode:route.mode,status:physical?.motionStatus??route.playback,duration:route.duration,
   rejection:physical?.admissibility?{...physical.admissibility,message:physical.admissibility.message}:null,
   stationKinds:scene.plan.stations.map(s=>({stop:s.stop,kind:s.mechanism.kind})),
   ledgerStops:[...new Set(ledger.map(row=>row.stop))],
   contacts:route.contacts,transfers:route.transfers,physicalLedger:ledger};
 });
 writeFileSync(REPORT,JSON.stringify({scope:'Explicit cinematic playback or requested physical research compilation only. Not clearance, browser, comfort, performance or release acceptance.',rows},null,2),{flag:'wx'});
 for(const row of rows)console.log(JSON.stringify({chapter:row.chapter,status:row.status,duration:row.duration}));
 if(REQUIRE)expect(rows.filter(row=>row.status.state!=='ready').map(row=>({chapter:row.chapter,status:row.status,rejection:row.rejection})),
  'Physical compilation is incomplete').toEqual([]);
});
""".replace("CHAPTER", json.dumps(chapter)).replace("REQUIRE", json.dumps(require_physical))


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="action", required=True)
    status = sub.add_parser("status", help="Report cinematic playback, or explicit physical research")
    status.add_argument("--chapter", type=int)
    status.add_argument("--require-physical", action="store_true")
    tests = sub.add_parser("test", help="Run exactly the requested existing world specs")
    selection = tests.add_mutually_exclusive_group(required=True)
    selection.add_argument("--suite", choices=SUITES)
    selection.add_argument("--file", action="append")
    for command in (status, tests):
        command.add_argument("--run", help="Unique output directory name; refuses reuse")
        command.add_argument("--dry-run", action="store_true", help="Print selection without writing/running")
    args = parser.parse_args()
    if getattr(args, "chapter", None) is not None and args.chapter < 0:
        parser.error("--chapter must be nonnegative")
    run = args.run or datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ-") + token_hex(3)
    if not re.fullmatch(r"[a-zA-Z0-9_-]+", run):
        parser.error("--run uses letters, digits, underscores and hyphens only")
    directory = ROOT / "output/current/village-authoring" / run
    relative = directory.relative_to(ROOT).as_posix()
    if args.action == "status":
        files = [f"{relative}/status.test.ts"]
    else:
        requested = [f"tests/world/{name}.test.ts" for name in SUITES[args.suite]] if args.suite else args.file
        files = []
        for name in requested:
            path = (ROOT / name).resolve()
            try:
                path.relative_to(ROOT / "tests/world")
            except ValueError:
                parser.error("--file must be an existing tests/world spec")
            if not path.is_file() or not path.name.endswith(".test.ts"):
                parser.error(f"Not an existing world spec: {name}")
            item = path.relative_to(ROOT).as_posix()
            if item not in files:
                files.append(item)
    command = ["docker", "compose", "exec", "-T", "dev", "npx", "vitest", "run", "--config", f"{relative}/vitest.config.mjs"]
    if args.dry_run:
        print(json.dumps({"action": args.action, "files": files, "command": shlex.join(command),
                          "writes": False, "note": "Execution requires the existing dev container and an available CPU slot."}, indent=2))
        return 0
    try:
        directory.mkdir(parents=True, exist_ok=False)
    except FileExistsError:
        parser.error(f"Run exists; choose another --run: {directory}")
    if args.action == "status":
        code = status_probe(args.chapter, args.require_physical).replace("REPORT", json.dumps(f"{relative}/status.json"))
        (directory / "status.test.ts").write_text(code)
    config = {"test": {"include": files, "maxWorkers": 1, "fileParallelism": False,
                       "reporters": ["default", "json"], "outputFile": f"{relative}/vitest-result.json"}}
    (directory / "vitest.config.mjs").write_text("export default " + json.dumps(config, indent=2) + ";\n")
    before = source_hashes()
    harness = {p.name: hashlib.sha256(p.read_bytes()).hexdigest() for p in directory.iterdir() if p.is_file()}
    write_json(directory / "source-before.json", before)
    write_json(directory / "command.json", {"command": command, "files": files, "harness": harness,
              "hashScope": "src, runtime art JSON, package/config/policy and skill; not all network assets",
              "startedUtc": datetime.now(timezone.utc).isoformat()})
    print(shlex.join(command), flush=True)
    try:
        with (directory / "run.log").open("x") as log:
            result = subprocess.run(command, cwd=ROOT, stdout=log, stderr=subprocess.STDOUT, check=False)
        code = result.returncode
    except (OSError, KeyboardInterrupt) as error:
        write_json(directory / "aborted.json", {"error": str(error), "accepted": False,
                   "note": "Confirm the exact owned container job has stopped before CPU handoff."})
        print(f"NOT VERIFIED: {error}. Evidence: {directory}", file=sys.stderr)
        return 130 if isinstance(error, KeyboardInterrupt) else 127
    after = source_hashes()
    changed = sorted(k for k in before.keys() | after.keys() if before.get(k) != after.get(k))
    report_path = directory / "vitest-result.json"
    report = json.loads(report_path.read_text()) if report_path.exists() else {}
    executed = report.get("numPassedTests", 0) + report.get("numFailedTests", 0)
    accepted = code == 0 and executed > 0 and not changed
    write_json(directory / "source-after.json", after)
    write_json(directory / "result.json", {"processExit": code, "acceptedAssertions": accepted,
               "executed": executed, "passed": report.get("numPassedTests", 0),
               "failed": report.get("numFailedTests", 0), "sourceChanged": changed,
               "scope": "Only requested compilation/assertions; not complete village acceptance"})
    print((directory / "run.log").read_text())
    print(f"{'PASS requested assertions' if accepted else 'FAIL / NOT VERIFIED'}; evidence: {directory}")
    return 0 if accepted else code or 1


if __name__ == "__main__":
    sys.exit(main())
