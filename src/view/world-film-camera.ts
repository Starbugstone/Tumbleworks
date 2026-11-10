import { PerspectiveCamera, Vector3 } from 'three';
import { RUBE_BEATS, RUBE_DURATION, RUBE_RADIUS, RUBE_REDUCED_CUTS } from '../world/rube-sequence';
import { findWorkshopPass, WORKSHOP_BUILDING } from '../world/workshop-building';

export interface FilmCameraRoute {
  sample(seconds: number, target: Vector3): void;
  focus(stop: number, target: Vector3): void;
}

const REST_DISTANCE = 66;
const REST_ELEVATION = 50 * Math.PI / 180;
const FOLLOW_ELEVATION = 36 * Math.PI / 180;
const smooth = (value: number): number => {
  const t = Math.max(0, Math.min(1, value));
  return t * t * t * (t * (t * 6 - 15) + 10);
};

const cubic = (p: number, q: number, r: number, s: number, fraction: number): number =>
  q + 0.5 * fraction * (r - p + fraction * (2 * p - 5 * q + 4 * r - s + fraction * (3 * (q - r) + s - p)));

/** Seekable camera choreography. All scratch storage belongs to the camera, never a frame. */
export class WorldFilmCamera {
  private readonly before = new Vector3();
  private readonly after = new Vector3();
  private readonly target = new Vector3();
  private readonly mechanism = new Vector3();
  private readonly rest = new Vector3(0, 2.5, 0);
  private readonly shots: readonly Vector3[];
  private readonly follow: readonly Vector3[];
  private shotDistances: readonly number[] = [];
  private aspect = 0;
  private readonly shotPoints: readonly (readonly Vector3[])[];

  constructor(private readonly route: FilmCameraRoute) {
    // Filter the piecewise sampled route once; cubic interpolation keeps camera velocity
    // continuous across channel vertices without inheriting marble contact jolts.
    this.follow = Array.from({ length: RUBE_DURATION * 20 + 1 }, (_, index) => {
      const point = new Vector3();
      let total = 0;
      for (let tap = 0; tap <= 16; tap++) {
        const offset = -0.3 + tap * 0.05;
        const weight = Math.exp(-(((offset - 0.1) / 0.22) ** 2));
        route.sample(Math.max(0, Math.min(RUBE_DURATION, index / 20 + offset)), this.before);
        point.addScaledVector(this.before, weight); total += weight;
      }
      return point.divideScalar(total);
    });
    const shots = [this.rest.clone()];
    for (let stop = 9; stop >= 1; stop -= 2) {
      route.focus(stop, this.before); route.focus(stop - 1, this.after);
      shots.push(new Vector3().addVectors(this.before, this.after).multiplyScalar(0.5));
    }
    shots.push(this.rest.clone());
    this.shots = shots;
    const workshopPass = findWorkshopPass((seconds, point) => route.sample(seconds, point), this.before);
    this.shotPoints = shots.map((_, index) => {
      if (index === 0 || index === shots.length - 1) return [];
      const start = RUBE_REDUCED_CUTS[index]!, end = RUBE_REDUCED_CUTS[index + 1]!;
      const steps = Math.ceil((end - start) * 240);
      const points = Array.from({ length: steps + 1 }, (_, frame) => {
        const point = new Vector3();
        route.sample(start + (end - start) * frame / steps, point);
        return point.sub(shots[index]!);
      });
      if (start <= workshopPass + 0.34 && end >= workshopPass - 0.06) {
        const { pivot, drop } = WORKSHOP_BUILDING;
        points.push(new Vector3(pivot.x, pivot.y - drop, pivot.z).sub(shots[index]!));
      }
      return points;
    });
    this.resize(375 / 690);
  }

