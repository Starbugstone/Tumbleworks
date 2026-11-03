import { cos, hypot, sin } from '../engine/exact-math';
import RAPIER from '@dimforge/rapier3d-compat';
import { FALLING_GROUPS, PARKED_GROUPS, PLACED_GROUPS, physics, type PhysicsService } from '../engine/physics';
import { fingerprintOf, type Replayable, type ReplayAction } from '../engine/replay';
import { MachineRules, type ReleaseResult, type RulesEvent } from '../sim/rules';
import type { BoardDef, Color } from '../sim/types';
import {
  BOX, columnX, conveyorTrack, CRATE, dockX, entryDistanceFor, FLIGHT, FUNNEL, funnelFaces, funnelHalfWidth, GRAVITY, MARBLE_RADIUS,
  RACEWAY, RIDE_Y, STACK, TICK_SECONDS,
} from './layout';

export const initPhysics = (): Promise<void> => physics.init();

export type MachineEvent =
  | { readonly type: 'impact'; readonly strength: number; readonly marbleId: number }
  | { readonly type: 'pour'; readonly supply: number; readonly color: Color }
  | { readonly type: 'enter'; readonly marbleId: number }
  | { readonly type: 'kick'; readonly marbleId: number; readonly dock: number }
  | { readonly type: 'captured'; readonly marbleId: number; readonly dock: number; readonly fill: number }
  | { readonly type: 'boxFull'; readonly dock: number; readonly box: number }
  | { readonly type: 'boxGone'; readonly dock: number; readonly box: number }
  | { readonly type: 'won' }
  | { readonly type: 'jammed' }
  | { readonly type: 'recovered'; readonly marbleId: number; readonly how: 'nudge' | 'teleport' | 'bounce'; readonly why: string };

export interface Pose { x: number; y: number; z: number; qx: number; qy: number; qz: number; qw: number }

type CratePhase = 'waiting' | 'opening' | 'gone';
interface CrateControl {
  readonly key: number;
  readonly id: number;
  readonly supply: number;
  readonly color: Color;
  readonly marbleIds: readonly number[];
  phase: CratePhase;
  time: number;
  /** 0 at the front of its column, 1 behind that; eases down the stack as crates ahead go. */
  slide: number;
  rank: number;
  released: boolean;
}

/**
 * Only 'falling' is physics: the drop out of the crate and the pile in the funnel. The neck takes
 * the lowest waiting marble whenever the belt has room, and from then on it is placed exactly.
 */
type MarblePhase = 'crate' | 'falling' | 'exiting' | 'merging' | 'riding' | 'flying' | 'boxed';
interface MarbleControl {
  readonly id: number;
  readonly color: Color;
  phase: MarblePhase;
  crateKey: number;
  crateSlot: number;
  /** Where it rides: belt distance minus the belt's own travel, and its sideways offset. */
  offset: number;
  lateral: number;
  /** The belt has counted it, even while it is still falling toward the floor. */
  entered: boolean;
  time: number;
  fromX: number;
  fromY: number;
  fromZ: number;
  dock: number;
  box: number;
  slot: number;
  hop: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  lastSpeed: number;
  impactCooldown: number;
}

type BoxState = 'queued' | 'docked' | 'leaving' | 'gone';
interface BoxControl {
  readonly dock: number;
  readonly index: number;
  readonly color: Color;
  state: BoxState;
  x: number;
  y: number;
  z: number;
  scale: number;
  fromX: number;
  fromY: number;
  fromZ: number;
  fromScale: number;
  time: number;
  duration: number;
}

interface Control {
  tick: number;
  belt: number;
  crates: CrateControl[];
  marbles: MarbleControl[];
  boxes: BoxControl[];
  lastEntryTick: number;
  /** True this tick if the neck could take a marble: stall timers only run while it is open. */
  neckOpen: boolean;
  recoveries: { nudges: number; teleports: number; bounces: number };
  endingReported: boolean;
}

interface Saved {
  readonly rules: ReturnType<MachineRules['snapshot']>;
  readonly world: Uint8Array;
  readonly control: Control;
}

const BOX_REST_Y = BOX.floorThickness + MARBLE_RADIUS;
/** Steps from the neck's pick to the landing, counting the pick step. The belt moves on meanwhile. */
const EXIT_STEPS = Math.ceil((FUNNEL.exitSeconds + FUNNEL.dropSeconds) / TICK_SECONDS - 1e-6);
const FALL_NUDGE_SECONDS = 4;
const FALL_RESCUE_SECONDS = 8;
const easeInOut = (t: number): number => t * t * (3 - 2 * t);
const easeOut = (t: number): number => 1 - (1 - t) * (1 - t);

