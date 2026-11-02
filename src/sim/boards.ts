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
/** The first figure eight: seven trays, two docks, and a longer belt that fills up all the same. */
export const BOARD_6: BoardDef = { ...board('board-6', 'First bridge', 26,
  [trays('yellow', 'green', 'yellow'), trays('blue', 'red'), trays('red', 'red')],
  docks(2, 'yellow', 'red', 'red', 'blue', 'yellow', 'yellow', 'green', 'red', 'blue', 'yellow', 'yellow', 'red', 'green', 'red', 'red', 'green', 'blue', 'red', 'red', 'red', 'yellow')), trackShape: 'eight' };
/** Seven trays over the wide crossing. */
export const BOARD_7: BoardDef = { ...board('board-7', 'The wide crossing', 30,
  [trays('red', 'red', 'yellow'), trays('green', 'red'), trays('green', 'blue')],
  docks(3, 'yellow', 'red', 'blue', 'green', 'red', 'yellow', 'red', 'blue', 'red', 'blue', 'red', 'green', 'green', 'green', 'red', 'green', 'yellow', 'red', 'green', 'red', 'red')), trackShape: 'wide-eight' };
/** Orange arrives: five colours, three columns, eight trays, four docks. */
export const BOARD_8: BoardDef = board('board-8', 'Orange arrives', 17,
  [trays('orange', 'blue', 'yellow'), trays('blue', 'red', 'green'), trays('green', 'red')],
  docks(4, 'orange', 'blue', 'green', 'red', 'yellow', 'yellow', 'blue', 'green', 'green', 'red', 'green', 'blue', 'blue', 'orange', 'red', 'yellow', 'orange', 'red', 'blue', 'blue', 'green', 'green', 'red', 'red'));
/** Short trays of six mix with full trays: a cheap pour is tempting, but every dock still wants three boxes. */
export const BOARD_9: BoardDef = board('board-9', 'Short pours', 15,
  [trays('green', 'red', 'blue'), [tray('blue', SHORT_TRAY), tray('red', SHORT_TRAY), tray('red')], [tray('red', SHORT_TRAY), tray('yellow')], [tray('yellow'), tray('yellow', SHORT_TRAY), tray('orange', SHORT_TRAY)]],
  docks(4, 'red', 'yellow', 'red', 'yellow', 'blue', 'yellow', 'orange', 'blue', 'red', 'yellow', 'green', 'red', 'yellow', 'yellow', 'blue', 'blue', 'red', 'red', 'blue', 'green', 'red', 'yellow', 'red', 'orange', 'green', 'red', 'red', 'yellow'));
/** Five colours over the bridge: nine trays on a tight belt. */
export const BOARD_10: BoardDef = { ...board('board-10', 'Five in the eight', 26,
  [trays('green', 'green', 'blue'), trays('orange', 'red', 'red'), trays('green', 'red', 'yellow')],
  docks(3, 'red', 'orange', 'green', 'blue', 'green', 'red', 'green', 'yellow', 'red', 'orange', 'orange', 'blue', 'blue', 'green', 'green', 'green', 'green', 'yellow', 'green', 'green', 'red', 'red', 'yellow', 'red', 'red', 'red', 'red')), trackShape: 'eight' };
