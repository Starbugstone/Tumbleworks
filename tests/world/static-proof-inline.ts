// Offline backend for Node tests ONLY (never imported by src/). It runs the SAME pure
// runStaticProofRequest the worker runs, across a structured-clone boundary with the
// same transfers, and only when the test calls flush(): tests can interleave native
// mutation, presentation changes, disposal and duplicate replies between submit and
// reply. It proves kernel/binding behaviour; it is not evidence that the production
// worker, its chunk, scheduling or native touch handling work in a browser.
import type { BackendOutcome, StaticProofBackend } from '../../src/view/static-proof-owner';
import type { StaticProofRequest } from '../../src/view/static-proof-protocol';
import { runStaticProofRequest } from '../../src/view/static-support-proof';

interface Entry { readonly request: unknown; readonly settle: (outcome: BackendOutcome) => void; live: boolean; reply?: unknown }

export class InlineProofBackend implements StaticProofBackend {
  private readonly entries: Entry[] = [];
  submitted = 0;
  run(request: StaticProofRequest, transfer: readonly ArrayBuffer[], settle: (outcome: BackendOutcome) => void): () => void {
    // Same detachment as postMessage: the main thread keeps no handle on the sent buffers.
    const entry: Entry = { request: structuredClone(request, { transfer: [...transfer] }), settle, live: true };
    this.entries.push(entry); this.submitted++;
    return () => { entry.live = false; };
  }
  /** Runs and delivers every live job in submission order. Returns the replies delivered. */
  flush(): unknown[] {
    const delivered: unknown[] = [];
    for (const entry of this.entries.splice(0)) {
      if (!entry.live) continue;
      entry.live = false;
      entry.reply = structuredClone(runStaticProofRequest(entry.request));
      entry.settle({ kind: 'reply', reply: entry.reply }); delivered.push(entry.reply);
    }
    return delivered;
  }
  /** Adversarial delivery for mutants: a crash, or an arbitrary (stale, forged, duplicated) reply. */
  deliver(outcome: BackendOutcome): void {
    const entry = this.entries.shift(); if (!entry) throw Error('No submitted proof');
    entry.settle(outcome);
  }
}
