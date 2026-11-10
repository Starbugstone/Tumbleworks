import { COLOR_CODE } from './types';
import { palletMate, validateDockPallets } from './dock-pallets';
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
  released: number[];
  sealsOpen: boolean[];
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
  | { readonly ok: true; readonly supply: number; readonly color: Color; readonly marbles: readonly Marble[]; readonly packets: readonly SupplyPacket[]; readonly events: readonly RulesEvent[] }
  | { readonly ok: false; readonly reason: 'empty' | 'finished' | 'blocked' };

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
    let crateId = 0;
    const supplies = board.supplies.map((supply) => supply.map((packet) => ({
      id: crateId++, color: packet.color,
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
    this.validateVariants(crateId);
    if (board.pallets) validateDockPallets(board.docks, board.pallets);
    this.current = { supplies, pending: [], released: [], sealsOpen: (board.seals ?? []).map(() => false), marbles, dockNext: board.docks.map(() => 0), status: 'playing' };
    this.evaluateStatus([]);
  }

  /** Existing boards retain column actions and replay IDs; source variants use stable crate IDs. */
  get crateActions(): boolean { return Boolean(this.board.predecessors || this.board.pairs?.length); }
  packet(action: number): SupplyPacket | undefined {
    return this.crateActions ? this.current.supplies.flat().find((packet) => packet.id === action) : this.current.supplies[action]?.[0];
  }
  predecessors(id: number): readonly number[] {
    if (this.board.predecessors) return this.board.predecessors[id] ?? [];
    let cursor = 0;
    for (const queue of this.board.supplies) {
      if (id < cursor + queue.length) return id === cursor ? [] : [id - 1];
      cursor += queue.length;
    }
    return [];
  }
  accessible(id: number): boolean {
    return !this.current.released.includes(id) && this.predecessors(id).every((before) => this.current.released.includes(before));
  }
  /** Both members are checked before either is changed. Pair aliases remain valid tap targets. */
  releaseIds(action: number): number[] {
    const packet = this.packet(action);
    if (!packet) return [];
    return [...(this.board.pairs?.find((pair) => pair.includes(packet.id)) ?? [packet.id])].sort((a, b) => a - b);
  }
  actions(): number[] {
    if (this.status !== 'playing') return [];
    const candidates = this.crateActions ? this.current.supplies.flat().map((p) => p.id) : this.current.supplies.flatMap((q, i) => q.length ? [i] : []);
    return candidates.filter((action) => {
      const ids = this.releaseIds(action);
      return ids.every((id) => this.accessible(id)) && (!this.crateActions || action === ids[0]);
    });
  }
  dockOpen(dock: number): boolean {
    const index = this.board.seals?.findIndex((seal) => seal.dock === dock) ?? -1;
    return index < 0 || this.current.sealsOpen[index] === true;
  }
  private validateVariants(count: number): void {
    const valid = (id: number): boolean => Number.isSafeInteger(id) && id >= 0 && id < count;
    const visit = (id: number, path: Set<number>): void => {
      if (!valid(id) || path.has(id)) throw new Error('Invalid or cyclic crate predecessors');
      for (const before of this.predecessors(id)) visit(before, new Set([...path, id]));
    };
    for (let id = 0; id < count; id++) {
      const before = this.predecessors(id);
      if (before.length > 3 || new Set(before).size !== before.length) throw new Error('At most three distinct predecessors per crate');
      visit(id, new Set());
    }
    for (const key of Object.keys(this.board.predecessors ?? {})) if (!valid(Number(key))) throw new Error('Unknown crate predecessor target');
    if (this.board.predecessors) {
      // Dilworth: width is N minus a maximum matching in the transitive dependency graph.
      const ancestors = (id: number): number[] => [...new Set(this.predecessors(id).flatMap((before) => [before, ...ancestors(before)]))];
      const matches = new Map<number, number>();
      const augment = (id: number, seen: Set<number>): boolean => {
        for (const before of ancestors(id)) {
          if (seen.has(before)) continue;
          seen.add(before);
          const previous = matches.get(before);
          if (previous === undefined || augment(previous, seen)) { matches.set(before,id); return true; }
        }
        return false;
      };
      for (let id=0;id<count;id++) augment(id,new Set());
      if (count - matches.size > 4) throw new Error('Shelves expose more than four crates');
    }
    const paired = new Set<number>();
    for (const pair of this.board.pairs ?? []) for (const id of pair) {
      if (!valid(id) || paired.has(id)) throw new Error('Invalid or overlapping crate pair');
      paired.add(id);
    }
    const seals = this.board.seals ?? [];
    if (seals.length > 2 || new Set(seals.map((seal) => seal.dock)).size !== seals.length) throw new Error('At most two distinct sealed docks');
    for (const seal of seals) {
      if (!this.board.docks[seal.dock]?.length || seal.dock === seal.after.dock || !this.board.docks[seal.after.dock]?.[seal.after.box]) throw new Error('Invalid sealed dock prerequisite');
      const seen = new Set([seal.dock]);
      let dock = seal.after.dock;
      for (;;) {
        if (seen.has(dock)) throw new Error('Cyclic sealed docks');
        seen.add(dock);
        const next = seals.find((entry) => entry.dock === dock);
        if (!next) break;
        dock = next.after.dock;
      }
    }
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
    return box === null || !this.dockOpen(dock) || (this.board.pallets?.length && this.reserved(dock, box) >= this.board.boxSize) ? null : this.board.docks[dock]?.[box] ?? null;
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
      if (this.dockOpen(dock) && box !== null && this.board.docks[dock]?.[box] === color && this.reserved(dock, box) < this.board.boxSize) return dock;
    }
    return null;
  }

  release(supply: number): ReleaseResult {
    if (this.status !== 'playing') return { ok: false, reason: 'finished' };
    const packet = this.packet(supply);
    if (!packet) return { ok: false, reason: 'empty' };
    const ids = this.releaseIds(supply);
    if (!ids.every((id) => this.accessible(id))) return { ok: false, reason: 'blocked' };
    const packets = ids.map((id) => this.current.supplies.flat().find((entry) => entry.id === id)!);
    for (const released of packets) {
      this.current.released.push(released.id);
      const queue = this.current.supplies.find((q) => q.includes(released))!;
      queue.splice(queue.indexOf(released), 1);
      for (const marble of released.marbles) {
        this.current.marbles[marble.id] = { ...marble, status: 'pouring', dock: null, box: null, slot: null };
        this.current.pending.push(marble.id);
      }
    }
    const events: RulesEvent[] = [];
    this.evaluateStatus(events);
    return { ok: true, supply, color: packet.color, marbles: packets.flatMap((p) => p.marbles), packets, events };
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
    if (!this.dockOpen(dock) || this.status !== 'playing' || marble?.status !== 'on-belt' || box === null || this.board.docks[dock]?.[box] !== marble.color) return { result: 'pass' };
    const slot = this.reserved(dock, box);
    if (slot >= this.board.boxSize) return { result: 'pass' };
    this.current.marbles[marbleId] = { ...marble, status: 'dropping', dock, box, slot };
    const events: RulesEvent[] = [];
    if (slot + 1 === this.board.boxSize) {
      const mate = palletMate(this.board.pallets, dock);
      if (mate === null) this.current.dockNext[dock] = box + 1;
      else if (this.reserved(mate, box) === this.board.boxSize) {
        // Both queues unlock in this reservation, before status or animation can observe half a pallet.
        this.current.dockNext[dock] = box + 1;
        this.current.dockNext[mate] = box + 1;
      }
      events.push({ type: 'boxFull', dock, box });
      for (const [index, seal] of (this.board.seals ?? []).entries()) {
        if (seal.after.dock === dock && seal.after.box === box) this.current.sealsOpen[index] = true;
      }
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

/** Settled FIFO equivalence: identities of released crates and permanent openings remain significant. */
export function funnelStateKey(rules: MachineRules): string {
  const state = rules.state;
  const belt: Record<string, number> = {};
  for (const marble of state.marbles) if (marble.status === 'on-belt') belt[marble.color] = (belt[marble.color] ?? 0) + 1;
  const pending = state.pending.map((id) => COLOR_CODE[state.marbles[id]!.color]).join('');
  const boxes = state.dockNext.map((box, dock) => `${box}:${rules.reserved(dock, box)}`).join(',');
  return `${state.supplies.map((queue) => queue.length).join(',')}|${[...state.released].sort((a,b) => a-b)}|${state.sealsOpen}|${boxes}|${JSON.stringify(belt)}|${pending}`;
}
