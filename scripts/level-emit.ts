import { funnelSource, loopSource, tubeSource } from './level-source';
import { readFileSync, writeFileSync } from 'node:fs';
import type { LoopBoardDef } from '../src/loop/types';
import type { TubeDef } from '../src/puzzles/types';
import type { BoardDef } from '../src/sim/types';
import { ALL_TARGETS, CANDIDATE_DIR } from './level-author';
import type { ScoredFile } from './level-score';
import { SCORE_DIR } from './level-score';
import { hashBoard } from './level-curve';

/**
 * Writes the chosen candidates into the banks, witnesses and titles.
 *   npx tsx scripts/level-emit.ts [as=]<id[:seed[:capacity]]>...
 * A choice with a seed names an accepted line in CANDIDATE_DIR; one without names a board already scored in SCORE_DIR, so boards
 * from an earlier stretch stay in the bank. `as=` emits it under another target's ID, title and note (the score does not depend
 * on the ID, so only the hash is recomputed). Its score goes to SCORE_DIR, so `level-score.ts merge` includes it.
 * Blocks between the BEGIN and END markers are replaced whole, so emitting again is safe.
 */
const replaceBlock = (path: string, marker: string, body: string): void => {
  const source = readFileSync(path, 'utf8');
  const begin = `// BEGIN ${marker}`;
  const end = `// END ${marker}`;
  const at = source.indexOf(begin);
  const to = source.indexOf(end);
  if (at < 0 || to < 0) throw new Error(`${path} has no ${marker} block`);
  const indent = source.slice(source.lastIndexOf('\n', to) + 1, to);
  writeFileSync(path, `${source.slice(0, at)}${begin}\n${body}\n${indent}${source.slice(to)}`);
};
const quote = (text: string): string => `'${text.replace(/'/g, '\\\'')}'`;

interface Logged { seed: number; capacity?: number; outcome: string; scored?: ScoredFile }
const accepted = (id: string, seed: number, capacity?: number): ScoredFile => {
  const lines = readFileSync(`${CANDIDATE_DIR}/${id}.jsonl`, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as Logged);
  const line = lines.find((entry) => entry.outcome === 'accepted' && entry.seed === seed && (capacity === undefined || entry.capacity === capacity));
  if (!line?.scored) throw new Error(`No accepted candidate ${id} seed ${seed} capacity ${capacity}`);
  return line.scored;
};

const NAMES: Record<string, { title: string; fr: string; note: string }> = process.env['LEVEL_NAMES'] ? JSON.parse(readFileSync(process.env['LEVEL_NAMES'], 'utf8')) : {};
const funnel: { name: string; code: string }[] = [];
const loop: { name: string; code: string }[] = [];
const tube: string[] = [];
const funnelWitness: string[] = [];
const funnelJam: string[] = [];
const loopWitness: string[] = [];
const loopJam: string[] = [];
const fast: string[] = [];
const french: string[] = [];
const noJam: string[] = [];
const { hintConveyorSearch } = await import('../src/sim/solver');
const { MachineRules } = await import('../src/sim/rules');
const { hintLoopSearch } = await import('../src/loop/solver');
const { LoopRules } = await import('../src/loop/rules');
/** The opening hint's search changes with the rules code, so it is measured as the board is written, never copied. */
function openingHintStates(scored: ScoredFile): number {
  if (scored.row.game === 'funnel') return hintConveyorSearch(new MachineRules(scored.board as BoardDef)).states;
  if (scored.row.game === 'loop') return hintLoopSearch(new LoopRules(scored.board as LoopBoardDef)).states;
  const board = scored.board as TubeDef;
  return solveTubeSearch(board, new TubeRules(board).state).states;
}
const { search: searchFunnel, play: playSettled, playMachine: playFunnelMachine } = await import('./funnel-author');
/**
 * The recorded losing order must also jam on the physics machine, where tests/machine/machine.test.ts replays it: the
 * settled search's jam can drain there when the pile mixes. Try it first, then complete orders that jam settled.
 */
