import RAPIER from '@dimforge/rapier3d-compat';
import { MachineRules, type ReleaseResult, type RulesEvent } from '../sim/rules';
import type { BoardDef, Color } from '../sim/types';
import {
  BOX,
  CHUTE,
  FUNNEL,
  GATE,
  GRAVITY,
  MARBLE_RADIUS,
  nearestOnTrack,
  OUTER_FRONT_Z,
  RACEWAY,
  supplyX,
  TICK_SECONDS,
  TRACK_LENGTH,
  trackPoint,
  TRAY,
} from './layout';

export const initPhysics = (): Promise<void> => RAPIER.init();

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

interface MarbleControl {
  readonly id: number;
  readonly color: Color;
  /** Riding on another body rather than simulated. */
  carriedBy: { kind: 'tray'; key: number; slot: number } | { kind: 'box'; box: number; x: number; y: number; z: number } | null;
  lastDistance: number;
  /** Seconds since the marble last made forward progress. */
  stalled: number;
  nudges: number;
  /** Seconds in the air or funnel since release, or since being kicked. */
  transit: number;
  kicks: number;
  /** Seconds spent inside the box before being counted. */
  settling: number;
  lastSpeed: number;
  impactCooldown: number;
}

interface Control {
  tick: number;
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
  /** Seconds left to wait for the last marble to stop bouncing before the hold starts counting. */
  settleLimit: number;
  /** The last box only tells the rules it has gone once it really has, because that's the win. */
  swapOwed: boolean;
}

interface Saved {
  readonly rules: ReturnType<MachineRules['snapshot']>;
  readonly world: Uint8Array;
  readonly control: Control;
}

const BOX_REST_Y = 0;
// Collision groups, as (membership << 16) | filter. The door stops ordinary marbles but not kicked
// ones, so a marble bumped into the gate can't escape and a kicked one can't be shut out.
const GROUP_MARBLE = 0x0001;
const GROUP_KICKED = 0x0002;
const GROUP_DOOR = 0x0004;
const groups = (membership: number, filter: number): number => (membership << 16) | filter;
const MARBLE_GROUPS = groups(GROUP_MARBLE, 0xffff);
const KICKED_GROUPS = groups(GROUP_KICKED, 0xffff);
const DOOR_GROUPS = groups(GROUP_DOOR, GROUP_MARBLE);
const MARBLE_DENSITY = 1 / ((4 / 3) * Math.PI * MARBLE_RADIUS ** 3);
const onBeltHeight = RACEWAY.floorY + MARBLE_RADIUS + 0.2;
const easeInOut = (t: number): number => t * t * (3 - 2 * t);
const trayQuat = (angle: number): RAPIER.Rotation => ({ x: Math.sin(angle / 2), y: 0, z: 0, w: Math.cos(angle / 2) });

export class Machine {
  readonly rules: MachineRules;
  world: RAPIER.World;
  private control: Control;
  private readonly history: Saved[] = [];
  private readonly marbleHandles = new Map<number, number>();
  private readonly trayHandles = new Map<number, number>();
  private readonly boxHandles: number[] = [];
  private readonly events: MachineEvent[] = [];
  private gateCollider = -1;
  /** The most recent rescue, for diagnosing transport faults. */
  lastRecovery = '';

  constructor(readonly board: BoardDef) {
    this.rules = new MachineRules(board);
    this.world = new RAPIER.World({ x: 0, y: -GRAVITY, z: 0 });
    this.world.timestep = TICK_SECONDS;
    this.control = {
      tick: 0,
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
      settleLimit: 0,
      swapOwed: false,
    };
    this.buildStatics();
    this.buildBoxes();
    this.buildTraysAndMarbles();
  }

  // ---- Building ----

  private fixed(): RAPIER.RigidBody {
    return this.world.createRigidBody(RAPIER.RigidBodyDesc.fixed());
  }

  /** A thin plate between two lines. Each line is the plate's edge, running along the given axis. */
  private plate(
    body: RAPIER.RigidBody,
    axis: 'x' | 'z',
    a: { along: number; y: number },
    b: { along: number; y: number },
    halfWidth: number,
    center: number,
    friction = 0.08,
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
    this.world.createCollider(desc.setFriction(friction).setRestitution(0.35), body);
  }

