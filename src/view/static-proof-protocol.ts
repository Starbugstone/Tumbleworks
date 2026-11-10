// Pure message contract shared by the main thread and the proof worker.
// No three.js, no DOM, no native objects: plain data, typed arrays and bigints only.
import type { Q } from './support-exact';

export const STATIC_PROOF_PROTOCOL = 1 as const;
/** Detects a stale or mismatched worker chunk. It is a consistency label, never a certificate. */
export const STATIC_PROOF_KERNEL = 'harbour-static-112/exact119' as const;

export interface ProofChannelInput {
  /** ChannelSurface.index of the producer geometry, one entry per facet corner. */
  readonly index: Uint32Array;
  readonly materialLoops: { readonly start: readonly number[]; readonly end: readonly number[] };
  readonly materialProfile: readonly (readonly [number, number])[];
}
export interface ProofBodyInput {
  readonly id: string;
  /** The issued native range bytes, 9 Float32 values per facet, equal to the drawn merged buffer. */
  readonly positions: Float32Array;
  readonly channel?: ProofChannelInput;
  /** Declared post-bottom facet indices (main-thread producer provenance), only for grounded posts. */
  readonly bottoms?: readonly number[];
}
/** Ordered exactly as the former synchronous finish(): edge order, and so the certificate, depend on it. */
export type ProofOp =
  | { readonly op: 'add'; readonly body: number }
  | { readonly op: 'bond'; readonly a: string; readonly b: string }
  | { readonly op: 'roof'; readonly pad: string; readonly floor: string; readonly roof: readonly number[]; readonly floorFacet: number }
  | { readonly op: 'continuation'; readonly a: string; readonly b: string; readonly endA: 'start' | 'end'; readonly endB: 'start' | 'end' }
  | { readonly op: 'ground'; readonly post: string };
export interface StaticProofInput {
  readonly protocol: typeof STATIC_PROOF_PROTOCOL;
  readonly kernel: typeof STATIC_PROOF_KERNEL;
  readonly bodies: readonly ProofBodyInput[];
  /** nativeTerrainOwnership(land).land triangles in ownership order, 9 Float32 values each. */
  readonly land: Float32Array;
  readonly ops: readonly ProofOp[];
  readonly expectedGround: readonly string[];
  readonly requiredFloors: readonly string[];
}
export interface StaticProofRequest {
  readonly type: 'static-proof';
  readonly protocol: typeof STATIC_PROOF_PROTOCOL;
  readonly kernel: typeof STATIC_PROOF_KERNEL;
  readonly job: number;
  readonly digest: string;
  readonly input: StaticProofInput;
}
export type ProofEdgeKind = 'finite-bond' | 'stored-roof-bond' | 'material-continuation' | 'ground-weld';
export interface ProofEdge { readonly a: string; readonly b: string; readonly kind: ProofEdgeKind; readonly area: Q; readonly details: unknown }
export interface ProofIsland { readonly bodies: readonly string[]; readonly grounds: readonly string[] }
/** Field order is the certificate's: the recorded 119 hash depends on it. */
export interface StaticCertificateData {
  readonly model: 'massless-ideal-bilateral-unrated';
  readonly providers: readonly string[];
  readonly edges: readonly ProofEdge[];
  readonly islands: readonly ProofIsland[];
  readonly unsupported: readonly string[];
}
export interface ProofWork {
  readonly bodies: number; readonly ops: number; readonly edges: number;
  readonly inputBytes: number;
  /** Worker wall clock, absolute ms (timeOrigin + now). Diagnostics only. */
  readonly startedAt: number; readonly endedAt: number;
}
interface ReplyHead {
  readonly type: 'static-proof-result';
  readonly protocol: typeof STATIC_PROOF_PROTOCOL;
  readonly kernel: typeof STATIC_PROOF_KERNEL;
  readonly job: number;
  /** Recomputed by the worker over what it received; must equal the main thread's digest. */
  readonly inputDigest: string;
}
export type StaticProofReply =
  | ReplyHead & { readonly outcome: 'certified'; readonly certificate: StaticCertificateData; readonly edgeOps: Uint32Array; readonly work: ProofWork }
  | ReplyHead & { readonly outcome: 'rejected'; readonly opIndex: number; readonly message: string; readonly work: ProofWork }
  | ReplyHead & { readonly outcome: 'invalid'; readonly message: string };

/** The former StaticSupportGraph.finish connectivity, verbatim, shared so both sides build identical islands. */
export function islandsOf(bodyIds: readonly string[], edges: readonly ProofEdge[], groundIds: ReadonlySet<string>, requiredFloors: readonly string[]): { islands: ProofIsland[]; unsupported: string[] } {
  const adjacency = new Map<string, string[]>();
  for (const id of bodyIds) adjacency.set(id, []);
  for (const e of edges) if (e.kind !== 'ground-weld') {
    const a = adjacency.get(e.a), b = adjacency.get(e.b);
    if (!a || !b) throw Error('Edge names a body outside the proof');
    a.push(e.b); b.push(e.a);
  }
  const visited = new Set<string>(), islands: { bodies: string[]; grounds: string[] }[] = [], unsupported: string[] = [];
  for (const id of adjacency.keys()) {
    if (visited.has(id)) continue;
    const queue = [id], members: string[] = [];
    while (queue.length) { const p = queue.pop()!; if (visited.has(p)) continue; visited.add(p); members.push(p); queue.push(...adjacency.get(p)!); }
    members.sort();
    const grounds = members.filter(p => groundIds.has(p));
    if (!grounds.length) unsupported.push(...members.filter(p => requiredFloors.includes(p)));
    islands.push({ bodies: members, grounds });
  }
  for (const id of requiredFloors) if (!adjacency.has(id)) unsupported.push(id);
  return { islands, unsupported };
}

