import type { BoardDef, Color, Packet } from './types';

/** Funnel Sort: a tray is a 3×3 block of nine; each tray fills three boxes of three. */
export const TRAY_COUNT = 9;
export const BOX_SIZE = 3;
const trays = (...colors: Color[]): Packet[] => colors.map((color) => ({ color, count: TRAY_COUNT }));
/** Boxes in the order the player meets them, dealt round-robin into dock columns (top first). */
const docks = (count: number, ...order: Color[]): Color[][] =>
  Array.from({ length: count }, (_, dock) => order.filter((_, index) => index % count === dock));
const board = (id: string, title: string, beltCapacity: number, supplies: Packet[][], dockColumns: Color[][]): BoardDef =>
  ({ id, title, beltCapacity, boxSize: BOX_SIZE, supplies, docks: dockColumns });

/** Red is wanted first but sits behind blue. Only A-A-B wins; green early fills the belt with two unwanted colours. */
export const BOARD_1 = board('board-1', 'Make room', 15,
  [trays('blue', 'red'), trays('green')],
  docks(3, 'red', 'red', 'red', 'blue', 'blue', 'blue', 'green', 'green', 'green'));
/** Three columns, five trays; each dock column asks for its own order. */
export const BOARD_2 = board('board-2', 'A color ahead', 18,
  [trays('yellow', 'red'), trays('blue', 'yellow'), trays('green')],
  docks(3, 'red', 'red', 'red', 'yellow', 'blue', 'blue', 'green', 'yellow', 'blue', 'yellow', 'green', 'yellow', 'yellow', 'green', 'yellow'));
/** Seven trays and four docks; every column hides a colour the docks want behind one they do not. */
export const BOARD_3 = board('board-3', 'Behind the lines', 18,
  [trays('green', 'red', 'yellow'), trays('red', 'blue'), trays('blue', 'yellow')],
  docks(4, 'red', 'red', 'blue', 'yellow', 'green', 'red', 'blue', 'yellow', 'red', 'blue', 'yellow', 'blue', 'red', 'yellow', 'blue', 'green', 'yellow', 'red', 'blue', 'yellow', 'green'));
/** Nine trays; the belt takes two wrong colours, never three. */
export const BOARD_4 = board('board-4', 'Two wrongs', 18,
  [trays('yellow', 'green', 'red'), trays('red', 'yellow', 'blue'), trays('blue', 'green', 'red')],
  docks(4, 'red', 'red', 'red', 'yellow', 'green', 'blue', 'red', 'yellow', 'green', 'blue', 'red', 'yellow', 'green', 'blue', 'red', 'yellow', 'green', 'blue', 'red', 'yellow', 'green', 'blue', 'red', 'yellow', 'green', 'blue', 'red'));
/** Twelve trays, four columns, four docks: a long flowing level with real traps. */
export const BOARD_5 = board('board-5', 'The long way round', 18,
  [trays('green', 'red', 'yellow'), trays('blue', 'green', 'red'), trays('yellow', 'blue', 'green'), trays('red', 'yellow', 'blue')],
  docks(4, 'red', 'red', 'blue', 'blue', 'yellow', 'red', 'green', 'blue', 'yellow', 'green', 'red', 'yellow', 'blue', 'green', 'red', 'yellow', 'green', 'blue', 'yellow', 'red', 'green', 'blue', 'red', 'yellow', 'green', 'blue', 'yellow', 'red', 'green', 'blue', 'yellow', 'red', 'green', 'blue', 'yellow', 'green'));

export const BOARDS: readonly BoardDef[] = [BOARD_1, BOARD_2, BOARD_3, BOARD_4, BOARD_5];