/** Twelve trays, five colours and the wide crossing. */
export const BOARD_11: BoardDef = { ...board('board-11', 'The grand tour', 30,
  [trays('blue', 'red', 'red'), trays('yellow', 'orange', 'yellow'), trays('blue', 'orange', 'green'), trays('blue', 'orange', 'green')],
  docks(3, 'orange', 'red', 'yellow', 'blue', 'green', 'yellow', 'red', 'red', 'green', 'blue', 'red', 'yellow', 'red', 'blue', 'orange', 'orange', 'green', 'orange', 'orange', 'blue', 'green', 'blue', 'red', 'green', 'orange', 'blue', 'orange', 'green', 'blue', 'orange', 'blue', 'orange', 'yellow', 'yellow', 'blue', 'yellow')), trackShape: 'wide-eight' };
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
export const BOARD_16: BoardDef = { ...board('board-16', 'Short crossing', 26,
  [[tray('red', SHORT_TRAY), tray('yellow'), tray('yellow')], [tray('yellow', SHORT_TRAY), tray('blue')], [tray('red', SHORT_TRAY), tray('orange'), tray('green')]],
  docks(2, 'yellow', 'yellow', 'yellow', 'yellow', 'orange', 'yellow', 'yellow', 'yellow', 'blue', 'orange', 'red', 'blue', 'green', 'red', 'green', 'yellow', 'green', 'red', 'blue', 'orange', 'red')), trackShape: 'eight' };
/** Three columns, three docks and no belt to spare: the tightest Funnel Sort board. */
export const BOARD_17: BoardDef = board('board-17', 'Narrow neck', 14,
  [trays('green', 'blue'), trays('orange', 'red'), trays('red', 'yellow')],
  docks(3, 'yellow', 'yellow', 'blue', 'green', 'yellow', 'red', 'green', 'green', 'blue', 'orange', 'orange', 'red', 'blue', 'orange', 'red', 'red', 'red', 'red'));
/** The wide crossing with two docks: most of the belt is always waiting. */
export const BOARD_18: BoardDef = { ...board('board-18', 'Wide and tight', 30,
  [trays('yellow', 'yellow', 'orange'), trays('green', 'red', 'red'), trays('yellow', 'green', 'blue')],
  docks(2, 'red', 'red', 'blue', 'red', 'yellow', 'yellow', 'yellow', 'yellow', 'green', 'green', 'green', 'yellow', 'red', 'yellow', 'blue', 'yellow', 'blue', 'yellow', 'green', 'yellow', 'green', 'orange', 'red', 'orange', 'orange', 'red', 'green')), trackShape: 'wide-eight' };
/** Four colours, four columns of three. */
export const BOARD_19: BoardDef = board('board-19', 'Three by four', 16,
  [trays('green', 'red', 'blue'), trays('red', 'green', 'blue'), trays('red', 'yellow', 'blue'), trays('blue', 'green', 'red')],
  docks(4, 'red', 'red', 'red', 'green', 'green', 'blue', 'red', 'blue', 'green', 'blue', 'blue', 'red', 'yellow', 'red', 'green', 'blue', 'blue', 'blue', 'blue', 'blue', 'green', 'blue', 'red', 'green', 'blue', 'blue', 'red', 'green', 'red', 'yellow', 'green', 'red', 'red', 'yellow', 'red', 'green'));
/** Four short trays among ten, over the wide crossing. */
export const BOARD_20: BoardDef = { ...board('board-20', 'Mixed measures', 30,
  [trays('yellow', 'red'), [tray('yellow', SHORT_TRAY), tray('green'), tray('blue', SHORT_TRAY)], [tray('blue'), tray('red', SHORT_TRAY)], [tray('red', SHORT_TRAY), tray('orange'), tray('red')]],
  docks(2, 'blue', 'blue', 'red', 'orange', 'red', 'red', 'red', 'blue', 'blue', 'green', 'blue', 'yellow', 'red', 'green', 'green', 'yellow', 'yellow', 'red', 'red', 'red', 'red', 'orange', 'yellow', 'orange', 'red', 'yellow')), trackShape: 'wide-eight' };
/** Four colours, nine trays: each colour comes in pairs that must not meet on the belt. */
export const BOARD_21: BoardDef = board('board-21', 'Colour pairs', 15,
  [trays('yellow', 'red', 'yellow'), trays('yellow', 'red', 'blue'), trays('blue', 'yellow', 'green')],
  docks(4, 'yellow', 'red', 'green', 'yellow', 'red', 'blue', 'yellow', 'yellow', 'yellow', 'yellow', 'red', 'red', 'green', 'red', 'blue', 'green', 'blue', 'blue', 'blue', 'red', 'yellow', 'yellow', 'yellow', 'yellow', 'yellow', 'yellow', 'blue'));
