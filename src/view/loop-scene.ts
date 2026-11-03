import { beltDeck } from './belt-deck';
import { BeltSurface } from './belt-surface';
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Sparks } from '../engine/sparks';
import { lorry } from './lorry';
import { LoopRoster, type RosterPick } from './loop-roster';
import { MarbleCrowd } from '../engine/crowd';
import { frameBoard } from '../engine/framing';
import type { Stage } from '../engine/stage';
import type { LoopMachine, LoopMachineEvent, UnitPose } from '../loop/machine';
import { DECK_TOP, LOOP, MARBLE_RADIUS, TRUCK, TICK_SECONDS } from '../loop/layout';
import type { Color } from '../sim/types';
import { COLORS, containerSymbolTexture } from './art';
import { ARCADE, ArcadePop, ArcadeYard } from './arcade';
import { t } from '../i18n';

const CAMERA_DIRECTION = new THREE.Vector3(0, 0.84, 0.54).normalize();
const PLATFORM = ARCADE.deck;
const PLATFORM_DARK = ARCADE.edge;
const CHANNEL = ARCADE.track;
const MAX_BLOCKS = 6;
const plastic = (color: number, roughness = 0.42): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, envMapIntensity: 0.7 });
const shiny = (color: number): THREE.MeshPhysicalMaterial =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.9 });

function roundedRect(halfWidth: number, halfDepth: number, radius: number): THREE.Shape {
  const shape = new THREE.Shape();
  const r = Math.min(radius, halfWidth, halfDepth);
  // Drawn in x-y and laid flat, so shape y becomes world -z.
  shape.moveTo(-halfWidth + r, halfDepth);
  shape.lineTo(halfWidth - r, halfDepth);
  shape.absarc(halfWidth - r, halfDepth - r, r, Math.PI / 2, 0, true);
  shape.lineTo(halfWidth, -halfDepth + r);
  shape.absarc(halfWidth - r, -halfDepth + r, r, 0, -Math.PI / 2, true);
  shape.lineTo(-halfWidth + r, -halfDepth);
  shape.absarc(-halfWidth + r, -halfDepth + r, r, -Math.PI / 2, -Math.PI, true);
  shape.lineTo(-halfWidth, halfDepth - r);
  shape.absarc(-halfWidth + r, halfDepth - r, r, Math.PI, Math.PI / 2, true);
  return shape;
}
function ring(outer: THREE.Shape, inner: THREE.Shape): THREE.Shape {
  const hole = new THREE.Path();
  hole.curves = inner.curves;
  outer.holes.push(hole);
  return outer;
}
function slab(shape: THREE.Shape, bottom: number, top: number, side: THREE.Material, face: THREE.Material): THREE.Mesh {
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: top - bottom, bevelEnabled: false });
  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, bottom, 0);
  const mesh = new THREE.Mesh(geometry, [face, side]);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}
function rounded(width: number, height: number, depth: number, material: THREE.Material, radius = 0.08): THREE.Mesh {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 3, Math.min(radius, width / 2, height / 2, depth / 2)), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

interface Block { readonly group: THREE.Group; readonly box: THREE.Mesh; readonly badge: THREE.Mesh; color: Color | null; units: number; previousUnits: number }
interface TruckVisual { readonly group: THREE.Group; readonly blocks: Block[]; readonly setLatched: (latched: boolean) => void; readonly setWheelTravel: (distance: number) => void; readonly setUnloading: (state: 'pouring' | 'waiting' | null, time: number) => void; pulse: number }

