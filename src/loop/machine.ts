import { sin } from '../engine/exact-math';
import { fingerprintOf, type Replayable, type ReplayAction } from '../engine/replay';
import { LoopRules, type LoopEvent, type TapResult } from './rules';
import type { LoopBoardDef } from './types';
import type { Color } from '../sim/types';
import { type Bay, bays, DECK_TOP, LIFT_OFF, LOOP, RIDE_Y, ROW_PITCH, ROW_WIDTH, sharePercent, STREAM, TICK_SECONDS, trackFor, TRUCK, unitLength } from './layout';

export type LoopMachineEvent =
  | { readonly type: 'pour'; readonly lane: number; readonly color: Color }
  | { readonly type: 'enter'; readonly unit: number }
  | { readonly type: 'absorb'; readonly unit: number; readonly lane: number; readonly fill: number }
  | { readonly type: 'complete'; readonly lane: number; readonly color: Color }
  | { readonly type: 'gone'; readonly lane: number; readonly truck: number }
  | { readonly type: 'won' }
  | { readonly type: 'jammed' };

type UnitPhase = 'truck' | 'streaming' | 'riding' | 'flying' | 'landed';
interface UnitControl {
  readonly id: number;
  readonly color: Color;
  phase: UnitPhase;
  /** Which of the loop's capacity slots it rides in; the offset follows from it. */
  slot: number;
  /** Loop distance minus the belt's own travel. */
  offset: number;
  time: number;
  fromX: number;
  fromY: number;
  fromZ: number;
  /** Per-marble wobble, so three abreast never look like a grid. */
  readonly jitter: readonly number[];
  lane: number;
}

type TruckPhase = 'queued' | 'arriving' | 'docked' | 'leaving' | 'gone';
interface TruckControl {
  readonly lane: number;
  readonly index: number;
  phase: TruckPhase;
  z: number;
  y: number;
  scale: number;
  fromZ: number;
  fromY: number;
  fromScale: number;
  time: number;
  duration: number;
  /** Set once the rules report it complete; it drives off when its last unit has landed. */
  complete: boolean;
}

interface Control {
  tick: number;
  belt: number;
  units: UnitControl[];
  trucks: TruckControl[];
  streamTick: number[];
  endingReported: boolean;
}

interface Saved { readonly rules: ReturnType<LoopRules['snapshot']>; readonly control: Control }

export interface UnitPose { x: number; y: number; z: number; roll: number; visible: boolean }

/** A truck's bed as whole percentages of its capacity: colours from the loop end back, then what is free. */
export interface TruckLoad { readonly shares: readonly { readonly color: Color; readonly percent: number }[]; readonly freePercent: number }

const easeInOut = (t: number): number => t * t * (3 - 2 * t);

/** Loop Sort's scripted machine: trucks pour units onto a loop that never stops and take their colour back. */
export class LoopMachine implements Replayable {
  readonly rules: LoopRules;
  readonly track: ReturnType<typeof trackFor>;
  readonly bays: Bay[];
  /** Capacity units exactly fill the loop, so a full loop looks full. */
  readonly unitSpacing: number;
  readonly rowsPerUnit: number;
  readonly marblesPerUnit: number;
  private control: Control;
  private readonly history: Saved[] = [];
  readonly actions: ReplayAction[] = [];
  steps = 0;
  private readonly events: LoopMachineEvent[] = [];
  private readonly mouthDistance: number[];
  private readonly mouthZs: number[];

