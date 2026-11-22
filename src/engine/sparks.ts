import * as THREE from 'three';
import type { Point3 } from './physics';

const CAPACITY = 512;
/** Steady glows kept behind pieces that are one step from done; they sit after the pool in the same draw. */
const HALOS = 8;
/** A second payoff inside this many seconds is a streak, and gets a bigger burst. */
const STREAK_SECONDS = 2;
const STREAK_GAIN = [1, 1.4, 1.8] as const;
const GOLD = 0xffd76a;
const WHITE = 0xfff8e0;

const enum Kind { Glitter = 0, Glint = 1, Glow = 2, Trail = 3, Comet = 4 }

interface Particle {
  kind: Kind; age: number; life: number; queued: boolean;
  x: number; y: number; z: number; vx: number; vy: number; vz: number;
  /** Glitter that has fallen back to this height is gone, so none of it settles on the piece below. */
  acceleration?: THREE.Vector3;
  headingX?: number; headingY?: number; fall?: number;
  floor: number; size: number; spin: number; seed: number; r: number; g: number; b: number;
}

const VERTEX = /* glsl */`
attribute vec3 aAt;
attribute vec4 aLook;
attribute vec3 aTint;
varying vec2 vAcross;
varying vec3 vTint;
varying vec2 vKind;
void main() {
  vAcross = uv * 2.0 - 1.0;
  vTint = aTint;
  vKind = aLook.zw;
  float c = cos(aLook.y), s = sin(aLook.y);
  vec4 at = modelViewMatrix * vec4(aAt, 1.0);
  at.xy += mat2(c, -s, s, c) * position.xy * aLook.x;
  gl_Position = projectionMatrix * at;
  // Glitter and glints stay in front of the piece that threw them; the glow sits behind it.
  if (aLook.z < 1.5 || aLook.z > 3.5) gl_Position.z -= 0.004 * gl_Position.w;
}`;

const FRAGMENT = /* glsl */`
varying vec2 vAcross;
varying vec3 vTint;
varying vec2 vKind;
void main() {
  float d = length(vAcross);
  vec2 a = abs(vAcross);
  float shape, cover;
  if (vKind.x < 0.5) {
    // A fleck: a bright point with a soft edge, drawn over what is behind it.
    shape = smoothstep(1.0, 0.35, d); cover = 1.0;
  } else if (vKind.x < 1.5) {
    // A four-point glint: two thin rays and a hot core, added to what is behind it.
    float rays = max(exp(-a.y * 16.0) * (1.0 - a.x), exp(-a.x * 16.0) * (1.0 - a.y));
    shape = clamp(rays + exp(-d * d * 22.0), 0.0, 1.0) * step(d, 1.0); cover = 0.0;
  } else if (vKind.x > 3.5) {
    // A pearl head flows into a taper of fine light along its own direction of travel.
    float width = mix(.035, .17, smoothstep(-1.0, .60, vAcross.y));
    float body = exp(-pow(vAcross.x / width, 2.0)) * smoothstep(-1.0,.65,vAcross.y);
    float head = length(vec2(vAcross.x, vAcross.y - .62));
    shape = max(body * (1.0 - smoothstep(.60,.86,vAcross.y)), 1.0 - smoothstep(.07,.25,head));
    cover = 0.72;
  } else {
    float soft = max(0.0, 1.0 - d);
    shape = soft * soft; cover = 0.0;
  }
  float alpha = shape * vKind.y;
  gl_FragColor = vec4(vTint * alpha, alpha * cover);
  #include <colorspace_fragment>
}`;

/**
 * The board's sparkle: glitter, four-point glints and a soft glow, all in one pooled draw. Everything
 * is thrown from the piece that earned it and is gone within a second; nothing here moves while the
 * board rests, and reduced motion throws nothing.
 */
