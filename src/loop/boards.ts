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
/** A third colour with room to spare: half of every truck has to come out and find its way home. */
export const LOOP_31: LoopBoardDef = board('loop-31', 'Half and half', 40,
  [[truck(seg('green', 12), seg('blue', 12))], [truck(seg('blue', 12), seg('red', 12))], [truck(seg('red', 12), seg('green', 12))]], []);
// BEGIN first stretch
/** The first queued truck, with room to spare. */
export const LOOP_32: LoopBoardDef = board('loop-32', 'One behind', 26,
  [[truck(seg('blue', 16), seg('red', 8)), truck(seg('green', 18), seg('red', 6))], [truck(seg('red', 18), seg('green', 6))], [truck(seg('red', 16), seg('blue', 8))]],
  ring());
/** Five trucks and a little traffic already on the loop. */
export const LOOP_33: LoopBoardDef = board('loop-33', 'Two queues', 36,
  [[truck(seg('green', 2), seg('red', 22)), truck(seg('red', 2), seg('green', 22))], [truck(seg('red', 4), seg('blue', 20)), truck(seg('blue', 6), seg('red', 18))], [truck(seg('red', 2), seg('blue', 18))]],
  ring(seg('blue', 4)));
/** Five trucks and an empty loop that does not stay empty. */
export const LOOP_34: LoopBoardDef = board('loop-34', 'Five on the move', 26,
  [[truck(seg('green', 6), seg('red', 18)), truck(seg('blue', 20), seg('green', 4))], [truck(seg('red', 10), seg('green', 14)), truck(seg('green', 4), seg('red', 20))], [truck(seg('green', 20), seg('blue', 4))]],
  ring());
/** Yellow and its star, five trucks. */
export const LOOP_35: LoopBoardDef = board('loop-35', 'Yellow on the loop', 26,
  [[truck(seg('red', 4), seg('green', 20)), truck(seg('yellow', 22), seg('red', 2))], [truck(seg('blue', 4), seg('red', 20)), truck(seg('blue', 18), seg('yellow', 2))], [truck(seg('red', 22), seg('blue', 2))]],
  ring(seg('green', 4)));
/** Six trucks, every lane queued. */
export const LOOP_36: LoopBoardDef = board('loop-36', 'Six trucks', 42,
  [[truck(seg('green', 6), seg('yellow', 18)), truck(seg('blue', 20), seg('red', 4))], [truck(seg('green', 20), seg('red', 4)), truck(seg('red', 14), seg('blue', 4))], [truck(seg('red', 6), seg('green', 18)), truck(seg('red', 20), seg('green', 4))]],
  ring(seg('yellow', 6)));
/** Nothing on the loop at the start, and it fills all the same. */
export const LOOP_37: LoopBoardDef = board('loop-37', 'A clear start', 20,
  [[truck(seg('blue', 10), seg('red', 14)), truck(seg('yellow', 18), seg('red', 6))], [truck(seg('green', 4), seg('red', 20)), truck(seg('red', 4), seg('green', 20))], [truck(seg('red', 10), seg('blue', 14)), truck(seg('red', 18), seg('yellow', 6))]],
  ring());
/** One truck carries three stretches: dig twice to reach its colour. */
export const LOOP_38: LoopBoardDef = board('loop-38', 'Three in one', 22,
  [[truck(seg('red', 10), seg('yellow', 14)), truck(seg('green', 16), seg('red', 8))], [truck(seg('red', 8), seg('blue', 16)), truck(seg('yellow', 10), seg('red', 14))], [truck(seg('blue', 8), seg('red', 8), seg('green', 8))]],
  ring());
/** Several trucks carry three stretches and the loop is never quite clear. */
export const LOOP_39: LoopBoardDef = board('loop-39', 'Deep loads', 24,
  [[truck(seg('yellow', 2), seg('blue', 4), seg('yellow', 14)), truck(seg('red', 10), seg('blue', 14))], [truck(seg('yellow', 8), seg('red', 6), seg('green', 10)), truck(seg('blue', 14), seg('red', 10))], [truck(seg('red', 12), seg('blue', 2), seg('red', 10)), truck(seg('green', 14), seg('blue', 10))]],
  ring(seg('blue', 4)));
