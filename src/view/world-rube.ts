import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { WorldAssets } from './world-assets';
import { createRubePose, createRubeSample, RUBE_RADIUS, RubeRoute, rubePose, type RubePiece } from '../world/rube-sequence';

const BUCKET_FLOOR_RADIUS = 0.36;

/** A single authored route owns the swept channel, its cargo, and every driven contact. */
export class WorldRube {
  readonly route: RubeRoute;
  readonly groups: readonly THREE.Group[];
  readonly triangles: number;
  private readonly geometries = new Set<THREE.BufferGeometry>();
  private readonly fixed: THREE.Group[];
  private readonly sampleState = createRubeSample();
  private readonly pose = createRubePose();
  private readonly movers = new Map<string, THREE.Group>();
  private readonly cups: THREE.Group[] = [];
  constructor(anchors: readonly THREE.Vector3[], private readonly assets: Pick<WorldAssets, 'model'>, private readonly material: THREE.Material) {
    this.route = new RubeRoute(anchors);
    this.groups = anchors.map((anchor, index) => { const group = new THREE.Group(); group.name = `rube-stop-${index}`; group.position.copy(anchor); return group; });
    this.fixed = anchors.map((_, index) => { const group = new THREE.Group(); this.groups[index]!.add(group); return group; });
    for (const piece of this.route.pieces) if (piece.track) this.channel(piece);
    this.release(); this.spiral(); this.loops(); this.top(); this.catapult(); this.bucket(); this.zigzag(); this.funnel(); this.bell();
    this.fixed.forEach(group => this.merge(group));
    const wheel = this.movers.get('rube-bucket-wheel')!;
    this.cups.forEach(cup => cup.removeFromParent());
    this.movers.forEach(group => this.merge(group));
    this.cups.forEach(cup => { this.merge(cup); wheel.add(cup); });
    let triangles = 0;
    this.groups.forEach(group => group.traverse(object => { if (object instanceof THREE.Mesh) triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position').count) / 3; }));
    this.triangles = triangles;
    this.reset();
  }
  sample(seconds: number, target: THREE.Vector3): void { this.route.sample(seconds, this.sampleState); target.set(this.sampleState.x, this.sampleState.y, this.sampleState.z); }
  focus(stop: number, target: THREE.Vector3): void { this.route.focus(stop, target); }
  get distance(): number { return this.sampleState.distance; }
  private geometry(geometry: THREE.BufferGeometry, color: number): THREE.BufferGeometry {
    geometry.deleteAttribute('uv'); const count = geometry.getAttribute('position').count;
    const rgb = new THREE.Color(color); const values = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) rgb.toArray(values, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(values, 3)); this.geometries.add(geometry); return geometry;
  }
  private mesh(parent: THREE.Object3D, geometry: THREE.BufferGeometry, color: number, x = 0, y = 0, z = 0): THREE.Mesh {
    const mesh = new THREE.Mesh(this.geometry(geometry, color), this.material); mesh.position.set(x, y, z); parent.add(mesh); return mesh;
  }
  private box(parent: THREE.Object3D, x: number, y: number, z: number, w: number, h: number, d: number, color = 0xa78153): THREE.Mesh {
    return this.mesh(parent, new THREE.BoxGeometry(w, h, d), color, x, y, z);
  }
  private cylinder(parent: THREE.Object3D, x: number, y: number, z: number, top: number, bottom: number, height: number, color: number): THREE.Mesh {
    return this.mesh(parent, new THREE.CylinderGeometry(top, bottom, height, 12), color, x, y, z);
  }
  private mover(stop: number, name: string, x: number, y: number, z: number): THREE.Group {
    const group = new THREE.Group(); group.name = name; group.position.set(x, y, z); this.groups[stop]!.add(group); this.movers.set(name, group); return group;
  }
  private kit(parent: THREE.Object3D, name: string, x: number, y: number, z: number, scale = 1): THREE.Group {
    const group = this.assets.model(name, this.material); group.position.set(x, y, z); group.scale.setScalar(scale); parent.add(group); return group;
  }
  private cup(parent: THREE.Object3D, x: number, y: number, z: number, radius = 0.4, outlet = false, floor = true): THREE.Group {
    const cup = new THREE.Group(); cup.position.set(x, y, z); parent.add(cup);
    if (floor) this.cylinder(cup, 0, -0.04, 0, radius, radius * 0.8, 0.08, 0xc99d5e);
    if (outlet) {
      // Low side lips leave both ends open: a delivered sphere never crosses a closed rim.
      for (const turn of [Math.PI * 4 / 9, Math.PI * 13 / 9]) {
        const rim = this.mesh(cup, new THREE.TorusGeometry(radius, 0.035, 5, 6, Math.PI / 9), 0xe3c485);
        rim.rotation.set(Math.PI / 2, 0, turn);
      }
    } else {
      this.mesh(cup, new THREE.TorusGeometry(radius, 0.055, 5, 20), 0xe3c485, 0, 0.06, 0).rotation.x = Math.PI / 2;
    }
    return cup;
  }
  private channel(piece: RubePiece): void {
    if (piece.kind === 'loop') { this.loopRails(piece); return; }
    if (piece.kind === 'funnel') return;
    const anchor = this.route.anchors[piece.stop]!;
    const profile = [[-0.4, 0.17], [-0.4, -0.09], [0.4, -0.09], [0.4, 0.17], [0.32, 0.17], [0.32, 0], [0, 0], [-0.32, 0], [-0.32, 0.17]];
    // Each lift handoff ends at the real disc edge; its moving floor owns the contact.
    let points = piece.points;
    if (piece.stop === 3 && (piece.start === 14.4 || piece.start === 16)) {
      const edgeX = anchor.x - BUCKET_FLOOR_RADIUS;
      points = [];
      for (let index = 0; index < piece.points.length; index++) {
        const point = piece.points[index]!;
        const previous = piece.points[index - 1];
        if (previous && (previous.x <= edgeX) !== (point.x <= edgeX)) {
          const fraction = (edgeX - previous.x) / (point.x - previous.x);
          points.push({ ...point, x: edgeX, y: previous.y + (point.y - previous.y) * fraction,
            z: previous.z + (point.z - previous.z) * fraction });
        }
        if (point.x <= edgeX) points.push(point);
      }
    }
    const positions: number[] = []; const indices: number[] = [];
    for (let i = 0; i < points.length; i++) {
      const p = points[i]!;
      let sx = p.ty * p.nz - p.tz * p.ny; let sy = p.tz * p.nx - p.tx * p.nz; let sz = p.tx * p.ny - p.ty * p.nx;
      const length = Math.hypot(sx, sy, sz); sx /= length; sy /= length; sz /= length;
      for (const [side, up] of profile) positions.push(p.x - anchor.x + sx * side! + p.nx * (up! - RUBE_RADIUS), p.y - anchor.y + sy * side! + p.ny * (up! - RUBE_RADIUS), p.z - anchor.z + sz * side! + p.nz * (up! - RUBE_RADIUS));
      if (i) for (let edge = 0; edge < profile.length; edge++) {
        const a = (i - 1) * profile.length + edge; const b = (i - 1) * profile.length + (edge + 1) % profile.length; const c = i * profile.length + edge; const d = i * profile.length + (edge + 1) % profile.length;
        indices.push(a, c, b, b, c, d);
      }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setIndex(indices); geometry.computeVertexNormals();
    this.mesh(this.fixed[piece.stop]!, geometry, 0xe7d7ae).name = `rube-track-${piece.kind}-${piece.start}`;
    if (points !== piece.points) this.bucketMouth(piece.points[0]!.y - anchor.y - RUBE_RADIUS);
    if (piece.kind === 'channel' && piece.end - piece.start > 0.6) for (const fraction of [0.3, 0.7]) {
      const point = piece.points[Math.round(fraction * (piece.points.length - 1))]!;
      const nextAnchor = this.route.anchors[Math.max(0, piece.stop - 1)]!;
      const ground = anchor.y + (nextAnchor.y - anchor.y) * fraction;
      const height = Math.max(0.1, point.y - RUBE_RADIUS - 0.13 - ground);
      this.box(this.fixed[piece.stop]!, point.x - anchor.x, point.y - anchor.y - RUBE_RADIUS - 0.13 - height / 2, point.z - anchor.z, 0.12, height, 0.12);
    }
  }
  private bucketMouth(floor: number): void {
    const radius = BUCKET_FLOOR_RADIUS, width = 0.32, shoulder = Math.sqrt(3) * radius / 2;
    const edge = -radius / 2 + radius / 2 * (width - shoulder) / (radius - shoulder);
    // Follow the real twelve-sided disc across the whole mouth, leaving no overlapping floor.
    for (const side of [-1, 1]) {
      const outline = new THREE.Shape([
        new THREE.Vector2(-radius, 0), new THREE.Vector2(-shoulder, side * radius / 2),
        new THREE.Vector2(-radius / 2, side * shoulder), new THREE.Vector2(edge, side * width),
        new THREE.Vector2(-radius, side * width),
      ]);
      const cheek = new THREE.ExtrudeGeometry(outline, { depth: 0.09, steps: 1, bevelEnabled: false });
      cheek.rotateX(Math.PI / 2).translate(0, floor, 0.55);
      this.mesh(this.fixed[3]!, cheek, 0xe7d7ae).name = 'rube-track-lift-mouth';
    }
  }
  private loopRails(piece: RubePiece): void {
    const anchor = this.route.anchors[piece.stop]!;
    const railRadius = 0.055, halfWidth = 0.22;
    const depth = Math.sqrt((RUBE_RADIUS + railRadius) ** 2 - halfWidth ** 2);
    for (const direction of [-1, 1]) {
      const positions: number[] = [], indices: number[] = [];
      for (const [index, point] of piece.points.entries()) {
        const side = new THREE.Vector3(point.ty * point.nz - point.tz * point.ny,
          point.tz * point.nx - point.tx * point.nz, point.tx * point.ny - point.ty * point.nx).normalize();
        for (let radial = 0; radial < 8; radial++) {
          const angle = radial * Math.PI / 4;
          const up = -depth + railRadius * Math.cos(angle), across = direction * halfWidth + railRadius * Math.sin(angle);
          positions.push(point.x - anchor.x + point.nx * up + side.x * across,
            point.y - anchor.y + point.ny * up + side.y * across, point.z - anchor.z + point.nz * up + side.z * across);
          if (index > 0) {
            const a = (index - 1) * 8 + radial, b = (index - 1) * 8 + (radial + 1) % 8;
            const c = index * 8 + radial, d = index * 8 + (radial + 1) % 8;
            indices.push(a, b, c, b, d, c);
          }
        }
        if (direction < 0 && index % 18 === 0) {
          const tie = this.box(this.fixed[piece.stop]!, point.x - anchor.x - point.nx * (depth + 0.08),
            point.y - anchor.y - point.ny * (depth + 0.08), point.z - anchor.z - point.nz * (depth + 0.08), 0.64, 0.07, 0.08);
          tie.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(side,
            new THREE.Vector3(point.nx, point.ny, point.nz), new THREE.Vector3(-point.tx, -point.ty, -point.tz)));
        }
      }
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      geometry.setIndex(indices); geometry.computeVertexNormals();
      this.mesh(this.fixed[piece.stop]!, geometry, 0xd3a459).name = 'rube-loop-rail';
    }
  }
  private release(): void {
    const base = this.fixed[9]!;
    for (const x of [-0.5, 0.5]) this.box(base, x, 1.25, -0.5, 0.14, 2.5, 0.16);
    this.box(base, 0, 2.4, -0.5, 1.2, 0.12, 0.25);
    const cradle = this.mover(9, 'rube-cradle', 0, 2.5, 0); this.cup(cradle, 0, 0, 0, 0.4, true).name = 'rube-cradle-cup';
    const latch = this.mover(9, 'rube-latch', 0.4, 2.46, 0); this.box(latch, 0, 0, 0, 0.45, 0.08, 0.12, 0x59676a);
    const weight = this.mover(9, 'rube-release-weight', 0.8, 2.15, 0); this.box(weight, 0, 0, 0, 0.3, 0.4, 0.3, 0x687b7b);
    this.box(base, 0.8, 1.3, 0, 0.04, 2.3, 0.04, 0x544938);
  }
  private spiral(): void { this.cylinder(this.fixed[8]!, 0, 1.15, 0, 0.07, 0.1, 2.3, 0xa78153); }
  private loops(): void {
    for (const stop of [7, 4]) {
      this.box(this.fixed[stop]!, 0, 0.15, 0, 2.5, 0.2, 1.4, 0x7c8980);
      for (const x of [-0.85, 0.85]) this.box(this.fixed[stop]!, x, 0.55, 0, 0.12, 0.8, 0.12);
    }
  }
  private top(): void {
    const fixed = this.fixed[6]!;
    this.box(fixed, 0, 0.08, 0.4, 2.5, 0.16, 3, 0x7a8b80);
    for (const x of [-0.65, 0.65]) this.box(fixed, x, 0.95, -0.25, 0.12, 1.9, 0.14);
    this.box(fixed, 0, 1.9, -0.25, 1.45, 0.13, 0.2);
    const top = this.mover(6, 'rube-top', 0, 0.8, 0);
    this.cylinder(top, 0, -0.2, 0, 0.52, 0.08, 0.6, 0xc16643);
    this.cylinder(top, 0, 0.25, 0, 0.09, 0.09, 1.7, 0xe3c485);
    for (let i = 0; i < 6; i++) {
      const stripe = this.box(top, Math.cos(i * Math.PI / 3) * 0.34, -0.14, Math.sin(i * Math.PI / 3) * 0.34, 0.11, 0.4, 0.12, i % 2 ? 0xf3e5c9 : 0x355d65);
      stripe.rotation.y = -i * Math.PI / 3;
    }
    this.box(top, -0.45, -0.2, 0, 0.79, 0.12, 0.18, 0xf3d195);
    this.kit(top, 'mechanism-gear', 0, 0.6, 0, 0.6);
    const gear = this.mover(6, 'rube-gear', 0.65, 1.3, 0); this.kit(gear, 'mechanism-gear', 0, 0, 0, 0.75).rotation.x = Math.PI / 2;
    this.box(gear, 0.2, 0, 0.25, 0.25, 0.12, 0.2, 0xb27242);
    const gate = this.mover(6, 'rube-gate', -0.55, 0.75, 1.85); gate.rotation.y = Math.PI / 2;
    this.box(gate, 0, 0, 0, 0.12, 0.95, 0.85, 0x567b79);
    this.box(gate, -0.12, 0.55, -1.15, 0.12, 0.5, 0.12, 0xd5ba81);
    this.box(gate, -0.12, 0.75, -0.575, 0.1, 0.1, 1.15, 0xd5ba81);
    for (const x of [0.45, 1.65]) this.box(fixed, x, 1, 0.7, 0.12, 2, 0.12);
    this.box(fixed, 1.05, 2, 1.05, 1.4, 0.12, 0.8);
    this.cup(fixed, -0.55, 0.3, 1.4, 0.35, true, false).rotation.y = Math.PI / 2;
  }
  private catapult(): void {
    const fixed = this.fixed[5]!;
    this.box(fixed, 0, 0.3, 0, 0.25, 0.6, 0.45);
    const beam = this.mover(5, 'rube-catapult', 0, 0.61, 0);
    // Recess the beam beneath the cup's disc; both used to expose the same top plane.
    const outline = new THREE.Shape().moveTo(-1, -0.06).lineTo(1, -0.06).lineTo(1, 0.06)
      .lineTo(-0.5, 0.06).lineTo(-0.5, 0.02).lineTo(-1, 0.02).closePath();
    this.mesh(beam, new THREE.ExtrudeGeometry(outline, { depth: 0.4, steps: 1, bevelEnabled: false }).translate(0, 0, -0.2), 0xd5b87e);
    this.cup(beam, -0.9, 0.06, 0, 0.4, true).name = 'rube-catapult-cup';
    const pedal = this.mover(5, 'rube-pedal', -0.9, 0.22, 0.25); this.box(pedal, 0, 0, 0, 0.5, 0.08, 0.4);
    this.box(pedal, 0.5, 0.15, 0.1, 1.1, 0.06, 0.08, 0x687b7b);
    const weight = this.mover(5, 'rube-counterweight', 0.85, 2.1, 0);
    this.box(weight, 0, 0, 0, 0.52, 0.55, 0.5, 0x647e7e);
    for (const x of [-1.6, 0]) this.box(fixed, x, 1.2, -2.8, 0.1, 2.4, 0.12);
    this.box(fixed, -0.4, 2.45, -2.8, 2.6, 0.1, 0.2);
    this.box(fixed, 0.85, 2.45, -1.35, 0.15, 0.1, 2.9);
    this.cup(fixed, 0.85, 2.5, 0.45, 0.4, true, false).rotation.y = Math.PI / 2; this.box(fixed, 0.85, 1.25, 0.45, 0.1, 2.5, 0.1);
  }
  private bucket(): void {
    const fixed = this.fixed[3]!;
    for (const x of [-1.25, 1.25]) this.box(fixed, x, 0.85, -0.2, 0.12, 1.7, 0.2);
    this.box(fixed, 0, 1.65, -0.2, 2.6, 0.12, 0.12);
    const wheel = this.mover(3, 'rube-bucket-wheel', 0, 1.65, 0);
    this.mesh(wheel, new THREE.TorusGeometry(1, 0.08, 5, 24), 0xc69f61);
    // Three diametric bars make six spokes. Layer their hub joint inside the rim's depth.
    for (let i = 0; i < 3; i++) {
      const spoke = this.box(wheel, 0, 0, (i - 1) * 0.012, 0.06, 2, 0.08, 0xd5bd8c);
      spoke.rotation.z = i * Math.PI / 3;
    }
    for (const direction of [-1, 1]) {
      const cup = this.cup(wheel, 0, direction * 1.05, 0.55, BUCKET_FLOOR_RADIUS, true);
      cup.name = `rube-bucket-cup-${this.cups.length}`;
      cup.children.forEach(child => { child.position.y -= RUBE_RADIUS; }); this.cups.push(cup);
    }
    const weight = this.mover(3, 'rube-bucket-weight', 1.45, 2.25, 0);
    this.box(weight, 0, 0, 0, 0.4, 0.4, 0.4, 0x647e7e);
    this.box(fixed, 1.45, 1.2, 0, 0.035, 2.4, 0.035, 0x544938);
    this.kit(fixed, 'mechanism-gear', -1.2, 1.65, 0.35, 0.5).rotation.x = Math.PI / 2;
  }
  private zigzag(): void { for (const x of [-2.65, 1.15]) this.box(this.fixed[2]!, x, 1.1, -0.8, 0.1, 2.2, 0.12); }
  private funnel(): void {
    const fixed = this.fixed[1]!;
    const slope = 0.3 / 0.82, ny = 1 / Math.sqrt(1 + slope * slope);
    const geometry = new THREE.CylinderGeometry(1.22, 0.4, 0.3, 72, 1, true);
    const indices = geometry.getIndex()!; const normals = geometry.getAttribute('normal');
    for (let i = 0; i < indices.count; i += 3) { const swap = indices.getX(i + 1); indices.setX(i + 1, indices.getX(i + 2)); indices.setX(i + 2, swap); }
    for (let i = 0; i < normals.count; i++) normals.setXYZ(i, -normals.getX(i), -normals.getY(i), -normals.getZ(i));
    this.mesh(fixed, geometry, 0xe7d7ae, 0, 1.05 - RUBE_RADIUS * ny, 0).name = 'rube-track-funnel';
    for (const x of [-0.7, 0.7]) this.box(fixed, x, 0.4, -0.8, 0.1, 0.8, 0.1);
  }
  private bell(): void {
    const fixed = this.fixed[0]!;
    for (const x of [-0.9, 0.9]) this.box(fixed, x, 1.05, -1.1, 0.12, 2.1, 0.14);
    this.box(fixed, 0, 2.1, -0.5, 2, 0.12, 1.4);
    const bell = this.mover(0, 'rube-bell', 0, 2, 0.05);
    this.cylinder(bell, 0, -0.35, 0, 0.15, 0.5, 0.65, 0xd5aa55);
    this.mesh(bell, new THREE.TorusGeometry(0.48, 0.05, 5, 16), 0xf0d58d, 0, -0.65, 0).rotation.x = Math.PI / 2;
    const hammer = this.mover(0, 'rube-hammer', -0.7, 0.9, 0.35);
    this.box(hammer, 0, 0.05, 0, 0.1, 0.95, 0.12); this.box(hammer, 0.1, 0.55, 0, 0.4, 0.22, 0.22, 0x586f6c);
    this.cup(fixed, 0.5, 0.05, 1.35);
  }
  private merge(group: THREE.Group): void {
    group.updateWorldMatrix(true, true); const inverse = group.matrixWorld.clone().invert(); const pieces: THREE.BufferGeometry[] = []; const originals: THREE.Mesh[] = [];
    group.traverse(object => { if (object instanceof THREE.Mesh) {
      const piece = object.geometry.index ? object.geometry.toNonIndexed() : object.geometry.clone(); pieces.push(piece.applyMatrix4(inverse.clone().multiply(object.matrixWorld))); originals.push(object);
    } });
    if (!pieces.length) return;
    const merged = mergeGeometries(pieces); pieces.forEach(piece => piece.dispose()); if (!merged) throw new Error('Rube static geometry did not merge');
    originals.forEach(mesh => mesh.removeFromParent()); this.geometries.add(merged); group.add(new THREE.Mesh(merged, this.material));
  }
  apply(seconds: number, reducedMotion = false): void {
    const p = rubePose(seconds, this.pose, reducedMotion);
    this.movers.get('rube-latch')!.position.x = 0.4 + p.latch * 0.45;
    this.movers.get('rube-cradle')!.rotation.z = p.cradle;
    this.movers.get('rube-release-weight')!.position.y = 2.15 - p.cradle;
    this.movers.get('rube-top')!.rotation.y = p.top; this.movers.get('rube-gear')!.rotation.z = p.gear;
    this.movers.get('rube-gate')!.position.y = 0.75 + p.gate * 1.05;
    this.movers.get('rube-pedal')!.rotation.z = p.pedal * 0.2;
    const weight = this.movers.get('rube-counterweight')!;
    const seatX = 0.85 * Math.cos(p.catapult) - 0.06 * Math.sin(p.catapult);
    const seatY = 0.61 + 0.85 * Math.sin(p.catapult) + 0.06 * Math.cos(p.catapult) + 0.275;
    weight.position.set(seatX, 2.1 * (1 - p.weight) + seatY * p.weight, 0);
    this.movers.get('rube-catapult')!.rotation.z = p.catapult;
    this.movers.get('rube-bucket-wheel')!.rotation.z = p.bucket; this.cups.forEach(cup => { cup.rotation.z = -p.bucket; });
    this.movers.get('rube-bucket-weight')!.position.y = 2.25 - p.bucketWeight * 1.65;
    this.movers.get('rube-hammer')!.rotation.z = p.hammer; this.movers.get('rube-bell')!.rotation.z = p.bell;
  }
  reset(): void { this.apply(0); }
  handoff(seconds: number, target: THREE.Vector3): void {
    const start = this.route.anchors[9]!; const u = Math.max(0, Math.min(1, seconds / 1.8)); const t = u * u * (3 - 2 * u);
    target.set(start.x, start.y + 2.8 + (1 - t) * 0.8, start.z - (1 - t) * 7);
    this.reset(); const tip = Math.max(0, Math.min(1, (seconds - 1.8) / 0.4)); const angle = -tip * 0.15;
    this.movers.get('rube-cradle')!.rotation.z = angle;
    if (seconds >= 1.8) target.set(start.x - 0.3 * Math.sin(angle), start.y + 2.5 + 0.3 * Math.cos(angle), start.z);
  }
  dispose(): void { this.geometries.forEach(geometry => geometry.dispose()); this.geometries.clear(); }
}