  resize(aspect: number): void {
    if (!Number.isFinite(aspect) || aspect <= 0) throw new Error('Film camera aspect must be finite and positive');
    if (aspect === this.aspect) return;
    this.aspect = aspect;
    const vertical = Math.tan(34 * Math.PI / 360), horizontal = vertical * aspect;
    this.shotDistances = this.shotPoints.map((points, index) => {
      if (index === 0 || index === this.shots.length - 1) return REST_DISTANCE;
      let distance = 28;
      // Refit cached sphere centres only on viewport changes, never while drawing a frame.
      for (const point of points) {
        const y = Math.cos(REST_ELEVATION) * point.y - Math.sin(REST_ELEVATION) * point.z;
        const forward = Math.sin(REST_ELEVATION) * point.y + Math.cos(REST_ELEVATION) * point.z;
        distance = Math.max(distance,
          forward + (Math.abs(point.x) + RUBE_RADIUS * Math.sqrt(1 + horizontal * horizontal)) / horizontal,
          forward + (Math.abs(y) + RUBE_RADIUS * Math.sqrt(1 + vertical * vertical)) / vertical);
      }
      return Math.ceil((distance + 0.1) * 10) / 10;
    });
  }

  apply(camera: PerspectiveCamera, seconds: number, reducedMotion: boolean): void {
    const time = Math.max(0, Math.min(RUBE_DURATION, seconds));
    if (reducedMotion) {
      let shot = 0;
      for (let index = 1; index < RUBE_REDUCED_CUTS.length; index++) {
        if (time >= RUBE_REDUCED_CUTS[index]!) shot = index;
      }
      this.target.copy(this.shots[shot]!);
      this.pose(camera, this.shotDistances[shot]!, REST_ELEVATION, 0);
      return;
    }

    const at = time * 20, index = Math.floor(at), fraction = at - index;
    const a = this.follow[Math.max(0, index - 1)]!, b = this.follow[index]!;
    const c = this.follow[Math.min(this.follow.length - 1, index + 1)]!;
    const d = this.follow[Math.min(this.follow.length - 1, index + 2)]!;
    this.target.set(cubic(a.x, b.x, c.x, d.x, fraction), cubic(a.y, b.y, c.y, d.y, fraction), cubic(a.z, b.z, c.z, d.z, fraction));
    let distance = 22;
    // Each focus has a smooth envelope, including when seeking backwards over a contact.
    for (const beat of RUBE_BEATS) {
      // A full centroid lock clips the incoming marble on the phone's narrow aspect.
      // Share focus with its smoothed route instead of panning to the next machine early.
      const weight = 0.5 * smooth((time - (beat.contact - 0.5)) / 0.2)
        * (1 - smooth((time - (beat.contact + 0.3)) / 0.7));
      if (weight === 0) continue;
      this.route.focus(beat.stop, this.mechanism);
      this.target.lerp(this.mechanism, weight);
      distance += (20 - distance) * weight;
    }
    const approach = smooth(time / 4) * smooth((RUBE_DURATION - time) / 3);
    this.target.lerp(this.rest, 1 - approach);
    distance = REST_DISTANCE + (distance - REST_DISTANCE) * approach;
    const elevation = REST_ELEVATION + (FOLLOW_ELEVATION - REST_ELEVATION) * approach;
    const yaw = Math.sin(time / RUBE_DURATION * Math.PI * 2) * 5 * Math.PI / 180 * approach;
    this.pose(camera, distance, elevation, yaw);
  }

  private pose(camera: PerspectiveCamera, distance: number, elevation: number, yaw: number): void {
    const horizontal = Math.cos(elevation) * distance;
    camera.position.set(this.target.x + Math.sin(yaw) * horizontal,
      this.target.y + Math.sin(elevation) * distance, this.target.z + Math.cos(yaw) * horizontal);
    camera.lookAt(this.target);
    if (camera.fov !== 34 || camera.zoom !== 1) {
      camera.fov = 34; camera.zoom = 1; camera.updateProjectionMatrix();
    }
    camera.updateMatrixWorld();
  }
}