/** The Loop Sort toy: the belt and the row of docked lorries. Numbers and waiting lorries live in the cards beneath it. */
export class LoopScene {
  readonly scene: THREE.Scene;
  // A long lens, so lorries at the far side of the ring stay nearly as large as those at the near side.
  readonly camera = new THREE.PerspectiveCamera(22, 1, 1, 400);
  private machine: LoopMachine | null = null;
  private crowd: MarbleCrowd | null = null;
  private readonly level = new THREE.Group();
  private readonly couplingBars: { pair: readonly [string, string]; mesh: THREE.Mesh }[] = [];
  private belt: BeltSurface | null = null;
  private readonly dummy = new THREE.Object3D();
  private readonly trucks = new Map<string, TruckVisual>();
  private roster: LoopRoster | null = null;
  private readonly previousTrucks = new Map<string, ReturnType<LoopMachine['readTrucks']>[number]>();
  private readonly currentTrucks = new Map<string, ReturnType<LoopMachine['readTrucks']>[number]>();
  private readonly hitTargets: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly blockMaterials = new Map<Color, THREE.Material>();
  private readonly symbols = new Map<Color, THREE.CanvasTexture>();
  private readonly sparks: Sparks;
  private readonly pops: ArcadePop;
  private yard: ArcadeYard | null = null;
  private perUnit = 3;
  private readonly previous = new Map<number, UnitPose[]>();
  private readonly current = new Map<number, UnitPose[]>();
  private framing: { x: number; y: number; z: number }[] = [];

  constructor(private readonly stage: Stage) {
    this.scene = stage.createScene('arcade');
    this.scene.add(this.level);
    this.sparks = new Sparks(this.scene);
    this.pops = new ArcadePop(this.scene, () => t('DISPATCH!', 'DÉPART !'));
    for (const color of Object.keys(COLORS) as Color[]) {
      this.blockMaterials.set(color, shiny(COLORS[color].hex));
      this.symbols.set(color, containerSymbolTexture(color));
    }
  }

  private buildPlatform(machine: LoopMachine): void {
    const { track } = machine;
    const outerW = track.halfWidth + LOOP.channelHalf + LOOP.wallThickness;
    const outerD = track.halfDepth + LOOP.channelHalf + LOOP.wallThickness;
    const cornerOut = track.corner + LOOP.channelHalf + LOOP.wallThickness;
    const innerW = track.halfWidth - LOOP.channelHalf;
    const innerD = track.halfDepth - LOOP.channelHalf;
    const eight = machine.board.trackShape && machine.board.trackShape !== 'oval';
    // Long enough that five ticks per frame at 30 fps still reads as forward travel.
    this.belt = new BeltSurface(track, LOOP.channelHalf - 0.03, LOOP.floorY, MARBLE_RADIUS * 13);
    this.level.add(this.belt.mesh);
    if (!eight) {
    const deck = slab(roundedRect(outerW, outerD, cornerOut), 0, LOOP.floorY, plastic(PLATFORM_DARK), plastic(CHANNEL, 0.55));
    const rim = slab(ring(roundedRect(outerW, outerD, cornerOut), roundedRect(track.halfWidth + LOOP.channelHalf, track.halfDepth + LOOP.channelHalf, track.corner + LOOP.channelHalf)), LOOP.floorY, DECK_TOP, plastic(PLATFORM_DARK), shiny(PLATFORM));
    const plateau = slab(roundedRect(innerW, innerD, Math.max(0.2, track.corner - LOOP.channelHalf)), LOOP.floorY, DECK_TOP, plastic(PLATFORM_DARK), shiny(PLATFORM));
    this.level.add(deck, rim, plateau);
    } else this.level.add(beltDeck(track, LOOP.channelHalf, LOOP.floorY, LOOP.wallHeight));
    // One slab under the belt and every column: the toy, with no decorative margin.
    const ends = machine.bays.map((_, lane) => this.columnEnd(machine, lane));
    const front = Math.max(eight ? Math.max(...ends) : 0, outerD) + 0.2;
    const width = Math.max(outerW * 2 + 0.3, (machine.bays.at(-1)!.x - machine.bays[0]!.x) + TRUCK.bedWidth + 0.6);
    const base = rounded(width, 1.1, front + outerD + 0.3, shiny(PLATFORM), 0.3);
    base.position.set(0, -0.55, (front - outerD - 0.3) / 2);
    this.level.add(base);
    this.yard = new ArcadeYard(this.scene, outerW + 0.55, -outerD - 0.55, front);
    machine.bays.forEach((bay, lane) => {
      const mouth = machine.mouthZ(lane);
      const end = ends[lane]!;
      if (eight) {
        // An eight has no plateau: its columns stand on raised strips running from its near edge.
        const start = mouth - TRUCK.mouthGap + LOOP.channelHalf;
        const strip = rounded(TRUCK.bedWidth + 0.14, DECK_TOP, end - start, plastic(PLATFORM), 0.05);
        strip.position.set(bay.x, DECK_TOP / 2, (end + start) / 2);
        this.level.add(strip);
      }
      const tray = rounded(TRUCK.bedWidth + 0.12, 0.04, end - mouth + 0.2, plastic(ARCADE.lane, 0.6), 0.02);
      tray.position.set(bay.x, DECK_TOP + 0.015, (end + mouth - 0.2) / 2);
      this.level.add(tray);
      const pad = rounded(TRUCK.bedWidth * 0.86, 0.05, 0.16, shiny(ARCADE.gold), 0.02);
      pad.position.set(bay.x, DECK_TOP + 0.03, mouth - 0.3);
      this.level.add(pad);
    });
  }

