import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { Machine, Pose } from '../machine/machine';
import {
  BOX,
  CHUTE,
  FUNNEL,
  GATE,
  MARBLE_RADIUS,
  OUTER_FRONT_Z,
  RACEWAY,
  supplyX,
  TRACK_LENGTH,
  trackPoint,
  TRAY,
} from '../machine/layout';
import type { Color } from '../sim/types';
import { COLORS, glassMaterial, marbleMaterial, symbolTexture, twistGeometry, twistMaterial, woodTexture } from './art';

const MAX_PIXEL_RATIO = 1.5;
const RIB_COUNT = 28;
/** What must stay on screen, in world units, used to frame the camera for any window shape. */
const FRAME = { halfWidth: 6.15, top: 11.6, bottom: -0.2 };
/** The walls are drawn lower than they collide, so they don't hide the action. */
const DRAWN_WALL_HEIGHT = 0.62;
const ISLAND_HEIGHT = 0.44;
const CAMERA_DIRECTION = new THREE.Vector3(0, 0.72, 0.69).normalize();
const CAMERA_TARGET = new THREE.Vector3(0, 3, -0.1);

const plastic = (color: number, roughness = 0.34): THREE.MeshPhysicalMaterial =>
  new THREE.MeshPhysicalMaterial({ color, roughness, clearcoat: 0.55, clearcoatRoughness: 0.22, envMapIntensity: 0.9 });

function rounded(hx: number, hy: number, hz: number, radius: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  const safe = Math.min(radius, hx, hy, hz);
  const geometry = new RoundedBoxGeometry(hx * 2, hy * 2, hz * 2, 3, safe);
  geometry.translate(x, y, z);
  return geometry;
}

function stadiumShape(radius: number): THREE.Shape {
  const { straightHalf: s, centerZ: cz } = RACEWAY;
  // The shape is drawn in x-y, then laid flat, so shape y becomes world -z.
  const shape = new THREE.Shape();
  shape.moveTo(-s, cz * -1 + radius);
  shape.lineTo(s, cz * -1 + radius);
  shape.absarc(s, -cz, radius, Math.PI / 2, -Math.PI / 2, true);
  shape.lineTo(-s, -cz - radius);
  shape.absarc(-s, -cz, radius, -Math.PI / 2, Math.PI / 2, true);
  return shape;
}

function holePath(radius: number): THREE.Path {
  const { straightHalf: s, centerZ: cz } = RACEWAY;
  const path = new THREE.Path();
  path.moveTo(-s, -cz + radius);
  path.lineTo(s, -cz + radius);
  path.absarc(s, -cz, radius, Math.PI / 2, -Math.PI / 2, true);
  path.lineTo(-s, -cz - radius);
  path.absarc(-s, -cz, radius, -Math.PI / 2, Math.PI / 2, true);
  return path;
}

interface MarbleVisual {
  readonly id: number;
  readonly color: Color;
  readonly mesh: THREE.Mesh;
  readonly twist: THREE.Mesh;
  previous: Pose;
  current: Pose;
}

interface TrayVisual {
  readonly group: THREE.Group;
}

export class MachineScene {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene = new THREE.Scene();
  readonly camera = new THREE.PerspectiveCamera(40, 1, 1, 200);
  private machine: Machine | null = null;

  private readonly marbleGeometry = new THREE.SphereGeometry(MARBLE_RADIUS, 32, 24);
  private readonly twistGeometry = twistGeometry(MARBLE_RADIUS * 0.88);
  private readonly glassMaterials = new Map<Color, THREE.MeshPhysicalMaterial>();
  private readonly twistMaterials = new Map<Color, THREE.MeshStandardMaterial>();
  private readonly solidMaterials = new Map<Color, THREE.MeshPhysicalMaterial>();
  /** Clear glass is the first thing given up if the device can't keep up. */
  private clearGlass = true;
  private readonly dynamic = new THREE.Group();
  private marbles: MarbleVisual[] = [];
  private trays = new Map<number, TrayVisual>();
  private boxes: THREE.Group[] = [];
  private boxLights: THREE.Mesh[][] = [];