  constructor(readonly board: LoopBoardDef) {
    this.rules = new LoopRules(board);
    this.track = trackFor(board.lanes.length, board.trackShape);
    this.bays = bays(board.lanes.length);
    this.unitSpacing = this.track.length / board.loopCapacity;
    this.rowsPerUnit = Math.max(1, Math.round(this.unitSpacing / ROW_PITCH));
    this.marblesPerUnit = this.rowsPerUnit * ROW_WIDTH;
    // Mouths open on the back straight of an oval, whose travel runs from lane 0 up, the order the rules take marbles
    // in. An eight lies above its columns, so they open on its near edge, where the lower pass wins the crossing.
    const eight = board.trackShape !== undefined && board.trackShape !== 'oval';
    this.mouthDistance = this.bays.map((bay) => this.track.nearest(bay.x, eight ? this.track.halfDepth + 3 : -this.track.halfDepth).distance);
    this.mouthZs = this.mouthDistance.map((distance) => this.track.point(distance).z + TRUCK.mouthGap);
    const units: UnitControl[] = this.rules.state.marbles.map((marble) => ({
      id: marble.id, color: marble.color, phase: marble.status === 'on-loop' ? 'riding' : 'truck', slot: -1, offset: 0, time: 0, fromX: 0, fromY: 0, fromZ: 0,
      jitter: Array.from({ length: this.marblesPerUnit * 2 }, (_, k) => (sin(marble.id * 12.9898 + k * 78.233) * 43758.5453) % 1),
      lane: marble.lane ?? -1,
    }));
    const riding = units.filter((unit) => unit.phase === 'riding');
    riding.forEach((unit, index) => { unit.slot = index; unit.offset = index * this.unitSpacing; });
    const trucks: TruckControl[] = board.lanes.flatMap((queue, lane) => queue.map((_, index): TruckControl => {
      const truck: TruckControl = { lane, index, phase: index === 0 ? 'docked' : 'queued', z: 0, y: 0, scale: 1, fromZ: 0, fromY: 0, fromScale: 1, time: 1, duration: 1, complete: false };
      Object.assign(truck, this.truckTarget(truck));
      return truck;
    }));
    this.control = { tick: 0, belt: 0, units, trucks, streamTick: board.lanes.map(() => 0), endingReported: false };
  }

  get canUndo(): boolean { return this.history.length > 0 && this.rules.status !== 'won'; }
  get transferring(): boolean {
    const playing = this.rules.status === 'playing';
    return this.control.units.some((unit) => unit.phase === 'streaming' || unit.phase === 'flying') ||
      this.control.trucks.some((truck) => truck.phase === 'leaving' || truck.phase === 'arriving') ||
      (playing && this.rules.pending > 0);
  }
  get tick(): number { return this.control.tick; }
  get beltDistance(): number { return this.control.belt; }
  get laneCount(): number { return this.board.lanes.length; }
  /** The bed's loop end for a lane, and the direction from the cab toward the mouth (+1 front, -1 back). */
  mouthZ(lane: number): number { return this.mouthZs[lane]!; }
  facing(_lane: number): number { return -1; }

  /** A truck's bed, front (loop end) first, as colour blocks in rules units, plus its position. */
  readTrucks(): { lane: number; index: number; x: number; y: number; z: number; scale: number; visible: boolean; docked: boolean; departing: boolean; capacity: number; bedLength: number; latchColor: Color | null; coupledWith: string | null; finalColor: Color; unloading: 'pouring' | 'waiting' | null;
    /** Its place in the lane's waiting line, 0 next; null once it has left the line. */
    queueSlot: number | null;
    blocks: { color: Color; units: number; pouring: boolean }[] }[] {
    const waitingAhead = new Map<number, number>();
    return this.control.trucks.map((truck) => {
      let queueSlot: number | null = null;
      if (truck.phase === 'queued') {
        queueSlot = waitingAhead.get(truck.lane) ?? 0;
        waitingAhead.set(truck.lane, queueSlot + 1);
      }
      const state = this.rules.state.lanes[truck.lane]?.find((candidate) => candidate.index === truck.index) ??
        (truck.complete ? null : null);
      const blocks: { color: Color; units: number; pouring: boolean }[] = [];
      if (state) {
        if (state.unloading.length) blocks.push({ color: this.rules.state.marbles[state.unloading[0]!]!.color, units: state.unloading.length, pouring: true });
        for (const segment of state.segments) {
          const landed = segment.marbles.filter((id) => this.control.units[id]?.phase !== 'flying').length;
          blocks.push({ color: segment.color, units: landed, pouring: false });
        }
      } else {
        // A complete truck is no longer in the rules' lane queue: it is full of one colour.
        const own = this.control.units.filter((unit) => this.rules.state.marbles[unit.id]?.truck === truck.index && this.rules.state.marbles[unit.id]?.lane === truck.lane && unit.phase !== 'flying');
        if (own.length) blocks.push({ color: own[0]!.color, units: own.length, pouring: false });
      }
      return { lane: truck.lane, index: truck.index, x: this.bays[truck.lane]!.x, y: truck.y, z: truck.z, scale: truck.scale,
        visible: truck.phase !== 'gone' && truck.phase !== 'queued', docked: truck.phase === 'docked',
        departing: truck.phase === 'leaving', queueSlot,
        capacity: this.capacity(truck.lane, truck.index), bedLength: this.bedLength(truck.lane, truck.index),
        latchColor: state?.pourAfter ? this.board.lanes.flatMap((queue, lane) => queue.map((def, index) => ({ def, id: def.id ?? `${lane}:${index}` }))).find(({ id }) => id === state.pourAfter)!.def.segments.at(-1)!.color : null,
        coupledWith: state?.coupledWith ?? null,
        unloading: state?.unloading.length ? (this.rules.free === 0 ? 'waiting' : 'pouring') : null,
        finalColor: this.board.lanes[truck.lane]![truck.index]!.segments.at(-1)!.color, blocks };
    });
  }

