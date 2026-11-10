// Root112 ideal massless, bilateral, unrated STATIC model: the pure exact kernel.
// MOVED, not rewritten, from StaticSupportGraph (FINAL119 6fc5cb87…): every predicate,
// filter, order and error message is the same code. What moved OUT is native access:
// nativePiece/nativeSource/staticGroundMesh/nativeTerrainOwnership/nativeBottoms stay
// on the main thread (static-support-graph.ts) and feed this module plain snapshots.
// Runs in the proof worker; offline tests may call the SAME functions in-process.
import { finitePatches, greatestRoofPatch, closeMaterialSection, materialContinuation } from './static-material';
import { assertSimpleSolid } from './support-solid';
import { canonicalSolidProxy } from './support-canonical';
import { Z, cmp, exact, sub, add, mag, area2, clip, plane, xz, ccw, inside, closed, neighbour, exactNumberScope, type Tri, type Q, type V } from './support-exact';
import {
  STATIC_PROOF_KERNEL, STATIC_PROOF_PROTOCOL, digestSteps, islandsOf,
  type ProofEdge, type ProofChannelInput, type StaticCertificateData, type StaticProofInput, type StaticProofReply,
} from './static-proof-protocol';

export interface ProofBody { readonly id: string; readonly facets: readonly Tri[]; readonly channel?: ProofChannelInput }
interface Body { facets: readonly Tri[]; sections?: { start: ReturnType<typeof closeMaterialSection>; end: ReturnType<typeof closeMaterialSection> }; proxyLineage?: ReturnType<typeof canonicalSolidProxy>['lineage'] }

/** 9 Float32 values per facet → the same Number triples triangleAt() read from the attribute. */
export function facetsOf(values: Float32Array): readonly Tri[] {
  if (values.length % 9) throw Error('Wrong native facet stream');
  return Array.from({ length: values.length / 9 }, (_, t) => [0, 1, 2].map(k => [values[t * 9 + k * 3]!, values[t * 9 + k * 3 + 1]!, values[t * 9 + k * 3 + 2]!]) as unknown as Tri);
}

/** Former groundDomain(); `native` is the ownership-ordered land. `bottoms` is read after
 *  closed(facets), exactly where the former code called nativeBottoms(). */
function groundDomain(facets: readonly Tri[], bottoms: () => readonly number[], native: readonly Tri[]): { area: Q; facets: readonly number[]; maximumGap: Q; referencePoint: readonly [number, number, number] } {
  closed(facets);
  const bottom = bottoms();
  const soilPlanes = new Map<Tri, ReturnType<typeof plane>>(), soilPlane = (s: Tri) => { let h = soilPlanes.get(s); if (!h) { h = plane(s); soilPlanes.set(s, h); } return h; };
  let total = Z, coverage = Z, max = Z;
  for (let i = 0; i < bottom.length; i++) {
    const t = facets[bottom[i]!]!, poly = t.map(xz), a = area2(poly);
    if (cmp(a, Z) <= 0) throw Error('Inverted/tiny-degenerate native bottom');
    total = add(total, a);
    for (let j = 0; j < i; j++) { const overlap = clip(poly, facets[bottom[j]!]!.map(xz)); if (overlap.length >= 3 && cmp(mag(area2(overlap)), Z) > 0) throw Error('Overlapping declared ground domain'); }
    const foot = plane(t), minX = Math.min(...t.map(v => v[0])), maxX = Math.max(...t.map(v => v[0])), minZ = Math.min(...t.map(v => v[2])), maxZ = Math.max(...t.map(v => v[2]));
    const candidates = native.filter(s => Math.min(...s.map(v => v[0])) <= maxX && Math.max(...s.map(v => v[0])) >= minX && Math.min(...s.map(v => v[2])) <= maxZ && Math.max(...s.map(v => v[2])) >= minZ);
    for (const soil of candidates) {
      const clipped = clip(poly, soil.map(xz)); if (clipped.length < 3 || !cmp(mag(area2(clipped)), Z)) continue;
      coverage = add(coverage, mag(area2(clipped)));
      const h = soilPlane(soil);
      for (const p of clipped) { const gap = sub(foot(p), h(p)); if (cmp(gap, Z) < 0) throw Error('Ground facet penetration'); if (cmp(gap, max) > 0) max = gap; }
    }
    for (const v of t) {
      const p = xz(v), providers = candidates.filter(s => inside(p, ccw(s.map(xz))));
      if (!providers.length) throw Error('Ground vertex over water/void');
      for (const soil of providers) { const h = soilPlane(soil)(p); if (cmp(exact(v[1]), h) < 0 || cmp(exact(neighbour(v[1], false)), h) >= 0) throw Error('Ground height is not least Float32'); }
    }
  }
  if (cmp(total, Z) <= 0 || cmp(total, coverage)) throw Error('Incomplete native ground coverage');
  const first = facets[bottom[0]!]![0];
  return Object.freeze({ area: total, facets: Object.freeze([...bottom]), maximumGap: max, referencePoint: Object.freeze([...first]) as readonly [number, number, number] });
}

