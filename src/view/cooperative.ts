// Runs a generator of ordered construction/validation steps in bounded main-thread
// slices. A `yield` marks a point where the browser may handle input and draw a frame
// before the next step. Steps are never reordered, skipped, merged or retried here:
// the generator body is the original code, in its original order.

export interface TaskScheduler {
  /** Explicit test/profile opt-in; the shipped browser scheduler leaves this off. */
  readonly diagnosticSteps?: boolean;
  /** Runs `task` in a later macrotask (never synchronously). Returns a canceller. */
  post(task: () => void): () => void;
  now(): number;
}

/** One shared MessageChannel: each post is one macrotask, so pending input and
 *  rendering get their turn between slices (setTimeout would clamp to 4 ms). */
export function browserScheduler(): TaskScheduler {
  return shared ??= (() => {
    const queue: { task: () => void; live: boolean }[] = [];
    let channel: MessageChannel | undefined; // opened on the first post only: idle owners hold no port
    return {
      post(task) {
        if (!channel) { channel = new MessageChannel(); channel.port1.onmessage = () => { const entry = queue.shift(); if (entry?.live) entry.task(); }; }
        const entry = { task, live: true }; queue.push(entry); channel.port2.postMessage(null);
        return () => { entry.live = false; };
      },
      now: () => performance.now(),
    };
  })();
}
let shared: TaskScheduler | undefined;
let measures=0;

export type CooperativeState = 'running' | 'done' | 'failed' | 'cancelled';
export interface CooperativeRun<T> {
  readonly state: CooperativeState;
  readonly result: T | undefined;
  readonly error: unknown;
  /** Slices run, and the longest one: an atomic step longer than the budget shows here. */
  readonly slices: number;
  readonly longestSliceMs: number;
  /** Stops before the next step and runs the generator's `finally` blocks (partial cleanup). Idempotent. */
  cancel(): void;
}

/** Main-thread slice budget. A single atomic step may exceed it; that is measured, not hidden. */
export const SLICE_MS = 8;

export function cooperate<T>(steps: Generator<unknown, T, void>, scheduler: TaskScheduler, budgetMs: number,
  settled: (run: CooperativeRun<T>) => void, label='construction'): CooperativeRun<T> {
  return new Run(steps, scheduler, budgetMs, settled, label);
}

class Run<T> implements CooperativeRun<T> {
  state: CooperativeState = 'running';
  result: T | undefined;
  error: unknown;
  slices = 0;
  longestSliceMs = 0;
  private unpost: (() => void) | undefined;
  private stepping = false;
  private cancelWhenStepDone = false;
  private stepIndex=0;
  private readonly detailedSteps: boolean;
  constructor(private readonly steps: Generator<unknown, T, void>, private readonly scheduler: TaskScheduler,
    private readonly budgetMs: number, private readonly settled: (run: CooperativeRun<T>) => void,private readonly label:string) {
    this.detailedSteps = scheduler.diagnosticSteps === true;
    this.unpost = scheduler.post(() => this.slice());
  }
  cancel(): void {
    if (this.state !== 'running') return;
    if (this.stepping) { this.cancelWhenStepDone = true; return; } // a step cancelled its own run
    this.state = 'cancelled'; this.unpost?.(); this.unpost = undefined;
    this.steps.return(undefined as never); // runs `finally`: partial resources are released here
  }
  private slice(): void {
    this.unpost = undefined;
    if (this.state !== 'running') return;
    const start = this.scheduler.now();
    this.slices++;
    let finished: { value: T } | undefined;
    try {
      this.stepping = true;
      for (;;) {
        let next:IteratorResult<unknown,T>;
        if (this.detailedSteps) {
          const began=performance.now();let stepLabel='failed';try{next=this.steps.next();stepLabel=next.done?(this.label==='accept'?'atomic-issue':'complete'):typeof next.value==='string'?next.value:'step';}finally{if(++measures%2048===0)performance.clearMeasures('tumbleworks:step');performance.measure('tumbleworks:step',{start:began,end:performance.now(),detail:{phase:this.label,index:this.stepIndex++,step:stepLabel}});}
        } else next=this.steps.next();
        if (next.done) { finished = { value: next.value }; break; }
        if (this.cancelWhenStepDone || this.scheduler.now() - start >= this.budgetMs) break;
      }
    } catch (error) {
      this.stepping = false; this.state = 'failed'; this.error = error;
    } finally {
      this.stepping = false;
      this.longestSliceMs = Math.max(this.longestSliceMs, this.scheduler.now() - start);
    }
    if (this.state === 'failed') { this.steps.return(undefined as never); this.settled(this); return; }
    if (this.cancelWhenStepDone) { this.cancelWhenStepDone = false; this.cancel(); if(finished){this.result=finished.value;this.settled(this);} return; }
    if (finished) { this.state = 'done'; this.result = finished.value; this.settled(this); return; }
    this.unpost = this.scheduler.post(() => this.slice());
  }
}

/** Synchronous owners (existing constructors, tests, the worker) run the same steps in one go. */
export function drain<T>(steps: Generator<unknown, T, void>): T {
  for (;;) { const next = steps.next(); if (next.done) return next.value; }
}

/** Thrown by a staged native step when its owner's presentation left the recorded rest frames.
 *  The attempt is abandoned without effect; it is not a native failure. */
export class NotAtRest extends Error { constructor() { super('Village presentation is not at its recorded rest'); } }
