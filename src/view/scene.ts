import { beltDeck } from './belt-deck';
import { BeltSurface } from './belt-surface';
import * as THREE from 'three';
import { bakeOcclusion, candy, moulded } from '../engine/candy';
import { Shake } from '../engine/shake';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Sparks } from '../engine/sparks';
import { Glass } from '../engine/glass';
import { FIXED_SECONDS } from '../engine/physics';
import { MarbleCrowd } from '../engine/crowd';
import { frameBoard } from '../engine/framing';
import { focusOn } from '../engine/finish';
import type { Stage } from '../engine/stage';
import type { Machine, MachineEvent, MarbleDelivery, Pose } from '../machine/machine';
import { BOX, CRATE, FUNNEL, funnelFaces, funnelHalfWidth, MARBLE_RADIUS, RACEWAY, RIDE_Y, STACK, Track, dockX } from '../machine/layout';
import { shelfMarks, type ShelfMarks } from '../sim/shelf-marks';
import type { Color } from '../sim/types';
import { COLORS, decal } from './art';
import { ARCADE, ArcadeYard, bodyPlastic, fuse, hull, plate, roundRect, tinted } from './arcade';

const DECK_TOP = RACEWAY.floorY;
const RIM_TOP = RACEWAY.floorY + RACEWAY.wallHeight;
const CAMERA_DIRECTION = new THREE.Vector3(0, 0.82, 0.57).normalize();
const PLATFORM = ARCADE.deck;
const PLATFORM_DARK = ARCADE.edge;
const CHANNEL = ARCADE.track;

const plastic = (color: number, roughness = 0.42): THREE.MeshStandardMaterial =>
  candy(new THREE.MeshStandardMaterial({ color, roughness, metalness: 0, envMapIntensity: 0.7 }));
/** Glossy toy plastic, without the clearcoat layer the marbles keep. */
const shiny = (color: number): THREE.MeshStandardMaterial =>
  candy(new THREE.MeshStandardMaterial({ color, roughness: 0.12, metalness: 0, envMapIntensity: 1.5 }));

/**
 * A moulded toy tray in one piece: a floor and a wall that runs round it with round corners and a rolled
 * lip, which is what catches the light. Outer size, floor and wall are the machine's own measurements.
 */
function trayGeometry(halfWidth: number, halfDepth: number, floor: number, wallHeight: number, wall: number, corner: number): THREE.BufferGeometry {
  const lip = Math.min(0.035, wall * 0.4);
  const outline = new THREE.Shape();
  roundRect(outline, halfWidth - lip, halfDepth - lip, corner);
  const base = new THREE.ExtrudeGeometry(outline, { depth: floor, bevelEnabled: false, curveSegments: 5 });
  const ring = new THREE.Shape();
  roundRect(ring, halfWidth - lip, halfDepth - lip, corner);
  const hole = new THREE.Path();
  roundRect(hole, halfWidth - wall + lip, halfDepth - wall + lip, Math.max(0.02, corner - wall));
  ring.holes.push(hole);
  const walls = new THREE.ExtrudeGeometry(ring, { depth: wallHeight - lip, bevelEnabled: true, bevelThickness: lip, bevelSize: lip, bevelSegments: 2, curveSegments: 5 });
  walls.translate(0, 0, floor);
  const merged = mergeGeometries([base, walls]);
  base.dispose(); walls.dispose();
  if (!merged) throw new Error('Tray geometry could not be merged');
  merged.rotateX(-Math.PI / 2);
  return merged;
}

function stadium(track: Track, radius: number): THREE.Shape {
  const { straightHalf: s, centerZ: cz } = track;
  // Drawn in x-y and laid flat, so shape y becomes world -z.
  const shape = new THREE.Shape();
  shape.moveTo(-s, -cz + radius);
  shape.lineTo(s, -cz + radius);
  shape.absarc(s, -cz, radius, Math.PI / 2, -Math.PI / 2, true);
  shape.lineTo(-s, -cz - radius);
  shape.absarc(-s, -cz, radius, -Math.PI / 2, Math.PI / 2, true);
  return shape;
}
function ring(track: Track, outer: number, inner: number): THREE.Shape {
  const shape = stadium(track, outer);
  const hole = new THREE.Path();
  const { straightHalf: s, centerZ: cz } = track;
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
/** Only floors receive shadows: sampling them on every crate and box cost a tenth of a frame. */
function rounded(width: number, height: number, depth: number, material: THREE.Material, radius = 0.1, floor = false): THREE.Mesh {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(width, height, depth, 3, Math.min(radius, width / 2, height / 2, depth / 2)), material);
  mesh.castShadow = true;
  mesh.receiveShadow = floor;
  return mesh;
}

const BOX_FILL_ORDER: readonly number[] = [0, 2, 1];
const BOX_SHAKE_SECONDS = 0.24;
/** A box hops once as it rolls up to its dock; a crate swells once as it becomes the one to tap. */
const BOX_HOP_SECONDS = 0.3;
const BOX_LAND_SECONDS = 0.16;
/** Distance in one tick above which a marble is flying or falling, not riding the belt. */
const TRAIL_STEP = 0.115;
const CRATE_SWELL_SECONDS = 0.32;
interface BoxVisual { group: THREE.Group; badge: THREE.Object3D; machineScale: number; shakeAge: number; hopAge: number; landAge: number; bounce: number; spin: number; offsetX: number; offsetY: number; shared?: true }
/** `pause` stands over a full box while its partner still fills: the same sign Loop Sort uses for a held pour. */
interface PalletVisual { mesh: THREE.Mesh; pause: THREE.Group; first: BoxVisual; second: BoxVisual; docks: readonly [number, number]; index: number; completed: boolean }
interface Tracked { previous: Pose; current: Pose; box: BoxVisual | null; landed: boolean }
/** Forked shelves: a padlock on each crate that cannot be tipped yet, strapped to every crate still in its way. */
interface ShelfLocks {
  readonly straps: THREE.InstancedMesh;
  readonly bodies: THREE.InstancedMesh;
  readonly shackles: THREE.InstancedMesh;
  released: number;
  locked: ReadonlySet<number>;
  links: ShelfMarks['straps'];
  /** Ages in seconds of the padlocks popping off, the refused padlocks shaking and their straps flashing. */
  readonly popping: Map<number, number>;
  readonly shaking: Map<number, number>;
  readonly flashing: Map<number, number>;
}
const LOCK_POP_SECONDS = 0.22;
const LOCK_SHAKE_SECONDS = 0.32;
const STRAP_FLASH_SECONDS = 0.6;
const STRAP_COLOR = new THREE.Color(0x273f48);
const STRAP_FLASH = new THREE.Color(0xffe7a8);
/** Leans the padlock back so its face looks up at the phone camera. */
const LOCK_TILT = -1.0;
/** The padlock hangs beside the crate's centred pattern, never over it. */
const LOCK_SIDE = 0.68;
/** How far the pair handle rises above the crates' rims. */
const PAIR_RISE = 0.35;
const SEAL_POP_SECONDS = 0.2;