  /** Just past a docked lorry's cab. */
  private columnEnd(machine: LoopMachine, lane: number): number {
    return machine.mouthZ(lane) + TRUCK.bedLength + TRUCK.cabLength + 0.1;
  }

  private truckVisual(color: Color, facing: number, bedLength: number, latchColor: Color | null): TruckVisual {
    const group = new THREE.Group();
    const shell = lorry(color, { ...TRUCK, bedLength }, latchColor);
    shell.body.rotation.y = facing > 0 ? 0 : Math.PI;
    group.add(shell.body);
    const blocks: Block[] = [];
    for (let i = 0; i < MAX_BLOCKS; i++) {
      const block = new THREE.Group();
      const box = new THREE.Mesh(new RoundedBoxGeometry(TRUCK.bedWidth - 0.16, 0.34, 1, 2, 0.05), this.blockMaterials.get('red')!);
      box.castShadow = true;
      block.add(box);
      const badge = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: this.symbols.get('red')!, transparent: true, depthWrite: false, toneMapped: false }));
      badge.rotation.x = -Math.PI / 2;
      badge.position.y = 0.18;
      block.add(badge);
      block.visible = false;
      group.add(block);
      blocks.push({ group: block, box, badge, color: null, units: 0, previousUnits: 0 });
    }
    return { group, blocks, setLatched: shell.setLatched, setWheelTravel: shell.setWheelTravel, setUnloading: shell.setUnloading, pulse: 0 };
  }

  setMachine(machine: LoopMachine): void {
    this.clearLevel();
    this.machine = machine;
    this.buildPlatform(machine);
    this.perUnit = machine.marblesPerUnit;
    const counts = new Map<Color, number>();
    for (const marble of machine.rules.state.marbles) counts.set(marble.color, (counts.get(marble.color) ?? 0) + this.perUnit);
    this.crowd = new MarbleCrowd(this.level, counts, MARBLE_RADIUS);
    for (const marble of machine.rules.state.marbles) {
      for (let k = 0; k < this.perUnit; k++) this.crowd.add(marble.id * this.perUnit + k, marble.color);
      this.previous.set(marble.id, Array.from({ length: this.perUnit }, () => ({ x: 0, y: 0, z: 0, roll: 0, visible: false })));
      this.current.set(marble.id, Array.from({ length: this.perUnit }, () => ({ x: 0, y: 0, z: 0, roll: 0, visible: false })));
    }
    for (const truck of machine.readTrucks()) {
      const visual = this.truckVisual(truck.finalColor, machine.facing(truck.lane), truck.bedLength, truck.latchColor);
      this.trucks.set(`${truck.lane}:${truck.index}`, visual);
      this.level.add(visual.group);
    }
    for (const pair of machine.board.couplings ?? []) {
      const mesh = rounded(1, 0.13, 0.18, plastic(0xffe5ac));
      mesh.name = 'coupling-bar';
      this.level.add(mesh);
      this.couplingBars.push({ pair, mesh });
    }
    this.roster = new LoopRoster(machine);
    machine.bays.forEach((bay, lane) => {
      const facing = machine.facing(lane);
      const target = new THREE.Mesh(new THREE.BoxGeometry(TRUCK.bedWidth + 0.4, 1.6, TRUCK.bedLength + TRUCK.cabLength + 0.4), new THREE.MeshBasicMaterial({ visible: false }));
      target.position.set(bay.x, DECK_TOP + 0.5, machine.mouthZ(lane) - facing * (TRUCK.bedLength + TRUCK.cabLength) / 2);
      target.userData['lane'] = lane;
      this.scene.add(target);
      this.hitTargets.push(target);
    });
    const { track } = machine;
    const w = track.halfWidth + LOOP.channelHalf + LOOP.wallThickness + 0.05;
    const d = track.halfDepth + LOOP.channelHalf + LOOP.wallThickness;
    this.framing = [{ x: -w, y: DECK_TOP, z: -d }, { x: w, y: DECK_TOP, z: -d }, { x: -w, y: DECK_TOP + 0.4, z: -d }, { x: w, y: DECK_TOP + 0.4, z: -d }];
    if (!machine.board.trackShape || machine.board.trackShape === 'oval') this.framing.push({ x: -w, y: 0, z: d + 0.2 }, { x: w, y: 0, z: d + 0.2 });
    for (const [lane, bay] of machine.bays.entries()) {
      const z = this.columnEnd(machine, lane);
      for (const x of [bay.x - 0.5, bay.x + 0.5]) this.framing.push({ x, y: 0, z: z + 0.2 }, { x, y: DECK_TOP + 0.9, z });
    }
    for (let i = 0; i < 64; i++) {
      const point = track.point(i / 64 * track.length);
      this.framing.push({ x: point.x, y: DECK_TOP + point.y + 0.5, z: point.z });
    }
    this.syncAfterJump();
    this.resize();
  }

  private clearLevel(): void {
    this.yard?.dispose();
    this.yard = null;
    this.crowd?.dispose();
    this.crowd = null;
    this.trucks.clear();
    this.roster?.dispose();
    this.roster = null;
    this.previousTrucks.clear();
    this.currentTrucks.clear();
    this.previous.clear();
    this.current.clear();
    for (const target of this.hitTargets) {
      this.scene.remove(target);
      target.geometry.dispose();
      for (const material of Array.isArray(target.material) ? target.material : [target.material]) material.dispose();
    }
    this.hitTargets.length = 0;
    this.level.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      if (object instanceof THREE.InstancedMesh) object.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (![...this.blockMaterials.values()].includes(material)) {
          if ('map' in material && material.map instanceof THREE.Texture && !Array.from(this.symbols.values()).some((texture) => texture === material.map)) material.map.dispose();
          material.dispose();
        }
      }
    });
    this.couplingBars.length = 0;
    this.level.clear();
    this.belt = null;
  }

  dispose(): void {
    this.clearLevel();
    this.sparks.dispose();
    this.pops.dispose();
    for (const material of this.blockMaterials.values()) material.dispose();
    for (const texture of this.symbols.values()) texture.dispose();
    this.stage.disposeScene(this.scene);
    this.machine = null;
  }

  react(events: readonly LoopMachineEvent[]): void {
    if (!this.machine) return;
    for (const event of events) {
      if (event.type !== 'pour' && event.type !== 'absorb' && event.type !== 'complete') continue;
      const truck = this.machine.readTrucks().find((truck) => truck.lane === event.lane && truck.docked);
      if (!truck) continue;
      const visual = this.trucks.get(`${truck.lane}:${truck.index}`);
      if (visual) visual.pulse = event.type === 'complete' ? 1 : event.type === 'pour' ? 0.65 : 0.25;
      if (event.type === 'complete') {
        const at = { x: truck.x, y: truck.y + 1.1, z: truck.z };
        this.sparks.burst(at, COLORS[event.color].hex, 24);
        this.pops.burst(at);
      }
    }
  }

  private syncTrucks(snap: boolean): void {
    if (!this.machine) return;
    for (const truck of this.machine.readTrucks()) {
      const key = `${truck.lane}:${truck.index}`;
      this.previousTrucks.set(key, snap ? truck : this.currentTrucks.get(key) ?? truck);
      this.currentTrucks.set(key, truck);
    }
  }

  private syncCargo(snap: boolean): void {
    if (!this.machine) return;
    for (const truck of this.machine.readTrucks()) {
      const visual = this.trucks.get(`${truck.lane}:${truck.index}`);
      if (!visual) continue;
      const ordered = [...truck.blocks].reverse();
      visual.blocks.forEach((block, index) => {
        const entry = ordered[index];
        const target = entry?.units ?? 0;
        const changedColor = entry && entry.color !== block.color;
        block.previousUnits = block.units;
        block.units = snap || changedColor ? target : block.units + (target - block.units) * 0.42;
        if (Math.abs(target - block.units) < 0.01) block.units = target;
        if (snap || changedColor) block.previousUnits = block.units;
        if (changedColor) {
          block.color = entry.color;
          block.box.material = this.blockMaterials.get(entry.color)!;
          const material = block.badge.material;
          if (material instanceof THREE.MeshBasicMaterial) material.map = this.symbols.get(entry.color)!;
        }
      });
    }
  }

  afterTick(): void {
    this.syncTrucks(false);
    this.syncCargo(false);
    this.sparks.step(TICK_SECONDS);
    this.pops.step(TICK_SECONDS);
    for (const visual of this.trucks.values()) visual.pulse = Math.max(0, visual.pulse - TICK_SECONDS * 4);

    const machine = this.machine;
    if (!machine) return;
    this.roster?.sync();
    for (const [id, poses] of this.current) {
      const previous = this.previous.get(id);
      if (!previous) continue;
      for (let k = 0; k < this.perUnit; k++) Object.assign(previous[k]!, poses[k]);
      machine.readUnit(id, poses);
    }
  }

  syncAfterJump(): void {
    this.sparks.clear();
    this.pops.clear();
    this.syncTrucks(true);
    this.syncCargo(true);
    for (const visual of this.trucks.values()) visual.pulse = 0;
    const machine = this.machine;
    if (!machine) return;
    this.roster?.sync();
    for (const [id, poses] of this.current) {
      machine.readUnit(id, poses);
      const previous = this.previous.get(id);
      if (previous) for (let k = 0; k < this.perUnit; k++) Object.assign(previous[k]!, poses[k]);
    }
  }

  render(alpha: number): void {
    const machine = this.machine;
    if (!machine || !this.crowd) return;
    const axis = new THREE.Vector3();
    for (const [id, poses] of this.current) {
      const previous = this.previous.get(id);
      for (let k = 0; k < this.perUnit; k++) {
        const c = poses[k]!;
        const p = previous?.[k] ?? c;
        const marble = id * this.perUnit + k;
        if (!c.visible) { this.crowd.set(marble, 0, -50, 0, 0, 0, 0, 1, 0.0001); continue; }
        const blend = p.visible ? alpha : 1;
        const x = p.x + (c.x - p.x) * blend;
        const y = p.y + (c.y - p.y) * blend;
        const z = p.z + (c.z - p.z) * blend;
        const roll = p.roll + (c.roll - p.roll) * blend;
        // Roll about the axis across the direction of travel, which the track gives as the step between poses.
        axis.set(c.z - p.z, 0, -(c.x - p.x));
        if (axis.lengthSq() < 1e-8) axis.set(0, 0, -1);
        axis.normalize();
        this.dummy.quaternion.setFromAxisAngle(axis, roll);
        const q = this.dummy.quaternion;
        this.crowd.set(marble, x, y, z, q.x, q.y, q.z, q.w);
      }
    }
    this.crowd.commit();
    for (const truck of this.currentTrucks.values()) {
      const visual = this.trucks.get(`${truck.lane}:${truck.index}`);
      if (!visual) continue;
      visual.group.visible = truck.visible;
      if (!truck.visible) continue;
      const facing = machine.facing(truck.lane);
      const previous = this.previousTrucks.get(`${truck.lane}:${truck.index}`);
      const blend = previous?.visible ? alpha : 1;
      const y = previous ? previous.y + (truck.y - previous.y) * blend : truck.y;
      const z = previous ? previous.z + (truck.z - previous.z) * blend : truck.z;
      const scale = previous ? previous.scale + (truck.scale - previous.scale) * blend : truck.scale;
      visual.group.position.set(truck.x, y + Math.sin(visual.pulse * Math.PI) * 0.1, z);
      visual.group.scale.setScalar(scale);
      visual.setWheelTravel(z);
      visual.setLatched(truck.latchColor !== null);
      visual.setUnloading(truck.unloading, (machine.tick + alpha) * TICK_SECONDS);
      // Cargo packs against the cab; the mouth end stays open. Blocks are listed loop end first.
      const unit = machine.unitLength;
      let edge = -facing * truck.bedLength / 2;
      visual.blocks.forEach((block) => {
        const length = (block.previousUnits + (block.units - block.previousUnits) * alpha) * unit;
        block.group.visible = length > 0.005;
        if (!block.group.visible) return;
        block.group.position.set(0, TRUCK.bedHeight + 0.17, edge + facing * length / 2);
        block.box.scale.z = Math.max(length - 0.04, 0.005);
        const side = Math.min(0.34, length - 0.05);
        block.badge.visible = side > 0.06;
        block.badge.scale.setScalar(side);
        edge += facing * length;
      });
    }
    for (const { pair, mesh } of this.couplingBars) {
      const lanes = pair.map((id) => machine.rules.state.lanes.findIndex((queue) => queue[0]?.id === id && queue[0].coupledWith !== null));
      mesh.visible = lanes.every((lane) => lane >= 0 && [...this.currentTrucks.values()].some((truck) => truck.lane === lane && truck.index === machine.rules.front(lane)?.index && truck.docked && !truck.departing));
      if (!mesh.visible) continue;
      const a = lanes[0]!, b = lanes[1]!;
      const x1 = machine.bays[a]!.x, x2 = machine.bays[b]!.x;
      const z1 = machine.mouthZ(a) + 0.16, z2 = machine.mouthZ(b) + 0.16;
      mesh.position.set((x1 + x2) / 2, DECK_TOP + TRUCK.bedHeight + 0.4, (z1 + z2) / 2);
      mesh.scale.x = Math.hypot(x2 - x1, z2 - z1);
      mesh.rotation.y = -Math.atan2(z2 - z1, x2 - x1);
    }
    this.belt?.setTravel(machine.beltDistance + alpha * LOOP.speed * TICK_SECONDS);
    this.stage.renderer.render(this.scene, this.camera);
  }

  /** What is under a point: a lorry card, or a docked lorry on the toy. */
  pick(x: number, y: number): RosterPick | null {
    const card = this.roster?.pick(x, y);
    if (card) return card;
    const rect = this.stage.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const lane: unknown = this.raycaster.intersectObjects(this.hitTargets, false)[0]?.object.userData['lane'];
    return typeof lane === 'number' ? { lane, kind: 'now' } : null;
  }

  togglePeek(lane: number): void { this.roster?.togglePeek(lane); }
  closePeek(): void { this.roster?.closePeek(); }
  waitingBounds(): ReturnType<LoopRoster['waitingBounds']> { return this.roster?.waitingBounds() ?? []; }
  printedNumbers(): ReturnType<LoopRoster['printedNumbers']> { return this.roster?.printedNumbers() ?? []; }
  dockedCardHeight(): number { return this.roster?.dockedCardHeight() ?? 0; }

  toScreen(x: number, y: number, z: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const rect = this.stage.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  resize(): void {
    const element = this.stage.renderer.domElement;
    const width = element.clientWidth || window.innerWidth;
    const height = element.clientHeight || window.innerHeight;
    this.stage.renderer.setSize(width, height, false);
    if (!this.framing.length || !this.machine) return;
    const area = this.roster?.layout(width, height);
    frameBoard(this.camera, width, height, this.framing, width <= 600 ? new THREE.Vector3(0, 0.94, 0.34).normalize() : CAMERA_DIRECTION, area);
    const machine = this.machine;
    // Each lane's number sits just behind its lorry's cab, where it covers no cargo.
    this.roster?.placePins((lane) => this.toScreen(machine.bays[lane]!.x, DECK_TOP + 0.3, machine.mouthZ(lane) + TRUCK.bedLength + TRUCK.cabLength + 0.05));
  }
}
