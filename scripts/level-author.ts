import { featureTrap, type LoopFeature } from './loop-features';
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs';
import { hintLoopSearch } from '../src/loop/solver';
import { LoopRules } from '../src/loop/rules';
import type { LoopBoardDef } from '../src/loop/types';
import { MIN_CAPACITY } from '../src/machine/layout';
import { initPhysics } from '../src/machine/machine';
import { TUBE_BOARDS } from '../src/puzzles/levels';
import { tubeKey, TubeRules } from '../src/puzzles/rules';
import { MachineRules } from '../src/sim/rules';
import { hintConveyorSearch } from '../src/sim/solver';
import { COLORS, type BoardDef, type Color, type FunnelVariants } from '../src/sim/types';
import type { BeltShape } from '../src/engine/belt-path';
import { funnelFeatureTrap } from './funnel-features';
import { FunnelSearchExhausted, generate as generateFunnel, naiveOrders, play as playOrder, search as searchFunnel, tighten as tightenFunnel, winsEitherWay as funnelWitnessWins, type FunnelRecipe } from './funnel-author';
import { bandFor, funnelRating, HINT_STATE_CAP, levelViolations, LOOP_CAPACITY_MAX, loopRating, MIN_RISK_POSITIONS, multiTapFailure, OVAL_CAPACITY_MAX, STRICT_FROM, stretchOf, TUBE_GRAPH_CAP, tubeRating, winCeiling, type Slot } from './level-curve';
import { funnelGame, funnelJitter, loopGame, loopJitter, scoreFunnel, scoreLoop, extendTally, scoreTube, scoreTubeRow, settledFunnel, settledLoop, tally, type FunnelPlayer, type LoopPlayer, type ScoredFile, type Tally } from './level-score';
import { generate as generateLoop, laneByLane, roundRobin, search as searchLoop, tighten as tightenLoop, winsEitherWay as loopWitnessWins, type LoopRecipe } from './loop-author';
import { findRuleTrap, withTubeRule, type TubeRuleRecipe, type TubeTrap, generate as generateTube } from './tube-author';

/**
 * Authors the levels of a stretch against the curve. A candidate faces the cheap settled checks first, then the machine, and
 * every outcome goes on one line of its target's log, so a run can stop at any time and resume where it was.
 *   npx tsx scripts/level-author.ts run <id> [want] [minutes]   search one target until `want` boards pass or `minutes` run out
 *   npx tsx scripts/level-author.ts targets                     list the targets
 * Results are in CANDIDATE_DIR; `scripts/level-emit.ts` turns the chosen ones into source.
 */
export const CANDIDATE_DIR = process.env['CANDIDATE_DIR'] ?? 'output/current/levelling/second-stretch/candidates';
const NOISE = 0.13;
const CONFIRM_GAMES = 200;
const SCREEN_GAMES = 60;
/** The short first screen, its margin on shares (about a 95% interval at 20 games) and on S. */
const PRE_GAMES = 20;
const PRE_NOISE = 0.22;
const PRE_S_MARGIN = 8;

interface Named {
  readonly id: string;
  /** The colours to use, for lessons that bring in one new colour among familiar ones; the first `colors` when absent. */
  readonly palette?: readonly Color[];
  readonly round: number;
  readonly slot: Slot;
  readonly title: string;
  readonly fr: string;
  readonly note: string;
  /** Narrower than the slot's band where the neighbours need it; the band alone would let a peak sit at its bottom. */
  readonly want?: readonly [number, number];
}
export interface FunnelTarget extends Named, FunnelVariants { readonly colors: number; readonly columns: readonly number[]; readonly docks: number; readonly slack: readonly number[]; readonly shape?: BeltShape; /** Short trays of six among the nine-marble ones. */ readonly shorts?: number; /** Small crates of three. */ readonly smalls?: number }
export interface LoopTarget extends Named {
  readonly feature?: LoopFeature;
  readonly capacities?: LoopRecipe['capacities'];
  readonly latch?: LoopRecipe['latch'];
  readonly coupling?: LoopRecipe['coupling'];
  readonly colors: number;
  readonly lanes: readonly number[];
  readonly segments: 2 | 3;
  /** Most trucks that may carry three segments; the rest carry two. */
  readonly threeSegments?: number;
  readonly ringMin: number;
  readonly ringMax: number;
}
export interface TubeTarget extends Named { readonly rule?: TubeRuleRecipe; readonly colors: number; readonly capacity: number; readonly empties: number; readonly moves: readonly [number, number]; readonly f1?: readonly [number, number]; /** Part-full tubes holding the colours; more than `colors` spreads the spare room across them. */ readonly spread?: number }

