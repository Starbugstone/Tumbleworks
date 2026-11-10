// TEST-ONLY TaskScheduler: tasks run only when the test drains them, so construction,
// snapshot and acceptance can be interleaved with hide/return/mutation/stale replies.
// It is not evidence of browser scheduling, input servicing or frame timing.
import type { TaskScheduler } from '../../src/view/cooperative';

export class ManualScheduler implements TaskScheduler {
  private readonly queue: { task: () => void; live: boolean }[] = [];
  /** Advances by `tick` on every read, so a budget of 0 ends a slice after each step. */
  constructor(private time = 0, private readonly tick = 0, readonly diagnosticSteps = false) {}
  post(task: () => void): () => void { const entry = { task, live: true }; this.queue.push(entry); return () => { entry.live = false; }; }
  now(): number { return this.time += this.tick; }
  get pending(): number { return this.queue.filter(entry => entry.live).length; }
  /** Runs one queued task. False when idle. */
  step(): boolean { for (;;) { const entry = this.queue.shift(); if (!entry) return false; if (entry.live) { entry.task(); return true; } } }
  /** Runs until idle; aborts rather than spin forever. */
  drain(limit = 1_000_000): number { let n = 0; while (this.step()) if (++n >= limit) throw new Error('Scheduler did not go idle'); return n; }
}
