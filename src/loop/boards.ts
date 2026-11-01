import type { Color, Packet } from '../sim/types';
import type { LoopBoardDef, TruckDef } from './types';

/** Loop Sort counts in marbles: a truck holds 24, a segment is a run of them, the loop holds dozens. */
export const TRUCK_CAPACITY = 24;
const seg = (color: Color, count: number): Packet => ({ color, count });
const truck = (...segments: Packet[]): TruckDef => ({ segments });
const ring = (...entries: Packet[]): Packet[] => entries;
const board = (id: string, title: string, loopCapacity: number, lanes: TruckDef[][], loop: Packet[]): LoopBoardDef =>
  ({ id, title, loopCapacity, truckCapacity: TRUCK_CAPACITY, lanes, loop });

/** Two complementary trucks and room for both pours. Learn the exchange before traffic pressure. */
export const LOOP_1 = board('loop-1', 'The first exchange', 20,
  [[truck(seg('red', 8), seg('blue', 16))], [truck(seg('blue', 8), seg('red', 16))]], []);
/** Three colours circulate once; all three exposed segments fit together without waiting for space. */
export const LOOP_2 = board('loop-2', 'Three colours moving', 24,
  [[truck(seg('green', 6), seg('blue', 18))], [truck(seg('blue', 6), seg('red', 18))], [truck(seg('red', 6), seg('green', 18))]], []);
/** Three lanes, five trucks, red twice over. */
export const LOOP_3 = board('loop-3', 'Three lanes', 34,
  [[truck(seg('yellow', 6), seg('green', 8), seg('red', 10)), truck(seg('blue', 12))], [truck(seg('red', 8), seg('yellow', 16))], [truck(seg('green', 12)), truck(seg('blue', 6), seg('red', 12))]],
  ring(seg('red', 18), seg('blue', 6), seg('green', 4), seg('yellow', 2)));
/** Four lanes, six trucks: a busy loop that stays one pour from full. */
export const LOOP_4 = board('loop-4', 'Heavy traffic', 30,
  [[truck(seg('blue', 8), seg('red', 8), seg('yellow', 8)), truck(seg('green', 12))], [truck(seg('yellow', 6), seg('blue', 18)), truck(seg('green', 4), seg('red', 14))], [truck(seg('red', 10), seg('blue', 14))], [truck(seg('blue', 6), seg('red', 12))]],
  ring(seg('blue', 2), seg('red', 4), seg('green', 8), seg('yellow', 10)));
/** Four lanes, eight trucks, nearly two hundred marbles. */
export const LOOP_5 = board('loop-5', 'Gridlock', 56,
  [[truck(seg('red', 6), seg('green', 8), seg('blue', 10)), truck(seg('yellow', 12), seg('red', 6))], [truck(seg('green', 10), seg('yellow', 6), seg('red', 8)), truck(seg('blue', 14))], [truck(seg('blue', 8), seg('red', 10), seg('green', 6)), truck(seg('green', 12))], [truck(seg('blue', 6), seg('yellow', 12)), truck(seg('red', 4), seg('yellow', 10))]],
  ring(seg('red', 14), seg('green', 12), seg('blue', 10), seg('yellow', 8)));
/** The first bridge for the trucks: four lanes, six trucks, four colours. */
export const LOOP_6: LoopBoardDef = { ...board('loop-6', 'Truck bridge', 24,
  [[truck(seg('red', 2), seg('green', 4), seg('yellow', 18)), truck(seg('green', 20))], [truck(seg('green', 4), seg('blue', 4), seg('red', 16)), truck(seg('red', 16), seg('blue', 8))], [truck(seg('green', 6), seg('blue', 6), seg('red', 8))], [truck(seg('red', 6), seg('blue', 2), seg('green', 14))]],
  ring(seg('yellow', 6), seg('blue', 4))), trackShape: 'eight' };
/** Eight trucks on the wide crossing. */
export const LOOP_7: LoopBoardDef = { ...board('loop-7', 'Eight in motion', 26,
  [[truck(seg('green', 4), seg('yellow', 8), seg('green', 6)), truck(seg('red', 4), seg('green', 20))], [truck(seg('red', 6), seg('yellow', 6), seg('blue', 4)), truck(seg('red', 20), seg('yellow', 4))], [truck(seg('yellow', 6), seg('green', 14), seg('red', 4)), truck(seg('yellow', 12), seg('red', 12))], [truck(seg('red', 4), seg('green', 4), seg('red', 10)), truck(seg('red', 12), seg('yellow', 12))]],
  ring(seg('blue', 20))), trackShape: 'wide-eight' };