/** A wider loop after the deep loads. */
export const LOOP_40: LoopBoardDef = board('loop-40', 'Easy does it', 20,
  [[truck(seg('green', 2), seg('red', 2), seg('blue', 20)), truck(seg('red', 16), seg('yellow', 8))], [truck(seg('red', 2), seg('green', 4), seg('red', 18)), truck(seg('yellow', 16), seg('red', 2), seg('green', 6))], [truck(seg('red', 2), seg('green', 12), seg('red', 6))]],
  ring(seg('blue', 4)));
/** One truck carries three stretches and a truck waits behind two of them. */
export const LOOP_41: LoopBoardDef = board('loop-41', 'Dig to the cab', 24,
  [[truck(seg('yellow', 14), seg('red', 10)), truck(seg('green', 14), seg('red', 10))], [truck(seg('red', 14), seg('green', 10)), truck(seg('blue', 20), seg('yellow', 4))], [truck(seg('red', 14), seg('yellow', 6), seg('blue', 4))]],
  ring());
/** Six trucks, deep loads, and traffic on the loop. */
export const LOOP_42: LoopBoardDef = board('loop-42', 'Every lane queued', 42,
  [[truck(seg('blue', 4), seg('yellow', 10), seg('blue', 2)), truck(seg('red', 22), seg('yellow', 2))], [truck(seg('blue', 4), seg('green', 2), seg('red', 18)), truck(seg('green', 12), seg('blue', 8))], [truck(seg('green', 2), seg('blue', 14), seg('green', 8)), truck(seg('blue', 16), seg('red', 8))]],
  ring(seg('yellow', 12)));
/** Six trucks with two stretches each. */
export const LOOP_43: LoopBoardDef = board('loop-43', 'Short loads', 24,
  [[truck(seg('yellow', 16), seg('red', 6)), truck(seg('red', 10), seg('blue', 10))], [truck(seg('red', 4), seg('blue', 20)), truck(seg('blue', 14), seg('red', 10))], [truck(seg('red', 16), seg('yellow', 8)), truck(seg('red', 2), seg('green', 22))]],
  ring(seg('blue', 4), seg('green', 2)));
/** The fifth colour and its cross. */
export const LOOP_44: LoopBoardDef = board('loop-44', 'Orange on the road', 34,
  [[truck(seg('red', 14), seg('orange', 2)), truck(seg('red', 4), seg('green', 18), seg('blue', 2))], [truck(seg('orange', 8), seg('green', 4), seg('yellow', 12)), truck(seg('blue', 22), seg('green', 2))], [truck(seg('red', 4), seg('orange', 14), seg('red', 2))]],
  ring(seg('yellow', 12)));
/** A fourth lane, so more trucks reach the loop at once. */
export const LOOP_45: LoopBoardDef = board('loop-45', 'Four bays', 20,
  [[truck(seg('green', 4), seg('red', 18)), truck(seg('blue', 2), seg('red', 20))], [truck(seg('red', 2), seg('green', 22)), truck(seg('red', 4), seg('yellow', 10), seg('red', 10))], [truck(seg('green', 14), seg('red', 2), seg('green', 8)), truck(seg('red', 14), seg('yellow', 10))], [truck(seg('blue', 2), seg('red', 2), seg('blue', 20))]],
  ring(seg('yellow', 4)));
/** Every lane queued, five colours to place. */
export const LOOP_46: LoopBoardDef = board('loop-46', 'Five colours, six trucks', 38,
  [[truck(seg('yellow', 8), seg('red', 2), seg('green', 14)), truck(seg('red', 10), seg('orange', 14))], [truck(seg('red', 8), seg('yellow', 14), seg('blue', 2)), truck(seg('orange', 8), seg('red', 6))], [truck(seg('blue', 22), seg('yellow', 2)), truck(seg('red', 8), seg('orange', 2), seg('red', 14))]],
  ring(seg('green', 10)));
/** Six trucks with two stretches each, after the rush. */
export const LOOP_47: LoopBoardDef = board('loop-47', 'Two stretches each', 20,
  [[truck(seg('green', 16), seg('yellow', 8)), truck(seg('red', 4), seg('blue', 20))], [truck(seg('blue', 2), seg('red', 22)), truck(seg('yellow', 16), seg('green', 8))], [truck(seg('blue', 2), seg('green', 20)), truck(seg('green', 4), seg('red', 20))]],
  ring(seg('red', 2)));
