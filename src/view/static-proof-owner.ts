// Keeps 124's accepted core: the same pure exact kernel in a per-job worker, private native
// snapshots, ordered operations, job/input digest, live checks before private single-use
// issuance. Adds what root128 found missing: a scene-lifetime owner with generations, so
// leaving the village cancels unfinished work and returning starts a FRESH job; staged
// snapshot and acceptance on the main thread; and root's deferred-cancel correction.
import { cooperate, NotAtRest, SLICE_MS, type CooperativeRun, type TaskScheduler } from './cooperative';
import type { StaticProofRequest } from './static-proof-protocol';
import type { PreparedStaticProof, SealedStaticProof, StaticSupportCertificate } from './static-support-graph';

export type StaticProofFailure = 'unavailable' | 'rejected' | 'invalid';
export type ProofPhase = 'snapshot' | 'worker' | 'held' | 'accept';
export type StaticProofStatus =
  /** No work: not yet eligible (incomplete village, rising stop), or suspended away from the village. */
  | { readonly state: 'idle' }
  | { readonly state: 'pending'; readonly generation: number; readonly phase: ProofPhase }
  | { readonly state: 'ready'; readonly generation: number; readonly certificate: StaticSupportCertificate }
  /** `retryable` failures (no worker, crash) start a fresh generation on the next visit only. */
  | { readonly state: 'failed'; readonly generation: number; readonly reason: StaticProofFailure; readonly detail: string; readonly retryable: boolean }
  | { readonly state: 'disposed' };

export type BackendOutcome = { readonly kind: 'reply'; readonly reply: unknown } | { readonly kind: 'unavailable'; readonly detail: string };
/** Contract: `settle` is called at most once, NEVER synchronously from run(), and never after the
 *  returned canceller ran, including an outcome already queued before the cancel. */
export interface StaticProofBackend {
  run(request: StaticProofRequest, transfer: readonly ArrayBuffer[], settle: (outcome: BackendOutcome) => void): () => void;
}

const MARK = 'tumbleworks:static-proof:';
interface Job {
  readonly generation: number;
  snapshot?: CooperativeRun<PreparedStaticProof>;
  prepared?: PreparedStaticProof;
  cancelWorker?: () => void;
  reply?: { readonly value: unknown };
  accept?: CooperativeRun<StaticSupportCertificate>;
}

/** One per sealed scene (Little Harbour today). Lives exactly as long as its WorldScene. */
export class StaticProofOwner {
  private current: StaticProofStatus = { state: 'idle' };
  private active = false;
  private generation = 0;
  private job: Job | undefined;

  constructor(private readonly sealed: SealedStaticProof, private readonly backend: StaticProofBackend,
    /** Built, every stop visible, no stop rising: the frames the native issuer recorded. */
    private readonly eligible: () => boolean, private readonly scheduler: TaskScheduler, private readonly budgetMs = SLICE_MS) {}

  get status(): StaticProofStatus { return this.current; }

  /** The village screen (map, or a film showing this scene) now owns this scene. */
  activate(): void {
    if (this.current.state === 'disposed') return;
    const entering=!this.active;this.active = true;
    if (entering && this.current.state === 'failed' && this.current.retryable) this.current = { state: 'idle' };
    this.checkpoint();
  }
  /** Presentation changed (update, growth end, finishConstruction). O(1) unless work can start. */
  checkpoint(): void {
    if (!this.active || !this.eligible()) return;
    const s = this.current;
    if (s.state === 'idle') this.start();
    else if (s.state === 'pending' && s.phase === 'held') this.beginAccept();
  }
  /** Leaving for gameplay, the valley, the Workshop: unfinished work stops now. A completed
   *  certificate and a final failure are kept; unfinished work restarts fresh on return. */
  suspend(): void {
    this.active = false;
    if (this.current.state === 'pending') { this.abandon(); this.current = { state: 'idle' }; }
  }
  /** A film-start native recheck failed after acceptance. Final for this scene. */
  invalidate(detail: string): void {
    if (this.current.state === 'ready') this.fail(this.current.generation, 'invalid', detail, false);
  }
  dispose(): void {
    this.active = false; this.abandon(); this.current = { state: 'disposed' };
  }