  /** What a truck read from `readTrucks` is carrying and what room it has left. */
  loadOf(blocks: readonly { readonly color: Color; readonly units: number }[], capacity = this.board.truckCapacity): TruckLoad {
    const carried = blocks.filter((block) => block.units > 0);
    return {
      shares: carried.map((block) => ({ color: block.color, percent: sharePercent(block.units, capacity) })),
      freePercent: sharePercent(capacity - carried.reduce((sum, block) => sum + block.units, 0), capacity),
    };
  }

  /** World poses of every drawn marble of a unit: rows of three along its stretch of the loop. */
  readUnit(id: number, into: UnitPose[]): void {
    const unit = this.control.units[id];
    if (!unit) return;
    for (let k = 0; k < this.marblesPerUnit; k++) {
      const pose = into[k];
      if (!pose) continue;
      pose.visible = unit.phase !== 'truck' && unit.phase !== 'landed';
      if (!pose.visible) continue;
      const across = k % ROW_WIDTH;
      const rowIndex = Math.floor(k / ROW_WIDTH);
      const row = (across - (ROW_WIDTH - 1) / 2) * LOOP.rowOffset + (unit.jitter[k]! - 0.5) * 0.08;
      const along = (rowIndex - (this.rowsPerUnit - 1) / 2) * (this.unitSpacing / this.rowsPerUnit) + (unit.jitter[k + this.marblesPerUnit]! - 0.5) * 0.1;
      const distance = this.control.belt + unit.offset + along;
      const point = this.track.point(distance, row);
      pose.roll = distance / 0.17;
      if (unit.phase === 'riding') { pose.x = point.x; pose.y = RIDE_Y + point.y; pose.z = point.z; continue; }
      const mouthX = (this.bays[unit.lane]?.x ?? 0) + (across - 1) * 0.26;
      const mouthY = DECK_TOP + TRUCK.bedHeight + 0.25;
      const mouthZ = this.mouthZ(unit.lane);
      // Rows leave and arrive one after another, so a wide unit reads as a short stream.
      const stagger = (rowIndex / Math.max(1, this.rowsPerUnit)) * 0.5;
      if (unit.phase === 'streaming') {
        const t = Math.max(0, Math.min((unit.time / STREAM.hopSeconds - stagger) / (1 - stagger), 1));
        pose.x = mouthX + (point.x - mouthX) * t;
        pose.y = mouthY + (RIDE_Y + point.y - mouthY) * t * t + sin(t * Math.PI) * 0.25;
        pose.z = mouthZ + (point.z - mouthZ) * t;
      } else {
        const t = Math.max(0, Math.min((unit.time / STREAM.absorbSeconds - stagger) / (1 - stagger), 1));
        const fromX = unit.fromX + (across - 1) * 0.26;
        pose.x = fromX + (mouthX - fromX) * t;
        pose.y = unit.fromY + (mouthY - unit.fromY) * t + sin(t * Math.PI) * 0.35;
        pose.z = unit.fromZ + (mouthZ - unit.fromZ) * t;
      }
    }
  }

