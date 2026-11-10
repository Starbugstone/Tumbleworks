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
/** Tube Sort tiers follow campaign position until orange in the board content marks Full spectrum. */
const difficulty = (index: number, colors: readonly Color[]): Difficulty => hasOrange(colors) ? 'Full spectrum' : difficulties[index] ?? 'Thinking ahead';
/** Conveyor games begin with two easy levels and one middle level; orange in the content overrides the tier. */
const conveyorDifficulty = (index: number, colors: readonly Color[]): Difficulty => hasOrange(colors) ? 'Full spectrum' : difficulties[index < 2 ? 0 : index < 3 ? 1 : 2] ?? 'Thinking ahead';

/**
 * Play order, per game. IDs carry no order: a save stores IDs, so a level can move or leave the campaign and progress stays
 * keyed to the same board. Currently 60 rounds (180 levels), toward the 120-round target. Every definition stays in its
 * bank until the owner has played and confirmed what retires.
 */
export const PLAY_ORDER = {
  conveyor: ['board-1', 'board-31', 'board-32', 'board-40', 'board-41', 'board-42', 'board-43', 'board-44', 'board-17', 'board-46', 'board-2', 'board-47', 'board-48', 'board-49', 'board-50', 'board-51', 'board-52', 'board-53', 'board-54', 'board-55', 'board-56', 'board-57', 'board-58', 'board-59', 'board-60', 'board-61', 'board-62', 'board-63', 'board-64', 'board-65', 'board-66', 'board-67', 'board-68', 'board-69', 'board-70', 'board-71', 'board-72', 'board-73', 'board-74', 'board-75', 'board-200', 'board-79', 'board-76', 'board-80', 'board-81', 'board-77', 'board-82', 'board-83', 'board-84', 'board-85', 'board-86', 'board-87', 'board-88', 'board-89', 'board-90', 'board-91', 'board-201', 'board-92', 'board-78', 'board-93'],
  loop: ['loop-1', 'loop-2', 'loop-31', 'loop-41', 'loop-42', 'loop-43', 'loop-44', 'loop-45', 'loop-46', 'loop-48', 'loop-39', 'loop-47', 'loop-50', 'loop-51', 'loop-52', 'loop-53', 'loop-54', 'loop-55', 'loop-56', 'loop-57', 'loop-58', 'loop-59', 'loop-60', 'loop-61', 'loop-62', 'loop-63', 'loop-64', 'loop-65', 'loop-66', 'loop-67', 'loop-68', 'loop-69', 'loop-70', 'loop-71', 'loop-72', 'loop-73', 'loop-74', 'loop-75', 'loop-76', 'loop-77', 'loop-78', 'loop-79', 'loop-200', 'loop-80', 'loop-81', 'loop-82', 'loop-83', 'loop-84', 'loop-85', 'loop-86', 'loop-87', 'loop-88', 'loop-89', 'loop-90', 'loop-91', 'loop-92', 'loop-93', 'loop-94', 'loop-95', 'loop-96'],
  tube: ['tube-1', 'tube-31', 'tube-32', 'tube-38', 'tube-39', 'tube-40', 'tube-41', 'tube-42', 'tube-43', 'tube-44', 'tube-37', 'tube-46', 'tube-47', 'tube-48', 'tube-49', 'tube-50', 'tube-51', 'tube-52', 'tube-53', 'tube-54', 'tube-55', 'tube-56', 'tube-57', 'tube-58', 'tube-59', 'tube-60', 'tube-61', 'tube-62', 'tube-63', 'tube-64', 'tube-65', 'tube-66', 'tube-67', 'tube-68', 'tube-69', 'tube-70', 'tube-71', 'tube-72', 'tube-73', 'tube-74', 'tube-75', 'tube-76', 'tube-77', 'tube-78', 'tube-200', 'tube-79', 'tube-80', 'tube-81', 'tube-82', 'tube-83', 'tube-84', 'tube-85', 'tube-86', 'tube-87', 'tube-88', 'tube-89', 'tube-90', 'tube-91', 'tube-92', 'tube-93'],
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
