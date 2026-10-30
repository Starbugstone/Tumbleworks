import { CampaignRegistry, type Difficulty, type GameplayPack } from './engine/contracts';
import { ConveyorRuntime } from './gameplays/conveyor';
import { TubeRuntime } from './gameplays/tube';
import { TrayRuntime } from './gameplays/tray';
import { TUBE_BOARDS, TRAY_BOARDS } from './puzzles/levels';
import { isCompleted } from './progress';
import { BOARDS } from './sim/boards';

const difficulties: readonly Difficulty[] = ['Getting started', 'Finding a rhythm', 'Thinking ahead'];
const difficulty = (index: number): Difficulty => difficulties[index] ?? 'Thinking ahead';

const conveyor: GameplayPack = {
  kind: 'conveyor', levels: BOARDS.map((board, index) => ({
    id: board.id, kind: 'conveyor', name: 'Conveyor sort',
    title: ['Make room', 'A color ahead', 'The long way round'][index] ?? board.title,
    difficulty: difficulty(index),
    instructions: 'Tip a tray. Fill the boxes in order. Keep room on the belt.',
    create: (services) => new ConveyorRuntime(board, services, index === 0 && !isCompleted(board.id)),
  })),
};
const tube: GameplayPack = {
  kind: 'tube', levels: TUBE_BOARDS.map((board, index) => ({
    id: board.id, kind: 'tube', name: 'Tube sort', title: board.title, difficulty: difficulty(index),
    instructions: 'Choose a tube, then an empty tube or a matching top color.',
    create: (services) => new TubeRuntime(board, services),
  })),
};
const tray: GameplayPack = {
  kind: 'tray', levels: TRAY_BOARDS.map((board, index) => ({
    id: board.id, kind: 'tray', name: 'Tray match', title: board.title, difficulty: difficulty(index),
    instructions: 'Pick exposed marbles. Three of a color clear. Keep the rack open.',
    create: (services) => new TrayRuntime(board, services),
  })),
};

// Composition is the only place a new gameplay pack is added. App never switches on kind.
export const CAMPAIGN = new CampaignRegistry().register(conveyor).register(tube).register(tray).levels();