/** Orange arrives on the loop: four lanes, six trucks, five colours. */
export const LOOP_8: LoopBoardDef = board('loop-8', 'Orange arrives', 24,
  [[truck(seg('red', 16)), truck(seg('orange', 6), seg('yellow', 2), seg('orange', 16))], [truck(seg('orange', 2), seg('yellow', 8), seg('red', 8)), truck(seg('green', 14), seg('blue', 10))], [truck(seg('red', 16), seg('green', 8))], [truck(seg('red', 8), seg('blue', 6), seg('green', 2), seg('yellow', 8))]],
  ring(seg('yellow', 6), seg('blue', 8)));
/** Five lanes in two rows, eight trucks, five colours. */
export const LOOP_9: LoopBoardDef = board('loop-9', 'Five lanes', 24,
  [[truck(seg('red', 2), seg('green', 2), seg('red', 20)), truck(seg('orange', 14), seg('red', 6), seg('orange', 4))], [truck(seg('red', 10), seg('orange', 6), seg('red', 4)), truck(seg('yellow', 4), seg('orange', 20))], [truck(seg('red', 2), seg('orange', 20))], [truck(seg('red', 2), seg('orange', 2), seg('yellow', 20)), truck(seg('orange', 4), seg('blue', 20))], [truck(seg('red', 2), seg('orange', 2), seg('green', 20))]],
  ring(seg('blue', 4), seg('green', 2)));
/** Seven trucks over the bridge with orange in the mix. */
export const LOOP_10: LoopBoardDef = { ...board('loop-10', 'Orange bridge', 26,
  [[truck(seg('yellow', 14)), truck(seg('red', 18))], [truck(seg('orange', 16), seg('blue', 4), seg('orange', 4)), truck(seg('red', 20), seg('blue', 4))], [truck(seg('yellow', 4), seg('blue', 12), seg('orange', 8)), truck(seg('orange', 20), seg('red', 4))], [truck(seg('yellow', 6), seg('red', 6), seg('green', 12))]],
  ring(seg('green', 12), seg('blue', 4))), trackShape: 'eight' };
/** Eight trucks, five colours, the wide crossing: rush hour. */
export const LOOP_11: LoopBoardDef = { ...board('loop-11', 'Rush hour', 30,
  [[truck(seg('green', 2), seg('red', 2), seg('green', 14)), truck(seg('orange', 16), seg('blue', 2))], [truck(seg('red', 4), seg('green', 6), seg('red', 6)), truck(seg('orange', 12), seg('red', 12))], [truck(seg('red', 14), seg('orange', 8)), truck(seg('red', 12), seg('orange', 12))], [truck(seg('red', 2), seg('green', 2), seg('red', 20)), truck(seg('blue', 22), seg('yellow', 2))]],
  ring(seg('yellow', 22))), trackShape: 'wide-eight' };
/** Six trucks in only two lanes: what is behind matters more than what is in front. */
export const LOOP_12: LoopBoardDef = board('loop-12', 'Two lanes, deep queues', 24,
  [[truck(seg('red', 2), seg('green', 2), seg('red', 18)), truck(seg('green', 14), seg('blue', 10)), truck(seg('yellow', 14), seg('green', 10))], [truck(seg('red', 2), seg('green', 2), seg('red', 20)), truck(seg('red', 6), seg('green', 18)), truck(seg('blue', 14), seg('yellow', 10))]],
  ring(seg('green', 2)));
/** Three colours, six trucks, three segments each and a small loop. */
export const LOOP_13: LoopBoardDef = board('loop-13', 'Three-colour squeeze', 22,
  [[truck(seg('blue', 2), seg('red', 4), seg('green', 18)), truck(seg('green', 8), seg('red', 16))], [truck(seg('red', 2), seg('green', 22)), truck(seg('red', 4), seg('blue', 20))], [truck(seg('green', 6), seg('red', 2), seg('green', 16)), truck(seg('green', 2), seg('blue', 2), seg('red', 20))]],
  ring());
