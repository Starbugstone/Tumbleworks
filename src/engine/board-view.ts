import * as THREE from 'three';
import type { Color } from '../sim/types';
import type { GameServices, ScreenPoint } from './contracts';
import type { MarbleEntity } from './marbles';
import { FIXED_SECONDS, type Point3 } from './physics';
import { landingWeight, seat, SEAT_SECONDS } from './arrival';
import { boxCorners, frameBoard } from './framing';
import { focusOn } from './finish';
import { rackFlightAcross } from './rack-flight';
import { Shake } from './shake';

/**
 * `delay` holds a marble in place before it leaves, so a group goes one after another. `clear` is the height its
 * flight is drawn up toward, to pass over what stands between. `bounce` scales its rebound once it lands: 0 for a
 * marble that another is about to land on.
 */
interface Placement { readonly id: string; readonly color: Color; readonly radius: number; readonly at: Point3; readonly target?: string; readonly delay?: number; readonly clear?: number; readonly bounce?: number }
interface Actor { readonly entity: MarbleEntity; radius: number; target: Point3 }
interface Motion { readonly from: Point3; readonly to: Point3; time: number; readonly delay: number; readonly duration: number; readonly clear: number; readonly bounce: number; landed: boolean }
/** Seconds a marble takes to fly to its new place, before the distance it has to cross is added. */
const FLIGHT_SECONDS = 0.18;
const UP = new THREE.Vector3(0, 1, 0);

/** Stable actors can be retargeted during motion. Rules never wait for presentation. */
export abstract class BoardView {
  readonly scene: THREE.Scene;
  // A long lens: every tube is seen from nearly the same angle. At 40 degrees the nearest tube was looked down into and its lower marbles hid behind the top one.
  readonly camera = new THREE.PerspectiveCamera(20, 1, 0.1, 300);
  readonly board = new THREE.Group();
  protected readonly actors = new THREE.Group();
  private readonly marbleLayer = new THREE.Group();
  private readonly marbles = new Map<string, Actor>();
  private readonly motions = new Map<string, Motion>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly hitObjects: THREE.Object3D[] = [];
  private readonly anchors = new Map<string, THREE.Vector3>();
  private bursts: { entity: MarbleEntity; at: Point3; to?: Point3; radius: number; time: number }[] = [];
  protected framing: Point3[] | null = null;
  /** Where each marble in the air is this tick, for a view that draws trails behind them. */
  protected readonly flying: Point3[] = [];
  /** Kept for the exceptional moment only; a view decides when that is. */
  protected readonly shake = new Shake();
  private readonly calm = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** 1 at the player's own speed, less while fast forward is held: every landing answers that much. */
  protected weight = 1;
  private readonly seated = { lift: 0, wide: 1, tall: 1 };
  private readonly heading = new THREE.Vector3();

  constructor(protected readonly services: GameServices, private readonly elevation = 0.85) {
    this.scene = services.stage.createScene('studio');
    this.scene.add(this.board, this.actors, this.marbleLayer);
  }
  get busy(): boolean { return this.motions.size > 0 || this.bursts.length > 0; }

  protected hit(object: THREE.Object3D, target: string, at: Point3, follow = false): void {
    object.userData['target'] = target;
    this.hitObjects.push(object);
    this.anchors.set(target, follow ? object.position : new THREE.Vector3(at.x, at.y, at.z));
  }

