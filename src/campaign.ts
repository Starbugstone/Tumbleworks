import { levelTitle, t } from './i18n';
import { CampaignRegistry, type Difficulty, type GameplayPack } from './engine/contracts';
import { ConveyorRuntime } from './gameplays/conveyor';
import { LoopRuntime } from './gameplays/loop';
import { LOOP_BOARDS } from './loop/boards';
import { TubeRuntime } from './gameplays/tube';
import { GAME_NAMES } from './gameplays/names';
import { TUBE_BOARDS } from './puzzles/levels';
import { BOARDS } from './sim/boards';
import type { Color } from './sim/types';

const difficulties: readonly Difficulty[] = ['Getting started', 'Finding a rhythm', 'Thinking ahead'];
/** Full spectrum marks every board where the fifth colour appears; the first levels of each bank teach the controls. */
const hasOrange = (colors: readonly Color[]): boolean => colors.includes('orange');
/** Tube Sort: one level per tier, then the fifth colour arrives from its sixth level. */
const difficulty = (index: number, colors: readonly Color[]): Difficulty => hasOrange(colors) ? 'Full spectrum' : difficulties[index] ?? 'Thinking ahead';
/** Conveyor banks begin with two easy levels, then one middle level, the harder layouts, and orange from the eighth. */
const conveyorDifficulty = (index: number, colors: readonly Color[]): Difficulty => hasOrange(colors) ? 'Full spectrum' : difficulties[index < 2 ? 0 : index < 3 ? 1 : 2] ?? 'Thinking ahead';

/**
 * Play order, per game. IDs carry no order: a save stores IDs, so a level can move or leave the campaign and progress stays
 * keyed to the same board. Every definition stays in its bank until the owner has played and confirmed what retires.
 */
export const PLAY_ORDER = {
  conveyor: ['board-1', 'board-31', 'board-32', 'board-40', 'board-41', 'board-42', 'board-43', 'board-44', 'board-17', 'board-46', 'board-2', 'board-47', 'board-48', 'board-49', 'board-50', 'board-51', 'board-52', 'board-53', 'board-54', 'board-55'],
  loop: ['loop-1', 'loop-2', 'loop-31', 'loop-41', 'loop-42', 'loop-43', 'loop-44', 'loop-45', 'loop-46', 'loop-48', 'loop-39', 'loop-47', 'loop-50', 'loop-51', 'loop-52', 'loop-53', 'loop-54', 'loop-55', 'loop-56', 'loop-57'],
  tube: ['tube-1', 'tube-31', 'tube-32', 'tube-38', 'tube-39', 'tube-40', 'tube-41', 'tube-42', 'tube-43', 'tube-44', 'tube-37', 'tube-46', 'tube-47', 'tube-48', 'tube-49', 'tube-50', 'tube-51', 'tube-52', 'tube-53', 'tube-54'],
} as const;
/**
 * Development only: `?try=<id>` adds a bank board that is not in the campaign yet after its game's last level and opens it,
 * so a new board or rule can be played from a link before it has a place.
 */
export const TRY_LEVEL = import.meta.env?.DEV && typeof location !== 'undefined' ? new URLSearchParams(location.search).get('try') : null;
const withTry = (ids: readonly string[], bank: readonly { readonly id: string }[]): readonly string[] =>
  TRY_LEVEL && !ids.includes(TRY_LEVEL) && bank.some((board) => board.id === TRY_LEVEL) ? [...ids, TRY_LEVEL] : ids;
const inOrder = <T extends { readonly id: string }>(bank: readonly T[], ids: readonly string[]): T[] => ids.map((id) => {
  const board = bank.find((candidate) => candidate.id === id);
  if (!board) throw new Error(`No board ${id}`);
  return board;
});

const conveyor: GameplayPack = {
  kind: 'conveyor', levels: inOrder(BOARDS, withTry(PLAY_ORDER.conveyor, BOARDS)).map((board, index) => ({
    id: board.id, kind: 'conveyor', name: GAME_NAMES.conveyor, get title() { return levelTitle(board.id, board.title); },
    difficulty: conveyorDifficulty(index, board.supplies.flat().map((tray) => tray.color)),
    get instructions() { return t('Tap a crate to pour it. Boxes fill as their color passes. Keep room on the belt.', 'Touchez une caisse pour la vider. Les boîtes prennent leur couleur au passage. Gardez de la place sur le tapis.'); },
    create: (services) => new ConveyorRuntime(board, services),
  })),
};
const loop: GameplayPack = {
  kind: 'loop', levels: inOrder(LOOP_BOARDS, withTry(PLAY_ORDER.loop, LOOP_BOARDS)).map((board, index) => ({
    id: board.id, kind: 'loop', name: GAME_NAMES.loop, get title() { return levelTitle(board.id, board.title); },
    difficulty: conveyorDifficulty(index, board.lanes.flat().flatMap((truck) => truck.segments.map((segment) => segment.color))),
    get instructions() { return t('Tap to pour. Trucks collect their open-end color. Fill each truck with the color marked on its cab.', 'Touchez un camion pour le vider. Il prend la couleur au bout de sa benne. Remplissez-le avec la couleur indiquée sur sa cabine.'); },
    create: (services) => new LoopRuntime(board, services),
  })),
};
const tube: GameplayPack = {
  kind: 'tube', levels: inOrder(TUBE_BOARDS, withTry(PLAY_ORDER.tube, TUBE_BOARDS)).map((board, index) => ({
    id: board.id, kind: 'tube', name: GAME_NAMES.tube, get title() { return levelTitle(board.id, board.title); }, difficulty: difficulty(index, board.tubes.flat()),
    get instructions() { return t('Drag a top group to an empty tube or matching color. Tapping two tubes works too.', 'Glissez un groupe du haut vers un tube vide ou la même couleur. Vous pouvez aussi toucher les deux tubes.'); },
    create: (services) => new TubeRuntime(board, services),
  })),
};
// Composition is the only place a gameplay pack is added. App never switches on kind.
export const CAMPAIGN = new CampaignRegistry().register(conveyor).register(loop).register(tube).levels();
