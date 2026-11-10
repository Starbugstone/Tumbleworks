// Startup133 lifecycle checker, exercised by tests/world/startup-lifecycle.test.ts.
//
// Bounded concrete trace exploration of the PRODUCTION lifecycle classes: VillageOwnership,
// StaticProofOwner, WorkerProofBackend and cooperate(). Scripted: scenes (eligibility, intact
// bytes), builds (completion), the Worker (replies, crash, duplicates) and the sealed binding
// (accept succeeds iff intact; NotAtRest when not eligible). Real Harbour geometry, the kernel
// and native checks are proven separately (VERIFICATION.md §B); this checks who owns what, when
// work runs, and that no stale, foreign or away work ever takes effect.
import assert from 'node:assert/strict';
import { VillageOwnership, type LifecycleBuild, type LifecycleScene } from '../../../src/view/village-ownership';
import { StaticProofOwner, WorkerProofBackend } from '../../../src/view/static-proof-owner';
import { NotAtRest } from '../../../src/view/cooperative';
import type { StaticProofRequest } from '../../../src/view/static-proof-protocol';
import type { PreparedStaticProof, SealedStaticProof } from '../../../src/view/static-support-graph';
import { ManualScheduler } from '../../../tests/world/manual-scheduler';

const H = 0, G = 1;
type Act =
  | { a: 'map'; ch: number } | { a: 'leave'; to: 'overview' | 'workshop' | 'hidden' } | { a: 'film'; ch: number; earned: boolean }
  | { a: 'back' } | { a: 'buildDone'; ok: boolean } | { a: 'tick' } | { a: 'reply'; k: 'cert' | 'rej' }
  | { a: 'crash' } | { a: 'redeliver' } | { a: 'mutate' } | { a: 'grow' } | { a: 'complete' };

class ScriptedWorker { onmessage: ((e: MessageEvent) => void) | null = null; onerror: ((e: ErrorEvent) => void) | null = null; onmessageerror: (() => void) | null = null;
  terminated = false; job = -1; last: unknown; request!:StaticProofRequest;
  postMessage(m: StaticProofRequest): void { this.job = m.job;this.request=m; }
  terminate(): void { this.terminated = true; }
  emit(data: unknown): void { this.last = data; this.onmessage?.({ data } as MessageEvent); } // nulled handlers model real drops
  fail(): void { this.onerror?.({ preventDefault() {}, message: 'scripted crash' } as unknown as ErrorEvent); } }

class World {
  readonly scheduler = new ManualScheduler();
  readonly workers: ScriptedWorker[] = [];
  readonly backend = new WorkerProofBackend(() => { const w = new ScriptedWorker(); this.workers.push(w); return w as unknown as Worker; }, 1);
  readonly builds: FakeBuild[] = [];
  readonly scenes: FakeScene[] = [];
  complete = false; writes = 0; backs = 0; issued: { scene: FakeScene; job: number; generationAtIssue: number }[] = [];
  readonly own = new VillageOwnership<FakeScene>(ch => { const b = new FakeBuild(this, ch); this.builds.push(b); return b; }, () => undefined);
}
class FakeScene implements LifecycleScene {
  rest = true; intact = true; disposed = false; readonly proof: StaticProofOwner | undefined;
  constructor(readonly world: World, readonly chapter: number) {
    if (chapter === H) this.proof = new StaticProofOwner(sealed(world, this), world.backend, () => !this.disposed && this.rest && (this.isPrev() || world.complete), world.scheduler, 0);
    world.scenes.push(this);
  }
  isPrev(): boolean { return this.world.own.film?.previous === this; }
  activateProof(): void { this.proof?.activate(); }
  suspendProof(): void { this.proof?.suspend(); }
  dispose(): void { this.disposed = true; this.proof?.dispose(); }
}
class FakeBuild implements LifecycleBuild<FakeScene> {
  state: 'running' | 'done' | 'failed' | 'cancelled' = 'running'; private listener?: () => void; private result?: FakeScene;
  constructor(private readonly world: World, readonly chapter: number) {}
  finish(ok: boolean): void { if (this.state !== 'running') return; this.state = ok ? 'done' : 'failed'; if (ok) this.result = new FakeScene(this.world, this.chapter); this.listener?.(); }
  take(): FakeScene { assert.equal(this.state, 'done'); const r = this.result!; this.result = undefined; return r; }
  cancel(): void { if (this.state === 'running') this.state = 'cancelled'; this.listener = undefined; this.result?.dispose(); }
  onSettled(listener: () => void): void { this.listener = listener; }
}
let jobs = 0;
function sealed(world: World, scene: FakeScene): SealedStaticProof {
  return { *snapshot(eligible) {
    for (let i = 0; i < 2; i++) { if (!eligible()) throw new NotAtRest(); yield; }
    const job = ++jobs;
    const prepared: PreparedStaticProof = { request: { type: 'static-proof', protocol: 1, kernel: 'harbour-static-112/exact119', job, digest: `d${job}`, input: {} as never }, transfer: [],
      *accept(reply, still) {
        const r = reply as { job?: number; outcome?: string };
        if (r?.job !== job || r.outcome !== 'certified') throw Error('foreign or partial reply');
        for (let i = 0; i < 2; i++) { if (!still()) throw new NotAtRest(); if (!scene.intact) throw Error('native mutation'); yield; }
        if (!still()) throw new NotAtRest();
        if (!scene.intact) throw Error('native mutation'); // the fence and issuance share this one step
        world.issued.push({ scene, job, generationAtIssue: scene.proof!.status.state === 'pending' ? (scene.proof!.status as { generation: number }).generation : -1 });
        return { model: 'massless-ideal-bilateral-unrated', providers: [], edges: [], islands: [], unsupported: [] };
      } };
    return prepared;
  } };
}

