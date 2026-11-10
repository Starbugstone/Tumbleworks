// Root112 ideal massless, bilateral, unrated STATIC model only.
import{type BufferGeometry,Mesh,type Object3D}from'three';
import{terrainFootDescriptor}from'./terrain-foot';
import{assertNativeRanges,nativePiece,nativeSource,staticGroundMesh,nativeProofSnapshot,nativeRangeAtHome,nativeLandSnapshot,type NativeGround,type NativeRange}from'./static-support-native';
import{StaticProofGraph,facetsOf,type ProofBody}from'./static-support-proof';
import{STATIC_PROOF_KERNEL,STATIC_PROOF_PROTOCOL,digestSteps,islandsOf,type ProofBodyInput,type ProofChannelInput,type ProofEdge,type ProofIsland,type ProofOp,type StaticCertificateData,type StaticProofInput,type StaticProofReply,type StaticProofRequest}from'./static-proof-protocol';
import{NotAtRest}from'./cooperative';
import{channelSurface}from'./machine-primitives';
import type{Tri,Q}from'./support-exact';
type Edge=ProofEdge;
const issued=new WeakMap<StaticSupportCertificate,()=>void>();
export function assertStaticSupportCertificate(certificate:StaticSupportCertificate):void{const check=issued.get(certificate);if(!check)throw Error('Unissued support graph');check();}
function freezeProof<T>(value:T):T{if(value&&typeof value==='object'){for(const child of Object.values(value))freezeProof(child);Object.freeze(value);}return value;}
export interface StaticSupportCertificate {readonly model:'massless-ideal-bilateral-unrated';readonly providers:readonly string[];readonly edges:readonly Readonly<Edge>[];readonly islands:readonly{readonly bodies:readonly string[];readonly grounds:readonly string[]}[];readonly unsupported:readonly string[]}
function nativeBottoms(g:import('three').BufferGeometry):readonly number[]{const d=terrainFootDescriptor(g);if(d)return Object.freeze([...d.bottom]);const p=(g as import('three').CylinderGeometry).parameters;if(!p||p.radialSegments!==8||p.radiusTop!==.09||p.radiusBottom!==.12)throw Error('Missing actual post-bottom producer');const cap=g.groups.find(g=>g.materialIndex===2);if(!cap||cap.count!==18)throw Error('Missing compacted declared bottom');return Array.from({length:6},(_,i)=>cap.start/3+i);}
/** Synchronous native adapter over the pure kernel (static-support-proof.ts): every call
 * takes its own deep native read, exactly as before. Production enrollment uses
 * StaticProofPlan instead; this stays for native controls and composition checks. */
function proofBody(id:string,facets:readonly Tri[],g:BufferGeometry):ProofBody{const channel=channelInput(g);return channel?{id,facets,channel}:{id,facets};}
/** A fresh copy each call: snapshot buffers are transferred to the worker. */
function channelInput(g:BufferGeometry):ProofChannelInput|undefined{const p=channelSurface(g);if(!p||!g.index)return undefined;return{index:Uint32Array.from(p.index),materialLoops:{start:[...p.materialLoops.start],end:[...p.materialLoops.end]},materialProfile:p.materialProfile.map(v=>[v[0],v[1]]as const)};}
export class StaticSupportGraph{
 private readonly proof=new StaticProofGraph();private readonly bodies=new Map<string,{mesh:Mesh;range:NativeRange}>();private readonly grounds:{ground:NativeGround;home:Object3D}[]=[];
 add(range:NativeRange):void{if(this.bodies.has(range.id))throw Error('Duplicate physical piece');const piece=nativePiece(range),actual=piece.mesh;for(const b of this.bodies.values())if(b.mesh===actual&&range.first<b.range.first+b.range.count&&b.range.first<range.first+range.count)throw Error('Duplicated/overlapping native physical ranges');this.proof.add(proofBody(range.id,piece.facets,piece.originalGeometry));this.bodies.set(range.id,{mesh:actual,range});}
 private range(id:string):NativeRange{const b=this.bodies.get(id);if(!b)throw Error('Missing actual physical piece '+id);return b.range;}
 bond(a:string,b:string):void{this.proof.bond(a,b);}
 roof(padId:string,floorId:string,roofFacets:readonly number[],floorFacet:number):void{this.proof.roof(padId,floorId,roofFacets,floorFacet);}
 continuation(a:string,b:string,endA:'start'|'end',endB:'start'|'end'):void{nativeSource(this.range(a));nativeSource(this.range(b));this.proof.continuation(a,b,endA,endB);}
 ground(postId:string,ground:NativeGround):void{const piece=nativePiece(this.range(postId)),land=facetsOf(nativeLandSnapshot(ground,piece.home));this.proof.ground(postId,land,()=>nativeBottoms(piece.originalGeometry));this.grounds.push({ground,home:piece.home});}
 finish(expectedGround:readonly string[],requiredFloors:readonly string[]):StaticSupportCertificate{return issueCertificate(this.proof.finish(expectedGround,requiredFloors),[...this.bodies.values()].map(b=>b.range),this.grounds);}
}
/** The only issuer: frozen certificate plus the same post-construction native invalidation. */
function issueCertificate(data:StaticCertificateData,bodies:readonly NativeRange[],grounds:readonly{ground:NativeGround;home:Object3D}[]):StaticSupportCertificate{const certificate=Object.freeze({model:data.model,providers:Object.freeze([...data.providers]),edges:Object.freeze(data.edges.map(e=>Object.freeze({a:e.a,b:e.b,kind:e.kind,area:e.area,details:e.details}))),islands:Object.freeze(data.islands.map(c=>Object.freeze({bodies:Object.freeze([...c.bodies]),grounds:Object.freeze([...c.grounds])}))),unsupported:Object.freeze([...data.unsupported])});freezeProof(certificate);issued.set(certificate,()=>{assertNativeRanges(bodies);for(const g of grounds)staticGroundMesh(g.ground,g.home);});return certificate;}

