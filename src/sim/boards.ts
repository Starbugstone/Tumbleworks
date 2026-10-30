import type { BoardDef, Color, Packet } from './types';

const packets = (...colors: Color[]): Packet[] => colors.map((color) => ({ color, count: 6 }));
/** Each packet of 6 fills two boxes of 3. */
const boxes = (...colors: Color[]): Color[] => colors.flatMap((color) => [color, color]);

export const BOARD_1: BoardDef = {
  id: 'board-1',
  title: 'Level 1',
  beltCapacity: 12,
  boxSize: 3,
  supplies: [packets('blue', 'red'), packets('green')],
  boxes: boxes('red', 'blue', 'green'),
};

export const BOARD_2: BoardDef = {
  id: 'board-2',
  title: 'Level 2',
  beltCapacity: 12,
  boxSize: 3,
  supplies: [packets('red', 'blue'), packets('yellow', 'red'), packets('green')],
  boxes: boxes('red', 'yellow', 'blue', 'red', 'green'),
};

export const BOARD_3: BoardDef = {
  id: 'board-3',
  title: 'Level 3',
  beltCapacity: 12,
  boxSize: 3,
  supplies: [packets('blue', 'red', 'yellow'), packets('green', 'blue'), packets('yellow', 'red')],
  boxes: boxes('red', 'blue', 'yellow', 'green', 'red', 'blue', 'yellow'),
};

export const BOARDS: readonly BoardDef[] = [BOARD_1, BOARD_2, BOARD_3];