export const FUNNEL_TARGETS: readonly FunnelTarget[] = [
  { id: 'board-31', round: 2, slot: 'ordinary', title: 'Two by two', fr: 'Deux par deux', note: 'Two columns of two: nothing to lose yet, just the order of things.', colors: 3, columns: [2, 2], docks: 3, slack: [4, 5, 6] },
  { id: 'board-32', round: 3, slot: 'ordinary', title: 'A third column', fr: 'Une troisième colonne', note: 'Five trays in three columns, with plenty of belt.', colors: 3, columns: [2, 2, 1], docks: 3, slack: [4, 5, 6] },
  { id: 'board-33', want: [8, 20], round: 4, slot: 'lesson', title: 'The wrong tray', fr: 'Le mauvais plateau', note: 'The first real trap: one tray too early and the belt fills.', colors: 3, columns: [2, 2, 2], docks: 3, slack: [2, 3, 4] },
  { id: 'board-34', want: [20, 35], round: 5, slot: 'peak', title: 'Two docks', fr: 'Deux quais', note: 'Six trays and only two docks: think two pours ahead.', colors: 3, columns: [2, 2, 2], docks: 2, slack: [2, 3, 4] },
  { id: 'board-35', round: 6, slot: 'relief', title: 'Breathing room', fr: 'Un peu d’air', note: 'A breather after the two docks: fewer trays, a roomy belt.', colors: 3, columns: [2, 2, 1], docks: 2, slack: [3, 4] },
  { id: 'board-36', want: [12, 25], round: 7, slot: 'lesson', title: 'Yellow joins in', fr: 'Le jaune s’invite', note: 'Yellow and its star on a small board with four docks.', colors: 4, columns: [2, 2, 2], docks: 4, slack: [4] },
  { id: 'board-37', want: [22, 37], round: 8, slot: 'ordinary', title: 'Four colours, three docks', fr: 'Quatre couleurs, trois quais', note: 'Four colours share three docks: one colour always waits.', colors: 4, columns: [2, 2, 2], docks: 3, slack: [2, 3, 4] },
  { id: 'board-38', round: 11, slot: 'relief', title: 'Taking turns', fr: 'Chacun son tour', note: 'Seven trays with a roomy belt, after the deeper column.', colors: 4, columns: [3, 2, 2], docks: 3, slack: [3, 4] },
  { id: 'board-39', want: [22, 35], round: 12, slot: 'ordinary', title: 'Eight trays', fr: 'Huit plateaux', note: 'Eight trays, two deep columns: the longest so far.', colors: 4, columns: [3, 3, 2], docks: 4, slack: [2, 3, 4] },
  // Second pass at rounds 4-12, after the owner found only tube-37 at all challenging (3 November 2026).
  { id: 'board-40', want: [22, 36], round: 4, slot: 'lesson', title: 'Fewer docks than colours', fr: 'Moins de quais que de couleurs', note: 'Three colours, two docks: one colour always has to wait.', colors: 3, columns: [2, 2, 2], docks: 2, slack: [1, 2, 3] },
  { id: 'board-41', want: [36, 50], round: 5, slot: 'peak', title: 'Yellow, and no spare dock', fr: 'Du jaune, sans quai libre', note: 'Four colours share three docks on a tight belt.', colors: 4, columns: [2, 2, 2], docks: 3, slack: [0, 1, 2] },
  { id: 'board-42', round: 6, slot: 'relief', title: 'A dock for each', fr: 'Un quai chacun', note: 'Four docks for four colours, after the tight one.', colors: 4, columns: [3, 2, 2], docks: 4, slack: [1, 2, 3] },
  { id: 'board-43', want: [30, 46], round: 7, slot: 'lesson', title: 'Orange arrives', fr: 'L’orange arrive', note: 'The fifth colour and its cross, with four docks.', colors: 5, columns: [2, 2, 2], docks: 4, slack: [1, 2, 3] },
  { id: 'board-44', round: 8, slot: 'ordinary', title: 'Deeper columns', fr: 'Colonnes profondes', note: 'Eight trays for three docks: what is underneath matters.', colors: 4, columns: [3, 3, 2], docks: 3, slack: [0, 1, 2] },
  { id: 'board-45', want: [48, 62], round: 9, slot: 'peak', title: 'Five on three', fr: 'Cinq sur trois', note: 'Five colours share three docks.', colors: 5, columns: [3, 3, 2], docks: 3, slack: [0, 1, 2] },
  { id: 'board-46', want: [30, 46], round: 10, slot: 'lesson', title: 'The first eight', fr: 'Le premier huit', note: 'The belt crosses itself: a longer lap, the same rules.', colors: 4, columns: [3, 3, 2], docks: 3, slack: [0, 1, 2, 3], shape: 'eight' },
  { id: 'board-47', round: 12, slot: 'ordinary', title: 'Nine trays', fr: 'Neuf plateaux', note: 'Nine trays, five colours, four docks.', colors: 5, columns: [3, 3, 3], docks: 4, slack: [0, 1, 2] },
  // Families for rounds 13-20: one structure each, searched once; the assembler places them into slots and gives them IDs.
  { id: 'fam-f13a', want: [30, 66], round: 13, slot: 'ordinary', title: 'Deeper columns', fr: 'Colonnes profondes', note: 'Four colours, eight trays, three docks.', colors: 4, columns: [3, 3, 2], docks: 3, slack: [0, 1, 2] },
  { id: 'fam-f13b', want: [30, 66], round: 13, slot: 'ordinary', title: 'Five on three', fr: 'Cinq sur trois', note: 'Five colours share three docks.', colors: 5, columns: [3, 3, 2], docks: 3, slack: [0, 1, 2] },
  { id: 'fam-f13c', want: [30, 66], round: 13, slot: 'ordinary', title: 'Four columns', fr: 'Quatre colonnes', note: 'Ten trays in four columns, four docks.', colors: 5, columns: [3, 3, 2, 2], docks: 4, slack: [0, 1, 2] },
  { id: 'fam-f13d', want: [30, 66], round: 13, slot: 'ordinary', title: 'Six-marble crates', fr: 'Caisses de six', note: 'Short crates of six among full ones: a cheap pour that still has to fit.', colors: 4, columns: [3, 3, 3], docks: 3, slack: [0, 1, 2], shorts: 3 },
  { id: 'fam-f13e', want: [30, 66], round: 13, slot: 'ordinary', title: 'Over the bridge', fr: 'Par le pont', note: 'Nine trays on a figure eight.', colors: 4, columns: [3, 3, 3], docks: 3, slack: [0, 1, 2, 3], shape: 'eight' },
  { id: 'fam-f13f', want: [30, 66], round: 13, slot: 'ordinary', title: 'Uneven stacks', fr: 'Piles inégales', note: 'Columns of one to three trays: the short ones run out first.', colors: 5, columns: [3, 1, 2, 3], docks: 4, slack: [0, 1, 2] },
  { id: 'fam-f13g', want: [30, 66], round: 13, slot: 'ordinary', title: 'Two by four', fr: 'Deux sur quatre', note: 'Four columns of two, three docks.', colors: 5, columns: [2, 2, 2, 2], docks: 3, slack: [0, 1, 2] },
  { id: 'fam-f13h', want: [30, 66], round: 13, slot: 'ordinary', title: 'Short and full', fr: 'Courts et pleins', note: 'Mixed crates in four columns.', colors: 5, columns: [3, 2, 3, 2], docks: 3, slack: [0, 1, 2], shorts: 4 },
  // Families for rounds 21-24.
  { id: 'fam-f21a', want: [34, 72], round: 21, slot: 'ordinary', title: 'Crates of three', fr: 'Caisses de trois', note: 'Small crates of three: one box each, the cheapest pour of all.', colors: 4, columns: [3, 3, 3], docks: 3, slack: [0, 1, 2], smalls: 3 },
  { id: 'fam-f21b', want: [34, 72], round: 21, slot: 'ordinary', title: 'Nine on three', fr: 'Neuf sur trois', note: 'Nine trays, five colours, three docks.', colors: 5, columns: [3, 3, 3], docks: 3, slack: [0, 1, 2] },
  { id: 'fam-f21c', want: [34, 72], round: 21, slot: 'ordinary', title: 'All sizes', fr: 'Toutes les tailles', note: 'Crates of three, six and nine in four columns.', colors: 4, columns: [3, 3, 2, 2], docks: 3, slack: [0, 1, 2], shorts: 2, smalls: 2 },
  { id: 'fam-f21d', want: [34, 72], round: 21, slot: 'ordinary', title: 'Eleven over the bridge', fr: 'Onze par le pont', note: 'Eleven trays on a figure eight.', colors: 5, columns: [3, 3, 3, 2], docks: 3, slack: [0, 1, 2, 3], shape: 'eight' },
  // Families for rounds 25-40. Black comes in on lessons (Tube 25, Funnel 26, Loop 28) beside three familiar colours; six
  // colours together are taught later (Tube 33, Funnel 36, Loop 38).
  { id: 'fam-f26k', want: [36, 63], round: 26, slot: 'lesson', title: 'Black arrives', fr: 'Le noir arrive', note: 'Black and its three dots, with three familiar colours.', colors: 4, palette: ['black', 'red', 'green', 'yellow'], columns: [3, 3, 2], docks: 3, slack: [0, 1, 2] },
  { id: 'fam-f36s', want: [40, 66], round: 36, slot: 'lesson', title: 'Six colours', fr: 'Six couleurs', note: 'Every colour so far on one board.', colors: 6, columns: [3, 3, 3], docks: 4, slack: [0, 1, 2] },
  { id: 'fam-f25a', want: [44, 78], round: 31, slot: 'ordinary', title: 'Twelve trays', fr: 'Douze plateaux', note: 'Four columns of three, four docks.', colors: 5, columns: [3, 3, 3, 3], docks: 4, slack: [0, 1, 2] },
  { id: 'fam-f25b', want: [44, 78], round: 31, slot: 'ordinary', title: 'A deep column', fr: 'Une colonne profonde', note: 'One column four deep.', colors: 5, columns: [4, 3, 3], docks: 3, slack: [0, 1, 2] },
  { id: 'fam-f25c', want: [44, 78], round: 31, slot: 'ordinary', title: 'The wide crossing', fr: 'La grande traversée', note: 'Nine trays over the wide eight, two docks.', colors: 5, columns: [3, 3, 3], docks: 2, slack: [0, 1, 2, 3], shape: 'wide-eight' },
  { id: 'fam-f25d', want: [44, 78], round: 31, slot: 'ordinary', title: 'Black in the mix', fr: 'Du noir dans le lot', note: 'Black among four other colours, crates of all sizes.', colors: 5, palette: ['black', 'red', 'blue', 'green', 'orange'], columns: [3, 3, 2, 2], docks: 3, slack: [0, 1, 2], shorts: 2, smalls: 1 },
  { id: 'fam-f25e', want: [44, 78], round: 31, slot: 'ordinary', title: 'Eight with black', fr: 'Un huit avec du noir', note: 'Ten trays on a figure eight, black included.', colors: 5, palette: ['black', 'blue', 'green', 'yellow', 'orange'], columns: [3, 3, 2, 2], docks: 3, slack: [0, 1, 2, 3], shape: 'eight' },
  // More families for rounds 31-40, for variety: longer and wider shelves, two-dock boards and black outside its lesson.
  { id: 'fam-f31a', want: [48, 78], round: 31, slot: 'ordinary', title: 'Twelve on three', fr: 'Douze sur trois', note: 'Twelve trays, three docks.', colors: 5, columns: [3, 3, 3, 3], docks: 3, slack: [0, 1, 2] },
  { id: 'fam-f31b', want: [48, 78], round: 31, slot: 'ordinary', title: 'Two tall stacks', fr: 'Deux hautes piles', note: 'Two columns four deep beside a short one.', colors: 5, columns: [4, 4, 2], docks: 3, slack: [0, 1, 2] },
  { id: 'fam-f31c', want: [48, 78], round: 31, slot: 'ordinary', title: 'Black over the bridge', fr: 'Du noir sur le pont', note: 'Nine trays on a figure eight, black included.', colors: 5, palette: ['black', 'red', 'green', 'yellow', 'orange'], columns: [3, 3, 3], docks: 3, slack: [0, 1, 2, 3], shape: 'eight' },
  { id: 'fam-f31d', want: [48, 78], round: 31, slot: 'ordinary', title: 'Every size, wide', fr: 'Toutes tailles, au large', note: 'Crates of three, six and nine over the wide crossing.', colors: 5, columns: [3, 3, 2, 2], docks: 3, slack: [0, 1, 2, 3], shorts: 2, smalls: 2, shape: 'wide-eight' },
  { id: 'fam-f31e', want: [48, 78], round: 31, slot: 'ordinary', title: 'Two docks, ten trays', fr: 'Deux quais, dix plateaux', note: 'Ten trays and only two docks.', colors: 4, columns: [4, 3, 3], docks: 2, slack: [0, 1, 2] },
];
export const LOOP_TARGETS: readonly LoopTarget[] = [
  { id: 'loop-200', round: 43, slot: 'lesson', title: 'Open the latch', fr: 'Ouvrir le verrou', note: 'A receiving latch opened by the red cab.', colors: 3, lanes: [2, 1, 1], segments: 3, ringMin: 0, ringMax: 20, feature: 'latch', latch: ['0:0', '1:0'] },
  { id: 'loop-201', round: 59, slot: 'lesson', title: 'Half the bed', fr: 'La moitié de la benne', note: 'One twelve-unit truck among full beds.', colors: 3, lanes: [2, 1, 1], segments: 3, ringMin: 0, ringMax: 20, feature: 'short', capacities: [[12, 24], [24], [24]] },
  { id: 'loop-202', round: 75, slot: 'lesson', title: 'Unload together', fr: 'Décharger ensemble', note: 'One tap commits both linked tailboards.', colors: 3, lanes: [2, 1, 1], segments: 3, ringMin: 0, ringMax: 20, feature: 'coupling', coupling: ['0:0', '1:0'] },
  { id: 'loop-32', want: [5, 18], round: 4, slot: 'lesson', title: 'One behind', fr: 'Un derrière', note: 'The first queued truck, with room to spare.', colors: 3, lanes: [2, 1, 1], segments: 2, ringMin: 0, ringMax: 0 },
  { id: 'loop-33', want: [12, 35], round: 5, slot: 'peak', title: 'Two queues', fr: 'Deux files', note: 'Five trucks and a little traffic already on the loop.', colors: 3, lanes: [2, 2, 1], segments: 2, ringMin: 2, ringMax: 8 },
  { id: 'loop-34', want: [10, 20], round: 6, slot: 'ordinary', title: 'Five on the move', fr: 'Cinq en route', note: 'Five trucks and an empty loop that does not stay empty.', colors: 3, lanes: [2, 2, 1], segments: 2, ringMin: 0, ringMax: 0 },
  { id: 'loop-35', want: [10, 22], round: 7, slot: 'lesson', title: 'Yellow on the loop', fr: 'Du jaune sur l’anneau', note: 'Yellow and its star, five trucks.', colors: 4, lanes: [2, 2, 1], segments: 2, ringMin: 2, ringMax: 8 },
  { id: 'loop-36', want: [20, 35], round: 8, slot: 'ordinary', title: 'Six trucks', fr: 'Six camions', note: 'Six trucks, every lane queued.', colors: 4, lanes: [2, 2, 2], segments: 2, ringMin: 2, ringMax: 12 },
  { id: 'loop-37', want: [22, 38], round: 9, slot: 'ordinary', title: 'A clear start', fr: 'Un départ dégagé', note: 'Nothing on the loop at the start, and it fills all the same.', colors: 4, lanes: [2, 2, 2], segments: 2, ringMin: 0, ringMax: 0 },
  { id: 'loop-38', want: [15, 30], round: 10, slot: 'lesson', title: 'Three in one', fr: 'Trois en un', note: 'One truck carries three stretches: dig twice to reach its colour.', colors: 4, lanes: [2, 2, 1], segments: 3, threeSegments: 1, ringMin: 0, ringMax: 12 },
  { id: 'loop-39', want: [30, 46], round: 11, slot: 'peak', title: 'Deep loads', fr: 'Charges profondes', note: 'Several trucks carry three stretches and the loop is never quite clear.', colors: 4, lanes: [2, 2, 2], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'loop-40', want: [10, 25], round: 12, slot: 'relief', title: 'Easy does it', fr: 'Tout en douceur', note: 'A wider loop after the deep loads.', colors: 4, lanes: [2, 2, 1], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'loop-41', want: [22, 36], round: 4, slot: 'lesson', title: 'Dig to the cab', fr: 'Creuser jusqu’à la cabine', note: 'One truck carries three stretches and a truck waits behind two of them.', colors: 4, lanes: [2, 2, 1], segments: 3, threeSegments: 1, ringMin: 0, ringMax: 8 },
  { id: 'loop-42', want: [34, 50], round: 5, slot: 'peak', title: 'Every lane queued', fr: 'Toutes les files pleines', note: 'Six trucks, deep loads, and traffic on the loop.', colors: 4, lanes: [2, 2, 2], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'loop-43', want: [30, 37.5], round: 6, slot: 'ordinary', title: 'Short loads', fr: 'Petites charges', note: 'Six trucks with two stretches each.', colors: 4, lanes: [2, 2, 2], segments: 2, ringMin: 2, ringMax: 12 },
  { id: 'loop-44', want: [30, 46], round: 7, slot: 'lesson', title: 'Orange on the road', fr: 'De l’orange sur la route', note: 'The fifth colour and its cross.', colors: 5, lanes: [2, 2, 1], segments: 3, ringMin: 0, ringMax: 12 },
  { id: 'loop-45', round: 8, slot: 'ordinary', title: 'Four bays', fr: 'Quatre quais', note: 'A fourth lane, so more trucks reach the loop at once.', colors: 4, lanes: [2, 2, 2, 1], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'loop-46', round: 9, slot: 'ordinary', title: 'Five colours, six trucks', fr: 'Cinq couleurs, six camions', note: 'Every lane queued, five colours to place.', colors: 5, lanes: [2, 2, 2], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'loop-47', want: [28, 38], round: 12, slot: 'relief', title: 'Two stretches each', fr: 'Deux tronçons chacun', note: 'Six trucks with two stretches each, after the rush.', colors: 4, lanes: [2, 2, 2], segments: 2, ringMin: 2, ringMax: 12 },
  { id: 'loop-48', want: [48, 62], round: 10, slot: 'peak', title: 'Rush hour', fr: 'L’heure de pointe', note: 'Seven trucks in four lanes, five colours.', colors: 5, lanes: [2, 2, 2, 1], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'loop-49', round: 12, slot: 'relief', title: 'After the rush', fr: 'Après la pointe', note: 'Three lanes again, with a little room.', colors: 4, lanes: [2, 2, 2], segments: 3, ringMin: 0, ringMax: 12 },
  { id: 'fam-l13a', want: [30, 66], round: 13, slot: 'ordinary', title: 'Five colours, six trucks', fr: 'Cinq couleurs, six camions', note: 'Every lane queued, five colours.', colors: 5, lanes: [2, 2, 2], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'fam-l13b', want: [30, 66], round: 13, slot: 'ordinary', title: 'Rush hour', fr: 'L’heure de pointe', note: 'Seven trucks in four lanes.', colors: 5, lanes: [2, 2, 2, 1], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'fam-l13c', want: [30, 66], round: 13, slot: 'ordinary', title: 'Four bays', fr: 'Quatre quais', note: 'Four lanes, four colours.', colors: 4, lanes: [2, 2, 2, 1], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'fam-l13d', want: [30, 66], round: 13, slot: 'ordinary', title: 'Three deep', fr: 'Trois de profondeur', note: 'Two lanes, three trucks in each.', colors: 4, lanes: [3, 3], segments: 3, ringMin: 0, ringMax: 12 },
  { id: 'fam-l13e', want: [30, 66], round: 13, slot: 'ordinary', title: 'A long queue', fr: 'Une longue file', note: 'One lane three deep beside two shorter ones.', colors: 5, lanes: [3, 2, 2], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'fam-l13f', want: [30, 66], round: 13, slot: 'ordinary', title: 'A loaded loop', fr: 'Un anneau chargé', note: 'The loop starts busy.', colors: 4, lanes: [2, 2, 2], segments: 3, ringMin: 13, ringMax: 24 },
  { id: 'fam-l13g', want: [30, 66], round: 13, slot: 'ordinary', title: 'Four lanes, empty loop', fr: 'Quatre files, anneau vide', note: 'Four lanes and nothing on the loop yet.', colors: 5, lanes: [2, 2, 1, 1], segments: 3, ringMin: 0, ringMax: 0 },
  { id: 'fam-l21a', want: [34, 72], round: 21, slot: 'ordinary', title: 'Eight trucks', fr: 'Huit camions', note: 'Three lanes, one of them three deep.', colors: 5, lanes: [3, 3, 2], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'fam-l21b', want: [34, 72], round: 21, slot: 'ordinary', title: 'Four full lanes', fr: 'Quatre files pleines', note: 'Eight trucks in four lanes.', colors: 5, lanes: [2, 2, 2, 2], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'fam-l28k', want: [36, 63], round: 28, slot: 'lesson', title: 'A black truck', fr: 'Un camion noir', note: 'Black and its three dots, with three familiar colours.', colors: 4, palette: ['black', 'red', 'blue', 'green'], lanes: [2, 2, 2], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'fam-l38s', want: [40, 66], round: 38, slot: 'lesson', title: 'Six colours on the road', fr: 'Six couleurs sur la route', note: 'Every colour so far, seven trucks.', colors: 6, lanes: [2, 2, 2, 1], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'fam-l25a', want: [44, 78], round: 31, slot: 'ordinary', title: 'Ten trucks', fr: 'Dix camions', note: 'Four lanes, two of them three deep.', colors: 5, lanes: [3, 3, 2, 2], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'fam-l25b', want: [44, 78], round: 31, slot: 'ordinary', title: 'Three deep everywhere', fr: 'Trois partout', note: 'Three lanes, three trucks each.', colors: 4, lanes: [3, 3, 3], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'fam-l25c', want: [44, 78], round: 31, slot: 'ordinary', title: 'Black on a busy loop', fr: 'Du noir sur un anneau chargé', note: 'Black among four colours, the loop already busy.', colors: 5, palette: ['black', 'red', 'blue', 'yellow', 'orange'], lanes: [2, 2, 2, 1], segments: 3, ringMin: 13, ringMax: 24 },
  { id: 'fam-l25d', want: [44, 78], round: 31, slot: 'ordinary', title: 'Two long lanes', fr: 'Deux longues files', note: 'Two lanes of four trucks.', colors: 5, lanes: [4, 4], segments: 3, ringMin: 0, ringMax: 12 },
  { id: 'fam-l31a', want: [48, 78], round: 31, slot: 'ordinary', title: 'Nine trucks', fr: 'Neuf camions', note: 'Three lanes of three.', colors: 5, lanes: [3, 3, 3], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'fam-l31b', want: [48, 78], round: 31, slot: 'ordinary', title: 'Empty loop, ten trucks', fr: 'Anneau vide, dix camions', note: 'Ten trucks and nothing on the loop to start.', colors: 5, lanes: [3, 3, 2, 2], segments: 3, ringMin: 0, ringMax: 0 },
  { id: 'fam-l31c', want: [48, 78], round: 31, slot: 'ordinary', title: 'Black in four lanes', fr: 'Du noir sur quatre files', note: 'Black among four colours, four full lanes.', colors: 5, palette: ['black', 'red', 'green', 'yellow', 'orange'], lanes: [2, 2, 2, 2], segments: 3, ringMin: 2, ringMax: 12 },
  { id: 'fam-l31d', want: [48, 78], round: 31, slot: 'ordinary', title: 'One long lane', fr: 'Une longue file', note: 'A lane four deep beside two shorter ones.', colors: 5, lanes: [4, 3, 2], segments: 3, ringMin: 2, ringMax: 12 },
];
export const TUBE_TARGETS: readonly TubeTarget[] = [
  { id: 'tube-31', round: 2, slot: 'ordinary', title: 'Short shuffle', fr: 'Petit mélange', note: 'A few moves with two spares.', colors: 3, capacity: 4, empties: 2, moves: [5, 6] },
  { id: 'tube-32', round: 3, slot: 'ordinary', title: 'Over and back', fr: 'Aller-retour', note: 'Two spares, one colour has to wait.', colors: 3, capacity: 4, empties: 2, moves: [6, 6] },
  { id: 'tube-33', round: 4, slot: 'lesson', title: 'More mixed up', fr: 'Plus mélangé', note: 'More mixing, more choice, the same three colours.', colors: 3, capacity: 4, empties: 2, moves: [7, 8] },
  { id: 'tube-34', round: 5, slot: 'ordinary', title: 'Ten moves away', fr: 'À dix coups', note: 'Three colours as mixed as they get with two spares.', colors: 3, capacity: 4, empties: 2, moves: [8, 10] },
  { id: 'tube-35', round: 7, slot: 'peak', title: 'Four, well mixed', fr: 'Quatre bien mêlées', note: 'Four colours and a long shortest sort.', colors: 4, capacity: 4, empties: 2, moves: [13, 14] },
  { id: 'tube-36', round: 8, slot: 'ordinary', title: 'A long unpick', fr: 'Long démêlage', note: 'Four colours again, a shorter way through.', colors: 4, capacity: 4, empties: 2, moves: [12, 12] },
  { id: 'tube-37', want: [25, 37], round: 12, slot: 'peak', title: 'The narrow way', fr: 'La voie étroite', note: 'One spare again, and most ways of using it lose.', colors: 3, capacity: 4, empties: 1, moves: [7, 10], f1: [20, 37] },
  { id: 'tube-38', want: [22, 34], round: 4, slot: 'lesson', title: 'Only one spare', fr: 'Un seul tube libre', note: 'One empty tube: the first move you make can be the one that loses.', colors: 3, capacity: 4, empties: 1, moves: [6, 10], f1: [22, 34] },
  { id: 'tube-39', round: 5, slot: 'ordinary', title: 'Careful with the spare', fr: 'Attention au tube libre', note: 'Three colours, one spare, several traps.', colors: 3, capacity: 4, empties: 1, moves: [7, 11], f1: [30, 45] },
  { id: 'tube-40', want: [22, 37], round: 6, slot: 'lesson', title: 'Four colours, one spare', fr: 'Quatre couleurs, un tube libre', note: 'Yellow and its star, with a single spare.', colors: 4, capacity: 4, empties: 1, moves: [8, 13], f1: [22, 37] },
  { id: 'tube-41', want: [45, 62], round: 7, slot: 'peak', title: 'No second chances', fr: 'Pas de seconde chance', note: 'Four colours, one spare, and most openings lose.', colors: 4, capacity: 4, empties: 1, moves: [9, 14], f1: [45, 62] },
  { id: 'tube-42', round: 8, slot: 'ordinary', title: 'Plan the empty tube', fr: 'Prévoir le tube vide', note: 'Four colours, one spare.', colors: 4, capacity: 4, empties: 1, moves: [9, 14], f1: [40, 55] },
  { id: 'tube-43', want: [30, 46], round: 9, slot: 'lesson', title: 'Five high', fr: 'Cinq de haut', note: 'Taller tubes hold five, with one spare.', colors: 3, capacity: 5, empties: 1, moves: [8, 14], f1: [30, 46] },
  { id: 'tube-44', want: [30, 46], round: 10, slot: 'lesson', title: 'Orange in the tubes', fr: 'De l’orange dans les tubes', note: 'Five colours and a single spare.', colors: 5, capacity: 4, empties: 1, moves: [10, 15], f1: [30, 46] },
  { id: 'tube-45', round: 11, slot: 'relief', title: 'Room to think', fr: 'Le temps de réfléchir', note: 'Four colours, five high, one spare.', colors: 4, capacity: 5, empties: 1, moves: [9, 15], f1: [28, 40] },
  { id: 'tube-46', want: [50, 62], round: 12, slot: 'peak', title: 'The last spare', fr: 'Le dernier tube libre', note: 'Five colours, one spare, few safe openings.', colors: 5, capacity: 4, empties: 1, moves: [10, 15], f1: [50, 62] },
  { id: 'fam-t13a', want: [30, 66], round: 13, slot: 'ordinary', title: 'Plan the spare', fr: 'Prévoir le tube libre', note: 'Four colours, one spare.', colors: 4, capacity: 4, empties: 1, moves: [10, 16], f1: [30, 66] },
  { id: 'fam-t13b', want: [30, 66], round: 13, slot: 'ordinary', title: 'Five colours, one spare', fr: 'Cinq couleurs, un tube libre', note: 'Five colours and a single spare.', colors: 5, capacity: 4, empties: 1, moves: [11, 18], f1: [30, 66] },
  { id: 'fam-t13c', want: [30, 66], round: 13, slot: 'ordinary', title: 'Five high', fr: 'Cinq de haut', note: 'Four colours in tubes of five.', colors: 4, capacity: 5, empties: 1, moves: [10, 18], f1: [30, 66] },
  { id: 'fam-t13d', want: [30, 66], round: 13, slot: 'ordinary', title: 'Six high', fr: 'Six de haut', note: 'Three colours in tall tubes.', colors: 3, capacity: 6, empties: 1, moves: [10, 18], f1: [30, 66] },
  { id: 'fam-t13e', want: [30, 66], round: 13, slot: 'ordinary', title: 'Room spread thin', fr: 'La place éparpillée', note: 'No empty tube: the spare room is spread over part-full tubes.', colors: 4, capacity: 4, empties: 0, spread: 5, moves: [8, 16], f1: [30, 66] },
  { id: 'fam-t13f', want: [30, 66], round: 13, slot: 'ordinary', title: 'Spread and spare', fr: 'Éparpillé et libre', note: 'Five colours over six part-full tubes.', colors: 5, capacity: 4, empties: 0, spread: 6, moves: [10, 18], f1: [30, 66] },
  { id: 'fam-t21a', want: [34, 72], round: 21, slot: 'ordinary', title: 'Five colours, five high', fr: 'Cinq couleurs, cinq de haut', note: 'Five colours in tubes of five, one spare.', colors: 5, capacity: 5, empties: 1, moves: [12, 22], f1: [34, 72] },
  { id: 'fam-t21b', want: [34, 72], round: 21, slot: 'ordinary', title: 'Four tall colours', fr: 'Quatre hautes couleurs', note: 'Four colours in tubes of six.', colors: 4, capacity: 6, empties: 1, moves: [12, 22], f1: [34, 72] },
  { id: 'fam-t21c', want: [34, 72], round: 21, slot: 'ordinary', title: 'Seven part-full', fr: 'Sept à moitié', note: 'Five colours spread over seven tubes, no empty one.', colors: 5, capacity: 4, empties: 0, spread: 7, moves: [10, 20], f1: [34, 72] },
  { id: 'fam-t25k', want: [36, 63], round: 25, slot: 'lesson', title: 'Black in the tubes', fr: 'Du noir dans les tubes', note: 'Black and its three dots, with three familiar colours.', colors: 4, palette: ['black', 'red', 'blue', 'yellow'], capacity: 4, empties: 1, moves: [9, 16], f1: [36, 63] },
  { id: 'fam-t33s', want: [40, 66], round: 33, slot: 'lesson', title: 'Six colours', fr: 'Six couleurs', note: 'Every colour so far, one spare.', colors: 6, capacity: 4, empties: 1, moves: [12, 22], f1: [40, 66] },
  { id: 'fam-t25a', want: [44, 78], round: 31, slot: 'ordinary', title: 'Five tall colours', fr: 'Cinq hautes couleurs', note: 'Five colours in tubes of six.', colors: 5, capacity: 6, empties: 1, moves: [14, 24], f1: [44, 78] },
  { id: 'fam-t25b', want: [44, 78], round: 31, slot: 'ordinary', title: 'Black and five high', fr: 'Noir et cinq de haut', note: 'Five colours with black, tubes of five.', colors: 5, palette: ['black', 'red', 'green', 'yellow', 'orange'], capacity: 5, empties: 1, moves: [12, 22], f1: [44, 78] },
  { id: 'fam-t25c', want: [44, 78], round: 31, slot: 'ordinary', title: 'Spread across eight', fr: 'Sur huit tubes', note: 'Six colours over eight part-full tubes.', colors: 6, capacity: 4, empties: 0, spread: 8, moves: [12, 22], f1: [44, 78] },
  { id: 'fam-t25d', want: [44, 78], round: 31, slot: 'ordinary', title: 'Short and sharp', fr: 'Court et vif', note: 'Four colours, one spare, few moves, many traps.', colors: 4, capacity: 4, empties: 1, moves: [8, 13], f1: [44, 78] },
];

