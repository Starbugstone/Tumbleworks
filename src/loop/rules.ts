import { COLORS, type Color, type Marble, type SimStatus } from '../sim/types';
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
  readonly id: string;
  readonly capacity: number;
  pourAfter: string | null;
  coupledWith: string | null;
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
  | { readonly ok: true; readonly lane: number; readonly color: Color; readonly marbles: readonly number[]; readonly pours: readonly { lane: number; color: Color; marbles: readonly number[] }[] }
  | { readonly ok: false; readonly reason: 'empty' | 'busy' | 'single' | 'finished' | 'latched' | 'coupled' };

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
      const capacity = truck.capacity ?? board.truckCapacity;
      if (!Number.isSafeInteger(capacity) || capacity <= 0) throw new Error(`Invalid truck capacity ${capacity}`);
      if (load > capacity) throw new Error(`Board ${board.id}: lane ${lane} truck ${index} carries ${load} of ${capacity}`);
      // Adjacent segments of one colour would let a one-colour truck be poured; they are a board error.
      for (let at = 1; at < segments.length; at++) {
        if (segments[at]!.color === segments[at - 1]!.color) throw new Error(`Board ${board.id}: lane ${lane} truck ${index} repeats ${segments[at]!.color} in adjacent segments`);
      }
      if (!segments.length) throw new Error(`Board ${board.id}: lane ${lane} truck ${index} is empty`);
      return { id: truck.id ?? `${lane}:${index}`, capacity, pourAfter: truck.pourAfter ?? null, coupledWith: null as string | null, index, segments, unloading: [], complete: false };
    }));
    for (const entry of board.loop) packet(entry.color, entry.count, 'on-loop', null, null);
    const byId = new Map(lanes.flat().map((truck) => [truck.id, truck]));
    if ([...byId.keys()].some((id) => !id)) throw new Error('Empty truck identity');
    if (byId.size !== lanes.flat().length) throw new Error('Duplicate truck identity');
    for (const truck of byId.values()) {
      const seen = new Set([truck.id]);
      let dependency = truck.pourAfter;
      while (dependency !== null) {
        if (seen.has(dependency)) throw new Error('Cyclic latch dependency');
        seen.add(dependency);
        const prerequisite = byId.get(dependency);
        if (!prerequisite) throw new Error(`Unknown latch prerequisite ${dependency}`);
        dependency = prerequisite.pourAfter;
      }
    }
    for (const [a, b] of board.couplings ?? []) {
      const first = byId.get(a), second = byId.get(b);
      if (!first || !second || first === second || first.coupledWith || second.coupledWith) throw new Error('Couplings must be disjoint pairs of known trucks');
      first.coupledWith = b; second.coupledWith = a;
    }
    // A truck never pours its deepest segment, so that segment fixes the colour the truck ends up with.
    const totals = new Map<Color, number>();
    for (const marble of marbles) totals.set(marble.color, (totals.get(marble.color) ?? 0) + 1);
    const homes = new Map<Color, number>();
    for (const queue of lanes) for (const truck of queue) {
      const deepest = truck.segments[truck.segments.length - 1]!.color;
      homes.set(deepest, (homes.get(deepest) ?? 0) + truck.capacity);
    }
    for (const color of new Set([...totals.keys(), ...homes.keys()])) {
      const total = totals.get(color) ?? 0;
      const capacity = homes.get(color) ?? 0;
      if (total !== capacity) throw new Error(`Board ${board.id}: ${total} ${color} marbles for ${capacity} ${color} capacity`);
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
    if (!truck || truck.unloading.length || this.load(truck) >= truck.capacity) return null;
    return truck.segments[0]?.color ?? 'any';
  }
  private laneFor(color: Color): number | null {
    for (let lane = 0; lane < this.current.lanes.length; lane++) {
      const wants = this.wants(lane);
      if (wants === color || wants === 'any') return lane;
    }
    return null;
  }

  /** All members are checked before either unloading queue changes. */
  tapLanes(lane: number): number[] {
    const truck = this.front(lane);
    if (!truck) return [];
    if (!truck.coupledWith) return [lane];
    const partner = this.current.lanes.findIndex((queue) => queue[0]?.id === truck.coupledWith);
    return partner < 0 ? [] : [lane, partner].sort((a, b) => a - b);
  }

  tapReason(lane: number): Extract<TapResult, { ok: false }>['reason'] | null {
    if (this.status !== 'playing') return 'finished';
    const truck = this.front(lane);
    if (!truck) return 'empty';
    if (truck.pourAfter) return 'latched';
    const members = this.tapLanes(lane);
    if (!members.length) return 'coupled';
    for (const member of members) {
      const candidate = this.front(member)!;
      const reason = candidate.pourAfter ? 'latched' : candidate.unloading.length ? 'busy' : candidate.segments.length < 2 ? 'single' : null;
      if (reason) return member === lane ? reason : 'coupled';
    }
    return null;
  }

  /** A coupled pair is one successor, represented by its first lane. */
  actions(): number[] {
    return this.current.lanes.flatMap((_, lane) => this.tapReason(lane) === null && this.tapLanes(lane)[0] === lane ? [lane] : []);
  }

  tap(lane: number): TapResult {
    const reason = this.tapReason(lane);
    if (reason) return { ok: false, reason };
    const pours = this.tapLanes(lane).map((member) => {
      const truck = this.front(member)!;
      const segment = truck.segments.shift()!;
      truck.unloading = [...segment.marbles];
      for (const id of segment.marbles) this.current.marbles[id]!.status = 'unloading';
      return { lane: member, color: segment.color, marbles: segment.marbles };
    });
    this.evaluateStatus([]);
    const tapped = pours.find((pour) => pour.lane === lane)!;
    return { ok: true, ...tapped, pours };
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
    if (fill >= truck.capacity && truck.segments.length === 1) {
      truck.complete = true;
      this.current.lanes[lane]!.shift();
      for (const remaining of this.current.lanes.flat()) {
        if (remaining.pourAfter === truck.id) remaining.pourAfter = null;
        if (remaining.coupledWith === truck.id) remaining.coupledWith = null;
      }
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

  /** True while some front truck still has a segment to pour; a truck of one colour cannot be tapped. */
  canPour(): boolean {
    return this.actions().length > 0;
  }

  /**
   * A jam is any dead end: a full loop nobody can take from, or, with nothing left to pour and nothing
   * unloading, a loop nobody can take from. The second case happens when the marbles a truck still
   * needs sit in a truck queued behind it. Latches never prevent intake. With a full undrainable loop,
   * a tap only starts unloading (which itself blocks intake), so no tap can create a drain. With spare
   * room, pending units or a legal whole action can still help; a future unlock with neither cannot.
   */
  private evaluateStatus(events: LoopEvent[]): void {
    const state = this.current;
    if (state.status !== 'playing') return;
    if (state.lanes.every((queue) => queue.length === 0)) {
      state.status = 'won';
      events.push({ type: 'won' });
    } else if (!this.canDrain() && (this.free <= 0 || (this.pending === 0 && !this.canPour()))) {
      state.status = 'jammed';
      events.push({ type: 'jammed' });
    }
  }
}

/** Shared settled-search identity; unit identities and transport positions do not affect settled choices. */
export function loopStateKey(state: Readonly<LoopState>): string {
  return JSON.stringify([state.status, state.lanes.map((queue) => queue.map((truck) => [
    truck.id, truck.index, truck.capacity, truck.pourAfter, truck.coupledWith,
    truck.segments.map((segment) => [segment.color, segment.marbles.length]),
    truck.unloading.map((id) => state.marbles[id]!.color),
  ])), COLORS.map((color) => state.marbles.filter((marble) => marble.status === 'on-loop' && marble.color === color).length)]);
}
