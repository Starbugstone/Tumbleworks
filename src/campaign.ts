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

const conveyor: GameplayPack = {
  kind: 'conveyor', levels: BOARDS.map((board, index) => ({
    id: board.id, kind: 'conveyor', name: GAME_NAMES.conveyor, get title() { return levelTitle(board.id, board.title); },
    difficulty: conveyorDifficulty(index, board.supplies.flat().map((tray) => tray.color)),
    get instructions() { return t('Tap a crate to pour it. Boxes fill as their color passes. Keep room on the belt.', 'Touchez une caisse pour la vider. Les boîtes prennent leur couleur au passage. Gardez de la place sur le tapis.'); },
    create: (services) => new ConveyorRuntime(board, services),
  })),
};
const loop: GameplayPack = {
  kind: 'loop', levels: LOOP_BOARDS.map((board, index) => ({
    id: board.id, kind: 'loop', name: GAME_NAMES.loop, get title() { return levelTitle(board.id, board.title); },
    difficulty: conveyorDifficulty(index, board.lanes.flat().flatMap((truck) => truck.segments.map((segment) => segment.color))),
    get instructions() { return t('Tap to pour. Trucks collect their open-end color. Fill each truck with the color marked on its cab.', 'Touchez un camion pour le vider. Il prend la couleur au bout de sa benne. Remplissez-le avec la couleur indiquée sur sa cabine.'); },
    create: (services) => new LoopRuntime(board, services),
  })),
};
const tube: GameplayPack = {
  kind: 'tube', levels: TUBE_BOARDS.map((board, index) => ({
    id: board.id, kind: 'tube', name: GAME_NAMES.tube, get title() { return levelTitle(board.id, board.title); }, difficulty: difficulty(index, board.tubes.flat()),
    get instructions() { return t('Drag a top group to an empty tube or matching color. Tapping two tubes works too.', 'Glissez un groupe du haut vers un tube vide ou la même couleur. Vous pouvez aussi toucher les deux tubes.'); },
    create: (services) => new TubeRuntime(board, services),
  })),
};
// Composition is the only place a gameplay pack is added. App never switches on kind.
export const CAMPAIGN = new CampaignRegistry().register(conveyor).register(loop).register(tube).levels();