/** Eight trays, five colours, a belt with nothing to spare. */
export const BOARD_22: BoardDef = board('board-22', 'The squeeze', 14,
  [trays('green', 'blue'), trays('red', 'blue'), trays('red', 'blue'), trays('orange', 'yellow')],
  docks(4, 'blue', 'orange', 'green', 'blue', 'green', 'yellow', 'blue', 'blue', 'blue', 'red', 'blue', 'yellow', 'orange', 'blue', 'orange', 'green', 'blue', 'yellow', 'blue', 'red', 'red', 'red', 'red', 'red'));
/** One column goes four deep over the bridge. */
export const BOARD_23: BoardDef = { ...board('board-23', 'Thirteen trays', 28,
  [trays('orange', 'orange', 'red', 'blue'), trays('orange', 'orange', 'blue'), trays('orange', 'red', 'green'), trays('orange', 'yellow', 'orange')],
  docks(3, 'yellow', 'blue', 'blue', 'red', 'yellow', 'orange', 'orange', 'blue', 'red', 'orange', 'orange', 'red', 'orange', 'orange', 'orange', 'green', 'green', 'orange', 'green', 'blue', 'orange', 'orange', 'red', 'orange', 'orange', 'orange', 'orange', 'orange', 'orange', 'blue', 'red', 'orange', 'orange', 'red', 'orange', 'yellow', 'blue', 'orange', 'orange')), trackShape: 'eight' };
/** Twelve trays on the oval, five colours. */
export const BOARD_24: BoardDef = board('board-24', 'Full house', 17,
  [trays('orange', 'red', 'red'), trays('red', 'green', 'orange'), trays('yellow', 'red', 'yellow'), trays('orange', 'green', 'blue')],
  docks(4, 'red', 'orange', 'orange', 'red', 'green', 'red', 'blue', 'red', 'red', 'green', 'red', 'yellow', 'red', 'red', 'yellow', 'blue', 'yellow', 'yellow', 'orange', 'orange', 'green', 'green', 'orange', 'orange', 'red', 'red', 'yellow', 'yellow', 'green', 'orange', 'green', 'blue', 'orange', 'orange', 'red', 'red'));
/** Five short trays among nine on the bridge. */
export const BOARD_25: BoardDef = { ...board('board-25', 'Short eight', 26,
  [[tray('yellow', SHORT_TRAY), tray('orange'), tray('yellow', SHORT_TRAY)], [tray('blue', SHORT_TRAY), tray('yellow'), tray('green', SHORT_TRAY)], [tray('blue'), tray('red'), tray('red', SHORT_TRAY)]],
  docks(2, 'yellow', 'yellow', 'yellow', 'green', 'orange', 'red', 'yellow', 'blue', 'red', 'red', 'blue', 'orange', 'blue', 'orange', 'yellow', 'blue', 'green', 'red', 'yellow', 'yellow', 'blue', 'red')), trackShape: 'eight' };
/** Two columns of four and a short third: ten trays, most of them blocking three more. */
export const BOARD_26: BoardDef = board('board-26', 'Deep stacks', 15,
  [trays('blue', 'red', 'orange', 'blue'), trays('blue', 'yellow', 'yellow', 'orange'), trays('green', 'red')],
  docks(4, 'orange', 'red', 'orange', 'blue', 'blue', 'red', 'blue', 'orange', 'yellow', 'yellow', 'red', 'blue', 'blue', 'green', 'blue', 'red', 'yellow', 'red', 'red', 'blue', 'orange', 'blue', 'blue', 'yellow', 'yellow', 'orange', 'green', 'yellow', 'orange', 'green'));
