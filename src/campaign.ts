import { CampaignRegistry, type Difficulty, type GameplayPack } from './engine/contracts';
import { ConveyorRuntime } from './gameplays/conveyor';
import { LoopRuntime } from './gameplays/loop';
import { LOOP_BOARDS } from './loop/boards';
import { TubeRuntime } from './gameplays/tube';
import { GAME_NAMES } from './gameplays/names';
import { TUBE_BOARDS } from './puzzles/levels';
import { BOARDS } from './sim/boards';

const difficulties: readonly Difficulty[] = ['Getting started', 'Finding a rhythm', 'Thinking ahead'];
const difficulty = (index: number): Difficulty => difficulties[index] ?? 'Thinking ahead';
/** Five-level banks spread the same three labels: two easy, one middle, two hard. */
const difficultyOfFive = (index: number): Difficulty => difficulties[index < 2 ? 0 : index < 3 ? 1 : 2] ?? 'Thinking ahead';

const conveyor: GameplayPack = {
  kind: 'conveyor', levels: BOARDS.map((board, index) => ({
    id: board.id, kind: 'conveyor', name: GAME_NAMES.conveyor, title: board.title,
    difficulty: difficultyOfFive(index),
    instructions: 'Tap a crate to pour it. Boxes fill as their color passes. Keep room on the belt.',
    create: (services) => new ConveyorRuntime(board, services),
  })),
};
const loop: GameplayPack = {
  kind: 'loop', levels: LOOP_BOARDS.map((board, index) => ({
    id: board.id, kind: 'loop', name: GAME_NAMES.loop, title: board.title,
    difficulty: difficultyOfFive(index),
    instructions: 'Tap to pour. Trucks collect their open-end color. Fill each truck with the color marked on its cab.',
    create: (services) => new LoopRuntime(board, services),
  })),
};
const tube: GameplayPack = {
  kind: 'tube', levels: TUBE_BOARDS.map((board, index) => ({
    id: board.id, kind: 'tube', name: GAME_NAMES.tube, title: board.title, difficulty: difficulty(index),
    instructions: 'Drag a top group to an empty tube or matching color. Tapping two tubes works too.',
    create: (services) => new TubeRuntime(board, services),
  })),
};
// Composition is the only place a gameplay pack is added. App never switches on kind.
export const CAMPAIGN = new CampaignRegistry().register(conveyor).register(loop).register(tube).levels();
