import * as THREE from 'three';
import type { Color } from '../sim/types';
import type { GameServices, ScreenPoint } from './contracts';
import type { MarbleEntity } from './marbles';
import { FIXED_SECONDS, MarbleDrop, type Point3 } from './physics';
import { boxCorners, frameBoard } from './framing';

interface Placement { readonly id: string; readonly color: Color; readonly radius: number; readonly at: Point3; readonly target?: string }
interface Actor { readonly entity: MarbleEntity; radius: number; target: Point3 }
interface Motion { readonly from: Point3; readonly to: Point3; time: number; drop: MarbleDrop | null }

/** Stable actors can be retargeted during motion. Rules never wait for presentation. */
export abstract class BoardView {
  readonly scene: THREE.Scene;
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 150);
  readonly board = new THREE.Group();
  protected readonly actors = new THREE.Group();
  private readonly marbleLayer = new THREE.Group();
  private readonly marbles = new Map<string, Actor>();
  private readonly motions = new Map<string, Motion>();
  private readonly raycaster = new THREE.Raycaster();
  private readonly hitObjects: THREE.Object3D[] = [];
  private readonly anchors = new Map<string, THREE.Vector3>();
  private bursts: { entity: MarbleEntity; at: Point3; to?: Point3; radius: number; time: number }[] = [];
  private framing: Point3[] | null = null;

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
        this.motions.set(entry.id, { from: this.marblePosition(entry.id) ?? entry.at, to: entry.at, time: 0, drop: null });
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
    this.marbles.get(id)?.entity.mesh.position.set(at.x, at.y, at.z);
  }
  protected restoreMarble(id: string): void {
    const actor = this.marbles.get(id);
    if (actor) this.placeMarble(id, actor.target);
  }
  protected stop(id: string): void {
    this.motions.get(id)?.drop?.dispose();
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
    for (const [id, motion] of this.motions) {
      const actor = this.marbles.get(id);
      if (!actor) { this.stop(id); continue; }
      motion.time += FIXED_SECONDS;
      if (motion.time < 0.14) {
        const t = motion.time / 0.14;
        const eased = t * t * (3 - 2 * t);
        const { from, to } = motion;
        actor.entity.mesh.position.set(from.x + (to.x - from.x) * eased,
          from.y + (to.y + 0.12 - from.y) * eased + Math.sin(t * Math.PI) * 0.75,
          from.z + (to.z - from.z) * eased);
      } else {
        motion.drop ??= new MarbleDrop(this.services.physics, motion.to, actor.radius, 0.12);
        const at = motion.drop.step();
        actor.entity.mesh.position.set(at.x, at.y, at.z);
        if (motion.drop.done) this.stop(id);
      }
      actor.entity.mesh.rotation.z += 0.1;
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
    const rect = this.services.stage.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, -(y - rect.top) / rect.height * 2 + 1), this.camera);
    const target: unknown = this.raycaster.intersectObjects(this.hitObjects, false)[0]?.object.userData['target'];
    return typeof target === 'string' ? target : null;
  }
  targets(): Record<string, ScreenPoint> {
    const rect = this.services.stage.canvas.getBoundingClientRect();
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
    frameBoard(this.camera, width, height, this.framing, new THREE.Vector3(0, this.elevation, 0.65));
  }
  render(): void {
    this.services.stage.renderer.render(this.scene, this.camera);
  }
  dispose(): void {
    this.cancelMotion();
    this.clearActors();
    for (const actor of this.marbles.values()) this.services.stage.marbles.release(actor.entity);
    this.marbles.clear();
    this.services.stage.disposeScene(this.scene);
  }
}