async function machineJam(board: BoardDef, settledJam: string | null): Promise<string | null> {
  if (settledJam && (await playFunnelMachine(board, settledJam)).status === 'jammed') return settledJam;
  if (board.pairs?.length || board.predecessors) return settledJam;
  const orders: string[] = [];
  const walk = (left: number[], prefix: string): void => {
    if (left.every((count) => count === 0)) { orders.push(prefix); return; }
    left.forEach((count, column) => { if (count > 0) { const next = [...left]; next[column]! -= 1; walk(next, prefix + String.fromCharCode(65 + column)); } });
  };
  walk(board.supplies.map((queue) => queue.length), '');
  let tried = 0;
  // The stored order stops where the rules jam (tests/rules/rules.test.ts releases every tap), so try that prefix.
  const jamPrefix = (order: string): string | null => {
    for (let length = 1; length <= order.length; length++) {
      if (playSettled(board, [...order.slice(0, length)].map((letter) => letter.charCodeAt(0) - 65)) === 'jammed') return order.slice(0, length);
    }
    return null;
  };
  const seen = new Set<string>();
  for (const order of orders) {
    const prefix = jamPrefix(order);
    if (!prefix || seen.has(prefix)) continue;
    seen.add(prefix);
    if ((await playFunnelMachine(board, prefix)).status === 'jammed') return prefix;
    if (++tried >= 60) break;
  }
  console.warn(`${board.id}: no losing order jams on the machine within ${tried} tries`);
  return settledJam;
}
const { search: searchLoop } = await import('./loop-author');
const { solveTubeSearch, TubeRules } = await import('../src/puzzles/rules');
for (const choice of process.argv.slice(2)) {
  const [rename, source = ''] = choice.includes('=') ? choice.split('=') : [undefined, choice];
  const [from = '', seed, capacity] = source.split(':');
  const id = rename ?? from;
  // A placed level's name comes from its own target, or from the LEVEL_NAMES file the assembler's plan writes.
  const target = ALL_TARGETS.find((candidate) => candidate.id === id) ?? (NAMES[id] ? { id, ...NAMES[id] } : undefined);
  if (!target) throw new Error(`No target or name for ${id}`);
  let scored: ScoredFile = seed ? accepted(from, Number(seed), capacity ? Number(capacity) : undefined) : JSON.parse(readFileSync(`${SCORE_DIR}/${from}.json`, 'utf8')) as ScoredFile;
  if (rename) {
    const board = { ...(scored.board as object), id, title: target.title };
    scored = { ...scored, board: board as ScoredFile['board'], row: { ...scored.row, id } };
  }
  // Candidates scored before the policy entered the hash keep their measured S; only the hash moves, as in
  // scripts/rehash-scores.ts. H stays absent until scripts/level-score.ts measures it.
  scored = { ...scored, row: { ...scored.row, hash: hashBoard(scored.board as object), hintStates: openingHintStates(scored) } };
  writeFileSync(`${SCORE_DIR}/${id}.json`, JSON.stringify(scored));
  french.push(`${quote(id)}: ${quote(target.fr.replace(/'/g, '’'))}`);
  const witness = String(scored.extra?.['witness'] ?? '');
  if (scored.fast) fast.push(`  ${quote(id)}: { steps: ${scored.fast.steps}, taps: ${JSON.stringify(scored.fast.actions)} },`);
  if (scored.row.game === 'funnel') {
    const board = scored.board as BoardDef;
    funnel.push(funnelSource(board, target.note));
    funnelWitness.push(`${quote(id)}: ${quote(witness)}`);
    const jam = await machineJam(board, searchFunnel(board).jam);
    if (jam) funnelJam.push(`${quote(id)}: ${quote(jam)}`); else noJam.push(quote(id));
  } else if (scored.row.game === 'loop') {
    const board = scored.board as LoopBoardDef;
    loop.push(loopSource(board, target.note));
    loopWitness.push(`${quote(id)}: ${quote(witness)}`);
    const jam = searchLoop(board).jam;
    if (jam) loopJam.push(`${quote(id)}: ${quote(jam)}`);
  } else {
    const board = scored.board as TubeDef;
    const { moves } = solveTubeSearch(board, new TubeRules(board).state);
    tube.push(tubeSource(board, target.note, moves ?? []));
  }
}
const rows = (items: readonly string[]): string => items.join(', ');
replaceBlock('src/sim/boards.ts', 'first stretch', funnel.map((entry) => entry.code).join('\n'));
replaceBlock('src/loop/boards.ts', 'first stretch', loop.map((entry) => entry.code).join('\n'));
replaceBlock('src/puzzles/levels.ts', 'first stretch', tube.join('\n'));
replaceBlock('src/i18n.ts', 'first stretch', `  ${rows(french)},`);
replaceBlock('tests/witnesses.ts', 'first stretch funnel witnesses', `  ${rows(funnelWitness)},`);
replaceBlock('tests/witnesses.ts', 'first stretch funnel jams', `  ${rows(funnelJam)},`);
replaceBlock('tests/witnesses.ts', 'first stretch loop witnesses', `  ${rows(loopWitness)},`);
replaceBlock('tests/witnesses.ts', 'first stretch loop jams', `  ${rows(loopJam)},`);
console.log(`names: funnel ${funnel.map((entry) => entry.name).join(', ')}; loop ${loop.map((entry) => entry.name).join(', ')}`);
console.log(`no losing order: ${noJam.join(', ')}`);
console.log(`fast witnesses from candidates (old boards come from SCORE_DIR):\n${fast.length}`);
// Campaign boards defined outside the generated block keep their multi-tap wins here.
const oldFast = ['board-2', 'board-3', 'board-17'].map((id) => {
  const scored = JSON.parse(readFileSync(`${SCORE_DIR}/${id}.json`, 'utf8')) as ScoredFile;
  if (!scored.fast) throw new Error(`${id} has no multi-tap win`);
  return `  ${quote(id)}: { steps: ${scored.fast.steps}, taps: ${JSON.stringify(scored.fast.actions)} },`;
});
replaceBlock('tests/witnesses.ts', 'first stretch fast witnesses', [...oldFast, ...fast].join('\n'));