/** Transport-fidelity digest of the complete input. Integrity of the hand-off, not authentication.
 *  Pure TS SHA-256: crypto.subtle is absent on the LAN dev server (insecure context). */
export function digestProofInput(input: StaticProofInput): string {
  const steps = digestSteps(input);
  for (;;) { const next = steps.next(); if (next.done) return next.value; }
}
/** The same bytes in the same order, one body per step, for the main thread's staged snapshot. */
export function* digestSteps(input: StaticProofInput): Generator<unknown, string, void> {
  const h = new Sha256(), text = new TextEncoder();
  const u32 = (n: number): void => { const b = new Uint8Array(4); new DataView(b.buffer).setUint32(0, n); h.update(b); };
  const str = (s: string): void => { const b = text.encode(s); u32(b.length); h.update(b); };
  const bytes = (a: ArrayBufferView): void => { u32(a.byteLength); h.update(new Uint8Array(a.buffer, a.byteOffset, a.byteLength)); };
  const f64 = (v: readonly number[]): void => bytes(Float64Array.from(v));
  str(`tumbleworks-static-proof/${input.protocol}/${input.kernel}`);
  u32(input.bodies.length);
  for (const b of input.bodies) {
    str(b.id); bytes(b.positions);
    u32(b.channel ? 1 : 0);
    if (b.channel) { bytes(b.channel.index); f64(b.channel.materialLoops.start); f64(b.channel.materialLoops.end); f64(b.channel.materialProfile.flat()); }
    u32(b.bottoms ? 1 : 0); if (b.bottoms) f64(b.bottoms);
    yield 'hash:'+b.id;
  }
  bytes(input.land);
  yield 'hash:land';
  u32(input.ops.length); for (const op of input.ops) str(JSON.stringify(op));
  u32(input.expectedGround.length); for (const id of input.expectedGround) str(id);
  u32(input.requiredFloors.length); for (const id of input.requiredFloors) str(id);
  return h.digest();
}

const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);
/** Must match node:crypto on the FIPS 180-4 vectors and on real proof inputs (future test). */
export class Sha256 {
  private readonly h = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
  private readonly block = new Uint8Array(64);
  private readonly w = new Uint32Array(64);
  private used = 0;
  private length = 0;
  update(data: Uint8Array): this {
    this.length += data.length;
    for (let i = 0; i < data.length;) {
      const n = Math.min(64 - this.used, data.length - i);
      this.block.set(data.subarray(i, i + n), this.used); this.used += n; i += n;
      if (this.used === 64) { this.compress(); this.used = 0; }
    }
    return this;
  }
  digest(): string {
    const bits = this.length * 8, pad = new Uint8Array((this.used < 56 ? 56 : 120) - this.used); pad[0] = 0x80;
    this.update(pad);
    const tail = new Uint8Array(8), view = new DataView(tail.buffer);
    view.setUint32(0, Math.floor(bits / 2 ** 32)); view.setUint32(4, bits >>> 0);
    this.update(tail);
    let out = ''; for (const v of this.h) out += v.toString(16).padStart(8, '0'); return out;
  }
  private compress(): void {
    const w = this.w, b = this.block;
    for (let t = 0; t < 16; t++) w[t] = (b[t * 4]! << 24 | b[t * 4 + 1]! << 16 | b[t * 4 + 2]! << 8 | b[t * 4 + 3]!) >>> 0;
    for (let t = 16; t < 64; t++) {
      const x = w[t - 15]!, y = w[t - 2]!;
      const s0 = (x >>> 7 | x << 25) ^ (x >>> 18 | x << 14) ^ (x >>> 3), s1 = (y >>> 17 | y << 15) ^ (y >>> 19 | y << 13) ^ (y >>> 10);
      w[t] = (w[t - 16]! + s0 + w[t - 7]! + s1) >>> 0;
    }
    let a = this.h[0]!, bb = this.h[1]!, c = this.h[2]!, d = this.h[3]!, e = this.h[4]!, f = this.h[5]!, g = this.h[6]!, hh = this.h[7]!;
    for (let t = 0; t < 64; t++) {
      const S1 = (e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7), ch = (e & f) ^ (~e & g);
      const t1 = (hh + S1 + ch + K[t]! + w[t]!) >>> 0;
      const S0 = (a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10), maj = (a & bb) ^ (a & c) ^ (bb & c);
      const t2 = (S0 + maj) >>> 0;
      hh = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = bb; bb = a; a = (t1 + t2) >>> 0;
    }
    const h = this.h;
    h[0] = (h[0]! + a) >>> 0; h[1] = (h[1]! + bb) >>> 0; h[2] = (h[2]! + c) >>> 0; h[3] = (h[3]! + d) >>> 0;
    h[4] = (h[4]! + e) >>> 0; h[5] = (h[5]! + f) >>> 0; h[6] = (h[6]! + g) >>> 0; h[7] = (h[7]! + hh) >>> 0;
  }
}
