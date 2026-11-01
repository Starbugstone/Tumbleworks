import type { BoardDef, Color, Packet } from './types';

/** Funnel Sort: a tray is a 3×3 block of nine; each tray fills three boxes of three. */
export const TRAY_COUNT = 9;
export const BOX_SIZE = 3;
const trays = (...colors: Color[]): Packet[] => colors.map((color) => ({ color, count: TRAY_COUNT }));
/** A short tray: six marbles, two boxes' worth, so a pour is cheaper but a dock still needs three boxes. */
export const SHORT_TRAY = 6;
const tray = (color: Color, count = TRAY_COUNT): Packet => ({ color, count });
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
export const BOARD_3: BoardDef = board('board-3', 'Behind the lines', 18,
  [trays('red', 'blue', 'green'), trays('blue', 'red'), trays('yellow', 'yellow')],
  docks(4, 'red', 'green', 'green', 'yellow', 'blue', 'green', 'yellow', 'blue', 'red', 'yellow', 'blue', 'blue', 'blue', 'red', 'red', 'yellow', 'yellow', 'red', 'blue', 'red', 'yellow'));
/** Nine trays; the belt forgives one wrong tray, never two. */
export const BOARD_4: BoardDef = board('board-4', 'Two wrongs', 17,
  [trays('blue', 'blue', 'yellow'), trays('red', 'red', 'green'), trays('green', 'red', 'yellow')],
  docks(4, 'green', 'yellow', 'red', 'green', 'yellow', 'red', 'blue', 'blue', 'blue', 'blue', 'red', 'red', 'green', 'green', 'yellow', 'green', 'red', 'blue', 'red', 'yellow', 'red', 'yellow', 'red', 'green', 'yellow', 'red', 'blue'));
/** Twelve trays, four columns, four docks: a long flowing level with real traps. */
export const BOARD_5: BoardDef = board('board-5', 'The long way round', 17,
  [trays('green', 'red', 'blue'), trays('red', 'green', 'blue'), trays('red', 'yellow', 'blue'), trays('blue', 'green', 'red')],
  docks(4, 'red', 'red', 'red', 'green', 'green', 'blue', 'red', 'blue', 'green', 'blue', 'blue', 'red', 'yellow', 'red', 'green', 'blue', 'blue', 'blue', 'blue', 'blue', 'green', 'blue', 'red', 'green', 'blue', 'blue', 'red', 'green', 'red', 'yellow', 'green', 'red', 'red', 'yellow', 'red', 'green'));
/** The first figure eight: five trays, three docks, and a belt that is longer than it looks. */
export const BOARD_6: BoardDef = { ...board('board-6', 'First bridge', 21,
  [trays('red', 'red'), trays('yellow', 'green'), trays('blue')],
  docks(3, 'green', 'red', 'green', 'red', 'blue', 'red', 'blue', 'red', 'yellow', 'red', 'yellow', 'blue', 'red', 'green', 'yellow')), trackShape: 'eight' };
/** Seven trays over the wide crossing. */
export const BOARD_7: BoardDef = { ...board('board-7', 'The wide crossing', 21,
  [trays('red', 'red', 'yellow'), trays('green', 'red'), trays('green', 'blue')],
  docks(4, 'yellow', 'red', 'blue', 'green', 'red', 'yellow', 'red', 'blue', 'red', 'blue', 'red', 'green', 'green', 'green', 'red', 'green', 'yellow', 'red', 'green', 'red', 'red')), trackShape: 'wide-eight' };
/** Orange arrives: five colours, three columns, eight trays, four docks. */
export const BOARD_8: BoardDef = board('board-8', 'Orange arrives', 17,
  [trays('orange', 'blue', 'yellow'), trays('blue', 'red', 'green'), trays('green', 'red')],
  docks(4, 'orange', 'blue', 'green', 'red', 'yellow', 'yellow', 'blue', 'green', 'green', 'red', 'green', 'blue', 'blue', 'orange', 'red', 'yellow', 'orange', 'red', 'blue', 'blue', 'green', 'green', 'red', 'red'));