/** Eight trucks carrying up to three colours each. */
export const LOOP_14: LoopBoardDef = board('loop-14', 'Triple decks', 24,
  [[truck(seg('green', 6), seg('yellow', 18)), truck(seg('red', 16))], [truck(seg('red', 8), seg('yellow', 8), seg('blue', 8)), truck(seg('orange', 16), seg('yellow', 8))], [truck(seg('green', 2), seg('blue', 2), seg('green', 20)), truck(seg('red', 8), seg('blue', 8), seg('orange', 8))], [truck(seg('green', 2), seg('blue', 2), seg('green', 18)), truck(seg('yellow', 6), seg('blue', 2), seg('red', 16))]],
  ring(seg('yellow', 8), seg('blue', 2)));
/** Five trucks in five lanes with nothing behind them: the whole puzzle is on the loop. */
export const LOOP_15: LoopBoardDef = board('loop-15', 'Five lanes, one each', 24,
  [[truck(seg('green', 2), seg('orange', 2), seg('green', 16))], [truck(seg('green', 2), seg('orange', 20))], [truck(seg('yellow', 10), seg('blue', 6))], [truck(seg('red', 10), seg('yellow', 14))], [truck(seg('orange', 2), seg('green', 4), seg('red', 14))]],
  ring(seg('blue', 18)));
/** Nine trucks over the bridge with five colours. */
export const LOOP_16: LoopBoardDef = { ...board('loop-16', 'Nine over the bridge', 32,
  [[truck(seg('orange', 20)), truck(seg('yellow', 6), seg('red', 18)), truck(seg('red', 10), seg('yellow', 6), seg('red', 8))], [truck(seg('green', 2), seg('red', 2), seg('blue', 20)), truck(seg('red', 16), seg('yellow', 8))], [truck(seg('green', 2), seg('yellow', 4), seg('blue', 12)), truck(seg('blue', 4), seg('red', 16))], [truck(seg('orange', 4), seg('blue', 12), seg('orange', 6)), truck(seg('green', 20))]],
  ring(seg('red', 2), seg('orange', 18))), trackShape: 'eight' };
/** Half the trucks arrive half full, so the loop starts crowded. */
export const LOOP_17: LoopBoardDef = board('loop-17', 'Half loads', 32,
  [[truck(seg('yellow', 2), seg('red', 8), seg('blue', 8)), truck(seg('yellow', 8))], [truck(seg('green', 2), seg('red', 2), seg('yellow', 16)), truck(seg('yellow', 16), seg('red', 8))], [truck(seg('green', 4), seg('red', 20)), truck(seg('yellow', 6), seg('green', 18))]],
  ring(seg('blue', 16), seg('red', 10)));
/** Five lanes, ten trucks, five colours. */
export const LOOP_18: LoopBoardDef = board('loop-18', 'Ten trucks', 30,
  [[truck(seg('orange', 8), seg('red', 16)), truck(seg('yellow', 22), seg('green', 2))], [truck(seg('red', 2), seg('blue', 22)), truck(seg('green', 2), seg('blue', 10), seg('yellow', 12))], [truck(seg('red', 12), seg('orange', 12)), truck(seg('red', 12), seg('green', 10), seg('red', 2))], [truck(seg('blue', 2), seg('green', 8), seg('blue', 14)), truck(seg('green', 16))], [truck(seg('orange', 4), seg('red', 6)), truck(seg('green', 10), seg('yellow', 14))]],
  ring(seg('red', 22)));
/** Seven trucks and a loop with little room. */
export const LOOP_19: LoopBoardDef = board('loop-19', 'Narrow ring', 22,
  [[truck(seg('green', 2), seg('blue', 2), seg('orange', 20)), truck(seg('red', 4), seg('orange', 20))], [truck(seg('blue', 2), seg('orange', 2), seg('red', 20)), truck(seg('orange', 2), seg('yellow', 22))], [truck(seg('yellow', 2), seg('orange', 2), seg('blue', 20))], [truck(seg('orange', 2), seg('green', 2), seg('red', 20)), truck(seg('red', 4), seg('green', 20))]],
  ring());
