// Frozen pre-cinematic camera; only the imports were relocated.
import { Box3, PerspectiveCamera, Vector3 } from 'three';
import { VILLAGE_RADIUS, type VillageCameraShot } from '../../src/world/village-plan';
import { villageFilmShots, type VillageCameraTimeline } from '../../src/view/village-film-shots';

export interface VillageCameraMachine {
  sample(seconds: number, target: Vector3): void;
  /** All machine geometry and travel, including the complete outgoing connectors. */
  bounds(target: Box3): void;
  /** Complete linkage envelope, including both extremes of every moving carrier. */
  contactBounds(stop: number, target: Box3): void;
}

interface Orientation {
  readonly target: Vector3;
  readonly yaw: number;
  readonly elevation: number;
}

interface Pose extends Orientation {
  distance: number;
}

const RATE = 30;
const REST_ELEVATION = 50 * Math.PI / 180;
const FOLLOW_ELEVATION = 40 * Math.PI / 180;
const VERTICAL_TAN = Math.tan(34 * Math.PI / 360);
const smooth = (value: number): number => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
};
const cubic = (a: number, b: number, c: number, d: number, t: number): number =>
  b + 0.5 * t * (c - a + t * (2 * a - 5 * b + 4 * c - d + t * (3 * (b - c) + d - a)));

function corners(box: Box3): Vector3[] {
  if (box.isEmpty()) throw new Error('Village camera requires complete nonempty linkage bounds');
  return Array.from({ length: 8 }, (_, index) => new Vector3(
    index & 1 ? box.max.x : box.min.x, index & 2 ? box.max.y : box.min.y, index & 4 ? box.max.z : box.min.z));
}

/** Seekable choreography: route, carrier envelopes and fitting are cached before playback. */
export class VillageFilmCamera {
  readonly restTarget: Vector3;
  readonly restElevation = REST_ELEVATION;
  restDistance = 66;
  followDistance = 0;
  private readonly target = new Vector3();
  private readonly point = new Vector3();
  private readonly contacts: readonly { start: number; end: number; points: readonly Vector3[] }[];
  private readonly route: readonly Vector3[];
  private readonly poses: readonly Orientation[];
  private readonly followTargets: readonly Vector3[];
  readonly shots: readonly VillageCameraShot[];
  private readonly fixedPoses: readonly Pose[];
  private readonly duration: number;
  private readonly routeSteps: number;
  private readonly poseSteps: number;
  private readonly shotPoints: readonly (readonly Vector3[])[];
  private readonly allPoints: readonly Vector3[];
  private readonly entrySeconds: number;
  private readonly exitSeconds: number;
  private logRestDistance = 0;
  private logFollowDistance = 0;
  private aspect = 0;