  private owns(job:Job):boolean {return this.active&&this.job===job&&this.eligible()&&this.active&&this.job===job;}
  private start(): void {
    const job: Job = { generation: ++this.generation };
    this.job = job; this.current = { state: 'pending', generation: job.generation, phase: 'snapshot' };
    performance.mark(MARK + 'snapshot', { detail: { generation: job.generation } });
    job.snapshot = cooperate(this.sealed.snapshot(() => this.owns(job)), this.scheduler, this.budgetMs, run => this.snapshotted(job, run),'snapshot');
  }
  private snapshotted(job: Job, run: CooperativeRun<PreparedStaticProof>): void {
    if (this.job !== job) return;
    job.snapshot = undefined;
    if (run.state === 'failed') {
      if (run.error instanceof NotAtRest) { this.job = undefined; this.current = { state: 'idle' }; return; } // retried at the next checkpoint
      this.fail(job.generation, 'invalid', message(run.error), false); return;
    }
    if (run.state !== 'done') return;
    const prepared = run.result!;
    job.prepared = prepared;
    this.current = { state: 'pending', generation: job.generation, phase: 'worker' };
    performance.mark(MARK + 'submitted', { detail: { generation: job.generation, job: prepared.request.job, digest: prepared.request.digest } });
    let synchronous = true;
    let cancel:()=>void;
    try { cancel = this.backend.run(prepared.request, prepared.transfer, outcome => {
      if (synchronous) { this.fail(job.generation, 'invalid', 'Proof backend replied synchronously', false); return; }
      this.settle(job, outcome);
    });
    }catch(error){this.fail(job.generation,'unavailable',message(error),true);return;}
    synchronous = false;
    if (this.job === job && this.current.state === 'pending') job.cancelWorker = cancel; else cancel();
  }
  private settle(job: Job, outcome: BackendOutcome): void {
    // A reply for an earlier generation, a cancelled job or a duplicate is ignored here.
    if (this.job !== job || this.current.state !== 'pending' || this.current.phase !== 'worker') return;
    job.cancelWorker = undefined;
    if (outcome.kind === 'unavailable') { this.fail(job.generation, 'unavailable', outcome.detail, true); return; }
    const head=outcome.reply as Partial<StaticProofRequest>&{inputDigest?:unknown}|null;
    const req=job.prepared!.request;
    if(!head||head.job!==req.job||head.protocol!==req.protocol||head.kernel!==req.kernel||head.inputDigest!==req.digest){this.fail(job.generation,'invalid','Reply identity does not answer this generation',false);return;}
    const value = outcome.reply as { readonly outcome?: unknown; readonly message?: unknown } | null;
    if (value && typeof value === 'object' && value.outcome === 'rejected') { this.fail(job.generation, 'rejected', String(value.message), false); return; }
    job.reply = { value: outcome.reply };
    this.current = { state: 'pending', generation: job.generation, phase: 'held' };
    this.checkpoint();
  }
  private beginAccept(): void {
    const job = this.job!, prepared = job.prepared!, reply = job.reply!;
    this.current = { state: 'pending', generation: job.generation, phase: 'accept' };
    job.accept = cooperate(prepared.accept(reply.value, () => this.owns(job)), this.scheduler, this.budgetMs, run => {
      if (this.job !== job) return;
      job.accept = undefined;
      if (run.state === 'done') {
        this.job = undefined;
        this.current = { state: 'ready', generation: job.generation, certificate: run.result! };
        performance.mark(MARK + 'accepted', { detail: { generation: job.generation,work:(job.reply?.value as {work?:unknown})?.work } });
      } else if (run.state === 'failed') {
        if (run.error instanceof NotAtRest) this.current = { state: 'pending', generation: job.generation, phase: 'held' };
        else this.fail(job.generation, 'invalid', message(run.error), false);
      }
    },'accept');
  }
  private abandon(): void {
    const job = this.job; this.job = undefined;
    job?.snapshot?.cancel(); job?.cancelWorker?.(); job?.accept?.cancel();
  }
  private fail(generation: number, reason: StaticProofFailure, detail: string, retryable: boolean): void {
    this.abandon();
    this.current = { state: 'failed', generation, reason, detail, retryable };
    performance.mark(MARK + 'failed', { detail: { generation, reason } });
    console.error(`Village support check ${reason}: ${detail}`);
  }
}
const message = (error: unknown) => String((error as Error)?.message ?? error);