export class Machine implements Replayable {
  readonly rules: MachineRules;
  readonly track: ReturnType<typeof conveyorTrack>;
  /** The belt is divided into capacity slots of this length, travelling with it. */
  readonly slotPitch: number;
  readonly entryDistance: number;
  world: RAPIER.World;
  private control: Control;
  private readonly history: Saved[] = [];
  readonly actions: ReplayAction[] = [];
  steps = 0;
  private readonly marbleHandles = new Map<number, number>();
  private beltFloorHandle = -1;
  private readonly events: MachineEvent[] = [];
  private readonly dockDistances: number[];
  lastRecovery = '';

  constructor(readonly board: BoardDef, private readonly physicsService: PhysicsService = physics) {
    this.rules = new MachineRules(board);
    this.track = conveyorTrack(board.trackShape, board.beltCapacity);
    this.slotPitch = this.track.length / board.beltCapacity;
    this.entryDistance = entryDistanceFor(this.track);
    this.world = this.physicsService.createWorld(GRAVITY);
    this.dockDistances = board.docks.map((_, dock) => this.track.nearest(dockX(dock, board.docks.length), RACEWAY.centerZ + RACEWAY.radius).distance);
    this.control = {
      tick: 0, belt: 0, crates: [], marbles: [], boxes: [], lastEntryTick: 0, neckOpen: true,
      recoveries: { nudges: 0, teleports: 0, bounces: 0 }, endingReported: false,
    };
    this.buildFunnel();
    this.buildCratesAndMarbles();
    this.buildBoxes();
  }

  // ---- Building ----

  /** Everything a falling marble can hit: the funnel dish, a chute under its neck, and the belt floor. */
  private buildFunnel(): void {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const { floorY, channelHalf, wallThickness } = RACEWAY;
    const span = Math.max(...Array.from({ length: 64 }, (_, i) => Math.abs(this.track.point(i / 64 * this.track.length).x))) + channelHalf + wallThickness + 0.5;
    this.beltFloorHandle = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(span, 0.25, span).setTranslation(0, floorY - 0.25, RACEWAY.centerZ).setFriction(0.5).setRestitution(0.28), body).handle;

    const { mouth, neck, mouthY, neckY } = FUNNEL;
    const mouthHalf = funnelHalfWidth(this.board.supplies.length);
    const midZ = (mouth.back + mouth.front) / 2;
    const halfZ = (mouth.front - mouth.back) / 2 + 0.2;
    const halfX = mouthHalf + 0.2;
    for (const face of funnelFaces(this.board.supplies.length)) {
      const vertices = new Float32Array([...face, ...face.map((p) => ({ ...p, y: p.y - 0.12 }))].flatMap((p) => [p.x, p.y, p.z]));
      const collider = RAPIER.ColliderDesc.convexHull(vertices);
      if (!collider) throw new Error('Invalid funnel panel');
      this.world.createCollider(collider.setFriction(0.05).setRestitution(0.12), body);
    }

    const rimHalf = (FUNNEL.rimY - mouthY) / 2;
    const rim = (x: number, z: number, hx: number, hz: number): void => {
      this.world.createCollider(RAPIER.ColliderDesc.cuboid(hx, rimHalf, hz).setTranslation(x, mouthY + rimHalf, z).setFriction(0.05).setRestitution(0.08), body);
    };
    rim(-mouthHalf - 0.06, midZ, 0.06, halfZ);
    rim(mouthHalf + 0.06, midZ, 0.06, halfZ);
    rim(0, mouth.back - 0.06, halfX, 0.06);
    rim(0, mouth.front + 0.06, halfX, 0.06);

