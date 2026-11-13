import { beltDeck } from './belt-deck';
import { BeltSurface } from './belt-surface';
import * as THREE from 'three';
import { bakeOcclusion, candy } from '../engine/candy';
import { Shake } from '../engine/shake';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Sparks } from '../engine/sparks';
import { lorry, lorryMaterials, type LorryMaterials } from './lorry';
import { LoopRoster, type RosterPick } from './loop-roster';
import { MarbleCrowd } from '../engine/crowd';
import { frameBoard } from '../engine/framing';
import { focusOn } from '../engine/finish';
import type { Stage } from '../engine/stage';
import type { LoopMachine, LoopMachineEvent, UnitPose } from '../loop/machine';
import { DECK_TOP, LOOP, MARBLE_RADIUS, TRUCK, TICK_SECONDS } from '../loop/layout';
import type { Color } from '../sim/types';
import { COLORS, containerSymbolTexture } from './art';
import { ARCADE, ArcadeYard, bodyPlastic, fuse, hull, tinted } from './arcade';

const CAMERA_DIRECTION = new THREE.Vector3(0, 0.84, 0.54).normalize();
const PLATFORM = ARCADE.deck;
const PLATFORM_DARK = ARCADE.edge;
const CHANNEL = ARCADE.track;
const MAX_BLOCKS = 6;
const plastic = (color: number, roughness = 0.42): THREE.MeshStandardMaterial =>
  candy(new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, envMapIntensity: 0.7 }));