interface Log { seed: number; capacity?: number; outcome: string; /** Milliseconds since this seed began, for finding where authoring time goes. */ ms?: number; F1?: number; FM?: number; FMmixed?: number; S?: number; spam?: number; cheese?: number; brisk?: number; gatePassed?: boolean; mixedGatePassed?: boolean; trap?: TubeTrap | null; scored?: ScoredFile }
let seedStarted = Date.now();
/**
 * A family is searched once for the assembler to place into whichever slot it fits, so its own `want` range replaces the
 * nominal slot's band; every other gate still applies, and the assembler checks the band of the slot it is placed in.
 */
const slotGates = (target: Named, violations: string[]): string[] => (target.id.startsWith('fam-') ? violations.filter((text) => !/: S [\d.]+ outside /.test(text)) : violations);
const log = (id: string, entry: Log): void => { appendFileSync(`${CANDIDATE_DIR}/${id}.jsonl`, `${JSON.stringify({ ...entry, ms: Date.now() - seedStarted })}\n`); };
const logged = (id: string): Log[] => {
  try { return readFileSync(`${CANDIDATE_DIR}/${id}.jsonl`, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line) as Log); } catch { return []; }
};

async function funnelCandidate(target: FunnelTarget, seed: number): Promise<number> {
  const recipe: FunnelRecipe = { id: target.id, title: target.title, fr: target.fr, note: target.note, colors: target.colors, columns: target.columns, shorts: target.shorts ?? 0, ...(target.smalls ? { smalls: target.smalls } : {}), ...(target.palette ? { palette: target.palette } : {}), docks: target.docks, capacity: 40, seed, win: [0, 1], slack: 0, naiveJams: false, ...(target.shape ? { shape: target.shape } : {}) };
  const loose = generateFunnel({ ...recipe, pairs: target.pairs, predecessors: target.predecessors, seals: target.seals }, seed);
  if (!loose) { log(target.id, { seed, outcome: 'ungenerated' }); return 0; }
  const variant = Boolean(loose.pairs?.length || loose.predecessors || loose.seals?.length);
  if (!variant) {
    const probe = searchFunnel(loose, 60_000);
    if (!probe.complete) { log(target.id, { seed, outcome: 'search budget' }); return 0; }
    if (!probe.solvable) { log(target.id, { seed, outcome: 'unsolvable' }); return 0; }
  }
  let tight: number;
  try { tight = tightenFunnel(loose).beltCapacity; }
  catch (error) {
    if (!(error instanceof FunnelSearchExhausted)) throw error;
    log(target.id, { seed, outcome: 'capacity search budget' }); return 0;
  }
  const band = target.want ?? bandFor(target.round, target.slot)!;
  const ceiling = winCeiling(target.round);
  let accepted = 0;
  const seen = new Set<number>();
  const slacks = target.pairs || target.predecessors || target.seals ? Array.from({ length: 41 - tight }, (_, i) => i) : target.slack;
  for (const slack of slacks) {
    const capacity = Math.max(MIN_CAPACITY[target.shape ?? 'oval'], tight + slack);
    if (seen.has(capacity) || (!target.shape && capacity > OVAL_CAPACITY_MAX)) continue;
    seen.add(capacity);
    const board: BoardDef = { ...loose, beltCapacity: capacity };
    const say = (outcome: string, extra: Partial<Log> = {}): void => { log(target.id, { seed, capacity, outcome, ...extra }); };
    const found = searchFunnel(board, 60_000);
    if (!found.complete) { say('search budget'); continue; }
    if (!found.solvable) { say('unsolvable'); continue; }
    if ((board.pairs?.length || board.predecessors || board.seals?.length) && funnelFeatureTrap(board) === null) { say('no causal trap'); continue; }
    if (target.round >= 4 && !found.jam) { say('no losing order'); continue; }
    if (target.round >= 7 && !naiveOrders(board).some((order) => playOrder(board, order) === 'jammed')) { say('no naive jam'); continue; }
    const settled = settledFunnel(board);
    // The tempo term moves S at most 12 up or 10 down.
    if (settled.F1 < band[0] - 12 || settled.F1 > band[1] + 10) { say('F1 out of reach', { F1: settled.F1 }); continue; }
    if (target.round >= 4 && settled.shape.risk < MIN_RISK_POSITIONS) { say('too few risks', { F1: settled.F1 }); continue; }
    const hint = hintConveyorSearch(new MachineRules(board));
    if (hint.supply === null || hint.states > HINT_STATE_CAP.funnel) { say('hint', { F1: settled.F1 }); continue; }
    const play = (player: FunnelPlayer) => (game: number) => funnelGame(board, player, game);
    const players: Record<string, Tally> = {};
    const wins = (): { cheese: number; spam: number; brisk: number } => ({ cheese: players['cheese']!.win, spam: players['spam']?.win ?? 0, brisk: players['brisk']?.win ?? 0 });
    const allowed = ceiling === null ? 1 : ceiling + (target.slot === 'relief' || target.slot === 'lesson' ? 0.1 : 0);
    const limit = Math.min(allowed, (100 - settled.F1 + 40) / 100);
    const reward = (): number => Math.max(wins().cheese, wins().spam) - wins().brisk;
    // A short screen first: a board clearly outside a gate stops after PRE_GAMES per player; the rest grow to SCREEN_GAMES,
    // reusing the games already played, and face the usual margins.
    players['cheese'] = tally(play('cheese'), PRE_GAMES);
    if (target.round >= 4 && wins().cheese > limit + PRE_NOISE) { say('auto win', { F1: settled.F1, ...wins() }); continue; }
    players['spam'] = tally(play('spam'), PRE_GAMES);
    players['brisk'] = tally(play('brisk'), PRE_GAMES);
    if (target.round >= 4 && reward() < 0.1 - 1.4 * PRE_NOISE) { say('no reward', { F1: settled.F1, ...wins() }); continue; }
    players['burst2'] = tally(play('burst2'), PRE_GAMES, true);
    players['burst3'] = tally(play('burst3'), PRE_GAMES, true);
    const preS = funnelRating(settled.F1, players['burst2'].win, players['burst3'].win, wins().cheese);
    if (preS < band[0] - PRE_S_MARGIN || preS > band[1] + PRE_S_MARGIN) { say('S out of band', { F1: settled.F1, S: preS, ...wins() }); continue; }
    for (const name of ['cheese', 'spam', 'brisk', 'burst2', 'burst3'] as const) players[name] = extendTally(players[name]!, play(name), SCREEN_GAMES, name.startsWith('burst'));
    if (target.round >= 4 && wins().cheese > limit + NOISE) { say('auto win', { F1: settled.F1, ...wins() }); continue; }
    if (target.round >= 4 && reward() < 0.1 - NOISE) { say('no reward', { F1: settled.F1, ...wins() }); continue; }
    const screenS = funnelRating(settled.F1, players['burst2']!.win, players['burst3']!.win, wins().cheese);
    if (screenS < band[0] - 3 || screenS > band[1] + 3) { say('S out of band', { F1: settled.F1, S: screenS, ...wins() }); continue; }
    let witness: string | null = null;
    let jitterFail = 0;
    for (const candidate of found.witnesses) {
      if (!(await funnelWitnessWins(board, candidate))) continue;
      if (target.round >= 4 && funnelJitter(board, candidate) < 0.9) { jitterFail += 1; continue; }
      witness = candidate;
      break;
    }
    if (!witness) { say(jitterFail ? 'witness jitter' : 'no machine witness', { F1: settled.F1, S: screenS, ...wins() }); continue; }
    if (target.round >= 4 && (Math.abs(wins().cheese - limit) < NOISE || Math.abs(reward() - 0.1) < NOISE)) {
      for (const name of ['cheese', 'spam', 'brisk'] as const) players[name] = extendTally(players[name]!, play(name), CONFIRM_GAMES);
    }
    const scored = await scoreFunnel(board, witness, SCREEN_GAMES, SCREEN_GAMES, players);
    const violations = slotGates(target, levelViolations({ round: target.round, game: 'funnel', slot: target.slot, row: scored.row }));
    if (scored.row.S < band[0] || scored.row.S > band[1]) violations.push(`S ${scored.row.S.toFixed(1)} off target`);
    if (violations.length) { say(`gates: ${violations.join('; ')}`, { F1: scored.row.F1, S: scored.row.S, ...wins() }); continue; }
    say('accepted', { F1: scored.row.F1, S: scored.row.S, ...wins(), scored });
    accepted += 1;
    // A family keeps one capacity per seed: the others are nearly the same board and cost a full scoring each.
    if (target.id.startsWith('fam-')) break;
  }
  return accepted;
}