/** Seven trucks in four lanes, five colours. */
export const LOOP_48: LoopBoardDef = board('loop-48', 'Rush hour', 26,
  [[truck(seg('yellow', 2), seg('red', 12), seg('blue', 10)), truck(seg('orange', 20), seg('red', 4))], [truck(seg('red', 10), seg('blue', 2), seg('red', 10)), truck(seg('green', 6), seg('red', 6), seg('orange', 4))], [truck(seg('green', 2), seg('yellow', 22)), truck(seg('green', 10), seg('red', 4), seg('green', 10))], [truck(seg('green', 6), seg('red', 2), seg('green', 14))]],
  ring(seg('blue', 12)));
/** Eight trucks in four lanes. */
export const LOOP_50: LoopBoardDef = board('loop-50', 'Four full lanes', 24,
  [[truck(seg('blue', 2), seg('red', 2), seg('blue', 20)), truck(seg('orange', 6), seg('red', 18))], [truck(seg('yellow', 8), seg('green', 8)), truck(seg('blue', 2), seg('red', 2), seg('orange', 18))], [truck(seg('yellow', 6), seg('orange', 2), seg('yellow', 16)), truck(seg('green', 8), seg('red', 16))], [truck(seg('yellow', 8), seg('orange', 6), seg('yellow', 10)), truck(seg('red', 10), seg('orange', 12))]],
  ring(seg('orange', 4), seg('green', 8)));
/** Seven trucks in four lanes. */
export const LOOP_51: LoopBoardDef = board('loop-51', 'Side by side', 26,
  [[truck(seg('red', 12), seg('yellow', 12)), truck(seg('blue', 8), seg('green', 16))], [truck(seg('green', 8), seg('red', 16)), truck(seg('green', 14), seg('blue', 10))], [truck(seg('red', 8), seg('blue', 6), seg('red', 10)), truck(seg('red', 22), seg('green', 2))], [truck(seg('red', 2), seg('green', 8), seg('red', 2))]],
  ring(seg('yellow', 12)));
/** Four lanes and nothing on the loop yet. */
export const LOOP_52: LoopBoardDef = board('loop-52', 'Empty road, full plan', 38,
  [[truck(seg('blue', 4), seg('red', 18), seg('orange', 2)), truck(seg('red', 22), seg('blue', 2))], [truck(seg('red', 4), seg('blue', 18), seg('red', 2)), truck(seg('orange', 8), seg('yellow', 14), seg('red', 2))], [truck(seg('orange', 12), seg('green', 2), seg('yellow', 10))], [truck(seg('green', 12), seg('orange', 2), seg('green', 10))]],
  ring());
/** Seven trucks, five colours. */
export const LOOP_53: LoopBoardDef = board('loop-53', 'Evening traffic', 30,
  [[truck(seg('blue', 2), seg('green', 8), seg('red', 14)), truck(seg('red', 8), seg('orange', 16))], [truck(seg('orange', 4), seg('red', 10), seg('yellow', 6)), truck(seg('orange', 6), seg('red', 14))], [truck(seg('green', 14), seg('yellow', 6), seg('green', 2)), truck(seg('orange', 8), seg('blue', 16))], [truck(seg('blue', 6), seg('red', 2), seg('orange', 14))]],
  ring(seg('yellow', 12)));
/** Three lanes again, with a little room. */
export const LOOP_54: LoopBoardDef = board('loop-54', 'After the rush', 36,
  [[truck(seg('green', 4), seg('blue', 4), seg('green', 16)), truck(seg('yellow', 18), seg('blue', 6))], [truck(seg('blue', 2), seg('green', 2), seg('red', 20)), truck(seg('green', 2), seg('blue', 10), seg('yellow', 6))], [truck(seg('green', 2), seg('blue', 2), seg('green', 20)), truck(seg('green', 2), seg('red', 18))]],
  ring(seg('red', 10)));
/** Two lanes, three trucks in each. */
export const LOOP_55: LoopBoardDef = board('loop-55', 'Three deep', 24,
  [[truck(seg('yellow', 4), seg('red', 8), seg('green', 4)), truck(seg('blue', 20), seg('red', 4)), truck(seg('blue', 22), seg('red', 2))], [truck(seg('yellow', 8), seg('red', 4), seg('yellow', 12)), truck(seg('green', 20), seg('blue', 4)), truck(seg('red', 22), seg('blue', 2))]],
  ring(seg('red', 8)));
