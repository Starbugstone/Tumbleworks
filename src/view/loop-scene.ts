import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Sparks } from '../engine/sparks';
import { lorry } from './lorry';
import { MarbleCrowd } from '../engine/crowd';
import { frameBoard } from '../engine/framing';
import type { Stage } from '../engine/stage';
import type { LoopMachine, LoopMachineEvent, UnitPose } from '../loop/machine';
import { DECK_TOP, LOOP, MARBLE_RADIUS, TRUCK, TICK_SECONDS } from '../loop/layout';
import type { Color } from '../sim/types';
import { COLORS, containerSymbolTexture } from './art';
import { ARCADE, ArcadePop, ArcadeYard, stencil } from './arcade';

const CHEVRONS = 48;
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
interface TruckVisual { readonly group: THREE.Group; readonly blocks: Block[]; readonly setWheelTravel: (distance: number) => void; readonly setUnloading: (state: 'pouring' | 'waiting' | null, time: number) => void; pulse: number }

/** The Loop Sort platform: a packed loop around truck bays, with dispatch pads for both rows. */
export class LoopScene {
  readonly scene: THREE.Scene;
  readonly camera = new THREE.PerspectiveCamera(36, 1, 1, 200);
  private machine: LoopMachine | null = null;
  private crowd: MarbleCrowd | null = null;
  private readonly level = new THREE.Group();
  private chevrons: THREE.InstancedMesh | null = null;
  private readonly dummy = new THREE.Object3D();
  private readonly trucks = new Map<string, TruckVisual>();
  private readonly previousTrucks = new Map<string, ReturnType<LoopMachine['readTrucks']>[number]>();
  private readonly currentTrucks = new Map<string, ReturnType<LoopMachine['readTrucks']>[number]>();
  private readonly hitTargets: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly blockMaterials = new Map<Color, THREE.Material>();
  private readonly symbols = new Map<Color, THREE.CanvasTexture>();
  private readonly sparks: Sparks;
  private readonly pops: ArcadePop;
  private yard: ArcadeYard | null = null;
  private readonly bridges: THREE.Mesh[] = [];
  private perUnit = 3;
  private readonly previous = new Map<number, UnitPose[]>();
  private readonly current = new Map<number, UnitPose[]>();
  private framing: { x: number; y: number; z: number }[] = [];