function loopCandidate(target: LoopTarget, seed: number): number {
  const recipe: LoopRecipe = { id: target.id, title: target.title, fr: target.fr, note: target.note, colors: target.colors, ...(target.palette ? { palette: target.palette } : {}), lanes: target.lanes, segments: target.segments, capacity: LOOP_CAPACITY_MAX, ringMax: target.ringMax, seed, win: [0, 1], naiveJams: false, capacities: target.capacities, latch: target.latch, coupling: target.coupling };
  const loose = generateLoop(recipe, seed);
  if (!loose) return 0;
  const trucks = loose.lanes.flat();
  const allowed = target.segments;
  const threes = trucks.filter((truck) => truck.segments.length === 3).length;
  const ring = loose.loop.reduce((sum, packet) => sum + packet.count, 0);
  if (trucks.some((truck) => truck.segments.length > allowed) || (target.segments === 3 && threes < 1) || (target.threeSegments !== undefined && threes > target.threeSegments) || ring < target.ringMin || ring > target.ringMax) return 0;
  let probe;
  try { probe = searchLoop(loose, 60_000); } catch { return 0; }
  if (!probe.solvable) { log(target.id, { seed, outcome: 'unsolvable' }); return 0; }
  const tight = tightenLoop(loose).loopCapacity;
  const band = target.want ?? bandFor(target.round, target.slot)!;
  const stretch = stretchOf(target.round);
  const ceiling = winCeiling(target.round);
  let accepted = 0;
  for (let extra = 0; extra <= 16 && tight + extra <= LOOP_CAPACITY_MAX; extra += 2) {
    const capacity = tight + extra;
    const board: LoopBoardDef = { ...loose, loopCapacity: capacity };
    const say = (outcome: string, more: Partial<Log> = {}): void => { log(target.id, { seed, capacity, outcome, ...more }); };
    const found = searchLoop(board, 60_000);
    if (!found.solvable) { say('unsolvable'); continue; }
    if (target.feature && (!found.jam || !featureTrap(board, target.feature, found.jam))) { say('no causal rule trap'); continue; }
    if (target.round >= 4 && !found.jam) { say('no losing order'); continue; }
    if (target.round >= 7 && laneByLane(board) !== 'jammed' && roundRobin(board) !== 'jammed') { say('no naive jam'); continue; }
    const settled = settledLoop(board);
    if (settled.F1 < band[0] - 12 || settled.F1 > band[1] + 10) { say('F1 out of reach', { F1: settled.F1 }); continue; }
    if (target.round >= 4 && settled.shape.risk < MIN_RISK_POSITIONS) { say('too few risks', { F1: settled.F1 }); continue; }
    const hint = hintLoopSearch(new LoopRules(board));
    if (hint.lane === null || hint.states > HINT_STATE_CAP.loop) { say('hint', { F1: settled.F1 }); continue; }
    const play = (player: LoopPlayer) => (game: number) => loopGame(board, player, game);
    const burst2 = tally(play('burst2'), SCREEN_GAMES, true);
    const burst3 = tally(play('burst3'), SCREEN_GAMES, true);
    const mixed = tally(play('mixed'), SCREEN_GAMES);
    const spam = tally(play('spam'), SCREEN_GAMES);
    const FM = multiTapFailure(burst2.win, burst3.win);
    const FMmixed = 100 * (1 - mixed.win);
    const gap = stretch.gap ?? 100;
    const S = loopRating(settled.F1, FM);
    const gate = { gatePassed: FM <= settled.F1 + gap, mixedGatePassed: FMmixed <= settled.F1 + gap };
    const figures = { F1: settled.F1, FM, FMmixed, S, spam: spam.win, ...gate };
    if (target.round >= 4 && !(target.round >= STRICT_FROM ? gate.mixedGatePassed : gate.gatePassed)) { say('multi-tap gap', figures); continue; }
    if (S < band[0] - 2 || S > band[1] + 2) { say('S out of band', figures); continue; }
    const spamLimit = ceiling === null ? 1 : ceiling + (target.slot === 'relief' || target.slot === 'lesson' ? 0.1 : 0);
    if (spam.win > spamLimit + 1e-9) { say('auto win', figures); continue; }
    let witness: string | null = null;
    for (const candidate of found.witnesses) {
      if (!loopWitnessWins(board, candidate)) continue;
      if (target.round >= 4 && loopJitter(board, candidate) < 0.9) continue;
      witness = candidate;
      break;
    }
    if (!witness) { say('no machine witness', figures); continue; }
    const scored = scoreLoop(board, witness);
    const violations = slotGates(target, levelViolations({ round: target.round, game: 'loop', slot: target.slot, row: scored.row }));
    if (scored.row.S < band[0] || scored.row.S > band[1]) violations.push(`S ${scored.row.S.toFixed(1)} off target`);
    if (violations.length) { say(`gates: ${violations.join('; ')}`, figures); continue; }
    say('accepted', { ...figures, F1: scored.row.F1, FM: scored.row.FM, S: scored.row.S, FMmixed: 100 * (1 - scored.row.wins['mixed']!.win), scored });
    accepted += 1;
    // A family keeps one capacity per seed: the others are nearly the same board and cost a full scoring each.
    if (target.id.startsWith('fam-')) break;
  }
  return accepted;
}

