// Builds one WorldScene cooperatively: the SAME constructor operations in the SAME order,
// as bounded main-thread slices. Never exposes a partial scene. Cancel releases every
// partial resource (the generator's finally disposes the half-built scene).
import type { Stage } from '../engine/stage';
import { browserScheduler, cooperate, SLICE_MS, type CooperativeRun, type CooperativeState, type TaskScheduler } from './cooperative';
import { WorldScene, type WorldSceneOptions } from './world-scene';

const MARK = 'tumbleworks:scene-build:';
let builds = 0;

export class SceneBuild {
  readonly serial = ++builds;
  private readonly run: CooperativeRun<WorldScene>;
  private taken = false;
  private cancelled = false;
  private listener: (() => void) | undefined;

  constructor(readonly chapter: number, stage: Stage, options: WorldSceneOptions = {},
    scheduler: TaskScheduler = options.scheduler ?? browserScheduler(), budgetMs = SLICE_MS) {
    performance.mark(MARK + 'start', { detail: { chapter, serial: this.serial } });
    this.run = cooperate(WorldScene.construct(stage, chapter, { ...options, scheduler }), scheduler, budgetMs, run => {
      // A cancel requested during the final step lands here as done: release the result, report cancelled.
      if (this.cancelled && run.result!==undefined) { run.result!.dispose(); this.taken = true; }
      performance.mark(MARK + (this.cancelled ? 'cancelled' : run.state), { detail: { chapter, serial: this.serial, slices: run.slices, longestSliceMs: run.longestSliceMs } });
      if (run.state === 'failed') console.error('Village could not be built', run.error);
      if (!this.cancelled) this.listener?.();
    });
  }
  get state(): CooperativeState { return this.cancelled ? 'cancelled' : this.run.state; }
  get error(): unknown { return this.run.error; }
  get slices(): { readonly count: number; readonly longestMs: number } { return { count: this.run.slices, longestMs: this.run.longestSliceMs }; }
  /** Single listener; called once when the build is done or failed, never after cancel(). */
  onSettled(listener: () => void): void { this.listener = listener; }
  /** Hands the complete scene to its owner. Exactly once, only when done. */
  take(): WorldScene {
    if (this.run.state !== 'done' || this.taken || this.cancelled) throw Error('Village scene is not built');
    this.taken = true; return this.run.result!;
  }
  cancel(): void {
    if (this.cancelled) return;
    this.cancelled = true; this.listener = undefined;
    if (this.run.state === 'done' && !this.taken) { this.run.result!.dispose(); this.taken = true; return; }
    this.run.cancel();
  }
}