    // The pile rests on a closed floor under the drawn neck; the exit is scripted, so nothing can arch.
    this.world.createCollider(RAPIER.ColliderDesc.cuboid(neck.halfX + 0.3, 0.06, neck.halfZ + 0.3).setTranslation(0, neckY - 0.06, neck.z).setFriction(0.05).setRestitution(0.25), body);
  }

  private buildCratesAndMarbles(): void {
    this.rules.state.supplies.forEach((queue, supply) => {
      queue.forEach((packet, rank) => {
        const key = packet.marbles[0]?.id;
        if (key === undefined) return;
        const crate: CrateControl = { key, id: packet.id, supply, color: packet.color, marbleIds: packet.marbles.map((m) => m.id), phase: 'waiting', time: 0, slide: rank, rank, released: false };
        this.control.crates.push(crate);
        // Crates have no colliders: their marbles are placed while waiting, and a moving kinematic wall could fling a straggler.
        packet.marbles.forEach((marble, slot) => {
          const place = this.crateSlotWorld(crate, slot);
          const marbleBody = this.physicsService.marble(this.world, MARBLE_RADIUS, place, false, 0.3);
          marbleBody.collider(0).setFriction(0.12);
          marbleBody.collider(0).setCollisionGroups(PARKED_GROUPS);
          this.marbleHandles.set(marble.id, marbleBody.handle);
          this.control.marbles[marble.id] = {
            id: marble.id, color: marble.color, phase: 'crate', crateKey: key, crateSlot: slot, offset: 0, lateral: 0, entered: false,
            time: 0, fromX: 0, fromY: 0, fromZ: 0, dock: -1, box: -1, slot: 0, hop: 0, qx: 0, qy: 0, qz: 0, qw: 1, lastSpeed: 0, impactCooldown: 0,
          };
        });
      });
    });
  }

  private buildBoxes(): void {
    this.board.docks.forEach((queue, dock) => {
      queue.forEach((color, index) => {
        const box: BoxControl = { dock, index, color, state: index === 0 ? 'docked' : 'queued', x: 0, y: 0, z: 0, scale: 1, fromX: 0, fromY: 0, fromZ: 0, fromScale: 1, time: 1, duration: 1 };
        const target = this.boxTarget(box);
        Object.assign(box, target, { fromX: target.x, fromY: target.y, fromZ: target.z, fromScale: target.scale });
        this.control.boxes.push(box);
      });
    });
  }

  private crateOrigin(crate: CrateControl): { x: number; y: number; z: number } {
    // An opening crate stays put, so its walls never shove the marbles falling out of it.
    const count = this.board.supplies.length;
    if (this.board.predecessors) {
      const position = this.shelfPosition(crate.id);
      return { ...position, y: position.y + (crate.phase === 'gone' ? 40 : 0) };
    }
    return {
      x: columnX(crate.supply, count),
      y: STACK.y + STACK.stepY * crate.slide + (crate.phase === 'gone' ? 40 : 0),
      z: this.rules.crateActions ? Math.max(FUNNEL.mouth.back + CRATE.halfDepth + 0.2, STACK.z + STACK.stepZ * crate.slide) : STACK.z + STACK.stepZ * crate.slide,
    };
  }

  /** Static shallow shelves: joins sit between their supports; all drops remain over the dish. */
  private shelfPosition(id: number): { x: number; y: number; z: number } {
    const predecessors = this.rules.predecessors(id);
    if (!predecessors.length) return { x: columnX(this.board.supplies.findIndex((q, i) => id >= this.board.supplies.slice(0, i).flat().length && id < this.board.supplies.slice(0, i + 1).flat().length), this.board.supplies.length), y: STACK.y, z: STACK.z };
    const supports = predecessors.map((before) => this.shelfPosition(before));
    return { x: supports.reduce((sum, p) => sum + p.x, 0) / supports.length,
      y: Math.max(...supports.map((p) => p.y)) + STACK.stepY,
      z: Math.max(FUNNEL.mouth.back + CRATE.halfDepth + 0.2, Math.min(...supports.map((p) => p.z)) + STACK.stepZ) };
  }

  private crateSlotWorld(crate: CrateControl, slot: number): { x: number; y: number; z: number } {
    const origin = this.crateOrigin(crate);
    const local = CRATE.slots[slot];
    if (!local) throw new Error(`No crate slot ${slot}`);
    return { x: origin.x + local.x, y: origin.y + CRATE.floorThickness + MARBLE_RADIUS + 0.005, z: origin.z + local.z };
  }

  /** Where a box wants to be for its current state; queued boxes line up under their dock. */
  private boxTarget(box: BoxControl): { x: number; y: number; z: number; scale: number } {
    const x = dockX(box.dock, this.board.docks.length);
    if (box.state === 'docked') return { x, y: 0, z: BOX.z, scale: 1 };
    if (box.state === 'leaving') return { x, y: -1.6, z: BOX.z - 0.2, scale: 0.7 };
    const ahead = this.control.boxes.filter((other) => other.dock === box.dock && other.index < box.index && other.state === 'queued').length;
    return { x, y: 0, z: BOX.queueZ + ahead * BOX.queueSpacing, scale: BOX.queueScale };
  }

  // ---- Reading state ----

  get canUndo(): boolean { return this.history.length > 0 && this.rules.status !== 'won'; }
  /** A pile resting in the funnel after a jam is not motion; while the game is on, it still has to drain. */
  get transferring(): boolean {
    const playing = this.rules.status === 'playing';
    return this.control.crates.some((crate) => crate.released && crate.phase !== 'gone') ||
      this.control.marbles.some((m) => (m.phase === 'falling' && playing) || m.phase === 'exiting' || m.phase === 'merging' || m.phase === 'flying') ||
      this.control.boxes.some((box) => box.state === 'leaving' || (box.time < box.duration && box.state !== 'gone')) ||
      (playing && this.rules.funnelCount > 0);
  }
  get recoveries(): Readonly<Control['recoveries']> { return this.control.recoveries; }
  get tick(): number { return this.control.tick; }
  get beltDistance(): number { return this.control.belt; }
  /** Where each marble on the belt sits relative to the belt itself. */
  riderOffsets(): number[] {
    return this.control.marbles.filter((marble) => marble.phase === 'riding' || marble.phase === 'merging' || marble.phase === 'exiting').map((marble) => marble.offset);
  }
  get marbleIds(): number[] { return this.control.marbles.map((marble) => marble.id); }
  marbleColor(id: number): Color {
    const marble = this.control.marbles[id];
    if (!marble) throw new Error(`No marble ${id}`);
    return marble.color;
  }
  private marbleBody(id: number): RAPIER.RigidBody {
    const handle = this.marbleHandles.get(id);
    if (handle === undefined) throw new Error(`No marble ${id}`);
    return this.world.getRigidBody(handle);
  }
  readMarble(id: number, into: Pose): void {
    const body = this.marbleBody(id);
    const t = body.translation();
    const q = body.rotation();
    into.x = t.x; into.y = t.y; into.z = t.z;
    into.qx = q.x; into.qy = q.y; into.qz = q.z; into.qw = q.w;
  }
  readCrates(): { id: number; action: number; accessible: boolean; key: number; supply: number; color: Color; x: number; y: number; z: number; open: number; visible: boolean }[] {
    return this.control.crates.map((crate) => ({
      id: crate.id, action: this.rules.crateActions ? crate.id : crate.supply, accessible: this.rules.accessible(crate.id), key: crate.key, supply: crate.supply, color: crate.color, ...this.crateOrigin(crate),
      open: crate.phase === 'opening' ? Math.min(crate.time / CRATE.openSeconds, 1) : 0, visible: crate.phase !== 'gone',
    }));
  }
  readBoxes(): { dock: number; index: number; color: Color; x: number; y: number; z: number; scale: number; fill: number; visible: boolean; docked: boolean }[] {
    return this.control.boxes.map((box) => {
      const ahead = box.state === 'queued' ? this.control.boxes.filter((other) => other.dock === box.dock && other.index < box.index && other.state === 'queued').length : 0;
      return { dock: box.dock, index: box.index, color: box.color, x: box.x, y: box.y, z: box.z, scale: box.scale,
        fill: this.rules.boxFill(box.dock, box.index), visible: box.state !== 'gone' && ahead < BOX.queueVisible, docked: box.state === 'docked' };
    });
  }
  /** The world point a marble must pass to join a box: for hint arrows and tests. */
  frontCrate(supply: number): { x: number; y: number; z: number } | null {
    const packet = this.rules.packet(supply);
    const crate = this.control.crates.find((candidate) => candidate.id === packet?.id);
    return crate ? this.crateOrigin(crate) : null;
  }

  // ---- Player actions ----

  tap(supply: number): ReleaseResult {
    const before = this.saveState();
    const result = this.rules.release(supply);
    if (!result.ok) return result;
    this.history.push(before);
    this.actions.push({ step: this.steps, type: 'tap', at: supply });
    for (const packet of result.packets) {
      const crate = this.control.crates.find((candidate) => candidate.id === packet.id);
      if (crate) crate.released = true;
    }
    return result;
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    const saved = this.history.pop();
    if (!saved) return false;
    this.world.free();
    this.world = RAPIER.World.restoreSnapshot(saved.world);
    this.world.timestep = TICK_SECONDS;
    this.rules.restore(saved.rules);
    this.control = structuredClone(saved.control);
    this.actions.push({ step: this.steps, type: 'undo' });
    return true;
  }

  perform(action: ReplayAction): boolean {
    if (action.type === 'undo') return this.undo();
    return action.type === 'tap' && this.tap(action.at).ok;
  }

  fingerprint(): string {
    return fingerprintOf(this.world.takeSnapshot(), JSON.stringify(this.rules.state), JSON.stringify(this.control));
  }

  private saveState(): Saved {
    return { rules: this.rules.snapshot(), world: this.world.takeSnapshot(), control: structuredClone(this.control) };
  }

  private reportEnding(): void {
    const { status } = this.rules;
    if (status !== 'playing' && !this.control.endingReported) {
      this.control.endingReported = true;
      this.events.push(status === 'won' ? { type: 'won' } : { type: 'jammed' });
    }
  }

  // ---- The fixed tick ----

  step(): MachineEvent[] {
    this.steps += 1;
    const { control } = this;
    control.tick += 1;
    control.belt = (control.belt + RACEWAY.speed * TICK_SECONDS) % this.track.length;
    this.updateCrates();
    this.updateBoxes();
    this.pickFromNeck();
    for (const marble of control.marbles) this.updateMarble(marble);
    this.shakeFeeder();
    this.world.step();
    this.detectImpacts();
    this.reportEnding();
    return this.events.splice(0);
  }

  private updateCrates(): void {
    const dt = TICK_SECONDS;
    for (const crate of this.control.crates) {
      if (crate.phase === 'gone') continue;
      crate.time += dt;
      crate.rank = this.control.crates.filter((other) => other.supply === crate.supply && other.key < crate.key && other.phase === 'waiting').length;
      if (crate.slide > crate.rank) crate.slide = Math.max(crate.slide - dt / STACK.slideSeconds, crate.rank);
      if (crate.phase === 'waiting' && crate.released && (this.rules.crateActions || (crate.rank === 0 && crate.slide === 0))) {
        crate.phase = 'opening';
        crate.time = 0;
        this.events.push({ type: 'pour', supply: crate.supply, color: crate.color });
        for (const id of crate.marbleIds) this.dropFromCrate(id, true);
      } else if (crate.phase === 'opening' && crate.time >= CRATE.openSeconds) {
        crate.phase = 'gone';
      }
    }
  }

  private dropFromCrate(id: number, scatter: boolean): void {
    const marble = this.control.marbles[id];
    if (!marble || marble.phase !== 'crate') return;
    marble.phase = 'falling';
    marble.time = 0;
    const body = this.marbleBody(id);
    body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    body.collider(0).setCollisionGroups(FALLING_GROUPS);
    if (scatter) {
      body.setLinvel({ x: ((id % 3) - 1) * 0.4, y: -0.6, z: 0.5 + (id % 2) * 0.4 }, true);
      body.setAngvel({ x: (id % 3) - 1, y: (id % 5) - 2, z: (id % 2) * 2 - 1 }, true);
    }
  }

  private updateBoxes(): void {
    const dt = TICK_SECONDS;
    for (let dock = 0; dock < this.board.docks.length; dock++) {
      const wanted = this.rules.dockBox(dock);
      const docked = this.control.boxes.find((box) => box.dock === dock && box.state === 'docked');
      if (docked && docked.index !== wanted && this.rules.boxFill(dock, docked.index) >= this.board.boxSize) {
        this.startMotion(docked, 'leaving', BOX.leaveSeconds);
      }
      if (wanted !== null) {
        const next = this.control.boxes.find((box) => box.dock === dock && box.index === wanted);
        const occupied = this.control.boxes.some((box) => box.dock === dock && box.state === 'docked');
        if (next && next.state === 'queued' && !occupied) this.startMotion(next, 'docked', BOX.moveSeconds);
      }
    }
    for (const box of this.control.boxes) {
      if (box.state === 'gone') continue;
      const target = this.boxTarget(box);
      if (box.time < box.duration) {
        box.time = Math.min(box.time + dt, box.duration);
        const t = easeInOut(box.time / box.duration);
        box.x = box.fromX + (target.x - box.fromX) * t;
        box.y = box.fromY + (target.y - box.fromY) * t;
        box.z = box.fromZ + (target.z - box.fromZ) * t;
        box.scale = box.fromScale + (target.scale - box.fromScale) * t;
        if (box.time >= box.duration && box.state === 'leaving') {
          box.state = 'gone';
          this.events.push({ type: 'boxGone', dock: box.dock, box: box.index });
        }
      } else {
        Object.assign(box, target);
      }
    }
  }

  private startMotion(box: BoxControl, state: BoxState, duration: number): void {
    box.fromX = box.x; box.fromY = box.y; box.fromZ = box.z; box.fromScale = box.scale;
    box.state = state;
    box.time = 0;
    box.duration = duration;
  }

  private updateMarble(marble: MarbleControl): void {
    marble.time += TICK_SECONDS;
    switch (marble.phase) {
      case 'crate': {
        const crate = this.control.crates.find((candidate) => candidate.key === marble.crateKey);
        if (crate) this.marbleBody(marble.id).setNextKinematicTranslation(this.crateSlotWorld(crate, marble.crateSlot));
        break;
      }
      case 'falling': this.updateFalling(marble); break;
      case 'exiting': this.updateExiting(marble); break;
      case 'merging':
      case 'riding': this.updateRiding(marble); break;
      case 'flying': this.updateFlying(marble); break;
      case 'boxed': this.placeInBox(marble); break;
    }
  }

  /** The belt offset the entry will have when a marble picked now reaches the bottom of the chute. */
  private landingOffset(): number {
    const length = this.track.length;
    const beltThen = this.control.belt + RACEWAY.speed * TICK_SECONDS * (EXIT_STEPS - 1);
    return (((this.entryDistance - beltThen) % length) + length) % length;
  }

  /** The next belt slot to reach the landing point, and whether a marble picked on this tick would land in it. */
  private nextSlot(): { readonly offset: number; readonly aligned: boolean } {
    const landing = this.landingOffset();
    const capacity = this.board.beltCapacity;
    const nearest = Math.round(landing / this.slotPitch);
    const error = landing - nearest * this.slotPitch;
    const aligned = Math.abs(error) <= RACEWAY.speed * TICK_SECONDS / 2 + 1e-9;
    // Landing offsets fall as the belt advances, so a slot already passed gives way to the one behind it.
    const slot = aligned || error > 0 ? nearest : nearest - 1;
    return { offset: (((slot % capacity) + capacity) % capacity) * this.slotPitch, aligned };
  }

  /** No rider, merging marble or reserved landing holds this slot. */
  private slotFree(offset: number, except: MarbleControl | null): boolean {
    const length = this.track.length;
    for (const other of this.control.marbles) {
      if (other === except) continue;
      if (other.phase !== 'riding' && other.phase !== 'merging' && other.phase !== 'exiting') continue;
      const gap = Math.abs((((other.offset - offset) % length) + length * 1.5) % length - length / 2);
      if (gap < this.slotPitch / 2) return false;
    }
    return true;
  }

  /**
   * One marble at a time through the neck, and only into a free slot. Marbles already in the chute hold
   * their reserved slots, so two can never share one, and capacity riders always fit: free room in the
   * rules always means a free slot, which comes round within a lap.
   */
  private canEnter(): boolean {
    if (this.rules.status !== 'playing' || this.rules.free <= 0) return false;
    if (this.control.marbles.some((other) => other.phase === 'exiting' && other.time < FUNNEL.exitSeconds)) return false;
    return this.slotFree(this.nextSlot().offset, null);
  }

  /**
   * The neck takes a marble resting on it as soon as the belt has room: the earliest pour first
   * when several sit at the bottom, otherwise whichever is lowest nearby.
   */
  private pickFromNeck(): void {
    this.control.neckOpen = this.canEnter();
    const slot = this.nextSlot();
    if (!this.control.neckOpen || !slot.aligned) return;
    let pick: MarbleControl | null = null;
    let best = Number.POSITIVE_INFINITY;
    const order = this.rules.state.pending;
    for (const marble of this.control.marbles) {
      if (marble.phase !== 'falling') continue;
      const at = this.marbleBody(marble.id).translation();
      const reach = hypot(at.x, at.z - FUNNEL.neck.z);
      if (at.y > FUNNEL.neckY + FUNNEL.pickHeight || reach > FUNNEL.pickRadius) continue;
      const bottom = reach < FUNNEL.pickRadius * 0.5 && at.y < FUNNEL.neckY + MARBLE_RADIUS * 1.6;
      const score = bottom ? order.indexOf(marble.id) : 1000 + at.y;
      if (score >= best) continue;
      best = score;
      pick = marble;
    }
    if (!pick || !this.rules.entered(pick.id)) return;
    const body = this.marbleBody(pick.id);
    const t = body.translation();
    const q = body.rotation();
    pick.phase = 'exiting';
    pick.entered = true;
    pick.time = 0;
    pick.fromX = t.x; pick.fromY = t.y; pick.fromZ = t.z;
    pick.qx = q.x; pick.qy = q.y; pick.qz = q.z; pick.qw = q.w;
    pick.lateral = ((pick.id * 7) % 5 - 2) / 2 * RACEWAY.jitter;
    pick.offset = slot.offset;
    body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, false);
    // It slips out of the pile without touching it; a moving kinematic ball would fling its neighbours.
    body.collider(0).setCollisionGroups(PARKED_GROUPS);
    this.control.lastEntryTick = this.control.tick;
  }

  /** Down through the neck, then a short drop onto the belt where it joins the flow. */
  private updateExiting(marble: MarbleControl): void {
    const body = this.marbleBody(marble.id);
    const neck = { x: 0, y: FUNNEL.neckY - MARBLE_RADIUS * 0.4, z: FUNNEL.neck.z };
    if (marble.time < FUNNEL.exitSeconds) {
      const t = easeInOut(marble.time / FUNNEL.exitSeconds);
      body.setNextKinematicTranslation({ x: marble.fromX + (neck.x - marble.fromX) * t, y: marble.fromY + (neck.y - marble.fromY) * t, z: marble.fromZ + (neck.z - marble.fromZ) * t });
      return;
    }
    // A hair of tolerance keeps the landing on the step the reservation assumed, despite summed ticks.
    const t = Math.min((marble.time + 1e-9 - FUNNEL.exitSeconds) / FUNNEL.dropSeconds, 1);
    const land = this.track.point(this.entryDistance, marble.lateral);
    const s = t * t;
    body.setNextKinematicTranslation({ x: neck.x + (land.x - neck.x) * s, y: neck.y + (RIDE_Y + land.y - neck.y) * s, z: neck.z + (land.z - neck.z) * s });
    this.roll(marble, 0, 0);
    if (t >= 1) this.joinBelt(marble, body);
  }

  private updateFalling(marble: MarbleControl): void {
    const body = this.marbleBody(marble.id);
    const t = body.translation();
    if (!this.control.neckOpen) marble.time = Math.min(marble.time, 1);
    const lost = t.y < RACEWAY.floorY - 0.5 || Math.abs(t.x) > funnelHalfWidth(this.board.supplies.length) + 1 || t.z > 1.5 || t.z < FUNNEL.mouth.back - 2;
    if (lost || marble.time > FALL_RESCUE_SECONDS) this.teleportToFunnel(marble, lost ? 'left the funnel' : 'never reached the neck');
    else if (marble.time > FALL_NUDGE_SECONDS && Math.floor(marble.time * 60) % 45 === 0) this.nudge(marble, { x: -t.x * 0.6, y: 2.2, z: (FUNNEL.neck.z - t.z) * 0.6 });
  }

  /** The chute ends here: the marble takes the slot reserved for it at the neck and rides from there. */
  private joinBelt(marble: MarbleControl, body: RAPIER.RigidBody): void {
    const t = body.translation();
    const q = body.rotation();
    if (!this.slotFree(marble.offset, marble)) {
      // The reservation should make this impossible. Step back behind the neighbour and count it, so soaks notice.
      for (let attempt = 0; attempt < 6 && !this.slotFree(marble.offset, marble); attempt++) {
        marble.offset = (marble.offset - this.slotPitch + this.track.length) % this.track.length;
      }
      this.control.recoveries.bounces += 1;
      this.lastRecovery = `landing slot taken at ${t.x.toFixed(2)},${t.z.toFixed(2)}`;
      this.events.push({ type: 'recovered', marbleId: marble.id, how: 'bounce', why: 'landing slot taken' });
    }
    marble.phase = 'merging';
    marble.time = 0;
    marble.lateral = Math.max(-RACEWAY.jitter, Math.min(RACEWAY.jitter, marble.lateral));
    marble.fromX = t.x; marble.fromY = t.y; marble.fromZ = t.z;
    marble.qx = q.x; marble.qy = q.y; marble.qz = q.z; marble.qw = q.w;
    body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, false);
    body.collider(0).setCollisionGroups(PLACED_GROUPS);
    this.events.push({ type: 'enter', marbleId: marble.id });
  }

  private updateRiding(marble: MarbleControl): void {
    const body = this.marbleBody(marble.id);
    const distance = (this.control.belt + marble.offset) % this.track.length;
    const point = this.track.point(distance, marble.lateral);
    let { x, z } = point;
    let y = RIDE_Y + point.y;
    if (marble.phase === 'merging') {
      const t = Math.min(marble.time / FLIGHT.mergeSeconds, 1);
      const eased = easeInOut(t);
      x = marble.fromX + (x - marble.fromX) * eased;
      y = marble.fromY + (y - marble.fromY) * eased;
      z = marble.fromZ + (z - marble.fromZ) * eased;
      if (t >= 1) marble.phase = 'riding';
    }
    this.roll(marble, point.tx * RACEWAY.speed, point.tz * RACEWAY.speed);
    body.setNextKinematicTranslation({ x, y, z });
    body.setNextKinematicRotation({ x: marble.qx, y: marble.qy, z: marble.qz, w: marble.qw });
    if (marble.phase !== 'riding') return;
    const moved = RACEWAY.speed * TICK_SECONDS;
    for (let dock = 0; dock < this.dockDistances.length; dock++) {
      const past = (distance - (this.dockDistances[dock] ?? 0) + this.track.length) % this.track.length;
      if (past >= moved) continue;
      const arrival = this.rules.arrive(marble.id, dock);
      if (arrival.result !== 'deliver') continue;
      for (const event of arrival.events) if (event.type === 'boxFull') this.events.push(event);
      marble.phase = 'flying';
      marble.time = 0;
      marble.dock = dock;
      marble.box = arrival.box;
      marble.slot = arrival.slot;
      marble.fromX = x; marble.fromY = y; marble.fromZ = z;
      this.events.push({ type: 'kick', marbleId: marble.id, dock });
      return;
    }
  }

  private boxSlot(marble: MarbleControl): { x: number; y: number; z: number } {
    const box = this.control.boxes.find((candidate) => candidate.dock === marble.dock && candidate.index === marble.box);
    if (!box) return { x: dockX(marble.dock, this.board.docks.length), y: BOX_REST_Y, z: BOX.z };
    return { x: box.x + (marble.slot - 1) * BOX.slotSpacing * box.scale, y: box.y + BOX_REST_Y * box.scale, z: box.z };
  }

  private updateFlying(marble: MarbleControl): void {
    const body = this.marbleBody(marble.id);
    const t = Math.min(marble.time / FLIGHT.seconds, 1);
    const to = this.boxSlot(marble);
    body.setNextKinematicTranslation({
      x: marble.fromX + (to.x - marble.fromX) * t,
      y: marble.fromY + (to.y - marble.fromY) * t * t + sin(t * Math.PI) * FLIGHT.arc,
      z: marble.fromZ + (to.z - marble.fromZ) * t,
    });
    this.roll(marble, 0, RACEWAY.speed * 0.8);
    body.setNextKinematicRotation({ x: marble.qx, y: marble.qy, z: marble.qz, w: marble.qw });
    if (t < 1) return;
    marble.phase = 'boxed';
    marble.hop = FLIGHT.hopSeconds;
    for (const event of this.rules.captured(marble.id)) if (event.type === 'won') this.reportEnding();
    this.events.push({ type: 'captured', marbleId: marble.id, dock: marble.dock, fill: this.rules.boxFill(marble.dock, marble.box) });
  }

  private placeInBox(marble: MarbleControl): void {
    if (marble.hop > 0) marble.hop = Math.max(marble.hop - TICK_SECONDS, 0);
    const lift = sin((marble.hop / FLIGHT.hopSeconds) * Math.PI) * FLIGHT.hopHeight;
    const to = this.boxSlot(marble);
    this.marbleBody(marble.id).setNextKinematicTranslation({ x: to.x, y: to.y + lift, z: to.z });
  }

  /** Turns the marble as if it were rolling at this velocity. */
  private roll(marble: MarbleControl, vx: number, vz: number): void {
    const speed = hypot(vx, vz);
    if (speed === 0) return;
    const angle = (speed * TICK_SECONDS) / MARBLE_RADIUS;
    const ax = vz / speed;
    const az = -vx / speed;
    const s = sin(angle / 2);
    const c = cos(angle / 2);
    const { qx, qy, qz, qw } = marble;
    const dx = ax * s;
    const dz = az * s;
    marble.qw = c * qw - dx * qx - dz * qz;
    marble.qx = c * qx + dx * qw - dz * qy;
    marble.qy = c * qy + dz * qx - dx * qz;
    marble.qz = c * qz + dz * qw + dx * qy;
  }

  private nudge(marble: MarbleControl, impulse: { x: number; y: number; z: number }): void {
    const body = this.marbleBody(marble.id);
    const mass = body.mass();
    const at = body.translation();
    this.lastRecovery = `nudged at ${at.x.toFixed(1)},${at.y.toFixed(1)},${at.z.toFixed(1)}`;
    body.applyImpulse({ x: impulse.x * mass, y: impulse.y * mass, z: impulse.z * mass }, true);
    this.control.recoveries.nudges += 1;
    this.events.push({ type: 'recovered', marbleId: marble.id, how: 'nudge', why: 'not moving' });
  }

  private teleportToFunnel(marble: MarbleControl, why: string): void {
    const body = this.marbleBody(marble.id);
    const from = body.translation();
    this.lastRecovery = `${why} at ${from.x.toFixed(2)},${from.y.toFixed(2)},${from.z.toFixed(2)}`;
    body.setTranslation({ x: 0, y: FUNNEL.mouthY + 0.6, z: (FUNNEL.mouth.back + FUNNEL.mouth.front) / 2 }, true);
    body.setLinvel({ x: 0, y: -2, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    marble.time = 0;
    this.control.recoveries.teleports += 1;
    this.events.push({ type: 'recovered', marbleId: marble.id, how: 'teleport', why });
  }

  /** The dish vibrates like a parts feeder: slow marbles near the neck get a small push toward it. */
  private shakeFeeder(): void {
    if (this.control.tick % 4 !== 0) return;
    for (const marble of this.control.marbles) {
      if (marble.phase !== 'falling') continue;
      const body = this.marbleBody(marble.id);
      const at = body.translation();
      if (at.y > FUNNEL.neckY + FUNNEL.shakeHeight) continue;
      const v = body.linvel();
      if (hypot(v.x, v.z) > 1.2) continue;
      const phase = (this.control.tick * 0.37 + marble.id * 1.7) % (Math.PI * 2);
      const mass = body.mass();
      const toNeck = { x: -at.x, z: FUNNEL.neck.z - at.z };
      body.applyImpulse({
        x: (toNeck.x * 0.5 + cos(phase) * 0.6) * FUNNEL.shakeImpulse * mass,
        y: (0.35 + 0.25 * sin(phase * 2)) * FUNNEL.shakeImpulse * mass,
        z: (toNeck.z * 0.5 + sin(phase) * 0.6) * FUNNEL.shakeImpulse * mass,
      }, true);
    }
  }

  /** Sound comes from what really happened in the fall: a sudden change of speed means a hit. */
  private detectImpacts(): void {
    for (const marble of this.control.marbles) {
      if (marble?.phase !== 'falling') continue;
      const v = this.marbleBody(marble.id).linvel();
      const speed = hypot(v.x, v.y, v.z);
      const change = Math.abs(speed - marble.lastSpeed);
      marble.lastSpeed = speed;
      marble.impactCooldown = Math.max(marble.impactCooldown - TICK_SECONDS, 0);
      if (change > 1.6 && marble.impactCooldown === 0) {
        marble.impactCooldown = 0.07;
        this.events.push({ type: 'impact', strength: Math.min(change / 10, 1), marbleId: marble.id });
      }
    }
  }
}