function tubeCandidate(target: TubeTarget, seed: number): number {
  if (target.colors > COLORS.length) throw new Error(`${target.id} asks for ${target.colors} colours; the palette has ${COLORS.length}`);
  const palette: Color[] = target.palette ? [...target.palette] : COLORS.slice(0, target.colors);
  const tubes = generateTube(palette, target.capacity, target.empties, target.spread ?? target.colors, seed);
  if (!tubes) return 0;
  const board = withTubeRule({ kind: 'tube', id: target.id, title: target.title, capacity: target.capacity, tubes, solution: [] }, target.rule);
  const key = tubeKey(board, new TubeRules(board).state);
  if (TUBE_BOARDS.some((other) => tubeKey(other, new TubeRules(other).state) === key)) return 0;
  const score = scoreTube(board);
  if (!score || score.moves < target.moves[0] || score.moves > target.moves[1]) return 0;
  if (score.graphStates > TUBE_GRAPH_CAP || score.hintStates > HINT_STATE_CAP.tube) return 0;
  const trap = target.rule ? findRuleTrap(board) : null;
  if (target.rule && !trap) return 0;
  const spare = target.empties;
  // Two spares before round 21: nothing may be silently lost.
  if (!target.rule && spare >= 2 && (score.shape.lostShare > 0 || score.shape.silent > 0)) { log(target.id, { seed, outcome: 'silent lost positions', F1: score.F1 }); return 0; }
  if (target.f1 && (score.F1 < target.f1[0] || score.F1 > target.f1[1])) return 0;
  const S = tubeRating(score.F1, score.moves);
  const band = target.want ?? bandFor(target.round, target.slot)!;
  if (S < band[0] || S > band[1]) { log(target.id, { seed, outcome: 'S out of band', F1: score.F1, S }); return 0; }
  const solved = scoreTubeRow(board);
  log(target.id, { seed, outcome: 'accepted', F1: score.F1, S, trap, scored: solved });
  return 1;
}

