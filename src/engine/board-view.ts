import * as THREE from 'three';
import type { Color } from '../sim/types';
import type { GameServices, ScreenPoint } from './contracts';
import type { MarbleEntity } from './marbles';
import { FIXED_SECONDS, MarbleDrop, type Point3 } from './physics';
import { boxCorners, frameBoard } from './framing';

interface Transfer {
  readonly entity: MarbleEntity;
  readonly from: Point3;
  readonly to: Point3;
  readonly radius: number;
  readonly dropHeight: number;
  readonly finish: () => void;
  time: number;
  drop: MarbleDrop | null;
}

/** Picking, camera framing, marble ownership and physical landings shared by board gameplays. */
export abstract class BoardView {
  readonly scene: THREE.Scene;
  readonly camera = new THREE.PerspectiveCamera(40, 1, 0.1, 150);
  readonly board = new THREE.Group();
  protected readonly actors = new THREE.Group();
  protected readonly entities: MarbleEntity[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly hitObjects: THREE.Object3D[] = [];
  private readonly anchors = new Map<string, THREE.Vector3>();
  private transfer: Transfer | null = null;
  private burstLeft = 0;
  private bursts: { entity: MarbleEntity; y: number; radius: number }[] = [];
  private framing: Point3[] | null = null;

  constructor(protected readonly services: GameServices, private readonly elevation = 0.85) {
    this.scene = services.stage.createScene();
    this.scene.add(this.board, this.actors);
  }

  get busy(): boolean { return this.transfer !== null || this.burstLeft > 0; }

  protected marble(color: Color, radius: number, at: Point3, target?: string): MarbleEntity {
    const entity = this.services.stage.marbles.create(color, radius);
    entity.mesh.position.set(at.x, at.y, at.z);
    entity.mesh.rotation.set(0.3 + at.z, at.x, 0.15);
    this.entities.push(entity);
    this.actors.add(entity.mesh);
    if (target) this.hit(entity.mesh, target, at);
    return entity;
  }

  protected hit(object: THREE.Object3D, target: string, at: Point3): void {
    object.userData['target'] = target;
    this.hitObjects.push(object);
    this.anchors.set(target, new THREE.Vector3(at.x, at.y, at.z));
  }

  protected clearActors(): void {
    for (const entity of this.entities) this.services.stage.marbles.release(entity);
    this.entities.length = 0;
    this.actors.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) material.dispose();
    });
    this.hitObjects.length = 0;
    this.anchors.clear();
    this.actors.clear();
  }

  protected transferMarble(color: Color, radius: number, from: Point3, to: Point3, finish: () => void, dropHeight = 0.65): void {
    const entity = this.services.stage.marbles.create(color, radius);
    this.actors.add(entity.mesh);
    entity.mesh.position.set(from.x, from.y, from.z);
    this.transfer = { entity, from, to, radius, finish, dropHeight, time: 0, drop: null };
  }

  protected burst(entries: readonly { color: Color; at: Point3 }[], radius: number): void {
    this.burstLeft = 0.28;
    this.bursts = entries.map(({ color, at }) => {
      const entity = this.services.stage.marbles.create(color, radius);
      entity.mesh.position.set(at.x, at.y, at.z);
      this.actors.add(entity.mesh);
      return { entity, y: at.y, radius };
    });
  }

  step(): void {
    const transfer = this.transfer;
    if (transfer) {
      transfer.time += FIXED_SECONDS;
      if (transfer.time < 0.24) {
        const t = transfer.time / 0.24;
        const eased = t * t * (3 - 2 * t);
        const { from, to } = transfer;
        transfer.entity.mesh.position.set(from.x + (to.x - from.x) * eased,
          from.y + (to.y + transfer.dropHeight - from.y) * eased + Math.sin(t * Math.PI) * 1.5,
          from.z + (to.z - from.z) * eased);
        transfer.entity.mesh.rotation.z += 0.12;
      } else {
        transfer.drop ??= new MarbleDrop(this.services.physics, transfer.to, transfer.radius, transfer.dropHeight);
        const at = transfer.drop.step();
        transfer.entity.mesh.position.set(at.x, at.y, at.z);
        transfer.entity.mesh.rotation.z += 0.06;
        if (transfer.drop.done) {
          transfer.drop.dispose();
          this.services.stage.marbles.release(transfer.entity);
          this.transfer = null;
          transfer.finish();
        }
      }
    }
    if (this.burstLeft > 0) {
      this.burstLeft = Math.max(0, this.burstLeft - FIXED_SECONDS);
      const t = 1 - this.burstLeft / 0.28;
      for (const entry of this.bursts) {
        entry.entity.mesh.position.y = entry.y + t * 1.2;
        entry.entity.mesh.scale.setScalar(entry.radius * (1 - t));
      }
      if (this.burstLeft === 0) {
        for (const entry of this.bursts) this.services.stage.marbles.release(entry.entity);
        this.bursts = [];
      }
    }
  }

  cancelMotion(): void {
    if (this.transfer) {
      this.transfer.drop?.dispose();
      this.services.stage.marbles.release(this.transfer.entity);
      this.transfer = null;
    }
    for (const entry of this.bursts) this.services.stage.marbles.release(entry.entity);
    this.bursts = [];
    this.burstLeft = 0;
  }

  pick(x: number, y: number): string | null {
    // Undo/rebuild may be followed by input before the next rendered frame.
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
      this.actors.updateMatrixWorld(true);
      const bounds = new THREE.Box3().setFromObject(this.board).union(new THREE.Box3().setFromObject(this.actors));
      this.framing = boxCorners(bounds);
    }
    frameBoard(this.camera, width, height, this.framing, new THREE.Vector3(0, this.elevation, 0.65));
  }

  render(): void { this.services.stage.renderer.render(this.scene, this.camera); }

  dispose(): void {
    this.cancelMotion();
    this.clearActors();
    this.services.stage.disposeScene(this.scene);
  }
}