/** Short trays of six mix with full trays: a cheap pour is tempting, but every dock still wants three boxes. */
export const BOARD_9: BoardDef = board('board-9', 'Short pours', 15,
  [trays('green', 'red', 'blue'), [tray('blue', SHORT_TRAY), tray('red', SHORT_TRAY), tray('red')], [tray('red', SHORT_TRAY), tray('yellow')], [tray('yellow'), tray('yellow', SHORT_TRAY), tray('orange', SHORT_TRAY)]],
  docks(4, 'red', 'yellow', 'red', 'yellow', 'blue', 'yellow', 'orange', 'blue', 'red', 'yellow', 'green', 'red', 'yellow', 'yellow', 'blue', 'blue', 'red', 'red', 'blue', 'green', 'red', 'yellow', 'red', 'orange', 'green', 'red', 'red', 'yellow'));
/** Five colours over the bridge: nine trays on a tight belt. */
export const BOARD_10: BoardDef = { ...board('board-10', 'Five in the eight', 19,
  [trays('red', 'green', 'orange'), trays('blue', 'orange', 'red'), trays('blue', 'yellow', 'green')],
  docks(4, 'orange', 'blue', 'orange', 'green', 'green', 'orange', 'orange', 'red', 'yellow', 'green', 'green', 'green', 'red', 'red', 'blue', 'red', 'green', 'blue', 'blue', 'yellow', 'orange', 'orange', 'red', 'blue', 'yellow', 'red', 'blue')), trackShape: 'eight' };
/** Twelve trays, five colours and the wide crossing. */
export const BOARD_11: BoardDef = { ...board('board-11', 'The grand tour', 21,
  [trays('green', 'orange', 'green'), trays('blue', 'blue', 'red'), trays('blue', 'red', 'orange'), trays('green', 'blue', 'yellow')],
  docks(4, 'red', 'blue', 'yellow', 'orange', 'yellow', 'green', 'red', 'blue', 'green', 'red', 'green', 'blue', 'red', 'blue', 'blue', 'green', 'blue', 'blue', 'red', 'orange', 'green', 'blue', 'orange', 'blue', 'blue', 'green', 'orange', 'blue', 'orange', 'green', 'yellow', 'blue', 'red', 'green', 'green', 'orange')), trackShape: 'wide-eight' };
/** Five colours from only two columns: every pour is a commitment three trays deep. */
export const BOARD_12: BoardDef = board('board-12', 'Two tall stacks', 15,
  [trays('red', 'red', 'yellow'), trays('orange', 'blue', 'green')],
  docks(4, 'red', 'orange', 'blue', 'blue', 'yellow', 'red', 'red', 'green', 'green', 'yellow', 'orange', 'yellow', 'red', 'orange', 'red', 'red', 'blue', 'green'));
/** Four colours and a belt with no slack: one wrong tray is one too many. */
export const BOARD_13: BoardDef = board('board-13', 'Tight belt', 14,
  [trays('blue', 'yellow'), trays('red', 'green'), trays('red', 'red')],
  docks(3, 'green', 'blue', 'red', 'blue', 'red', 'red', 'red', 'yellow', 'green', 'red', 'red', 'yellow', 'yellow', 'green', 'red', 'red', 'blue', 'red'));
/** Columns of one, two and three trays; the short columns run out while the long ones are still blocking. */
export const BOARD_14: BoardDef = board('board-14', 'Uneven stacks', 16,
  [trays('red', 'red', 'green'), trays('green'), trays('blue', 'orange'), trays('yellow', 'blue', 'green')],
  docks(4, 'green', 'green', 'yellow', 'red', 'green', 'green', 'green', 'green', 'blue', 'yellow', 'blue', 'green', 'orange', 'blue', 'green', 'blue', 'red', 'red', 'red', 'orange', 'green', 'red', 'blue', 'blue', 'orange', 'yellow', 'red'));