/** All body IDs are actual emitted pieces, never static-group IDs. Pure: no native identity. */
export class StaticProofGraph {
  private readonly bodies = new Map<string, Body>();
  private readonly edges: ProofEdge[] = [];
  private readonly groundIds = new Set<string>();
  get edgeCount(): number { return this.edges.length; }
  add(body: ProofBody): void {
    if (this.bodies.has(body.id)) throw Error('Duplicate physical piece');
    const facets = body.facets, c = body.channel;
    if (c) {
      const vertices: V[] = [];
      for (let t = 0; t < facets.length; t++) for (let k = 0; k < 3; k++) {
        const i = c.index[t * 3 + k]!, p = facets[t]![k]!;
        if (vertices[i] && vertices[i]!.some((x, j) => !Object.is(x, p[j]))) throw Error('Noncanonical final material vertex');
        vertices[i] = p;
      }
      const a = closeMaterialSection(facets, c.materialLoops.start, vertices, 'start', c.materialProfile), b = closeMaterialSection(facets, c.materialLoops.end, vertices, 'end', c.materialProfile);
      const proxy = [...facets, ...a.caps, ...b.caps]; closed(proxy); assertSimpleSolid(proxy);
      this.bodies.set(body.id, { facets, sections: { start: a, end: b } }); return;
    }
    let proxy = facets; let proxyLineage: Body['proxyLineage'];
    try { closed(facets); } catch { const canonical = canonicalSolidProxy(facets); proxy = canonical.facets; proxyLineage = canonical.lineage; }
    assertSimpleSolid(proxy); this.bodies.set(body.id, { facets, proxyLineage });
  }
  private body(id: string): Body { const b = this.bodies.get(id); if (!b) throw Error('Missing actual physical piece ' + id); return b; }
  bond(a: string, b: string): void {
    const A = this.body(a), B = this.body(b), patches = finitePatches(A.facets, B.facets);
    if (!patches.length) throw Error('Missing finite noncollinear native bond ' + a + ' / ' + b);
    for (const patch of patches) this.edges.push({ a, b, kind: 'finite-bond', area: patch.twiceArea, details: patch });
  }
  roof(padId: string, floorId: string, roofFacets: readonly number[], floorFacet: number): void {
    const pad = this.body(padId), floor = this.body(floorId);
    const actualRoof = pad.facets.flatMap((t, i) => cmp(area2(t.map(xz)), Z) < 0 ? [i] : []);
    if (actualRoof.length !== roofFacets.length || new Set(roofFacets).size !== roofFacets.length || actualRoof.some(i => !roofFacets.includes(i))) throw Error('Incomplete native roof association');
    if (!Number.isInteger(floorFacet) || !floor.facets[floorFacet]) throw Error('Wrong roof range');
    for (const i of roofFacets) {
      if (!pad.facets[i]) throw Error('Missing roof facet');
      const patch = greatestRoofPatch(pad.facets[i]!, floor.facets[floorFacet]!);
      this.edges.push({ a: padId, b: floorId, kind: 'stored-roof-bond', area: mag(area2(patch.polygon)), details: { roof: i, floor: floorFacet, gap: patch.gap } });
    }
  }
  continuation(a: string, b: string, endA: 'start' | 'end', endB: 'start' | 'end'): void {
    const section = (id: string, end: 'start' | 'end') => { const body = this.body(id); if (!body.sections) throw Error('No actual static material provenance'); return { chosen: body.sections[end], other: body.sections[end === 'start' ? 'end' : 'start'] }; };
    const A = section(a, endA), B = section(b, endB), patches = materialContinuation(A.chosen, B.chosen, A.other.caps, B.other.caps);
    for (const patch of patches) this.edges.push({ a, b, kind: 'material-continuation', area: patch.twiceArea, details: patch });
  }
  ground(postId: string, land: readonly Tri[], bottoms: () => readonly number[]): void {
    const p = this.body(postId), proof = groundDomain(p.facets, bottoms, land);
    if (this.groundIds.has(postId)) throw Error('Duplicate static ground weld');
    this.groundIds.add(postId);
    this.edges.push({ a: postId, b: 'native-land', kind: 'ground-weld', area: proof.area, details: proof });
  }
  /** Plain data only. Issuance (freeze + native invalidation closure) belongs to the main thread. */
  finish(expectedGround: readonly string[], requiredFloors: readonly string[]): StaticCertificateData {
    if (expectedGround.length !== 33 || new Set(expectedGround).size !== 33 || expectedGround.some(id => !this.groundIds.has(id)) || this.groundIds.size !== 33) throw Error('Wrong authorized33 ground graph');
    const { islands, unsupported } = islandsOf([...this.bodies.keys()], this.edges, this.groundIds, requiredFloors);
    if (unsupported.length) throw Error('Disconnected static floor(s): ' + unsupported.join(','));
    return { model: 'massless-ideal-bilateral-unrated', providers: [...expectedGround], edges: this.edges.map(e => ({ ...e })), islands, unsupported };
  }
}

