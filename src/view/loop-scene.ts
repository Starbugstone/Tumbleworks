import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { MarbleCrowd } from '../engine/crowd';
import { frameBoard } from '../engine/framing';
import type { Stage } from '../engine/stage';
import type { LoopMachine, UnitPose } from '../loop/machine';
import { DECK_TOP, LOOP, MARBLE_RADIUS, TRUCK } from '../loop/layout';
import type { Color } from '../sim/types';
import { COLORS, decal } from './art';

const CHEVRONS = 48;
const CAMERA_DIRECTION = new THREE.Vector3(0, 0.84, 0.54).normalize();
const PLATFORM = 0x5566d9;
const PLATFORM_DARK = 0x3f4cc0;
const CHANNEL = 0xdfe3ff;
const BED = 0xf6f2e8;
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

interface Block { readonly group: THREE.Group; readonly box: THREE.Mesh; readonly badge: THREE.Mesh; color: Color | null }
interface TruckVisual { readonly group: THREE.Group; readonly blocks: Block[] }

/** The Loop Sort platform: a packed loop around a plateau of truck bays, ramps out the front. */
export class LoopScene {
  readonly scene: THREE.Scene;
  readonly camera = new THREE.PerspectiveCamera(36, 1, 1, 200);
  private machine: LoopMachine | null = null;
  private crowd: MarbleCrowd | null = null;
  private readonly level = new THREE.Group();
  private chevrons: THREE.InstancedMesh | null = null;
  private readonly dummy = new THREE.Object3D();
  private readonly trucks = new Map<string, TruckVisual>();
  private readonly hitTargets: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly blockMaterials = new Map<Color, THREE.Material>();
  private readonly bedMaterial = shiny(BED);
  private readonly cabMaterial = shiny(0xffffff);
  private readonly lampMaterial = new THREE.MeshStandardMaterial({ color: 0xffe28a, emissive: 0xffc83c, emissiveIntensity: 1.4 });
  private perUnit = 3;
  private readonly previous = new Map<number, UnitPose[]>();
  private readonly current = new Map<number, UnitPose[]>();
  private framing: { x: number; y: number; z: number }[] = [];

  constructor(private readonly stage: Stage) {
    this.scene = stage.createScene('studio');
    this.scene.add(this.level);
    for (const color of Object.keys(COLORS) as Color[]) this.blockMaterials.set(color, shiny(COLORS[color].hex));
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
    // Ramps out the front: where a cleared truck drives away.
    const frontBays = machine.bays.filter((bay) => bay.row === 'front');
    for (const bay of frontBays) {
      const ramp = rounded(1.1, 0.18, 4.6, shiny(PLATFORM_DARK), 0.06);
      ramp.position.set(bay.x, -1.45, outerD + 2.1);
      ramp.rotation.x = 0.52;
      this.level.add(ramp);
    }
    // Lane trays on the plateau, one per bay, and a bright pad on the rim where it pours and loads.
    machine.bays.forEach((bay, lane) => {
      const facing = machine.facing(lane);
      const tray = rounded(TRUCK.bedWidth + 0.26, 0.05, TRUCK.bedLength + TRUCK.cabLength + 0.3, plastic(0xeef0ff, 0.6), 0.05);
      tray.position.set(bay.x, DECK_TOP + 0.02, machine.mouthZ(lane) - facing * (TRUCK.bedLength + TRUCK.cabLength) / 2);
      this.level.add(tray);
      const pad = rounded(0.95, 0.06, LOOP.wallThickness + 0.1, shiny(0xf25f33), 0.03);
      pad.position.set(bay.x, DECK_TOP + 0.02, facing * (track.halfDepth + LOOP.channelHalf + LOOP.wallThickness / 2));
      this.level.add(pad);
    });
    this.chevrons = new THREE.InstancedMesh(new THREE.BoxGeometry(0.08, 0.012, LOOP.channelHalf * 1.6), plastic(0xb4bbf4, 0.8), CHEVRONS);
    this.chevrons.frustumCulled = false;
    this.level.add(this.chevrons);
  }