export class Sparks {
  private readonly geometry = new THREE.InstancedBufferGeometry();
  private readonly at = new THREE.InstancedBufferAttribute(new Float32Array((CAPACITY + HALOS) * 3), 3);
  private readonly look = new THREE.InstancedBufferAttribute(new Float32Array((CAPACITY + HALOS) * 4), 4);
  private readonly tint = new THREE.InstancedBufferAttribute(new Float32Array((CAPACITY + HALOS) * 3), 3);
  private readonly halos = Array.from({ length: HALOS }, () => ({ on: false, x: 0, y: 0, z: 0, level: 0 }));
  private alive = false;
  private last: Point3 | null = null;
  /** How lately a streak paid off, 1 falling to 0 over two seconds: the belt brightens with it. */
  heat = 0;
  private readonly mesh: THREE.Mesh;
  private readonly particles: Particle[] = Array.from({ length: CAPACITY }, (_, index) => ({
    kind: Kind.Glitter, queued: false, age: 1, life: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, floor: 0, size: 0, spin: 0, r: 0, g: 0, b: 0, seed: index * 2.399,
  }));
  private readonly live: Particle[] = [];
  private readonly color = new THREE.Color();
  private cursor = 0;
  private clock = 0;
  private lastPayoff = -Infinity;
  private streak = 0;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  /** `unit` is the width of the piece these are thrown from: every size follows it. */
  constructor(parent: THREE.Object3D, private readonly unit = 2) {
    const quad = new THREE.PlaneGeometry(1, 1);
    this.geometry.setIndex(quad.getIndex());
    this.geometry.setAttribute('position', quad.getAttribute('position'));
    this.geometry.setAttribute('uv', quad.getAttribute('uv'));
    for (const attribute of [this.at, this.look, this.tint]) attribute.setUsage(THREE.DynamicDrawUsage);
    this.geometry.setAttribute('aAt', this.at);
    this.geometry.setAttribute('aLook', this.look);
    this.geometry.setAttribute('aTint', this.tint);
    this.geometry.instanceCount = 0;
    this.mesh = new THREE.Mesh(this.geometry, new THREE.ShaderMaterial({
      vertexShader: VERTEX, fragmentShader: FRAGMENT, transparent: true, depthWrite: false, toneMapped: false,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
      blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneMinusSrcAlphaFactor,
    }));
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 12;
    parent.add(this.mesh);
    this.clear();
  }

  private spawn(kind: Kind, at: Point3, hex: number, life: number, size: number, delay = 0): Particle {
    const index = this.cursor++ % CAPACITY;
    const particle = this.particles[index]!;
    if (!particle.queued) {
      particle.queued = true;
      this.live.push(particle);
    }
    particle.kind = kind;
    particle.age = -delay;
    particle.life = life;
    particle.x = at.x; particle.y = at.y; particle.z = at.z;
    particle.vx = particle.vy = particle.vz = particle.spin = 0;
    particle.acceleration = undefined;
    particle.floor = -Infinity;
    particle.size = size;
    this.color.setHex(hex);
    particle.r = this.color.r; particle.g = this.color.g; particle.b = this.color.b;
    return particle;
  }

  /** Fine glitter that fountains up from a point and falls: gold and white, with the piece's own colour mixed in. */
  private glitter(at: Point3, hex: number, count: number, lift: number, spread: number, life: number, size: number): void {
    for (let i = 0; i < count; i++) {
      const tone = i % 5 < 2 ? hex : i % 5 < 4 ? GOLD : WHITE;
      const particle = this.spawn(Kind.Glitter, at, tone, life * (0.75 + (i % 4) * 0.09), this.unit * size * (0.8 + (i % 3) * 0.25));
      const angle = i * 2.399;
      const speed = spread * (0.35 + ((i * 7) % 10) / 10);
      particle.vx = Math.cos(angle) * speed;
      particle.vz = Math.sin(angle) * speed * 0.7;
      particle.vy = lift * (0.6 + ((i * 3) % 8) / 16);
      particle.floor = at.y - this.unit * 0.1;
    }
  }

  /** A small puff, for a lid or a latch that opens. */
  burst(at: Point3, color: number, count = 12): void {
    if (this.reducedMotion) return;
    this.glitter(at, color, count, 3, 1.8, 0.6, 0.055);
    this.draw();
  }

  /** A few bright flecks where an accepted tap lands. */
  tap(at: Point3): void {
    if (this.reducedMotion) return;
    this.glitter(at, WHITE, 7, 2.4, 1.6, 0.34, 0.05);
    this.draw();
  }

  /** One fading dot left behind a marble in flight: a run of them draws the path it took. */
  trail(at: Point3, color: number, size = 0.21, life = 0.26): void {
    if (this.reducedMotion) return;
    this.spawn(Kind.Trail, at, color, life, this.unit * size);
    this.alive = this.mesh.visible = true;
  }

  /** A marble seats itself: a quick glint and a few flecks in its colour, right where it landed. */
  land(at: Point3, color: number, delay = 0): void {
    if (this.reducedMotion) return;
    const from = this.cursor;
    this.glitter(at, color, 7, 2.2, 1.4, 0.38, 0.05);
    for (let i = from; i < this.cursor; i++) this.particles[i % CAPACITY]!.age = -delay;
    this.spawn(Kind.Glint, { x: at.x, y: at.y + this.unit * 0.08, z: at.z }, WHITE, 0.24, this.unit * 0.3, delay).spin = 2;
    this.draw();
  }

