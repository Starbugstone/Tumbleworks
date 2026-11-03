import { availableTubeMoves, cloneTubeState, moveTubeState, solveTubeSearch, tubeKey, TubeRules } from '../src/puzzles/rules';
import { HINT_STATE_CAP, TUBE_GRAPH_CAP } from './level-curve';
import type { TubeContainer, TubeDef, TubeMove, TubeState } from '../src/puzzles/types';
import { COLORS, type Color } from '../src/sim/types';

/**
 * Random Tube Sort boards with a verified shortest solution, for authoring:
 *   npx tsx scripts/tube-author.ts <colors> <capacity> <empties> <seed> [minMoves] [maxMoves] [spread]
 *     prints the first seed at or after <seed> whose shortest solution falls in the move range;
 *     <spread> starts the marbles in that many tubes instead of one full tube per colour.
 *   npx tsx scripts/tube-author.ts batch      # evaluate every recipe below and print the TypeScript
 */
const PALETTE: readonly Color[] = COLORS;

export interface TubeRecipe {
  readonly id: string;
  readonly title: string;
  readonly fr: string;
  readonly note: string;
  readonly colors: number;
  readonly capacity: number;
  readonly empties: number;
  /** Tubes holding marbles at the start; more than the colour count leaves them part full. */
  readonly spread?: number;
  readonly rule?: TubeRuleRecipe;
  readonly seed: number;
  readonly moves: readonly [number, number];
}

export type TubeRuleRecipe =
  | { readonly role: 'capped'; readonly color: Color }
  | { readonly role: 'cup' };

/** Special lessons replace the last spare; cap lessons retain an open spare. */
export function withTubeRule(board: TubeDef, rule?: TubeRuleRecipe): TubeDef {
  if (!rule) return board;
  const last = board.tubes.length - 1;
  if (board.tubes[last]?.length) throw new Error('A rule needs an empty spare');
  if (rule.role === 'capped' && board.tubes.filter((tube) => !tube.length).length < 2) throw new Error('A cap lesson needs an open spare');
  const containers: TubeContainer[] = board.tubes.map(() => ({ role: 'ordinary', capacity: board.capacity }));
  containers[last] = rule.role === 'cup' ? { role: 'cup', capacity: 2 }
    : { role: 'capped', capacity: board.capacity, opensOn: rule.color };
  return { ...board, containers };
}

export interface TubeTrap {
  readonly prefix: readonly TubeMove[];
  readonly move: TubeMove;
  /** Same lost position, with only the restriction relaxed, has this winning continuation. */
  readonly rescue: readonly TubeMove[];
}

/** Exhaust the role-aware graph before calling a choice lost. Relax only the rule to establish causality. */
export function findRuleTrap(board: TubeDef, cap = TUBE_GRAPH_CAP): TubeTrap | null {
  if (!board.containers) return null;
  const start = new TubeRules(board).snapshot();
  const queue: { state: TubeState; prefix: TubeMove[]; edges: { move: TubeMove; to: number }[]; parents: number[] }[] = [{ state: start, prefix: [], edges: [], parents: [] }];
  const seen = new Map([[tubeKey(board, start), 0]]);
  for (let id = 0; id < queue.length; id++) {
    const node = queue[id]!;
    for (const move of availableTubeMoves(board, node.state)) {
      const after = cloneTubeState(node.state);
      moveTubeState(board, after, move.from, move.to);
      const key = tubeKey(board, after);
      let to = seen.get(key);
      if (to === undefined) {
        if (queue.length >= cap) return null;
        to = queue.length;
        seen.set(key, to);
        queue.push({ state: after, prefix: [...node.prefix, move], edges: [], parents: [] });
      }
      node.edges.push({ move, to });
      queue[to]!.parents.push(id);
    }
  }
  const winning = new Set(queue.flatMap((node, id) => node.state.status === 'won' ? [id] : []));
  const work = [...winning];
  for (const id of work) for (const parent of queue[id]!.parents) {
    if (!winning.has(parent)) { winning.add(parent); work.push(parent); }
  }
  for (let id = 0; id < queue.length; id++) {
    if (!winning.has(id)) continue;
    const { state, prefix, edges } = queue[id]!;
    for (const { move, to } of edges) {
      if (winning.has(to)) continue;
      // Reapply to this representative: the canonical destination may have permuted ordinary homes.
      const after = cloneTubeState(state);
      moveTubeState(board, after, move.from, move.to);
      const relaxed = cloneTubeState(after);
      relaxed.status = 'playing';
      const containers = board.containers.map((container, index): TubeContainer => {
        if (container.role === 'capped') relaxed.opened[index] = true;
        if (container.role === 'cup') relaxed.spent[index] = false;
        return container;
      });
      const rescue = solveTubeSearch({ ...board, containers }, relaxed, cap + 1).moves;
      const attractive = state.tubes[move.to]!.length > 0 || !after.tubes[move.from]!.length || state.tubes[move.from]!.length - after.tubes[move.from]!.length >= 2;
      if (rescue?.length && attractive) return { prefix, move, rescue };
    }
  }
  return null;
}