  private readonly ribs: THREE.InstancedMesh;
  private readonly ribDummy = new THREE.Object3D();

  private readonly leds: THREE.Mesh[] = [];
  private readonly ledOff = new THREE.MeshStandardMaterial({ color: 0x8d8574, roughness: 0.5 });
  private readonly ledOn = new THREE.MeshStandardMaterial({ color: 0x40e0a0, emissive: 0x18c080, emissiveIntensity: 1.5 });
  private readonly ledAlarm = new THREE.MeshStandardMaterial({ color: 0xff5a2c, emissive: 0xff3a10, emissiveIntensity: 1.9 });

  private readonly gatePad: THREE.Mesh;
  private readonly gatePadMaterial = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5, depthWrite: false });
  private readonly boxLightOff = new THREE.MeshStandardMaterial({ color: 0x5a4436, roughness: 0.5 });
  private readonly boxLightOn = new THREE.MeshStandardMaterial({ color: 0xfff6c0, emissive: 0xffe680, emissiveIntensity: 2.4 });
  private readonly lamp: THREE.Mesh;
  private readonly lampMaterial = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 1.3 });
  private readonly door: THREE.Mesh;
  private readonly kicker: THREE.Group;
  private readonly hitTargets: THREE.Mesh[] = [];
  private readonly raycaster = new THREE.Raycaster();

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, MAX_PIXEL_RATIO));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 0.95;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.transmissionResolutionScale = 0.5;

    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
    this.scene.environmentIntensity = 0.38;
    pmrem.dispose();
    this.scene.background = new THREE.Color(0x6e4a2b);

    this.addLights();
    this.addTable();
    this.addRaceway();
    this.addFunnel();
    this.addChute();

    this.ribs = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.16, 0.012, RACEWAY.channelHalf * 1.7),
      new THREE.MeshStandardMaterial({ color: 0x383d6e, roughness: 0.7 }),
      RIB_COUNT,
    );
    this.ribs.frustumCulled = false;
    this.scene.add(this.ribs);

    this.lamp = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 14), this.lampMaterial);
    this.lamp.position.set(0, RACEWAY.floorY + DRAWN_WALL_HEIGHT + 0.2, OUTER_FRONT_Z + RACEWAY.wallThickness / 2);
    this.scene.add(this.lamp);

    this.door = new THREE.Mesh(
      new THREE.BoxGeometry(GATE.doorHalf * 2, DRAWN_WALL_HEIGHT, RACEWAY.wallThickness * 0.7),
      new THREE.MeshPhysicalMaterial({ color: 0xbfe4ff, transparent: true, opacity: 0.32, roughness: 0.08, envMapIntensity: 2.5 }),
    );
    this.door.position.set(0, RACEWAY.floorY + DRAWN_WALL_HEIGHT / 2, OUTER_FRONT_Z + RACEWAY.wallThickness / 2);
    this.scene.add(this.door);

    this.gatePad = new THREE.Mesh(new THREE.PlaneGeometry(GATE.doorHalf * 2, RACEWAY.channelHalf * 2), this.gatePadMaterial);
    this.gatePad.rotation.x = -Math.PI / 2;
    this.gatePad.position.set(0, RACEWAY.floorY + 0.03, RACEWAY.centerZ + RACEWAY.radius);
    this.scene.add(this.gatePad);

    this.kicker = new THREE.Group();
    const arm = new THREE.Mesh(rounded(0.16, 0.16, 0.72, 0.12, 0, 0, 0.72), plastic(0xf25f33));
    arm.castShadow = true;
    this.kicker.add(arm);
    this.kicker.position.set(GATE.checkX - 0.4, RACEWAY.floorY + 0.5, RACEWAY.centerZ + RACEWAY.radius - RACEWAY.channelHalf - 0.05);
    this.scene.add(this.kicker);

    this.scene.add(this.dynamic);
    this.resize();
  }

  private addLights(): void {
    const key = new THREE.DirectionalLight(0xfff0dc, 3.2);
    key.position.set(-7, 22, 11);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    const range = 13;
    key.shadow.camera.left = -range;
    key.shadow.camera.right = range;
    key.shadow.camera.top = range;
    key.shadow.camera.bottom = -range;
    key.shadow.camera.near = 4;
    key.shadow.camera.far = 50;
    key.shadow.bias = -0.0006;
    key.shadow.normalBias = 0.02;
    key.shadow.radius = 4;
    this.scene.add(key);
    this.scene.add(new THREE.HemisphereLight(0xffffff, 0x8a5a30, 0.35));
  }

  private addTable(): void {
    const table = new THREE.Mesh(
      new THREE.PlaneGeometry(90, 90),
      new THREE.MeshStandardMaterial({ map: woodTexture(), roughness: 0.62, envMapIntensity: 0.35 }),
    );
    table.rotation.x = -Math.PI / 2;
    table.receiveShadow = true;
    this.scene.add(table);
  }

  private addRaceway(): void {
    const { floorY, centerZ, radius, channelHalf, wallThickness, straightHalf } = RACEWAY;
    const lay = (geometry: THREE.BufferGeometry, y: number): THREE.BufferGeometry => {
      geometry.rotateX(-Math.PI / 2);
      geometry.translate(0, y, 0);
      return geometry;
    };

    const outerRadius = radius + channelHalf + wallThickness;
    const deckDepth = 0.46;
    const deck = new THREE.Mesh(
      lay(new THREE.ExtrudeGeometry(stadiumShape(outerRadius + 0.06), { depth: deckDepth, bevelEnabled: true, bevelSize: 0.05, bevelThickness: 0.05, bevelSegments: 2, curveSegments: 32 }), floorY - deckDepth - 0.1),
      plastic(0xfdf5e6),
    );
    deck.castShadow = true;
    deck.receiveShadow = true;
    this.scene.add(deck);

    const channelShape = stadiumShape(radius + channelHalf + 0.01);
    channelShape.holes.push(holePath(radius - channelHalf - 0.01));
    const channel = new THREE.Mesh(
      lay(new THREE.ShapeGeometry(channelShape, 40), floorY + 0.003),
      new THREE.MeshStandardMaterial({ color: 0x2c2f55, roughness: 0.72, envMapIntensity: 0.5 }),
    );
    channel.receiveShadow = true;
    this.scene.add(channel);

    // The island in the middle of the loop, which carries the load lights.
    const islandRadius = radius - channelHalf - wallThickness / 2;
    const island = new THREE.Mesh(
      lay(new THREE.ExtrudeGeometry(stadiumShape(islandRadius), { depth: ISLAND_HEIGHT, bevelEnabled: true, bevelSize: 0.07, bevelThickness: 0.07, bevelSegments: 3, curveSegments: 32 }), floorY),
      plastic(0xf25f33, 0.3),
    );
    island.castShadow = true;
    island.receiveShadow = true;
    this.scene.add(island);
    const islandTop = new THREE.Mesh(
      lay(new THREE.ShapeGeometry(stadiumShape(islandRadius - 0.14), 32), floorY + ISLAND_HEIGHT + 0.08),
      plastic(0xfff6e4, 0.6),
    );
    islandTop.receiveShadow = true;
    this.scene.add(islandTop);

    const wallMesh = new THREE.Mesh(this.outerWallGeometry(), plastic(0xf25f33, 0.28));
    wallMesh.castShadow = true;
    wallMesh.receiveShadow = true;
    this.scene.add(wallMesh);

    const legMaterial = plastic(0x3b4069, 0.4);
    for (const x of [-straightHalf - 1.8, straightHalf + 1.8]) {
      for (const z of [centerZ - radius * 0.75, centerZ + radius * 0.75]) {
        const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.42, floorY - 0.4, 20), legMaterial);
        leg.position.set(x, (floorY - 0.4) / 2, z);
        leg.castShadow = true;
        this.scene.add(leg);
      }
    }

    const capacityLeds = 12;
    const spacing = 0.62;
    const rowY = floorY + ISLAND_HEIGHT + 0.14;
    const geometry = new THREE.SphereGeometry(0.2, 20, 14);
    geometry.scale(1, 0.55, 1);
    for (let i = 0; i < capacityLeds; i++) {
      const column = i % 6;
      const row = Math.floor(i / 6);
      const led = new THREE.Mesh(geometry, this.ledOff);
      led.position.set((column - 2.5) * spacing, rowY, centerZ + (row - 0.5) * 0.62 - 0.45);
      led.castShadow = true;
      this.leds.push(led);
      this.scene.add(led);
    }
  }

  /** One smooth strip around the loop, with a gap for the door. */
  private outerWallGeometry(): THREE.BufferGeometry {
    const { floorY, centerZ, channelHalf, wallThickness } = RACEWAY;
    const segments = 180;
    const top = floorY + DRAWN_WALL_HEIGHT;
    const inner = channelHalf;
    const outer = channelHalf + wallThickness;
    const positions: number[] = [];
    const normals: number[] = [];
    const push = (x: number, y: number, z: number, nx: number, ny: number, nz: number): void => {
      positions.push(x, y, z);
      normals.push(nx, ny, nz);
    };
    const quad = (
      a: [number, number, number, number, number, number],
      b: [number, number, number, number, number, number],
      c: [number, number, number, number, number, number],
      d: [number, number, number, number, number, number],
    ): void => {
      push(...a);
      push(...b);
      push(...c);
      push(...a);
      push(...c);
      push(...d);
    };
    for (let i = 0; i < segments; i++) {
      const d0 = (i / segments) * TRACK_LENGTH;
      const d1 = ((i + 1) / segments) * TRACK_LENGTH;
      const mid = trackPoint((d0 + d1) / 2, inner);
      if (Math.abs(mid.x) < GATE.doorHalf && mid.z > centerZ) continue;
      const a0 = trackPoint(d0, inner);
      const a1 = trackPoint(d1, inner);
      const b0 = trackPoint(d0, outer);
      const b1 = trackPoint(d1, outer);
      // Outward is the tangent turned a quarter turn.
      const n0 = { x: -a0.tz, z: a0.tx };
      const n1 = { x: -a1.tz, z: a1.tx };
      quad(
        [b0.x, floorY, b0.z, n0.x, 0, n0.z],
        [b0.x, top, b0.z, n0.x, 0, n0.z],
        [b1.x, top, b1.z, n1.x, 0, n1.z],
        [b1.x, floorY, b1.z, n1.x, 0, n1.z],
      );
      quad(
        [a1.x, floorY, a1.z, -n1.x, 0, -n1.z],
        [a1.x, top, a1.z, -n1.x, 0, -n1.z],
        [a0.x, top, a0.z, -n0.x, 0, -n0.z],
        [a0.x, floorY, a0.z, -n0.x, 0, -n0.z],
      );
      quad(
        [a0.x, top, a0.z, 0, 1, 0],
        [a1.x, top, a1.z, 0, 1, 0],
        [b1.x, top, b1.z, 0, 1, 0],
        [b0.x, top, b0.z, 0, 1, 0],
      );
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    return geometry;
  }

  private addFunnel(): void {
    const { mouth, neck, mouthY, neckY } = FUNNEL;
    const corners = {
      mouth: [
        [mouth.left, mouthY, mouth.back],
        [mouth.right, mouthY, mouth.back],
        [mouth.right, mouthY, mouth.front],
        [mouth.left, mouthY, mouth.front],
      ],
      neck: [
        [neck.left, neckY, neck.back],
        [neck.right, neckY, neck.back],
        [neck.right, neckY, neck.front],
        [neck.left, neckY, neck.front],
      ],
    };
    const positions: number[] = [];
    const quad = (a: number[], b: number[], c: number[], d: number[]): void => {
      positions.push(...a, ...b, ...c, ...a, ...c, ...d);
    };
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      quad(corners.mouth[i] ?? [], corners.mouth[next] ?? [], corners.neck[next] ?? [], corners.neck[i] ?? []);
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.computeVertexNormals();
    const glass = new THREE.MeshPhysicalMaterial({
      color: 0xd8f0ff,
      transparent: true,
      opacity: 0.2,
      roughness: 0.04,
      metalness: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      envMapIntensity: 3,
    });
    const shell = new THREE.Mesh(geometry, glass);
    shell.renderOrder = 2;
    this.scene.add(shell);

    // A frame around the rim and down the corners, so the clear shape reads.
    const rim = plastic(0xfdf5e6, 0.3);
    const edge = new THREE.MeshPhysicalMaterial({ color: 0xffffff, transparent: true, opacity: 0.32, roughness: 0.2, depthWrite: false });
    const rod = (from: number[], to: number[], radius: number, material: THREE.Material): void => {
      const a = new THREE.Vector3(from[0], from[1], from[2]);
      const b = new THREE.Vector3(to[0], to[1], to[2]);
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, a.distanceTo(b), 8), material);
      mesh.position.copy(a).add(b).multiplyScalar(0.5);
      mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
      this.scene.add(mesh);
    };
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4;
      rod(corners.mouth[i] ?? [], corners.mouth[next] ?? [], 0.055, rim);
      rod(corners.mouth[i] ?? [], corners.neck[i] ?? [], 0.025, edge);
    }

    // Posts carrying the funnel, and a gantry the trays hang from.
    const postMaterial = plastic(0x3b4069, 0.4);
    for (const x of [mouth.left, mouth.right]) {
      for (const z of [mouth.back, mouth.front]) {
        const post = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.09, mouthY, 10), postMaterial);
        post.position.set(x, mouthY / 2, z);
        post.castShadow = true;
        this.scene.add(post);
      }
    }
    const gantryY = TRAY.frontY - 0.26;
    const gantry = new THREE.Mesh(rounded(5.7, 0.11, 0.11, 0.08, 0, gantryY, TRAY.frontZ + 0.1), postMaterial);
    gantry.castShadow = true;
    this.scene.add(gantry);
  }

  private addChute(): void {
    const { topZ, topY, bottomZ, bottomY, halfWidth } = CHUTE;
    const length = Math.hypot(bottomZ - topZ, bottomY - topY);
    const floor = new THREE.Mesh(
      rounded(halfWidth, 0.05, length / 2, 0.04),
      plastic(0xfdf5e6, 0.3),
    );
    floor.position.set(0, (topY + bottomY) / 2 - 0.08, (topZ + bottomZ) / 2);
    floor.rotation.x = Math.atan2(topY - bottomY, bottomZ - topZ);
    floor.castShadow = true;
    floor.receiveShadow = true;
    this.scene.add(floor);
    const railMaterial = plastic(0xf25f33, 0.3);
    for (const side of [-1, 1]) {
      const rail = new THREE.Mesh(rounded(0.06, 0.26, length / 2, 0.05), railMaterial);
      rail.position.set(side * (halfWidth + 0.06), (topY + bottomY) / 2 + 0.1, (topZ + bottomZ) / 2);
      rail.rotation.x = Math.atan2(topY - bottomY, bottomZ - topZ);
      rail.castShadow = true;
      this.scene.add(rail);
    }
  }

  private trayGroup(color: Color): THREE.Group {
    const { halfWidth: hw, depth, floorThickness: ft, wallHeight: wh, sillHeight: sh, wallThickness: wt } = TRAY;
    const palette = COLORS[color];
    const group = new THREE.Group();
    const shell = new THREE.Mesh(
      mergeGeometries([
        rounded(hw, ft / 2, depth / 2, 0.05, 0, ft / 2, -depth / 2),
        rounded(wt / 2, wh / 2, depth / 2, 0.05, -hw + wt / 2, ft + wh / 2, -depth / 2),
        rounded(wt / 2, wh / 2, depth / 2, 0.05, hw - wt / 2, ft + wh / 2, -depth / 2),
        rounded(hw, wh / 2, wt / 2, 0.05, 0, ft + wh / 2, -depth + wt / 2),
        rounded(hw, sh / 2, wt / 2, 0.05, 0, ft + sh / 2, -wt / 2),
      ]),
      plastic(palette.hex, 0.3),
    );
    shell.castShadow = true;
    shell.receiveShadow = true;
    group.add(shell);
    const symbol = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.34),
      new THREE.MeshBasicMaterial({ map: symbolTexture(color), transparent: true, depthWrite: false }),
    );
    symbol.position.set(hw - 0.42, ft + wh + 0.012, -depth + wt / 2);
    symbol.rotation.x = -Math.PI / 2;
    symbol.scale.set(0.34, 0.34, 1);
    symbol.visible = false;
    group.add(symbol);
    return group;
  }

  private boxGroup(color: Color): THREE.Group {
    const { halfWidth: hw, halfDepth: hd, height: h, floorThickness: ft, wallThickness: wt } = BOX;
    const palette = COLORS[color];
    const group = new THREE.Group();
    const shell = new THREE.Mesh(
      mergeGeometries([
        rounded(hw, ft / 2, hd, 0.05, 0, ft / 2, 0),
        rounded(wt / 2, h / 2, hd, 0.05, -hw + wt / 2, h / 2, 0),
        rounded(wt / 2, h / 2, hd, 0.05, hw - wt / 2, h / 2, 0),
        rounded(hw, h / 2, wt / 2, 0.05, 0, h / 2, -hd + wt / 2),
        rounded(hw, h / 2, wt / 2, 0.05, 0, h / 2, hd - wt / 2),
      ]),
      plastic(palette.hex, 0.28),
    );
    shell.castShadow = true;
    shell.receiveShadow = true;
    group.add(shell);
    const symbol = new THREE.Mesh(
      new THREE.PlaneGeometry(0.62, 0.62),
      new THREE.MeshBasicMaterial({ map: symbolTexture(color), transparent: true, depthWrite: false, toneMapped: false }),
    );
    symbol.position.set(0, h * 0.42, hd + 0.006);
    group.add(symbol);
    const lights: THREE.Mesh[] = [];
    const lightGeometry = new THREE.SphereGeometry(0.13, 16, 10);
    for (let i = 0; i < 3; i++) {
      const light = new THREE.Mesh(lightGeometry, this.boxLightOff);
      light.position.set((i - 1) * 0.5, h + 0.03, hd - wt / 2);
      group.add(light);
      lights.push(light);
    }
    this.boxLights.push(lights);
    group.position.set(BOX.parkedX, 0, BOX.z);
    return group;
  }

  /** Builds everything that belongs to one level. */
  setMachine(machine: Machine): void {
    this.machine = machine;
    this.dynamic.clear();
    this.marbles = [];
    this.trays = new Map();
    this.boxes = [];
    this.boxLights = [];
    for (const target of this.hitTargets) this.scene.remove(target);
    this.hitTargets.length = 0;

    for (const id of machine.marbleIds) {
      const color = machine.marbleColor(id);
      const mesh = new THREE.Mesh(this.marbleGeometry, this.shellMaterial(color));
      mesh.castShadow = true;
      mesh.receiveShadow = false;
      const twist = new THREE.Mesh(this.twistGeometry, this.twistMaterialFor(color));
      twist.visible = this.clearGlass;
      mesh.add(twist);
      const pose: Pose = { x: 0, y: 0, z: 0, qx: 0, qy: 0, qz: 0, qw: 1 };
      machine.readMarble(id, pose);
      this.marbles.push({ id, color, mesh, twist, previous: { ...pose }, current: { ...pose } });
      this.dynamic.add(mesh);
    }

    for (const tray of machine.readTrays()) {
      const group = this.trayGroup(tray.color);
      this.trays.set(tray.key, { group });
      this.dynamic.add(group);
    }

    for (const color of machine.board.boxes) {
      const group = this.boxGroup(color);
      this.boxes.push(group);
      this.dynamic.add(group);
    }

    const count = machine.board.supplies.length;
    for (let supply = 0; supply < count; supply++) {
      const target = new THREE.Mesh(
        new THREE.BoxGeometry(count === 3 ? 3.7 : 4.6, 7, 6.5),
        new THREE.MeshBasicMaterial({ visible: false }),
      );
      target.position.set(supplyX(supply, count), TRAY.frontY + 1.8, TRAY.frontZ - 1.6);
      target.userData['supply'] = supply;
      this.scene.add(target);
      this.hitTargets.push(target);
    }
    this.syncAfterJump();
  }

  private shellMaterial(color: Color): THREE.MeshPhysicalMaterial {
    const cache = this.clearGlass ? this.glassMaterials : this.solidMaterials;
    let material = cache.get(color);
    if (!material) {
      material = this.clearGlass ? glassMaterial(color) : marbleMaterial(color);
      cache.set(color, material);
    }
    return material;
  }

  private twistMaterialFor(color: Color): THREE.MeshStandardMaterial {
    let material = this.twistMaterials.get(color);
    if (!material) {
      material = twistMaterial(color);
      this.twistMaterials.set(color, material);
    }
    return material;
  }

  /** Steps down when frames take too long. Returns false once there's nothing left to give up. */
  lowerQuality(): boolean {
    if (this.renderer.getPixelRatio() > 1) {
      this.renderer.setPixelRatio(1);
      this.resize();
      return true;
    }
    if (this.clearGlass) {
      this.clearGlass = false;
      for (const marble of this.marbles) {
        marble.mesh.material = this.shellMaterial(marble.color);
        marble.twist.visible = false;
      }
      return true;
    }
    return false;
  }

  /** Call after each physics tick, so drawing can blend between the last two states. */
  afterTick(): void {
    const machine = this.machine;
    if (!machine) return;
    for (const marble of this.marbles) {
      const swap = marble.previous;
      marble.previous = marble.current;
      marble.current = swap;
      machine.readMarble(marble.id, marble.current);
    }
  }

  /** Undo and restart jump the world, so blending across the jump would look wrong. */
  syncAfterJump(): void {
    const machine = this.machine;
    if (!machine) return;
    for (const marble of this.marbles) {
      machine.readMarble(marble.id, marble.current);
      Object.assign(marble.previous, marble.current);
    }
  }

  private readonly tempA = new THREE.Quaternion();
  private readonly tempB = new THREE.Quaternion();

  render(alpha: number, deltaSeconds: number): void {
    const machine = this.machine;
    if (!machine) return;

    for (const marble of this.marbles) {
      const { previous: p, current: c, mesh } = marble;
      mesh.position.set(p.x + (c.x - p.x) * alpha, p.y + (c.y - p.y) * alpha, p.z + (c.z - p.z) * alpha);
      this.tempA.set(p.qx, p.qy, p.qz, p.qw);
      this.tempB.set(c.qx, c.qy, c.qz, c.qw);
      mesh.quaternion.slerpQuaternions(this.tempA, this.tempB, alpha);
    }

    for (const tray of machine.readTrays()) {
      const visual = this.trays.get(tray.key);
      if (!visual) continue;
      visual.group.visible = tray.visible;
      visual.group.position.set(tray.x, tray.y, tray.z);
      visual.group.rotation.x = tray.angle;
    }

    this.boxes.forEach((group, index) => {
      const x = machine.readBoxX(index);
      group.position.x = x;
      group.visible = Math.abs(x) < 14;
    });

    for (let i = 0; i < RIB_COUNT; i++) {
      const p = trackPoint((i / RIB_COUNT) * TRACK_LENGTH + machine.beltDistance);
      this.ribDummy.position.set(p.x, RACEWAY.floorY + 0.014, p.z);
      this.ribDummy.rotation.y = Math.atan2(-p.tz, p.tx);
      this.ribDummy.updateMatrix();
      this.ribs.setMatrixAt(i, this.ribDummy.matrix);
    }
    this.ribs.instanceMatrix.needsUpdate = true;

    const occupancy = machine.rules.occupancy;
    const jammed = machine.rules.status === 'jammed';
    this.leds.forEach((led, i) => {
      led.material = i < occupancy ? (jammed ? this.ledAlarm : this.ledOn) : this.ledOff;
    });

    const active = machine.rules.activeColor;
    this.lamp.visible = active !== null;
    if (active) {
      this.lampMaterial.color.setHex(COLORS[active].hex);
      this.lampMaterial.emissive.setHex(COLORS[active].hex);
    }
    if (active) this.gatePadMaterial.color.setHex(COLORS[active].hex);
    this.gatePad.visible = active !== null;
    this.boxLights.forEach((lights, index) => {
      const fill = machine.boxFill(index);
      lights.forEach((light, i) => {
        light.material = i < fill ? this.boxLightOn : this.boxLightOff;
      });
    });
    this.door.visible = !machine.doorIsOpen;
    this.kicker.rotation.y = -machine.paddle * 0.9 - 0.25;
    this.kicker.scale.z = 1 + machine.paddle * 0.3;

    this.renderer.render(this.scene, this.camera);
  }

  /** Which supply a tap landed on, if any. Coordinates are CSS pixels within the canvas. */
  pick(x: number, y: number): number | null {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const ndc = new THREE.Vector2(((x - rect.left) / rect.width) * 2 - 1, -((y - rect.top) / rect.height) * 2 + 1);
    this.raycaster.setFromCamera(ndc, this.camera);
    const hit = this.raycaster.intersectObjects(this.hitTargets, false)[0];
    if (!hit) return null;
    const supply: unknown = hit.object.userData['supply'];
    return typeof supply === 'number' ? supply : null;
  }

  /** A world point in CSS pixels, so the page can place things over the 3D view. */
  toScreen(x: number, y: number, z: number): { x: number; y: number } {
    const v = new THREE.Vector3(x, y, z).project(this.camera);
    const rect = this.renderer.domElement.getBoundingClientRect();
    return { x: rect.left + ((v.x + 1) / 2) * rect.width, y: rect.top + ((1 - v.y) / 2) * rect.height };
  }

  resize(): void {
    const element = this.renderer.domElement;
    const width = element.clientWidth || window.innerWidth;
    const height = element.clientHeight || window.innerHeight;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;

    // Back the camera off until the whole machine fits this window.
    const fovV = THREE.MathUtils.degToRad(this.camera.fov);
    const tanV = Math.tan(fovV / 2);
    const tanH = tanV * this.camera.aspect;
    const distanceForWidth = FRAME.halfWidth / tanH;
    const distanceForHeight = (FRAME.top - FRAME.bottom) / 2 / tanV;
    const distance = Math.max(distanceForWidth, distanceForHeight) * 1.04;
    this.camera.position.copy(CAMERA_TARGET).addScaledVector(CAMERA_DIRECTION, distance);
    this.camera.lookAt(CAMERA_TARGET);
    this.camera.updateProjectionMatrix();
  }
}