  /** The payoff for a finished box, lorry or tube: a glow behind it, small twinkles around it and a cloud of fine dust. */
  payoff(at: Point3, color: number): number {
    if (this.reducedMotion) return 0;
    this.streak = this.clock - this.lastPayoff < STREAK_SECONDS ? Math.min(STREAK_GAIN.length - 1, this.streak + 1) : 0;
    this.lastPayoff = this.clock;
    const gain = STREAK_GAIN[this.streak]!;
    const unit = this.unit;
    if (this.streak > 0) {
      this.heat = 1;
      // Inside a streak a ribbon of dust runs from the last finished piece to this one.
      const from = this.last;
      if (from) for (let i = 0; i < 14; i++) {
        const f = i / 13;
        this.spawn(Kind.Trail, { x: from.x + (at.x - from.x) * f, y: from.y + (at.y - from.y) * f + Math.sin(f * Math.PI) * unit * 0.7, z: from.z + (at.z - from.z) * f },
          i % 2 ? GOLD : WHITE, 0.32, unit * 0.15, f * 0.2);
      }
    }
    this.last = { x: at.x, y: at.y, z: at.z };
    this.spawn(Kind.Glow, at, WHITE, 0.24, unit * 2);
    // Small twinkles, never big stars: the owner asked for fairy dust.
    const glints = Math.round(12 * gain);
    for (let i = 0; i < glints; i++) {
      const angle = i / glints * Math.PI * 2 + 0.5;
      const reach = unit * (0.36 + (i % 4) * 0.34);
      const glint = this.spawn(Kind.Glint, { x: at.x + Math.cos(angle) * reach, y: at.y + unit * 0.12 + Math.abs(Math.sin(angle)) * reach * 0.7, z: at.z + Math.sin(angle) * reach * 0.35 },
        i % 3 === 0 ? GOLD : WHITE, 0.34, unit * (0.2 + (i % 3) * 0.07), i * 0.05);
      glint.spin = i % 2 ? 1.6 : -1.6;
      glint.vy = 0.5;
    }
    this.glitter(at, color, Math.round(66 * gain), 5.6 * (1 + this.streak * .15), 3.8, 1.12, .075);
    this.draw();
    return this.streak;
  }

  /** Project the rise at each hull corner so its fountain reads consistently across board shapes. */
  finish(corners: readonly Point3[], share: number, camera: THREE.Camera, width: number, height: number): void {
    if (this.reducedMotion) return;
    const projected = corners.map(at => new THREE.Vector3(at.x, at.y, at.z).project(camera));
    // Near corners have room for tall jets. Lead with both flanks while the last load is still in sight.
    projected.sort((a,b) => a.y - b.y || a.x - b.x);
    projected.forEach((point, corner) => {
      const x = (point.x + 1) * width / 2, y = (1 - point.y) * height / 2;
      const at = point.clone().unproject(camera);
      const pixel = new THREE.Vector3(point.x, point.y + 2 / height, point.z).unproject(camera).sub(at);
      const side = new THREE.Vector3(point.x + 2 / width, point.y, point.z).unproject(camera).sub(at);
      const heightPx = Math.max(0, Math.min(height * .20 * share, y - 57));
      const grains = Math.round(23 * share);
      for (let jet = 0; jet < 2; jet++) {
        for (let i = 0; i < grains; i++) {
          const tail = i / (grains - 1), phase = i * 2.4 + corner;
          const rise = heightPx * (1 - jet * .22 - tail * .26);
          const span = (width * .5 - x) * (.67 + jet * .28 + Math.cos(phase) * tail * .20);
          const life = .70 + jet * .06;
          const delay = .04 + corner * .097 + jet * .045 + tail * .25;
          const kind = i % 4 === 0 ? Kind.Comet : i % 7 === 0 ? Kind.Glint : Kind.Glitter;
          const grain = this.spawn(kind, at,
            i % 5 === 0 ? WHITE : jet ? 0xffb06a : GOLD, life * (.82 + .10 * tail),
            pixel.length() * (kind === Kind.Comet ? 29 - tail * 9 : kind === Kind.Glint ? 12 : 5.2 - tail * 1.6), delay);
          const velocity = pixel.clone().multiplyScalar(4 * rise / life).addScaledVector(side, span / life);
          grain.vx = velocity.x; grain.vy = velocity.y; grain.vz = velocity.z;
          grain.headingX = span / life;
          grain.headingY = 4 * rise / life;
          grain.fall = -8 * rise / (life * life);
          grain.acceleration = pixel.clone().multiplyScalar(grain.fall);
        }
      }
    });
    this.draw();
  }

  /** Lights or puts out the steady glow in one of the few halo places. A piece one step from done gets one. */
  halo(slot: number, at: Point3 | null): void {
    const halo = this.halos[slot];
    if (!halo) return;
    halo.on = at !== null;
    if (at) { halo.x = at.x; halo.y = at.y; halo.z = at.z; }
    if (this.reducedMotion && halo.level !== (halo.on ? 1 : 0)) { halo.level = halo.on ? 1 : 0; this.draw(); }
  }