function random(seed: number): () => number {
  let state = seed || 1;
  return () => { state = (state * 16807) % 2147483647; return state / 2147483647; };
}

export function generate(colors: Color[], capacity: number, empties: number, spread: number, seed: number): Color[][] | null {
  const next = random(seed);
  const pool = colors.flatMap((color) => Array.from({ length: capacity }, () => color));
  for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [pool[i], pool[j]] = [pool[j]!, pool[i]!]; }
  // Tube sizes: full tubes when spread equals the colour count, otherwise random sizes that still fit.
  const sizes = Array.from({ length: spread }, () => 1);
  for (let left = pool.length - spread; left > 0; left--) {
    const open = sizes.map((size, index) => (size < capacity ? index : -1)).filter((index) => index >= 0);
    if (!open.length) return null;
    sizes[open[Math.floor(next() * open.length)]!]! += 1;
  }
  const tubes: Color[][] = [];
  let cursor = 0;
  for (const size of sizes) { tubes.push(pool.slice(cursor, cursor + size)); cursor += size; }
  if (tubes.some((tube) => tube.length === capacity && tube.every((color) => color === tube[0]))) return null;
  // Nothing should be solvable with one move: the top group must not already have a home.
  if (tubes.some((tube) => tube.slice(-2).every((color) => color === tube.at(-1)) && tube.slice(0, -2).every((color) => color === tube[0]) && tube.at(-1) === tube[0])) return null;
  for (let i = 0; i < empties; i++) tubes.push([]);
  return tubes;
}

/** How many positions a player can reach, capped: within the cap the hint's search is exhaustive, so a null hint is a proof. */
export function reachableTubeStates(board: TubeDef, cap = TUBE_GRAPH_CAP + 1): number {
  const initial = new TubeRules(board).snapshot();
  const seen = new Set([tubeKey(board, initial)]);
  const stack = [initial];
  while (stack.length && seen.size < cap) {
    const state = stack.pop()!;
    for (const move of availableTubeMoves(board, state)) {
      const after = cloneTubeState(state);
      if (!moveTubeState(board, after, move.from, move.to).ok) continue;
      const name = tubeKey(board, after);
      if (seen.has(name)) continue;
      seen.add(name);
      if (seen.size >= cap) break;
      if (after.status === 'playing') stack.push(after);
    }
  }
  return seen.size;
}

export interface TubeReport { readonly seed: number; readonly tubes: Color[][]; readonly solution: TubeMove[]; readonly solveMs: number; readonly containers?: readonly TubeContainer[]; readonly trap?: TubeTrap }

export function author(colors: number, capacity: number, empties: number, spread: number, seed: number, moves: readonly [number, number], attempts = 400, rule?: TubeRuleRecipe): TubeReport {
  const palette = PALETTE.slice(0, colors);
  for (let candidate = seed; candidate < seed + attempts; candidate++) {
    const tubes = generate(palette, capacity, empties, spread, candidate);
    if (!tubes) continue;
    const board = withTubeRule({ kind: 'tube', id: `candidate-${candidate}`, title: 'Candidate', capacity, tubes, solution: [] }, rule);
    const started = Date.now();
    // The default budget is what the in-game hint gets, so a board it cannot solve is rejected.
    const { moves: solution, states } = solveTubeSearch(board, new TubeRules(board).state);
    // Printed for information. The gates count states, so the same seed cannot flip with machine load.
    const solveMs = Date.now() - started;
    if (!solution || solution.length < moves[0] || solution.length > moves[1] || states > HINT_STATE_CAP.tube) continue;
    if (reachableTubeStates(board) > TUBE_GRAPH_CAP) continue;
    const trap = rule ? findRuleTrap(board) : undefined;
    if (rule && !trap) continue;
    return { seed: candidate, tubes, solution, solveMs, containers: board.containers, trap: trap ?? undefined };
  }
  throw new Error(`No tube board for ${colors} colours, capacity ${capacity}, ${empties} empties within ${attempts} seeds`);
}

