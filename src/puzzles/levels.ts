import type { Color } from '../sim/types';
import type { TrayDef, TrayPiece, TubeDef } from './types';

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

function trayPieces(bottom: readonly Color[], top: readonly Color[], rows: readonly number[]): TrayPiece[] {
  if (bottom.length !== rows.length * 4 || top.length !== rows.length * 2) throw new Error('Tray template dimensions differ');
  const columns = [-2.7, -0.9, 0.9, 2.7];
  return [
    ...bottom.map((color, id) => ({
      id, color, x: columns[id % 4] ?? 0, z: rows[Math.floor(id / 4)] ?? 0,
      layer: 0, blockedBy: [bottom.length + Math.floor(id / 2)],
    })),
    ...top.map((color, index) => ({
      id: bottom.length + index, color, x: index % 2 === 0 ? -1.8 : 1.8,
      z: rows[Math.floor(index / 2)] ?? 0, layer: 1, blockedBy: [],
    })),
  ];
}

export const TRAY_BOARDS: readonly TrayDef[] = [
  {
    kind: 'tray', id: 'tray-1', title: 'Three’s company', rackCapacity: 7,
    pieces: trayPieces(
      ['red', 'red', 'blue', 'blue', 'green', 'green', 'yellow', 'yellow'],
      ['red', 'blue', 'green', 'yellow'], [-1.5, 1.5],
    ),
    solution: [8, 0, 1, 9, 2, 3, 10, 4, 5, 11, 6, 7],
  },
  {
    kind: 'tray', id: 'tray-2', title: 'Under the surface', rackCapacity: 7,
    pieces: trayPieces(
      ['blue', 'red', 'green', 'blue', 'yellow', 'green', 'red', 'yellow', 'blue', 'red', 'blue', 'red'],
      ['red', 'blue', 'green', 'yellow', 'red', 'blue'], [-2.5, 0, 2.5],
    ),
    solution: [12, 1, 16, 0, 8, 13, 2, 14, 5, 3, 17, 10, 4, 15, 7, 6, 9, 11],
  },
  {
    kind: 'tray', id: 'tray-3', title: 'Tangled layers', rackCapacity: 7,
    pieces: trayPieces(
      ['blue', 'green', 'yellow', 'red', 'yellow', 'red', 'blue', 'green',
        'green', 'red', 'yellow', 'blue', 'red', 'blue', 'green', 'yellow'],
      ['red', 'red', 'blue', 'blue', 'green', 'green', 'yellow', 'yellow'], [-3.6, -1.2, 1.2, 3.6],
    ),
    solution: [16, 17, 3, 0, 18, 19, 1, 7, 20, 2, 4, 22, 5, 9, 12, 6, 13, 8, 21, 11, 10, 23, 14, 15],
  },
];
