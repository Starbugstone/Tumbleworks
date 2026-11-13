import type * as THREE from 'three';

const SECONDS = 0.28;

/**
 * A brief camera jolt, kept for the exceptional moment: the top of a streak. It adds a small damped
 * offset to wherever the camera already stands and takes it away again, so framing is never disturbed.
 */
export class Shake {
  private age = SECONDS;
  private strength = 0;
  private x = 0;
  private y = 0;
  private readonly reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  kick(strength = 0.07): void {
    if (this.reducedMotion) return;
    this.age = 0;
    this.strength = strength;
  }

  get active(): boolean { return this.age < SECONDS; }

  apply(camera: THREE.Camera, seconds: number): void {
    camera.position.x -= this.x;
    camera.position.y -= this.y;
    this.x = this.y = 0;
    if (this.age >= SECONDS) return;
    this.age = Math.min(SECONDS, this.age + Math.max(0, seconds));
    const fade = 1 - this.age / SECONDS;
    this.x = Math.sin(this.age * 95) * this.strength * fade * fade;
    this.y = Math.cos(this.age * 78) * this.strength * 0.6 * fade * fade;
    camera.position.x += this.x;
    camera.position.y += this.y;
  }

  clear(camera: THREE.Camera): void {
    camera.position.x -= this.x;
    camera.position.y -= this.y;
    this.x = this.y = 0;
    this.age = SECONDS;
  }
}