/** Three lanes, two of them three deep. */
export const LOOP_56: LoopBoardDef = board('loop-56', 'Eight trucks', 22,
  [[truck(seg('red', 6), seg('green', 2), seg('blue', 16)), truck(seg('yellow', 6), seg('orange', 18)), truck(seg('green', 6), seg('yellow', 2), seg('red', 16))], [truck(seg('orange', 2), seg('red', 8), seg('green', 10)), truck(seg('yellow', 16)), truck(seg('blue', 4), seg('yellow', 20))], [truck(seg('orange', 4), seg('green', 2), seg('red', 18)), truck(seg('yellow', 4), seg('blue', 20))]],
  ring(seg('green', 4), seg('blue', 8)));
/** Four lanes, four colours, little room. */
export const LOOP_57: LoopBoardDef = board('loop-57', 'Gridlock', 34,
  [[truck(seg('blue', 4), seg('red', 10), seg('blue', 8)), truck(seg('green', 8), seg('blue', 8), seg('red', 8))], [truck(seg('red', 4), seg('blue', 8), seg('yellow', 12)), truck(seg('blue', 4), seg('red', 20))], [truck(seg('red', 6), seg('blue', 2), seg('green', 16)), truck(seg('green', 10), seg('blue', 4))], [truck(seg('green', 10), seg('blue', 10), seg('green', 4))]],
  ring(seg('yellow', 12)));
/** A lane four deep beside two shorter ones. */
export const LOOP_58: LoopBoardDef = board('loop-58', 'One long lane', 26,
  [[truck(seg('blue', 2), seg('red', 8), seg('blue', 14)), truck(seg('red', 4), seg('orange', 10)), truck(seg('yellow', 22)), truck(seg('green', 4), seg('red', 6), seg('green', 14))], [truck(seg('blue', 8), seg('red', 16)), truck(seg('yellow', 4), seg('orange', 20)), truck(seg('blue', 4), seg('green', 6), seg('red', 14))], [truck(seg('yellow', 14), seg('orange', 2), seg('yellow', 8)), truck(seg('orange', 4), seg('blue', 20))]],
  ring(seg('orange', 12)));
/** Two lanes of four trucks. */
export const LOOP_59: LoopBoardDef = board('loop-59', 'Two long lanes', 24,
  [[truck(seg('red', 14), seg('yellow', 4), seg('red', 6)), truck(seg('green', 2), seg('red', 22)), truck(seg('orange', 4), seg('green', 20)), truck(seg('yellow', 6), seg('orange', 18))], [truck(seg('yellow', 14), seg('orange', 2), seg('yellow', 6)), truck(seg('red', 4), seg('blue', 2), seg('orange', 16)), truck(seg('red', 2), seg('blue', 22)), truck(seg('green', 2), seg('orange', 2), seg('yellow', 18))]],
  ring(seg('orange', 6)));
/** Six trucks, five colours. */
export const LOOP_60: LoopBoardDef = board('loop-60', 'Six and five', 28,
  [[truck(seg('orange', 16), seg('yellow', 2), seg('orange', 6)), truck(seg('red', 14), seg('blue', 10))], [truck(seg('green', 2), seg('orange', 2), seg('green', 20)), truck(seg('red', 4), seg('blue', 10), seg('red', 10))], [truck(seg('green', 2), seg('blue', 4), seg('yellow', 10)), truck(seg('red', 20))]],
  ring(seg('yellow', 12)));
/** The loop starts busy. */
export const LOOP_61: LoopBoardDef = board('loop-61', 'Busy start', 24,
  [[truck(seg('red', 4), seg('yellow', 4), seg('blue', 16)), truck(seg('red', 4), seg('yellow', 20))], [truck(seg('red', 8), seg('blue', 8), seg('red', 2)), truck(seg('green', 8), seg('red', 6), seg('green', 10))], [truck(seg('red', 10)), truck(seg('red', 6), seg('green', 6), seg('red', 10))]],
  ring(seg('red', 22)));
/** Three lanes, two of them three deep. */
export const LOOP_62: LoopBoardDef = board('loop-62', 'Eight in three', 20,
  [[truck(seg('orange', 2), seg('green', 22)), truck(seg('green', 2), seg('red', 22)), truck(seg('green', 2), seg('red', 2), seg('blue', 18))], [truck(seg('red', 2), seg('orange', 22)), truck(seg('yellow', 4), seg('green', 20)), truck(seg('blue', 6), seg('red', 18))], [truck(seg('red', 2), seg('orange', 22)), truck(seg('orange', 2), seg('red', 2), seg('yellow', 20))]],
  ring(seg('green', 2)));