/** The Funnel Sort platform: crates over a clear dish, the belt loop, and docks of boxes in front. */
export class MachineScene {
  readonly scene: THREE.Scene;
  readonly camera = new THREE.PerspectiveCamera(46, 1, 1, 200);
  private machine: Machine | null = null;
  private crowd: MarbleCrowd | null = null;
  private readonly level = new THREE.Group();
  private belt: BeltSurface | null = null;
  private readonly tracked = new Map<number, Tracked>();
  /** Paired crates' shared handles. */
  private readonly links: { group: THREE.Group; from: number; to: number }[] = [];
  private shelf: ShelfLocks | null = null;
  private readonly lockMatrix = new THREE.Matrix4();
  private readonly lockTurn = new THREE.Quaternion();
  private readonly lockEuler = new THREE.Euler();
  private readonly lockPlace = new THREE.Vector3();
  private readonly lockSize = new THREE.Vector3();
  private readonly shackleOffset = new THREE.Matrix4().makeTranslation(0, 0.26, 0);
  private readonly strapA = new THREE.Vector3();
  private readonly strapB = new THREE.Vector3();
  private readonly strapAxis = new THREE.Vector3();
  private readonly unitX = new THREE.Vector3(1, 0, 0);
  private readonly linkA = new THREE.Vector3();
  private readonly linkB = new THREE.Vector3();
  private readonly linkAxis = new THREE.Vector3();
/** A sealed dock's lid sits over its front box; the matching key tab sits on the box that opens it. */
  private readonly shutters = new Map<number, { group: THREE.Group; key: THREE.Group; lift: number }>();
  private readonly crates = new Map<number, THREE.Group>();
  private readonly boxes = new Map<string, BoxVisual>();
  private readonly pallets: PalletVisual[] = [];
  /** Every box's three pockets, lit and unlit, in two draws: one mesh per pocket cost a draw each. */
  private pockets: { on: THREE.InstancedMesh; off: THREE.InstancedMesh } | null = null;
  private readonly pocketMatrix = new THREE.Matrix4();
  private readonly pocketOffsets = [0, 1, 2].map((slot) => new THREE.Matrix4().makeTranslation((slot - 1) * BOX.slotSpacing, BOX.height + 0.01, 0));
  /** One plastic and one printed pattern per colour, shared by every crate and box of that colour. */
  private readonly paints = new Map<Color, THREE.MeshStandardMaterial>();
  private crateShell: THREE.BufferGeometry | null = null;
  private readonly decals = new Map<Color, THREE.MeshBasicMaterial>();
  private previousCrates: ReturnType<Machine['readCrates']> = [];
  private currentCrates: ReturnType<Machine['readCrates']> = [];
  private previousBoxes: ReturnType<Machine['readBoxes']> = [];
  private currentBoxes: ReturnType<Machine['readBoxes']> = [];
  private readonly hitTargets: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();
  private readonly lightOff = plastic(0x2c3366, 0.6);
  private readonly lightOn = new THREE.MeshStandardMaterial({ color: 0xfff1b0, emissive: 0xffd45e, emissiveIntensity: 1.6 });
  private readonly glass = new Glass(new THREE.MeshStandardMaterial({ color: 0xd6ecff, transparent: true, opacity: 0.18, roughness: 0.08, metalness: 0, depthWrite: false, envMapIntensity: 1.6 }));
  /** The chute is a pipe the eye should follow, so it is a little milkier than the dish. */
  private readonly chuteGlass = new Glass(new THREE.MeshStandardMaterial({ color: 0xcfe9ff, transparent: true, opacity: 0.36, roughness: 0.12, metalness: 0, depthWrite: false, envMapIntensity: 1.8 }));
  /** Materials that outlive a level, shared by every level this scene draws. */
  private readonly kept = new Set<THREE.Material>([this.glass.back, this.glass.front, this.glass.flat, this.chuteGlass.back, this.chuteGlass.front, this.chuteGlass.flat, this.lightOff, this.lightOn]);
  private readonly tempA = new THREE.Quaternion();
  private readonly tempB = new THREE.Quaternion();
  private readonly sparks: Sparks;
  private readonly swells = new Map<number, number>();
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly delivery: MarbleDelivery = { dock: -1, box: -1, slot: 0, fraction: 0, landed: false };
  private yard: ArcadeYard | null = null;
  private readonly shake = new Shake();
  private framing: { x: number; y: number; z: number }[] = [];

  constructor(private readonly stage: Stage) {
    this.scene = stage.createScene('arcade');
    this.sparks = new Sparks(this.scene, BOX.halfWidth * 2);
    this.scene.add(this.level);
  }

  private buildPlatform(): void {
    if (!this.machine) return;
    // The belt is one textured strip whose plates scroll with belt travel: motion without heavy marks.
    // Plates are long enough that three ticks per frame at 30 fps still reads as forward travel,
    // and a whole number of them closes the loop, so no seam jumps at the join.
    const track = this.machine.track;
    this.belt = new BeltSurface(track, RACEWAY.channelHalf - 0.03, DECK_TOP, this.machine.slotPitch * 3);
    this.level.add(this.belt.mesh);
    if (!(track instanceof Track)) {
      this.level.add(beltDeck(track, RACEWAY.channelHalf, DECK_TOP, RACEWAY.wallHeight));
      return;
    }
    const outer = track.radius + RACEWAY.channelHalf + RACEWAY.wallThickness;
    const inner = track.radius - RACEWAY.channelHalf;
    const side = plastic(PLATFORM_DARK);
    const deck = slab(stadium(track, outer), 0, DECK_TOP, side, plastic(CHANNEL, 0.55));
    const rim = slab(ring(track, outer, track.radius + RACEWAY.channelHalf), DECK_TOP, RIM_TOP, side, shiny(ARCADE.rim));
    const island = slab(stadium(track, inner), DECK_TOP, RIM_TOP, side, shiny(PLATFORM));
    this.level.add(deck, rim, island);
  }

