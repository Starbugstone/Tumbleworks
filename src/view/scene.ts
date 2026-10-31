import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { Sparks } from '../engine/sparks';
import { FIXED_SECONDS } from '../engine/physics';
import { MarbleCrowd } from '../engine/crowd';
import { frameBoard } from '../engine/framing';
import type { Stage } from '../engine/stage';
import type { Machine, MachineEvent, Pose } from '../machine/machine';
import { BOX, columnX, CRATE, FUNNEL, funnelHalfWidth, MARBLE_RADIUS, RACEWAY, STACK, TRACK, dockX } from '../machine/layout';
import type { Color } from '../sim/types';
import { COLORS, decal } from './art';
import { ARCADE, ArcadePop, ArcadeYard, stencil } from './arcade';

const CHEVRONS = 36;
const DECK_TOP = RACEWAY.floorY;
const RIM_TOP = RACEWAY.floorY + RACEWAY.wallHeight;
const CAMERA_DIRECTION = new THREE.Vector3(0, 0.82, 0.57).normalize();
const PLATFORM = ARCADE.deck;
const PLATFORM_DARK = ARCADE.edge;
const CHANNEL = ARCADE.track;

const plastic = (color: number, roughness = 0.42): THREE.MeshStandardMaterial =>
  new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, envMapIntensity: 0.7 });
const shiny = (color: number): THREE.MeshPhysicalMaterial =>
  new THREE.MeshPhysicalMaterial({ color, roughness: 0.3, clearcoat: 0.6, clearcoatRoughness: 0.2, envMapIntensity: 0.9 });

