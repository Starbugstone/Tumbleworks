import { Matrix4, Quaternion, Vector3 } from "three";
import {
  carrierContact,
  carrierEdges,
  hasVillageCarrier,
  isVillageTrack,
  mechanismMatrix,
  villageEase,
} from "../view/machine-primitives";
import {
  validateVillagePlan,
  type VillageContactRecord,
  type VillageSegment,
  type VillageTimeBoundary,
  type VillageTransferInterval,
} from "./village-program";
import {
  villagePort,
  type VillagePlan,
  type VillagePort,
  type VillageStation,
} from "./village-plan";
import { VillageTerminalPath } from "./village-terminal";
import { VILLAGE_SHAPES } from "./village-shapes";
import type {
  VillageAuxiliary,
  VillageAuxiliaryPose,
  VillageRoute,
} from "./village-motion";
const RATE = 120,
  CRUISE = 1.8,
  clamp = (x: number) => Math.max(0, Math.min(1, x));
const lengths = (ps: readonly VillagePort[]) => {
  const ls = [0];
  for (let i = 1; i < ps.length; i++)
    ls.push(
      ls.at(-1)! +
        new Vector3(...ps[i]!.position).distanceTo(
          new Vector3(...ps[i - 1]!.position),
        ),
    );
  return ls;
};
/** One rolling stretch across joins. Speed is authored from grade, with bounded acceleration; no force/energy claim. */
class CineRun {
  readonly length: number;
  readonly duration: number;
  readonly arc: readonly number[];
  readonly times: number[] = [0];
  readonly distances: number[] = [0];
  readonly speeds: number[] = [];
  constructor(
    readonly points: readonly VillagePort[],
    entry: number,
    exit: number,
    brisk:readonly(readonly[number,number])[]=[],
  ) {
    this.arc = lengths(points);
    this.length = this.arc.at(-1)!;
    if (!(this.length > 0)) throw Error("Empty cinematic rolling stretch");
    const count = Math.ceil(this.length / 0.05),
      step = this.length / count,
      p = new Vector3(),
      first = points[0]!.position[1];
    for (let i = 0; i <= count; i++) {
      const s = i * step;
      this.at(s, p);
      this.distances[i] = s;
      this.speeds[i] = Math.max(
        1.2,
        Math.min(
          4.5,
          Math.sqrt(Math.max(0, CRUISE * CRUISE + 14 * (first - p.y))),
        ),
      );
      // Keep a vertical loop brisk rather than making the marble appear stuck
      // to its upside-down rails. Neighbouring cells share the same acceleration
      // envelope; this is authored pacing, not a traction/energy certificate.
      for(const[a,b]of brisk){const away=Math.max(a-s,s-b,0);this.speeds[i]=Math.max(this.speeds[i]!,Math.sqrt(Math.max(0,4.5**2-5*away)));}
    }
    this.speeds[0] = entry;
    this.speeds[count] = exit;
    for (let i = 1; i <= count; i++)
      this.speeds[i] = Math.min(
        this.speeds[i]!,
        Math.sqrt(this.speeds[i - 1]! ** 2 + 5 * step),
      );
    for (let i = count - 1; i >= 0; i--)
      this.speeds[i] = Math.min(
        this.speeds[i]!,
        Math.sqrt(this.speeds[i + 1]! ** 2 + 5 * step),
      );
    for (let i = 1; i <= count; i++)
      this.times[i] =
        this.times[i - 1]! +
        (2 * step) / (this.speeds[i - 1]! + this.speeds[i]!);
    this.duration = this.times.at(-1)!;
  }
  timeAt(s: number) {
    if(s<=0)return 0;
    if(s>=this.length)return this.duration;
    const u =
        (Math.max(0, Math.min(this.length, s)) / this.length) *
        (this.distances.length - 1),
      i = Math.min(this.times.length - 2, Math.floor(u));
    const ds = (u - i) * (this.distances[i + 1]! - this.distances[i]!),
      v = this.speeds[i]!,
      a =
        (this.speeds[i + 1]! ** 2 - v * v) /
        (2 * (this.distances[i + 1]! - this.distances[i]!));
    return ds === 0
      ? this.times[i]!
      : this.times[i]! +
          (2 * ds) / (v + Math.sqrt(Math.max(0, v * v + 2 * a * ds)));
  }
  distanceAt(t: number) {
    t = Math.max(0, Math.min(this.duration, t));
    let lo = 0,
      hi = this.times.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.times[mid]! <= t) lo = mid;
      else hi = mid;
    }
    const dt = t - this.times[lo]!,
      h = this.times[hi]! - this.times[lo]!,
      a = (this.speeds[hi]! - this.speeds[lo]!) / h;
    return this.distances[lo]! + this.speeds[lo]! * dt + 0.5 * a * dt * dt;
  }
  at(s: number, p: Vector3, n?: Vector3) {
    s = Math.max(0, Math.min(this.length ?? this.arc.at(-1)!, s));
    let lo = 0,
      hi = this.points.length - 1;
    while (lo + 1 < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.arc[mid]! <= s) lo = mid;
      else hi = mid;
    }
    const a = this.points[lo]!,
      b = this.points[hi]!,
      u = (s - this.arc[lo]!) / (this.arc[hi]! - this.arc[lo]! || 1);
    p.set(
      a.position[0] + (b.position[0] - a.position[0]) * u,
      a.position[1] + (b.position[1] - a.position[1]) * u,
      a.position[2] + (b.position[2] - a.position[2]) * u,
    );
    n?.set(
      a.normal[0] + (b.normal[0] - a.normal[0]) * u,
      a.normal[1] + (b.normal[1] - a.normal[1]) * u,
      a.normal[2] + (b.normal[2] - a.normal[2]) * u,
    ).normalize();
  }
}
interface Clip {
  station: VillageStation;
  start: number;
  catch: number;
  ride: number;
  dock: number;
  release: number;
  end: number;
  held: number;
  returnEnd: number;
}
type Phase =
  | { kind: "roll"; start: number; end: number; run: CineRun }
  | {
      kind: "deck" | "hold" | "ride";
      start: number;
      end: number;
      clip: Clip;
      x0: number;
      x1: number;
      ease: "in" | "out" | "hold";
    };
