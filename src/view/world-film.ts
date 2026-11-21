import type { Stage } from '../engine/stage';
import { type WorldSceneOptions, WorldScene } from './world-scene';

/**
 * One village's film, start to finish. It used to close on 2.5 seconds of the preceding village; the
 * owner took that for the start of another level, so a film now ends in its own village.
 */
export class WorldFilm {
  readonly duration: number;
  readonly bellStrike: number | undefined;
  private begun = false;
  private readonly current: WorldScene;
  private readonly ownsCurrent: boolean;

  /** `current` given (WorldView): the caller owns it. Omitted (scripts/tests): built here and owned. */
  constructor(stage: Stage, chapter: number, current?: WorldScene, options: WorldSceneOptions = {}) {
    this.current = current ?? new WorldScene(stage, chapter, options);
    this.current.finishConstruction();
    this.ownsCurrent = !current;
    if (this.ownsCurrent) this.current.activateProof();
    this.duration = this.current.machine.route.duration;
    this.bellStrike = chapter === 0 ? this.current.machine.route.transfers.find(t => t.kind === 'strike')?.start : undefined;
    this.resize();
  }
  resize(): void { this.current.resize(); }
  /** The scene must be ready under its explicitly selected playback model. */
  readiness(): 'ready' | 'pending' | 'failed' { return this.current.filmReadiness(); }
  /** Physical research rechecks certificates; cinematic playback never asks for them. */
  begin(): boolean {
    if (this.readiness() !== 'ready') return false;
    try { this.current.beginFilm(); this.begun = true; return true; } catch (error) { console.error(error); return false; }
  }
  poster(cameraMotion = true): void { this.current.filmPoster(cameraMotion); }
  render(seconds: number, cameraMotion = true): void {
    if (!this.begun) throw new Error('Film supports are not confirmed');
    this.current.film(seconds, cameraMotion);
  }
  dispose(): void {
    this.begun = false;
    if (this.ownsCurrent) this.current.dispose(); else this.current.stopFilm();
  }
}
