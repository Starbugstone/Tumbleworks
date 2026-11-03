import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { PLAY_ORDER } from '../src/campaign';
import { BOARDS } from '../src/sim/boards';
import { LOOP_BOARDS } from '../src/loop/boards';
import { TUBE_BOARDS } from '../src/puzzles/levels';
import { SCORE_POLICY, STRONG_POLICY } from './level-policy';
import { hashBoard } from './level-curve';
import { strongFunnel, strongLoop, strongTube } from './level-strong';

export const H_ANCHORS = ['board-28', 'board-29', 'board-30', 'loop-28', 'loop-29', 'loop-30', 'tube-21', 'tube-28', 'tube-29', 'tube-30', 'tube-37'];
async function main(): Promise<void> {
  const ids = process.argv.slice(2).filter((arg) => arg !== '--smoke');
  const smoke = process.argv.includes('--smoke');
  const directory = `output/current/levelling/expansion/h${smoke ? '-smoke' : ''}`;
  mkdirSync(directory, { recursive: true });
  for (const id of ids.length ? ids : [...new Set([...Object.values(PLAY_ORDER).flat(), ...H_ANCHORS])]) {
    const funnel = BOARDS.find((board) => board.id === id);
    const loop = LOOP_BOARDS.find((board) => board.id === id);
    const tube = TUBE_BOARDS.find((board) => board.id === id);
    const board = funnel ?? loop ?? tube;
    if (!board) throw new Error(`Unknown board ${id}`);
    const policy = smoke ? { ...SCORE_POLICY, strong: { ...STRONG_POLICY, ...(tube ? { tubeSeeds: [1, 2, 3] } : { seeds: [1, 2, 3] }) } } : SCORE_POLICY;
    const hash = hashBoard(board, policy);
    const file = `${directory}/${id}.json`;
    try { if (JSON.parse(readFileSync(file, 'utf8')).hash === hash) { console.log(`${id} cached`); continue; } } catch { /* first measurement */ }
    const start = performance.now();
    const seeds = smoke ? [1, 2, 3] : undefined;
    const strong = funnel ? await strongFunnel(funnel, seeds) : loop ? strongLoop(loop, seeds) : strongTube(tube!, seeds);
    const seconds = (performance.now() - start) / 1000;
    const result = { id, hash, seconds, strong };
    writeFileSync(file, JSON.stringify(result, null, 2) + '\n');
    console.log(JSON.stringify({ id, seconds, H: strong.H, settled: strong.settled.H, zero: strong.settled.zeroLapse, machine: strong.machine && Object.fromEntries(Object.entries(strong.machine).map(([timing, value]) => [timing, { H: value.H, zero: value.zeroLapse, exhausted: value.parts.reduce((n, part) => n + part.exhausted, 0) }])) }));
  }
}
if (process.argv[1]?.endsWith('calibrate-h.ts')) await main();
