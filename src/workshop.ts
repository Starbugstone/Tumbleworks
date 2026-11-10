import type { GameLevel } from './engine/contracts';
import { ConveyorRuntime } from './gameplays/conveyor';
import { LoopRuntime } from './gameplays/loop';
import { TubeRuntime } from './gameplays/tube';
import { GAME_NAMES } from './gameplays/names';
import { t } from './i18n';
import { FUNNEL_VARIETY_BOARDS } from './sim/variety-boards';
import { LOOP_VARIETY_BOARDS } from './loop/variety-boards';
import { TUBE_VARIETY_BOARDS } from './puzzles/variety-boards';
import { attachProjectGuide } from './world/workshop-guides';

type Wording = readonly [englishTitle: string, frenchTitle: string, englishInstructions: string, frenchInstructions: string];
const WORDING: Readonly<Record<string, Wording>> = {
  'board-210': ['Choose a shelf', 'Choisir une étagère', 'Short crates hold six; full crates hold nine. A padlocked crate opens once every crate its straps reach has been tipped.', 'Les petites caisses contiennent six billes, les grandes neuf. Une caisse cadenassée s’ouvre quand toutes les caisses au bout de ses sangles sont vidées.'],
  'board-211': ['Prepare for the pair', 'Préparer la paire', 'The handle releases two crates together. Fill the marked prerequisite box to open the shutter.', 'La poignée libère deux caisses ensemble. Remplissez la boîte indiquée pour ouvrir le volet.'],
  'board-212': ['Leave together', 'Partir ensemble', 'Two boxes share a pallet. Fill both before either next box can receive marbles.', 'Deux boîtes partagent une palette. Remplissez les deux avant que les suivantes puissent recevoir des billes.'],
  'loop-210': ['Small truck, big unlock', 'Petit camion, grande ouverture', 'Finish the short truck to open the matching latch. A latched truck can still receive marbles.', 'Terminez le petit camion pour ouvrir le verrou correspondant. Un camion verrouillé reçoit toujours les billes.'],
  'loop-211': ['One tap, unequal loads', 'Un geste, deux charges', 'The linked trucks pour together. Their beds hold different amounts; both need room on the loop.', 'Les camions reliés se vident ensemble. Leurs bennes sont de tailles différentes ; gardez de la place sur la boucle.'],
  'tube-210': ['A cup you can spend', 'Un gobelet à usage unique', 'Finish the ring-marked home to open the capped spare. Emptying the ribbed cup folds it shut for good.', 'Terminez le tube marqué d’un anneau pour ouvrir la réserve bouchée. Vider le gobelet nervuré le replie définitivement.'],
  'tube-211': ['A home for six', 'Un tube pour six', 'Keep each colour together. Six red marbles need the tall home with the ring-marked rail; the other colours fill four places.', 'Gardez chaque couleur ensemble. Les six billes rouges ont besoin du grand tube au rail marqué d’un anneau ; les autres couleurs remplissent quatre places.'],
};

function wording(id: string) {
  const text = WORDING[id];
  if (!text) throw new Error(`Missing Workshop wording for ${id}`);
  return {
    get title() { return t(text[0], text[1]); },
    get instructions() { return t(text[2], text[3]); },
  };
}

/** Stable IDs and normal runtimes; navigation and completion belong to the Workshop source. */
export const WORKSHOP_LEVELS: readonly GameLevel[] = [
  ...FUNNEL_VARIETY_BOARDS.map((board): GameLevel => ({
    id: board.id, kind: 'conveyor', name: GAME_NAMES.conveyor, difficulty: 'Thinking ahead',
    get title() { return wording(board.id).title; }, get instructions() { return wording(board.id).instructions; },
    create: (services) => attachProjectGuide(new ConveyorRuntime(board, services), board.id, () => wording(board.id).instructions),
  })),
  ...LOOP_VARIETY_BOARDS.map((board): GameLevel => ({
    id: board.id, kind: 'loop', name: GAME_NAMES.loop, difficulty: 'Thinking ahead',
    get title() { return wording(board.id).title; }, get instructions() { return wording(board.id).instructions; },
    create: (services) => attachProjectGuide(new LoopRuntime(board, services), board.id, () => wording(board.id).instructions),
  })),
  ...TUBE_VARIETY_BOARDS.map((board): GameLevel => ({
    id: board.id, kind: 'tube', name: GAME_NAMES.tube, difficulty: 'Thinking ahead',
    get title() { return wording(board.id).title; }, get instructions() { return wording(board.id).instructions; },
    create: (services) => attachProjectGuide(new TubeRuntime(board, services), board.id, () => wording(board.id).instructions),
  })),
];
