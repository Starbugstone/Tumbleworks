// One job per worker. Yield between ordered exact operations so native terminate()
// does not leave a monolithic proof handler running behind gameplay.
import { runStaticProofSteps } from './static-support-proof';
import { browserScheduler, cooperate, SLICE_MS } from './cooperative';
const scope = self as unknown as {
  addEventListener(type: 'message', listener: (event: MessageEvent) => void, options?: { once: boolean }): void;
  postMessage(message: unknown, transfer?: Transferable[]): void;
};
scope.addEventListener('message', event => {
  cooperate(runStaticProofSteps(event.data, () => performance.timeOrigin + performance.now()), browserScheduler(), SLICE_MS, run => {
    if (run.state !== 'done') throw run.error ?? new Error('Support worker did not complete');
    const reply = run.result!;
    scope.postMessage(reply, reply.outcome === 'certified' ? [reply.edgeOps.buffer] : []);
  }, 'proof-worker');
}, { once: true });
