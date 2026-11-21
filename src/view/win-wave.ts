import * as THREE from 'three';
import type { Point3 } from '../engine/physics';
import type { Sparks } from '../engine/sparks';

interface FinishedPiece { index: number; at: Point3; tint: number }

/** The load starts the celebration on contact. Its neighbours answer, furthest first, then the load takes the last bow. */
export function waveOrder(points: readonly { index: number; x: number; y: number }[], last: number) {
  const origin = points.find(p => p.index === last) ?? points.at(-1);
  if (!origin) return [];
  const distance = (p: typeof origin) => Math.hypot(p.x - origin.x, p.y - origin.y);
  return [...points].sort((a, b) => distance(b) - distance(a) || Number(a.index === last) - Number(b.index === last) || a.index - b.index)
    .map((p, i) => ({ index: p.index, delay: .06 + .72 * i / Math.max(1, points.length - 1) }));
}

export class WinWave {
  private age = 0;
  private beats: (FinishedPiece & { delay: number })[] = [];
  private next = 0;
  private share = 1;
  last = -1;

  start(pieces: readonly FinishedPiece[], corners: readonly Point3[], camera: THREE.Camera, sparks: Sparks, share: number, still: boolean): void {
    this.clear();
    if (still) return;
    this.share = share;
    const projected = pieces.map(p => {
      const v = new THREE.Vector3(p.at.x, p.at.y, p.at.z).project(camera);
      return { index: p.index, x: v.x * innerWidth, y: v.y * innerHeight };
    });
    this.beats = waveOrder(projected, this.last).map(beat => ({ ...pieces.find(p => p.index === beat.index)!, ...beat }));
    sparks.finish(corners, share, camera, innerWidth, innerHeight);
  }

  step(dt: number, sparks: Sparks): void {
    if (!this.active) return;
    this.age += dt;
    while (this.next < this.beats.length && this.beats[this.next]!.delay <= this.age) {
      const beat = this.beats[this.next++]!;
      if (this.share >= 1) sparks.land(beat.at, beat.tint);
    }
  }

  progress(index: number): number {
    if (!this.active) return 1;
    const beat = this.beats.find(b => b.index === index);
    return beat ? Math.min(1, Math.max(0, (this.age - beat.delay) / .14)) : 1;
  }

  pulse(index: number): number {
    if (!this.active) return 0;
    const beat = this.beats.find(b => b.index === index);
    if (!beat) return 0;
    const t = Math.max(0, Math.min(1, (this.age - beat.delay) / .34));
    return Math.sin(Math.PI * t) * this.share;
  }

  get active(): boolean { return this.beats.length > 0 && this.age < 1.18; }
  clear(): void { this.beats = []; this.next = 0; this.age = 0; }
}