/** Only three docks for five colours: two colours are always waiting their turn. */
export const BOARD_27: BoardDef = board('board-27', 'Three docks, five colours', 17,
  [trays('red', 'red', 'green'), trays('green', 'yellow', 'orange'), trays('orange', 'red', 'blue')],
  docks(3, 'green', 'yellow', 'red', 'blue', 'red', 'green', 'red', 'blue', 'orange', 'orange', 'red', 'red', 'orange', 'orange', 'green', 'red', 'blue', 'green', 'orange', 'green', 'red', 'red', 'orange', 'green', 'red', 'yellow', 'yellow'));
/** The biggest pour so far: fourteen trays over the bridge. */
export const BOARD_28: BoardDef = { ...board('board-28', 'Fourteen trays', 26,
  [trays('blue', 'green', 'yellow', 'blue'), trays('yellow', 'red', 'red'), trays('orange', 'green', 'red', 'red'), trays('blue', 'blue', 'red')],
  docks(2, 'green', 'blue', 'blue', 'blue', 'red', 'red', 'blue', 'blue', 'red', 'red', 'red', 'yellow', 'blue', 'blue', 'blue', 'blue', 'red', 'yellow', 'green', 'red', 'red', 'orange', 'red', 'green', 'blue', 'red', 'green', 'yellow', 'blue', 'blue', 'orange', 'red', 'green', 'red', 'red', 'yellow', 'green', 'red', 'yellow', 'red', 'yellow', 'orange')), trackShape: 'eight' };
/** Six short trays among twelve on the wide crossing. */
export const BOARD_29: BoardDef = { ...board('board-29', 'Short measures, wide belt', 30,
  [[tray('orange', SHORT_TRAY), tray('red'), tray('red')], [tray('red', SHORT_TRAY), tray('green'), tray('orange', SHORT_TRAY)], [tray('yellow'), tray('red', SHORT_TRAY), tray('yellow', SHORT_TRAY)], [tray('orange'), tray('green'), tray('blue', SHORT_TRAY)]],
  docks(2, 'yellow', 'red', 'red', 'blue', 'red', 'red', 'red', 'red', 'green', 'green', 'yellow', 'orange', 'green', 'orange', 'yellow', 'green', 'red', 'orange', 'red', 'orange', 'yellow', 'green', 'orange', 'yellow', 'green', 'blue', 'orange', 'orange', 'red', 'red')), trackShape: 'wide-eight' };
/** Fourteen trays, four deep in two columns, on the wide crossing. */
export const BOARD_30: BoardDef = { ...board('board-30', 'Grand finale', 30,
  [[tray('blue', SHORT_TRAY), tray('orange'), tray('yellow'), tray('green')], [tray('green'), tray('orange', SHORT_TRAY), tray('red'), tray('red')], trays('orange', 'yellow', 'red'), trays('red', 'red', 'red')],
  docks(2, 'red', 'red', 'red', 'red', 'red', 'red', 'orange', 'red', 'orange', 'green', 'orange', 'green', 'red', 'blue', 'red', 'red', 'green', 'red', 'green', 'red', 'red', 'orange', 'red', 'orange', 'green', 'yellow', 'red', 'orange', 'yellow', 'blue', 'yellow', 'green', 'red', 'yellow', 'red', 'red', 'orange', 'yellow', 'yellow', 'orange')), trackShape: 'wide-eight' };
export const BOARDS: readonly BoardDef[] = [BOARD_1, BOARD_2, BOARD_3, BOARD_4, BOARD_5, BOARD_6, BOARD_7, BOARD_8, BOARD_9, BOARD_10, BOARD_11, BOARD_12, BOARD_13, BOARD_14, BOARD_15, BOARD_16, BOARD_17, BOARD_18, BOARD_19, BOARD_20, BOARD_21, BOARD_22, BOARD_23, BOARD_24, BOARD_25, BOARD_26, BOARD_27, BOARD_28, BOARD_29, BOARD_30];
