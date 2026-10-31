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
export const LOOP_6: LoopBoardDef = { ...LOOP_4, id: 'loop-6', title: 'Truck bridge', trackShape: 'eight' };
export const LOOP_7: LoopBoardDef = { ...LOOP_5, id: 'loop-7', title: 'Eight in motion', trackShape: 'wide-eight' };
export const LOOP_BOARDS: readonly LoopBoardDef[] = [LOOP_1, LOOP_2, LOOP_3, LOOP_4, LOOP_5, LOOP_6, LOOP_7];