interface Run { request: StaticProofRequest | undefined; transfer: readonly ArrayBuffer[]; readonly settle: (outcome: BackendOutcome) => void; worker: Worker | undefined; done: boolean; cancelled: boolean }

/** At most one worker exists, for one job, terminated as soon as that job settles or is cancelled.
 *  Root128's correction: a cancellation marker is checked at delivery, so an outcome queued
 *  before cancel() (deferred unavailable, postMessage error) is suppressed as promised. */
export class WorkerProofBackend implements StaticProofBackend {
  private active: Run | null = null;
  private readonly queue: Run[] = [];
  constructor(private readonly spawn: () => Worker, private readonly maxQueued = 1) {}
  get load(): { readonly workers: number; readonly queued: number } { return { workers: this.active?.worker ? 1 : 0, queued: this.queue.length }; }

  run(request: StaticProofRequest, transfer: readonly ArrayBuffer[], settle: (outcome: BackendOutcome) => void): () => void {
    const run: Run = { request, transfer, settle, worker: undefined, done: false, cancelled: false };
    if (this.queue.length >= this.maxQueued) { this.end(run, { kind: 'unavailable', detail: 'Too many support checks waiting' }, true); return () => this.cancel(run); }
    this.queue.push(run); this.pump();
    return () => this.cancel(run);
  }
  private pump(): void {
    if (this.active) return;
    const run = this.queue.shift(); if (!run) return;
    let worker: Worker;
    try { worker = this.spawn(); } catch (error) { this.end(run, { kind: 'unavailable', detail: String(error) }, true); return; }
    run.worker = worker; this.active = run;
    worker.onmessage = event => this.end(run, { kind: 'reply', reply: event.data });
    worker.onmessageerror = () => this.end(run, { kind: 'reply', reply: undefined });
    worker.onerror = event => { event.preventDefault(); this.end(run, { kind: 'unavailable', detail: event.message || 'Support check worker failed' }); };
    try { worker.postMessage(run.request, [...run.transfer]); } catch (error) { this.end(run, { kind: 'unavailable', detail: String(error) }, true); return; }
    run.request = undefined; run.transfer = [];
  }
  private end(run: Run, outcome: BackendOutcome, later = false): void {
    if (run.done) return;
    run.done = true; this.release(run);
    const deliver = () => { if (!run.cancelled) run.settle(outcome); };
    if (later) queueMicrotask(deliver); else deliver();
    this.pump();
  }
  private cancel(run: Run): void {
    run.cancelled = true;
    if (run.done) return;
    run.done = true;
    const index = this.queue.indexOf(run); if (index >= 0) this.queue.splice(index, 1);
    this.release(run); this.pump();
  }
  private release(run: Run): void {
    const worker = run.worker;
    if (worker) { worker.onmessage = worker.onmessageerror = worker.onerror = null; worker.terminate(); run.worker = undefined; }
    if (this.active === run) this.active = null;
    run.request = undefined; run.transfer = [];
  }
}

const UNAVAILABLE: StaticProofBackend = {
  run: (_request, _transfer, settle) => {
    let live = true;
    queueMicrotask(() => { if (live) settle({ kind: 'unavailable', detail: 'This browser cannot run the support check in the background' }); });
    return () => { live = false; };
  },
};
let shared: StaticProofBackend | undefined;
/** Production default. No Worker means an honest failure, never the blocking in-thread proof. */
export function defaultStaticProofBackend(): StaticProofBackend {
  return shared ??= typeof Worker === 'function'
    ? new WorkerProofBackend(() => new Worker(new URL('./static-proof.worker.ts', import.meta.url), { type: 'module', name: 'tumbleworks-static-proof' }))
    : UNAVAILABLE;
}
