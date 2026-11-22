import { WinWave } from './win-wave';
import * as THREE from 'three';
import { jamShutter } from './dispatch-plate';
import { RIM_CLEARANCE } from '../engine/rack-flight';
import { bakeOcclusion } from '../engine/candy';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Sparks } from '../engine/sparks';
import { Spring } from '../engine/arrival';
import { workshopGlass } from '../engine/glass';
import { COLORS, containerSymbolTexture } from './art';
import { ARCADE, ArcadeYard, bodyPlastic, fuse, tinted } from './arcade';
import type { Color } from '../sim/types';
import { FIXED_SECONDS } from '../engine/physics';
import { BoardView } from '../engine/board-view';
import type { GameServices, ScreenPoint } from '../engine/contracts';
import type { Point3 } from '../engine/physics';
import { toyBox, toyMaterial } from '../engine/toy';
import { completedTube, tubeContainer } from '../puzzles/rules';
import { tubeRack } from '../puzzles/tube-rack';
import { homePlaques } from '../puzzles/home-plaques';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import type { TubeDef, TubeMoveResult, TubeState } from '../puzzles/types';

const RADIUS = 0.49;
const STEP = 1.02;
/** The marbles of a group leave this many seconds apart, the top one first. */
const GROUP_STAGGER = 0.045;
/** A landing presses the whole column together by about a tenth of each marble's height; it springs back taller once and rests. */
const PRESS_KICK = 6.5;
const HOP_SECONDS = 0.3;
/** What a tube shows when marbles reach it: `seat` for the first to touch down, `complete` when the last one finishes the tube. */
export type TubeLanding = 'seat' | 'complete';

export class TubeView extends BoardView {
  private readonly selectors: THREE.Mesh[] = [];
  private readonly jamStops: THREE.Mesh[] = [];
  private readonly lights: THREE.Mesh[] = [];
  private readonly rims: THREE.Mesh[] = [];
  private readonly badges: THREE.Mesh[][] = [];
  private readonly badgeMaterials = new Map<Color, THREE.MeshBasicMaterial>();
  private readonly caps = new Map<number, { mesh: THREE.Group; y: number; progress: number; open: boolean }>();
  private readonly cups = new Map<number, { parts: { mesh: THREE.Object3D; y: number }[]; lid: THREE.Mesh; height: number; progress: number; spent: boolean }>();
  private readonly reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  private readonly pulses: number[] = [];
  private celebrating = false;
  private readonly wave = new WinWave();
  /** Finished tubes whose whole column is hopping once, together, so no marble meets its neighbour. */
  private hops: { tube: number; age: number }[] = [];
  /** Each tube's column of marbles is one spring: a landing presses it together. */
  private readonly presses: Spring[] = [];
  private readonly pressed: boolean[] = [];
  /** Groups still in the air: how many of each have yet to touch down, and what the last one sets off. */
  private readonly arrivals = new Map<number, { left: number; readonly count: number; readonly completed: boolean; readonly color: Color }>();
  /** How each marble of the group now moving flies: when it leaves, what it has to clear and whether it rebounds. */
  private readonly flights = new Map<string, { delay: number; duration?: number; clear: number; bounce: number }>();
  private landings: TubeLanding[] = [];
  /** Home plaques name the colour a taller or shorter home is for; each pulses when that colour fills the wrong tube. */
  private readonly plaques: { group: THREE.Group; color: Color; pulse: number }[] = [];
  private readonly sparks: Sparks;
  private readonly yard: ArcadeYard;
  private readonly rack: ReturnType<typeof tubeRack>;
  private selected = -1;
  private readonly lift: number[] = [];
  private readonly groupStart: number[] = [];
  private readonly rimHeight: number[] = [];
  private identities: string[][] = [];
  private nextIdentity = 0;
  private dragging: string[] = [];
  private dragOrigin = new THREE.Vector3();
  private dragStart: THREE.Vector3[] = [];
  private dragClearance = 0;
  private readonly dragPlane = new THREE.Plane();
  private readonly dragRay = new THREE.Raycaster();

