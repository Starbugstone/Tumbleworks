import type { Stage } from '../engine/stage';
import { CONNECTION_SECONDS } from '../world/film-timeline';
import { type WorldSceneOptions, WorldScene } from './world-scene';

/** The new section runs downhill into the preceding place, rather than ending as an unrelated clip. */
export class WorldFilm {
  readonly duration: number;
  private begun = false;
  private readonly current: WorldScene;
  private readonly previous: WorldScene | null;
  private readonly ownsCurrent: boolean;
  private readonly ownsPrevious: boolean;

  /** `previous` given (WorldView): the caller owns it. Omitted (legacy/tests): built here and owned. */
  constructor(stage: Stage, chapter: number, current?: WorldScene, previous?: WorldScene | null, options: WorldSceneOptions = {}) {
    this.current = current ?? new WorldScene(stage, chapter, options);
    this.current.finishConstruction();
    this.ownsCurrent = !current;
    if (this.ownsCurrent) this.current.activateProof();
    this.ownsPrevious = previous === undefined;
    this.previous = previous !== undefined ? previous : chapter > 0 ? new WorldScene(stage, chapter - 1, options) : null;
    if (this.ownsPrevious) this.previous?.activateProof();
    this.duration = this.current.machine.route.duration + (this.previous ? CONNECTION_SECONDS : 0);
    this.resize();
  }
  resize(): void { this.current.resize(); this.previous?.resize(); }
  /** Every scene must be ready under its explicitly selected playback model. */
  readiness(): 'ready' | 'pending' | 'failed' {
    const states = [this.current.filmReadiness(), this.previous?.filmReadiness() ?? 'ready'];
    return states.includes('failed') ? 'failed' : states.includes('pending') ? 'pending' : 'ready';
  }
  /** Physical research rechecks certificates; cinematic playback never asks for them. */
  begin(): boolean {
    if (this.readiness() !== 'ready') return false;
    try { this.current.beginFilm(); this.previous?.beginFilm(); this.begun = true; return true; } catch (error) { console.error(error); return false; }
  }
  poster(cameraMotion = true): void { this.current.filmPoster(cameraMotion); }
  render(seconds: number, cameraMotion = true): void {
    if (!this.begun) throw new Error('Film supports are not confirmed');
    if (seconds < this.current.machine.route.duration || !this.previous) this.current.film(seconds, cameraMotion);
    else { this.current.stopFilm(); this.previous.handoff(seconds - this.current.machine.route.duration); }
  }
  dispose(): void {
    this.begun = false;
    if (this.ownsCurrent) this.current.dispose(); else this.current.stopFilm();
    if (this.ownsPrevious) this.previous?.dispose(); else this.previous?.stopFilm();
  }
}