/** Three lanes, three trucks each. */
export const LOOP_63: LoopBoardDef = board('loop-63', 'Three deep everywhere', 22,
  [[truck(seg('blue', 2), seg('yellow', 8), seg('red', 10)), truck(seg('yellow', 12), seg('blue', 12)), truck(seg('red', 12), seg('yellow', 6), seg('blue', 6))], [truck(seg('green', 2), seg('blue', 2), seg('red', 20)), truck(seg('yellow', 6), seg('blue', 18)), truck(seg('red', 14), seg('green', 10))], [truck(seg('blue', 2), seg('green', 12), seg('yellow', 10)), truck(seg('blue', 12), seg('red', 12)), truck(seg('blue', 18), seg('yellow', 6))]],
  ring(seg('red', 4)));
/** Seven trucks with room on the loop. */
export const LOOP_64: LoopBoardDef = board('loop-64', 'Easy traffic', 22,
  [[truck(seg('red', 4), seg('yellow', 10), seg('blue', 10)), truck(seg('orange', 12), seg('red', 12))], [truck(seg('red', 10), seg('orange', 2), seg('yellow', 10)), truck(seg('green', 4), seg('blue', 20))], [truck(seg('red', 2), seg('yellow', 2), seg('red', 20)), truck(seg('blue', 4), seg('green', 12), seg('orange', 8))], [truck(seg('blue', 14), seg('orange', 2), seg('green', 8))]],
  ring(seg('yellow', 2)));
/** Black and its three dots, with three familiar colours. */
export const LOOP_65: LoopBoardDef = board('loop-65', 'A black truck', 22,
  [[truck(seg('red', 4), seg('black', 2), seg('red', 16)), truck(seg('black', 20))], [truck(seg('black', 6), seg('red', 14), seg('blue', 4)), truck(seg('green', 12), seg('black', 12))], [truck(seg('red', 10), seg('blue', 6), seg('red', 4)), truck(seg('blue', 4), seg('black', 8), seg('green', 12))]],
  ring(seg('blue', 10)));
/** One lane four deep, one of two. */
export const LOOP_66: LoopBoardDef = board('loop-66', 'Long and short', 20,
  [[truck(seg('red', 2), seg('yellow', 2), seg('blue', 20)), truck(seg('red', 20)), truck(seg('yellow', 8), seg('orange', 6), seg('red', 10)), truck(seg('red', 16), seg('orange', 8))], [truck(seg('orange', 4), seg('blue', 4), seg('green', 14)), truck(seg('yellow', 2), seg('red', 22)), truck(seg('red', 4), seg('orange', 2), seg('yellow', 18))], [truck(seg('yellow', 2), seg('orange', 2), seg('yellow', 16)), truck(seg('red', 14), seg('orange', 2), seg('red', 8))]],
  ring(seg('green', 10)));
/** Eight trucks in four lanes. */
export const LOOP_67: LoopBoardDef = board('loop-67', 'Full yard', 24,
  [[truck(seg('red', 2), seg('yellow', 20)), truck(seg('green', 4), seg('blue', 20))], [truck(seg('red', 2), seg('yellow', 22)), truck(seg('blue', 4), seg('green', 20))], [truck(seg('red', 2), seg('yellow', 2), seg('red', 20)), truck(seg('orange', 8), seg('green', 16))], [truck(seg('red', 2), seg('yellow', 4), seg('red', 18)), truck(seg('red', 2), seg('green', 4), seg('orange', 16))]],
  ring(seg('green', 4)));
/** Four lanes and an empty loop. */
export const LOOP_68: LoopBoardDef = board('loop-68', 'Clear road', 20,
  [[truck(seg('green', 6), seg('red', 2), seg('orange', 16)), truck(seg('red', 12), seg('green', 12))], [truck(seg('orange', 8), seg('red', 4), seg('yellow', 12)), truck(seg('blue', 12), seg('red', 12))], [truck(seg('red', 6), seg('green', 6), seg('red', 12))], [truck(seg('yellow', 12), seg('blue', 12))]],
  ring());
/** Six trucks, five colours, a little room. */
export const LOOP_69: LoopBoardDef = board('loop-69', 'Steady flow', 32,
  [[truck(seg('red', 2), seg('green', 20), seg('orange', 2)), truck(seg('yellow', 16), seg('red', 8))], [truck(seg('red', 4), seg('blue', 16), seg('green', 4)), truck(seg('red', 18), seg('blue', 4))], [truck(seg('red', 4), seg('blue', 4), seg('red', 6)), truck(seg('orange', 10), seg('red', 6), seg('yellow', 8))]],
  ring(seg('orange', 12)));