/** Sealed once at the end of construction: the native ranges, their producer provenance and the
 * ordered operations of the former finish(). Every snapshot() is a FRESH generation: fresh deep
 * native reads and copies, a fresh digest and job, and its own single-use acceptance. */
export interface SealedStaticProof{snapshot(eligible:()=>boolean):Generator<unknown,PreparedStaticProof,void>}
/** accept() is the private ticket: staged, abandoned without effect if the scene leaves rest
 * (NotAtRest), and able to issue at most once. */
export interface PreparedStaticProof{readonly request:StaticProofRequest;readonly transfer:readonly ArrayBuffer[];accept(reply:unknown,eligible:()=>boolean):Generator<unknown,StaticSupportCertificate,void>}
interface PlanBody{readonly range:NativeRange;readonly mesh:Mesh;readonly originalGeometry:BufferGeometry;readonly provenance:boolean;bottoms?:readonly number[]}
interface Reference{readonly facets:readonly number[];readonly point:readonly[number,number,number]}
interface Binding{readonly job:number;readonly digest:string;readonly ranges:readonly NativeRange[];readonly bodyIds:readonly string[];readonly ops:readonly ProofOp[];readonly expectedGround:readonly string[];readonly requiredFloors:readonly string[];readonly references:ReadonlyMap<string,Reference>;readonly ground:NativeGround;readonly home:Object3D}
let proofJobs=0;
export class StaticProofPlan{
 private readonly bodies:PlanBody[]=[];private readonly byId=new Map<string,PlanBody>();private readonly ops:ProofOp[]=[];private sealed=false;
 constructor(private readonly nativeGround:NativeGround,private readonly home:Object3D){}
 add(range:NativeRange):void{if(this.sealed)throw Error('Sealed static proof plan');if(this.byId.has(range.id))throw Error('Duplicate physical piece');const s=nativeSource(range);for(const b of this.bodies)if(b.mesh===s.mesh&&range.first<b.range.first+b.range.count&&b.range.first<range.first+range.count)throw Error('Duplicated/overlapping native physical ranges');const body:PlanBody={range,mesh:s.mesh,originalGeometry:s.originalGeometry,provenance:channelInput(s.originalGeometry)!==undefined};this.ops.push(Object.freeze({op:'add',body:this.bodies.length}));this.bodies.push(body);this.byId.set(range.id,body);}
 bond(a:string,b:string):void{this.ops.push(Object.freeze({op:'bond',a,b}));}
 roof(pad:string,floor:string,roof:readonly number[],floorFacet:number):void{this.ops.push(Object.freeze({op:'roof',pad,floor,roof:Object.freeze([...roof]),floorFacet}));}
 continuation(a:string,b:string,endA:'start'|'end',endB:'start'|'end'):void{this.ops.push(Object.freeze({op:'continuation',a,b,endA,endB}));}
 ground(post:string):void{const b=this.byId.get(post);if(!b)throw Error('Missing actual physical piece '+post);if(b.bottoms)throw Error('Duplicate static ground weld');b.bottoms=Object.freeze(nativeBottoms(b.originalGeometry));this.ops.push(Object.freeze({op:'ground',post}));}
 seal(expectedGround:readonly string[],requiredFloors:readonly string[]):SealedStaticProof{if(this.sealed)throw Error('Repeated static enrollment');this.sealed=true;const bodies=Object.freeze(this.bodies.map(b=>Object.freeze({...b}))),ops=Object.freeze(this.ops.slice()),expected=Object.freeze([...expectedGround]),floors=Object.freeze([...requiredFloors]),ground=this.nativeGround,home=this.home;return Object.freeze({snapshot:(eligible:()=>boolean)=>snapshotSteps(bodies,ops,expected,floors,ground,home,eligible)});}
}
function* snapshotSteps(bodies:readonly Readonly<PlanBody>[],ops:readonly ProofOp[],expectedGround:readonly string[],requiredFloors:readonly string[],ground:NativeGround,home:Object3D,eligible:()=>boolean):Generator<unknown,PreparedStaticProof,void>{
 const inputs:ProofBodyInput[]=[],references=new Map<string,Reference>();
 for(const b of bodies){if(!eligible())throw new NotAtRest();const s=nativeProofSnapshot(b.range);if(s.mesh!==b.mesh||s.originalGeometry!==b.originalGeometry)throw Error('Static support source replaced after sealing');const channel=b.provenance?channelInput(b.originalGeometry):undefined;if(b.provenance&&!channel)throw Error('Stale producer channel/frame provenance');
  if(b.bottoms){const f=b.bottoms[0],p=s.positions;if(f===undefined||f*9+2>=p.length)throw Error('Missing compacted declared bottom');references.set(b.range.id,{facets:b.bottoms,point:Object.freeze([p[f*9]!,p[f*9+1]!,p[f*9+2]!])as readonly[number,number,number]});}
  inputs.push({id:b.range.id,positions:s.positions,...(channel?{channel}:{}),...(b.bottoms?{bottoms:b.bottoms}:{})});yield 'snapshot:'+b.range.id;}
 if(!eligible())throw new NotAtRest();const land=nativeLandSnapshot(ground,home);yield 'snapshot:land';
 const input:StaticProofInput={protocol:STATIC_PROOF_PROTOCOL,kernel:STATIC_PROOF_KERNEL,bodies:inputs,land,ops,expectedGround,requiredFloors};
 const digest=yield* digestSteps(input),job=++proofJobs;
 const binding:Binding={job,digest,ranges:bodies.map(b=>b.range),bodyIds:bodies.map(b=>b.range.id),ops,expectedGround,requiredFloors,references,ground,home};
 const transfer=[land.buffer,...inputs.flatMap(b=>b.channel?[b.positions.buffer,b.channel.index.buffer]:[b.positions.buffer])]as ArrayBuffer[],once={used:false};
 return Object.freeze({request:Object.freeze({type:'static-proof',protocol:STATIC_PROOF_PROTOCOL,kernel:STATIC_PROOF_KERNEL,job,digest,input})as StaticProofRequest,transfer:Object.freeze(transfer),accept:(reply:unknown,still:()=>boolean)=>acceptSteps(binding,reply,still,once)});}
