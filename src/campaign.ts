import { CampaignRegistry, type Difficulty, type GameplayPack } from './engine/contracts';
import { ConveyorRuntime } from './gameplays/conveyor';
import { LoopRuntime } from './gameplays/loop';
import { LOOP_BOARDS } from './loop/boards';
import { TubeRuntime } from './gameplays/tube';
import { TrayRuntime } from './gameplays/tray';
import { ConnectRuntime } from './gameplays/connect';
import { CONNECT_BOARDS } from './puzzles/connect-levels';
import { GAME_NAMES } from './gameplays/names';
import { TUBE_BOARDS, TRAY_BOARDS } from './puzzles/levels';
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
    instructions: 'Trucks take their loop-end color as it passes. Tap a truck to pour that color out and reach the next.',
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
const tray: GameplayPack = {
  kind: 'tray', levels: TRAY_BOARDS.map((board, index) => ({
    id: board.id, kind: 'tray', name: GAME_NAMES.tray, title: board.title, difficulty: difficulty(index),
    instructions: 'Pick exposed marbles. Three matching colors clear. Keep room in the rack.',
    create: (services) => new TrayRuntime(board, services),
  })),
};

// Composition is the only place a new gameplay pack is added. App never switches on kind.
const connect: GameplayPack = {
  kind: 'connect', levels: CONNECT_BOARDS.map((board, index) => ({
    id: board.id, kind: 'connect', name: GAME_NAMES.connect, title: board.title, difficulty: difficulty(index),
    instructions: 'Tap 3+ touching marbles of one color. Clear the board within the move limit.',
    create: (services) => new ConnectRuntime(board, services),
  })),
};
export const CAMPAIGN = new CampaignRegistry().register(conveyor).register(loop).register(tube).register(tray).register(connect).levels();