  tap(lane: number): TapResult {
    const before: Saved = { rules: this.rules.snapshot(), control: structuredClone(this.control) };
    const result = this.rules.tap(lane);
    if (!result.ok) return result;
    this.history.push(before);
    this.actions.push({ step: this.steps, type: 'tap', at: lane });
    for (const pour of result.pours) this.events.push({ type: 'pour', lane: pour.lane, color: pour.color });
    return result;
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    const saved = this.history.pop();
    if (!saved) return false;
    this.rules.restore(saved.rules);
    this.control = structuredClone(saved.control);
    this.events.length = 0;
    this.actions.push({ step: this.steps, type: 'undo' });
    return true;
  }

  perform(action: ReplayAction): boolean {
    if (action.type === 'undo') return this.undo();
    return action.type === 'tap' && this.tap(action.at).ok;
  }

  fingerprint(): string {
    return fingerprintOf(JSON.stringify(this.rules.state), JSON.stringify(this.control));
  }

  step(): LoopMachineEvent[] {
    this.steps += 1;
    const { control } = this;
    control.tick += 1;
    control.belt = (control.belt + LOOP.speed * TICK_SECONDS) % this.track.length;
    this.stream();
    for (const unit of control.units) this.updateUnit(unit);
    this.updateTrucks();
    if (this.rules.status !== 'playing' && !control.endingReported) {
      control.endingReported = true;
      this.events.push(this.rules.status === 'won' ? { type: 'won' } : { type: 'jammed' });
    }
    return this.events.splice(0);
  }

  /**
   * The loop is divided into capacity slots that travel with it. A pouring unit takes the first
   * empty slot about to pass the mouth, so free capacity always means a gap really comes round.
   */
  private freeSlot(lane: number): number | null {
    const capacity = this.board.loopCapacity;
    const mouth = this.mouthDistance[lane] ?? 0;
    const taken = new Set(this.control.units.filter((unit) => unit.phase === 'riding' || unit.phase === 'streaming').map((unit) => unit.slot));
    const atMouth = (((mouth - this.control.belt) / this.unitSpacing) % capacity + capacity) % capacity;
    for (let step = 0; step < 3; step++) {
      const slot = (Math.ceil(atMouth) + step) % capacity;
      if (!taken.has(slot)) return slot;
    }
    return null;
  }

  private stream(): void {
    for (let lane = 0; lane < this.laneCount; lane++) {
      const truck = this.rules.front(lane);
      if (!truck?.unloading.length) continue;
      if (this.control.tick - (this.control.streamTick[lane] ?? 0) < STREAM.intervalTicks) continue;
      const slot = this.freeSlot(lane);
      if (slot === null) continue;
      const id = this.rules.entered(lane);
      if (id === null) continue;
      const unit = this.control.units[id]!;
      unit.phase = 'streaming';
      unit.time = 0;
      unit.slot = slot;
      unit.offset = slot * this.unitSpacing;
      unit.lane = lane;
      this.control.streamTick[lane] = this.control.tick;
      this.events.push({ type: 'enter', unit: id });
    }
  }

  private updateUnit(unit: UnitControl): void {
    unit.time += TICK_SECONDS;
    if (unit.phase === 'streaming') {
      if (unit.time >= STREAM.hopSeconds) unit.phase = 'riding';
      return;
    }
    if (unit.phase === 'flying') {
      if (unit.time >= STREAM.absorbSeconds) {
        unit.phase = 'landed';
        this.rules.captured(unit.id);
      }
      return;
    }
    if (unit.phase !== 'riding') return;
    const distance = (this.control.belt + unit.offset) % this.track.length;
    const moved = LOOP.speed * TICK_SECONDS;
    for (let lane = 0; lane < this.laneCount; lane++) {
      const past = (distance - (this.mouthDistance[lane] ?? 0) + this.track.length) % this.track.length;
      if (past >= moved) continue;
      const result = this.rules.pass(unit.id, lane);
      if (result.result !== 'absorb') continue;
      const point = this.track.point(distance);
      unit.phase = 'flying';
      unit.time = 0;
      unit.lane = lane;
      unit.fromX = point.x; unit.fromY = RIDE_Y + point.y; unit.fromZ = point.z;
      this.events.push({ type: 'absorb', unit: unit.id, lane, fill: result.fill });
      for (const event of result.events) this.afterRulesEvent(event);
      return;
    }
  }