const isQ=(v:unknown):v is Q=>!!v&&typeof v==='object'&&typeof(v as Q).n==='bigint'&&typeof(v as Q).d==='bigint'&&(v as Q).d>0n;
const positive=(q:Q)=>q.n>0n;
const sameNumbers=(a:unknown,b:readonly number[])=>Array.isArray(a)&&a.length===b.length&&b.every((v,i)=>Object.hasOwn(a,i)&&Object.is(a[i],v));
const sameStrings=(a:unknown,b:readonly string[])=>Array.isArray(a)&&a.length===b.length&&b.every((v,i)=>Object.hasOwn(a,i)&&a[i]===v);
function sameIslands(a:readonly ProofIsland[],b:unknown):boolean{return Array.isArray(b)&&a.length===b.length&&a.every((c,i)=>{const d=b[i] as ProofIsland|undefined;return!!d&&sameStrings(d.bodies,c.bodies)&&sameStrings(d.grounds,c.grounds);});}
function expectEdge(op:ProofOp,e:ProofEdge,j:number,b:Binding,bodies:ReadonlySet<string>):void{const d=e.details as Record<string,unknown>;let ok:boolean;switch(op.op){
 case'bond':ok=e.kind==='finite-bond'&&e.a===op.a&&e.b===op.b&&bodies.has(op.a)&&bodies.has(op.b)&&positive(e.area);break;
 case'roof':ok=e.kind==='stored-roof-bond'&&e.a===op.pad&&e.b===op.floor&&bodies.has(op.pad)&&bodies.has(op.floor)&&d['roof']===op.roof[j]&&d['floor']===op.floorFacet&&positive(e.area);break;
 case'continuation':ok=e.kind==='material-continuation'&&e.a===op.a&&e.b===op.b&&bodies.has(op.a)&&bodies.has(op.b)&&positive(e.area);break;
 case'ground':{const ref=b.references.get(op.post);ok=!!ref&&e.kind==='ground-weld'&&e.a===op.post&&e.b==='native-land'&&positive(e.area)&&sameNumbers(d['facets'],ref.facets)&&sameNumbers(d['referencePoint'],ref.point);break;}
 default:ok=false;}if(!ok)throw Error('Static proof edge does not answer its operation');}
