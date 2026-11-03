import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PLAY_ORDER } from '../src/campaign';
import { BOARDS } from '../src/sim/boards';
import { LOOP_BOARDS } from '../src/loop/boards';
import { TUBE_BOARDS } from '../src/puzzles/levels';
import { hashBoard, type ScoreRow } from './level-curve';
import { SCORER_VERSION } from './level-policy';
import type { StrongMeasurement, StrongScore } from './level-strong';
import { H_ANCHORS } from './calibrate-h';

interface Calibration { id: string; hash: string; seconds: number; strong: StrongScore }
const ids = [...new Set([...Object.values(PLAY_ORDER).flat(), ...H_ANCHORS])];
const directory = 'output/current/levelling/expansion/h';
const rows: Calibration[] = ids.map((id) => JSON.parse(readFileSync(`${directory}/${id}.json`, 'utf8')));
const bank = new Map<string, object>([...BOARDS, ...LOOP_BOARDS, ...TUBE_BOARDS].map((board) => [board.id, board]));
for (const row of rows) if (row.hash !== hashBoard(bank.get(row.id)!)) throw new Error(`Stale calibration: ${row.id}`);
const scores = new Map((JSON.parse(readFileSync('tests/levelling/scores.json', 'utf8')) as ScoreRow[]).map((row) => [row.id, row]));
const f = (value: number | null | undefined): string => value == null ? '—' : value.toFixed(2);
const modes = (row: Calibration): [string, StrongMeasurement][] => [['settled', row.strong.settled], ...Object.entries(row.strong.machine ?? {})];
const primary = (row: Calibration) => row.strong.machine?.patient ?? row.strong.settled;
const mean = (numbers: number[]) => numbers.reduce((a, b) => a + b, 0) / numbers.length;
const where = (id: string): string => {
  for (const [game, list] of Object.entries(PLAY_ORDER)) {
    const at = (list as readonly string[]).indexOf(id);
    if (at !== -1) return `${game === 'conveyor' ? 'Funnel Sort' : game === 'loop' ? 'Loop Sort' : 'Tube Sort'} ${at + 1}${H_ANCHORS.includes(id) ? '; anchor' : ''}`;
  }
  return 'anchor';
};
const acceptedStats = Object.entries(PLAY_ORDER).map(([game, registered]) => {
  const accepted = rows.filter((row) => (registered as readonly string[]).includes(row.id));
  const values = accepted.flatMap((row) => row.strong.H === null ? [] : [row.strong.H]);
  return `${game === 'conveyor' ? 'Funnel Sort' : game === 'loop' ? 'Loop Sort' : 'Tube Sort'}: H ${f(Math.min(...values))}–${f(Math.max(...values))}, mean ${f(mean(values))}; zero-lapse mean ${f(mean(accepted.map((row) => primary(row).zeroLapse ?? NaN)))}`;
});
const totalExhausted = rows.reduce((n, row) => n + modes(row).reduce((m, [, mode]) => m + mode.parts.reduce((k, part) => k + part.exhausted, 0), 0), 0);
const totalOracleExhausted = rows.reduce((n, row) => n + modes(row).reduce((m, [, mode]) => m + mode.parts.reduce((k, part) => k + part.firstIrreversible.unknown, 0), 0), 0);
const totalRecoveries = rows.reduce((n, row) => n + modes(row).reduce((m, [, mode]) => m + mode.parts.reduce((k, part) => k + part.recoveries, 0), 0), 0);
const mismatches = rows.filter((row) => row.strong.machine && row.strong.H !== null && row.strong.settled.H !== null)
  .sort((a, b) => Math.abs(b.strong.H! - b.strong.settled.H!) - Math.abs(a.strong.H! - a.strong.settled.H!)).slice(0, 3);