/** Half the trays are short: four columns of two, cheap pours, and docks that still want three boxes. */
export const BOARD_15: BoardDef = board('board-15', 'Short and sweet', 15,
  [[tray('blue'), tray('red', SHORT_TRAY)], trays('yellow', 'green'), [tray('yellow', SHORT_TRAY), tray('green', SHORT_TRAY)], [tray('blue'), tray('red', SHORT_TRAY)]],
  docks(3, 'green', 'yellow', 'green', 'blue', 'yellow', 'yellow', 'red', 'red', 'blue', 'green', 'red', 'yellow', 'red', 'green', 'blue', 'yellow', 'blue', 'green', 'blue', 'blue'));
/** Over the bridge with three short trays in the mix. */
export const BOARD_16: BoardDef = { ...board('board-16', 'Short crossing', 19,
  [trays('green', 'orange', 'yellow'), [tray('orange'), tray('red', SHORT_TRAY)], [tray('red'), tray('blue', SHORT_TRAY), tray('blue', SHORT_TRAY)]],
  docks(4, 'yellow', 'green', 'orange', 'orange', 'orange', 'blue', 'yellow', 'yellow', 'blue', 'red', 'blue', 'red', 'orange', 'orange', 'red', 'red', 'green', 'blue', 'orange', 'red', 'green')), trackShape: 'eight' };
/** Three columns, three docks and no belt to spare: the tightest Funnel Sort board. */
export const BOARD_17: BoardDef = board('board-17', 'Narrow neck', 14,
  [trays('green', 'blue'), trays('orange', 'red'), trays('red', 'yellow')],
  docks(3, 'yellow', 'yellow', 'blue', 'green', 'yellow', 'red', 'green', 'green', 'blue', 'orange', 'orange', 'red', 'blue', 'orange', 'red', 'red', 'red', 'red'));
/** The wide crossing with a belt that holds very little. */
export const BOARD_18: BoardDef = { ...board('board-18', 'Wide and tight', 18,
  [trays('green', 'orange', 'red'), trays('blue', 'orange', 'orange'), trays('red', 'green', 'yellow')],
  docks(4, 'red', 'red', 'orange', 'blue', 'orange', 'orange', 'yellow', 'orange', 'red', 'red', 'orange', 'blue', 'green', 'green', 'green', 'yellow', 'orange', 'green', 'yellow', 'orange', 'red', 'orange', 'orange', 'green', 'red', 'green', 'blue')), trackShape: 'wide-eight' };
/** Four colours, four columns of three. */
export const BOARD_19: BoardDef = board('board-19', 'Three by four', 16,
  [trays('green', 'red', 'blue'), trays('red', 'green', 'blue'), trays('red', 'yellow', 'blue'), trays('blue', 'green', 'red')],
  docks(4, 'red', 'red', 'red', 'green', 'green', 'blue', 'red', 'blue', 'green', 'blue', 'blue', 'red', 'yellow', 'red', 'green', 'blue', 'blue', 'blue', 'blue', 'blue', 'green', 'blue', 'red', 'green', 'blue', 'blue', 'red', 'green', 'red', 'yellow', 'green', 'red', 'red', 'yellow', 'red', 'green'));
/** Four short trays among ten, over the wide crossing. */
export const BOARD_20: BoardDef = { ...board('board-20', 'Mixed measures', 21,
  [[tray('blue', SHORT_TRAY), tray('red')], [tray('green', SHORT_TRAY), tray('green', SHORT_TRAY), tray('orange')], trays('red', 'blue'), [tray('green'), tray('green', SHORT_TRAY), tray('yellow')]],
  docks(4, 'red', 'red', 'green', 'yellow', 'blue', 'orange', 'red', 'blue', 'orange', 'yellow', 'blue', 'blue', 'red', 'green', 'red', 'green', 'green', 'red', 'green', 'green', 'orange', 'green', 'green', 'yellow', 'green', 'blue')), trackShape: 'wide-eight' };