/** Bounded, staged binding of a worker certificate to the LIVE scene: identity; a deep pass over
 * every native range and the ground; structure against our own request; islands; then ONE task
 * that DEEPLY rechecks current bytes/identity/frames/visibility/home of every range, ground and issues. It
 * does not repeat the exact geometry. Film start adds the atomic deep recheck (beginFilm). */
function* acceptSteps(b:Binding,value:unknown,eligible:()=>boolean,once:{used:boolean}):Generator<unknown,StaticSupportCertificate,void>{
 if(once.used)throw Error('Replayed static proof acceptance');
 const r=structuredClone(value) as Partial<Extract<StaticProofReply,{outcome:'certified'}>>|null;
 if(!r||typeof r!=='object'||r.type!=='static-proof-result'||r.protocol!==STATIC_PROOF_PROTOCOL||r.kernel!==STATIC_PROOF_KERNEL||r.job!==b.job||r.inputDigest!==b.digest||r.outcome!=='certified')throw Error('Static proof reply does not answer this scene');
 const c=r.certificate,edgeOps=r.edgeOps;
 if(!c||typeof c!=='object'||!Array.isArray(c.edges)||!Array.isArray(c.islands)||!Array.isArray(c.providers)||!Array.isArray(c.unsupported)||!(edgeOps instanceof Uint32Array)||edgeOps.length!==c.edges.length)throw Error('Partial static proof reply');
 for(const range of b.ranges){if(!eligible())throw new NotAtRest();nativeRangeAtHome(range);yield 'accept:'+range.id;}
 if(!eligible())throw new NotAtRest();staticGroundMesh(b.ground,b.home);yield 'accept:ground';
 if(c.model!=='massless-ideal-bilateral-unrated'||c.unsupported.length!==0||!sameStrings(c.providers,b.expectedGround))throw Error('Wrong static proof providers');
 const bodies=new Set(b.bodyIds),grounded=new Set<string>();let k=0;
 for(let i=0;i<b.ops.length;i++){const op=b.ops[i]!,start=k;while(k<edgeOps.length&&edgeOps[k]===i){const e=c.edges[k] as ProofEdge|undefined;if(!e||typeof e!=='object'||!isQ(e.area)||!e.details||typeof e.details!=='object')throw Error('Malformed static proof edge');expectEdge(op,e,k-start,b,bodies);k++;}const n=k-start;
  if(op.op==='add'&&n!==0||op.op==='bond'&&n<1||op.op==='roof'&&n!==op.roof.length||op.op==='ground'&&n!==1)throw Error('Static proof edges do not match operation '+i);if(op.op==='ground')grounded.add(op.post);if(i%64===63)yield 'accept:structure:'+i;}
 if(k!==edgeOps.length)throw Error('Static proof edges out of operation order');
 if(grounded.size!==b.expectedGround.length||b.expectedGround.some(id=>!grounded.has(id)))throw Error('Wrong static proof ground set');
 const{islands,unsupported}=islandsOf(b.bodyIds,c.edges,grounded,b.requiredFloors);
 if(unsupported.length||!sameIslands(islands,c.islands))throw Error('Static proof islands do not follow its edges');
 yield 'accept:pre-atomic';
 if(!eligible())throw new NotAtRest();
 assertNativeRanges(b.ranges,true);staticGroundMesh(b.ground,b.home);
 if(once.used)throw Error('Replayed static proof acceptance');once.used=true;
 return issueCertificate({model:'massless-ideal-bilateral-unrated',providers:b.expectedGround,edges:c.edges,islands,unsupported:[]},b.ranges,[{ground:b.ground,home:b.home}]);}
/** Components publish their total reaction about the authored origin. A separate
 * allocation transports that wrench to a reference point on one actual full
 * ground domain. The point is a reference for the six-component weld, not a
 * replacement of its finite area by a point contact. */
function finiteTriple(value: unknown): value is readonly [number, number, number] {
  if (!Array.isArray(value) || value.length !== 3) return false;
  for (let i = 0; i < 3; i++) {
    if (!Object.hasOwn(value, i) || !Number.isFinite(value[i])) return false;
  }
  return true;
}