/** Production film model: authored, absolute-time, geometric. It never compiles or claims mechanical physics. */
export class VillageCinematic implements VillageRoute {
  readonly mode = "cinematic" as const;
  readonly playback = { state: "ready" as const };
  readonly motionStatus = {
    state: "authoring" as const,
    reason: "Cinematic playback has no physical certificate",
  };
  readonly authoredPlan: VillagePlan;
  readonly plan: VillagePlan;
  readonly duration: number;
  readonly contacts: VillageContactRecord[] = [];
  readonly segments: VillageSegment[] = [];
  readonly boundaries: VillageTimeBoundary[] = [];
  readonly transfers: VillageTransferInterval[] = [];
  readonly handoff;
  readonly phases: Phase[] = [];
  private readonly clips = new Map<number, Clip>();
  private readonly terminals = new Map<number, VillageTerminalPath>();
  private readonly matrix = new Matrix4();
  private readonly scratch = new Vector3();
  private readonly quaternions: Quaternion[] = [];
  private readonly distances: number[] = [];
  distance = 0;
  constructor(plan: VillagePlan) {
    validateVillagePlan(plan);
    if (
      plan.stations.some(
        (s) => s.mechanism.kind === "wheelbucket" && s.mechanism.axleCarry,
      )
    )
      throw Error("Cinematic axle research data unsupported");
    this.authoredPlan = plan;
    let time = 0.7,
      queue: VillagePort[] = [];
    const pending: {
      stop: number;
      kind: "contact" | "connector";
      points: readonly VillagePort[];
      a: number;
      b: number;
      authoredStart: number;
      authoredEnd: number;
    }[] = [];
    const addSegment = (
      stop: number,
      kind: "contact" | "connector",
      points: readonly VillagePort[],
      a: number,
      b: number,
      authoredStart: number,
      authoredEnd: number,
    ) => {
      this.segments.push({
        stop,
        kind,
        points,
        start: a,
        end: b,
        lengths: lengths(points),
      });
      this.boundaries.push({
        stop,
        kind,
        start: a,
        end: b,
        authoredStart,
        authoredEnd,
      });
    };
    const append = (
      stop: number,
      kind: "contact" | "connector",
      points: readonly VillagePort[],
      authoredStart: number,
      authoredEnd: number,
    ) => {
      const a = queue.length ? lengths(queue).at(-1)! : 0;
      if (queue.length) queue.push(...points.slice(1));
      else queue.push(...points);
      pending.push({
        stop,
        kind,
        points,
        a,
        b: lengths(queue).at(-1)!,
        authoredStart,
        authoredEnd,
      });
    };
    const flush = (terminal = false) => {
      if (queue.length < 2) return;
      const run = new CineRun(
          queue,
          this.phases.length ? CRUISE : 0,
          terminal ? 0 : CRUISE,
          pending.filter(p=>p.kind==='contact'&&plan.stations.find(s=>s.stop===p.stop)!.mechanism.kind==='loop').map(p=>[p.a,p.b]as const),
        ),
        start = time;
      this.phases.push({ kind: "roll", start, end: start + run.duration, run });
      for (const p of pending) {
        const a = start + run.timeAt(p.a),
          b = start + run.timeAt(p.b);
        addSegment(
          p.stop,
          p.kind,
          p.points,
          a,
          b,
          p.authoredStart,
          p.authoredEnd,
        );
        if (p.kind === "contact") {
          const station=plan.stations.find(s=>s.stop===p.stop)!;
          this.contacts.push({
            stop: p.stop,
            start: a,
            contact: a,
            end: b,
            moverIds: station.terminalCapture?[`village-${p.stop}-damper`]:station.releasePin?[`village-${p.stop}-pin`]:[],
          });
        }
      }
      time += run.duration;
      queue = [];
      pending.length = 0;
    };
    for (let stop = 9; stop >= 0; stop--) {
      const s = plan.stations.find((s) => s.stop === stop)!,
        m = s.mechanism;
      if (isVillageTrack(m) || s.terminalCapture) {
        let points = isVillageTrack(m) ? m.points : [s.entry, s.exit];
        if (s.terminalCapture) {
          const path = new VillageTerminalPath(s);
          this.terminals.set(stop, path);
          const end =
              path.startDistance + s.terminalCapture.availableStroke * 0.55,
            p = new Vector3(),
            n = new Vector3(),
            t = new Vector3();
          path.at(end, p, t, n);
          points = [
            ...path.points.filter((_, i) => path.lengths[i]! < end),
            villagePort(p.toArray(), t.toArray(), n.toArray(), s.entry.width),
          ];
        }
        append(stop, "contact", points, s.start, s.end);
      } else {
        flush();
        const edges = carrierEdges(m),
          local = carrierContact(m),
          dir = Math.sign(local[0] - edges[0]) || 1,
          shape = VILLAGE_SHAPES[plan.chapter]?.[stop],
          held =
            s.initialCargo?.localX ??
            (s.strikerDrive?.kind === "pendulum"
              ? s.strikerDrive.axle.origin[0] -
                s.anchor[0] -
                s.strikerDrive.bar.radius *
                  Math.cos(Math.PI / s.strikerDrive.bar.facets) -
                0.3
              : s.retention
                ? (shape?.fork ?? 0.34) - dir * 0.34
                : local[0]),
          start = stop === 9 ? 0 : time,
          approach = s.initialCargo
            ? 0
            : Math.max(
                0.18,
                (2 * Math.abs(held - local[0] - edges[0])) / CRUISE,
              ),
          caught = time + approach;
        const clip: Clip = {
          station: s,
          start,
          catch: caught,
          ride: caught + 0.3,
          dock: 0,
          release: 0,
          end: 0,
          held,
          returnEnd: 0,
        };
        this.clips.set(stop, clip);
        if (s.initialCargo)
          this.phases.push({
            kind: "hold",
            start: 0,
            end: time,
            clip,
            x0: held,
            x1: held,
            ease: "hold",
          });
        else
          this.phases.push({
            kind: "deck",
            start: time,
            end: caught,
            clip,
            x0: local[0] + edges[0],
            x1: held,
            ease: "in",
          });
        const moving = hasVillageCarrier(m),
          p = new Vector3(held, local[1], local[2]),
          a = p
            .clone()
            .applyMatrix4(mechanismMatrix(m, s.anchor, 0, new Matrix4())),
          b = p
            .clone()
            .applyMatrix4(mechanismMatrix(m, s.anchor, 1, new Matrix4())),
          travel =
            m.kind === "wheelbucket"
              ? Math.abs(m.angle * m.radius)
              : "pivot" in m
                ? Math.abs(m.angle) * p.distanceTo(new Vector3(...m.pivot))
                : a.distanceTo(b),
          rideDuration = moving
            ? Math.max(1.1, travel / 2.2)
            : m.kind === "escapement"
              ? 0.65
              : m.kind === "striker"
                ? 0.24
                : 0.1;
        clip.dock = clip.ride + rideDuration;
        clip.release = clip.dock + 0.15;
        this.phases.push(
          {
            kind: "hold",
            start: caught,
            end: clip.ride,
            clip,
            x0: held,
            x1: held,
            ease: "hold",
          },
          {
            kind: "ride",
            start: clip.ride,
            end: clip.dock,
            clip,
            x0: held,
            x1: held,
            ease: "hold",
          },
          {
            kind: "hold",
            start: clip.dock,
            end: clip.release,
            clip,
            x0: held,
            x1: held,
            ease: "hold",
          },
        );
        const endX = stop === 0 ? held : local[0] + edges[1],
          departure =
            stop === 0
              ? 0
              : Math.max(0.18, (2 * Math.abs(endX - held)) / CRUISE);
        clip.end = clip.release + departure;
        clip.returnEnd = s.rollingDrive ? clip.end + 1.35 : m.kind==='striker'?clip.end+1.5:clip.end;
        if (departure)
          this.phases.push({
            kind: "deck",
            start: clip.release,
            end: clip.end,
            clip,
            x0: held,
            x1: endX,
            ease: "out",
          });
        time = clip.end;
        this.contacts.push({
          stop,
          start,
          contact: caught,
          end: time,
          moverIds: [
            ...(moving ? [`village-${stop}-carrier`] : []),
            ...(s.retention||['wheelbucket','translating','suspended'].includes(m.kind)?[`village-${stop}-weight`]:[]),
            ...(s.retention ? [`village-${stop}-fork`] : []),
            ...(s.retention&&VILLAGE_SHAPES[plan.chapter]?.[stop]?.role?[`village-${stop}-capture-head`]:[]),
            ...(s.retention&&VILLAGE_SHAPES[plan.chapter]?.[stop]?.layout==='keyed-prismatic'?[`village-${stop}-head-frame`]:[]),
            ...(m.kind==='wheelbucket'?[`village-${stop}-wheel`]:m.kind==='escapement'?[`village-${stop}-escapement`,`village-${stop}-gear`,`village-${stop}-top`,`village-${stop}-trip`]:m.kind==='striker'?[`village-${stop}-striker`]:[]),
          ],
        });
        addSegment(
          stop,
          "contact",
          [s.entry, s.exit],
          start,
          time,
          s.start,
          s.end,
        );
        if (moving)
          this.transfers.push({
            stop,
            kind: "carry",
            start: clip.ride,
            end: clip.dock,
          });
        if (m.kind === "striker")
          this.transfers.push({
            stop,
            kind: "strike",
            start: caught,
            end: clip.returnEnd,
          });
      }
      if (stop > 0) {
        const link = plan.connectors.find((l) => l.from === stop)!;
        append(
          stop,
          "connector",
          link.points,
          s.end,
          plan.stations.find((s) => s.stop === stop - 1)!.start,
        );
      }
    }
    flush(true);
    this.contacts.sort((a, b) => a.start - b.start);
    this.segments.sort((a, b) => a.start - b.start);
    this.boundaries.sort((a, b) => a.start - b.start);
    this.duration = Math.max(
      time + 1.2,
      ...[...this.clips.values()].map((c) => c.returnEnd),
    );
    this.plan = {
      ...plan,
      stations: plan.stations.map((s) => {
        const c = this.contacts.find((c) => c.stop === s.stop)!;
        return { ...s, start: c.start, contact: c.contact, end: c.end };
      }),
    };
    const first = plan.stations.find((s) => s.stop === 9)!,
      initial = first.initialCargo;
    let entry = first.entry;
    if (initial) {
      const p = new Vector3(initial.localX, 0, 0).applyMatrix4(
        mechanismMatrix(first.mechanism, first.anchor, 0, new Matrix4()),
      );
      entry = villagePort(
        p.toArray(),
        first.entry.tangent,
        first.entry.normal,
        first.entry.width,
      );
    }
    this.handoff = { entry, entryTime: 0, causeTime: 0.2 };
    this.buildOrientation();
  }
  requirePhysical(): never {
    throw Error("Cinematic playback is not a physical simulation");
  }
  private phase(t: number) {
    let lo = 0,
      hi = this.phases.length - 1;
    while (lo < hi) {
      const mid = (lo + hi) >>> 1;
      if (this.phases[mid]!.end < t) lo = mid + 1;
      else hi = mid;
    }
    return this.phases[lo]!;
  }
  private position(t: number, p: Vector3, n?: Vector3) {
    const ph = this.phase(Math.max(0, Math.min(this.duration, t)));
    if (ph.kind === "roll") {
      ph.run.at(ph.run.distanceAt(t - ph.start), p, n);
      return;
    }
    const c = ph.clip,
      s = c.station,
      local = carrierContact(s.mechanism),
      u = clamp((t - ph.start) / (ph.end - ph.start || 1)),
      f = ph.ease === "in" ? 1 - (1 - u) ** 2 : ph.ease === "out" ? u * u : 0,
      x = ph.x0 + (ph.x1 - ph.x0) * f;
    p.set(x, local[1], local[2]);
    this.carrierPose(s.stop, t, this.matrix);
    p.applyMatrix4(this.matrix);
    n?.set(0, 1, 0).transformDirection(this.matrix);
  }
  sample(t: number, p: Vector3) {
    if (!Number.isFinite(t)) throw Error("Village time must be finite");
    this.position(t, p);
    const at = Math.max(0, Math.min(this.duration, t)) * RATE,
      i = Math.min(this.distances.length - 1, Math.floor(at)),
      u = at - i;
    this.distance =
      this.distances[i]! +
      (this.distances[Math.min(i + 1, this.distances.length - 1)]! -
        this.distances[i]!) *
        u;
  }
  normalAt(t: number, n: Vector3) {
    if (!Number.isFinite(t)) throw Error("Village time must be finite");
    this.position(t, this.scratch, n);
  }
  carrierPose(stop: number, t: number, target: Matrix4) {
    const c = this.clips.get(stop),
      s = this.authoredPlan.stations.find((s) => s.stop === stop);
    if (!s) throw Error("Unknown village stop");
    let p = c ? clamp((t - c.ride) / (c.dock - c.ride)) : 0;
    if (c && s.rollingDrive && t > c.end)
      p = 1 - villageEase((t - c.end) / (c.returnEnd - c.end));
    return mechanismMatrix(s.mechanism, s.anchor, p, target);
  }
  private buildOrientation() {
    const previous = new Vector3(),
      point = new Vector3(),
      normal = new Vector3(),
      delta = new Vector3(),
      axis = new Vector3(),
      rotation = new Quaternion(),
      held = new Quaternion(),
      base = new Quaternion(),
      M = new Matrix4();
    this.position(0, previous, normal);
    this.quaternions.push(new Quaternion());
    this.distances.push(0);
    let last: Phase | undefined;
    const radius =
      this.plan.profile === "twinrail"
        ? 0.3 * Math.sqrt(1 - (0.22 / 0.355) ** 2)
        : 0.3;
    for (let i = 1; i <= Math.ceil(this.duration * RATE); i++) {
      const t = Math.min(this.duration, i / RATE),
        ph = this.phase(t);
      this.position(t, point, normal);
      delta.subVectors(point, previous);
      const q = this.quaternions.at(-1)!.clone();
      if (last?.kind === "ride" && last !== ph) {
        this.carrierPose(last.clip.station.stop, last.end, M);
        q.setFromRotationMatrix(M).multiply(base).multiply(held);
      }
      if (ph.kind === "ride") {
        if (last !== ph) {
          this.carrierPose(ph.clip.station.stop, ph.start, M);
          base.setFromRotationMatrix(M).invert();
          held.copy(q);
        }
        this.carrierPose(ph.clip.station.stop, t, M);
        q.setFromRotationMatrix(M).multiply(base).multiply(held);
      } else if (ph.kind === "roll" || ph.kind === "deck") {
        axis.crossVectors(normal, delta);
        if (axis.lengthSq() > 1e-20) {
          rotation.setFromAxisAngle(axis.normalize(), delta.length() / radius);
          q.premultiply(rotation).normalize();
        }
      }
      this.quaternions.push(q);
      this.distances.push(this.distances.at(-1)! + delta.length());
      previous.copy(point);
      last = ph;
    }
  }
  marbleOrientation(t: number, q: Quaternion) {
    const x = Math.max(0, Math.min(this.duration, t)) * RATE,
      i = Math.min(this.quaternions.length - 1, Math.floor(x));
    q.copy(this.quaternions[i]!).slerp(
      this.quaternions[Math.min(i + 1, this.quaternions.length - 1)]!,
      x - i,
    );
  }
  focus(stop: number, p: Vector3) {
    const c = this.contacts.find((c) => c.stop === stop);
    if (!c) throw Error("Unknown village stop");
    this.position(c.contact, p);
  }
  retainedSide(stop:number):1|-1 { return VILLAGE_SHAPES[this.plan.chapter]?.[stop]?.side??(this.authoredPlan.stations.find(s=>s.stop===stop)?.mechanism.kind==='wheelbucket'?1:-1); }
  retainedLayout(stop: number) {
    const s = this.authoredPlan.stations.find((s) => s.stop === stop);
    if (!s?.retention) throw Error("No retained assembly");
    return VILLAGE_SHAPES[this.plan.chapter]?.[stop]?.layout ?? "rigid-gate";
  }
  retainedHeadRole(stop: number) {
    return VILLAGE_SHAPES[this.plan.chapter]?.[stop]?.role ?? undefined;
  }
  retainedForkOrigin(stop: number) {
    return VILLAGE_SHAPES[this.plan.chapter]?.[stop]?.fork ?? 0.34;
  }
  terminalPad(stop: number) {
    return VILLAGE_SHAPES[this.plan.chapter]?.[stop]?.planar
      ? this.terminals.get(stop)?.pad
      : undefined;
  }
  terminalHeadPose(stop: number, t: number, M: Matrix4) {
    const path = this.terminals.get(stop);
    if (!path) throw Error("Unknown terminal");
    const p = new Vector3(),
      origin = new Vector3(),
      tangent = new Vector3();
    this.position(t, p);
    path.at(path.startDistance, origin, tangent);
    const compression = Math.max(
      0,
      Math.min(
        path.station.terminalCapture!.availableStroke * 0.55,
        p.sub(origin).dot(tangent),
      ),
    );
    path.headPose(path.startDistance + compression, M);
  }
  hasCompiledRetained() {
    return false;
  }
  axleMotion() {
    return undefined;
  }
  /** Film gearing keeps the visible hanging stroke finite, including long cable journeys. */
  weightStroke(stop:number):number {
    const s=this.authoredPlan.stations.find(s=>s.stop===stop);
    if(!s)throw Error('Unknown village stop');
    if(s.retention)return s.retention.weightDrop;
    const m=s.mechanism;
    const travel='travel'in m&&typeof m.travel!=='number'?Math.hypot(...m.travel)*.5:m.kind==='wheelbucket'?Math.abs(m.angle*m.radius)*.4:0;
    return Math.min(.8,travel);
  }
  auxiliaryPose(
    stop: number,
    part: VillageAuxiliary,
    t: number,
    out: VillageAuxiliaryPose,
  ) {
    out.angle = out.x = out.y = out.z = 0;
    const c = this.clips.get(stop),
      s = this.authoredPlan.stations.find((s) => s.stop === stop);
    if (!s) throw Error("Unknown village stop");
    const p = c ? villageEase((t - c.ride) / (c.dock - c.ride)) : 0,
      m = s.mechanism;
    if (s.releasePin && part === "gate") {
      out.y = 0.6 * villageEase((t - 0.2) / 0.5);
      return;
    }
    if (
      s.retention &&
      (part === "fork" || part === "capture-head" || part === "head-frame")
    ) {
      const direction =
          s.mechanism.kind === "wheelbucket" && s.mechanism.angle < 0 ? -1 : 1,
        first = s.retention.captureStart + direction * 0.34,
        last = this.retainedForkOrigin(stop),
        catchU = c ? villageEase((t - c.start) / (c.catch - c.start || 1)) : 0;
      out.x = first + (last - first) * catchU;
      const closed = c ? villageEase((t - c.catch) / 0.3) : 0,
        opened = c ? villageEase((t - c.dock) / 0.15) : 0;
      out.angle =
        part === "fork" ? ((-direction * Math.PI) / 2) * (1 - closed) : 0;
      const captive=this.retainedLayout(stop)==='keyed-prismatic';
      out.y = part === "head-frame" || captive&&part==='fork' ? 0 : (this.retainedSide(stop)===1 ? .45 : .6) * opened;
      return;
    }
    if (part === "wheel" && m.kind === "wheelbucket") out.angle = m.angle * p;
    else if (part === "weight") out.y=-this.weightStroke(stop)*p;
    else if (part === "top") out.angle = Math.PI * p;
    else if (part === "gear") out.angle = -Math.PI * p * (.1/.18);
    else if (part === "gate") out.y = 1.2 * p;
    else if (part === "striker" && c) {
      if (m.kind === "escapement") {
        out.angle = (Math.PI / 2) * villageEase((t - (c.catch - 0.25)) / 0.3);
        return;
      }
      const swing =
        villageEase((t - c.catch) / 0.35) *
        (1 - villageEase((t - c.end - 0.4) / 1.1));
      if (s.strikerDrive?.kind === "pendulum")
        out.angle = s.strikerDrive.stopAngle * swing;
      else {
        const stroke =
          s.strikerDrive?.stroke ?? (m.kind === "striker" ? m.travel : 0.5);
        out.angle = -1.4 * stroke * swing;
        out.x = stroke * swing;
        out.z = -2 * stroke * swing;
      }
    }
  }
}