/** Four colours, nine trays: each colour comes in pairs that must not meet on the belt. */
export const BOARD_21: BoardDef = board('board-21', 'Colour pairs', 15,
  [trays('yellow', 'red', 'yellow'), trays('yellow', 'red', 'blue'), trays('blue', 'yellow', 'green')],
  docks(4, 'yellow', 'red', 'green', 'yellow', 'red', 'blue', 'yellow', 'yellow', 'yellow', 'yellow', 'red', 'red', 'green', 'red', 'blue', 'green', 'blue', 'blue', 'blue', 'red', 'yellow', 'yellow', 'yellow', 'yellow', 'yellow', 'yellow', 'blue'));
/** Eight trays, five colours, a belt with nothing to spare. */
export const BOARD_22: BoardDef = board('board-22', 'The squeeze', 14,
  [trays('green', 'blue'), trays('red', 'blue'), trays('red', 'blue'), trays('orange', 'yellow')],
  docks(4, 'blue', 'orange', 'green', 'blue', 'green', 'yellow', 'blue', 'blue', 'blue', 'red', 'blue', 'yellow', 'orange', 'blue', 'orange', 'green', 'blue', 'yellow', 'blue', 'red', 'red', 'red', 'red', 'red'));
/** One column goes four deep over the bridge. */
export const BOARD_23: BoardDef = { ...board('board-23', 'Thirteen trays', 18,
  [trays('red', 'yellow', 'blue', 'orange'), trays('red', 'blue', 'green'), trays('red', 'yellow', 'blue'), trays('yellow', 'green', 'red')],
  docks(4, 'red', 'yellow', 'red', 'orange', 'blue', 'blue', 'yellow', 'green', 'yellow', 'red', 'yellow', 'red', 'orange', 'red', 'green', 'orange', 'red', 'green', 'red', 'blue', 'blue', 'blue', 'yellow', 'red', 'blue', 'red', 'green', 'yellow', 'red', 'green', 'blue', 'red', 'yellow', 'blue', 'yellow', 'yellow', 'blue', 'red', 'green')), trackShape: 'eight' };
/** Twelve trays on the oval, five colours. */
export const BOARD_24: BoardDef = board('board-24', 'Full house', 17,
  [trays('orange', 'red', 'red'), trays('red', 'green', 'orange'), trays('yellow', 'red', 'yellow'), trays('orange', 'green', 'blue')],
  docks(4, 'red', 'orange', 'orange', 'red', 'green', 'red', 'blue', 'red', 'red', 'green', 'red', 'yellow', 'red', 'red', 'yellow', 'blue', 'yellow', 'yellow', 'orange', 'orange', 'green', 'green', 'orange', 'orange', 'red', 'red', 'yellow', 'yellow', 'green', 'orange', 'green', 'blue', 'orange', 'orange', 'red', 'red'));
/** Five short trays among nine on the bridge. */
export const BOARD_25: BoardDef = { ...board('board-25', 'Short eight', 18,
  [[tray('green', SHORT_TRAY), tray('blue', SHORT_TRAY), tray('yellow')], [tray('orange'), tray('blue', SHORT_TRAY), tray('red')], [tray('blue', SHORT_TRAY), tray('green', SHORT_TRAY), tray('red')]],
  docks(4, 'yellow', 'blue', 'red', 'red', 'red', 'orange', 'blue', 'green', 'orange', 'yellow', 'green', 'yellow', 'orange', 'blue', 'green', 'blue', 'red', 'blue', 'green', 'red', 'blue', 'red')), trackShape: 'eight' };
/** Two columns of four and a short third: ten trays, most of them blocking three more. */
export const BOARD_26: BoardDef = board('board-26', 'Deep stacks', 15,
  [trays('blue', 'red', 'orange', 'blue'), trays('blue', 'yellow', 'yellow', 'orange'), trays('green', 'red')],
  docks(4, 'orange', 'red', 'orange', 'blue', 'blue', 'red', 'blue', 'orange', 'yellow', 'yellow', 'red', 'blue', 'blue', 'green', 'blue', 'red', 'yellow', 'red', 'red', 'blue', 'orange', 'blue', 'blue', 'yellow', 'yellow', 'orange', 'green', 'yellow', 'orange', 'green'));