  /** A clear pipe from the neck to the belt entry: the one place marbles join the belt, on every track shape. */
  private buildChute(machine: Machine): void {
    const { neck, neckY, chuteRadius, chuteClearance } = FUNNEL;
    const land = machine.track.point(machine.entryDistance);
    const top = new THREE.Vector3(0, neckY - 0.04, neck.z);
    const bottom = new THREE.Vector3(land.x, RIDE_Y + land.y + MARBLE_RADIUS + chuteClearance, land.z);
    const axis = bottom.clone().sub(top);
    const length = axis.length();
    const pipe = this.chuteGlass.mesh(new THREE.CylinderGeometry(chuteRadius, chuteRadius, length, 24, 1, true), 1);
    pipe.position.copy(top).addScaledVector(axis, 0.5);
    pipe.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), axis.normalize());
    const lip = new THREE.Mesh(new THREE.TorusGeometry(chuteRadius + 0.02, 0.05, 10, 28), shiny(ARCADE.gold));
    lip.position.copy(bottom);
    lip.quaternion.copy(pipe.quaternion);
    lip.rotateX(Math.PI / 2);
    this.level.add(pipe, lip);
  }

  /**
   * The toy's body in one draw: the hull cut to the level, a dark well under each dock, and the tower the
   * crates are racked against. Seen from the player's side the tower is what lies behind every crate and
   * behind the glass dish, and the wells lie under every box, so cargo is always read against the machine's
   * own dark plastic, never against the bright frame or the water around it.
   */
  private buildBody(halfWidth: number, backZ: number, frontZ: number, half: number, rows: number, docks: number, queueEnd: number): void {
    const parts = hull(halfWidth, (frontZ - backZ) / 2, (frontZ + backZ) / 2);
    const top = STACK.y + STACK.stepY * (rows - 1) + CRATE.floorThickness + CRATE.wallHeight + 0.4;
    const front = Math.min(STACK.z + STACK.stepZ * (rows - 1) - CRATE.halfDepth - 0.2, FUNNEL.mouth.back - 0.3);
    const box = (width: number, height: number, depth: number, radius: number, hex: number, x: number, y: number, z: number): void => {
      parts.push(tinted(new RoundedBoxGeometry(width, height, depth, 3, Math.min(radius, width / 2, height / 2, depth / 2)).translate(x, y, z), hex));
    };
    box(half * 2 + 0.9, top, 0.5, 0.2, CHANNEL, 0, top / 2 - 0.02, front - 0.25);
    box(half * 2 + 1.14, 0.26, 0.74, 0.12, ARCADE.rim, 0, top + 0.07, front - 0.25);
    box(half * 2 + 1.0, 0.1, 0.62, 0.05, ARCADE.trim, 0, top - 0.14, front - 0.25);
    for (const side of [-1, 1]) box(0.34, top + 0.1, 0.66, 0.14, ARCADE.deck, side * (half + 0.5), top / 2 - 0.02, front - 0.25);
    // Each dock's lane is its own dark inlay with round ends, so the violet deck shows between the lanes.
    const length = queueEnd - BOX.z + 0.9, middle = (queueEnd + BOX.z) / 2 - 0.15;
    for (let dock = 0; dock < docks; dock++) {
      parts.push(plate(BOX.halfWidth + 0.06, length / 2, 0.05, 0.06, 0.16, 0.02, CHANNEL, 0).translate(dockX(dock, docks), 0, middle));
    }
    const body = new THREE.Mesh(fuse(parts), bodyPlastic());
    body.castShadow = true;
    body.receiveShadow = true;
    this.level.add(body);
    bakeOcclusion(this.stage.renderer, [body], { minX: -halfWidth - 0.4, maxX: halfWidth + 0.4, minZ: backZ - 0.4, maxZ: frontZ + 0.4 });
    this.yard = new ArcadeYard(this.scene, halfWidth, backZ, frontZ);
  }

  private buildFunnel(columns: number): void {
    const half = funnelHalfWidth(columns);
    const { mouth, neck, mouthY, neckY, rimY } = FUNNEL;
    const midZ = (mouth.back + mouth.front) / 2;
    const depth = mouth.front - mouth.back;
    const group = new THREE.Group();
    for (const face of funnelFaces(columns)) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(face.flatMap((p) => [p.x, p.y, p.z]), 3));
      geometry.setIndex([0, 1, 2, 0, 2, 3]);
      geometry.computeVertexNormals();
      group.add(new THREE.Mesh(geometry, this.glass.flat));
    }
    const rimHeight = rimY - mouthY;
    // Lilac, not the old gold: a yellow crate stands right behind this rim.
    const rimMaterial = shiny(ARCADE.rim);
    const lips: THREE.BufferGeometry[] = [];
    for (const [x, z, w, d] of [[-half, midZ, 0.14, depth + 0.14], [half, midZ, 0.14, depth + 0.14], [0, mouth.back, half * 2 + 0.14, 0.14], [0, mouth.front, half * 2 + 0.14, 0.14]] as const) {
      const wall = this.glass.mesh(new THREE.BoxGeometry(w, 0.06, d));
      wall.position.set(x, mouthY + rimHeight / 2, z);
      wall.scale.y = rimHeight / 0.06;
      group.add(wall);
      const lip = rounded(w + 0.1, 0.16, d + 0.1, rimMaterial, 0.06);
      lip.position.set(x, rimY + 0.06, z);
      lip.updateMatrix();
      lips.push(lip.geometry.applyMatrix4(lip.matrix));
    }
    const rimGeometry = mergeGeometries(lips);
    for (const geometry of lips) geometry.dispose();
    if (!rimGeometry) throw new Error('Funnel rim geometry could not be merged');
    const rim = new THREE.Mesh(rimGeometry, rimMaterial);
    rim.castShadow = true;
    group.add(rim);
    const neckRing = new THREE.Mesh(new THREE.TorusGeometry(neck.halfX + 0.16, 0.07, 10, 28), shiny(ARCADE.gold));
    neckRing.rotation.x = Math.PI / 2;
    neckRing.position.set(0, neckY + 0.02, neck.z);
    group.add(neckRing);
    this.level.add(group);
  }

  private paint(color: Color): THREE.MeshStandardMaterial {
    let material = this.paints.get(color);
    if (!material) {
      // Crates and boxes are moulded in two tones: every shape drawn with this carries its own shading.
      material = shiny(COLORS[color].hex);
      material.vertexColors = true;
      this.paints.set(color, material);
    }
    return material;
  }

  private crateGroup(color: Color): THREE.Group {
    const group = new THREE.Group();
    const { halfWidth: hw, halfDepth: hd, floorThickness: ft, wallHeight: wh, wallThickness: wt } = CRATE;
    // One moulded tray per crate, shared by every crate on the board: one draw each.
    this.crateShell ??= moulded(trayGeometry(hw, hd, ft, wh, wt, 0.3));
    const shell = new THREE.Mesh(this.crateShell, this.paint(color));
    shell.castShadow = true;
    group.add(shell);
    const badge = decal(color, 0.42, this.decals);
    badge.position.set(0, ft + wh / 2, hd + 0.01);
    group.add(badge);
    return group;
  }

  private boxGroup(color: Color): BoxVisual {
    const group = new THREE.Group();
    const body = rounded(BOX.halfWidth * 2, BOX.height, BOX.halfDepth * 2, this.paint(color), 0.16);
    moulded(body.geometry, 0.55, 1.12);
    body.position.y = BOX.height / 2;
    group.add(body);
    const badge = decal(color, 0.34, this.decals);
    badge.position.set(0, BOX.height / 2, BOX.halfDepth + 0.01);
    group.add(badge);
    return { group, badge, machineScale: 1, shakeAge: BOX_SHAKE_SECONDS, hopAge: BOX_HOP_SECONDS, landAge: BOX_LAND_SECONDS, bounce: 0, spin: 0, offsetX: 0, offsetY: 0 };
  }

  /** Three instanced draws for every padlock and strap on the board, whatever the number of crates. */
  private buildShelfLocks(machine: Machine): void {
    const crates = machine.rules.state.supplies.flat().length;
    const edges = Object.values(machine.board.predecessors ?? {}).reduce((sum, before) => sum + before.length, 0);
    const instanced = (geometry: THREE.BufferGeometry, material: THREE.Material, count: number): THREE.InstancedMesh => {
      const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      this.level.add(mesh);
      return mesh;
    };
    // Each strap is a band plus a short hook down its blocker's front wall, both instances of one unit bar.
    const straps = instanced(new RoundedBoxGeometry(1, 0.07, 0.2, 2, 0.03), shiny(0xffffff), edges * 2);
    // Colour is per instance from the start, so a flash needs no new shader.
    for (let index = 0; index < edges * 2; index++) straps.setColorAt(index, STRAP_COLOR);
    const bodies = instanced(new RoundedBoxGeometry(0.66, 0.52, 0.18, 2, 0.07), shiny(0x273f48), crates);
    const shackles = instanced(new THREE.TorusGeometry(0.19, 0.06, 8, 14, Math.PI), shiny(0xd9e2e4), crates);
    const marks = shelfMarks(machine.rules);
    this.shelf = { straps, bodies, shackles, released: machine.rules.state.released.length, locked: new Set(marks.locked), links: marks.straps,
      popping: new Map(), shaking: new Map(), flashing: new Map() };
  }

  /** Straps fall and padlocks pop on accepted releases, never waiting for the crate's animation. */
  private updateShelfLocks(jump: boolean): void {
    const shelf = this.shelf, machine = this.machine;
    if (!shelf || !machine) return;
    // Like the shutter, these age on game ticks, so the belt's own clock drives them.
    for (const [ages, limit] of [[shelf.popping, LOCK_POP_SECONDS], [shelf.shaking, LOCK_SHAKE_SECONDS], [shelf.flashing, STRAP_FLASH_SECONDS]] as const) {
      for (const [id, age] of ages) if (age + FIXED_SECONDS >= limit) ages.delete(id); else ages.set(id, age + FIXED_SECONDS);
    }
    const released = machine.rules.state.released.length;
    if (!jump && released === shelf.released) return;
    const marks = shelfMarks(machine.rules);
    const locked = new Set(marks.locked);
    if (jump) for (const ages of [shelf.popping, shelf.shaking, shelf.flashing]) ages.clear();
    else if (!this.reducedMotion) for (const id of shelf.locked) if (!locked.has(id)) shelf.popping.set(id, 0);
    shelf.released = released;
    shelf.locked = locked;
    shelf.links = marks.straps;
  }

  /** A refused tap on a padlocked crate shakes its padlock and flashes the straps to the crates in its way. */
  refuse(id: number): boolean {
    const shelf = this.shelf;
    if (!shelf?.locked.has(id)) return false;
    if (!this.reducedMotion) shelf.shaking.set(id, 0);
    shelf.flashing.set(id, 0);
    return true;
  }

  private renderShelfLocks(): void {
    const shelf = this.shelf;
    if (!shelf) return;
    const crate = (id: number) => this.currentCrates.find((entry) => entry.id === id && entry.visible);
    const rim = CRATE.floorThickness + CRATE.wallHeight;
    const m = this.lockMatrix, q = this.lockTurn, p = this.lockPlace, s = this.lockSize;
    shelf.bodies.count = shelf.shackles.count = shelf.straps.count = 0;
    for (const id of [...shelf.locked, ...shelf.popping.keys()]) {
      const at = crate(id);
      if (!at) continue;
      const pop = (shelf.popping.get(id) ?? 0) / LOCK_POP_SECONDS;
      const shake = shelf.shaking.get(id);
      const wobble = shake === undefined ? 0 : 0.28 * Math.sin(shake * Math.PI * 2 * 6) * (1 - shake / LOCK_SHAKE_SECONDS);
      q.setFromEuler(this.lockEuler.set(LOCK_TILT, 0, wobble));
      p.set(at.x + LOCK_SIDE, at.y + rim + 0.3 + pop * 0.45, at.z + CRATE.halfDepth - 0.02);
      s.setScalar(Math.max(0.001, 1 - pop * pop));
      m.compose(p, q, s);
      shelf.bodies.setMatrixAt(shelf.bodies.count++, m);
      shelf.shackles.setMatrixAt(shelf.shackles.count++, m.multiply(this.shackleOffset));
    }
    for (const [blocker, locked] of shelf.links) {
      const from = crate(locked), to = crate(blocker);
      if (!from || !to) continue;
      const flash = shelf.flashing.get(locked);
      const color = flash !== undefined && Math.floor(flash / 0.15) % 2 === 0 ? STRAP_FLASH : STRAP_COLOR;
      // The band leaves the padlock and hooks over the blocker's front lip, beside its pattern rather than on it.
      const side = Math.abs(to.x - from.x) < 0.01 ? 0.7 : Math.sign(from.x - to.x) * 0.7;
      this.strapA.set(from.x + LOCK_SIDE, from.y + rim + 0.06, from.z + CRATE.halfDepth - 0.02);
      this.strapB.set(to.x + side, to.y + rim + 0.06, to.z + CRATE.halfDepth + 0.04);
      this.strapBar(shelf.straps, this.strapA, this.strapB, color);
      this.strapA.copy(this.strapB).y -= 0.34;
      this.strapBar(shelf.straps, this.strapB, this.strapA, color);
    }
    shelf.bodies.instanceMatrix.needsUpdate = shelf.shackles.instanceMatrix.needsUpdate = shelf.straps.instanceMatrix.needsUpdate = true;
    if (shelf.straps.instanceColor) shelf.straps.instanceColor.needsUpdate = true;
  }

  private strapBar(mesh: THREE.InstancedMesh, a: THREE.Vector3, b: THREE.Vector3, color: THREE.Color): void {
    const axis = this.strapAxis.subVectors(b, a);
    const length = axis.length();
    this.lockTurn.setFromUnitVectors(this.unitX, axis.divideScalar(length || 1));
    this.lockMatrix.compose(this.lockPlace.addVectors(a, b).multiplyScalar(0.5), this.lockTurn, this.lockSize.set(length, 1, 1));
    mesh.setColorAt(mesh.count, color);
    mesh.setMatrixAt(mesh.count++, this.lockMatrix);
  }

  /** Builds everything that belongs to one level. */
  setMachine(machine: Machine): void {
    this.clearLevel();
    this.machine = machine;
    this.buildPlatform();
    const counts = new Map<Color, number>();
    for (const id of machine.marbleIds) counts.set(machine.marbleColor(id), (counts.get(machine.marbleColor(id)) ?? 0) + 1);
    this.crowd = new MarbleCrowd(this.level, counts, MARBLE_RADIUS);
    for (const id of machine.marbleIds) {
      this.crowd.add(id, machine.marbleColor(id));
      const pose: Pose = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
      machine.readMarble(id, pose);
      this.tracked.set(id, { previous: { ...pose }, current: pose, box: null, landed: false });
    }
    this.buildFunnel(machine.sourceColumns);
    this.buildChute(machine);
    for (const crate of machine.readCrates()) {
      const group = this.crateGroup(crate.color);
      group.userData['action'] = crate.action;
      group.userData['crateId'] = crate.id;
      this.crates.set(crate.key, group);
      this.level.add(group);
    }
    for (const box of machine.readBoxes()) {
      const visual = this.boxGroup(box.color);
      this.boxes.set(`${box.dock}:${box.index}`, visual);
      this.level.add(visual.group);
    }
    const palletMaterial = machine.board.pallets?.length ? shiny(0xd7d2b4) : null;
    const pauseBar = machine.board.pallets?.length ? new RoundedBoxGeometry(0.16, 0.56, 0.08, 2, 0.04) : null;
    for (const [a, b] of machine.board.pallets ?? []) {
      for (let index = 0; index < machine.board.docks[a]!.length; index++) {
        const first = this.boxes.get(`${a}:${index}`)!;
        const second = this.boxes.get(`${b}:${index}`)!;
        const mesh = rounded(1, 0.12, BOX.halfDepth * 2 + 0.22, palletMaterial!, 0.05);
        first.shared = second.shared = true;
        const pause = new THREE.Group();
        for (const side of [-1, 1]) {
          const bar = new THREE.Mesh(pauseBar!, this.lightOn);
          bar.position.x = side * 0.19;
          pause.add(bar);
        }
        pause.rotation.x = LOCK_TILT;
        pause.visible = false;
        this.pallets.push({ mesh, pause, first, second, docks: [a, b], index, completed: false });
        this.level.add(mesh, pause);
      }
    }
    const pocket = new THREE.CylinderGeometry(MARBLE_RADIUS * 1.08, MARBLE_RADIUS * 1.08, 0.05, 20);
    const pockets = (material: THREE.Material): THREE.InstancedMesh => {
      const mesh = new THREE.InstancedMesh(pocket, material, this.boxes.size * 3);
      mesh.frustumCulled = false;
      mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      mesh.count = 0;
      this.level.add(mesh);
      return mesh;
    };
    this.pockets = { on: pockets(this.lightOn), off: pockets(this.lightOff) };
    const columns = machine.sourceColumns;
    const targets = machine.rules.crateActions ? machine.readCrates() : machine.readCrates().filter((crate) => crate.accessible);
    for (const crate of targets) {
      const target = new THREE.Mesh(new THREE.BoxGeometry(CRATE.halfWidth * 2 + 0.1, 0.9, 1.0), new THREE.MeshBasicMaterial({ visible: false }));
      target.position.set(crate.x, crate.y + 0.4, crate.z + CRATE.halfDepth * 0.65);
      target.userData['supply'] = crate.action;
      this.scene.add(target);
      this.hitTargets.push(target);
    }
    // A dark arch reads against the cream frame in grayscale; its gold grip stays the pairs' own colour.
    const arch = machine.board.pairs?.length ? shiny(0x273f48) : null;
    const grip = machine.board.pairs?.length ? shiny(0xffd080) : null;
    for (const [from, to] of machine.board.pairs ?? []) {
      const group = new THREE.Group();
      group.add(rounded(1, 0.18, 0.18, arch!, 0.05));
      const top = rounded(1, 0.12, 0.12, grip!, 0.04);
      top.position.y = 0.12;
      group.add(top);
      for (const x of [-0.5, 0.5]) {
        const post = rounded(0.1, PAIR_RISE + 0.05, 0.14, arch!, 0.03);
        post.position.set(x, -PAIR_RISE / 2, 0);
        group.add(post);
      }
      this.links.push({ group, from, to });
      this.level.add(group);
    }
    if (machine.board.predecessors) this.buildShelfLocks(machine);
    const slate = machine.board.seals?.length ? shiny(0x273f48) : null;
    const chrome = machine.board.seals?.length ? shiny(0xd9e2e4) : null;
    for (const seal of machine.board.seals ?? []) {
      const color = machine.board.docks[seal.after.dock]![seal.after.box]!;
      // The lid rests just above the pocket tops, inset so a strip of the box's own colour still shows all round.
      const group = new THREE.Group();
      const lid = rounded(BOX.halfWidth * 2 - 0.24, 0.08, BOX.halfDepth * 2 - 0.24, slate!, 0.04);
      lid.position.y = BOX.height + 0.09;
      const badge = decal(color, 0.62, this.decals);
      badge.rotation.x = -Math.PI / 2;
      badge.position.y = BOX.height + 0.14;
      const lock = new THREE.Group();
      lock.add(new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.4, 0.14, 2, 0.05), slate!));
      const shackle = new THREE.Mesh(new THREE.TorusGeometry(0.15, 0.045, 8, 14, Math.PI), chrome!);
      shackle.position.y = 0.2;
      lock.add(shackle);
      lock.position.set(LOCK_SIDE, BOX.height + 0.3, BOX.halfDepth - 0.08);
      lock.rotation.x = LOCK_TILT;
      group.add(lid, badge, lock);
      // A sealed dock reserves nothing, so its front box is box 0 for as long as the lid is on.
      this.boxes.get(`${seal.dock}:0`)?.group.add(group);
      const key = new THREE.Group();
      const tab = rounded(0.6, 0.04, 0.6, slate!, 0.03);
      const mark = decal(color, 0.48, this.decals);
      mark.rotation.x = -Math.PI / 2;
      mark.position.y = 0.04;
      key.add(tab, mark);
      key.position.set(0, BOX.height + 0.06, -BOX.halfDepth * 0.7);
      this.boxes.get(`${seal.after.dock}:${seal.after.box}`)?.group.add(key);
      this.shutters.set(seal.dock, { group, key, lift: 0 });
    }
    const half = funnelHalfWidth(columns);
    const rows = Math.max(1, ...machine.board.supplies.map((queue) => queue.length));
    const docks = machine.board.docks.length;
    const dockHalf = Math.abs(dockX(0, docks)) + BOX.halfWidth + 0.3;
    const queueEnd = BOX.queueZ + BOX.queueSpacing * (Math.min(BOX.queueVisible, Math.max(...machine.board.docks.map((queue) => queue.length)) - 1) - 1) + 0.9;
    const trackHalf = Math.max(...Array.from({ length: 64 }, (_, i) => Math.abs(machine.track.point(i / 64 * machine.track.length).x)));
    const baseHalf = Math.max(half, dockHalf, trackHalf + 1.1) + 0.45;
    this.buildBody(baseHalf, FUNNEL.mouth.back - 0.5, queueEnd + 0.7, half, rows, docks, queueEnd);
    this.framing = [
      { x: -half - 0.3, y: FUNNEL.rimY, z: FUNNEL.mouth.back }, { x: half + 0.3, y: FUNNEL.rimY, z: FUNNEL.mouth.back },
      { x: -half, y: STACK.y + STACK.stepY * (rows - 1) + 1.1, z: STACK.z + STACK.stepZ * (rows - 1) - CRATE.halfDepth },
      { x: half, y: STACK.y + STACK.stepY * (rows - 1) + 1.1, z: STACK.z + STACK.stepZ * (rows - 1) - CRATE.halfDepth },
      { x: -dockHalf, y: 0, z: queueEnd }, { x: dockHalf, y: 0, z: queueEnd },
    ];
    for (const crate of machine.readCrates()) for (const side of [-1,1]) this.framing.push({ x:crate.x + side * CRATE.halfWidth, y:crate.y + 1.1, z:crate.z - CRATE.halfDepth });
    for (let i = 0; i < 64; i++) for (const side of [-1, 1]) {
      const point = machine.track.point(i / 64 * machine.track.length, side * (RACEWAY.channelHalf + RACEWAY.wallThickness));
      this.framing.push({ x: point.x, y: RIM_TOP + point.y + MARBLE_RADIUS, z: point.z });
    }
    this.stage.fitShadows(this.scene, this.framing, 2.5);
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
    this.links.length = 0;
    this.shelf = null;
    this.shutters.clear();
    this.boxes.clear();
    this.pallets.length = 0;
    this.pockets = null;
    this.paints.clear();
    this.crateShell = null;
    this.decals.clear();
    for (const target of this.hitTargets) {
      this.scene.remove(target);
      target.geometry.dispose();
      for (const material of Array.isArray(target.material) ? target.material : [target.material]) material.dispose();
    }
    this.hitTargets.length = 0;
    this.level.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.InstancedMesh) object.dispose();
      object.geometry.dispose();
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) if (!this.kept.has(material)) {
        if ('map' in material && material.map instanceof THREE.Texture) material.map.dispose();
        material.dispose();
      }
    });
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
    for (const material of this.kept) material.dispose();
    this.stage.disposeScene(this.scene);
    this.machine = null;
  }

  /** Call after each physics tick, so drawing can blend between the last two states. */
  react(events: readonly MachineEvent[]): void {
    if (!this.machine) return;
    for (const event of events) {
      if (event.type === 'pour') {
        const crate = this.machine.readCrates().find((crate) => crate.supply === event.supply && crate.color === event.color);
        if (crate) this.sparks.tap({ x: crate.x, y: crate.y + CRATE.wallHeight + 0.3, z: crate.z });
      }
      if (event.type === 'captured' && event.fill < this.machine.board.boxSize) {
        // A marble seats: the box takes the weight for a moment and the pocket it landed in glints.
        const box = this.machine.readBoxes().find((box) => box.dock === event.dock && box.index === event.box);
        const visual = box && this.boxes.get(`${box.dock}:${box.index}`);
        if (box && visual && !this.reducedMotion) {
          visual.landAge = 0;
          this.sparks.land({ x: box.x + (event.fill === 1 ? -1 : 1) * BOX.slotSpacing, y: box.y + BOX.height + 0.25, z: box.z }, COLORS[box.color].hex);
        }
      }
      if (event.type !== 'captured' || event.fill !== this.machine.board.boxSize) continue;
      const box = this.machine.readBoxes().find(box => box.dock === event.dock && box.index === event.box);
      if (!box) continue;
      const visual = this.boxes.get(`${box.dock}:${box.index}`);
      if (visual) visual.shakeAge = 0;
      // The top of a streak, three finishes in quick succession, is the one moment the camera jolts.
      if (this.sparks.payoff({ x: box.x, y: box.y + BOX.height + 0.3, z: box.z }, COLORS[box.color].hex) === 2) this.shake.kick();
      if (visual?.shared) {
        const pallet = this.pallets.find((entry) => entry.first === visual || entry.second === visual);
        if (pallet && !pallet.completed && pallet.docks.every((dock) => this.machine!.rules.boxFill(dock, pallet.index) === this.machine!.board.boxSize)) {
          pallet.completed = true;
          const partner = this.machine.readBoxes().find((other) => other.index === pallet.index && other.dock !== box.dock && pallet.docks.includes(other.dock));
          if (partner && !this.reducedMotion) this.sparks.burst({ x: (box.x + partner.x) / 2, y: box.y + BOX.height + 0.45, z: box.z }, 0xffe7a8, 30);
        }
      }
    }
  }

  afterTick(): void {
    this.sparks.step(FIXED_SECONDS);

    const machine = this.machine;
    if (!machine) return;
    this.previousCrates = this.currentCrates;
    this.currentCrates = machine.readCrates();
    if (!this.reducedMotion) for (const [index, crate] of this.currentCrates.entries()) {
      if (crate.accessible && crate.visible && this.previousCrates[index]?.accessible === false) this.swells.set(crate.key, 0);
    }
    for (const [dock, shutter] of this.shutters) shutter.lift = machine.rules.dockOpen(dock) ? (this.reducedMotion ? 1 : Math.min(1, shutter.lift + FIXED_SECONDS / SEAL_POP_SECONDS)) : 0;
    this.updateShelfLocks(false);
    this.previousBoxes = this.currentBoxes;
    this.currentBoxes = machine.readBoxes();
    for (const [index, box] of this.currentBoxes.entries()) {
      const visual = this.boxes.get(`${box.dock}:${box.index}`)!;
      visual.machineScale = box.scale;
      if (box.docked && this.previousBoxes[index]?.docked === false && !this.reducedMotion) visual.hopAge = 0;
      // One marble from done: a steady warm glow sits behind the box, so the eye finds what is about to pay off.
      if (box.docked && box.dock < 8) this.sparks.halo(box.dock, box.departure === null && box.fill === machine.board.boxSize - 1 ? { x: box.x, y: box.y + BOX.height * 0.4, z: box.z } : null);
    }
    for (const [id, entry] of this.tracked) {
      const swap = entry.previous;
      entry.previous = entry.current;
      entry.current = swap;
      this.readMarble(id, entry);
      // Anything quicker than the belt, a marble falling from a crate or flying to its box, leaves a short trail.
      const dx = entry.current.x - entry.previous.x, dy = entry.current.y - entry.previous.y, dz = entry.current.z - entry.previous.z;
      const moved = dx * dx + dy * dy + dz * dz;
      if (moved > TRAIL_STEP * TRAIL_STEP && moved < 4 && !entry.landed) this.sparks.trail(entry.current, Number.parseInt(COLORS[machine.marbleColor(id)].light.slice(1), 16));
    }
  }

  /** Undo and restart jump the world, so blending across the jump would look wrong. */
  syncAfterJump(): void {
    this.sparks.clear();
    this.swells.clear();
    for (const box of this.boxes.values()) { box.shakeAge = BOX_SHAKE_SECONDS; box.hopAge = BOX_HOP_SECONDS; box.landAge = BOX_LAND_SECONDS; box.offsetX = box.offsetY = 0; }
    const machine = this.machine;
    if (!machine) return;
    this.previousCrates = this.currentCrates = machine.readCrates();
    for (const pallet of this.pallets) pallet.completed = pallet.docks.every((dock) => machine.rules.boxFill(dock, pallet.index) === machine.board.boxSize);
    for (const [dock, shutter] of this.shutters) shutter.lift = machine.rules.dockOpen(dock) ? 1 : 0;
    this.updateShelfLocks(true);
    this.previousBoxes = this.currentBoxes = machine.readBoxes();
    for (const box of this.currentBoxes) this.boxes.get(`${box.dock}:${box.index}`)!.machineScale = box.scale;
    for (const [id, entry] of this.tracked) {
      this.readMarble(id, entry);
      Object.assign(entry.previous, entry.current);
    }
  }

  private readMarble(id: number, entry: Tracked): void {
    this.machine!.readMarble(id, entry.current, this.delivery);
    const delivery = this.delivery;
    entry.box = delivery.fraction > 0 ? this.boxes.get(`${delivery.dock}:${delivery.box}`) ?? null : null;
    entry.landed = delivery.landed;
    if (entry.box) {
      // Remap the drawn flight and resting slot without changing physics or saved replay state.
      const slot = BOX_FILL_ORDER[delivery.slot] ?? delivery.slot;
      entry.current.x += (slot - delivery.slot) * BOX.slotSpacing * entry.box.machineScale * delivery.fraction;
    }
  }

  render(alpha: number, seconds = 0): void {
    const machine = this.machine;
    if (!machine || !this.crowd) return;
    for (const [index, crate] of this.currentCrates.entries()) {
      const group = this.crates.get(crate.key);
      if (!group) continue;
      const previous = this.previousCrates[index] ?? crate;
      const blend = previous.visible ? alpha : 1;
      const open = previous.open + (crate.open - previous.open) * blend;
      group.visible = crate.visible;
      group.position.set(crate.x, previous.y + (crate.y - previous.y) * blend + open * 0.6, previous.z + (crate.z - previous.z) * blend);
      group.rotation.x = -open * 0.9;
      // A quick swell as the tap lands, inside the first tenth of a second of the pour and outward only:
      // the crate's marbles are drawn where physics has them, so its walls must never close in on them.
      const pop = this.reducedMotion ? 0 : 0.1 * Math.sin(Math.PI * Math.min(1, open / 0.35));
      // The crate that has just become the one to tap swells once, outward only for the same reason, and then rests.
      const age = this.swells.get(crate.key);
      let swell = 0;
      if (age !== undefined) {
        swell = 0.09 * Math.sin(Math.PI * age / CRATE_SWELL_SECONDS);
        if (age + seconds >= CRATE_SWELL_SECONDS) this.swells.delete(crate.key); else this.swells.set(crate.key, age + Math.max(0, seconds));
      }
      group.scale.setScalar((1 - open * 0.85) * (1 + pop + swell));
    }
    for (const target of this.hitTargets) {
      const action = Number(target.userData['supply']);
      const at = machine.frontCrate(action);
      target.visible = Boolean(at);
      if (at) target.position.set(at.x, at.y + 0.4, at.z + CRATE.halfDepth * 0.65);
    }
    for (const link of this.links) {
      const from = this.currentCrates.find((crate) => crate.id === link.from);
      const to = this.currentCrates.find((crate) => crate.id === link.to);
      link.group.visible = Boolean(from?.visible && to?.visible && !machine.rules.state.released.includes(link.from) && !machine.rules.state.released.includes(link.to));
      if (!from || !to) continue;
      // Posts stand on each front wall beside its centred pattern, on the side facing the partner, never over it.
      const side = Math.sign(to.x - from.x) || 1, rim = CRATE.floorThickness + CRATE.wallHeight;
      const a = this.linkA.set(from.x + side * LOCK_SIDE, from.y + rim + PAIR_RISE, from.z + CRATE.halfDepth - 0.05);
      const b = this.linkB.set(to.x - side * LOCK_SIDE, to.y + rim + PAIR_RISE, to.z + CRATE.halfDepth - 0.05);
      const axis = this.linkAxis.subVectors(b, a);
      const length = axis.length();
      link.group.position.copy(a).addScaledVector(axis, 0.5);
      link.group.quaternion.setFromUnitVectors(this.unitX, axis.divideScalar(length || 1));
      const [bar, top, ...posts] = link.group.children;
      if (bar) bar.scale.x = length + 0.1;
      if (top) top.scale.x = Math.max(0.1, length - 0.2);
      for (const [index, post] of posts.entries()) post.position.x = (index ? 1 : -1) * length / 2;
    }
    for (const shutter of this.shutters.values()) {
      // The lid pops like a shelf padlock: a short lift and shrink, gone well before any marble lands.
      shutter.group.position.y = shutter.lift * 0.4;
      shutter.group.scale.setScalar(Math.max(0.001, 1 - shutter.lift * shutter.lift));
      shutter.group.visible = shutter.lift < 1;
      shutter.key.visible = shutter.lift === 0;
    }
    const pockets = this.pockets;
    if (pockets) pockets.on.count = pockets.off.count = 0;
    for (const [index, box] of this.currentBoxes.entries()) {
      const visual = this.boxes.get(`${box.dock}:${box.index}`);
      if (!visual) continue;
      const previous = this.previousBoxes[index] ?? box;
      const blend = previous.visible ? alpha : 1;
      const scale = previous.scale + (box.scale - previous.scale) * blend;
      visual.group.visible = box.visible;
      visual.group.position.set(previous.x + (box.x - previous.x) * blend, previous.y + (box.y - previous.y) * blend, previous.z + (box.z - previous.z) * blend);
      // Waiting boxes are drawn larger than the machine's own half size, which left their patterns too
      // small to read on a phone; they still grow to exactly full size as they reach the dock.
      const size = 1 - (1 - scale) * 0.5;
      // The last marble lands with weight: the box flattens for a moment before it jumps.
      const squash = this.reducedMotion || visual.shakeAge >= 0.09 ? 0 : Math.sin(visual.shakeAge / 0.09 * Math.PI);
      visual.group.scale.set(size * (1 + 0.05 * squash), size * (1 - 0.1 * squash), size * (1 + 0.05 * squash));
      // An empty box that is not at its dock yet shows its pattern large on top; a docked or loaded one
      // shows its pockets there and keeps the pattern on its front wall.
      const preview = !box.docked && box.departure === null && box.fill === 0;
      // Above the pocket tops (BOX.height + 0.035): level with them, the middle pocket hid the symbol and left a bare ring.
      visual.badge.position.set(0, preview ? BOX.height + 0.07 : BOX.height / 2, preview ? 0 : BOX.halfDepth + 0.01);
      visual.badge.rotation.x = preview ? -Math.PI / 2 : 0;
      visual.badge.scale.setScalar(preview ? (visual.shared ? 3 : 2.1) : 1);
      visual.shakeAge = Math.min(BOX_SHAKE_SECONDS, visual.shakeAge + Math.max(0, seconds));
      visual.offsetX = !this.reducedMotion && visual.shakeAge < BOX_SHAKE_SECONDS
        ? 0.157 * Math.sin(visual.shakeAge * Math.PI * 22) * Math.exp(-visual.shakeAge * 13) : 0;
      visual.offsetY = -Math.abs(visual.offsetX) * 0.35;
      visual.landAge = Math.min(BOX_LAND_SECONDS, visual.landAge + Math.max(0, seconds));
      // The box dips under a landing and the marbles already in it hop in their pockets.
      const land = visual.landAge < BOX_LAND_SECONDS ? Math.sin(visual.landAge / BOX_LAND_SECONDS * Math.PI) : 0;
      visual.offsetY -= 0.09 * land;
      visual.bounce = 0.13 * land;
      visual.spin = 0;
      visual.hopAge = Math.min(BOX_HOP_SECONDS, visual.hopAge + Math.max(0, seconds));
      if (visual.hopAge < BOX_HOP_SECONDS) visual.offsetY += 0.2 * Math.abs(Math.sin(visual.hopAge / BOX_HOP_SECONDS * Math.PI * 2)) * (1 - visual.hopAge / BOX_HOP_SECONDS);
      if (box.departure !== null) {
        const from = previous.departure ?? 0;
        const departure = from + (box.departure - from) * blend;
        // Accelerate out within the original departure window; the next box remains immediately usable.
        visual.offsetY += -BOX.leaveDrop * departure * departure - visual.group.position.y;
        // A finished box jumps before it drops away.
        if (!this.reducedMotion) visual.offsetY += (visual.shared ? 0.55 : 0.7) * Math.sin(Math.PI * Math.min(1, departure / 0.45));
        // One full turn while it is in the air, clear of the well and of its neighbours; its cargo turns with it.
        if (!this.reducedMotion && !visual.shared) { const turn = Math.min(1, Math.max(0, (departure - 0.08) / 0.34)); visual.spin = Math.PI * 2 * turn * turn * (3 - 2 * turn); }
      }
      visual.group.position.x += visual.offsetX;
      visual.group.position.y += visual.offsetY;
      visual.group.rotation.y = visual.spin;
      if (!pockets || !box.visible || (preview && !visual.shared)) continue;
      visual.group.updateMatrix();
      this.pocketOffsets.forEach((offset, slot) => {
        const mesh = BOX_FILL_ORDER.indexOf(slot) < box.fill ? pockets.on : pockets.off;
        mesh.setMatrixAt(mesh.count++, this.pocketMatrix.multiplyMatrices(visual.group.matrix, offset));
      });
    }
    for (const { mesh, pause, first, second, docks, index } of this.pallets) {
      const a = first.group, b = second.group;
      // A full box held for its partner shows the pause sign until the partner's last reservation.
      const fills = docks.map((dock) => machine.rules.boxFill(dock, index));
      const full = fills.map((fill) => fill >= machine.board.boxSize);
      const held = full[0] !== full[1] ? (full[0] ? a : b) : null;
      pause.visible = Boolean(held?.visible);
      if (held) pause.position.set(held.position.x, held.position.y + BOX.height + 0.85, held.position.z);
      mesh.visible = a.visible && b.visible;
      if (!mesh.visible) continue;
      const scale = Math.min(a.scale.x, b.scale.x);
      mesh.position.set((a.position.x + b.position.x) / 2, (a.position.y + b.position.y) / 2 + 0.02, (a.position.z + b.position.z) / 2);
      mesh.scale.set(Math.abs(a.position.x - b.position.x) + (BOX.halfWidth * 2 + 0.12) * scale, scale, scale);
    }
    if (pockets) pockets.on.instanceMatrix.needsUpdate = pockets.off.instanceMatrix.needsUpdate = true;
    for (const [id, entry] of this.tracked) {
      const { previous: p, current: c, box } = entry;
      this.tempA.set(p.qx, p.qy, p.qz, p.qw);
      this.tempB.set(c.qx, c.qy, c.qz, c.qw);
      this.tempA.slerp(this.tempB, alpha);
      const dx = entry.landed && box ? box.offsetX : 0;
      const dy = entry.landed && box ? box.offsetY + box.bounce : 0;
      let x = p.x + (c.x - p.x) * alpha + dx;
      let z = p.z + (c.z - p.z) * alpha;
      const y = p.y + (c.y - p.y) * alpha + dy;
      if (entry.landed && box && box.spin) {
        // Cargo rides the turning box about the box's own centre.
        const cos = Math.cos(box.spin), sin = Math.sin(box.spin), rx = x - box.group.position.x, rz = z - box.group.position.z;
        x = box.group.position.x + rx * cos + rz * sin;
        z = box.group.position.z - rx * sin + rz * cos;
      }
      const vx = c.x - p.x, vy = c.y - p.y, vz = c.z - p.z;
      // Flying or falling faster than the belt: drawn a little long along its travel.
      if (!this.reducedMotion && !entry.landed && vx * vx + vy * vy + vz * vz > TRAIL_STEP * TRAIL_STEP) this.crowd.setStretched(id, x, y, z, vx, vy, vz);
      else this.crowd.set(id, x, y, z, this.tempA.x, this.tempA.y, this.tempA.z, this.tempA.w);
    }
    this.crowd.commit();
    this.belt?.setTravel(machine.beltDistance + alpha * RACEWAY.speed * FIXED_SECONDS);
    this.belt?.setEnergy(this.sparks.heat);
    this.renderShelfLocks();
    this.yard?.step(Math.max(0, seconds));
    this.shake.apply(this.camera, seconds);
    this.stage.draw(this.scene, this.camera);
  }

  /** Which supply column a tap landed on, if any. Coordinates are CSS pixels within the canvas. */
  pick(x: number, y: number): number | null {
    const rect = this.stage.rect;
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const groups = [...this.crates.values()].filter((group) => group.visible && !this.machine?.rules.state.released.includes(Number(group.userData['crateId'])));
    const surface = this.raycaster.intersectObjects(groups, true)[0];
    if (surface) {
      let group: THREE.Object3D | null = surface.object;
      while (group && group.userData['action'] === undefined) group = group.parent;
      const action: unknown = group?.userData['action'];
      // A classic column pours its front crate wherever on the column it is tapped, as before, so a quick second tap on
      // the crate sliding forward still lands; shelves and pairs map each crate to its own action.
      return typeof action === 'number' ? action : null;
    }
    // A small extension around the front rim gives the visible piece a comfortable touch floor.
    const hit = this.raycaster.intersectObjects(this.hitTargets.filter((target) => target.visible), false)[0];
    const supply: unknown = hit?.object.userData['supply'];
    return typeof supply === 'number' ? supply : null;
  }

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
    if (!this.framing.length) return;
    frameBoard(this.camera, width, height, this.framing, width <= 600 ? new THREE.Vector3(0, 0.74, 0.67).normalize() : CAMERA_DIRECTION);
    focusOn(this.scene, this.camera, this.framing);
  }
}