export function emitBoard(recipe: TubeRecipe, report: TubeReport): string {
  const tubes = report.tubes.map((tube) => `      [${tube.map((color) => `'${color}'`).join(', ')}],`).join('\n');
  const rows: string[] = [];
  for (let i = 0; i < report.solution.length; i += 4) rows.push('      ' + report.solution.slice(i, i + 4).map((move) => `{ from: ${move.from}, to: ${move.to} },`).join(' '));
  return `  /** ${recipe.note} */\n  {\n    kind: 'tube', id: '${recipe.id}', title: '${recipe.title.replace(/'/g, '\\\'')}', capacity: ${recipe.capacity},\n    ${report.containers ? `containers: ${JSON.stringify(report.containers)},\n    ` : ''}tubes: [\n${tubes}\n    ],\n    solution: [\n${rows.join('\n')}\n    ],\n  },`;
}

export const TUBE_RECIPES: readonly TubeRecipe[] = [
  // Tube Sort ramps gently: the player found the early boards too hard. Boards 2 to 7 keep their titles.
  { id: 'tube-2', title: 'Crossed currents', fr: 'Courants croisés', note: 'Four colours, two spares, a few moves: the first real sort.', colors: 4, capacity: 4, empties: 2, seed: 1, moves: [6, 7] },
  { id: 'tube-3', title: 'One spare', fr: 'Une place libre', note: 'Three colours and a single empty tube: the spare has to be used well.', colors: 3, capacity: 4, empties: 1, seed: 1, moves: [6, 8] },
  { id: 'tube-4', title: 'Taller tubes', fr: 'Tubes plus hauts', note: 'Three colours five high with two spares: the groups are bigger.', colors: 3, capacity: 5, empties: 2, seed: 1, moves: [7, 9] },
  { id: 'tube-5', title: 'One spare, five high', fr: 'Une place, cinq de haut', note: 'Four colours, one empty tube, five high.', colors: 4, capacity: 5, empties: 1, seed: 1, moves: [9, 11] },
  { id: 'tube-6', title: 'A fifth colour', fr: 'Une cinquième couleur', note: 'Orange and its cross pattern arrive here, in the calmest game, before the belts see them.', colors: 5, capacity: 4, empties: 2, seed: 1, moves: [10, 12] },
  { id: 'tube-7', title: 'Five by five', fr: 'Cinq sur cinq', note: 'Five colours, five high, two spares.', colors: 5, capacity: 5, empties: 2, seed: 1, moves: [12, 14] },
  { id: 'tube-8', title: 'Loose fill', fr: 'Remplissage lâche', note: 'Four colours spread over five part-full tubes: more room, more ways to waste it.', colors: 4, capacity: 4, empties: 1, spread: 5, seed: 1, moves: [9, 11] },
  { id: 'tube-9', title: 'Four, five, two', fr: 'Quatre, cinq, deux', note: 'Four colours five high with two spares.', colors: 4, capacity: 5, empties: 2, seed: 1, moves: [11, 13] },
  { id: 'tube-10', title: 'Six high', fr: 'Six de haut', note: 'Tubes of six for the first time, three colours.', colors: 3, capacity: 6, empties: 2, seed: 1, moves: [10, 13] },
  { id: 'tube-11', title: 'No slack', fr: 'Sans marge', note: 'Four colours, four high, one spare: every move must earn its place.', colors: 4, capacity: 4, empties: 1, seed: 1, moves: [10, 12] },
  { id: 'tube-12', title: 'Scattered', fr: 'Éparpillé', note: 'Five colours spread over six part-full tubes.', colors: 5, capacity: 4, empties: 2, spread: 6, seed: 1, moves: [11, 14] },
  { id: 'tube-13', title: 'Three colours, six high', fr: 'Trois couleurs, six de haut', note: 'Only three colours, one spare, but the groups run long.', colors: 3, capacity: 6, empties: 1, seed: 1, moves: [12, 15] },
  { id: 'tube-14', title: 'Five colours, one spare', fr: 'Cinq couleurs, une place', note: 'Five colours and a single empty tube.', colors: 5, capacity: 4, empties: 1, seed: 1, moves: [12, 15] },
  { id: 'tube-15', title: 'Four colours, six high', fr: 'Quatre couleurs, six de haut', note: 'Four colours six high with two spares.', colors: 4, capacity: 6, empties: 2, seed: 1, moves: [13, 16] },
  { id: 'tube-16', title: 'Spread thin', fr: 'Étalé', note: 'Four colours five high spread over five tubes.', colors: 4, capacity: 5, empties: 2, spread: 5, seed: 1, moves: [12, 15] },
  { id: 'tube-17', title: 'Four, five, one', fr: 'Quatre, cinq, un', note: 'Four colours, five high, one spare.', colors: 4, capacity: 5, empties: 1, seed: 1, moves: [14, 16] },
  { id: 'tube-18', title: 'Thirty marbles', fr: 'Trente billes', note: 'Five colours six high with two spares.', colors: 5, capacity: 6, empties: 2, seed: 1, moves: [15, 18] },
  { id: 'tube-19', title: 'Five and five', fr: 'Cinq et cinq', note: 'Five colours, five high, one spare.', colors: 5, capacity: 5, empties: 1, seed: 1, moves: [15, 18] },
  { id: 'tube-20', title: 'Six tubes, five colours', fr: 'Six tubes, cinq couleurs', note: 'Five colours loosely spread over six tubes with two spares.', colors: 5, capacity: 4, empties: 2, spread: 6, seed: 100, moves: [13, 16] },
  { id: 'tube-21', title: 'One spare, six high', fr: 'Une place, six de haut', note: 'Four colours six high and only one empty tube.', colors: 4, capacity: 6, empties: 1, seed: 1, moves: [16, 19] },
  { id: 'tube-22', title: 'Long haul', fr: 'Longue route', note: 'Five colours five high with two spares and a long shortest solution.', colors: 5, capacity: 5, empties: 2, seed: 1, moves: [18, 21] },
  { id: 'tube-23', title: 'Spread wide', fr: 'Largement étalé', note: 'Four colours spread over six part-full tubes with two spares.', colors: 4, capacity: 4, empties: 2, spread: 6, seed: 300, moves: [13, 17] },
  { id: 'tube-24', title: 'Five colours, four high', fr: 'Cinq couleurs, quatre de haut', note: 'Five colours in a tight four-high rack with one spare.', colors: 5, capacity: 4, empties: 1, seed: 2000, moves: [16, 19] },
  { id: 'tube-25', title: 'Tall and loose', fr: 'Grand et lâche', note: 'Five colours six high with two spares and a long way round.', colors: 5, capacity: 6, empties: 2, seed: 700, moves: [19, 23] },
  { id: 'tube-26', title: 'Three colours, long way', fr: 'Trois couleurs, long chemin', note: 'Three colours six high with one spare and a long solution.', colors: 3, capacity: 6, empties: 1, seed: 3000, moves: [16, 20] },
  { id: 'tube-27', title: 'Five high, no slack', fr: 'Cinq de haut, sans marge', note: 'Five colours five high, one spare.', colors: 5, capacity: 5, empties: 1, seed: 4000, moves: [19, 23] },
  { id: 'tube-28', title: 'One spare, five colours, six high', fr: 'Une place, cinq couleurs, six de haut', note: 'Five colours six high and only one empty tube.', colors: 5, capacity: 6, empties: 1, seed: 1, moves: [20, 24] },
  { id: 'tube-29', title: 'Thirty, two spares', fr: 'Trente, deux places', note: 'Five colours six high, two spares, a long solution.', colors: 5, capacity: 6, empties: 2, seed: 5000, moves: [22, 28] },
  { id: 'tube-30', title: 'Grand finale', fr: 'Grand final', note: 'Five colours six high with one spare: the longest Tube Sort board.', colors: 5, capacity: 6, empties: 1, seed: 6000, moves: [24, 32] },
];

