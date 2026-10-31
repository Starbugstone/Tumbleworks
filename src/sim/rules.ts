import type { BoardDef, Color, Marble, SimStatus, SupplyPacket } from './types';

export type MarbleStatus = 'in-supply' | 'pouring' | 'on-belt' | 'dropping' | 'in-box';

/** Dock, box and slot stay attached to a marble once reserved, so a box never over-fills. */
export type RulesMarble = Marble & (
  | { status: 'in-supply' | 'pouring' | 'on-belt'; dock: null; box: null; slot: null }
  | { status: 'dropping' | 'in-box'; dock: number; box: number; slot: number }
);

export interface RulesState {
  supplies: SupplyPacket[][];
  /** Released marbles waiting in the funnel, in accepted pour order. They do not occupy the belt. */
  pending: number[];
  /** Indexed by stable, supply-first marble ID; includes unreleased and captured marbles. */
  marbles: RulesMarble[];
  /** Per dock, the index of the box now waiting there; equals the queue length once it has run out. */
  dockNext: number[];
  status: SimStatus;
}

export type RulesSnapshot = RulesState;

export type RulesEvent =
  | { readonly type: 'boxFull'; readonly dock: number; readonly box: number }
  | { readonly type: 'won' }
  | { readonly type: 'jammed' };

export type ReleaseResult =
  | { readonly ok: true; readonly supply: number; readonly color: Color; readonly marbles: readonly Marble[]; readonly events: readonly RulesEvent[] }
  | { readonly ok: false; readonly reason: 'empty' | 'finished' };

export type Arrival =
  | { readonly result: 'deliver'; readonly box: number; readonly slot: number; readonly events: RulesEvent[] }
  | { readonly result: 'pass' };

/**
 * Pure accounting for Funnel Sort. A tap releases a whole tray into the funnel. The funnel lets
 * marbles onto the belt while there is room, in whatever order the pile physically gives them.
 * Belt marbles circulate until they pass a dock whose front box wants their colour.
 */
export class MachineRules {
  private current: RulesState;

  constructor(readonly board: BoardDef) {
    if (board.docks.length < 1 || board.boxSize < 1 || board.beltCapacity < 1) throw new Error(`Board ${board.id} has an empty machine`);
    const marbles: RulesMarble[] = [];
    const supplies = board.supplies.map((supply) => supply.map((packet) => ({
      color: packet.color,
      marbles: Array.from({ length: packet.count }, () => {
        const marble: Marble = { id: marbles.length, color: packet.color };
        marbles.push({ ...marble, status: 'in-supply', dock: null, box: null, slot: null });
        return marble;
      }),
    })));
    const totals = new Map<Color, number>();
    for (const marble of marbles) totals.set(marble.color, (totals.get(marble.color) ?? 0) + 1);
    const wanted = new Map<Color, number>();
    for (const color of board.docks.flat()) wanted.set(color, (wanted.get(color) ?? 0) + board.boxSize);
    for (const color of new Set([...totals.keys(), ...wanted.keys()])) {
      if (totals.get(color) !== wanted.get(color)) throw new Error(`Board ${board.id}: ${color} supply does not match its boxes`);
    }
    this.current = { supplies, pending: [], marbles, dockNext: board.docks.map(() => 0), status: 'playing' };
    this.evaluateStatus([]);
  }

