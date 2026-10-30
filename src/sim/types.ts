export type Color = 'red' | 'blue' | 'green' | 'yellow';

export interface Packet {
  readonly color: Color;
  readonly count: number;
}

export interface BoardDef {
  readonly id: string;
  readonly title: string;
  readonly beltCapacity: number;
  /** Marbles each box holds. */
  readonly boxSize: number;
  /** One queue per supply, front packet first. */
  readonly supplies: readonly (readonly Packet[])[];
  /** The receiver queue, front box first. */
  readonly boxes: readonly Color[];
}

export interface SimConfig {
  /** Sampling points around the loop. Not visible slots, and not the capacity. */
  readonly beltPositions: number;
  readonly entryPosition: number;
  readonly deliveryPosition: number;
  /** Ticks the belt takes to advance one position. */
  readonly ticksPerStep: number;
}

export interface Marble {
  /** Stable for the whole game, including across undo. Assigned supply by supply, packet by packet. */
  readonly id: number;
  readonly color: Color;
}

export interface BeltMarble extends Marble {
  /** Integer in [0, beltPositions). Advances by one each belt step. */
  position: number;
}

export interface SupplyPacket {
  readonly color: Color;
  readonly marbles: readonly Marble[];
}

export type SimStatus = 'playing' | 'won' | 'jammed';

/** Plain JSON data, so a full snapshot is one structuredClone. */
export interface SimState {
  tick: number;
  /** Ticks into the current belt step, in [0, ticksPerStep). Used to interpolate drawing. */
  stepTick: number;
  /** Remaining packets per supply, front first. */
  supplies: SupplyPacket[][];
  /** Released marbles waiting at the entry gate, first in first out. They count against capacity. */
  pending: Marble[];
  belt: BeltMarble[];
  /** Index into board.boxes of the active box. Equals boxes.length once all are filled. */
  frontBox: number;
  /** Marbles delivered into the active box so far. */
  frontBoxFill: number;
  status: SimStatus;
}

export type SimEvent =
  | { readonly type: 'entered'; readonly marbleId: number; readonly position: number }
  | { readonly type: 'delivered'; readonly marbleId: number; readonly boxIndex: number; readonly slot: number }
  | { readonly type: 'boxFilled'; readonly boxIndex: number }
  | { readonly type: 'won' }
  | { readonly type: 'jammed' };

export type ReleaseResult =
  | {
      readonly ok: true;
      readonly supply: number;
      readonly color: Color;
      readonly marbles: readonly Marble[];
      /** Non-empty only if the release itself ended the game (a jam known at tap time). */
      readonly events: readonly SimEvent[];
    }
  | {
      readonly ok: false;
      readonly reason: 'no-space';
      readonly needed: number;
      readonly free: number;
      /** True if a marble already on the belt or pending can still deliver and free space. */
      readonly canDrain: boolean;
    }
  | { readonly ok: false; readonly reason: 'empty' | 'finished' };