/** Ten trucks on the wide crossing, three deep in two lanes. */
export const LOOP_20: LoopBoardDef = { ...board('loop-20', 'Wide crossing, three deep', 36,
  [[truck(seg('green', 2), seg('orange', 4), seg('yellow', 14)), truck(seg('green', 12), seg('yellow', 12)), truck(seg('green', 2), seg('orange', 2), seg('red', 20))], [truck(seg('green', 2), seg('yellow', 12), seg('green', 10)), truck(seg('red', 6), seg('green', 4)), truck(seg('orange', 20))], [truck(seg('orange', 6), seg('green', 16), seg('orange', 2)), truck(seg('orange', 2), seg('green', 22))], [truck(seg('yellow', 10), seg('orange', 12), seg('blue', 2)), truck(seg('green', 2), seg('red', 22))]],
  ring(seg('blue', 22))), trackShape: 'wide-eight' };
/** The loop begins nearly full; the first pour has to be the right one. */
export const LOOP_21: LoopBoardDef = board('loop-21', 'Crowded start', 24,
  [[truck(seg('green', 2), seg('yellow', 20)), truck(seg('green', 14), seg('blue', 10))], [truck(seg('yellow', 4), seg('red', 20)), truck(seg('yellow', 2), seg('blue', 6), seg('green', 14))], [truck(seg('yellow', 2), seg('red', 6), seg('yellow', 16)), truck(seg('blue', 18))], [truck(seg('green', 2), seg('red', 22)), truck(seg('green', 10), seg('yellow', 4), seg('green', 6))]],
  ring(seg('blue', 14)));
/** Nine trucks queue three deep in three lanes. */
export const LOOP_22: LoopBoardDef = board('loop-22', 'Three lanes, three deep', 24,
  [[truck(seg('red', 2), seg('yellow', 2), seg('red', 18)), truck(seg('blue', 4), seg('red', 20)), truck(seg('green', 4), seg('blue', 8), seg('green', 12))], [truck(seg('red', 6), seg('yellow', 18)), truck(seg('red', 4), seg('green', 20)), truck(seg('green', 12), seg('blue', 12))], [truck(seg('orange', 2), seg('red', 2), seg('yellow', 14)), truck(seg('orange', 22)), truck(seg('yellow', 4), seg('red', 20))]],
  ring(seg('yellow', 10)));
/** Eight trucks over the bridge with a small loop. */
export const LOOP_23: LoopBoardDef = { ...board('loop-23', 'Tight eight', 22,
  [[truck(seg('orange', 4), seg('red', 8), seg('green', 10)), truck(seg('green', 12), seg('red', 12))], [truck(seg('green', 2), seg('red', 2), seg('orange', 20)), truck(seg('red', 4), seg('yellow', 20))], [truck(seg('red', 12), seg('green', 4), seg('blue', 8)), truck(seg('yellow', 16), seg('red', 8))], [truck(seg('green', 12), seg('red', 2), seg('green', 8)), truck(seg('blue', 16), seg('yellow', 8))]],
  ring(seg('yellow', 4))), trackShape: 'eight' };
/** Seven trucks in three lanes, four colours and little room on the loop. */
export const LOOP_24: LoopBoardDef = board('loop-24', 'Three lanes, four colours', 24,
  [[truck(seg('green', 22)), truck(seg('blue', 2), seg('red', 14)), truck(seg('red', 2), seg('blue', 22))], [truck(seg('green', 2), seg('red', 22)), truck(seg('yellow', 4), seg('green', 2), seg('blue', 18))], [truck(seg('green', 4), seg('yellow', 2), seg('green', 18)), truck(seg('blue', 6), seg('yellow', 18))]],
  ring(seg('red', 10)));
/** Five lanes with one short queue. */
export const LOOP_25: LoopBoardDef = board('loop-25', 'Five lanes, nine trucks', 26,
  [[truck(seg('red', 4), seg('orange', 2), seg('blue', 16)), truck(seg('orange', 16), seg('blue', 8))], [truck(seg('yellow', 2), seg('red', 22)), truck(seg('orange', 12), seg('blue', 8), seg('orange', 4))], [truck(seg('yellow', 2), seg('orange', 2), seg('red', 18)), truck(seg('orange', 8), seg('yellow', 16))], [truck(seg('yellow', 2), seg('green', 2), seg('yellow', 16))], [truck(seg('red', 4), seg('green', 16), seg('orange', 4)), truck(seg('blue', 16), seg('green', 6))]],
  ring(seg('yellow', 10)));