  constructor(services: GameServices, readonly definition: TubeDef, state: TubeState) {
    // Low enough that each marble in a stack shows about two thirds of itself above the one in front.
    super(services, 1.15);
    this.sparks = new Sparks(this.scene, 1.7);
    for (const color of Object.keys(COLORS) as Color[]) this.badgeMaterials.set(color,
      new THREE.MeshBasicMaterial({ map: containerSymbolTexture(color), transparent: true, depthWrite: false, toneMapped: false }));
    this.rack = tubeRack(definition);
    const { halfWidth, back, front } = this.rack;
    // Enamel shoes sit on the quay. Row ties and one central keel join them into the authored rack.
    const parts = definition.tubes.flatMap((_, index) => {
      const at = this.position(index, 0);
      const wide = tubeContainer(definition, index).role === 'cup';
      const foot = wide ? 1.18 : .99;
      const heel = new THREE.LatheGeometry([[foot*.84,.18],[foot,.25],[foot+.025,.33],[foot+.025,.40],[foot*.94,.46],[foot*.91,.53]].map(([r,y]) => new THREE.Vector2(r,y)), 32);
      const moulding = new THREE.TorusGeometry(foot-.055, .045, 5, 32).rotateX(Math.PI/2);
      const railX = wide ? 1.17 : .94;
      const railFoot = new RoundedBoxGeometry(.48,.42,.81,2,.10);
      return [
        tinted(heel.translate(at.x,0,at.z), ARCADE.shell),
        tinted(moulding.translate(at.x,.43,at.z), ARCADE.trim),
        tinted(railFoot.translate(at.x+railX,.39,at.z), ARCADE.edge),
      ];
    });
    const rows = new Map<number, number[]>();
    for (const { x, z } of this.rack.places) {
      const row = rows.get(z) ?? [];
      row.push(x);
      rows.set(z, row);
    }
    for (const [z, xs] of rows) {
      if (xs.length < 2) continue;
      const left = Math.min(...xs), right = Math.max(...xs), mid = (left + right) / 2;
      parts.push(tinted(new RoundedBoxGeometry(right-left,.25,.38,2,.065).translate(mid,.31,z), ARCADE.deck));
      parts.push(tinted(new RoundedBoxGeometry(right-left,.045,.135,2,.02).translate(mid,.444,z), ARCADE.trim));
    }
    const rowCenters = [...rows.keys()];
    if (rowCenters.length > 1) {
      const rear = Math.min(...rowCenters), nose = Math.max(...rowCenters);
      parts.push(tinted(new RoundedBoxGeometry(.34,.19,nose-rear,2,.055)
        .translate(0,.277,(rear+nose)/2), ARCADE.deck));
      parts.push(tinted(new RoundedBoxGeometry(.12,.026,nose-rear,2,.012)
        .translate(0,.382,(rear+nose)/2), ARCADE.trim));
    }
    const plinth = new THREE.Mesh(fuse(parts), bodyPlastic());
    plinth.castShadow = true;
    plinth.receiveShadow = true;
    this.board.add(plinth);
    bakeOcclusion(services.stage.renderer, [plinth], { minX: -halfWidth - .5, maxX: halfWidth + .5, minZ: back - .4, maxZ: front + .4 });
    // The scene owns the worktop and the landscape beyond it.
    this.yard = new ArcadeYard(this.scene, halfWidth, back, front, .185);
    const glass = workshopGlass(new THREE.MeshStandardMaterial({ color: 0xe4f5ff, transparent: true,
      opacity: 0.2, roughness: 0.08, depthWrite: false, envMapIntensity: 1.5 }));
    const plaques = homePlaques(definition);
    const plaqueSize = (index: number): number => plaques[index]?.length ?? 0;
    const plaqueMaterials = definition.tubes.some((_, index) => plaqueSize(index) > 0) ? { frame: toyMaterial(0xfff7e5), plate: toyMaterial(0x3b4069) } : null;
    definition.tubes.forEach((_, index) => {
      const at = this.position(index, 0);
      const container = tubeContainer(definition, index);
      const height = container.capacity * STEP + 0.2;
      const isCup = container.role === 'cup';
      const railX = at.x + (isCup ? 1.17 : 0.94);
      // A slate backing separates white cargo from the pale deck and from unfilled slots.
      const backing = toyBox(isCup ? 1.72 : 1.28, height, 0.1, ARCADE.edge, 0.05);
      backing.position.set(at.x, 0.7 + height / 2, at.z - 0.64);
      this.board.add(backing);
      const tubeGeometry = isCup
        ? new THREE.LatheGeometry(Array.from({ length: 9 }, (_, i) => new THREE.Vector2(i % 2 ? 0.74 : 0.9, (i / 8 - 0.5) * height)), 32)
        : new THREE.CylinderGeometry(0.67, 0.67, height, 32, 1, true);
      const tube = glass.mesh(tubeGeometry);
      tube.position.set(at.x, 0.7 + height / 2, at.z);
      this.board.add(tube);
      const rim = new THREE.Mesh(new THREE.TorusGeometry(isCup ? 0.9 : 0.67, 0.07, 10, 32), toyMaterial(0xe7f4f2));
      rim.rotation.x = Math.PI / 2;
      rim.position.set(at.x, 0.7 + height, at.z);
      this.board.add(rim);
      this.rims.push(rim);
      this.rimHeight.push(rim.position.y);
      this.lift.push(0);
      this.pulses.push(0);
      this.presses.push(new Spring(6, 0.34));
      this.pressed.push(false);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(isCup ? 1.01 : 0.85, isCup ? 1.09 : 0.92, 0.25, 32), toyMaterial(ARCADE.deck));
      base.position.set(at.x, 0.64, at.z);
      this.selectors.push(base);
      const stop = jamShutter(at.x,.51,at.z+.82,1.24);
      this.jamStops.push(stop); this.board.add(stop);
      this.board.add(base);
      const light = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 8), toyMaterial(0x938976));
      light.position.set(at.x, 0.67, at.z + .81);
      this.lights.push(light);
      this.board.add(light);
      const rail = toyBox(0.46, height, 0.1, ARCADE.lane, 0.04);
      rail.position.set(railX, 0.7 + height / 2, at.z);
      this.board.add(rail);
      const badges = Array.from({ length: container.capacity }, (_, slot) => {
        const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.44, 0.44), this.badgeMaterials.get('red')!);
        badge.position.set(railX, this.position(index, slot).y, at.z + 0.16);
        badge.rotation.x = -Math.atan2(1.35, 0.65);
        this.board.add(badge);
        return badge;
      });
      this.badges.push(badges);
      // A home sized for one colour carries that colour's pattern above its rail, so four reds in a short tube are not mistaken for done.
      if (plaqueMaterials) plaques[index]?.forEach((color, stack) => {
        const group = new THREE.Group();
        const frame = new THREE.Mesh(new RoundedBoxGeometry(0.74, 0.74, 0.08, 3, 0.08), plaqueMaterials.frame);
        frame.position.z = -0.03;
        const plate = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.62, 0.12, 3, 0.06), plaqueMaterials.plate);
        const mark = new THREE.Mesh(new THREE.PlaneGeometry(0.54, 0.54), this.badgeMaterials.get(color)!);
        // The mark lies on the plate's face and the whole plaque leans toward the camera; a tilted mark alone sank into the plate.
        mark.position.z = 0.07;
        group.add(frame, plate, mark);
        group.rotation.x = -Math.atan2(1.35, 0.65);
        group.position.set(railX, 0.7 + height + 0.45 + stack * 0.7, at.z);
        this.board.add(group);
        this.plaques.push({ group, color, pulse: 0 });
      });
      if (isCup) {
        const ribParts = [0.25, 0.5, 0.75].map((fraction) => {
          const geometry = new THREE.TorusGeometry(0.9, 0.045, 6, 32);
          geometry.rotateX(Math.PI / 2);
          geometry.translate(0, (fraction - 0.5) * height, 0);
          return geometry;
        });
        const ribGeometry = mergeGeometries(ribParts);
        ribParts.forEach((geometry) => geometry.dispose());
        if (!ribGeometry) throw new Error('Cup rib geometries do not match');
        const ribs = new THREE.Mesh(ribGeometry, toyMaterial(0xe1d9bd));
        ribs.position.copy(tube.position);
        this.board.add(ribs);
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.88, 0.08, 32), toyMaterial(0xe1d9bd));
        lid.position.set(at.x, 0.7 + height, at.z);
        lid.visible = false;
        this.board.add(lid);
        this.cups.set(index, { parts: [backing, tube, rail, rim, ribs].map((mesh) => ({ mesh, y: mesh.position.y })), lid, height, progress: 0, spent: false });
      }
      if (container.role === 'capped') {
        const color = container.opensOn;
        const badge = new THREE.Mesh(new THREE.PlaneGeometry(0.94, 0.94), this.badgeMaterials.get(color)!);
        badge.rotation.x = -Math.atan2(1.35, 0.65);
        const cap = new THREE.Group();
        const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.79, 0.79, 0.2, 32), toyMaterial(0x3b4069));
        cap.add(lid);
        badge.position.set(0, 0.21, 0.12);
        cap.add(badge);
        cap.position.set(at.x, 0.7 + height + 0.22, at.z);
        this.board.add(cap);
        this.caps.set(index, { mesh: cap, y: cap.position.y, progress: 0, open: false });
      }
    });
    // Fit tubes, pattern rails and labels; the decorative plinth can extend toward the screen edges.
    this.framing = definition.tubes.flatMap((_, index) => {
      const at = this.position(index, 0);
      const points: Point3[] = [];
      for (const x of [at.x - (tubeContainer(definition, index).role === 'cup' ? 1.12 : 0.95), at.x + (tubeContainer(definition, index).role === 'cup' ? 1.45 : 1.2)]) for (const y of [0.5, 0.7 + tubeContainer(definition, index).capacity * STEP + (tubeContainer(definition, index).role === 'capped' ? 1.2 : 0.8) + (plaqueSize(index) ? 0.85 + (plaqueSize(index) - 1) * 0.7 : 0)]) {
        for (const z of [at.z - 0.95, at.z + 1.75]) points.push({ x, y, z });
      }
      return points;
    });
    this.rebuild(state);
    this.resize();
  }

  private position(tube: number, slot: number): Point3 {
    const { x, z } = this.rack.places[tube]!;
    return { x, y: 1.25 + slot * STEP, z };
  }

  rebuild(state: TubeState): void {
    this.cancelMotion();
    this.sparks.clear();
    this.pulses.fill(0);
    this.celebrating = false;
    this.wave.clear();
    this.hops = [];
    this.arrivals.clear();
    this.flights.clear();
    this.lift.fill(0);
    this.landings = [];
    this.presses.forEach((press, index) => { press.reset(); this.pressed[index] = false; });
    for (const plaque of this.plaques) { plaque.pulse = 0; plaque.group.scale.setScalar(1); }
    this.identities = state.tubes.map((tube) => tube.map(() => String(this.nextIdentity++)));
    for (const [index, cap] of this.caps) { cap.progress = state.opened[index] ? 1 : 0; }
    for (const [index, cup] of this.cups) { cup.progress = state.spent[index] ? 1 : 0; }
    this.layout(state);
    this.glow(state);
    this.commitmentPose(0);
  }

  /** A tube holding one colour and one marble short of full gets the steady glow: it is about to finish. */
  private glow(state: TubeState): void {
    state.tubes.forEach((tube, index) => {
      if (index >= 8) return;
      const capacity = tubeContainer(this.definition, index).capacity;
      const near = tube.length > 0 && tube.length === capacity - 1 && tube.every((color) => color === tube[0]);
      this.sparks.halo(index, near ? this.position(index, (capacity - 1) / 2) : null);
    });
  }

  private layout(state: TubeState, animate = false): void {
    this.clearActors();
    this.syncMarbles(state.tubes.flatMap((tube, index) => tube.flatMap((color, slot) => {
      const id = this.identities[index]?.[slot];
      return id === undefined ? [] : [{ id, color, radius: RADIUS, at: this.position(index, slot), ...this.flights.get(id) }];
    })), animate);
    state.tubes.forEach((tube, index) => {
      let first = tube.length;
      while (first > 0 && tube[first-1] === tube.at(-1)) first--;
      this.groupStart[index] = first;
      this.jamStops[index]!.visible = state.status === 'jammed' && !!tube.length;
      const at = this.position(index, 1.5);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(tubeContainer(this.definition, index).role === 'cup' ? 2.3 : 1.9, tubeContainer(this.definition, index).capacity * STEP + 1.2, 1.9), new THREE.MeshBasicMaterial({ visible: false }));
      hit.position.set(at.x, 0.7 + tubeContainer(this.definition, index).capacity * STEP / 2, at.z);
      this.actors.add(hit);
      this.hit(hit, `tube${index}`, { ...at, y: 0.7 + tubeContainer(this.definition, index).capacity * STEP / 2 });
      this.badges[index]?.forEach((badge, slot) => {
        const color = tube[slot];
        badge.visible = color !== undefined;
        if (color) badge.material = this.badgeMaterials.get(color)!;
      });
      const rim = this.rims[index];
      if (rim?.material instanceof THREE.MeshStandardMaterial) {
        rim.userData['restColor'] = tube.at(-1) ? COLORS[tube.at(-1)!].hex : 0xe7f4f2;
      }
      const complete = completedTube(this.definition, state, index);
      const light = this.lights[index];
      if (light?.material instanceof THREE.MeshStandardMaterial) {
        light.material.color.setHex(complete ? 0x30dfa5 : 0x938976);
        light.material.emissive.setHex(complete ? 0x16b36b : 0);
      }
    });
    for (const [index, cap] of this.caps) {
      if (animate && state.opened[index] && !cap.open) this.sparks.burst(cap.mesh.position, 0xffefb8, 8);
      cap.open = Boolean(state.opened[index]);
    }
    for (const [index, cup] of this.cups) cup.spent = Boolean(state.spent[index]);
    this.commitmentPose(0);
    this.select(this.selected);
  }

  select(index: number): void {
    this.selected = index;
    this.rims.forEach((rim, slot) => {
      if (rim.material instanceof THREE.MeshStandardMaterial) {
        rim.material.color.setHex(slot === index ? 0xe0bb78 : rim.userData['restColor'] ?? 0xe7f4f2);
      }
    });
    this.selectors.forEach((mesh, i) => {
      mesh.scale.setScalar(1);
      if (mesh.material instanceof THREE.MeshStandardMaterial) {
        mesh.material.color.setHex(ARCADE.deck);
        mesh.material.emissive.setHex(i === index ? 0x18120c : 0);
      }
    });
  }

  private pointOnPlane(point: ScreenPoint): THREE.Vector3 {
    const rect = this.services.stage.rect;
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
    this.dragClearance = Math.max(...this.rims.map(rim => rim.position.y + .9),
      ...this.plaques.map(plaque => plaque.group.position.y + 1.2));
    const anchor = this.dragStart.at(-1) ?? new THREE.Vector3();
    this.dragPlane.setFromNormalAndCoplanarPoint(this.camera.getWorldDirection(new THREE.Vector3()), anchor);
    this.dragOrigin = this.pointOnPlane(point);
    this.select(index);
  }

  moveDrag(point: ScreenPoint, highlight: number): void {
    const offset = this.pointOnPlane(point).sub(this.dragOrigin);
    // Pull the group along its sightline until its lowest marble clears the rack. Its projection
    // stays underneath the finger while it passes over full tubes, rails and home plaques.
    const low = this.dragStart[0]?.clone().add(offset);
    if (low && low.y < this.dragClearance) {
      const towardEye = this.camera.position.clone().sub(low);
      offset.addScaledVector(towardEye, (this.dragClearance - low.y) / towardEye.y);
    }
    this.dragging.forEach((id, index) => {
      const start = this.dragStart[index];
      if (start) this.placeMarble(id, start.clone().add(offset));
    });
    this.select(highlight);
  }

  endDrag(): Point3[] {
    const positions = this.dragging.flatMap((id) => { const at = this.marblePosition(id); return at ? [at] : []; });
    this.dragging.forEach((id) => this.restoreMarble(id));
    this.dragging = [];
    this.dragStart = [];
    return positions;
  }

  private commitmentPose(delta: number): void {
    for (const cap of this.caps.values()) {
      cap.progress = cap.open ? Math.min(1, cap.progress + delta * 3.5) : 0;
      if (this.reducedMotion && cap.open) cap.progress = 1;
      const lift = 1 - (1 - cap.progress) ** 3;
      cap.mesh.position.y = cap.y + lift * 1.4;
      cap.mesh.rotation.z = cap.progress * -0.85;
      cap.mesh.scale.setScalar(1 - cap.progress * 0.7);
      cap.mesh.visible = cap.progress < 1;
    }
    for (const cup of this.cups.values()) {
      cup.progress = cup.spent ? Math.min(1, cup.progress + delta * 3.5) : 0;
      if (this.reducedMotion && cup.spent) cup.progress = 1;
      const fold = 0.06 + 0.94 * (1 - cup.progress) ** 3;
      cup.lid.position.y = 0.7 + cup.height * fold;
      cup.lid.visible = cup.progress > 0.4;
      for (const { mesh, y } of cup.parts) {
        mesh.position.y = 0.7 + (y - 0.7) * fold;
        // The rim stays round as the walls concertina down to the base.
        if (!(mesh instanceof THREE.Mesh && this.rims.includes(mesh))) mesh.scale.y = fold;
      }
    }
  }

  /** Nothing on the board would move if it were drawn again. */
  get still(): boolean {
    return this.lift.every((amount, i) => amount === this.targetLift(i)) && !this.busy && !this.sparks.active && !this.shake.active && !this.hops.length && this.presses.every((press) => press.resting) && !this.wave.active && this.pulses.every((pulse) => pulse === 0) && this.plaques.every((plaque) => plaque.pulse === 0)
      && [...this.caps.values()].every((cap) => cap.progress === (cap.open ? 1 : 0))
      && [...this.cups.values()].every((cup) => cup.progress === (cup.spent ? 1 : 0));
  }

  private targetLift(index: number): number {
    return this.selected === index && !this.dragging.length && this.identities[index]?.length ? .79 : 0;
  }

  override step(): void {
    super.step();
    if (this.weight === 1) for (const at of this.flying) this.sparks.trail(at, 0xffe2ab, .065, .105);
    const lifts = new Map<number, number>();
    this.hops = this.hops.filter((hop) => {
      hop.age += FIXED_SECONDS;
      const t = Math.min(1, hop.age / HOP_SECONDS);
      lifts.set(hop.tube, Math.sin(t * Math.PI) * 0.3);
      return t < 1;
    });
    this.presses.forEach((press, tube) => {
      // Marbles rest on one another, so pressing each one flatter lowers every marble above it by what lies beneath.
      const tall = 1 + Math.max(-0.16, Math.min(0.1, press.step(FIXED_SECONDS)));
      const lift = lifts.get(tube);
      const bow = this.wave.pulse(tube);
      const target = this.targetLift(tube), previous = this.lift[tube]!;
      const offset = this.reducedMotion || Math.abs(target-previous)<.004 ? target : previous + (target-previous)*.30;
      this.lift[tube] = offset;
      const moving = bow > 0 || tall !== 1 || lift !== undefined || offset !== 0 || previous !== offset;
      if (!moving && !this.pressed[tube]) return;
      this.pressed[tube] = moving;
      (this.identities[tube] ?? []).forEach((id, slot) => {
        if (!this.dragging.includes(id)) this.squeeze(id, bow * .55 + (lift ?? 0) + (slot >= this.groupStart[tube]! ? offset : 0) - (2 * slot + 1) * RADIUS * (1 - tall), tall);
      });
    });
    if (!this.celebrating) this.sparks.step(FIXED_SECONDS);
    // The water drifts only on ticks the board is already moving for.
    this.yard.step(FIXED_SECONDS);
    this.commitmentPose(FIXED_SECONDS);
    this.rims.forEach((rim, index) => {
      const pulse = Math.max(0, (this.pulses[index] ?? 0) - FIXED_SECONDS * 3);
      this.pulses[index] = pulse;
      if (!this.cups.has(index)) rim.position.y = this.rimHeight[index]! + this.lift[index]! * .20;
      rim.scale.setScalar(1 + Math.sin(pulse * Math.PI) * .14 + this.lift[index]! * .075 + this.wave.pulse(index) * .085);
    });
    for (const plaque of this.plaques) {
      plaque.pulse = Math.max(0, plaque.pulse - FIXED_SECONDS / 0.45);
      plaque.group.scale.setScalar(1 + Math.sin(plaque.pulse * Math.PI) * 0.3);
    }
  }

  /** What reached its tube since this was last asked: the sounds follow contact, never the accepted move. */
  takeLandings(): readonly TubeLanding[] {
    if (!this.landings.length) return this.landings;
    const landed = this.landings;
    this.landings = [];
    return landed;
  }

  /** A marble has touched down. The column gives under it; the first of a group wakes the rim, the last sets off what the move earned. */
  protected override contact(id: string, at: Point3): void {
    const tube = this.identities.findIndex((ids) => ids.includes(id));
    if (tube < 0) return;
    if (!this.reducedMotion) this.presses[tube]?.kick(-PRESS_KICK * this.weight);
    const arrival = this.arrivals.get(tube);
    if (!arrival) return;
    if (arrival.left === arrival.count) {
      this.landings.push('seat');
      this.pulses[tube] = this.reducedMotion ? 0 : 1;
    }
    if (--arrival.left > 0) return;
    this.arrivals.delete(tube);
    // Held fast forward keeps the payoff and drops the small glint.
    if (this.weight === 1) this.sparks.land({ ...at, y: at.y + 0.3 }, COLORS[arrival.color].hex);
    if (!arrival.completed) return;
    this.wave.last = tube;
    this.landings.push('complete');
    const top = this.position(tube, tubeContainer(this.definition, tube).capacity - 1);
    if (this.sparks.payoff({ ...top, y: top.y + 0.5 }, COLORS[arrival.color].hex) === 2 && this.weight === 1) this.shake.kick();
    if (!this.reducedMotion) this.hops.push({ tube, age: 0 });
  }

  celebrate(clean = 1): void {
    this.celebrating = true;
    const pieces = this.identities.flatMap((ids, index) => ids.length ? [{
      index, at: this.position(index, ids.length - 1), tint: Number(this.rims[index]!.userData['restColor']),
    }] : []);
    this.wave.start(pieces, this.yard.corners, this.camera, this.sparks, clean, this.reducedMotion);
  }

  advanceCelebration(seconds: number): void {
    this.wave.step(seconds, this.sparks);
    this.sparks.step(seconds);
  }

  finishCelebration(): void {
    this.wave.clear();
    this.sparks.clear();
    // The footer can arrive between fixed ticks while a column is still drawn in its bow.
    this.identities.forEach((ids, tube) => {
      for (const id of ids) this.squeeze(id, 0);
      this.rims[tube]!.scale.setScalar(1);
    });
  }

  override dispose(): void {
    this.sparks.dispose();
    this.yard.dispose();
    super.dispose();
    for (const material of this.badgeMaterials.values()) {
      material.map?.dispose();
      material.dispose();
    }
  }

  moved(result: Extract<TubeMoveResult, { ok: true }>, state: TubeState, starts?: readonly Point3[]): void {
    const moved = this.identities[result.from]?.splice(result.fromSlot, result.count) ?? [];
    const origins = starts?.slice(-result.count);
    moved.forEach((id, offset) => { const at = origins?.[offset]; if (at) this.placeMarble(id, at); });
    // A group is one colour, so which marble takes which place is free: the top one leaves first and lands deepest,
    // and no marble has to pass through another on the way out or on the way in.
    moved.reverse();
    this.identities[result.to]?.push(...moved);
    const source = this.rack.places[result.from]!, destination = this.rack.places[result.to]!;
    const dx = destination.x - source.x, dz = destination.z - source.z;
    let clearance = 0;
    for (const [i, at] of this.rack.places.entries()) {
      // Include the rim, the right-hand pattern rail, and the marble's stretched radius.
      const t = Math.min(1, Math.max(0, ((at.x - source.x) * dx + (at.z - source.z) * dz) / (dx * dx + dz * dz)));
      if (Math.hypot(source.x + dx * t - at.x, source.z + dz * t - at.z) > 2.25) continue;
      clearance = Math.max(clearance, this.rims[i]!.position.y + RIM_CLEARANCE);
      for (const plaque of this.plaques) {
        if (plaque.group.position.z === at.z && Math.abs(plaque.group.position.x - at.x) < 1.5) {
          clearance = Math.max(clearance, plaque.group.position.y + 1.2);
        }
      }
    }
    moved.forEach((id, order) => {
      this.flights.set(id, { delay: order * GROUP_STAGGER, ...(origins?.length ? { duration: .185 } : {}),
        clear: clearance, bounce: order === moved.length - 1 ? 1 : 0 });
    });
    this.lift[result.from] = 0;
    this.layout(state, true);
    this.flights.clear();
    this.arrivals.delete(result.from);
    this.arrivals.set(result.to, { left: result.count, count: result.count, completed: result.completedTube, color: result.color });
    this.glow(state);
    // Flecks where the group lifts off; everything the landing earns waits for contact.
    const lifted = origins?.[origins.length - 1] ?? this.position(result.from, result.fromSlot + result.count - 1);
    this.sparks.tap(lifted);
    // Full of one colour that belongs in another home: point at that home, without a sound or a word, since the move was legal.
    const tube = state.tubes[result.to]!;
    const container = tubeContainer(this.definition, result.to);
    if (!result.completedTube && !this.reducedMotion && tube.length === container.capacity && tube.every((color) => color === tube[0])) {
      for (const plaque of this.plaques) if (plaque.color === tube[0]) plaque.pulse = 1;
    }
  }
}