/** Replays the ordered request. `edgeOps[k]` is the op that produced certificate edge k. */
export function* proveStaticSupportSteps(input: StaticProofInput, progress?: (op: number) => void): Generator<string, { certificate: StaticCertificateData; edgeOps: Uint32Array }, void> {
  const exactScope = exactNumberScope();
  const graph = new StaticProofGraph(), land = facetsOf(input.land), edgeOps: number[] = [], byId = new Map(input.bodies.map(b => [b.id, b]));
  for (let i = 0; i < input.ops.length; i++) {
    const op = input.ops[i]!;
    exactScope(() => {
    progress?.(i);
    const before = graph.edgeCount;
    switch (op.op) {
      case 'add': { const b = input.bodies[op.body]; if (!b) throw Error('Missing proof body'); graph.add({ id: b.id, facets: facetsOf(b.positions), channel: b.channel }); break; }
      case 'bond': graph.bond(op.a, op.b); break;
      case 'roof': graph.roof(op.pad, op.floor, op.roof, op.floorFacet); break;
      case 'continuation': graph.continuation(op.a, op.b, op.endA, op.endB); break;
      case 'ground': graph.ground(op.post, land, () => { const bottoms = byId.get(op.post)?.bottoms; if (!bottoms) throw Error('Missing actual post-bottom producer'); return bottoms; }); break;
      default: throw Error('Unknown proof operation');
    }
    for (let k = before; k < graph.edgeCount; k++) edgeOps.push(i);
    });
    yield `op:${i}:${op.op}`;
  }
  return { certificate: graph.finish(input.expectedGround, input.requiredFloors), edgeOps: Uint32Array.from(edgeOps) };
}

/** Offline controls drain exactly the same ordered operations. */
export function proveStaticSupport(input: StaticProofInput, progress?: (op: number) => void): { certificate: StaticCertificateData; edgeOps: Uint32Array } {
  const steps = proveStaticSupportSteps(input, progress);
  for (;;) { const next = steps.next(); if (next.done) return next.value; }
}

/** Only task boundaries move: hashing and each complete exact operation retain their order.
 * A cancelled worker cannot run the next queued operation or emit a partial certificate. */
export function* runStaticProofSteps(message: unknown, clock: () => number = () => 0): Generator<unknown, StaticProofReply, void> {
  const head = (job: number, inputDigest: string) => ({ type: 'static-proof-result' as const, protocol: STATIC_PROOF_PROTOCOL, kernel: STATIC_PROOF_KERNEL, job, inputDigest });
  const request = message as Partial<import('./static-proof-protocol').StaticProofRequest> | null;
  const job = typeof request?.job === 'number' ? request.job : -1;
  if (!request || request.type !== 'static-proof' || request.protocol !== STATIC_PROOF_PROTOCOL || request.kernel !== STATIC_PROOF_KERNEL || !request.input || typeof request.digest !== 'string')
    return { ...head(job, ''), outcome: 'invalid', message: 'Unrecognised static proof request' };
  const startedAt = clock(), input = request.input;
  let inputDigest: string;
  try { inputDigest = yield* digestSteps(input); } catch (error) { return { ...head(job, ''), outcome: 'invalid', message: String((error as Error)?.message ?? error) }; }
  if (inputDigest !== request.digest) return { ...head(job, inputDigest), outcome: 'invalid', message: 'Static proof input differs from its digest' };
  const inputBytes = input.land.byteLength + input.bodies.reduce((n, b) => n + b.positions.byteLength + (b.channel?.index.byteLength ?? 0), 0);
  let opIndex = -1;
  try {
    const result = yield* proveStaticSupportSteps(input, i => { opIndex = i; });
    return { ...head(job, inputDigest), outcome: 'certified', certificate: result.certificate, edgeOps: result.edgeOps,
      work: { bodies: input.bodies.length, ops: input.ops.length, edges: result.certificate.edges.length, inputBytes, startedAt, endedAt: clock() } };
  } catch (error) {
    return { ...head(job, inputDigest), outcome: 'rejected', opIndex, message: String((error as Error)?.message ?? error),
      work: { bodies: input.bodies.length, ops: input.ops.length, edges: 0, inputBytes, startedAt, endedAt: clock() } };
  }
}

/** Synchronous test/reference adapter; production never falls back to it. */
export function runStaticProofRequest(message: unknown, clock: () => number = () => 0): StaticProofReply {
  const steps = runStaticProofSteps(message, clock);
  for (;;) { const next = steps.next(); if (next.done) return next.value; }
}
