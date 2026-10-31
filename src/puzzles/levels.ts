import type { TubeDef } from './types';

export const TUBE_BOARDS: readonly TubeDef[] = [
  {
    kind: 'tube', id: 'tube-1', title: 'A little room', capacity: 4,
    tubes: [
      ['red', 'red', 'blue', 'blue'],
      ['blue', 'blue', 'green', 'green'],
      ['green', 'green', 'red', 'red'], [], [],
    ],
    solution: [
      { from: 0, to: 3 }, { from: 2, to: 0 }, { from: 1, to: 2 }, { from: 1, to: 3 },
    ],
  },
  {
    kind: 'tube', id: 'tube-2', title: 'Crossed currents', capacity: 4,
    tubes: [
      ['red', 'red', 'blue', 'green'],
      ['blue', 'blue', 'green', 'yellow'],
      ['green', 'green', 'yellow', 'red'],
      ['yellow', 'yellow', 'red', 'blue'], [], [],
    ],
    solution: [
      { from: 0, to: 4 }, { from: 3, to: 0 }, { from: 2, to: 3 }, { from: 1, to: 2 },
      { from: 1, to: 4 }, { from: 0, to: 1 }, { from: 3, to: 0 }, { from: 2, to: 3 },
      { from: 2, to: 4 },
    ],
  },
  {
    kind: 'tube', id: 'tube-3', title: 'One spare', capacity: 4,
    tubes: [
      ['red', 'green', 'yellow', 'green'],
      ['green', 'red', 'yellow', 'blue'],
      ['yellow', 'blue', 'blue', 'red'],
      ['yellow', 'red', 'blue', 'green'], [],
    ],
    solution: [
      { from: 0, to: 4 }, { from: 3, to: 4 }, { from: 1, to: 3 }, { from: 0, to: 1 },
      { from: 4, to: 0 }, { from: 3, to: 4 }, { from: 2, to: 3 }, { from: 2, to: 4 },
      { from: 1, to: 2 }, { from: 1, to: 3 }, { from: 0, to: 1 }, { from: 3, to: 0 },
      { from: 2, to: 3 },
    ],
  },
];