  protected clearActors(): void {
    this.actors.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    });
    this.hitObjects.length = 0;
    this.anchors.clear();
    this.actors.clear();
  }

  protected syncMarbles(placements: readonly Placement[], animate = false): void {
    const wanted = new Set(placements.map((entry) => entry.id));
    for (const [id, actor] of this.marbles) if (!wanted.has(id)) {
      this.stop(id);
      this.services.stage.marbles.release(actor.entity);
      this.marbles.delete(id);
    }
    for (const entry of placements) {
      let actor = this.marbles.get(entry.id);
      if (!actor) {
        const entity = this.services.stage.marbles.create(entry.color, entry.radius);
        entity.mesh.position.set(entry.at.x, entry.at.y, entry.at.z);
        entity.mesh.rotation.set(0.3 + entry.at.z, entry.at.x, 0.15);
        this.marbleLayer.add(entity.mesh);
        actor = { entity, radius: entry.radius, target: entry.at };
        this.marbles.set(entry.id, actor);
      }
      const changed = new THREE.Vector3(entry.at.x, entry.at.y, entry.at.z).distanceToSquared(
        new THREE.Vector3(actor.target.x, actor.target.y, actor.target.z)) > 0.00001;
      actor.target = entry.at;
      actor.radius = entry.radius;
      actor.entity.mesh.scale.setScalar(entry.radius);
      if (!animate) this.placeMarble(entry.id, entry.at);
      else if (changed) {
        this.stop(entry.id);
        const from = this.marblePosition(entry.id) ?? entry.at;
        this.motions.set(entry.id, { from, to: entry.at, time: 0, delay: entry.delay ?? 0, bounce: entry.bounce ?? 1, landed: false,
          duration: FLIGHT_SECONDS + 0.01 * Math.hypot(entry.at.x - from.x, entry.at.z - from.z),
          clear: entry.clear ?? Math.max(from.y, entry.at.y) + 1.5 });
      }
      if (entry.target) this.hit(actor.entity.mesh, entry.target, entry.at, true);
    }
  }

  protected marblePosition(id: string): Point3 | undefined {
    const at = this.marbles.get(id)?.entity.mesh.position;
    return at ? { x: at.x, y: at.y, z: at.z } : undefined;
  }
  protected placeMarble(id: string, at: Point3): void {
    this.stop(id);
    const placed = this.marbles.get(id);
    placed?.entity.mesh.scale.setScalar(placed.radius);
    placed?.entity.mesh.position.set(at.x, at.y, at.z);
  }
  /** A marble has touched down in its new place this tick. A view answers here, at contact, never when the move was accepted. */
  protected contact(_id: string, _at: Point3): void { /* a view's own answer */ }
  /** Held fast forward: moves land several times as often, so each landing answers quietly. */
  pace(speed: number): void { this.weight = landingWeight(speed); }
  protected restoreMarble(id: string): void {
    const actor = this.marbles.get(id);
    if (actor) this.placeMarble(id, actor.target);
  }
  protected stop(id: string): void {
    this.motions.delete(id);
  }

  protected burst(entries: readonly { color: Color; at: Point3; to?: Point3 }[], radius: number): void {
    this.bursts.push(...entries.map(({ color, at, to }) => {
      const entity = this.services.stage.marbles.create(color, radius);
      entity.mesh.position.set(at.x, at.y, at.z);
      this.marbleLayer.add(entity.mesh);
      return { entity, at, to, radius, time: 0 };
    }));
  }

  step(): void {
    this.flying.length = 0;
    for (const [id, motion] of this.motions) {
      const actor = this.marbles.get(id);
      if (!actor) { this.stop(id); continue; }
      motion.time += FIXED_SECONDS;
      const mesh = actor.entity.mesh, radius = actor.radius;
      const { from, to } = motion;
      const t = (motion.time - motion.delay) / motion.duration;
      // Waiting its turn: the marbles of a group leave one after another.
      if (t <= 0) continue;
      if (t < 1) {
        // Rise inside the opening, travel over the rack and drop vertically into the destination.
        const u = t + 0.42 * Math.sin(Math.PI * 2 * t) / (Math.PI * 2), v = 1 - u;
        const across = rackFlightAcross(u);
        const x = from.x + across * (to.x - from.x), z = from.z + across * (to.z - from.z);
        const y = v * v * v * from.y + 3 * v * u * motion.clear + u * u * u * to.y;
        this.heading.set(x - mesh.position.x, y - mesh.position.y, z - mesh.position.z);
        mesh.position.set(x, y, z);
        // In the air a marble is drawn a little long along its travel, and leaves a trail.
        if (!this.calm && this.heading.lengthSq() > 1e-6) {
          mesh.quaternion.setFromUnitVectors(UP, this.heading.normalize());
          const reach = 0.06 + 0.12 * u;
          mesh.scale.set(radius * (1 - reach * 0.45), radius * (1 + reach), radius * (1 - reach * 0.45));
          this.flying.push(mesh.position);
        }
        continue;
      }
      if (!motion.landed) {
        motion.landed = true;
        mesh.position.set(to.x, to.y, to.z);
        this.contact(id, to);
      }
      const age = motion.time - motion.delay - motion.duration;
      if (this.calm || age >= SEAT_SECONDS) {
        mesh.scale.setScalar(radius);
        mesh.position.set(to.x, to.y, to.z);
        this.stop(id);
        continue;
      }
      // Touched down: it lands flat and a little large, springs back round and, if nothing follows it, rebounds once.
      seat(age, this.weight, this.seated);
      mesh.quaternion.identity();
      mesh.scale.set(radius * this.seated.wide, radius * this.seated.tall, radius * this.seated.wide);
      mesh.position.set(to.x, to.y + this.seated.lift * motion.bounce * radius * 2.6 - radius * (1 - this.seated.tall), to.z);
    }
    this.bursts = this.bursts.filter((entry) => {
      entry.time += FIXED_SECONDS;
      const transport = entry.to ? 0.14 : 0;
      const t = Math.max(0, Math.min(1, (entry.time - transport) / 0.22));
      if (entry.to) {
        const travel = Math.min(1, entry.time / transport);
        entry.entity.mesh.position.set(entry.at.x + (entry.to.x - entry.at.x) * travel,
          entry.at.y + (entry.to.y - entry.at.y) * travel + Math.sin(travel * Math.PI) * 0.75 + t,
          entry.at.z + (entry.to.z - entry.at.z) * travel);
      } else entry.entity.mesh.position.y = entry.at.y + t * 1.2;
      entry.entity.mesh.scale.setScalar(entry.radius * (1 - t));
      if (t === 1) this.services.stage.marbles.release(entry.entity);
      return t < 1;
    });
  }

  cancelMotion(): void {
    for (const id of this.motions.keys()) this.stop(id);
    for (const entry of this.bursts) this.services.stage.marbles.release(entry.entity);
    this.bursts = [];
  }

  pick(x: number, y: number): string | null {
    this.scene.updateMatrixWorld(true);
    const rect = this.services.stage.rect;
    this.raycaster.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), this.camera);
    const target: unknown = this.raycaster.intersectObjects(this.hitObjects, false)[0]?.object.userData['target'];
    return typeof target === 'string' ? target : null;
  }
  targets(): Record<string, ScreenPoint> {
    const rect = this.services.stage.rect;
    return Object.fromEntries([...this.anchors].map(([key, point]) => {
      const at = point.clone().project(this.camera);
      return [key, { x: rect.left + (at.x + 1) / 2 * rect.width, y: rect.top + (1 - at.y) / 2 * rect.height }];
    }));
  }
  resize(): void {
    const { canvas, renderer } = this.services.stage;
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    renderer.setSize(width, height, false);
    if (!this.framing) {
      this.board.updateMatrixWorld(true);
      this.marbleLayer.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(this.board).union(new THREE.Box3().setFromObject(this.marbleLayer));
      this.framing = boxCorners(bounds);
    }
    this.services.stage.fitShadows(this.scene, this.framing);
    frameBoard(this.camera, width, height, this.framing, new THREE.Vector3(0, this.elevation, 0.65));
    focusOn(this.scene, this.camera, this.framing);
  }
  /** Moves a resting marble off its place by `dy` and draws it `tall` times its height; a marble in motion is left to its motion. */
  protected squeeze(id: string, dy: number, tall = 1): void {
    const actor = this.marbles.get(id);
    if (!actor || this.motions.has(id)) return;
    const mesh = actor.entity.mesh, wide = tall === 1 ? 1 : 1 / Math.sqrt(tall);
    mesh.position.y = actor.target.y + dy;
    if (tall !== 1) mesh.quaternion.identity();
    mesh.scale.set(actor.radius * wide, actor.radius * tall, actor.radius * wide);
  }
  render(): void {
    this.shake.apply(this.camera, FIXED_SECONDS);
    this.services.stage.draw(this.scene, this.camera);
  }
  dispose(): void {
    this.cancelMotion();
    this.clearActors();
    for (const actor of this.marbles.values()) this.services.stage.marbles.release(actor.entity);
    this.marbles.clear();
    this.services.stage.disposeScene(this.scene);
  }
}
