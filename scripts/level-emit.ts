import { readFileSync, writeFileSync } from 'node:fs';
import type { LoopBoardDef } from '../src/loop/types';
import type { TubeDef } from '../src/puzzles/types';
import type { BoardDef, Color, Packet } from '../src/sim/types';
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
const color = (value: Color): string => `'${value}'`;

function funnelSource(board: BoardDef, note: string): { name: string; code: string } {
  const name = `BOARD_${board.id.split('-')[1]}`;
  // A crate of another size than nine must keep its count, or the bank would hold a different board from the one scored.
  const crate = (packet: Packet): string => (packet.count === 9 ? `tray(${color(packet.color)})` : `tray(${color(packet.color)}, ${packet.count === 6 ? 'SHORT_TRAY' : packet.count === 3 ? 'SMALL_TRAY' : packet.count})`);
  const supplies = board.supplies.map((queue) => (queue.every((packet) => packet.count === 9) ? `trays(${queue.map((packet) => color(packet.color)).join(', ')})` : `[${queue.map(crate).join(', ')}]`)).join(', ');
  const order: Color[] = [];
  const longest = Math.max(...board.docks.map((queue) => queue.length));
  for (let row = 0; row < longest; row++) for (const queue of board.docks) if (queue[row]) order.push(queue[row]!);
  const made = `board(${quote(board.id)}, ${quote(board.title)}, ${board.beltCapacity},\n  [${supplies}],\n  docks(${board.docks.length}, ${order.map(color).join(', ')}))`;
  // The belt shape is part of the board: an eight written without it would load as an oval.
  return { name, code: `/** ${note} */\nexport const ${name}: BoardDef = ${board.trackShape ? `{ ...${made}, trackShape: ${quote(board.trackShape)} }` : made};` };
}
function loopSource(board: LoopBoardDef, note: string): { name: string; code: string } {
  const name = `LOOP_${board.id.split('-')[1]}`;
  if (board.couplings?.length || board.lanes.flat().some((truck) => truck.id || truck.capacity !== undefined || truck.pourAfter)) return { name, code: `/** ${note} */\nexport const ${name}: LoopBoardDef = ${JSON.stringify(board)};` };
  const seg = (packet: Packet): string => `seg(${color(packet.color)}, ${packet.count})`;
  const lanes = board.lanes.map((queue) => `[${queue.map((truck) => `truck(${truck.segments.map(seg).join(', ')})`).join(', ')}]`).join(', ');
  return { name, code: `/** ${note} */\nexport const ${name}: LoopBoardDef = board(${quote(board.id)}, ${quote(board.title)}, ${board.loopCapacity},\n  [${lanes}],\n  ring(${board.loop.map(seg).join(', ')}));` };
}
function tubeSource(board: TubeDef, note: string, solution: readonly { from: number; to: number }[]): string {
  const tubes = board.tubes.map((tube) => `      [${tube.map(color).join(', ')}],`).join('\n');
  const rows: string[] = [];
  for (let at = 0; at < solution.length; at += 4) rows.push(`      ${solution.slice(at, at + 4).map((move) => `{ from: ${move.from}, to: ${move.to} },`).join(' ')}`);
  return `  /** ${note} */\n  {\n    kind: 'tube', id: ${quote(board.id)}, title: ${quote(board.title)}, capacity: ${board.capacity},\n    ${board.containers ? `containers: ${JSON.stringify(board.containers)},\n    ` : ''}tubes: [\n${tubes}\n    ],\n    solution: [\n${rows.join('\n')}\n    ],\n  },`;
}

interface Logged { seed: number; capacity?: number; outcome: string; scored?: ScoredFile }
const accepted = (id: string, seed: number, capacity?: number): ScoredFile => {
  const lines = readFileSync(`${CANDIDATE_DIR}/${id}.jsonl`, 'utf8').trim().split('\n').map((line) => JSON.parse(line) as Logged);
  const line = lines.find((entry) => entry.outcome === 'accepted' && entry.seed === seed && (capacity === undefined || entry.capacity === capacity));
  if (!line?.scored) throw new Error(`No accepted candidate ${id} seed ${seed} capacity ${capacity}`);
  return line.scored;
};

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
const { search: searchFunnel } = await import('./funnel-author');
const { search: searchLoop } = await import('./loop-author');
const { solveTubeSearch, TubeRules } = await import('../src/puzzles/rules');
for (const choice of process.argv.slice(2)) {
  const [rename, source = ''] = choice.includes('=') ? choice.split('=') : [undefined, choice];
  const [from = '', seed, capacity] = source.split(':');
  const id = rename ?? from;
  const target = ALL_TARGETS.find((candidate) => candidate.id === id);
  if (!target) throw new Error(`No target ${id}`);
  let scored: ScoredFile = seed ? accepted(from, Number(seed), capacity ? Number(capacity) : undefined) : JSON.parse(readFileSync(`${SCORE_DIR}/${from}.json`, 'utf8')) as ScoredFile;
  if (rename) {
    const board = { ...(scored.board as object), id, title: target.title };
    scored = { ...scored, board: board as ScoredFile['board'], row: { ...scored.row, id } };
  }
  // Candidates scored before the policy entered the hash keep their measured S; only the hash moves, as in
  // scripts/rehash-scores.ts. H stays absent until scripts/level-score.ts measures it.
  scored = { ...scored, row: { ...scored.row, hash: hashBoard(scored.board as object) } };
  writeFileSync(`${SCORE_DIR}/${id}.json`, JSON.stringify(scored));
  french.push(`${quote(id)}: ${quote(target.fr.replace(/'/g, '’'))}`);
  const witness = String(scored.extra?.['witness'] ?? '');
  if (scored.fast) fast.push(`  ${quote(id)}: { steps: ${scored.fast.steps}, taps: ${JSON.stringify(scored.fast.actions)} },`);
  if (scored.row.game === 'funnel') {
    const board = scored.board as BoardDef;
    funnel.push(funnelSource(board, target.note));
    funnelWitness.push(`${quote(id)}: ${quote(witness)}`);
    const jam = searchFunnel(board).jam;
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
