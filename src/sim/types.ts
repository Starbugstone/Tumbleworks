import type { BeltShape } from '../engine/belt-path';
/** Every marble colour, in palette order. Orange's luminance sits between the dark three and yellow. */
export const COLORS = ['red', 'blue', 'green', 'yellow', 'orange'] as const;
export type Color = (typeof COLORS)[number];
/** One distinct letter per colour, for compact search keys. Never key on `color[0]`: blue and black share it. */
export const COLOR_CODE: Readonly<Record<Color, string>> = { red: 'r', blue: 'b', green: 'g', yellow: 'y', orange: 'o' };

export interface Packet {
  readonly color: Color;
  readonly count: number;
}

export interface BoardDef {
  readonly trackShape?: BeltShape;
  readonly id: string;
  readonly title: string;
  /** Marbles the belt holds before it is full. Entry is refused above this. */
  readonly beltCapacity: number;
  /** Marbles each box holds. */
  readonly boxSize: number;
  /** One queue of trays per supply column, front tray first. Only the front tray can be tipped. */
  readonly supplies: readonly (readonly Packet[])[];
  /** One queue of boxes per dock, front box first. Every dock's front box waits for marbles at once. */
  readonly docks: readonly (readonly Color[])[];
}

export interface Marble {
  /** Stable for the whole game, including across undo. Assigned supply by supply, packet by packet. */
  readonly id: number;
  readonly color: Color;
}

export interface SupplyPacket {
  readonly color: Color;
  readonly marbles: readonly Marble[];
}

export type SimStatus = 'playing' | 'won' | 'jammed';