function step(w: World, act: Act): void {
  const live = () => w.workers.find(x => !x.terminated);
  switch (act.a) {
    case 'map': w.own.showMap(act.ch); break;
    case 'leave': w.own.leave(act.to); break;
    case 'film': if (w.own.screen === 'map' && w.own.scene?.chapter === act.ch && (act.ch === G || w.complete)) { w.own.openFilm(act.ch, act.earned); w.own.scene.rest = true; } break;
    case 'back': if (w.own.screen === 'film') { w.writes++; w.backs++; w.own.endFilm(); w.own.showMap(w.own.scene?.chapter ?? H); } break;
    case 'buildDone': { const b = w.builds.find(x => x.state === 'running'); b?.finish(act.ok); break; }
    case 'tick': w.scheduler.step(); break;
    case 'reply': { const x = live(); if (x && x.last === undefined) x.emit({ type:'static-proof-result',protocol:1,kernel:x.request.kernel,inputDigest:x.request.digest,job: x.job, outcome: act.k === 'cert' ? 'certified' : 'rejected', message: 'x' }); break; }
    case 'crash': live()?.fail(); break;
    case 'redeliver': { const x = [...w.workers].reverse().find(y => y.last !== undefined); x?.emit(x.last); break; }
    case 'mutate': { const s = w.own.scene; if (s) s.intact = !s.intact; break; }
    case 'grow': { const s = w.own.scene; if (s && w.own.screen === 'map') { s.rest = !s.rest; s.proof?.checkpoint(); } break; }
    case 'complete': if (w.own.screen === 'hidden') { w.complete = true; if (w.own.scene) w.own.scene.rest = false; } break;
  }
}

function invariants(w: World, trace: readonly Act[]): void {
  const t = () => JSON.stringify(trace);
  assert(w.workers.filter(x => !x.terminated).length <= 1, `two live workers: ${t()}`);
  const away = ['overview', 'workshop', 'hidden'].includes(w.own.screen);
  if (away) {
    assert(!w.builds.some(b => b.state === 'running'), `construction runs away from the village: ${t()}`);
    assert(!w.workers.some(x => !x.terminated), `worker runs away from the village: ${t()}`);
    for (const s of w.scenes) { const st = s.proof?.status; assert(!(st?.state === 'pending' && st.phase !== 'held'), `proof work away: ${t()}`); }
  }
  assert(w.builds.filter(b => b.state === 'running').length <= 1, `two builds run: ${t()}`);
  for (const s of w.scenes) {
    const st = s.proof?.status;
    if (s.disposed) assert(!st || st.state === 'disposed', `disposed scene changed: ${t()}`);
    if (st?.state === 'pending' && !s.isPrev() && s.chapter === H) assert(w.complete, `proof for an incomplete village: ${t()}`);
  }
  for (const i of w.issued) assert(!i.scene.disposed || i.scene.proof?.status.state === 'disposed', `issued for a disposed scene: ${t()}`);
  assert.equal(w.writes, w.backs, `Back wrote progress other than once: ${t()}`);
  if (!w.own.film) for (const s of w.scenes) if (s !== w.own.scene) assert(s.disposed, `a film-owned or replaced scene outlived its owner: ${t()}`);
}

/** Replays every concrete trace through depth4 without a state abstraction. Aborts at the bound. */
export function checkStartupLifecycle(bound = 120_000): { traces: number; depth: number } {
  const alphabet: Act[] = [
    { a: 'map', ch: H }, { a: 'map', ch: G }, { a: 'leave', to: 'hidden' }, { a: 'leave', to: 'workshop' }, { a: 'leave', to: 'overview' },
    { a: 'film', ch: H, earned: true }, { a: 'film', ch: G, earned: false }, { a: 'back' }, { a: 'buildDone', ok: true }, { a: 'buildDone', ok: false },
    { a: 'tick' }, { a: 'reply', k: 'cert' }, { a: 'reply', k: 'rej' }, { a: 'crash' }, { a: 'redeliver' }, { a: 'mutate' }, { a: 'grow' }, { a: 'complete' },
  ];
  // NO state-key deduplication: every concrete queued-task/history trace within this bound is replayed.
  let states=0;const frontier:Act[][]=[[]];
  while(frontier.length){const trace=frontier.pop()!;jobs=0;const w=new World();try{for(const act of trace){step(w,act);invariants(w,trace);}states++;assert(states<=bound,'Trace bound exhausted');if(trace.length<4)for(const act of alphabet)frontier.push([...trace,act]);}finally{w.own.dispose();}}

  return { traces: states, depth: 4 };
}

// Separate evidence layers: lifecycle tests inject suspend/build-cancel/eligibility/deferred-cancel
// defects into real classes. Transport tests deliver historical/foreign/duplicate callbacks and
// failures. Actual native tests cover atomic bytes, ticket ownership, all staged yields and cleanup.
// Browser tests cover pending Film, reduced Play, earned Back and real worker lifetime.
// TLC counterexamples are retained as text. This executable checker replays the corresponding
// hazardous transitions; it does not claim an automated, step-for-step refinement of every TLC trace.

/** Concrete long traces retain real generations, request headers, deferred replies and scheduler PCs. */
export function replayStartup(trace:readonly Act[],complete=true){jobs=0;const w=new World();w.complete=complete;try{for(const act of trace){step(w,act);invariants(w,trace);}return {screen:w.own.screen,proof:w.own.scene?.proof?.status,issued:w.issued.length,writes:w.writes,backs:w.backs,liveWorkers:w.workers.filter(x=>!x.terminated).length};}finally{w.own.dispose();}}