  private buildStatics(): void {
    const body = this.fixed();
    const { floorY, centerZ, straightHalf, radius, channelHalf, wallThickness, wallHeight } = RACEWAY;

    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(30, 0.5, 30).setTranslation(0, -0.5, 0).setFriction(0.7).setRestitution(0.3),
      body,
    );

    const floorHalfZ = radius + channelHalf + wallThickness + 0.02;
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(straightHalf + floorHalfZ, 0.25, floorHalfZ)
        .setTranslation(0, floorY - 0.25, centerZ)
        .setFriction(0.55)
        .setRestitution(0.3),
      body,
    );

    const wall = (offset: number, skipDoor: boolean): void => {
      const segments = 72;
      for (let i = 0; i < segments; i++) {
        const a = trackPoint((i / segments) * TRACK_LENGTH, offset);
        const b = trackPoint(((i + 1) / segments) * TRACK_LENGTH, offset);
        const mx = (a.x + b.x) / 2;
        const mz = (a.z + b.z) / 2;
        if (skipDoor && Math.abs(mx) < GATE.doorHalf && mz > centerZ) continue;
        const length = Math.hypot(b.x - a.x, b.z - a.z);
        const angle = Math.atan2(-(b.z - a.z), b.x - a.x);
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(length / 2 + 0.02, wallHeight / 2, wallThickness / 2)
            .setTranslation(mx, floorY + wallHeight / 2, mz)
            .setRotation({ x: 0, y: Math.sin(angle / 2), z: 0, w: Math.cos(angle / 2) })
            .setFriction(0.05)
            .setRestitution(0.4),
          body,
        );
      }
    };
    wall(channelHalf + wallThickness / 2, true);
    wall(-channelHalf - wallThickness / 2, false);

    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(GATE.doorHalf + 0.04, wallHeight / 2, wallThickness / 2)
        .setTranslation(0, floorY + wallHeight / 2, OUTER_FRONT_Z + wallThickness / 2)
        .setCollisionGroups(DOOR_GROUPS)
        .setFriction(0.05)
        .setRestitution(0.4),
      body,
    );

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

    // Chute from the door down toward the box, with side rails.
    this.plate(
      body,
      'z',
      { along: CHUTE.topZ - 0.04, y: CHUTE.topY - 0.06 },
      { along: CHUTE.bottomZ, y: CHUTE.bottomY - 0.06 },
      CHUTE.halfWidth,
      0,
      0.1,
    );
    const railLength = (CHUTE.bottomZ - CHUTE.topZ) / 2 + 0.1;
    for (const side of [-1, 1]) {
      this.world.createCollider(
        RAPIER.ColliderDesc.cuboid(0.06, 0.9, railLength)
          .setTranslation(side * (CHUTE.halfWidth + 0.06), (CHUTE.topY + CHUTE.bottomY) / 2 + 0.5, (CHUTE.topZ + CHUTE.bottomZ) / 2)
          .setFriction(0.05),
        body,
      );
    }
    this.gateCollider = this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(CHUTE.halfWidth, CHUTE.gateHeight / 2, 0.05)
        .setTranslation(0, CHUTE.bottomY + CHUTE.gateHeight / 2, CHUTE.gateZ)
        .setFriction(0.08)
        .setRestitution(0.3),
      body,
    ).handle;

    // A board behind the box stops a fast marble overshooting.
    this.world.createCollider(
      RAPIER.ColliderDesc.cuboid(BOX.halfWidth + 0.5, 1.6, 0.06)
        .setTranslation(0, 1.6, BOX.z + BOX.halfDepth + 0.08)
        .setFriction(0.1)
        .setRestitution(0.25),
      body,
    );
  }

  private buildBoxes(): void {
    this.board.boxes.forEach((_, index) => {
      const body = this.world.createRigidBody(
        RAPIER.RigidBodyDesc.kinematicPositionBased().setTranslation(this.control.boxX[index] ?? BOX.parkedX, BOX_REST_Y, BOX.z),
      );
      this.boxHandles.push(body.handle);
      const { halfWidth: hw, halfDepth: hd, floorThickness: ft, wallThickness: wt, catchHeight: ch } = BOX;
      const collider = (x: number, y: number, z: number, hx: number, hy: number, hz: number): void => {
        this.world.createCollider(
          RAPIER.ColliderDesc.cuboid(hx, hy, hz).setTranslation(x, y, z).setFriction(0.6).setRestitution(0.28),
          body,
        );
      };
      collider(0, ft / 2, 0, hw, ft / 2, hd);
      collider(-hw + wt / 2, ch / 2, 0, wt / 2, ch / 2, hd);
      collider(hw - wt / 2, ch / 2, 0, wt / 2, ch / 2, hd);
      // The side facing the chute stops at the rim, so marbles can drop in over it.
      collider(0, BOX.height / 2, -hd + wt / 2, hw, BOX.height / 2, wt / 2);
      collider(0, ch / 2, hd - wt / 2, hw, ch / 2, wt / 2);
    });
  }

  private buildTraysAndMarbles(): void {
    const supplies = this.rules.state.supplies;
    supplies.forEach((queue, supply) => {
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
          slide: position === 0 ? 0 : 1,
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
          const marbleBody = this.world.createRigidBody(
            RAPIER.RigidBodyDesc.kinematicPositionBased()
              .setTranslation(place.x, place.y, place.z)
              .setCcdEnabled(true)
              // A marble asleep against the chute's gate wouldn't notice it opening.
              .setCanSleep(false)
              .setLinearDamping(0.02)
              .setAngularDamping(0.12),
          );
          this.world.createCollider(
            RAPIER.ColliderDesc.ball(MARBLE_RADIUS)
              .setDensity(MARBLE_DENSITY)
              .setFriction(0.32)
              .setRestitution(0.5)
              .setCollisionGroups(MARBLE_GROUPS),
            marbleBody,
          );
          this.marbleHandles.set(marble.id, marbleBody.handle);
          this.control.marbles[marble.id] = {
            id: marble.id,
            color: marble.color,
            carriedBy: { kind: 'tray', key, slot },
            lastDistance: 0,
            stalled: 0,
            nudges: 0,
            transit: 0,
            kicks: 0,
            settling: 0,
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
    const eased = easeInOut(tray.slide);
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

  get recoveries(): { readonly nudges: number; readonly teleports: number } {
    return this.control.recoveries;
  }

  get tick(): number {
    return this.control.tick;
  }

  /** 0 closed, 1 fully swung, for drawing the kicker. */
  get paddle(): number {
    return this.control.paddle;
  }

  get chuteGateClosed(): boolean {
    return this.control.hold > 0 || this.control.swap > 0;
  }

  /** How many marbles have landed in this box. */
  boxFill(boxIndex: number): number {
    return this.rules.state.marbles.filter((entry) => entry.status === 'in-box' && entry.boxIndex === boxIndex).length;
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
    for (const event of result.events) this.pushRulesEvent(event);
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
    this.events.length = 0;
    this.lastRecovery = '';
  }

  private pushRulesEvent(event: RulesEvent): void {
    if (event.type === 'boxFull') {
      this.events.push({ type: 'boxFull', boxIndex: event.boxIndex });
      this.control.hold = BOX.holdSeconds;
      this.control.settleLimit = BOX.settleLimitSeconds;
      // The selector moves straight on to the next colour, so matching marbles don't have to wait
      // a whole lap. They queue behind the chute's gate until the next box is in place.
      if (event.boxIndex + 1 < this.board.boxes.length) this.rules.boxSwapped();
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
    this.control.tick += 1;
    this.updateTrays();
    this.updateBoxes();
    this.updateDoor();
    this.updateMarbles();
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
      const frontBusy = this.control.trays.some(
        (other) => other !== tray && other.supply === tray.supply && other.position < tray.position && other.phase !== 'gone',
      );
      if (tray.position > 0 && !frontBusy) tray.position -= 1;
      if (tray.position === 0 && tray.slide > 0) tray.slide = Math.max(tray.slide - dt / TRAY.slideSeconds, 0);

      switch (tray.phase) {
        case 'waiting':
          // One tray at a time, so the funnel gets a stream of marbles rather than a pile.
          if (tray.released && tray.slide === 0 && tray.position === 0 && !this.anotherTrayIsPouring(tray)) {
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
      const origin = this.trayOrigin(tray);
      body.setNextKinematicTranslation(origin);
      body.setNextKinematicRotation(trayQuat(tray.angle));

      for (const [slot, id] of tray.marbleIds.entries()) {
        const marble = this.control.marbles[id];
        if (marble?.carriedBy?.kind === 'tray') {
          this.marbleBody(id).setNextKinematicTranslation(this.traySlotWorld(tray, slot));
        }
      }
    }
  }

  private anotherTrayIsPouring(tray: TrayControl): boolean {
    return this.control.trays.some(
      (other) =>
        other !== tray && (other.phase === 'tipping' || (other.phase === 'pouring' && other.poured < other.marbleIds.length)),
    );
  }

  private dropFromTray(id: number): void {
    const marble = this.control.marbles[id];
    if (!marble) return;
    marble.carriedBy = null;
    marble.transit = 0;
    const body = this.marbleBody(id);
    body.setBodyType(RAPIER.RigidBodyType.Dynamic, true);
    body.setAngvel({ x: (id % 3) - 1, y: (id % 5) - 2, z: (id % 2) * 2 - 1 }, true);
  }

  private marbleInTray(id: number, tray: TrayControl): boolean {
    const t = this.marbleBody(id).translation();
    const origin = this.trayOrigin(tray);
    return t.z < origin.z + 0.1 && t.y > origin.y - 1.5;
  }

  private updateBoxes(): void {
    const dt = TICK_SECONDS;
    const control = this.control;
    const gateClosed = control.hold > 0 || control.swap > 0;
    const gate = this.world.getCollider(this.gateCollider);
    if (gate.isEnabled() !== gateClosed) gate.setEnabled(gateClosed);

    if (control.hold > 0) {
      control.settleLimit -= dt;
      // The last marble gets to finish bouncing before anything moves.
      if (control.settleLimit <= 0 || this.boxHasSettled(control.activeBox)) control.hold -= dt;
      if (control.hold <= 0) {
        this.carryBoxMarbles(control.activeBox);
        control.swap = BOX.swapSeconds;
      }
    } else if (control.swap > 0) {
      control.swap -= dt;
      const t = easeInOut(Math.min(1 - control.swap / BOX.swapSeconds, 1));
      const active = control.activeBox;
      control.boxX[active] = BOX.exitX * t;
      if (active + 1 < control.boxX.length) control.boxX[active + 1] = BOX.nextX * (1 - t);
      if (control.swap <= 0) {
        control.boxX[active] = BOX.parkedX * -1;
        control.activeBox += 1;
        if (control.activeBox + 1 < control.boxX.length) control.boxX[control.activeBox + 1] = BOX.nextX;
        this.events.push({ type: 'boxSwapped' });
        if (control.swapOwed) {
          control.swapOwed = false;
          this.rules.boxSwapped();
        }
      }
    }

    this.boxHandles.forEach((handle, index) => {
      const x = control.boxX[index] ?? BOX.parkedX;
      this.world.getRigidBody(handle).setNextKinematicTranslation({ x, y: BOX_REST_Y, z: BOX.z });
    });

    for (const marble of control.marbles) {
      const carried = marble?.carriedBy;
      if (carried?.kind === 'box') {
        const boxX = control.boxX[carried.box] ?? BOX.parkedX;
        this.marbleBody(marble.id).setNextKinematicTranslation({ x: boxX + carried.x, y: carried.y, z: carried.z });
      }
    }
  }

  private boxHasSettled(boxIndex: number): boolean {
    return this.rules.state.marbles.every((entry) => {
      if (entry.status !== 'in-box' || entry.boxIndex !== boxIndex) return true;
      const v = this.marbleBody(entry.id).linvel();
      return Math.hypot(v.x, v.y, v.z) < BOX.settledSpeed;
    });
  }

  /** The box's marbles stop being simulated and ride away with it. */
  private carryBoxMarbles(boxIndex: number): void {
    const boxX = this.control.boxX[boxIndex] ?? 0;
    for (const marble of this.control.marbles) {
      if (!marble || marble.carriedBy) continue;
      const status = this.rules.state.marbles[marble.id];
      if (status?.status !== 'in-box' || status.boxIndex !== boxIndex) continue;
      const body = this.marbleBody(marble.id);
      const t = body.translation();
      marble.carriedBy = { kind: 'box', box: boxIndex, x: t.x - boxX, y: t.y, z: t.z };
      body.setLinvel({ x: 0, y: 0, z: 0 }, false);
      body.setAngvel({ x: 0, y: 0, z: 0 }, false);
      body.setBodyType(RAPIER.RigidBodyType.KinematicPositionBased, false);
    }
  }

  private updateDoor(): void {
    const control = this.control;
    if (control.doorOpen > 0) control.doorOpen -= TICK_SECONDS;
    control.paddle = Math.max(control.paddle - TICK_SECONDS * 6, 0);
  }

  private updateMarbles(): void {
    const dt = TICK_SECONDS;
    for (const marble of this.control.marbles) {
      if (!marble || marble.carriedBy) continue;
      const entry = this.rules.state.marbles[marble.id];
      if (!entry) continue;
      const body = this.marbleBody(marble.id);
      const t = body.translation();

      if (entry.status === 'pouring') {
        marble.transit += dt;
        const near = nearestOnTrack(t.x, t.z);
        // Below the funnel's neck it's in the channel, even if it's riding on top of other marbles.
        if (t.y < FUNNEL.neckY - MARBLE_RADIUS && Math.abs(near.lateral) < RACEWAY.channelHalf) {
          this.rules.entered(marble.id);
          marble.lastDistance = near.distance;
          marble.stalled = 0;
        } else if (marble.transit > 8) {
          this.teleportToFunnel(marble.id, 'pour timeout');
        } else if (marble.transit > 4 && Math.floor(marble.transit * 60) % 60 === 0) {
          this.nudge(marble.id, { x: -Math.sign(t.x) * 2, y: 3, z: 1 });
        }
        continue;
      }

      if (entry.status === 'on-belt') {
        if (t.y < RACEWAY.floorY - 1 || t.y > FUNNEL.mouthY + 3 || !this.insideRaceway(t.x, t.z)) {
          this.teleportToFunnel(marble.id, 'left the raceway');
          continue;
        }
        this.driveMarble(marble, body, t);
        continue;
      }

      if (entry.status === 'dropping') {
        marble.transit += dt;
        // Waiting behind the chute's gate is not a fault.
        if (this.chuteGateClosed) marble.transit = Math.min(marble.transit, 1);
        // A kicked marble that got knocked back into the channel just rides round and tries again.
        if (t.z < OUTER_FRONT_Z - MARBLE_RADIUS * 0.5 && t.y > RACEWAY.floorY && marble.transit > 0.5) {
          // Riding round isn't being lost, so it doesn't count toward the time limit.
          marble.transit = 0.5;
          this.driveMarble(marble, body, t, true);
          continue;
        }
        const boxX = this.control.boxX[entry.boxIndex] ?? 0;
        const inside =
          Math.abs(t.x - boxX) < BOX.halfWidth && Math.abs(t.z - BOX.z) < BOX.halfDepth && t.y < BOX.height + MARBLE_RADIUS * 1.6;
        marble.settling = inside ? marble.settling + dt : 0;
        if (marble.settling > 0.14) {
          const events = this.rules.captured(marble.id);
          body.collider(0).setCollisionGroups(MARBLE_GROUPS);
          this.events.push({ type: 'captured', marbleId: marble.id, boxIndex: entry.boxIndex, fill: this.boxFill(entry.boxIndex) });
          for (const event of events) this.pushRulesEvent(event);
        } else if (marble.transit > 4) {
          this.teleportToBox(marble.id, boxX);
        } else if (
          !inside &&
          marble.transit > 2 &&
          Math.floor(marble.transit * 60) % 30 === 0 &&
          Math.hypot(body.linvel().x, body.linvel().y, body.linvel().z) < 0.6
        ) {
          // Balanced on the rim where the chute meets the box. A small tip drops it in.
          this.nudge(marble.id, { x: (boxX - t.x) * 0.6, y: 1.5, z: (BOX.z - t.z) * 1.6 });
        }
      }
    }
  }

  private insideRaceway(x: number, z: number): boolean {
    const near = nearestOnTrack(x, z);
    return Math.abs(near.lateral) < RACEWAY.channelHalf + 1.2;
  }

  private driveMarble(marble: MarbleControl, body: RAPIER.RigidBody, t: RAPIER.Vector, kicked = false): void {
    const near = nearestOnTrack(t.x, t.z);
    const velocity = body.linvel();

    if (t.y < onBeltHeight) {
      const along = velocity.x * near.tx + velocity.z * near.tz;
      const wanted = Math.min(RACEWAY.speed - along, RACEWAY.driveAcceleration * TICK_SECONDS);
      if (wanted > 0) {
        const mass = body.mass();
        body.applyImpulse({ x: near.tx * wanted * mass, y: 0, z: near.tz * wanted * mass }, true);
      }
    }

    const moved = ((near.distance - marble.lastDistance + TRACK_LENGTH * 1.5) % TRACK_LENGTH) - TRACK_LENGTH / 2;
    if (moved > 0.4) {
      marble.lastDistance = near.distance;
      marble.stalled = 0;
      marble.nudges = 0;
    } else {
      marble.stalled += TICK_SECONDS;
      if (marble.stalled > 6) {
        this.teleportToFunnel(marble.id, 'stalled on belt');
      } else if (marble.stalled > 2 && marble.nudges < 3 && Math.floor(marble.stalled * 60) % 60 === 0) {
        marble.nudges += 1;
        this.nudge(marble.id, { x: near.tx * 3, y: 4, z: near.tz * 3 });
      }
    }

    const crossed = t.z > RACEWAY.centerZ && velocity.x < 0 && t.x <= GATE.checkX && t.x - velocity.x * TICK_SECONDS * 1.6 > GATE.checkX;
    if (crossed && (kicked || this.rules.arrive(marble.id) === 'deliver')) {
      marble.settling = 0;
      this.kick(marble);
    }
  }

  private kick(marble: MarbleControl): void {
    marble.kicks += 1;
    marble.transit = 0;
    const body = this.marbleBody(marble.id);
    body.setLinvel({ x: GATE.kickAlong, y: GATE.kickUp, z: GATE.kickOutward }, true);
    body.collider(0).setCollisionGroups(KICKED_GROUPS);
    this.control.doorOpen = GATE.openSeconds;
    this.control.paddle = 1;
    this.events.push({ type: 'kick', marbleId: marble.id });
  }

  private nudge(id: number, impulse: { x: number; y: number; z: number }): void {
    const body = this.marbleBody(id);
    const mass = body.mass();
    body.applyImpulse({ x: impulse.x * mass, y: impulse.y * mass, z: impulse.z * mass }, true);
    this.control.recoveries.nudges += 1;
    this.events.push({ type: 'recovered', marbleId: id, how: 'nudge', why: 'not moving' });
  }

  private teleportToFunnel(id: number, why: string): void {
    const body = this.marbleBody(id);
    const from = body.translation();
    this.lastRecovery = `${why} at ${from.x.toFixed(2)},${from.y.toFixed(2)},${from.z.toFixed(2)}`;
    body.setTranslation({ x: 0, y: FUNNEL.neckY + 1.4, z: (FUNNEL.neck.back + FUNNEL.neck.front) / 2 }, true);
    body.setLinvel({ x: 0, y: -2, z: 0 }, true);
    body.setAngvel({ x: 0, y: 0, z: 0 }, true);
    const marble = this.control.marbles[id];
    if (marble) {
      marble.stalled = 0;
      marble.nudges = 0;
      marble.transit = 0;
    }
    this.control.recoveries.teleports += 1;
    this.events.push({ type: 'recovered', marbleId: id, how: 'teleport', why });
  }

  private teleportToBox(id: number, boxX: number): void {
    const body = this.marbleBody(id);
    const from = body.translation();
    const speed = body.linvel();
    const stuckAt = `at ${from.x.toFixed(2)},${from.y.toFixed(2)},${from.z.toFixed(2)} moving ${speed.x.toFixed(1)},${speed.y.toFixed(1)},${speed.z.toFixed(1)}`;
    body.setTranslation({ x: boxX, y: BOX.height + 0.8, z: BOX.z }, true);
    body.setLinvel({ x: 0, y: -1, z: 0 }, true);
    const marble = this.control.marbles[id];
    if (marble) marble.transit = 0;
    this.control.recoveries.teleports += 1;
    this.lastRecovery = `never reached the box ${stuckAt}`;
    this.events.push({ type: 'recovered', marbleId: id, how: 'teleport', why: 'never reached the box' });
  }

  /** Sound comes from what really happened: a sudden change of speed means something was hit. */
  private detectImpacts(): void {
    for (const marble of this.control.marbles) {
      if (!marble || marble.carriedBy) continue;
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
