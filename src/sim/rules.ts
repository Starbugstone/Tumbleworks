import type { BoardDef, Color, Marble, SimStatus, SupplyPacket } from './types';

export type MarbleStatus = 'in-supply' | 'pouring' | 'on-belt' | 'dropping' | 'in-box';

/** Box and slot stay attached to a marble after capture, including after a swap. */
export type RulesMarble = Marble & (
  | { status: 'in-supply' | 'pouring' | 'on-belt'; boxIndex: null; slot: null }
  | { status: 'dropping' | 'in-box'; boxIndex: number; slot: number }
);

export interface RulesState {
  supplies: SupplyPacket[][];
  /** Indexed by stable, supply-first marble ID; includes unreleased and captured marbles. */
  marbles: RulesMarble[];
  activeBox: number;
  activeFill: number;
  waitingForSwap: boolean;
  status: SimStatus;
}

/** All progress lives in this plain state; there are no counters outside the snapshot. */
export type RulesSnapshot = RulesState;

export type RulesEvent =
  | { readonly type: 'boxFull'; readonly boxIndex: number }
  | { readonly type: 'won' }
  | { readonly type: 'jammed' };

export type ReleaseResult =
  | {
      readonly ok: true;
      readonly supply: number;
      readonly color: Color;
      readonly marbles: readonly Marble[];
      readonly events: readonly RulesEvent[];
    }
  | {
      readonly ok: false;
      readonly reason: 'no-space';
      readonly needed: number;
      readonly free: number;
      readonly canDrain: boolean;
    }
  | { readonly ok: false; readonly reason: 'empty' | 'finished' };

export class MachineRules {
  private current: RulesState;

  constructor(readonly board: BoardDef) {
    const marbles: RulesMarble[] = [];
    const supplies = board.supplies.map((supply) => supply.map((packet) => ({
      color: packet.color,
      marbles: Array.from({ length: packet.count }, () => {
        const marble: Marble = { id: marbles.length, color: packet.color };
        marbles.push({ ...marble, status: 'in-supply', boxIndex: null, slot: null });
        return marble;
      }),
    })));
    this.current = {
      supplies, marbles, activeBox: 0, activeFill: 0, waitingForSwap: false, status: 'playing',
    };
    this.evaluateStatus([]);
  }

  get state(): Readonly<RulesState> {
    return this.current;
  }

  get occupancy(): number {
    return this.current.marbles.filter((marble) => marble.status === 'pouring' || marble.status === 'on-belt').length;
  }

  get free(): number {
    return this.board.beltCapacity - this.occupancy;
  }

  get activeColor(): Color | null {
    return this.board.boxes[this.activeBox] ?? null;
  }

  get activeBox(): number {
    return this.current.activeBox;
  }

  get activeFill(): number {
    return this.current.activeFill;
  }

  get status(): SimStatus {
    return this.current.status;
  }

  release(supply: number): ReleaseResult {
    if (this.status !== 'playing') return { ok: false, reason: 'finished' };
    const queue = this.current.supplies[supply];
    const packet = queue?.[0];
    if (!queue || !packet) return { ok: false, reason: 'empty' };
    if (packet.marbles.length > this.free) {
      return {
        ok: false, reason: 'no-space', needed: packet.marbles.length,
        free: this.free, canDrain: this.canDrain(),
      };
    }

    queue.shift();
    for (const marble of packet.marbles) {
      this.current.marbles[marble.id] = { ...marble, status: 'pouring', boxIndex: null, slot: null };
    }
    const events: RulesEvent[] = [];
    this.evaluateStatus(events);
    return { ok: true, supply, color: packet.color, marbles: packet.marbles, events };
  }

  entered(marbleId: number): void {
    const marble = this.current.marbles[marbleId];
    if (marble?.status !== 'pouring') return;
    this.current.marbles[marbleId] = { ...marble, status: 'on-belt' };
    this.evaluateStatus([]);
  }

  arrive(marbleId: number): 'deliver' | 'pass' {
    const marble = this.current.marbles[marbleId];
    if (
      this.status !== 'playing' || marble?.status !== 'on-belt' ||
      marble.color !== this.activeColor || this.current.waitingForSwap
    ) return 'pass';

    const reserved = this.current.marbles.filter((value) => value.boxIndex === this.activeBox).length;
    if (reserved >= this.board.boxSize) return 'pass';
    this.current.marbles[marbleId] = {
      ...marble, status: 'dropping', boxIndex: this.activeBox, slot: reserved,
    };
    this.evaluateStatus([]);
    return 'deliver';
  }

  captured(marbleId: number): RulesEvent[] {
    const marble = this.current.marbles[marbleId];
    if (marble?.status !== 'dropping') return [];
    this.current.marbles[marbleId] = { ...marble, status: 'in-box' };
    this.current.activeFill += 1;
    const events: RulesEvent[] = [];
    if (this.activeFill === this.board.boxSize) {
      this.current.waitingForSwap = true;
      events.push({ type: 'boxFull', boxIndex: this.activeBox });
    }
    this.evaluateStatus(events);
    return events;
  }

  boxSwapped(): RulesEvent[] {
    if (!this.current.waitingForSwap) return [];
    this.current.activeBox += 1;
    this.current.activeFill = 0;
    this.current.waitingForSwap = false;
    const events: RulesEvent[] = [];
    this.evaluateStatus(events);
    return events;
  }

  snapshot(): RulesSnapshot {
    return structuredClone(this.current);
  }

  restore(snapshot: RulesSnapshot): void {
    this.current = structuredClone(snapshot);
  }

  private canDrain(): boolean {
    return this.current.waitingForSwap || this.current.marbles.some((marble) =>
      marble.status === 'dropping' ||
      ((marble.status === 'pouring' || marble.status === 'on-belt') && marble.color === this.activeColor),
    );
  }

  private evaluateStatus(events: RulesEvent[]): void {
    const state = this.current;
    if (state.status !== 'playing') return;
    if (
      state.supplies.every((supply) => supply.length === 0) &&
      this.occupancy === 0 && !state.marbles.some((marble) => marble.status === 'dropping') &&
      this.activeBox === this.board.boxes.length
    ) {
      state.status = 'won';
      events.push({ type: 'won' });
    } else if (
      !state.supplies.some((supply) => {
        const packet = supply[0];
        return packet !== undefined && packet.marbles.length <= this.free;
      }) && !this.canDrain()
    ) {
      state.status = 'jammed';
      events.push({ type: 'jammed' });
    }
  }
}
