import type { Color, Marble, SimStatus } from '../sim/types';
import type { LoopBoardDef } from './types';

export type LoopMarbleStatus = 'in-truck' | 'unloading' | 'on-loop' | 'absorbing';

export interface LoopMarble extends Marble {
  status: LoopMarbleStatus;
  /** The truck it sits in or is heading for: lane and position in that lane's original queue. */
  lane: number | null;
  truck: number | null;
}

export interface Segment { readonly color: Color; readonly marbles: number[] }

export interface TruckState {
  /** Position in the lane's original queue, stable for the whole game. */
  readonly index: number;
  /** Loop end first. A truck is complete when one segment holds the whole capacity. */
  segments: Segment[];
  /** Marbles of the segment being poured out, still to leave the truck. */
  unloading: number[];
  complete: boolean;
}

export interface LoopState {
  lanes: TruckState[][];
  marbles: LoopMarble[];
  status: SimStatus;
}

export type LoopEvent =
  | { readonly type: 'complete'; readonly lane: number; readonly truck: number; readonly color: Color }
  | { readonly type: 'won' }
  | { readonly type: 'jammed' };

export type TapResult =
  | { readonly ok: true; readonly lane: number; readonly color: Color; readonly marbles: readonly number[] }
  | { readonly ok: false; readonly reason: 'empty' | 'busy' | 'single' | 'finished' };

export type PassResult =
  | { readonly result: 'absorb'; readonly truck: number; readonly fill: number; readonly events: LoopEvent[] }
  | { readonly result: 'pass' };

/**
 * Loop Sort is tube sorting on a ring. Each lane's front truck absorbs marbles of its loop-end
 * colour as they pass; a tap pours that loop-end segment back onto the loop to reach what is behind
 * it. A truck full of one colour clears the line and the next truck in the lane rolls up.
 */
export class LoopRules {
  private current: LoopState;

  constructor(readonly board: LoopBoardDef) {
    const marbles: LoopMarble[] = [];
    const packet = (color: Color, count: number, status: LoopMarbleStatus, lane: number | null, truck: number | null): number[] =>
      Array.from({ length: count }, () => {
        marbles.push({ id: marbles.length, color, status, lane, truck });
        return marbles.length - 1;
      });
    const lanes = board.lanes.map((queue, lane) => queue.map((truck, index) => {
      const segments = truck.segments.map((segment) => ({ color: segment.color, marbles: packet(segment.color, segment.count, 'in-truck', lane, index) }));
      const load = segments.reduce((sum, segment) => sum + segment.marbles.length, 0);
      if (load > board.truckCapacity) throw new Error(`Board ${board.id}: lane ${lane} truck ${index} carries ${load} of ${board.truckCapacity}`);
      if (!segments.length) throw new Error(`Board ${board.id}: lane ${lane} truck ${index} is empty`);
      return { index, segments, unloading: [], complete: false };
    }));
    for (const entry of board.loop) packet(entry.color, entry.count, 'on-loop', null, null);
    const trucks = lanes.reduce((sum, queue) => sum + queue.length, 0);
    if (marbles.length !== trucks * board.truckCapacity) throw new Error(`Board ${board.id}: ${marbles.length} marbles cannot fill ${trucks} trucks of ${board.truckCapacity}`);
    // A truck never pours its deepest segment, so that segment fixes the colour the truck ends up with.
    const totals = new Map<Color, number>();
    for (const marble of marbles) totals.set(marble.color, (totals.get(marble.color) ?? 0) + 1);
    const homes = new Map<Color, number>();
    for (const queue of lanes) for (const truck of queue) {
      const deepest = truck.segments[truck.segments.length - 1]!.color;
      homes.set(deepest, (homes.get(deepest) ?? 0) + 1);
    }
    for (const color of new Set([...totals.keys(), ...homes.keys()])) {
      const total = totals.get(color) ?? 0;
      const trucks = homes.get(color) ?? 0;
      if (total !== trucks * board.truckCapacity) throw new Error(`Board ${board.id}: ${total} ${color} marbles for ${trucks} ${color} trucks`);
    }
    if (board.loop.reduce((sum, entry) => sum + entry.count, 0) > board.loopCapacity) throw new Error(`Board ${board.id} starts over loop capacity`);
    this.current = { lanes, marbles, status: 'playing' };
    this.evaluateStatus([]);
  }