export const ALL_TARGETS: readonly Named[] = [...FUNNEL_TARGETS, ...LOOP_TARGETS, ...TUBE_TARGETS];

if (process.argv[1]?.endsWith('level-author.ts')) {
  const [mode = 'targets', id = '', wantArg = '1', minutesArg = '30'] = process.argv.slice(2);
  mkdirSync(CANDIDATE_DIR, { recursive: true });
  if (mode === 'targets') for (const target of ALL_TARGETS) console.log(target.id, target.round, target.slot, target.title);
  else {
    const want = Number(wantArg);
    const deadline = Date.now() + Number(minutesArg) * 60_000;
    if (mode === 'recheck') {
      // Re-runs Loop Sort seeds the old every-turn burst gate turned away but the mixed player passes.
      const loopTarget = LOOP_TARGETS.find((target) => target.id === id);
      if (!loopTarget) throw new Error(`No Loop Sort target ${id}`);
      const seeds = [...new Set(logged(id).filter((entry) => entry.outcome === 'multi-tap gap' && entry.mixedGatePassed).map((entry) => entry.seed))];
      let found = 0;
      for (const seed of seeds) { try { found += loopCandidate(loopTarget, seed); } catch (error) { log(id, { seed, outcome: `error ${String(error).slice(0, 160)}` }); } }
      console.error(`${id}: recheck of ${seeds.length} seeds accepted ${found}`);
      process.exit(0);
    }
    const funnel = FUNNEL_TARGETS.find((target) => target.id === id);
    const loop = LOOP_TARGETS.find((target) => target.id === id);
    const tube = TUBE_TARGETS.find((target) => target.id === id);
    if (!funnel && !loop && !tube) throw new Error(`No target ${id}`);
    if (funnel) await initPhysics();
    const past = logged(id);
    let found = past.filter((entry) => entry.outcome === 'accepted').length;
    // Loop and Tube seeds that fail cheaply leave no line, so the seed to resume from is kept apart.
    let progress = 1;
    try { progress = Number(readFileSync(`${CANDIDATE_DIR}/${id}.seed`, 'utf8')) || 1; } catch { /* a first run */ }
    progress = Math.max(progress, ...past.map((entry) => entry.seed + 1));
    const { writeFileSync } = await import('node:fs');
    const started = progress;
    let seed = progress;
    for (; found < want && Date.now() < deadline; seed++) {
      seedStarted = Date.now();
      try {
        found += funnel ? await funnelCandidate(funnel, seed) : loop ? loopCandidate(loop, seed) : tubeCandidate(tube!, seed);
      } catch (error) { log(id, { seed, outcome: `error ${String(error).slice(0, 160)}` }); }
      if (seed % 10 === 0) writeFileSync(`${CANDIDATE_DIR}/${id}.seed`, String(seed + 1));
    }
    writeFileSync(`${CANDIDATE_DIR}/${id}.seed`, String(seed));
    console.error(`${id}: ${found} accepted, seeds ${started}-${seed - 1}`);
  }
}