const lines = [
  '# Strong reference H calibration', '',
  `Scorer **${SCORER_VERSION}**, parent 0cfe53d. ${rows.length} unique boards: all 36 registered levels plus 11 requested anchors, with tube-37 counted once.`, '',
  'H is the mean failure percentage of depth 4 and depth 6, each with 3% uniform legal-action lapses. Conveyor H uses the real machine patient timing; settled, burst2 and burst3 results stay separate. Each conveyor setting uses seeds 1–60 (120 trials across the two depths); Tube Sort uses 1–1000 (2,000 across depths). Every setting is repeated with zero lapses and the same seeds. This is a reference-policy measurement, not a human failure rate.', '',
  'The policy sees the existing observable heuristic, never the solvability oracle. Tube Sort uses exact rules modulo interchangeable tubes. Conveyor forecasting and irreversible-mistake diagnostics use settled rules, but outcomes come from physics Machine or scripted LoopMachine. Thus a conveyor first-mistake figure is a model proxy, not proof of physical irreversibility. The diagnostic includes any observed real wins after a proxy loss.', '',
  'Budget exits are censored as exhausted and never counted as failures. A measurement containing any such exit has H null (— below), with lower/upper bounds in its JSON. Logical node work is charged on cache hits too. Limits: 100,000 nodes per decision, 40,000 oracle states per query, 200,000 retained conveyor states / 40,000 tube states, 120 actions, 14,400 machine ticks. A silent loss is a proven non-winning position while its rules still say playing; a terminal jam is an explicit jam. A true machine standstill with no legal action, transfer, pending unit or possible delivery is also a silent loss.', '',
  '## Calibration table', '',
  'Failure figures are percentages. H0 is the matching patient/exact zero-lapse mean. S is the preserved historical score. Seconds include all settled/machine, both-depth and both-lapse runs for that board, with deterministic machine-trace reuse. Jobs shared the host with other work, and some completed measurements preceded the equivalent memory compaction: these are actual measurement costs, not a benchmark of the final build, phone timings or isolated CPU benchmarks.', '',
  '| Board | Placement | S | Settled H | Machine patient H | Burst2 H | Burst3 H | H0 | Seconds |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
];
for (const row of rows) lines.push(`| ${row.id} | ${where(row.id)} | ${f(scores.get(row.id)?.S)} | ${f(row.strong.settled.H)} | ${f(row.strong.machine?.patient.H)} | ${f(row.strong.machine?.burst2.H)} | ${f(row.strong.machine?.burst3.H)} | ${f(primary(row).zeroLapse)} | ${f(row.seconds)} |`);
lines.push('', 'An initial board-28 attempt exhausted Node’s default 2 GiB heap after about 14 minutes and produced no measurement. The scorer now discards expanded snapshots and keys Funnel Sort states without irrelevant finished-box assignments; the table uses the successful rerun. That aborted attempt and other interrupted/smoke runs are excluded from the successful-run cost total.', '', `Total measured board time: **${f(rows.reduce((n, row) => n + row.seconds, 0))} seconds**, excluding interrupted attempts. Mean ${f(mean(rows.map((row) => row.seconds)))} seconds/board; range ${f(Math.min(...rows.map((row) => row.seconds)))}–${f(Math.max(...rows.map((row) => row.seconds)))} seconds.`, '', '## Interpretation and proposed bands', '',
  ...acceptedStats.map((stat) => `- ${stat}.`), '',
  `Across all settings: ${totalExhausted} exhausted trials; ${totalOracleExhausted} trials with incomplete first-mistake diagnostics; ${totalRecoveries} machine recoveries.`, '',
  `Largest patient-versus-settled gaps: ${mismatches.map((row) => `${row.id} ${f(row.strong.H)} versus ${f(row.strong.settled.H)}`).join('; ')}. These differences are why real-machine H is retained.`, '',
  'These bands are provisional targets for the nine blind pairs, not new gates. The owner liked the current 36; the strong planner solves almost all accepted boards without lapses. That anchors the bridge near the bottom of H, and rules out treating H=0 as automatically trivial. Tube-37 was remotely challenging to the owner but has low H; the weak-player S and the strong-player H measure different things. Do not reinterpret H as the owner’s probability of failing.', '',
  'The old finales span widely different H values. Tube-21 and tube-28 separate depth-limited planning, while tube-29 and tube-30 are much easier for this policy. The old Loop Sort finales also show that burst failures can saturate while patient planning retains resolution. Retain the patient and burst columns independently; a single average over timings would conceal that distinction.', '',
  'A universal H floor would overshoot the accepted Funnel Sort anchors: real patient H is 22.50/23.33/7.50 there, compared with 55.83/94.17/55.00 for the old Loop Sort finales. I recommend game-specific provisional H targets, while preserving the shared S curve. This is calibration of three different reference models, not a ranking of the games’ human difficulty. Tube Sort’s useful challenge anchors are tube-21 (54.10) and tube-28 (76.70); tube-29/30 (1.80/5.75) warn against assigning challenge credit merely for an old finale ID or a long solution.', '',
  '| Game | Rounds | Ordinary H | Relief / lesson H | Peak H |',
  '| --- | --- | ---: | ---: | ---: |',
  '| Funnel Sort | 41–60 | 5–15 | 0–8 | 12–25 |',
  '| Funnel Sort | 61–80 | 8–22 | 3–12 | 20–35 |',
  '| Funnel Sort | 81–100 | 12–30 | 5–18 | 25–45 |',
  '| Funnel Sort | 101–120 | 18–40 | 8–25 | 35–55 |',
  '| Loop Sort | 41–60 | 5–25 | 0–15 | 20–40 |',
  '| Loop Sort | 61–80 | 15–40 | 5–25 | 35–60 |',
  '| Loop Sort | 81–100 | 30–55 | 10–35 | 50–75 |',
  '| Loop Sort | 101–120 | 45–70 | 20–45 | 65–95 |',
  '| Tube Sort | 41–60 | 5–20 | 0–12 | 15–35 |',
  '| Tube Sort | 61–80 | 12–35 | 5–20 | 30–55 |',
  '| Tube Sort | 81–100 | 25–50 | 10–30 | 45–70 |',
  '| Tube Sort | 101–120 | 40–65 | 15–40 | 60–85 |', '',
  'Use these as broad within-game authoring hypotheses. Do not reject an owner-approved anchor for falling outside them, and do not enforce them until short pilot boards and blind pairs support the ordering. Preserve a gentle 40→41 transition, including a low-H lesson for the first restriction. Prefer late ordinary boards with a visible zero-lapse failure component; increasing lapse accumulation or solution length alone earns no challenge credit. Reserve H 90–95 for occasional peaks comparable to loop-29, which the owner found acceptable; H above 90 should not become the default ending: saturation would recreate S’s loss of resolution. If blind pairs conflict with the proposed bands for a game, revise that game’s policy/targets and recalibrate rather than force a cross-game ranking. The first-rule lesson may be below the ordinary floor; a new mechanic does not itself earn H credit.', '',
  'The proxy disagreement is material, not just theoretical: loop-41 and loop-46 burst settings include real wins in every seed after the settled oracle declared the position lost. Never gate a conveyor on this proxy first-mistake statistic or read it as a verified physical point of no return.', '',
  'Use three blind pairs per game: accepted challenge versus bridge, old finale versus late ordinary, late ordinary versus peak. Record first-attempt time, undo/restart use and relative preference/difficulty. At 60 conveyor seeds the binomial standard error near 50% is about 6.5 percentage points per depth; paired depths are correlated, so do not claim 120 independent observations for H. These broad bands need larger samples near a boundary before enforcement. Keep the cheap settled screen ahead of machine verification on finalists: the measured physics cost is material to authoring quotas, and a timeout must never count as extra challenge.', '',
  '## Per-depth outcomes and first irreversible mistake', '',
  'Each row reports the 3% depth-4 / depth-6 failure, then zero-lapse depth-4 / depth-6 failure. Counts J/L/E aggregate the two 3% depths only: terminal jams / silent losses / exhausted. First mistake is the mean one-based action among runs with a proven transition (0 is initially lost); “unknown” counts oracle budget exits. Full per-depth, zero-lapse outcome counts and first-action histograms remain in the JSON files linked below.', '',
  '| Board | Model / timing | Failure 4 / 6 | Zero-lapse 4 / 6 | J / L / E | First mistake mean (n) | Unknown | Wins after proxy loss |',
  '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |',
);
for (const row of rows) for (const [mode, value] of modes(row)) {
  const p = value.parts.filter((part) => part.lapse !== 0);
  const z = value.parts.filter((part) => part.lapse === 0);
  const hist = p.flatMap((part) => Object.entries(part.firstIrreversible.byAction));
  const count = hist.reduce((n, [, amount]) => n + amount, 0);
  const first = count ? hist.reduce((n, [action, amount]) => n + Number(action) * amount, 0) / count : null;
  const sum = (get: (part: typeof p[number]) => number) => p.reduce((n, part) => n + get(part), 0);
  lines.push(`| ${row.id} | ${mode} | ${p.map((part) => f(part.failure)).join(' / ')} | ${z.map((part) => f(part.failure)).join(' / ')} | ${sum((part) => part.terminalJam)} / ${sum((part) => part.silentLoss)} / ${sum((part) => part.exhausted)} | ${f(first)} (${count}) | ${sum((part) => part.firstIrreversible.unknown)} | ${sum((part) => part.wonAfterProxyLoss ?? 0)} |`);
}
lines.push('', '## Reproduction and evidence', '',
  '`npx tsx scripts/calibrate-h.ts` computes the whole set, resuming only matching hashes. `npx tsx scripts/report-h.ts <report-path>` validates all hashes and rebuilds this report. The primary table remains unmodified apart from the explicitly requested 139-row hash migration; no historical S was rescored. The final compact Funnel Sort state key omits only finished-box assignments: a transition regression and the board-47 smoke replay preserve behavior. Earlier completed, uncensored rows remain numerically valid under that equivalent representation.', '',
  'Tests cover a real five-tube fixture where depth 4 irreversibly loses at move 3 and depth 6 wins, a synthetic six-step horizon trap, fixed-seed determinism with a warm cache, path-sensitive memoization, uniform legal lapses, budget censoring, machine-trace reuse, ID-independent policy/version/seed hashing and immediate return from capped Tube Sort reachability. The old hash/capped-search mutations were run and both were rejected.', '',
  'The full pre-compaction unit run passed all 684 tests across 23 files with `env -i PATH="$PATH" HOME="$HOME" npx vitest run --maxWorkers=1 --testTimeout=60000` (450.91 seconds). After the final memory compaction, all 26 focused planner/curve tests, TypeScript and lint pass. The initial broad run had eight default 5-second timeouts under concurrent host load and one lint-summary assertion affected by inherited agent environment; the clean serial run resolves all nine without changing tests or game code. No browser or phone tests were needed for this offline scorer-only change; none are claimed.', '',
  `- [Full unit-test log](${resolve('output/current/levelling/expansion/h-unit-tests.log')})`,
  ...rows.map((row) => `- [${row.id} raw calibration](${resolve(directory, `${row.id}.json`)})`), '',
);
const target = process.argv[2] ?? 'output/current/levelling/expansion/calibration-h.md';
writeFileSync(target, lines.join('\n'));
console.log(`Wrote ${rows.length} calibrated boards to ${target}`);