  get active(): boolean { return this.alive || this.heat > 0 || this.halos.some((halo) => halo.level !== (halo.on ? 1 : 0)); }

  step(seconds: number): void {
    this.clock += seconds;
    this.heat = Math.max(0, this.heat - seconds / 2);
    let fading = false;
    for (const halo of this.halos) {
      const target = halo.on ? 1 : 0;
      if (halo.level === target) continue;
      // In over 0.6 s, out a little quicker, then it holds: a steady light, never a blinking one.
      halo.level = target > halo.level ? Math.min(1, halo.level + seconds / 0.6) : Math.max(0, halo.level - seconds / 0.3);
      fading = true;
    }
    if (!this.alive && !fading && !this.halos.some((halo) => halo.on)) return;
    let remaining = 0;
    for (const p of this.live) {
      if (p.age >= p.life) { p.queued = false; continue; }
      this.live[remaining++] = p;
      p.age += seconds;
      if (p.age <= 0) continue;
      const travel = Math.min(seconds, p.age);
      p.x += p.vx * travel;
      p.y += p.vy * travel;
      p.z += p.vz * travel;
      if (p.acceleration) {
        const halfSquare = .5 * travel * travel;
        p.x += p.acceleration.x * halfSquare;
        p.y += p.acceleration.y * halfSquare;
        p.z += p.acceleration.z * halfSquare;
        p.vx += p.acceleration.x * travel;
        p.vy += p.acceleration.y * travel;
        p.vz += p.acceleration.z * travel;
      } else if (p.kind === Kind.Glitter) {
        // Dust, not gravel: it hangs and drifts down.
        p.vy -= 7 * seconds;
        if (p.vy < 0 && p.y < p.floor) p.age = p.life;
      }
    }
    this.live.length = remaining;
    this.draw();
  }

  private draw(): void {
    let alive = false;
    let visible = 0;
    for (const p of this.live) {
      const t = p.age / p.life;
      // One still waiting for its moment keeps the pool running, unseen.
      if (p.age < 0) alive = true;
      if (!(t >= 0 && t < 1)) continue;
      alive = true;
      let size = p.size, alpha = 1;
      let angle = p.spin * p.age + p.seed * (p.kind === Kind.Glint ? 0 : 1);
      if (p.kind === Kind.Glitter) {
        // Flecks twinkle as they turn, and thin out as they fall.
        alpha = (p.acceleration ? .9 : 0.5 + 0.5 * Math.sin(p.age * 30 + p.seed * 3)) * Math.min(1, (1 - t) * 3);
        size *= 0.6 + 0.4 * (1 - t);
      } else if (p.kind === Kind.Comet) {
        angle = Math.atan2(p.headingX!, p.headingY! + p.fall! * p.age);
        size *= 1 - .42 * t;
        alpha = Math.min(1, (1 - t) * 4);
      } else if (p.kind === Kind.Trail) {
        size *= 1 - t * 0.7;
        alpha = 0.8 * (1 - t);
      } else if (p.kind === Kind.Glint) {
        // Out fast, a held sparkle, then it closes to a point.
        size *= Math.sin(Math.min(1, t * 2.4) * Math.PI / 2) * (1 - Math.max(0, t - 0.45) / 0.55);
        alpha = 1.5;
      } else {
        size *= 0.6 + 0.4 * t;
        alpha = 0.55 * (1 - t);
      }
      const index = visible++;
      this.tint.setXYZ(index, p.r, p.g, p.b);
      this.at.setXYZ(index, p.x, p.y, p.z);
      this.look.setXYZW(index, size, angle, p.kind === Kind.Trail ? Kind.Glitter : p.kind, alpha);
    }
    this.alive = alive;
    for (const halo of this.halos) {
      if (!halo.level) continue;
      const eased = halo.level * halo.level * (3 - 2 * halo.level);
      this.at.setXYZ(visible, halo.x, halo.y, halo.z);
      this.tint.setXYZ(visible, 1, .93, .78);
      this.look.setXYZW(visible++, this.unit * 2.1, 0, Kind.Glow, .36 * eased);
    }
    this.geometry.instanceCount = visible;
    this.mesh.visible = visible > 0;
    if (visible) {
      for (const attribute of [this.at, this.look, this.tint]) {
        attribute.clearUpdateRanges();
        attribute.addUpdateRange(0, visible * attribute.itemSize);
        attribute.needsUpdate = true;
      }
    }
  }

  clear(): void {
    for (const p of this.live) p.queued = false;
    this.live.length = 0;
    this.streak = 0;
    this.lastPayoff = -Infinity;
    this.last = null;
    this.heat = 0;
    for (const halo of this.halos) { halo.on = false; halo.level = 0; }
    this.draw();
  }

  dispose(): void {
    this.mesh.removeFromParent();
    this.geometry.dispose();
    (this.mesh.material as THREE.Material).dispose();
  }
}