/** Ten trucks and nothing on the loop to start. */
export const LOOP_70: LoopBoardDef = board('loop-70', 'Empty loop, ten trucks', 20,
  [[truck(seg('blue', 10), seg('red', 14)), truck(seg('blue', 8), seg('green', 6), seg('blue', 10)), truck(seg('red', 4), seg('green', 20))], [truck(seg('red', 8), seg('yellow', 16)), truck(seg('red', 10), seg('blue', 4), seg('red', 10)), truck(seg('green', 4), seg('orange', 14), seg('green', 6))], [truck(seg('green', 8), seg('blue', 16)), truck(seg('blue', 14), seg('green', 4), seg('orange', 6))], [truck(seg('yellow', 8), seg('red', 6), seg('blue', 10)), truck(seg('orange', 4), seg('red', 20))]],
  ring());
/** Three lanes of three. */
export const LOOP_71: LoopBoardDef = board('loop-71', 'Nine trucks', 26,
  [[truck(seg('red', 14), seg('orange', 2), seg('red', 8)), truck(seg('orange', 2), seg('red', 2), seg('yellow', 20)), truck(seg('green', 4), seg('orange', 20))], [truck(seg('orange', 18), seg('yellow', 2), seg('orange', 2)), truck(seg('yellow', 4), seg('red', 20)), truck(seg('orange', 4), seg('red', 20))], [truck(seg('blue', 2), seg('red', 4), seg('yellow', 10)), truck(seg('blue', 22)), truck(seg('red', 4), seg('green', 20))]],
  ring(seg('yellow', 12)));
/** Three lanes of three and little room. */
export const LOOP_72: LoopBoardDef = board('loop-72', 'Deep queues', 24,
  [[truck(seg('blue', 2), seg('red', 22)), truck(seg('yellow', 4), seg('blue', 20)), truck(seg('green', 4), seg('yellow', 12), seg('red', 8))], [truck(seg('yellow', 2), seg('red', 8), seg('blue', 8)), truck(seg('red', 2), seg('blue', 2), seg('green', 20)), truck(seg('red', 16), seg('yellow', 8))], [truck(seg('yellow', 6), seg('red', 18)), truck(seg('red', 8), seg('yellow', 16)), truck(seg('blue', 16), seg('red', 8))]],
  ring(seg('red', 6)));
/** Eight trucks in three lanes. */
export const LOOP_73: LoopBoardDef = board('loop-73', 'Two deep, one shallow', 20,
  [[truck(seg('red', 4), seg('yellow', 12), seg('red', 8)), truck(seg('blue', 4), seg('red', 6), seg('yellow', 14)), truck(seg('green', 12), seg('red', 12))], [truck(seg('red', 20)), truck(seg('red', 14), seg('yellow', 10)), truck(seg('yellow', 8), seg('red', 2), seg('green', 12))], [truck(seg('red', 2), seg('yellow', 2), seg('orange', 20)), truck(seg('red', 4), seg('blue', 20))]],
  ring(seg('yellow', 2), seg('orange', 4)));
/** Black with three familiar colours. */
export const LOOP_74: LoopBoardDef = board('loop-74', 'Black again', 26,
  [[truck(seg('blue', 4), seg('black', 20)), truck(seg('green', 2), seg('black', 16), seg('green', 2))], [truck(seg('red', 2), seg('black', 2), seg('green', 20)), truck(seg('red', 2), seg('black', 2), seg('blue', 20))], [truck(seg('red', 16), seg('green', 2), seg('red', 4)), truck(seg('black', 6), seg('green', 16), seg('black', 2))]],
  ring(seg('green', 6)));
/** Every colour so far, seven trucks. */
export const LOOP_75: LoopBoardDef = board('loop-75', 'Six colours on the road', 22,
  [[truck(seg('green', 2), seg('blue', 2), seg('yellow', 18)), truck(seg('red', 8), seg('orange', 16))], [truck(seg('red', 16), seg('black', 2), seg('red', 4)), truck(seg('green', 4), seg('blue', 20))], [truck(seg('blue', 2), seg('red', 4), seg('black', 18)), truck(seg('orange', 6), seg('green', 18))], [truck(seg('yellow', 6), seg('orange', 2), seg('red', 16))]],
  ring(seg('black', 4)));
