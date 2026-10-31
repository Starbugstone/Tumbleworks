import RAPIER from '@dimforge/rapier3d-compat';
import { FALLING_GROUPS, PLACED_GROUPS, physics, type PhysicsService } from '../engine/physics';
import { MachineRules, type ReleaseResult, type RulesEvent } from '../sim/rules';
import type { BoardDef, Color } from '../sim/types';
import {
  BOX,
  FLIGHT,
  FUNNEL,
  GATE,
  GRAVITY,
  MARBLE_RADIUS,
  nearestOnTrack,
  RACEWAY,
  supplyX,
  TICK_SECONDS,
  TRACK_LENGTH,
  trackPoint,
  TRAY,
} from './layout';

export const initPhysics = (): Promise<void> => physics.init();

export type MachineEvent =
  | { readonly type: 'impact'; readonly strength: number; readonly marbleId: number }
  | { readonly type: 'kick'; readonly marbleId: number }
  | { readonly type: 'captured'; readonly marbleId: number; readonly boxIndex: number; readonly fill: number }
  | { readonly type: 'boxFull'; readonly boxIndex: number }
  | { readonly type: 'boxSwapped' }
  | { readonly type: 'won' }
  | { readonly type: 'jammed' }
  | { readonly type: 'recovered'; readonly marbleId: number; readonly how: 'nudge' | 'teleport'; readonly why: string };

export interface Pose {
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
}

type TrayPhase = 'waiting' | 'tipping' | 'pouring' | 'leaving' | 'gone';

interface TrayControl {
  readonly key: number;
  readonly supply: number;
  readonly color: Color;
  readonly marbleIds: readonly number[];
  phase: TrayPhase;
  /** Seconds in the current phase. */
  time: number;
  angle: number;
  /** 0 at the front spot, 1 behind it. */
  position: number;
  released: boolean;
  /** Eases from 1 (behind) to 0 (front), so the tray can slide forward. */
  slide: number;
  /** How many of its marbles have been let go, and the seconds since tipping began. */
  poured: number;
  pourClock: number;
}

/**
 * Only 'falling' is physics. Everywhere else a marble is placed exactly: in its tray, in its slot
 * on the belt, along its arc into the box, and in its place in the box.
 */
type MarblePhase = 'tray' | 'falling' | 'waiting' | 'merging' | 'riding' | 'flying' | 'boxed';

interface MarbleControl {
  readonly id: number;
  readonly color: Color;
  phase: MarblePhase;
  trayKey: number;
  traySlot: number;
  /** Which belt slot it rides in. */
  beltSlot: number;
  /** A stable holding place, so draining the queue does not shift the whole reservoir. */
  funnelSlot: number;
  /** Seconds in the current phase. */
  time: number;
  fromX: number;
  fromY: number;
  fromZ: number;
  flightSeconds: number;
  box: number;
  boxSlot: number;
  /** Seconds left of the small hop on landing. */
  hop: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  lastSpeed: number;
  impactCooldown: number;
}

interface Control {
  tick: number;
  /** How far the belt has moved. */
  belt: number;
  trays: TrayControl[];
  marbles: MarbleControl[];
  doorOpen: number;
  /** 0 to 1, for drawing the kicker arm. */
  paddle: number;
  activeBox: number;
  boxX: number[];
  hold: number;
  swap: number;
  recoveries: { nudges: number; teleports: number };
  endingReported: boolean;
  /** The last box only tells the rules it has gone once it really has, because that's the win. */
  swapOwed: boolean;
}

interface Saved {
  readonly rules: ReturnType<MachineRules['snapshot']>;
  readonly world: Uint8Array;
  readonly control: Control;
}

const SLOT_SPACING = TRACK_LENGTH / RACEWAY.slots;
const RIDE_Y = RACEWAY.floorY + MARBLE_RADIUS;
const BOX_REST_Y = BOX.floorThickness + MARBLE_RADIUS;
/** Falling marbles get a nudge after this long, then a teleport. Neither should normally happen. */
const FALL_NUDGE_SECONDS = 4;
const FALL_RESCUE_SECONDS = 8;
const easeInOut = (t: number): number => t * t * (3 - 2 * t);
const trayQuat = (angle: number): RAPIER.Rotation => ({ x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) });