/** The wide crossing with a small loop. */
export const LOOP_26: LoopBoardDef = { ...board('loop-26', 'Wide squeeze', 30,
  [[truck(seg('yellow', 2), seg('orange', 10), seg('green', 12)), truck(seg('yellow', 2), seg('red', 22))], [truck(seg('orange', 4), seg('blue', 12), seg('green', 2)), truck(seg('green', 12), seg('orange', 12))], [truck(seg('blue', 6), seg('red', 12), seg('blue', 6)), truck(seg('green', 8), seg('orange', 2), seg('red', 14))], [truck(seg('yellow', 18), seg('green', 2), seg('yellow', 2)), truck(seg('orange', 20))]],
  ring(seg('green', 12))), trackShape: 'wide-eight' };
/** Ten trucks in four lanes on the oval. */
export const LOOP_27: LoopBoardDef = board('loop-27', 'Ten on the oval', 32,
  [[truck(seg('red', 4), seg('blue', 10), seg('orange', 4)), truck(seg('orange', 2), seg('green', 20), seg('blue', 2)), truck(seg('red', 18), seg('green', 4))], [truck(seg('yellow', 4), seg('blue', 2), seg('green', 18)), truck(seg('red', 22), seg('orange', 2))], [truck(seg('blue', 4), seg('yellow', 20)), truck(seg('blue', 4), seg('green', 20)), truck(seg('red', 20))], [truck(seg('green', 10), seg('blue', 2), seg('red', 2)), truck(seg('orange', 18), seg('red', 6))]],
  ring(seg('orange', 22)));
/** Only three colours but eight trucks of three segments each. */
export const LOOP_28: LoopBoardDef = board('loop-28', 'Three colours, three segments', 24,
  [[truck(seg('red', 2), seg('blue', 22)), truck(seg('green', 2), seg('blue', 22))], [truck(seg('blue', 2), seg('red', 22)), truck(seg('blue', 2), seg('red', 22))], [truck(seg('blue', 2), seg('green', 22)), truck(seg('red', 2), seg('green', 22))], [truck(seg('green', 2), seg('blue', 2), seg('red', 20)), truck(seg('red', 4), seg('blue', 20))]],
  ring());
/** Ten trucks over the bridge. */
export const LOOP_29: LoopBoardDef = { ...board('loop-29', 'Rush hour eight', 34,
  [[truck(seg('red', 4), seg('blue', 4), seg('red', 14)), truck(seg('red', 4), seg('green', 4), seg('red', 16)), truck(seg('red', 8), seg('orange', 16))], [truck(seg('orange', 2), seg('red', 8), seg('blue', 12)), truck(seg('orange', 4), seg('green', 20))], [truck(seg('red', 2), seg('orange', 22)), truck(seg('yellow', 18), seg('green', 4)), truck(seg('blue', 4), seg('red', 20))], [truck(seg('blue', 4), seg('orange', 4), seg('yellow', 6)), truck(seg('red', 20))]],
  ring(seg('green', 20))), trackShape: 'eight' };
/** Ten trucks, five lanes, five colours on the wide crossing. */
export const LOOP_30: LoopBoardDef = { ...board('loop-30', 'Grand finale', 34,
  [[truck(seg('yellow', 8), seg('green', 16)), truck(seg('yellow', 2), seg('red', 22))], [truck(seg('green', 8), seg('yellow', 4), seg('blue', 6)), truck(seg('orange', 12), seg('red', 6))], [truck(seg('orange', 6), seg('green', 16), seg('yellow', 2)), truck(seg('orange', 10), seg('green', 8))], [truck(seg('red', 14), seg('yellow', 8), seg('red', 2)), truck(seg('red', 10), seg('orange', 14))], [truck(seg('red', 2), seg('orange', 22)), truck(seg('red', 16), seg('orange', 8))]],
  ring(seg('blue', 18))), trackShape: 'wide-eight' };
export const LOOP_BOARDS: readonly LoopBoardDef[] = [LOOP_1, LOOP_2, LOOP_3, LOOP_4, LOOP_5, LOOP_6, LOOP_7, LOOP_8, LOOP_9, LOOP_10, LOOP_11, LOOP_12, LOOP_13, LOOP_14, LOOP_15, LOOP_16, LOOP_17, LOOP_18, LOOP_19, LOOP_20, LOOP_21, LOOP_22, LOOP_23, LOOP_24, LOOP_25, LOOP_26, LOOP_27, LOOP_28, LOOP_29, LOOP_30];