if (process.argv[1]?.endsWith('tube-author.ts')) {
  if (process.argv[2] === 'batch') {
    const only = process.argv.slice(3);
    const emitted: string[] = [];
    const french: string[] = [];
    for (const recipe of TUBE_RECIPES.filter((candidate) => !only.length || only.includes(candidate.id))) {
      const started = Date.now();
      const report = author(recipe.colors, recipe.capacity, recipe.empties, recipe.spread ?? recipe.colors, recipe.seed, recipe.moves, 400, recipe.rule);
      console.error(`${recipe.id} seed ${report.seed} moves ${report.solution.length} solve ${report.solveMs}ms (${Date.now() - started}ms)`);
      emitted.push(emitBoard(recipe, report));
      french.push(`'${recipe.id}': '${recipe.fr.replace(/'/g, '’')}'`);
    }
    console.log(emitted.join('\n'));
    console.log(`// french\n${french.join(', ')}`);
  } else if (process.argv[2] === 'rule') {
    const role = process.argv[3];
    if (role !== 'capped' && role !== 'cup') throw new Error('Use capped or cup');
    const rule: TubeRuleRecipe = role === 'cup' ? { role } : { role, color: 'red' };
    console.log(JSON.stringify(author(3, 4, 2, 3, Number(process.argv[4] ?? 1), [3, 14], 400, rule)));
  } else {
    const [colorsArg = '4', capacityArg = '4', emptiesArg = '2', seedArg = '1', minArg = '8', maxArg = '20', spreadArg] = process.argv.slice(2);
    const report = author(Number(colorsArg), Number(capacityArg), Number(emptiesArg), Number(spreadArg ?? colorsArg), Number(seedArg), [Number(minArg), Number(maxArg)]);
    console.log(JSON.stringify({ seed: report.seed, moves: report.solution.length, solveMs: report.solveMs, tubes: report.tubes, solution: report.solution }));
  }
}
