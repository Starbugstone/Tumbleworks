import * as THREE from 'three';

/** Leave the sheltered inlet stern-first, turn outside the headland and come home.
 * The closing part of the curve is tangent to the first, so the bow stays put at anchor. */
const voyage = new THREE.CatmullRomCurve3([
  [-.5, 12.8], [-.45, 16.2], [1.1, 18.3], [5.3, 19.0], [8.6, 18.0],
  [8, 16.9], [4.6, 17.5], [.6, 17.1], [-.85, 15.1],
].map(([x,z]) => new THREE.Vector3(x, 0, z)), true);

export class HarbourLaunch {
  private readonly point = new THREE.Vector3();
  private readonly heading = new THREE.Vector3();
  /** World XZ, heading and speed for the wake on the single water surface. */
  readonly wake = new THREE.Vector4();

  constructor(readonly boat: THREE.Group) { this.pose(0); }

  pose(seconds: number): void {
    const t = THREE.MathUtils.clamp((seconds % 49 - 3) / 32, 0, 1);
    const distance = t * t * (3 - 2 * t);
    voyage.getPointAt(distance, this.point);
    voyage.getTangentAt(distance, this.heading);
    const yaw = Math.atan2(this.heading.x, this.heading.z);
    this.boat.position.set(this.point.x, -.25 + .025 * Math.sin(seconds * 1.8), this.point.z);
    this.boat.rotation.set(0.018 * Math.sin(seconds * 1.3), yaw + Math.PI / 2, 0.026 * Math.sin(seconds * 1.5));
    this.wake.set(this.point.x, this.point.z, yaw, 4 * t * (1 - t));
  }
}