  private truckVisual(): TruckVisual {
    const group = new THREE.Group();
    const bed = rounded(TRUCK.bedWidth, TRUCK.bedHeight, TRUCK.bedLength, this.bedMaterial, 0.06);
    bed.position.set(0, TRUCK.bedHeight / 2, 0);
    group.add(bed);
    // Low side rails, so the cargo reads as sitting in a tray.
    for (const side of [-1, 1]) {
      const rail = rounded(0.08, 0.12, TRUCK.bedLength, this.bedMaterial, 0.03);
      rail.position.set(side * (TRUCK.bedWidth / 2 - 0.04), TRUCK.bedHeight + 0.06, 0);
      group.add(rail);
    }
    const cab = new THREE.Group();
    const body = rounded(TRUCK.bedWidth, 0.42, TRUCK.cabLength, this.cabMaterial, 0.1);
    body.position.y = 0.21;
    cab.add(body);
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), this.lampMaterial);
      lamp.position.set(side * 0.28, 0.16, -TRUCK.cabLength / 2 - 0.01);
      cab.add(lamp);
    }
    cab.name = 'cab';
    group.add(cab);
    const blocks: Block[] = [];
    for (let i = 0; i < MAX_BLOCKS; i++) {
      const block = new THREE.Group();
      const box = new THREE.Mesh(new RoundedBoxGeometry(TRUCK.bedWidth - 0.16, 0.34, 1, 2, 0.05), this.blockMaterials.get('red')!);
      box.castShadow = true;
      block.add(box);
      const badge = decal('red', 0.3);
      badge.rotation.x = -Math.PI / 2;
      badge.position.y = 0.18;
      block.add(badge);
      block.visible = false;
      group.add(block);
      blocks.push({ group: block, box, badge, color: null });
    }
    return { group, blocks };
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
      const visual = this.truckVisual();
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
    this.syncAfterJump();
    this.resize();
  }

  private clearLevel(): void {
    this.crowd?.dispose();
    this.crowd = null;
    this.trucks.clear();
    this.previous.clear();
    this.current.clear();
    for (const target of this.hitTargets) this.scene.remove(target);
    this.hitTargets.length = 0;
    this.level.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (![...this.blockMaterials.values(), this.bedMaterial, this.cabMaterial, this.lampMaterial].includes(material)) material.dispose();
      }
    });
    this.level.clear();
    this.chevrons = null;
  }

  dispose(): void {
    this.clearLevel();
    this.stage.disposeScene(this.scene);
    this.machine = null;
  }

  afterTick(): void {
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
    for (const truck of machine.readTrucks()) {
      const visual = this.trucks.get(`${truck.lane}:${truck.index}`);
      if (!visual) continue;
      visual.group.visible = truck.visible;
      if (!truck.visible) continue;
      const facing = machine.facing(truck.lane);
      visual.group.position.set(truck.x, truck.y, truck.z);
      visual.group.scale.setScalar(truck.scale);
      const cab = visual.group.getObjectByName('cab');
      if (cab) { cab.position.z = -facing * (TRUCK.bedLength / 2 + TRUCK.cabLength / 2); cab.rotation.y = facing > 0 ? 0 : Math.PI; }
      // Cargo packs against the cab; the mouth end stays open. Blocks are listed loop end first.
      let edge = -facing * TRUCK.bedLength / 2;
      const ordered = [...truck.blocks].reverse();
      visual.blocks.forEach((block, index) => {
        const entry = ordered[index];
        block.group.visible = Boolean(entry && entry.units > 0);
        if (!entry || entry.units <= 0) return;
        const length = entry.units * unit;
        block.group.position.set(0, TRUCK.bedHeight + 0.17, edge + facing * length / 2);
        block.box.scale.z = Math.max(length - 0.04, 0.02);
        block.badge.visible = length > 0.36;
        if (block.color !== entry.color) {
          block.color = entry.color;
          block.box.material = this.blockMaterials.get(entry.color)!;
          (block.badge.material as THREE.MeshBasicMaterial).map = (decal(entry.color).material as THREE.MeshBasicMaterial).map;
          (block.badge.material as THREE.MeshBasicMaterial).needsUpdate = true;
        }
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
