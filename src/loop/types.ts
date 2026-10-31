import type { BeltShape } from '../engine/belt-path';
import type { Color, Packet } from '../sim/types';

/** One cargo truck: colour segments from the loop end backward. Totals never exceed the capacity. */
export interface TruckDef {
  readonly segments: readonly Packet[];
}

export interface LoopBoardDef {
  readonly trackShape?: BeltShape;
  readonly id: string;
  readonly title: string;
  /** Marbles the loop holds before it is full. Unloading pauses above this. */
  readonly loopCapacity: number;
  /** Marbles a truck holds; a truck full of one colour clears the line. */
  readonly truckCapacity: number;
  /** One queue of trucks per lane, front truck first. Only the front truck touches the loop. */
  readonly lanes: readonly (readonly TruckDef[])[];
  /** Marbles already circulating when the level starts, in loop order. */
  readonly loop: readonly Packet[];
}

export type { Color };