  private afterRulesEvent(event: LoopEvent): void {
    if (event.type !== 'complete') return;
    const truck = this.control.trucks.find((candidate) => candidate.lane === event.lane && candidate.index === event.truck);
    if (truck) truck.complete = true;
    this.events.push({ type: 'complete', lane: event.lane, color: event.color });
  }

  /** Bed centre for a lane's docked truck; a leaving truck lifts away over the belt; a new one rises into place. */
  private truckTarget(truck: TruckControl): { z: number; y: number; scale: number } {
    const facing = this.facing(truck.lane);
    const docked = this.mouthZ(truck.lane) - facing * this.bedLength(truck.lane, truck.index) / 2;
    if (truck.phase === 'docked' || truck.phase === 'arriving') return { z: docked, y: DECK_TOP, scale: 1 };
    if (truck.phase === 'leaving') return { z: -(this.track.halfDepth + LOOP.channelHalf + LOOP.wallThickness), y: DECK_TOP, scale: 0 };
    return { z: docked, y: DECK_TOP - 1.4, scale: 0.3 };
  }

  private updateTrucks(): void {
    for (let lane = 0; lane < this.laneCount; lane++) {
      const docked = this.control.trucks.find((truck) => truck.lane === lane && truck.phase === 'docked');
      if (docked?.complete) {
        const landing = this.control.units.some((unit) => unit.phase === 'flying' && unit.lane === lane);
        if (!landing) this.startMotion(docked, 'leaving', TRUCK.leaveSeconds);
      }
      if (!this.control.trucks.some((truck) => truck.lane === lane && (truck.phase === 'docked' || truck.phase === 'arriving'))) {
        const next = this.control.trucks.find((truck) => truck.lane === lane && truck.phase === 'queued');
        if (next) this.startMotion(next, 'arriving', TRUCK.arriveSeconds);
      }
    }
    for (const truck of this.control.trucks) {
      if (truck.phase === 'gone' || truck.phase === 'queued') continue;
      const target = this.truckTarget(truck);
      if (truck.time < truck.duration) {
        truck.time = Math.min(truck.time + TICK_SECONDS, truck.duration);
        const t = easeInOut(truck.time / truck.duration);
        truck.z = truck.fromZ + (target.z - truck.fromZ) * t;
        // Keep the chassis above the deck; dispatch shrinks it away at the outer pad, never through the platform.
        const scaleT = truck.phase === 'leaving' ? easeInOut(Math.max(0, (truck.time / truck.duration - 0.5) * 2)) : t;
        // A leaving lorry rises off its bay and away over the belt.
        const rise = truck.phase === 'leaving' ? Math.min(1, t * 2.5) * LIFT_OFF : 0;
        truck.y = truck.fromY + (target.y - truck.fromY) * t + rise;
        truck.scale = truck.fromScale + (target.scale - truck.fromScale) * scaleT;
        if (truck.time >= truck.duration && truck.phase === 'leaving') {
          truck.phase = 'gone';
          this.events.push({ type: 'gone', lane: truck.lane, truck: truck.index });
        } else if (truck.time >= truck.duration && truck.phase === 'arriving') truck.phase = 'docked';
      } else Object.assign(truck, target);
    }
  }

  private startMotion(truck: TruckControl, phase: TruckPhase, duration: number): void {
    truck.fromZ = truck.z; truck.fromY = truck.y; truck.fromScale = truck.scale;
    truck.phase = phase;
    truck.time = 0;
    truck.duration = duration;
  }

  capacity(lane: number, index: number): number { return this.board.lanes[lane]![index]!.capacity ?? this.board.truckCapacity; }
  bedLength(lane: number, index: number): number { return TRUCK.bedLength * this.capacity(lane, index) / this.board.truckCapacity; }

  /** Bed length per unit, for drawing blocks. */
  get unitLength(): number { return unitLength(this.board.truckCapacity); }
  /** How many trucks still wait below a lane. */
  waiting(lane: number): number { return this.control.trucks.filter((truck) => truck.lane === lane && truck.phase === 'queued').length; }
}