/** Glossy toy plastic, without the clearcoat layer the marbles keep. */
const shiny = (color: number): THREE.MeshStandardMaterial =>
  candy(new THREE.MeshStandardMaterial({ color, roughness: 0.12, metalness: 0, envMapIntensity: 1.5 }));

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
/** Only floors receive shadows: sampling them on every lorry part cost a tenth of a frame. */
function rounded(width: number, height: number, depth: number, material: THREE.Material, radius = 0.08, floor = false): THREE.Mesh {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 3, Math.min(radius, width / 2, height / 2, depth / 2)), material);
  mesh.castShadow = true;
  mesh.receiveShadow = floor;
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
  private readonly couplingBars: { pair: readonly [string, string]; mesh: THREE.Group }[] = [];
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
  private yard: ArcadeYard | null = null;
  private readonly shake = new Shake();
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  /** One printed pattern material per colour for every lorry on the level. */
  private readonly decals = new Map<Color, THREE.MeshBasicMaterial>();
  private perUnit = 3;
  private readonly previous = new Map<number, UnitPose[]>();
  private readonly current = new Map<number, UnitPose[]>();
  private framing: { x: number; y: number; z: number }[] = [];

  constructor(private readonly stage: Stage) {
    this.scene = stage.createScene('arcade');
    this.scene.add(this.level);
    this.sparks = new Sparks(this.scene);
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
    const top = shiny(PLATFORM);
    const lip = shiny(ARCADE.rim);
    if (!eight) {
      const side = plastic(PLATFORM_DARK);
      const deck = slab(roundedRect(outerW, outerD, cornerOut), 0, LOOP.floorY, side, plastic(CHANNEL, 0.55));
      const rim = slab(ring(roundedRect(outerW, outerD, cornerOut), roundedRect(track.halfWidth + LOOP.channelHalf, track.halfDepth + LOOP.channelHalf, track.corner + LOOP.channelHalf)), LOOP.floorY, DECK_TOP, side, lip);
      const plateau = slab(roundedRect(innerW, innerD, Math.max(0.2, track.corner - LOOP.channelHalf)), LOOP.floorY, DECK_TOP, side, top);
      this.level.add(deck, rim, plateau);
    } else this.level.add(beltDeck(track, LOOP.channelHalf, LOOP.floorY, LOOP.wallHeight));
    // One slab under the belt and every column: the toy, with no decorative margin.
    const ends = machine.bays.map((_, lane) => this.columnEnd(machine, lane));
    const front = Math.max(eight ? Math.max(...ends) : 0, outerD) + 0.2;
    const width = Math.max(outerW * 2 + 0.3, (machine.bays.at(-1)!.x - machine.bays[0]!.x) + TRUCK.bedWidth + 0.6);
    // The loop's own lilac rim is this toy's rail, so the hull adds none and stays within the old base's outline.
    const halfWidth = width / 2 - 0.2, back = -outerD - 0.1, edge = front - 0.05;
    // The hull, every lane's dark tray, its gold stop and an eight's raised strips are one fused body: one draw.
    const parts = hull(halfWidth, (edge - back) / 2, (edge + back) / 2, 0.7, false);
    const part = (width: number, height: number, depth: number, radius: number, hex: number, x: number, y: number, z: number): void => {
      parts.push(tinted(new RoundedBoxGeometry(width, height, depth, 3, Math.min(radius, height / 2)).translate(x, y, z), hex));
    };
    this.yard = new ArcadeYard(this.scene, halfWidth, back, edge);
    machine.bays.forEach((bay, lane) => {
      const mouth = machine.mouthZ(lane);
      const end = ends[lane]!;
      if (eight) {
        // An eight has no plateau: its columns stand on raised strips running from its near edge.
        const start = mouth - TRUCK.mouthGap + LOOP.channelHalf;
        part(TRUCK.bedWidth + 0.14, DECK_TOP, end - start, 0.05, PLATFORM, bay.x, DECK_TOP / 2, (end + start) / 2);
      }
      part(TRUCK.bedWidth + 0.12, 0.04, end - mouth + 0.2, 0.02, CHANNEL, bay.x, DECK_TOP + 0.015, (end + mouth - 0.2) / 2);
      part(TRUCK.bedWidth * 0.86, 0.05, 0.16, 0.02, ARCADE.gold, bay.x, DECK_TOP + 0.03, mouth - 0.3);
    });
    const base = new THREE.Mesh(fuse(parts), bodyPlastic());
    base.castShadow = true;
    base.receiveShadow = true;
    this.level.add(base);
    bakeOcclusion(this.stage.renderer, [base], { minX: -halfWidth - 0.4, maxX: halfWidth + 0.4, minZ: back - 0.4, maxZ: edge + 0.4 });
  }

  /** Just past a docked lorry's cab. */
  private columnEnd(machine: LoopMachine, lane: number): number {
    return machine.mouthZ(lane) + TRUCK.bedLength + TRUCK.cabLength + 0.1;
  }

  private truckVisual(color: Color, facing: number, bedLength: number, latchColor: Color | null, materials: LorryMaterials): TruckVisual {
    const group = new THREE.Group();
    const shell = lorry(color, { ...TRUCK, bedLength }, materials, latchColor, this.decals);
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
    const materials = lorryMaterials();
    for (const truck of machine.readTrucks()) {
      const visual = this.truckVisual(truck.finalColor, machine.facing(truck.lane), truck.bedLength, truck.latchColor, materials);
      this.trucks.set(`${truck.lane}:${truck.index}`, visual);
      this.level.add(visual.group);
    }
    for (const pair of machine.board.couplings ?? []) {
      // Dark edges show on the ivory beds and the light stripe stays continuous across the dark lane gap, in grayscale too.
      const mesh = new THREE.Group();
      const body = rounded(1, 0.16, 0.24, materials.rubber, 0.04);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(1, 0.03, 0.07), materials.ivory);
      stripe.position.y = 0.095;
      mesh.add(body, stripe);
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
    this.stage.fitShadows(this.scene, this.framing, 2.5);
    this.syncAfterJump();
    this.resize();
  }

  private clearLevel(): void {
    this.decals.clear();
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

  /** The level is won: one glitter fountain from each corner of the hull, with the confetti. */
  celebrate(clean = 1): void {
    (this.yard?.corners ?? []).forEach((corner, index) => this.sparks.fountain(corner, index * 0.15, clean));
    this.sparks.boost();
  }

  dispose(): void {
    this.clearLevel();
    this.sparks.dispose();
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
      if (visual) visual.pulse = event.type === 'complete' ? 1 : event.type === 'pour' ? 0.65 : 0.4;
      if (event.type === 'absorb' && event.fill % 3 === 0) this.sparks.land({ x: truck.x, y: truck.y + 0.9, z: truck.z - TRUCK.bedLength / 2 }, 0xffd76a);
      if (event.type === 'pour') this.sparks.tap({ x: truck.x, y: truck.y + 1, z: truck.z });
      if (event.type === 'complete') {
        const at = { x: truck.x, y: truck.y + 1.1, z: truck.z };
        if (this.sparks.payoff(at, COLORS[event.color].hex) === 2) this.shake.kick();
        // The lorry kicks up dust at its wheels as it pulls away.
        for (const side of [-1, 1]) this.sparks.burst({ x: truck.x + side * TRUCK.bedWidth * 0.5, y: truck.y + 0.15, z: truck.z + TRUCK.bedLength * 0.3 }, 0xd9cdb8, 10);
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
    // A docked lorry holding one colour with room for three units or fewer is about to finish: it gets the steady glow.
    const lit = new Set<number>();
    for (const truck of this.machine?.readTrucks() ?? []) {
      if (!truck.docked || truck.departing || truck.lane >= 8 || truck.blocks.length !== 1) continue;
      const room = truck.capacity - truck.blocks[0]!.units;
      if (room > 0 && room <= 3) { lit.add(truck.lane); this.sparks.halo(truck.lane, { x: truck.x, y: truck.y + 0.5, z: truck.z }); }
    }
    for (let lane = 0; lane < 8; lane++) if (!lit.has(lane)) this.sparks.halo(lane, null);
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

  render(alpha: number, seconds = 0): void {
    const machine = this.machine;
    if (!machine || !this.crowd) return;
    this.yard?.step(Math.max(0, seconds));
    this.shake.apply(this.camera, seconds);
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
      // A pour rocks the lorry on its wheels: about three degrees, one damped swing.
      visual.group.rotation.z = this.reducedMotion ? 0 : Math.sin(visual.pulse * Math.PI * 3) * 0.052 * Math.min(1, visual.pulse * visual.pulse * 2.4);
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
    this.belt?.setEnergy(this.sparks.heat);
    this.stage.draw(this.scene, this.camera);
  }

  /** What is under a point: a lorry card, or a docked lorry on the toy. */
  pick(x: number, y: number): RosterPick | null {
    const card = this.roster?.pick(x, y);
    if (card) return card;
    const rect = this.stage.rect;
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
    const rect = this.stage.rect;
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
    focusOn(this.scene, this.camera, this.framing);
    const machine = this.machine;
    // Each lane's number sits just behind its lorry's cab, where it covers no cargo.
    this.roster?.placePins((lane) => this.toScreen(machine.bays[lane]!.x, DECK_TOP + 0.3, machine.mouthZ(lane) + TRUCK.bedLength + TRUCK.cabLength + 0.05));
  }
}