export class StaticWrenchPath {
  private readonly bodyIsland = new Map<string, number>();
  private readonly workspace: Float64Array;
  readonly totalReference = 'authored-origin' as const;
  readonly reactionGroundIds: readonly string[];
  readonly reactionGroundOrigins: readonly (readonly [number, number, number] | undefined)[];

  constructor(readonly certificate: StaticSupportCertificate) {
    assertStaticSupportCertificate(certificate);
    certificate.islands.forEach((c, i) => c.bodies.forEach(b => this.bodyIsland.set(b, i)));
    this.workspace = new Float64Array(certificate.islands.length * 6);
    this.reactionGroundIds = Object.freeze(certificate.islands.map(c => c.grounds[0] ?? 'unaccepted-unloaded'));
    this.reactionGroundOrigins = Object.freeze(certificate.islands.map(c => {
      const id = c.grounds[0];
      if (id === undefined) return undefined;
      const edge = certificate.edges.find(e => e.kind === 'ground-weld' && e.a === id);
      const details = edge?.details as {readonly referencePoint?: unknown} | undefined;
      if (!finiteTriple(details?.referencePoint)) throw Error('Missing native ground wrench reference');
      return details.referencePoint;
    }));
  }

  /** Result: total reaction force/impulse and moment about the authored origin.
   * Every actual applied load is required, including resting gravity. */
  transmit(kind: 'force' | 'impulse', loads: readonly {
    readonly body: string;
    readonly point: readonly [number, number, number];
    readonly forceOrImpulse: readonly [number, number, number];
    readonly couple: readonly [number, number, number];
  }[], out: Float64Array): void {
    assertStaticSupportCertificate(this.certificate);
    if (kind !== 'force' && kind !== 'impulse') throw Error('Declare force/impulse units');
    if (out.length !== this.workspace.length) throw Error('Wrench output shape');
    this.workspace.fill(0);
    for (const load of loads) {
      if (!load) throw Error('Missing static load');
      const i = this.bodyIsland.get(load.body);
      if (i === undefined) throw Error('Load outside grounded static island');
      if (!this.certificate.islands[i]!.grounds.length) throw Error('Load on unaccepted ungrounded assembly');
      const p = load.point, f = load.forceOrImpulse, c = load.couple;
      if (!finiteTriple(p) || !finiteTriple(f) || !finiteTriple(c)) throw Error('Invalid static load triple');
      const j = i * 6;
      for (let k = 0; k < 3; k++) this.workspace[j + k]! -= f[k]!;
      this.workspace[j + 3]! -= c[0] + p[1] * f[2] - p[2] * f[1];
      this.workspace[j + 4]! -= c[1] + p[2] * f[0] - p[0] * f[2];
      this.workspace[j + 5]! -= c[2] + p[0] * f[1] - p[1] * f[0];
    }
    if (!this.workspace.every(Number.isFinite)) throw Error('Static total overflow');
    out.set(this.workspace);
  }

  /** One admissible allocation: first certified bilateral weld takes the total;
   * its couple is M_origin - r_ground x F. Other welds in that component take
   * zero. This is not a unique physical split or a strength claim. */
  allocateToGround(kind: 'force' | 'impulse', totals: Float64Array, out: Float64Array): void {
    assertStaticSupportCertificate(this.certificate);
    if (kind !== 'force' && kind !== 'impulse') throw Error('Declare force/impulse units');
    if (totals.length !== this.workspace.length || out.length !== totals.length) throw Error('Ground wrench output shape');
    if (!totals.every(Number.isFinite)) throw Error('Invalid authored-origin totals');
    for (let i = 0; i < this.certificate.islands.length; i++) {
      const j = i * 6, r = this.reactionGroundOrigins[i];
      const fx = totals[j]!, fy = totals[j + 1]!, fz = totals[j + 2]!;
      const mx = totals[j + 3]!, my = totals[j + 4]!, mz = totals[j + 5]!;
      if (r === undefined) {
        if (fx || fy || fz || mx || my || mz) throw Error('Allocation on ungrounded assembly');
        for (let k = 0; k < 6; k++) out[j + k] = 0;
        continue;
      }
      out[j] = fx; out[j + 1] = fy; out[j + 2] = fz;
      out[j + 3] = mx - (r[1] * fz - r[2] * fy);
      out[j + 4] = my - (r[2] * fx - r[0] * fz);
      out[j + 5] = mz - (r[0] * fy - r[1] * fx);
    }
    if (!out.every(Number.isFinite)) throw Error('Ground allocation overflow');
  }
}