/** Two lanes of four trucks. */
export const LOOP_76: LoopBoardDef = board('loop-76', 'Long haul', 20,
  [[truck(seg('orange', 2), seg('green', 12), seg('yellow', 6)), truck(seg('blue', 2), seg('red', 22)), truck(seg('yellow', 2), seg('blue', 22)), truck(seg('red', 4), seg('yellow', 20))], [truck(seg('green', 2), seg('orange', 2), seg('green', 20)), truck(seg('green', 4), seg('orange', 20)), truck(seg('yellow', 18), seg('green', 6)), truck(seg('red', 2), seg('yellow', 2), seg('red', 20))]],
  ring(seg('green', 4)));
/** Three lanes of three, five colours. */
export const LOOP_77: LoopBoardDef = board('loop-77', 'Nine on the move', 20,
  [[truck(seg('blue', 2), seg('green', 4), seg('yellow', 18)), truck(seg('orange', 4), seg('green', 2), seg('blue', 16)), truck(seg('red', 18), seg('green', 6))], [truck(seg('red', 2), seg('yellow', 18)), truck(seg('blue', 12), seg('red', 12)), truck(seg('green', 4), seg('orange', 20))], [truck(seg('yellow', 6), seg('red', 6), seg('blue', 10)), truck(seg('green', 20)), truck(seg('yellow', 6), seg('green', 12), seg('red', 6))]],
  ring(seg('red', 4), seg('blue', 8)));
// END first stretch
/** Rule lessons in the bank only; campaign placement is a separate decision. */
export const LOOP_200: LoopBoardDef = board('loop-200', 'Open the latch', 28,
  [[{ ...truck(seg('green', 4), seg('blue', 4), seg('green', 10)), pourAfter: '1:0' }, truck(seg('red', 14), seg('blue', 10))],
    [truck(seg('green', 6), seg('blue', 10), seg('red', 6))], [truck(seg('green', 4), seg('red', 10))]], ring(seg('red', 18)));
export const LOOP_201: LoopBoardDef = board('loop-201', 'Half the bed', 20,
  [[{ ...truck(seg('red', 2), seg('green', 2), seg('red', 8)), capacity: 12 }, truck(seg('blue', 2), seg('red', 8))],
    [truck(seg('red', 2), seg('blue', 20))], [truck(seg('green', 2), seg('blue', 2), seg('green', 20))]], ring(seg('red', 16)));
export const LOOP_202: LoopBoardDef = { ...board('loop-202', 'Unload together', 24,
  [[truck(seg('blue', 4), seg('red', 16)), truck(seg('blue', 8), seg('green', 16))],
    [truck(seg('red', 8), seg('blue', 4), seg('red', 8))], [truck(seg('green', 8), seg('red', 8), seg('blue', 8))]], ring(seg('red', 8))),
  couplings: [['0:0', '1:0']] };

export const LOOP_BOARDS: readonly LoopBoardDef[] = [LOOP_1, LOOP_2, LOOP_3, LOOP_4, LOOP_5, LOOP_6, LOOP_7, LOOP_8, LOOP_9, LOOP_10, LOOP_11, LOOP_12, LOOP_13, LOOP_14, LOOP_15, LOOP_16, LOOP_17, LOOP_18, LOOP_19, LOOP_20, LOOP_21, LOOP_22, LOOP_23, LOOP_24, LOOP_25, LOOP_26, LOOP_27, LOOP_28, LOOP_29, LOOP_30, LOOP_31, LOOP_32, LOOP_33, LOOP_34, LOOP_35, LOOP_36, LOOP_37, LOOP_38, LOOP_39, LOOP_40, LOOP_41, LOOP_42, LOOP_43, LOOP_44, LOOP_45, LOOP_46, LOOP_47, LOOP_48, LOOP_50, LOOP_51, LOOP_52, LOOP_53, LOOP_54, LOOP_55, LOOP_56, LOOP_57, LOOP_58, LOOP_59, LOOP_60, LOOP_61, LOOP_62, LOOP_63, LOOP_64, LOOP_65, LOOP_66, LOOP_67, LOOP_68, LOOP_69, LOOP_70, LOOP_71, LOOP_72, LOOP_73, LOOP_74, LOOP_75, LOOP_76, LOOP_77, LOOP_200, LOOP_201, LOOP_202];
