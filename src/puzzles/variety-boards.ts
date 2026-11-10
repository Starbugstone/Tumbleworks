import type { TubeDef } from './types';

/**
 * Finishing red opens the capped spare on its own move; the cup folds shut on a later one. No reachable move does both,
 * because the player read the old simultaneous exchange as "emptying the cup opens the cap".
 */
export const TUBE_210: TubeDef = {
  kind: 'tube', id: 'tube-210', title: 'A cup you can spend', capacity: 4,
  tubes: [
    ['red', 'red', 'green', 'blue'],
    ['green', 'blue', 'green', 'blue'],
    ['blue', 'green', 'red', 'red'], [], [],
  ],
  containers: [
    { role: 'ordinary', capacity: 4 }, { role: 'ordinary', capacity: 4 },
    { role: 'ordinary', capacity: 4 }, { role: 'cup', capacity: 2 },
    { role: 'capped', capacity: 4, opensOn: 'red' },
  ],
  solution: [
    { from: 0, to: 3 }, { from: 1, to: 3 }, { from: 0, to: 1 }, { from: 2, to: 0 }, { from: 1, to: 2 },
    { from: 1, to: 4 }, { from: 2, to: 1 }, { from: 2, to: 4 }, { from: 3, to: 4 },
  ],
};

/** Red needs all six places; shorter homes remain interchangeable for blue and green. */
export const TUBE_211: TubeDef = {
  kind: 'tube', id: 'tube-211', title: 'A home for six', capacity: 4,
  colorCapacities: { red: 6 },
  tubes: [
    ['red', 'red', 'blue', 'green', 'red', 'blue'],
    ['green', 'red', 'blue', 'red'],
    ['blue', 'green', 'green', 'red'], [],
  ],
  containers: [
    { role: 'ordinary', capacity: 6 }, { role: 'ordinary', capacity: 4 },
    { role: 'ordinary', capacity: 4 }, { role: 'ordinary', capacity: 4 },
  ],
  solution: [
    { from: 1, to: 3 }, { from: 0, to: 1 }, { from: 0, to: 3 }, { from: 2, to: 3 },
    { from: 0, to: 2 }, { from: 1, to: 0 }, { from: 1, to: 3 }, { from: 2, to: 1 },
    { from: 0, to: 2 }, { from: 3, to: 0 },
  ],
};

export const TUBE_VARIETY_BOARDS: readonly TubeDef[] = [TUBE_210, TUBE_211];
