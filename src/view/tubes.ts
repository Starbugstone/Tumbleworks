import * as THREE from 'three';
import { Sparks } from '../engine/sparks';
import { COLORS, containerSymbolTexture } from './art';
import type { Color } from '../sim/types';
import { FIXED_SECONDS } from '../engine/physics';
import { BoardView } from '../engine/board-view';
import type { GameServices, ScreenPoint } from '../engine/contracts';
import type { Point3 } from '../engine/physics';
import { label, toyBox, toyMaterial } from '../engine/toy';
import type { TubeDef, TubeMoveResult, TubeState } from '../puzzles/types';

const RADIUS = 0.49;
const STEP = 1.02;

export class TubeView extends BoardView {
  private readonly selectors: THREE.Mesh[] = [];
  private readonly lights: THREE.Mesh[] = [];
  private readonly rims: THREE.Mesh[] = [];
  private readonly badges: THREE.Mesh[][] = [];
  private readonly badgeMaterials = new Map<Color, THREE.MeshBasicMaterial>();
  private readonly pulses: number[] = [];
  private readonly sparks: Sparks;
  private selected = -1;
  private identities: string[][] = [];
  private nextIdentity = 0;
  private dragging: string[] = [];
  private dragOrigin = new THREE.Vector3();
  private dragStart: THREE.Vector3[] = [];
  private readonly dragPlane = new THREE.Plane();
  private readonly dragRay = new THREE.Raycaster();