function stadium(radius: number): THREE.Shape {
  const { straightHalf: s, centerZ: cz } = TRACK;
  // Drawn in x-y and laid flat, so shape y becomes world -z.
  const shape = new THREE.Shape();
  shape.moveTo(-s, -cz + radius);
  shape.lineTo(s, -cz + radius);
  shape.absarc(s, -cz, radius, Math.PI / 2, -Math.PI / 2, true);
  shape.lineTo(-s, -cz - radius);
  shape.absarc(-s, -cz, radius, -Math.PI / 2, Math.PI / 2, true);
  return shape;
}
function ring(outer: number, inner: number): THREE.Shape {
  const shape = stadium(outer);
  const hole = new THREE.Path();
  const { straightHalf: s, centerZ: cz } = TRACK;
  hole.moveTo(-s, -cz + inner);
  hole.lineTo(s, -cz + inner);
  hole.absarc(s, -cz, inner, Math.PI / 2, -Math.PI / 2, true);
  hole.lineTo(-s, -cz - inner);
  hole.absarc(-s, -cz, inner, -Math.PI / 2, Math.PI / 2, true);
  shape.holes.push(hole);
  return shape;
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
function rounded(width: number, height: number, depth: number, material: THREE.Material, radius = 0.1): THREE.Mesh {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 3, Math.min(radius, width / 2, height / 2, depth / 2)), material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

interface Tracked { previous: Pose; current: Pose }

/** The Funnel Sort platform: crates over a clear dish, the belt loop, and docks of boxes in front. */
export class MachineScene {
  readonly scene: THREE.Scene;
  readonly camera = new THREE.PerspectiveCamera(38, 1, 1, 200);
  private machine: Machine | null = null;
  private crowd: MarbleCrowd | null = null;
  private readonly level = new THREE.Group();
  private readonly chevrons: THREE.InstancedMesh;
  private readonly dummy = new THREE.Object3D();
  private readonly tracked = new Map<number, Tracked>();
  private readonly crates = new Map<number, THREE.Group>();
  private readonly boxes = new Map<string, { group: THREE.Group; lights: THREE.Mesh[]; pulse: number }>();
  private previousCrates: ReturnType<Machine['readCrates']> = [];
  private currentCrates: ReturnType<Machine['readCrates']> = [];
  private previousBoxes: ReturnType<Machine['readBoxes']> = [];
  private currentBoxes: ReturnType<Machine['readBoxes']> = [];
  private readonly hitTargets: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly lightOff = plastic(0x2c3366, 0.6);
  private readonly lightOn = new THREE.MeshStandardMaterial({ color: 0xfff1b0, emissive: 0xffd45e, emissiveIntensity: 1.6 });
  private readonly glass = new THREE.MeshPhysicalMaterial({ color: 0xd6ecff, transparent: true, opacity: 0.34, roughness: 0.08, metalness: 0, side: THREE.DoubleSide, depthWrite: false, envMapIntensity: 1.6 });
  private readonly tempA = new THREE.Quaternion();
  private readonly tempB = new THREE.Quaternion();
  private readonly sparks: Sparks;
  private readonly pops: ArcadePop;
  private yard: ArcadeYard | null = null;
  private framing: { x: number; y: number; z: number }[] = [];

  constructor(private readonly stage: Stage) {
    this.scene = stage.createScene('arcade');
    this.sparks = new Sparks(this.scene);
    this.pops = new ArcadePop(this.scene, 'LOADED!');
    this.buildPlatform();
    this.chevrons = new THREE.InstancedMesh(new THREE.BoxGeometry(0.1, 0.012, RACEWAY.channelHalf * 1.5), plastic(0x4f8896, 0.8), CHEVRONS);
    this.chevrons.frustumCulled = false;
    this.scene.add(this.chevrons, this.level);
  }

  private buildPlatform(): void {
    const outer = TRACK.radius + RACEWAY.channelHalf + RACEWAY.wallThickness;
    const inner = TRACK.radius - RACEWAY.channelHalf;
    const deck = slab(stadium(outer), 0, DECK_TOP, plastic(PLATFORM_DARK), plastic(CHANNEL, 0.55));
    const rim = slab(ring(outer, TRACK.radius + RACEWAY.channelHalf), DECK_TOP, RIM_TOP, plastic(PLATFORM_DARK), shiny(PLATFORM));
    const island = slab(stadium(inner), DECK_TOP, RIM_TOP, plastic(PLATFORM_DARK), shiny(PLATFORM));
    this.scene.add(deck, rim, island);
    const rail = slab(ring(outer + 0.015, outer - 0.055), RIM_TOP, RIM_TOP + 0.045, plastic(PLATFORM_DARK), new THREE.MeshBasicMaterial({ color: ARCADE.cyan, toneMapped: false }));
    const label = stencil('KEEP IT FLOWING', 3.5, 0.5);
    label.position.set(0, RIM_TOP + 0.01, TRACK.centerZ);
    this.scene.add(rail, label);
    // A dark throat under the neck, where marbles drop onto the belt.
    const throat = new THREE.Mesh(new THREE.CylinderGeometry(FUNNEL.neck.halfX + 0.12, FUNNEL.neck.halfX + 0.12, FUNNEL.neckY - DECK_TOP, 20, 1, true), plastic(0x2a3170, 0.7));
    throat.material.side = THREE.BackSide;
    throat.position.set(0, (FUNNEL.neckY + DECK_TOP) / 2, FUNNEL.neck.z);
    this.scene.add(throat);
  }

  private plateMesh(a: THREE.Vector3, b: THREE.Vector3, width: number, along: 'x' | 'z'): THREE.Mesh {
    const length = a.distanceTo(b);
    const geometry = along === 'x' ? new THREE.BoxGeometry(length, 0.06, width) : new THREE.BoxGeometry(width, 0.06, length);
    const mesh = new THREE.Mesh(geometry, this.glass);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    const angle = along === 'x' ? Math.atan2(b.y - a.y, b.x - a.x) : Math.atan2(b.y - a.y, b.z - a.z);
    if (along === 'x') mesh.rotation.z = angle; else mesh.rotation.x = -angle;
    return mesh;
  }

  /** The slab under everything is cut to the level: just wide enough for its columns and docks. */
  private buildBase(halfWidth: number, backZ: number, frontZ: number): void {
    const base = rounded(halfWidth * 2, 0.9, frontZ - backZ, shiny(PLATFORM), 0.3);
    base.position.set(0, -0.45, (frontZ + backZ) / 2);
    this.level.add(base);
    this.yard = new ArcadeYard(this.scene, halfWidth, backZ, frontZ);
    const brand = stencil('FUNNEL SORT', 3.3, 0.38, '#e1fffa');
    brand.rotation.x = 0;
    brand.position.set(0, -0.3, frontZ + 0.012);
    this.level.add(brand);
  }

  private buildFunnel(columns: number): void {
    const half = funnelHalfWidth(columns);
    const { mouth, neck, mouthY, neckY, rimY } = FUNNEL;
    const midZ = (mouth.back + mouth.front) / 2;
    const depth = mouth.front - mouth.back;
    const group = new THREE.Group();
    group.add(
      this.plateMesh(new THREE.Vector3(-half, mouthY, midZ), new THREE.Vector3(-neck.halfX, neckY, midZ), depth, 'x'),
      this.plateMesh(new THREE.Vector3(half, mouthY, midZ), new THREE.Vector3(neck.halfX, neckY, midZ), depth, 'x'),
      this.plateMesh(new THREE.Vector3(0, mouthY, mouth.back), new THREE.Vector3(0, neckY, neck.z - neck.halfZ), half * 2, 'z'),
      this.plateMesh(new THREE.Vector3(0, mouthY, mouth.front), new THREE.Vector3(0, neckY, neck.z + neck.halfZ), half * 2, 'z'),
    );
    const rimHeight = rimY - mouthY;
    const rimMaterial = shiny(0xffc857);
    for (const [x, z, w, d] of [[-half, midZ, 0.14, depth + 0.14], [half, midZ, 0.14, depth + 0.14], [0, mouth.back, half * 2 + 0.14, 0.14], [0, mouth.front, half * 2 + 0.14, 0.14]] as const) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(w, 0.06, d), this.glass);
      wall.position.set(x, mouthY + rimHeight / 2, z);
      wall.scale.y = rimHeight / 0.06;
      group.add(wall);
      const lip = rounded(w + 0.1, 0.16, d + 0.1, rimMaterial, 0.06);
      lip.position.set(x, rimY + 0.06, z);
      group.add(lip);
    }
    const neckRing = new THREE.Mesh(new THREE.TorusGeometry(neck.halfX + 0.16, 0.07, 10, 28), shiny(0xf25f33));
    neckRing.rotation.x = Math.PI / 2;
    neckRing.position.set(0, neckY + 0.02, neck.z);
    group.add(neckRing);
    this.level.add(group);
  }

  private crateGroup(color: Color): THREE.Group {
    const group = new THREE.Group();
    const material = shiny(COLORS[color].hex);
    const { halfWidth: hw, halfDepth: hd, floorThickness: ft, wallHeight: wh, wallThickness: wt } = CRATE;
    const floor = rounded(hw * 2, ft, hd * 2, material, 0.04);
    floor.position.y = ft / 2;
    group.add(floor);
    for (const [x, z, w, d] of [[-hw + wt / 2, 0, wt, hd * 2], [hw - wt / 2, 0, wt, hd * 2], [0, -hd + wt / 2, hw * 2, wt], [0, hd - wt / 2, hw * 2, wt]] as const) {
      const wall = rounded(w, wh, d, material, 0.03);
      wall.position.set(x, ft + wh / 2, z);
      group.add(wall);
    }
    const badge = decal(color, 0.42);
    badge.position.set(0, ft + wh / 2, hd + 0.01);
    group.add(badge);
    return group;
  }

  private boxGroup(color: Color): { group: THREE.Group; lights: THREE.Mesh[]; pulse: number } {
    const group = new THREE.Group();
    const material = shiny(COLORS[color].hex);
    const body = rounded(BOX.halfWidth * 2, BOX.height, BOX.halfDepth * 2, material, 0.08);
    body.position.y = BOX.height / 2;
    group.add(body);
    const lights: THREE.Mesh[] = [];
    for (let slot = 0; slot < 3; slot++) {
      const pocket = new THREE.Mesh(new THREE.CylinderGeometry(MARBLE_RADIUS * 1.08, MARBLE_RADIUS * 1.08, 0.05, 20), this.lightOff);
      pocket.position.set((slot - 1) * BOX.slotSpacing, BOX.height + 0.01, 0);
      group.add(pocket);
      lights.push(pocket);
    }
    const badge = decal(color, 0.34);
    badge.position.set(0, BOX.height / 2, BOX.halfDepth + 0.01);
    group.add(badge);
    return { group, lights, pulse: 0 };
  }

  /** Builds everything that belongs to one level. */
  setMachine(machine: Machine): void {
    this.clearLevel();
    this.machine = machine;
    const counts = new Map<Color, number>();
    for (const id of machine.marbleIds) counts.set(machine.marbleColor(id), (counts.get(machine.marbleColor(id)) ?? 0) + 1);
    this.crowd = new MarbleCrowd(this.level, counts, MARBLE_RADIUS);
    for (const id of machine.marbleIds) {
      this.crowd.add(id, machine.marbleColor(id));
      const pose: Pose = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
      machine.readMarble(id, pose);
      this.tracked.set(id, { previous: { ...pose }, current: pose });
    }
    this.buildFunnel(machine.board.supplies.length);
    for (const crate of machine.readCrates()) {
      const group = this.crateGroup(crate.color);
      this.crates.set(crate.key, group);
      this.level.add(group);
    }
    for (const box of machine.readBoxes()) {
      const visual = this.boxGroup(box.color);
      this.boxes.set(`${box.dock}:${box.index}`, visual);
      this.level.add(visual.group);
    }
    const columns = machine.board.supplies.length;
    for (let supply = 0; supply < columns; supply++) {
      const target = new THREE.Mesh(new THREE.BoxGeometry(CRATE.halfWidth * 2 + 0.3, 2.6, CRATE.halfDepth * 2 + 0.6), new THREE.MeshBasicMaterial({ visible: false }));
      target.position.set(columnX(supply, columns), STACK.y + 0.9, STACK.z);
      target.userData['supply'] = supply;
      this.scene.add(target);
      this.hitTargets.push(target);
    }
    const half = funnelHalfWidth(columns);
    const rows = Math.max(1, ...machine.board.supplies.map((queue) => queue.length));
    const docks = machine.board.docks.length;
    const dockHalf = Math.abs(dockX(0, docks)) + BOX.halfWidth + 0.3;
    const queueEnd = BOX.queueZ + BOX.queueSpacing * (Math.min(BOX.queueVisible, Math.max(...machine.board.docks.map((queue) => queue.length)) - 1) - 1) + 0.9;
    const baseHalf = Math.max(half, dockHalf, TRACK.straightHalf + TRACK.radius + 1.1) + 0.45;
    this.buildBase(baseHalf, FUNNEL.mouth.back - 0.5, queueEnd + 0.7);
    for (let dock = 0; dock < docks; dock++) {
      const x = dockX(dock, docks);
      const strip = rounded(BOX.halfWidth * 2 + 0.12, 0.04, queueEnd - BOX.z + 1.1, plastic(0x0b2939), 0.02);
      strip.position.set(x, 0.03, (queueEnd + BOX.z) / 2 - 0.25);
      const number = stencil(String(dock + 1).padStart(2, '0'), 0.65, 0.3, '#ffd363');
      number.position.set(x, 0.06, BOX.z - 0.75);
      this.level.add(strip, number);
    }
    this.framing = [
      { x: -baseHalf, y: -0.9, z: queueEnd + 0.7 }, { x: baseHalf, y: -0.9, z: queueEnd + 0.7 },
      { x: -baseHalf, y: 0, z: FUNNEL.mouth.back - 0.5 }, { x: baseHalf, y: 0, z: FUNNEL.mouth.back - 0.5 },
      { x: -half - 0.3, y: FUNNEL.rimY, z: FUNNEL.mouth.back }, { x: half + 0.3, y: FUNNEL.rimY, z: FUNNEL.mouth.back },
      { x: -half, y: STACK.y + STACK.stepY * (rows - 1) + 1.1, z: STACK.z + STACK.stepZ * (rows - 1) - CRATE.halfDepth },
      { x: half, y: STACK.y + STACK.stepY * (rows - 1) + 1.1, z: STACK.z + STACK.stepZ * (rows - 1) - CRATE.halfDepth },
      { x: -dockHalf, y: 0, z: queueEnd }, { x: dockHalf, y: 0, z: queueEnd },
    ];
    this.syncAfterJump();
    this.resize();
  }

  private clearLevel(): void {
    this.yard?.dispose();
    this.yard = null;
    this.crowd?.dispose();
    this.crowd = null;
    this.tracked.clear();
    this.crates.clear();
    this.boxes.clear();
    for (const target of this.hitTargets) {
      this.scene.remove(target);
      target.geometry.dispose();
      for (const material of Array.isArray(target.material) ? target.material : [target.material]) material.dispose();
    }
    this.hitTargets.length = 0;
    this.level.traverse((object) => {
      if (!(object instanceof THREE.Mesh) || object instanceof THREE.InstancedMesh) return;
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (material !== this.glass && material !== this.lightOff && material !== this.lightOn) {
        if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
        material.dispose();
      }
    });
    this.level.clear();
  }

  dispose(): void {
    this.clearLevel();
    this.sparks.dispose();
    this.pops.dispose();
    this.glass.dispose();
    this.lightOff.dispose();
    this.lightOn.dispose();
    this.stage.disposeScene(this.scene);
    this.machine = null;
  }

  /** Call after each physics tick, so drawing can blend between the last two states. */
  react(events: readonly MachineEvent[]): void {
    if (!this.machine) return;
    for (const event of events) {
      if (event.type !== 'captured' && event.type !== 'boxFull') continue;
      const box = this.machine.readBoxes().find((box) => box.dock === event.dock &&
        (event.type === 'boxFull' ? box.index === event.box : box.docked));
      if (!box) continue;
      const visual = this.boxes.get(`${box.dock}:${box.index}`);
      if (visual) visual.pulse = 1;
      if (event.type === 'boxFull') {
        const at = { x: box.x, y: box.y + BOX.height + 0.3, z: box.z };
        this.sparks.burst(at, COLORS[box.color].hex, 20);
        this.pops.burst(at);
      }
    }
  }

  afterTick(): void {
    this.sparks.step(FIXED_SECONDS);
    this.pops.step(FIXED_SECONDS);
    for (const box of this.boxes.values()) box.pulse = Math.max(0, box.pulse - FIXED_SECONDS * 4);

    const machine = this.machine;
    if (!machine) return;
    this.previousCrates = this.currentCrates;
    this.currentCrates = machine.readCrates();
    this.previousBoxes = this.currentBoxes;
    this.currentBoxes = machine.readBoxes();
    for (const [id, entry] of this.tracked) {
      const swap = entry.previous;
      entry.previous = entry.current;
      entry.current = swap;
      machine.readMarble(id, entry.current);
    }
  }

  /** Undo and restart jump the world, so blending across the jump would look wrong. */
  syncAfterJump(): void {
    this.sparks.clear();
    this.pops.clear();
    for (const box of this.boxes.values()) box.pulse = 0;
    const machine = this.machine;
    if (!machine) return;
    this.previousCrates = this.currentCrates = machine.readCrates();
    this.previousBoxes = this.currentBoxes = machine.readBoxes();
    for (const [id, entry] of this.tracked) {
      machine.readMarble(id, entry.current);
      Object.assign(entry.previous, entry.current);
    }
  }

  render(alpha: number): void {
    const machine = this.machine;
    if (!machine || !this.crowd) return;
    for (const [id, { previous: p, current: c }] of this.tracked) {
      this.tempA.set(p.qx, p.qy, p.qz, p.qw);
      this.tempB.set(c.qx, c.qy, c.qz, c.qw);
      this.tempA.slerp(this.tempB, alpha);
      this.crowd.set(id, p.x + (c.x - p.x) * alpha, p.y + (c.y - p.y) * alpha, p.z + (c.z - p.z) * alpha, this.tempA.x, this.tempA.y, this.tempA.z, this.tempA.w);
    }
    this.crowd.commit();
    for (const [index, crate] of this.currentCrates.entries()) {
      const group = this.crates.get(crate.key);
      if (!group) continue;
      const previous = this.previousCrates[index] ?? crate;
      const blend = previous.visible ? alpha : 1;
      const open = previous.open + (crate.open - previous.open) * blend;
      group.visible = crate.visible;
      group.position.set(crate.x, previous.y + (crate.y - previous.y) * blend + open * 0.6, previous.z + (crate.z - previous.z) * blend);
      group.rotation.x = -open * 0.9;
      group.scale.setScalar(1 - open * 0.85);
    }
    for (const [index, box] of this.currentBoxes.entries()) {
      const visual = this.boxes.get(`${box.dock}:${box.index}`);
      if (!visual) continue;
      const previous = this.previousBoxes[index] ?? box;
      const blend = previous.visible ? alpha : 1;
      const scale = previous.scale + (box.scale - previous.scale) * blend;
      visual.group.visible = box.visible;
      visual.group.position.set(previous.x + (box.x - previous.x) * blend, previous.y + (box.y - previous.y) * blend, previous.z + (box.z - previous.z) * blend);
      visual.group.scale.set(scale * (1 + Math.sin(visual.pulse * Math.PI) * 0.055), scale, scale * (1 + Math.sin(visual.pulse * Math.PI) * 0.055));
      visual.lights.forEach((light, slot) => { light.material = slot < box.fill ? this.lightOn : this.lightOff; });
    }
    for (let i = 0; i < CHEVRONS; i++) {
      const p = TRACK.point((i / CHEVRONS) * TRACK.length + machine.beltDistance);
      this.dummy.position.set(p.x, DECK_TOP + 0.014, p.z);
      this.dummy.rotation.set(0, Math.atan2(-p.tz, p.tx), 0);
      this.dummy.scale.setScalar(1);
      this.dummy.updateMatrix();
      this.chevrons.setMatrixAt(i, this.dummy.matrix);
    }
    this.chevrons.instanceMatrix.needsUpdate = true;
    this.stage.renderer.render(this.scene, this.camera);
  }

  /** Which supply column a tap landed on, if any. Coordinates are CSS pixels within the canvas. */
  pick(x: number, y: number): number | null {
    const rect = this.stage.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.hitTargets, false)[0];
    const supply: unknown = hit?.object.userData['supply'];
    return typeof supply === 'number' ? supply : null;
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