  constructor(machine: VillageCameraMachine, timeline: VillageCameraTimeline) {
    this.shots = villageFilmShots(timeline);
    this.duration = timeline.duration;
    this.entrySeconds = Math.min(4, this.duration / 3);
    const lastTransfer = Math.max(0, ...timeline.transfers.map(transfer => transfer.end));
    this.exitSeconds = Math.min(this.duration / 3, Math.max(3, Math.min(4, this.duration - lastTransfer)));
    this.routeSteps = Math.ceil(this.duration * 120);
    this.poseSteps = Math.ceil(this.duration * RATE);
    this.restTarget = new Vector3(...this.shots[0]!.target);
    const box = new Box3();
    this.contacts = timeline.contacts.map(contact => {
      machine.contactBounds(contact.stop, box);
      const end = Math.max(contact.end, ...timeline.transfers.filter(transfer => transfer.stop === contact.stop).map(transfer => transfer.end));
      return { start: contact.contact, end, points: corners(box) };
    });
    this.route = Array.from({ length: this.routeSteps + 1 }, (_, frame) => {
      const point = new Vector3();
      machine.sample(frame === this.routeSteps ? this.duration : this.duration * frame / this.routeSteps, point); return point;
    });
    machine.bounds(box);
    this.allPoints = [...corners(box), ...this.route, ...this.contacts.flatMap(contact => contact.points)];
    this.fixedPoses = this.shots.map((shot, index) => ({
      target: index === 0 || index === this.shots.length - 1 ? this.restTarget : new Vector3(...shot.target),
      yaw: index === 0 || index === this.shots.length - 1 ? 0 : shot.yaw,
      elevation: index === 0 || index === this.shots.length - 1 ? REST_ELEVATION : shot.elevation,
      distance: shot.radius,
    }));
    this.shotPoints = this.shots.map((shot, index) => {
      if (index === 0 || index === this.shots.length - 1) return this.allPoints;
      const points = this.route.slice(Math.floor(shot.start / this.duration * this.routeSteps), Math.ceil(shot.end / this.duration * this.routeSteps) + 1);
      for (const contact of this.contacts) if (contact.start - 0.3 <= shot.end && contact.end >= shot.start) points.push(...contact.points);
      return points;
    });
    const forward = new Vector3(0, Math.sin(FOLLOW_ELEVATION), Math.cos(FOLLOW_ELEVATION));
    this.followTargets = Array.from({ length: this.poseSteps + 1 }, (_, frame) => {
      const time = this.duration * frame / this.poseSteps, target = new Vector3(), depthTarget = new Vector3();
      let total = 0;
      for (let tap = -16; tap <= 16; tap++) {
        const offset = tap * 0.05, weight = Math.exp(-0.5 * (offset / 0.35) ** 2);
        this.sampleRoute(time + offset + 0.2, this.point); target.addScaledVector(this.point, weight);
        this.sampleRoute(time + offset, this.point); depthTarget.addScaledVector(this.point, weight);
        total += weight;
      }
      target.divideScalar(total); depthTarget.divideScalar(total);
      // Anticipate the route across the screen, never toward or away from the lens.
      target.addScaledVector(forward, depthTarget.dot(forward) - target.dot(forward));
      return target;
    });
    this.poses = this.followTargets.map((follow, frame) => {
      const time = this.duration * frame / this.poseSteps, approach = this.approach(time);
      const target = this.restTarget.clone().lerp(follow, approach);
      if (frame === 0 || frame === this.poseSteps) target.copy(this.restTarget);
      return { target, yaw: 0,
        elevation: REST_ELEVATION + (FOLLOW_ELEVATION - REST_ELEVATION) * approach };
    });
    this.resize(375 / 690);
  }

  resize(aspect: number): void {
    if (!Number.isFinite(aspect) || aspect <= 0) throw new Error('Village camera aspect must be finite and positive');
    if (aspect === this.aspect) return;
    this.aspect = aspect;
    const rest: Pose = { target: this.restTarget, yaw: 0, elevation: REST_ELEVATION, distance: this.shots[0]!.radius };
    this.restDistance = this.fit(rest, this.allPoints, rest.distance) + 0.5;
    for (let index = 0; index < this.shots.length; index++) {
      const shot = this.fixedPoses[index]!;
      shot.distance = index === 0 || index === this.shots.length - 1 ? this.restDistance
        : this.fit(shot, this.shotPoints[index]!, this.shots[index]!.radius);
    }
    let followDistance = 0;
    for (let index = 0; index < this.followTargets.length; index++) {
      const time = this.duration * index / this.poseSteps;
      const pose: Pose = { target: this.followTargets[index]!, yaw: 0, elevation: FOLLOW_ELEVATION, distance: 0 };
      followDistance = this.requiredDistance(pose, time, followDistance);
      const blend = this.approach(time);
      if (blend > 0 && blend < 1) {
        const required = this.requiredDistance(this.poses[index]!, time, 0) + 0.2;
        // Fit the entire entry/exit too, by enlarging this one constant distance.
        // There is no per-contact or per-frame correction during playback.
        const minimum = Math.exp((Math.log(required) - (1 - blend) * Math.log(this.restDistance)) / blend);
        followDistance = Math.max(followDistance, minimum);
      }
    }
    this.followDistance = followDistance + 0.2;
    this.logRestDistance = Math.log(this.restDistance);
    this.logFollowDistance = Math.log(this.followDistance);
  }

  frame(camera: PerspectiveCamera, seconds: number, cameraMotion = true): void {
    this.apply(camera, seconds, cameraMotion);
  }

