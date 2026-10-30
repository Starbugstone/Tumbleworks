import type {
  BoardDef,
  Color,
  ReleaseResult,
  SimConfig,
  SimEvent,
  SimState,
} from './types';

/** The caller drives the simulation at 60 ticks per second. */
export const DEFAULT_CONFIG: SimConfig = {
  beltPositions: 24,
  entryPosition: 0,
  deliveryPosition: 12,
  ticksPerStep: 8,
};

export class ConveyorSim {
  private current!: SimState;
  private readonly history: SimState[] = [];

  constructor(
    readonly board: BoardDef,
    readonly config: SimConfig = DEFAULT_CONFIG,
  ) {
    this.reset();
  }

  get state(): Readonly<SimState> {
    return this.current;
  }

  get occupancy(): number {
    return this.current.belt.length + this.current.pending.length;
  }

  get free(): number {
    return this.board.beltCapacity - this.occupancy;
  }

  get frontColor(): Color | null {
    return this.board.boxes[this.current.frontBox] ?? null;
  }

  get canUndo(): boolean {
    return this.current.status !== 'won' && this.history.length > 0;
  }

  release(supply: number): ReleaseResult {
    if (this.current.status !== 'playing') return { ok: false, reason: 'finished' };
    const queue = this.current.supplies[supply];
    const packet = queue?.[0];
    if (!queue || !packet) return { ok: false, reason: 'empty' };
    if (packet.marbles.length > this.free) {
      return {
        ok: false,
        reason: 'no-space',
        needed: packet.marbles.length,
        free: this.free,
        canDrain: this.canDrain(),
      };
    }

    this.history.push(structuredClone(this.current));
    queue.shift();
    this.current.pending.push(...packet.marbles);
    // First entry attempt: the next belt step, at most ticksPerStep ticks later.
    // An occupied gate waits. Release never changes phase or emits entry events.
    const events: SimEvent[] = [];
    this.evaluateStatus(events);
    return { ok: true, supply, color: packet.color, marbles: packet.marbles, events };
  }

  tick(): SimEvent[] {
    const state = this.current;
    const events: SimEvent[] = [];
    state.tick += 1;
    state.stepTick += 1;
    if (state.stepTick < this.config.ticksPerStep) return events;
    state.stepTick = 0;

    // Contract: advance all positions, deliver to the active box (advancing a
    // filled box immediately), attempt one FIFO entry, then evaluate status.
    // Movement and entry continue after a jam or win; terminal status is sticky.
    for (const marble of state.belt) {
      marble.position = (marble.position + 1) % this.config.beltPositions;
    }
    const deliveryIndex = state.belt.findIndex(
      (marble) => marble.position === this.config.deliveryPosition && marble.color === this.frontColor,
    );
    if (state.status === 'playing' && deliveryIndex !== -1) {
      const [marble] = state.belt.splice(deliveryIndex, 1);
      if (marble) {
        // Slots and box indices are zero based.
        events.push({
          type: 'delivered',
          marbleId: marble.id,
          boxIndex: state.frontBox,
          slot: state.frontBoxFill,
        });
        state.frontBoxFill += 1;
        if (state.frontBoxFill === this.board.boxSize) {
          events.push({ type: 'boxFilled', boxIndex: state.frontBox });
          state.frontBox += 1;
          state.frontBoxFill = 0;
        }
      }
    }
    if (!state.belt.some((marble) => marble.position === this.config.entryPosition)) {
      const marble = state.pending.shift();
      if (marble) {
        state.belt.push({ ...marble, position: this.config.entryPosition });
        events.push({ type: 'entered', marbleId: marble.id, position: this.config.entryPosition });
      }
    }
    this.evaluateStatus(events);
    return events;
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    const snapshot = this.history.pop();
    if (!snapshot) return false;
    this.current = snapshot;
    return true;
  }

  reset(): void {
    let nextId = 0;
    this.current = {
      tick: 0,
      stepTick: 0,
      supplies: this.board.supplies.map((supply) =>
        supply.map((packet) => ({
          color: packet.color,
          marbles: Array.from({ length: packet.count }, () => ({ id: nextId++, color: packet.color })),
        })),
      ),
      pending: [],
      belt: [],
      frontBox: 0,
      frontBoxFill: 0,
      status: 'playing',
    };
    this.history.length = 0;
    this.evaluateStatus([]);
  }

  private canDrain(): boolean {
    const color = this.frontColor;
    return color !== null && (
      this.current.belt.some((marble) => marble.color === color) ||
      this.current.pending.some((marble) => marble.color === color)
    );
  }

  private evaluateStatus(events: SimEvent[]): void {
    const state = this.current;
    if (state.status !== 'playing') return;
    if (
      state.supplies.every((supply) => supply.length === 0) &&
      this.occupancy === 0 &&
      state.frontBox === this.board.boxes.length
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