export class Machine {
  readonly rules: MachineRules;
  world: RAPIER.World;
  private control: Control;
  private readonly history: Saved[] = [];
  private readonly marbleHandles = new Map<number, number>();
  private readonly trayHandles = new Map<number, number>();
  private beltFloorHandle = -1;
  private readonly events: MachineEvent[] = [];
  private readonly gateDistance: number;
  /** The most recent rescue, for diagnosing transport faults. */
  lastRecovery = '';

  constructor(readonly board: BoardDef, private readonly physicsService: PhysicsService = physics) {
    this.rules = new MachineRules(board);
    this.world = this.physicsService.createWorld(GRAVITY);
    this.gateDistance = nearestOnTrack(GATE.checkX, RACEWAY.centerZ + RACEWAY.radius).distance;
    this.control = {
      tick: 0,
      belt: 0,
      trays: [],
      marbles: [],
      doorOpen: 0,
      paddle: 0,
      activeBox: 0,
      boxX: board.boxes.map((_, i) => (i === 0 ? 0 : i === 1 ? BOX.nextX : BOX.parkedX)),
      hold: 0,
      swap: 0,
      recoveries: { nudges: 0, teleports: 0 },
      endingReported: false,
      swapOwed: false,
    };
    this.buildFunnel();
    this.buildTraysAndMarbles();
  }

  // ---- Building ----