  get state(): Readonly<LoopState> { return this.current; }
  get status(): SimStatus { return this.current.status; }
  get occupancy(): number { return this.current.marbles.filter((marble) => marble.status === 'on-loop').length; }
  get free(): number { return this.board.loopCapacity - this.occupancy; }
  get pending(): number { return this.current.marbles.filter((marble) => marble.status === 'unloading').length; }
  front(lane: number): TruckState | null { return this.current.lanes[lane]?.[0] ?? null; }
  load(truck: TruckState): number { return truck.segments.reduce((sum, segment) => sum + segment.marbles.length, 0) + truck.unloading.length; }
  /** The colour a lane's front truck takes right now, or null when it is busy, full or missing. */
  wants(lane: number): Color | 'any' | null {
    const truck = this.front(lane);
    if (!truck || truck.unloading.length || this.load(truck) >= this.board.truckCapacity) return null;
    return truck.segments[0]?.color ?? 'any';
  }
  private laneFor(color: Color): number | null {
    for (let lane = 0; lane < this.current.lanes.length; lane++) {
      const wants = this.wants(lane);
      if (wants === color || wants === 'any') return lane;
    }
    return null;
  }

  /** Pour the front truck's loop-end segment onto the loop, to reach the segment behind it. */
  tap(lane: number): TapResult {
    if (this.status !== 'playing') return { ok: false, reason: 'finished' };
    const truck = this.front(lane);
    const segment = truck?.segments[0];
    if (!truck || !segment) return { ok: false, reason: 'empty' };
    if (truck.unloading.length) return { ok: false, reason: 'busy' };
    // A truck of one colour is never emptied: it only has to fill up. So no truck is ever empty.
    if (truck.segments.length < 2) return { ok: false, reason: 'single' };
    truck.segments.shift();
    truck.unloading = [...segment.marbles];
    for (const id of segment.marbles) this.current.marbles[id]!.status = 'unloading';
    this.evaluateStatus([]);
    return { ok: true, lane, color: segment.color, marbles: segment.marbles };
  }

  /** The next unloading marble of a lane leaves the truck onto the loop, if the loop has room. */
  entered(lane: number): number | null {
    const truck = this.front(lane);
    const id = truck?.unloading[0];
    if (this.status !== 'playing' || !truck || id === undefined || this.free <= 0) return null;
    truck.unloading.shift();
    Object.assign(this.current.marbles[id]!, { status: 'on-loop', lane: null, truck: null });
    this.evaluateStatus([]);
    return id;
  }

  /** A loop marble passes a lane's mouth. Absorbing reserves its place; a full single colour clears the line. */
  pass(marbleId: number, lane: number): PassResult {
    const marble = this.current.marbles[marbleId];
    const truck = this.front(lane);
    const wants = this.wants(lane);
    if (this.status !== 'playing' || !marble || marble.status !== 'on-loop' || !truck || (wants !== marble.color && wants !== 'any')) return { result: 'pass' };
    Object.assign(marble, { status: 'absorbing', lane, truck: truck.index });
    const first = truck.segments[0];
    if (first && first.color === marble.color) first.marbles.push(marbleId);
    else truck.segments.unshift({ color: marble.color, marbles: [marbleId] });
    const events: LoopEvent[] = [];
    const fill = this.load(truck);
    if (fill >= this.board.truckCapacity && truck.segments.length === 1) {
      truck.complete = true;
      this.current.lanes[lane]!.shift();
      events.push({ type: 'complete', lane, truck: truck.index, color: marble.color });
    }
    this.evaluateStatus(events);
    return { result: 'absorb', truck: truck.index, fill, events };
  }

  captured(marbleId: number): void {
    const marble = this.current.marbles[marbleId];
    if (marble?.status === 'absorbing') marble.status = 'in-truck';
  }

  snapshot(): LoopState { return structuredClone(this.current); }
  restore(snapshot: LoopState): void { this.current = structuredClone(snapshot); }

  /** True while something already on the loop can still be taken by a truck. */
  canDrain(): boolean {
    return this.current.marbles.some((marble) => marble.status === 'on-loop' && this.laneFor(marble.color) !== null);
  }

  private evaluateStatus(events: LoopEvent[]): void {
    const state = this.current;
    if (state.status !== 'playing') return;
    if (state.lanes.every((queue) => queue.length === 0)) {
      state.status = 'won';
      events.push({ type: 'won' });
    } else if (this.free <= 0 && !this.canDrain()) {
      state.status = 'jammed';
      events.push({ type: 'jammed' });
    }
  }
}