  apply(camera: PerspectiveCamera, seconds: number, cameraMotion = true): void {
    if (!Number.isFinite(seconds)) throw new Error('Village film time must be finite');
    const time = Math.max(0, Math.min(this.duration, seconds));
    if (!cameraMotion) {
      let index = 0;
      while (index + 1 < this.shots.length && time >= this.shots[index]!.end) index++;
      const shot = this.fixedPoses[index]!;
      this.target.copy(shot.target); this.pose(camera, shot.distance, shot.elevation, shot.yaw); return;
    }
    const at = Math.min(this.poseSteps, time / this.duration * this.poseSteps), index = Math.floor(at), fraction = at - index;
    const a = this.poses[Math.max(0, index - 1)]!, b = this.poses[index]!;
    const c = this.poses[Math.min(this.poses.length - 1, index + 1)]!, d = this.poses[Math.min(this.poses.length - 1, index + 2)]!;
    this.target.set(cubic(a.target.x, b.target.x, c.target.x, d.target.x, fraction),
      cubic(a.target.y, b.target.y, c.target.y, d.target.y, fraction), cubic(a.target.z, b.target.z, c.target.z, d.target.z, fraction));
    this.pose(camera, this.distanceAt(time),
      cubic(a.elevation, b.elevation, c.elevation, d.elevation, fraction), cubic(a.yaw, b.yaw, c.yaw, d.yaw, fraction));
  }

  private sampleRoute(seconds: number, target: Vector3): void {
    const at = Math.max(0, Math.min(this.routeSteps, seconds / this.duration * this.routeSteps));
    const index = Math.floor(at);
    target.copy(this.route[index]!).lerp(this.route[Math.min(index + 1, this.routeSteps)]!, at - index);
  }

  private approach(seconds: number): number {
    return smooth(seconds / this.entrySeconds) * smooth((this.duration - seconds) / this.exitSeconds);
  }

  private distanceAt(seconds: number): number {
    if (seconds <= 0 || seconds >= this.duration) return this.restDistance;
    return Math.exp(this.logRestDistance + (this.logFollowDistance - this.logRestDistance) * this.approach(seconds));
  }

  private fit(pose: Orientation, points: readonly Vector3[], minimum: number): number {
    let distance = minimum;
    for (const point of points) distance = this.fitPoint(pose, point, distance);
    return distance;
  }

  private requiredDistance(pose: Orientation, time: number, minimum: number): number {
    let distance = minimum;
    const first = Math.max(0, Math.floor((time - 0.25) / this.duration * this.routeSteps));
    const last = Math.min(this.routeSteps, Math.ceil((time + 0.3) / this.duration * this.routeSteps));
    for (let at = first; at <= last; at++) distance = this.fitPoint(pose, this.route[at]!, distance);
    for (const contact of this.contacts) if (time >= contact.start - 0.9 && time <= contact.end + 0.6) {
      distance = this.fit(pose, contact.points, distance);
    }
    return distance;
  }

  private fitPoint(pose: Orientation, point: Vector3, minimum: number): number {
    const dx = point.x - pose.target.x, dy = point.y - pose.target.y, dz = point.z - pose.target.z;
    const sy = Math.sin(pose.yaw), cy = Math.cos(pose.yaw), se = Math.sin(pose.elevation), ce = Math.cos(pose.elevation);
    const x = cy * dx - sy * dz, y = -se * sy * dx + ce * dy - se * cy * dz;
    const forward = ce * sy * dx + se * dy + ce * cy * dz;
    const horizontal = VERTICAL_TAN * this.aspect * 0.84;
    const vertical = VERTICAL_TAN * (y >= 0 ? 0.74 : 0.64);
    return Math.max(minimum, forward + (Math.abs(x) + VILLAGE_RADIUS * Math.sqrt(1 + horizontal * horizontal)) / horizontal,
      forward + (Math.abs(y) + VILLAGE_RADIUS * Math.sqrt(1 + vertical * vertical)) / vertical);
  }

  private pose(camera: PerspectiveCamera, distance: number, elevation: number, yaw: number): void {
    const horizontal = Math.cos(elevation) * distance;
    camera.position.set(this.target.x + Math.sin(yaw) * horizontal,
      this.target.y + Math.sin(elevation) * distance, this.target.z + Math.cos(yaw) * horizontal);
    camera.lookAt(this.target);
    if (camera.fov !== 34 || camera.zoom !== 1 || camera.aspect !== this.aspect) {
      camera.fov = 34; camera.zoom = 1; camera.aspect = this.aspect; camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  }
}