  constructor(services: GameServices, readonly definition: TubeDef, state: TubeState) {
    super(services, 1.35);
    this.sparks = new Sparks(this.scene);
    for (const color of Object.keys(COLORS) as Color[]) this.badgeMaterials.set(color,
      new THREE.MeshBasicMaterial({ map: containerSymbolTexture(color), transparent: true, depthWrite: false, toneMapped: false }));
    // The plinth grows with the rows of tubes, so a seventh tube still stands on it.
    const rows = Math.ceil(definition.tubes.length / 2);
    const depth = rows * 4.8 + 0.8;
    const centerZ = (rows - 1) * 2.4 - 4.8 + 0.3;
    const plinth = toyBox(8.2, 0.5, depth, 0x5566d9, 0.2);
    plinth.position.set(0, 0.3, centerZ);
    this.board.add(plinth);
    const deck = toyBox(7.7, 0.08, depth - 0.5, 0xe6e9ff, 0.16);
    deck.position.set(0, 0.57, centerZ);
    this.board.add(deck);
    const glass = new THREE.MeshPhysicalMaterial({ color: 0xe4f5ff, clearcoat: 0.7, transparent: true,
      opacity: 0.2, roughness: 0.08, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.5 });
    definition.tubes.forEach((_, index) => {
      const at = this.position(index, 0);
      const height = definition.capacity * STEP + 0.2;
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.67, 0.67, height, 32, 1, true), glass);
      tube.position.set(at.x, 0.7 + height / 2, at.z);
      this.board.add(tube);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(0.67, 0.07, 10, 32), toyMaterial(0xe7f4f2));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(at.x, 0.7 + height, at.z);
      this.board.add(rim);
      this.rims.push(rim);
      this.pulses.push(0);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.92, 0.25, 32), toyMaterial(0x3b4069));
      base.position.set(at.x, 0.64, at.z);
      this.selectors.push(base);
      this.board.add(base);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), toyMaterial(0x938976));
      light.position.set(at.x, 0.67, at.z + 1);
      this.lights.push(light);
      this.board.add(light);
      const number = label(String(index + 1), 0.75);
      number.position.set(at.x, 0.64, at.z + 1.35);
      this.board.add(number);
      const rail = toyBox(0.46, height, 0.1, 0x3b4069, 0.04);
      rail.position.set(at.x + 0.94, 0.7 + height / 2, at.z);
      this.board.add(rail);
      const badges = Array.from({ length: definition.capacity }, (_, slot) => {
        const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.44), this.badgeMaterials.get('red')!);
        badge.position.set(at.x + 0.94, this.position(index, slot).y, at.z + 0.16);
        badge.rotation.x = -Math.atan2(1.35, 0.65);
        this.board.add(badge);
        return badge;
      });
      this.badges.push(badges);
    });
    // Fit tubes, pattern rails and labels; the decorative plinth can extend toward the screen edges.
    this.framing = definition.tubes.flatMap((_, index) => {
      const at = this.position(index, 0);
      const points: Point3[] = [];
      for (const x of [at.x - 0.95, at.x + 1.2]) for (const y of [0.5, 0.7 + definition.capacity * STEP + 0.8]) {
        for (const z of [at.z - 0.95, at.z + 1.75]) points.push({ x, y, z });
      }
      return points;
    });
    this.rebuild(state);
    this.resize();
  }

  private position(tube: number, slot: number): Point3 {
    const lastAlone = this.definition.tubes.length % 2 === 1 && tube === this.definition.tubes.length - 1;
    return { x: lastAlone ? 0 : (tube % 2 - 0.5) * 3.8, y: 1.25 + slot * STEP, z: (Math.floor(tube / 2) - 1) * 4.8 };
  }

  rebuild(state: TubeState): void {
    this.cancelMotion();
    this.sparks.clear();
    this.pulses.fill(0);
    this.identities = state.tubes.map((tube) => tube.map(() => String(this.nextIdentity++)));
    this.layout(state);
  }

  private layout(state: TubeState, animate = false): void {
    this.clearActors();
    this.syncMarbles(state.tubes.flatMap((tube, index) => tube.flatMap((color, slot) => {
      const id = this.identities[index]?.[slot];
      return id === undefined ? [] : [{ id, color, radius: RADIUS, at: this.position(index, slot) }];
    })), animate);
    state.tubes.forEach((tube, index) => {
      const at = this.position(index, 1.5);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(1.9, 5.3, 1.9), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(at.x, 2.9, at.z);
      this.actors.add(hit);
      this.hit(hit, `tube${index}`, { ...at, y: 3.4 });
      this.badges[index]?.forEach((badge, slot) => {
        const color = tube[slot];
        badge.visible = color !== undefined;
        if (color) badge.material = this.badgeMaterials.get(color)!;
      });
      const rim = this.rims[index];
      if (rim?.material instanceof THREE.MeshPhysicalMaterial) {
        rim.material.color.setHex(tube.at(-1) ? COLORS[tube.at(-1)!].hex : 0xe7f4f2);
      }
      const complete = tube.length === this.definition.capacity && tube.every((color) => color === tube[0]);
      const light = this.lights[index];
      if (light?.material instanceof THREE.MeshPhysicalMaterial) {
        light.material.color.setHex(complete ? 0x30dfa5 : 0x938976);
        light.material.emissive.setHex(complete ? 0x16b36b : 0);
      }
    });
    this.select(this.selected);
  }

  select(index: number): void {
    this.selected = index;
    this.selectors.forEach((mesh, i) => {
      mesh.scale.setScalar(i === index ? 1.12 : 1);
      if (mesh.material instanceof THREE.MeshPhysicalMaterial) {
        mesh.material.color.setHex(i === index ? 0xf25f33 : 0x3b4069);
        mesh.material.emissive.setHex(i === index ? 0x6c2109 : 0);
      }
    });
  }

  private pointOnPlane(point: ScreenPoint): THREE.Vector3 {
    const rect = this.services.stage.canvas.getBoundingClientRect();
    this.dragRay.setFromCamera(new THREE.Vector2((point.x - rect.left) / rect.width * 2 - 1, -(point.y - rect.top) / rect.height * 2 + 1), this.camera);
    return this.dragRay.ray.intersectPlane(this.dragPlane, new THREE.Vector3()) ?? this.dragOrigin.clone();
  }

  beginDrag(index: number, state: TubeState, point: ScreenPoint): void {
    const tube = state.tubes[index] ?? [];
    const color = tube.at(-1);
    if (!color) return;
    let first = tube.length - 1;
    while (first > 0 && tube[first - 1] === color) first--;
    this.dragging = this.identities[index]?.slice(first) ?? [];
    this.dragging.forEach((id) => this.stop(id));
    this.dragStart = this.dragging.map((id) => {
      const at = this.marblePosition(id);
      return new THREE.Vector3(at?.x, at?.y, at?.z);
    });
    const anchor = this.dragStart.at(-1) ?? new THREE.Vector3();
    this.dragPlane.setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()), anchor);
    this.dragOrigin = this.pointOnPlane(point);
    this.select(index);
  }

  moveDrag(point: ScreenPoint, highlight: number): void {
    const offset = this.pointOnPlane(point).sub(this.dragOrigin);
    this.dragging.forEach((id, index) => {
      const start = this.dragStart[index];
      if (start) this.placeMarble(id, start.clone().add(offset));
    });
    this.select(highlight);
  }

  endDrag(state: TubeState): Point3[] {
    const positions = this.dragging.flatMap((id) => { const at = this.marblePosition(id); return at ? [at] : []; });
    this.dragging.forEach((id) => this.restoreMarble(id));
    this.dragging = [];
    this.dragStart = [];
    return positions;
  }

  override step(): void {
    super.step();
    this.sparks.step(FIXED_SECONDS);
    this.rims.forEach((rim, index) => {
      const pulse = Math.max(0, (this.pulses[index] ?? 0) - FIXED_SECONDS * 3);
      this.pulses[index] = pulse;
      rim.scale.setScalar(1 + Math.sin(pulse * Math.PI) * 0.14 + (this.selected === index ? 0.06 : 0));
    });
  }

  override dispose(): void {
    this.sparks.dispose();
    super.dispose();
    for (const material of this.badgeMaterials.values()) {
      material.map?.dispose();
      material.dispose();
    }
  }

  moved(result: Extract<TubeMoveResult, { ok: true }>, state: TubeState, starts?: readonly Point3[]): void {
    const moved = this.identities[result.from]?.splice(result.fromSlot, result.count) ?? [];
    this.identities[result.to]?.push(...moved);
    const origins = starts?.slice(-result.count);
    moved.forEach((id, offset) => { const at = origins?.[offset]; if (at) this.placeMarble(id, at); });
    this.layout(state, true);
    this.pulses[result.to] = 1;
    if (result.completedTube) {
      const at = this.position(result.to, this.definition.capacity - 1);
      this.sparks.burst({ ...at, y: at.y + 0.5 }, COLORS[result.color].hex, 18);
    }
  }
}