  constructor(private readonly stage: Stage) {
    this.scene = stage.createScene('arcade');
    this.scene.add(this.level);
    this.sparks = new Sparks(this.scene);
    this.pops = new ArcadePop(this.scene, 'DISPATCH!');
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
    const base = rounded(outerW * 2 + 1.1, 1.1, outerD * 2 + 1.1, shiny(PLATFORM), 0.45);
    base.position.set(0, -0.55, 0);
    const deck = slab(roundedRect(outerW, outerD, cornerOut), 0, LOOP.floorY, plastic(PLATFORM_DARK), plastic(CHANNEL, 0.55));
    const rim = slab(ring(roundedRect(outerW, outerD, cornerOut), roundedRect(track.halfWidth + LOOP.channelHalf, track.halfDepth + LOOP.channelHalf, track.corner + LOOP.channelHalf)), LOOP.floorY, DECK_TOP, plastic(PLATFORM_DARK), shiny(PLATFORM));
    const plateau = slab(roundedRect(innerW, innerD, Math.max(0.2, track.corner - LOOP.channelHalf)), LOOP.floorY, DECK_TOP, plastic(PLATFORM_DARK), shiny(PLATFORM));
    this.level.add(base, deck, rim, plateau);
    const rimLight = slab(ring(roundedRect(outerW + 0.015, outerD + 0.015, cornerOut), roundedRect(outerW - 0.05, outerD - 0.05, cornerOut - 0.05)), DECK_TOP, DECK_TOP + 0.04, plastic(PLATFORM_DARK), new THREE.MeshBasicMaterial({ color: ARCADE.cyan, toneMapped: false }));
    this.level.add(rimLight);
    this.yard = new ArcadeYard(this.scene, outerW + 0.55, -outerD - 0.55, outerD + 0.55);
    const brand = stencil('LOOP SORT', 2.7, 0.35, '#b3e6e0');
    brand.position.set(0, DECK_TOP + 0.01, machine.bays.some((bay) => bay.row === 'back') ? 0 : -innerD + 0.45);
    this.level.add(brand);
    // Lane trays on the plateau, one per bay, and a bright pad on the rim where it pours and loads.
    machine.bays.forEach((bay, lane) => {
      const facing = machine.facing(lane);
      const tray = rounded(TRUCK.bedWidth + 0.26, 0.05, TRUCK.bedLength + TRUCK.cabLength + 0.3, plastic(0x092a3b, 0.6), 0.05);
      tray.position.set(bay.x, DECK_TOP + 0.02, machine.mouthZ(lane) - facing * (TRUCK.bedLength + TRUCK.cabLength) / 2);
      this.level.add(tray);
      const pad = rounded(0.95, 0.06, LOOP.wallThickness + 0.1, shiny(0xf25f33), 0.03);
      pad.position.set(bay.x, DECK_TOP + 0.02, facing * (track.halfDepth + LOOP.channelHalf + LOOP.wallThickness / 2));
      this.level.add(pad);
      const number = stencil(String(lane + 1).padStart(2, '0'), 0.45, 0.25, '#ffd363');
      number.position.set(bay.x, DECK_TOP + 0.06, machine.mouthZ(lane) + facing * 0.15);
      this.level.add(number);
      // Both rows have a real exit apron. A raised bridge closes over the loop only during dispatch.
      const apron = rounded(1.14, 0.35, TRUCK.exitLength, plastic(PLATFORM_DARK), 0.06);
      apron.position.set(bay.x, DECK_TOP - 0.175, facing * (outerD + TRUCK.exitLength / 2));
      this.level.add(apron);
      const bridge = rounded(1.05, 0.06, LOOP.channelHalf * 2 + LOOP.wallThickness + 0.4, plastic(0x38566b), 0.02);
      bridge.position.set(bay.x, DECK_TOP - 0.025, facing * machine.track.halfDepth);
      bridge.visible = false;
      this.bridges.push(bridge); this.level.add(bridge);
      for (const side of [-1, 1]) {
        const line = rounded(0.045, 0.025, TRUCK.exitLength, new THREE.MeshBasicMaterial({ color: ARCADE.gold, toneMapped: false }), 0.01);
        line.position.set(bay.x + side * 0.48, DECK_TOP + 0.02, facing * (outerD + TRUCK.exitLength / 2));
        this.level.add(line);
      }
      const arrow = stencil('»', 0.7, 0.65, '#66ffe3');
      arrow.rotation.z = facing * Math.PI / 2;
      arrow.position.set(bay.x, DECK_TOP + 0.025, facing * (outerD + TRUCK.exitLength / 2));
      this.level.add(arrow);
    });
    this.chevrons = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.012, LOOP.channelHalf * 1.6), plastic(0x4f8896, 0.8), CHEVRONS);
    this.chevrons.frustumCulled = false;
    this.level.add(this.chevrons);
  }

  private truckVisual(color: Color, facing: number): TruckVisual {
    const group = new THREE.Group();
    const shell = lorry(color, TRUCK);
    shell.body.rotation.y = facing > 0 ? 0 : Math.PI;
    group.add(shell.body);
    const blocks: Block[] = [];
    for (let i = 0; i < MAX_BLOCKS; i++) {
      const block = new THREE.Group();
      const box = new THREE.Mesh(new RoundedBoxGeometry(TRUCK.bedWidth - 0.16, 0.34, 1, 2, 0.05), this.blockMaterials.get('red')!);
      box.castShadow = true;
      block.add(box);
      const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.3), new THREE.MeshBasicMaterial({ map: this.symbols.get('red')!, transparent: true, depthWrite: false, toneMapped: false }));
      badge.rotation.x = -Math.PI / 2;
      badge.position.y = 0.18;
      block.add(badge);
      block.visible = false;
      group.add(block);
      blocks.push({ group: block, box, badge, color: null, units: 0, previousUnits: 0 });
    }
    return { group, blocks, setWheelTravel: shell.setWheelTravel, setUnloading: shell.setUnloading, pulse: 0 };
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
      const visual = this.truckVisual(truck.finalColor, machine.facing(truck.lane));
      this.trucks.set(`${truck.lane}:${truck.index}`, visual);
      this.level.add(visual.group);
    }
    machine.bays.forEach((bay, lane) => {
      const facing = machine.facing(lane);
      const target = new THREE.Mesh(new THREE.BoxGeometry(TRUCK.bedWidth + 0.4, 1.6, TRUCK.bedLength + TRUCK.cabLength + 0.4), new THREE.MeshBasicMaterial({ visible: false }));
      target.position.set(bay.x, DECK_TOP + 0.5, machine.mouthZ(lane) - facing * (TRUCK.bedLength + TRUCK.cabLength) / 2);
      target.userData['lane'] = lane;
      this.scene.add(target);
      this.hitTargets.push(target);
    });
    const { track } = machine;
    const w = track.halfWidth + LOOP.channelHalf + LOOP.wallThickness + 0.55;
    const d = track.halfDepth + LOOP.channelHalf + LOOP.wallThickness + 0.55;
    this.framing = [
      { x: -w, y: -1.1, z: -d }, { x: w, y: -1.1, z: -d }, { x: -w, y: DECK_TOP + 0.9, z: -d }, { x: w, y: DECK_TOP + 0.9, z: -d },
      { x: -w, y: -1.1, z: d + 1.6 }, { x: w, y: -1.1, z: d + 1.6 }, { x: 0, y: DECK_TOP + 0.9, z: d },
    ];
    for (const [lane, bay] of machine.bays.entries()) {
      const z = machine.facing(lane) * (track.halfDepth + LOOP.channelHalf + LOOP.wallThickness + TRUCK.exitLength + 0.3);
      for (const x of [bay.x - 0.65, bay.x + 0.65]) {
        this.framing.push({ x, y: DECK_TOP, z }, { x, y: DECK_TOP + 1.1, z });
      }
    }
    this.syncAfterJump();
    this.resize();
  }

  private clearLevel(): void {
    this.yard?.dispose();
    this.yard = null;
    this.bridges.length = 0;
    this.crowd?.dispose();
    this.crowd = null;
    this.trucks.clear();
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
    this.level.clear();
    this.chevrons = null;
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
    const unit = machine.unitLength;
    this.bridges.forEach((bridge, lane) => { bridge.visible = [...this.currentTrucks.values()].some((truck) => truck.lane === lane && truck.departing); });
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
      visual.setUnloading(truck.unloading, (machine.tick + alpha) * TICK_SECONDS);
      // Cargo packs against the cab; the mouth end stays open. Blocks are listed loop end first.
      let edge = -facing * TRUCK.bedLength / 2;
      visual.blocks.forEach((block) => {
        const length = (block.previousUnits + (block.units - block.previousUnits) * alpha) * unit;
        block.group.visible = length > 0.005;
        if (!block.group.visible) return;
        block.group.position.set(0, TRUCK.bedHeight + 0.17, edge + facing * length / 2);
        block.box.scale.z = Math.max(length - 0.04, 0.005);
        block.badge.visible = length > 0.36;
        edge += facing * length;
      });
    }
    if (this.chevrons) {
      for (let i = 0; i < CHEVRONS; i++) {
        const p = machine.track.point((i / CHEVRONS) * machine.track.length + machine.beltDistance);
        this.dummy.position.set(p.x, LOOP.floorY + 0.014, p.z);
        this.dummy.quaternion.identity();
        this.dummy.rotation.set(0, Math.atan2(-p.tz, p.tx), 0);
        this.dummy.scale.setScalar(1);
        this.dummy.updateMatrix();
        this.chevrons.setMatrixAt(i, this.dummy.matrix);
      }
      this.chevrons.instanceMatrix.needsUpdate = true;
    }
    this.stage.renderer.render(this.scene, this.camera);
  }

  pick(x: number, y: number): number | null {
    const rect = this.stage.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.hitTargets, false)[0];
    const lane: unknown = hit?.object.userData['lane'];
    return typeof lane === 'number' ? lane : null;
  }

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
    if (this.framing.length) frameBoard(this.camera, width, height, this.framing, CAMERA_DIRECTION);
  }
}