/** Only three docks for five colours: two colours are always waiting their turn. */
export const BOARD_27: BoardDef = board('board-27', 'Three docks, five colours', 17,
  [trays('red', 'red', 'green'), trays('green', 'yellow', 'orange'), trays('orange', 'red', 'blue')],
  docks(3, 'green', 'yellow', 'red', 'blue', 'red', 'green', 'red', 'blue', 'orange', 'orange', 'red', 'red', 'orange', 'orange', 'green', 'red', 'blue', 'green', 'orange', 'green', 'red', 'red', 'orange', 'green', 'red', 'yellow', 'yellow'));
/** The biggest pour so far: fourteen trays over the bridge. */
export const BOARD_28: BoardDef = { ...board('board-28', 'Fourteen trays', 18,
  [trays('blue', 'orange', 'green', 'orange'), trays('red', 'red', 'green'), trays('green', 'red', 'red', 'yellow'), trays('yellow', 'blue', 'orange')],
  docks(4, 'green', 'yellow', 'orange', 'green', 'red', 'red', 'red', 'green', 'blue', 'yellow', 'red', 'blue', 'green', 'blue', 'yellow', 'orange', 'red', 'green', 'yellow', 'green', 'orange', 'orange', 'blue', 'red', 'green', 'blue', 'red', 'yellow', 'orange', 'orange', 'red', 'orange', 'blue', 'red', 'green', 'green', 'orange', 'yellow', 'orange', 'red', 'red', 'red')), trackShape: 'eight' };
/** Six short trays among twelve on the wide crossing. */
export const BOARD_29: BoardDef = { ...board('board-29', 'Short measures, wide belt', 20,
  [[tray('green'), tray('blue'), tray('blue', SHORT_TRAY)], [tray('green', SHORT_TRAY), tray('red', SHORT_TRAY), tray('blue', SHORT_TRAY)], [tray('orange'), tray('orange'), tray('red', SHORT_TRAY)], [tray('yellow', SHORT_TRAY), tray('blue'), tray('yellow')]],
  docks(4, 'blue', 'yellow', 'green', 'red', 'yellow', 'blue', 'red', 'green', 'red', 'orange', 'blue', 'blue', 'yellow', 'blue', 'red', 'yellow', 'orange', 'blue', 'yellow', 'orange', 'orange', 'green', 'blue', 'blue', 'orange', 'blue', 'orange', 'green', 'blue', 'green')), trackShape: 'wide-eight' };
/** Fourteen trays, four deep in two columns, on the wide crossing. */
export const BOARD_30: BoardDef = { ...board('board-30', 'Grand finale', 19,
  [trays('red', 'yellow', 'blue', 'orange'), trays('green', 'yellow', 'blue', 'blue'), [tray('red'), tray('yellow'), tray('orange', SHORT_TRAY)], [tray('green', SHORT_TRAY), tray('orange'), tray('yellow')]],
  docks(4, 'blue', 'green', 'blue', 'orange', 'green', 'yellow', 'yellow', 'yellow', 'orange', 'blue', 'blue', 'yellow', 'blue', 'red', 'red', 'red', 'orange', 'orange', 'yellow', 'blue', 'orange', 'yellow', 'orange', 'orange', 'red', 'orange', 'blue', 'green', 'red', 'yellow', 'yellow', 'yellow', 'green', 'blue', 'blue', 'yellow', 'yellow', 'yellow', 'red', 'green')), trackShape: 'wide-eight' };
export const BOARDS: readonly BoardDef[] = [BOARD_1, BOARD_2, BOARD_3, BOARD_4, BOARD_5, BOARD_6, BOARD_7, BOARD_8, BOARD_9, BOARD_10, BOARD_11, BOARD_12, BOARD_13, BOARD_14, BOARD_15, BOARD_16, BOARD_17, BOARD_18, BOARD_19, BOARD_20, BOARD_21, BOARD_22, BOARD_23, BOARD_24, BOARD_25, BOARD_26, BOARD_27, BOARD_28, BOARD_29, BOARD_30];