  get state(): Readonly<RulesState> { return this.current; }
  get status(): SimStatus { return this.current.status; }
  get occupancy(): number { return this.current.marbles.filter((marble) => marble.status === 'on-belt').length; }
  get funnelCount(): number { return this.current.pending.length; }
  get free(): number { return this.board.beltCapacity - this.occupancy; }
  /** The box index now docked at a dock, or null once its queue is spent. */
  dockBox(dock: number): number | null {
    const next = this.current.dockNext[dock];
    const queue = this.board.docks[dock];
    return next === undefined || !queue || next >= queue.length ? null : next;
  }
  /** The colour a dock wants right now, or null. */
  dockColor(dock: number): Color | null {
    const box = this.dockBox(dock);
    return box === null ? null : this.board.docks[dock]?.[box] ?? null;
  }
  /** Marbles reserved for or resting in a box. */
  reserved(dock: number, box: number): number {
    return this.current.marbles.filter((marble) => marble.dock === dock && marble.box === box).length;
  }
  boxFill(dock: number, box: number): number {
    return this.current.marbles.filter((marble) => marble.status === 'in-box' && marble.dock === dock && marble.box === box).length;
  }
  /** Which dock would take this colour right now, if any. */
  dockFor(color: Color): number | null {
    for (let dock = 0; dock < this.board.docks.length; dock++) {
      const box = this.dockBox(dock);
      if (box !== null && this.board.docks[dock]?.[box] === color && this.reserved(dock, box) < this.board.boxSize) return dock;
    }
    return null;
  }

  release(supply: number): ReleaseResult {
    if (this.status !== 'playing') return { ok: false, reason: 'finished' };
    const queue = this.current.supplies[supply];
    const packet = queue?.[0];
    if (!queue || !packet) return { ok: false, reason: 'empty' };
    queue.shift();
    for (const marble of packet.marbles) {
      this.current.marbles[marble.id] = { ...marble, status: 'pouring', dock: null, box: null, slot: null };
      this.current.pending.push(marble.id);
    }
    const events: RulesEvent[] = [];
    this.evaluateStatus(events);
    return { ok: true, supply, color: packet.color, marbles: packet.marbles, events };
  }

  /** The funnel let this marble through onto the belt. Any waiting marble may be first; the pile decides. */
  entered(marbleId: number): boolean {
    const marble = this.current.marbles[marbleId];
    if (this.status !== 'playing' || marble?.status !== 'pouring' || this.free <= 0) return false;
    this.current.pending.splice(this.current.pending.indexOf(marbleId), 1);
    this.current.marbles[marbleId] = { ...marble, status: 'on-belt' };
    this.evaluateStatus([]);
    return true;
  }

  /** A belt marble is passing a dock. Delivering reserves its slot and may move the dock's queue on. */
  arrive(marbleId: number, dock: number): Arrival {
    const marble = this.current.marbles[marbleId];
    const box = this.dockBox(dock);
    if (this.status !== 'playing' || marble?.status !== 'on-belt' || box === null || this.board.docks[dock]?.[box] !== marble.color) return { result: 'pass' };
    const slot = this.reserved(dock, box);
    if (slot >= this.board.boxSize) return { result: 'pass' };
    this.current.marbles[marbleId] = { ...marble, status: 'dropping', dock, box, slot };
    const events: RulesEvent[] = [];
    if (slot + 1 === this.board.boxSize) {
      // The dock asks for its next box straight away, so a matching marble never has to lap again.
      this.current.dockNext[dock] = box + 1;
      events.push({ type: 'boxFull', dock, box });
    }
    this.evaluateStatus(events);
    return { result: 'deliver', box, slot, events };
  }

  captured(marbleId: number): RulesEvent[] {
    const marble = this.current.marbles[marbleId];
    if (marble?.status !== 'dropping') return [];
    this.current.marbles[marbleId] = { ...marble, status: 'in-box' };
    const events: RulesEvent[] = [];
    this.evaluateStatus(events);
    return events;
  }

  snapshot(): RulesSnapshot { return structuredClone(this.current); }
  restore(snapshot: RulesSnapshot): void { this.current = structuredClone(snapshot); }

  /** True while something already past the funnel can still free belt space. */
  canDrain(): boolean {
    return this.current.marbles.some((marble) => marble.status === 'dropping' ||
      (marble.status === 'on-belt' && this.dockFor(marble.color) !== null));
  }

  private evaluateStatus(events: RulesEvent[]): void {
    const state = this.current;
    if (state.status !== 'playing') return;
    if (state.marbles.every((marble) => marble.status === 'in-box')) {
      state.status = 'won';
      events.push({ type: 'won' });
    } else if (this.free <= 0 && !this.canDrain()) {
      state.status = 'jammed';
      events.push({ type: 'jammed' });
    }
  }
}