  /** A thin plate between two lines. Each line is the plate's edge, running along the given axis. */
  private plate(
    body: RAPIER.RigidBody,
    axis: 'x' | 'z',
    a: { along: number; y: number },
    b: { along: number; y: number },
    halfWidth: number,
    center: number,
  ): void {
    const dAlong = b.along - a.along;
    const dY = b.y - a.y;
    const halfLength = Math.hypot(dAlong, dY) / 2;
    const midAlong = (a.along + b.along) / 2;
    const midY = (a.y + b.y) / 2;
    const thickness = 0.06;
    const angle = Math.atan2(dY, dAlong);
    let desc: RAPIER.ColliderDesc;
    if (axis === 'x') {
      // Slopes in the x-y plane, spanning z.
      desc = RAPIER.ColliderDesc.cuboid(halfLength, thickness, halfWidth)
        .setTranslation(midAlong, midY, center)
        .setRotation({ x: 0, y: 0, z: Math.sin(angle / 2), w: Math.cos(angle / 2) });
    } else {
      // Slopes in the z-y plane, spanning x. A positive x rotation takes +z to -y.
      desc = RAPIER.ColliderDesc.cuboid(halfWidth, thickness, halfLength)
        .setTranslation(center, midY, midAlong)
        .setRotation({ x: -Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) });
    }
    this.world.createCollider(desc.setFriction(0.08).setRestitution(0.35), body);
  }

  /** Everything a falling marble can hit: the funnel, its clear walls, and the belt below it. */
  private buildFunnel(): void {
    const body = this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
    const { floorY, centerZ, straightHalf, radius, channelHalf, wallThickness } = RACEWAY;

    const floorHalfZ = radius + channelHalf + wallThickness + 0.02;
    this.beltFloorHandle = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(straightHalf + floorHalfZ, 0.25, floorHalfZ)
        .setTranslation(0, floorY - 0.25, centerZ)
        .setFriction(0.55)
        .setRestitution(0.3),
      body,
    ).handle;

    const { mouth, neck, mouthY, neckY } = FUNNEL;
    const midZ = (mouth.back + mouth.front) / 2;
    const halfZ = (mouth.front - mouth.back) / 2 + 0.2;
    const halfX = (mouth.right - mouth.left) / 2 + 0.2;
    this.plate(body, 'x', { along: mouth.left, y: mouthY }, { along: neck.left, y: neckY }, halfZ, midZ);
    this.plate(body, 'x', { along: mouth.right, y: mouthY }, { along: neck.right, y: neckY }, halfZ, midZ);
    this.plate(body, 'z', { along: mouth.back, y: mouthY }, { along: neck.back, y: neckY }, halfX, 0);
    this.plate(body, 'z', { along: mouth.front, y: mouthY }, { along: neck.front, y: neckY }, halfX, 0);

    const wallHalfY = (FUNNEL.wallTopY - mouthY) / 2;
    const wallY = mouthY + wallHalfY;
    const funnelWall = (x: number, z: number, hx: number, hz: number): void => {
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, wallHalfY, hz).setTranslation(x, wallY, z).setFriction(0.05).setRestitution(0.3),
        body,
      );
    };
    funnelWall(mouth.left - 0.06, midZ, 0.06, halfZ);
    funnelWall(mouth.right + 0.06, midZ, 0.06, halfZ);
    funnelWall(0, mouth.front + 0.06, halfX, 0.06);

    // Below the neck, a short clear skirt keeps a lively marble over the belt until it lands.
    const skirtHalfY = (neckY - floorY) / 2;
    const skirt = (x: number, z: number, hx: number, hz: number): void => {
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, skirtHalfY, hz).setTranslation(x, floorY + skirtHalfY, z).setFriction(0.05).setRestitution(0.2),
        body,
      );
    };
    const neckMidZ = (neck.back + neck.front) / 2;
    const neckHalfZ = (neck.front - neck.back) / 2;
    const neckHalfX = (neck.right - neck.left) / 2;
    skirt(neck.left - 0.06, neckMidZ, 0.06, neckHalfZ + 0.1);
    skirt(neck.right + 0.06, neckMidZ, 0.06, neckHalfZ + 0.1);
    skirt(0, neck.back - 0.06, neckHalfX + 0.1, 0.06);
    skirt(0, neck.front + 0.06, neckHalfX + 0.1, 0.06);
  }

  private buildTraysAndMarbles(): void {
    this.rules.state.supplies.forEach((queue, supply) => {
      queue.forEach((packet, position) => {
        const key = packet.marbles[0]?.id;
        if (key === undefined) return;
        const tray: TrayControl = {
          key,
          supply,
          color: packet.color,
          marbleIds: packet.marbles.map((marble) => marble.id),
          phase: 'waiting',
          time: 0,
          angle: 0,
          position,
          released: false,
          slide: position,
          poured: 0,
          pourClock: 0,
        };
        this.control.trays.push(tray);
        const origin = this.trayOrigin(tray);
        const body = this.world.createRigidBody(
          RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(origin.x, origin.y, origin.z),
        );
        this.trayHandles.set(key, body.handle);
        this.buildTrayColliders(body);

        packet.marbles.forEach((marble, slot) => {
          const place = this.traySlotWorld(tray, slot);
          const marbleBody = this.physicsService.marble(this.world, MARBLE_RADIUS, place);
          this.marbleHandles.set(marble.id, marbleBody.handle);
          this.control.marbles[marble.id] = {
            id: marble.id,
            color: marble.color,
            phase: 'tray',
            trayKey: key,
            traySlot: slot,
            beltSlot: -1,
            funnelSlot: -1,
            time: 0,
            fromX: 0,
            fromY: 0,
            fromZ: 0,
            flightSeconds: FLIGHT.seconds,
            box: -1,
            boxSlot: 0,
            hop: 0,
            qx: 0,
            qy: 0,
            qz: 0,
            qw: 1,
            lastSpeed: 0,
            impactCooldown: 0,
          };
        });
      });
    });
  }

  private buildTrayColliders(body: RAPIER.RigidBody): void {
    const { halfWidth: hw, depth, floorThickness: ft, wallHeight: wh, sillHeight: sh, wallThickness: wt } = TRAY;
    const collider = (x: number, y: number, z: number, hx: number, hy: number, hz: number): void => {
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(0.06).setRestitution(0.2),
        body,
      );
    };
    collider(0, ft / 2, -depth / 2, hw, ft / 2, depth / 2);
    collider(-hw + wt / 2, ft + wh / 2, -depth / 2, wt / 2, wh / 2, depth / 2);
    collider(hw - wt / 2, ft + wh / 2, -depth / 2, wt / 2, wh / 2, depth / 2);
    collider(0, ft + wh / 2, -depth + wt / 2, hw, wh / 2, wt / 2);
    collider(0, ft + sh / 2, -wt / 2, hw, sh / 2, wt / 2);
  }

  private trayOrigin(tray: TrayControl): { x: number; y: number; z: number } {
    const count = this.board.supplies.length;
    const eased = tray.slide;
    const leaving = tray.phase === 'leaving' ? easeInOut(Math.min(tray.time / TRAY.leaveSeconds, 1)) : 0;
    return {
      x: supplyX(tray.supply, count),
      y: TRAY.frontY + (TRAY.nextY - TRAY.frontY) * eased + leaving * 2 + (tray.phase === 'gone' ? 40 : 0),
      z: TRAY.frontZ + (TRAY.nextZ - TRAY.frontZ) * eased - leaving * 5,
    };
  }

  private traySlotWorld(tray: TrayControl, slot: number): { x: number; y: number; z: number } {
    const origin = this.trayOrigin(tray);
    const local = TRAY.slots[slot];
    if (!local) throw new Error(`No tray slot ${slot}`);
    const up = TRAY.floorThickness + MARBLE_RADIUS + 0.005;
    const cos = Math.cos(tray.angle);
    const sin = Math.sin(tray.angle);
    return {
      x: origin.x + local.x,
      y: origin.y + up * cos - local.z * sin,
      z: origin.z + up * sin + local.z * cos,
    };
  }

  // ---- Reading state ----

  get canUndo(): boolean {
    return this.history.length > 0 && this.rules.status !== 'won';
  }

  get transferring(): boolean {
    return this.control.hold > 0 || this.control.swap > 0 || this.rules.state.waitingForSwap ||
      this.control.marbles.some((marble) => marble.phase === 'falling' || marble.phase === 'merging' || marble.phase === 'flying') ||
      this.control.trays.some((tray) => tray.released && tray.phase !== 'gone') ||
      (this.rules.status === 'playing' && this.rules.funnelCount > 0) ||
      this.rules.state.marbles.some((marble) => marble.status === 'dropping');
  }

  get recoveries(): { readonly nudges: number; readonly teleports: number } {
    return this.control.recoveries;
  }

  get tick(): number {
    return this.control.tick;
  }

  /** How far the belt has moved, for drawing it. */
  get beltDistance(): number {
    return this.control.belt;
  }

  /** 0 closed, 1 fully swung, for drawing the kicker. */
  get paddle(): number {
    return this.control.paddle;
  }

  /** How many marbles have landed in this box. */
  boxFill(boxIndex: number): number {
    return this.control.marbles.filter((marble) => marble?.phase === 'boxed' && marble.box === boxIndex).length;
  }

  get doorIsOpen(): boolean {
    return this.control.doorOpen > 0;
  }

  get activeBoxForView(): number {
    return this.control.activeBox;
  }

  get marbleIds(): number[] {
    return this.control.marbles.map((marble) => marble.id);
  }

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
    into.x = t.x;
    into.y = t.y;
    into.z = t.z;
    into.qx = q.x;
    into.qy = q.y;
    into.qz = q.z;
    into.qw = q.w;
  }

  readTrays(): { key: number; supply: number; color: Color; x: number; y: number; z: number; angle: number; visible: boolean }[] {
    return this.control.trays.map((tray) => {
      const origin = this.trayOrigin(tray);
      return {
        key: tray.key,
        supply: tray.supply,
        color: tray.color,
        ...origin,
        angle: tray.angle,
        visible: tray.phase !== 'gone',
      };
    });
  }

  readBoxX(index: number): number {
    return this.control.boxX[index] ?? BOX.parkedX;
  }

  // ---- Player actions ----

  tap(supply: number): ReleaseResult {
    const before = this.saveState();
    const result = this.rules.release(supply);
    if (!result.ok) return result;
    this.history.push(before);
    const key = result.marbles[0]?.id;
    const tray = this.control.trays.find((candidate) => candidate.key === key);
    if (tray) tray.released = true;
    this.afterRulesEvents(result.events);
    return result;
  }

  undo(): boolean {
    if (!this.canUndo) return false;
    const saved = this.history.pop();
    if (!saved) return false;
    this.restoreState(saved);
    return true;
  }

  private saveState(): Saved {
    return { rules: this.rules.snapshot(), world: this.world.takeSnapshot(), control: structuredClone(this.control) };
  }

  private restoreState(saved: Saved): void {
    this.world.free();
    this.world = RAPIER.World.restoreSnapshot(saved.world);
    this.world.timestep = TICK_SECONDS;
    this.rules.restore(saved.rules);
    this.control = structuredClone(saved.control);
  }

  /**
   * The rules count a marble from the moment it's kicked, so the selector moves on to the next
   * colour straight away and a matching marble never has to ride another lap. The physical box
   * catches up behind it. The last box only tells the rules it has gone once it really has, because
   * that's the win.
   */
  private afterRulesEvents(events: readonly RulesEvent[]): void {
    for (const event of events) {
      if (event.type !== 'boxFull') continue;
      if (event.boxIndex + 1 < this.board.boxes.length) this.afterRulesEvents(this.rules.boxSwapped());
      else this.control.swapOwed = true;
    }
  }

  /** Any rules call can end the game, so the end is noticed in one place and reported once. */
  private reportEnding(): void {
    const { status } = this.rules;
    if (status !== 'playing' && !this.control.endingReported) {
      this.control.endingReported = true;
      this.events.push(status === 'won' ? { type: 'won' } : { type: 'jammed' });
    }
  }

  // ---- The fixed tick ----

  step(): MachineEvent[] {
    const { control } = this;
    control.tick += 1;
    control.belt = (control.belt + RACEWAY.speed * TICK_SECONDS) % TRACK_LENGTH;
    this.updateTrays();
    this.updateBoxes();
    if (control.doorOpen > 0) control.doorOpen -= TICK_SECONDS;
    control.paddle = Math.max(control.paddle - TICK_SECONDS * 6, 0);
    for (const marble of control.marbles) this.updateMarble(marble);
    this.world.step();
    this.detectImpacts();
    this.reportEnding();
    return this.events.splice(0);
  }

  private updateTrays(): void {
    const dt = TICK_SECONDS;
    for (const tray of this.control.trays) {
      if (tray.phase === 'gone') continue;
      tray.time += dt;
      tray.position = this.control.trays.filter((other) => other.supply === tray.supply && other.key < tray.key && other.phase !== 'gone' && other.phase !== 'leaving').length;
      if (tray.slide > tray.position) tray.slide = Math.max(tray.slide - dt / TRAY.slideSeconds, tray.position);

      switch (tray.phase) {
        case 'waiting':
          if (tray.released && tray.slide === 0 && tray.position === 0) {
            tray.phase = 'tipping';
            tray.time = 0;
          }
          break;
        case 'tipping': {
          const t = Math.min(tray.time / TRAY.tipSeconds, 1);
          tray.angle = TRAY.tipAngle * easeInOut(t);
          if (t >= 1) {
            tray.phase = 'pouring';
            tray.time = 0;
          }
          break;
        }
        case 'pouring': {
          const allLetGo = tray.poured >= tray.marbleIds.length;
          const empty = allLetGo && tray.marbleIds.every((id) => !this.marbleInTray(id, tray));
          if (empty || (allLetGo && tray.time > TRAY.pourSeconds)) {
            tray.phase = 'leaving';
            tray.time = 0;
          }
          break;
        }
        case 'leaving':
          if (tray.time >= TRAY.leaveSeconds) {
            tray.phase = 'gone';
            tray.time = 0;
          }
          break;
      }

      if (tray.phase === 'tipping' || tray.phase === 'pouring') {
        tray.pourClock += dt;
        while (
          tray.poured < tray.marbleIds.length &&
          tray.pourClock >= TRAY.firstMarbleSeconds + tray.poured * TRAY.marbleGapSeconds
        ) {
          const id = tray.marbleIds[tray.poured];
          if (id !== undefined) this.dropFromTray(id);
          tray.poured += 1;
          if (tray.poured === tray.marbleIds.length) tray.time = 0;
        }
      }

      const handle = this.trayHandles.get(tray.key);
      if (handle === undefined) continue;
      const body = this.world.getRigidBody(handle);
      body.setNextKinematicTranslation(this.trayOrigin(tray));
      body.setNextKinematicRotation(trayQuat(tray.angle));
    }
  }

  private dropFromTray(id: number): void {
    const marble = this.control.marbles[id];
    if (!marble) return;
    marble.phase = 'falling';
    marble.time = 0;
    const body = this.marbleBody(id);
    body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    body.collider(0).setCollisionGroups(FALLING_GROUPS);
    body.setAngvel({ x: (id % 3) - 1, y: (id % 5) - 2, z: (id % 2) * 2 - 1 }, true);
  }

  private marbleInTray(id: number, tray: TrayControl): boolean {
    const t = this.marbleBody(id).translation();
    const origin = this.trayOrigin(tray);
    return t.z < origin.z + 0.1 && t.y > origin.y - 1.5;
  }

  private updateBoxes(): void {
    const dt = TICK_SECONDS;
    const { control } = this;
    if (control.hold > 0) {
      control.hold -= dt;
      if (control.hold <= 0) control.swap = BOX.swapSeconds;
    } else if (control.swap > 0) {
      control.swap -= dt;
      const t = easeInOut(Math.min(1 - control.swap / BOX.swapSeconds, 1));
      const active = control.activeBox;
      control.boxX[active] = BOX.exitX * t;
      if (active + 1 < control.boxX.length) control.boxX[active + 1] = BOX.nextX * (1 - t);
      if (control.swap <= 0) {
        control.boxX[active] = -BOX.parkedX;
        control.activeBox += 1;
        if (control.activeBox + 1 < control.boxX.length) control.boxX[control.activeBox + 1] = BOX.nextX;
        this.events.push({ type: 'boxSwapped' });
        if (control.swapOwed) {
          control.swapOwed = false;
          this.rules.boxSwapped();
        }
      }
    }
  }

  private updateMarble(marble: MarbleControl): void {
    marble.time += TICK_SECONDS;
    switch (marble.phase) {
      case 'tray':
        this.placeInTray(marble);
        break;
      case 'falling':
        this.updateFalling(marble);
        break;
      case 'waiting':
        this.updateWaiting(marble);
        break;
      case 'merging':
      case 'riding':
        this.updateRiding(marble);
        break;
      case 'flying':
        this.updateFlying(marble);
        break;
      case 'boxed':
        this.placeInBox(marble);
        break;
    }
  }

  private placeInTray(marble: MarbleControl): void {
    const tray = this.control.trays.find((candidate) => candidate.key === marble.trayKey);
    if (tray) this.marbleBody(marble.id).setNextKinematicTranslation(this.traySlotWorld(tray, marble.traySlot));
  }

  private updateFalling(marble: MarbleControl): void {
    const body = this.marbleBody(marble.id);
    const t = body.translation();
    const near = nearestOnTrack(t.x, t.z);
    let landed = false;
    if (t.y <= RIDE_Y + 0.08 && Math.abs(near.lateral) < RACEWAY.channelHalf + 0.5) {
      this.world.contactPair(body.collider(0), this.world.getCollider(this.beltFloorHandle), (manifold) => {
        if (manifold.numSolverContacts() > 0) landed = true;
      });
    }
    if (landed) {
      if (!this.joinBelt(marble, body, near.distance)) this.waitInFunnel(marble, body);
    } else if ((this.rules.free === 0 || this.rules.state.pending[0] !== marble.id || this.rules.status !== 'playing') &&
      t.y < FUNNEL.mouthY + MARBLE_RADIUS && marble.time > 0.8) {
      this.waitInFunnel(marble, body);
    } else if (marble.time > FALL_RESCUE_SECONDS || t.y < RACEWAY.floorY - 1) {
      this.teleportToFunnel(marble);
    } else if (marble.time > FALL_NUDGE_SECONDS && Math.floor(marble.time * 60) % 60 === 0) {
      this.nudge(marble, { x: -Math.sign(t.x) * 2, y: 3, z: 1 });
    }
  }

  private slotDistance(slot: number): number {
    return (this.control.belt + slot * SLOT_SPACING) % TRACK_LENGTH;
  }

  /** The reservoir holds admitted pours separately; waiting is intentional, never a rescue. */
  private waitInFunnel(marble: MarbleControl, body: RAPIER.RigidBody): void {
    const at = body.translation();
    marble.phase = 'waiting';
    marble.time = 0;
    marble.fromX = at.x;
    marble.fromY = at.y;
    marble.fromZ = at.z;
    const occupied = new Set(this.control.marbles.filter((other) => other.phase === 'waiting' && other.id !== marble.id).map((other) => other.funnelSlot));
    marble.funnelSlot = 0;
    while (occupied.has(marble.funnelSlot)) marble.funnelSlot++;
    body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, false);
    body.collider(0).setCollisionGroups(PLACED_GROUPS);
  }

  private updateWaiting(marble: MarbleControl): void {
    const body = this.marbleBody(marble.id);
    if (this.rules.status === 'playing' && this.rules.free > 0 && this.rules.state.pending[0] === marble.id) {
      marble.phase = 'falling';
      marble.time = 0;
      marble.funnelSlot = -1;
      marble.lastSpeed = 0;
      body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
      body.setLinvel({ x: 0, y: 0, z: 0 }, true);
      body.setAngvel({ x: 0, y: 0, z: 0 }, true);
      body.collider(0).setCollisionGroups(FALLING_GROUPS);
      return;
    }
    const index = marble.funnelSlot;
    const point = {
      x: ((index % 3) - 1) * MARBLE_RADIUS * 2.1,
      y: RIDE_Y + MARBLE_RADIUS * 2.4 + Math.floor(index / 6) * MARBLE_RADIUS * 2.1,
      z: (FUNNEL.neck.back + FUNNEL.neck.front) / 2 + (Math.floor(index / 3) % 2 - 0.5) * MARBLE_RADIUS * 2.1,
    };
    const t = easeInOut(Math.min(marble.time / 0.25, 1));
    body.setNextKinematicTranslation({
      x: marble.fromX + (point.x - marble.fromX) * t,
      y: marble.fromY + (point.y - marble.fromY) * t,
      z: marble.fromZ + (point.z - marble.fromZ) * t,
    });
  }

  /** The fall ends here: from now on the marble rides in a slot. */
  private joinBelt(marble: MarbleControl, body: RAPIER.RigidBody, distance: number): boolean {
    const taken = new Set(
      this.control.marbles.filter((other) => other && (other.phase === 'riding' || other.phase === 'merging')).map((other) => other.beltSlot),
    );
    let best = -1;
    let bestGap = Number.POSITIVE_INFINITY;
    for (let slot = 0; slot < RACEWAY.slots; slot++) {
      if (taken.has(slot)) continue;
      const gap = Math.abs(((this.slotDistance(slot) - distance + TRACK_LENGTH * 1.5) % TRACK_LENGTH) - TRACK_LENGTH / 2);
      if (gap < bestGap) {
        bestGap = gap;
        best = slot;
      }
    }
    if (best < 0 || !this.rules.entered(marble.id)) return false;
    const t = body.translation();
    const q = body.rotation();
    marble.phase = 'merging';
    marble.time = 0;
    marble.beltSlot = best;
    marble.fromX = t.x;
    marble.fromY = t.y;
    marble.fromZ = t.z;
    marble.qx = q.x;
    marble.qy = q.y;
    marble.qz = q.z;
    marble.qw = q.w;
    body.setLinvel({ x: 0, y: 0, z: 0 }, false);
    body.setAngvel({ x: 0, y: 0, z: 0 }, false);
    body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, false);
    body.collider(0).setCollisionGroups(PLACED_GROUPS);
    return true;
  }

  private updateRiding(marble: MarbleControl): void {
    const body = this.marbleBody(marble.id);
    const distance = this.slotDistance(marble.beltSlot);
    const point = trackPoint(distance);
    let x = point.x;
    let y = RIDE_Y;
    let z = point.z;

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
    const past = (distance - this.gateDistance + TRACK_LENGTH) % TRACK_LENGTH;
    if (past >= RACEWAY.speed * TICK_SECONDS) return;
    // Only commit to the box in place and the one after, so boxes stay in step with what's flying.
    if (this.rules.activeBox > this.control.activeBox + 1 || this.rules.arrive(marble.id) !== 'deliver') return;
    const entry = this.rules.state.marbles[marble.id];
    marble.box = entry?.boxIndex ?? this.rules.activeBox;
    marble.boxSlot = entry?.slot ?? 0;
    this.afterRulesEvents(this.rules.captured(marble.id));

    marble.phase = 'flying';
    marble.time = 0;
    marble.fromX = point.x;
    marble.fromY = RIDE_Y;
    marble.fromZ = point.z;
    marble.flightSeconds = marble.box === this.control.activeBox ? FLIGHT.seconds : FLIGHT.waitingSeconds;
    this.control.doorOpen = GATE.openSeconds;
    this.control.paddle = 1;
    this.events.push({ type: 'kick', marbleId: marble.id });
  }

  private boxSlotX(marble: MarbleControl): number {
    // A marble heading for the next box aims for where that box is going to be.
    const boxX = marble.box === this.control.activeBox ? (this.control.boxX[marble.box] ?? 0) : 0;
    return boxX + (marble.boxSlot - 1) * BOX.slotSpacing;
  }

  private updateFlying(marble: MarbleControl): void {
    const body = this.marbleBody(marble.id);
    const t = Math.min(marble.time / marble.flightSeconds, 1);
    const toX = this.boxSlotX(marble);
    body.setNextKinematicTranslation({
      x: marble.fromX + (toX - marble.fromX) * t,
      y: marble.fromY + (BOX_REST_Y - marble.fromY) * t * t + Math.sin(t * Math.PI) * FLIGHT.arc,
      z: marble.fromZ + (BOX.z - marble.fromZ) * t,
    });
    this.roll(marble, -RACEWAY.speed * 0.3, RACEWAY.speed * 0.6);
    body.setNextKinematicRotation({ x: marble.qx, y: marble.qy, z: marble.qz, w: marble.qw });
    // If its box is somehow still on the way, the marble holds at the end of its arc for it.
    if (t < 1 || marble.box !== this.control.activeBox) return;

    marble.phase = 'boxed';
    marble.hop = FLIGHT.hopSeconds;
    const fill = this.boxFill(marble.box);
    this.events.push({ type: 'captured', marbleId: marble.id, boxIndex: marble.box, fill });
    if (fill >= this.board.boxSize) {
      this.events.push({ type: 'boxFull', boxIndex: marble.box });
      this.control.hold = BOX.holdSeconds;
    }
  }

  private placeInBox(marble: MarbleControl): void {
    if (marble.hop > 0) marble.hop = Math.max(marble.hop - TICK_SECONDS, 0);
    const lift = Math.sin((marble.hop / FLIGHT.hopSeconds) * Math.PI) * FLIGHT.hopHeight;
    const boxX = this.control.boxX[marble.box] ?? BOX.parkedX;
    this.marbleBody(marble.id).setNextKinematicTranslation({
      x: boxX + (marble.boxSlot - 1) * BOX.slotSpacing,
      y: BOX_REST_Y + lift,
      z: BOX.z,
    });
  }

  /** Turns the marble as if it were rolling at this velocity. */
  private roll(marble: MarbleControl, vx: number, vz: number): void {
    const angle = (Math.hypot(vx, vz) * TICK_SECONDS) / MARBLE_RADIUS;
    const speed = Math.hypot(vx, vz) || 1;
    // The axis of a ball rolling along the floor is up × velocity.
    const ax = vz / speed;
    const az = -vx / speed;
    const s = Math.sin(angle / 2);
    const c = Math.cos(angle / 2);
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

  private teleportToFunnel(marble: MarbleControl): void {
    const body = this.marbleBody(marble.id);
    const from = body.translation();
    this.lastRecovery = `lost at ${from.x.toFixed(2)},${from.y.toFixed(2)},${from.z.toFixed(2)}`;
    body.setTranslation({ x: 0, y: FUNNEL.neckY, z: (FUNNEL.neck.back + FUNNEL.neck.front) / 2 }, true);
    body.setLinvel({ x: 0, y: -2, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    marble.time = 0;
    this.control.recoveries.teleports += 1;
    this.events.push({ type: 'recovered', marbleId: marble.id, how: 'teleport', why: 'fall timeout' });
  }

  /** Sound comes from what really happened in the fall: a sudden change of speed means a hit. */
  private detectImpacts(): void {
    for (const marble of this.control.marbles) {
      if (marble?.phase !== 'falling') continue;
      const v = this.marbleBody(marble.id).linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
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
