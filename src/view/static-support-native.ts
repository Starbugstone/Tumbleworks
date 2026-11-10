// Only constructor/enrollment calls scan streams. No frame/tick hooks.
import{BufferAttribute,BufferGeometry,Matrix4,Mesh,Object3D}from'three';
import{closed,triangleAt,type Tri}from'./support-exact';
import{nativeTerrainOwnership}from'./village-terrain';
import{channelSurface}from'./machine-primitives';
interface AttributeRecord{attribute:BufferAttribute;array:object;values:Float32Array|Uint16Array|Uint32Array;size:number;normalized:boolean;version:number}
interface Frame{node:Object3D;parent:Object3D|null;matrix:readonly number[]}
interface Source{revoked?:boolean;mesh:Mesh;geometry:BufferGeometry;attributes:Map<string,AttributeRecord>;index:AttributeRecord|null;frames:Frame[];material:unknown;home:Object3D;id:string;closedProxy:readonly Tri[]|undefined;recordedChannel:boolean}
export interface NativeRange {readonly id:string;readonly first:number;readonly count:number}
interface Bound{source:Source;actual:Source;first:number;count:number;expected:Map<string,Float32Array>;relative:readonly number[]}
const ranges=new WeakMap<NativeRange,Bound>();
function attribute(a:BufferAttribute):AttributeRecord{if('isInterleavedBufferAttribute'in a)throw Error('Interleaved support attribute unsupported');return{attribute:a,array:a.array,values:a.array.slice()as AttributeRecord['values'],size:a.itemSize,normalized:a.normalized,version:a.version};}
function frames(mesh:Object3D,home:Object3D):Frame[]{const path:Frame[]=[];for(let p:Object3D|null=mesh;p!==home;p=p.parent){if(!p)throw Error('Support provider not under its declared common home');if(p.matrixAutoUpdate)p.updateMatrix();path.push({node:p,parent:p.parent,matrix:p.matrix.toArray()});}return path;}
function source(id:string,mesh:Mesh,home:Object3D,proxy?:readonly Tri[]):Source{mesh.updateWorldMatrix(true,false);if(proxy)closed(proxy);return{id,mesh,geometry:mesh.geometry,recordedChannel:channelSurface(mesh.geometry)!==undefined,attributes:new Map(Object.entries(mesh.geometry.attributes).map(([n,a])=>[n,attribute(a as BufferAttribute)])),index:mesh.geometry.index?attribute(mesh.geometry.index):null,frames:frames(mesh,home),material:mesh.material,home,closedProxy:proxy};}
function checkAttribute(a:BufferAttribute|undefined,r:AttributeRecord,deep:boolean){if(!a||a!==r.attribute||a.array!==r.array||a.itemSize!==r.size||a.normalized!==r.normalized||a.array.length!==r.values.length||a.version!==r.version)throw Error('Changed support source attribute');if(deep)for(let i=0;i<r.values.length;i++)if(!Object.is(a.array[i],r.values[i]))throw Error('Dirty support array');}
function check(s:Source,deep:boolean,detached=false){if(s.revoked)throw Error('Disposed native support owner');if(s.recordedChannel&&!channelSurface(s.geometry))throw Error('Stale producer channel/frame provenance');if(s.mesh.geometry!==s.geometry||s.mesh.material!==s.material||Object.keys(s.geometry.attributes).length!==s.attributes.size)throw Error('Replaced support geometry/material');for(const[n,a]of s.attributes)checkAttribute(s.geometry.getAttribute(n)as BufferAttribute,a,deep);if(s.index)checkAttribute(s.geometry.index??undefined,s.index,deep);else if(s.geometry.index)throw Error('Replaced support index');for(const f of s.frames){if(detached){if(f.node===s.mesh){if(f.node.matrixAutoUpdate)f.node.updateMatrix();if(f.node.matrix.elements.some((v,i)=>!Object.is(v,f.matrix[i])))throw Error('Stale detached source frame');}continue;}if(f.node.matrixAutoUpdate)f.node.updateMatrix();if(f.node.parent!==f.parent||!f.node.visible||f.node.matrix.elements.some((v,i)=>!Object.is(v,f.matrix[i])))throw Error('Changed/hidden support relative frame');}for(let p:Object3D|null=s.home;p;p=p.parent)if(!p.visible)throw Error('Hidden common support display');}
export function relativeSupportFrame(mesh:Object3D,home:Object3D):Matrix4{const path=frames(mesh,home),m=new Matrix4();for(let i=path.length-1;i>=0;i--)m.multiply(path[i]!.node.matrix);return m;}
/** Private per-constructor source registry. Raw source IDs are derived at emitter
 * call sites; a caller receipt/WeakMap descriptor never issues a native range. */
export class StaticNativeIssuer{
 private readonly sources=new Map<Mesh,Source>();private readonly issued:NativeRange[]=[];private readonly actuals=new Map<Mesh,Source>();private sealed=false;
 constructor(private readonly home:Object3D){}
 record(id:string,mesh:Mesh,proxy?:readonly Tri[]):void{if(this.sealed)throw Error('Sealed native issuer');if(this.sources.has(mesh)||[...this.sources.values()].some(s=>s.id===id))throw Error('Duplicate support provider');this.sources.set(mesh,source(id,mesh,this.home,proxy));}
 /** Called INSIDE the real merge, after applying its actual relative matrix to
  * piece and BEFORE disposing source meshes. No test merge bypass. */
 bind(mesh:Mesh,actual:Mesh,first:number,count:number,piece:BufferGeometry,applied:Matrix4,mergeGroup:Object3D):NativeRange|undefined{const s=this.sources.get(mesh);if(!s)return;check(s,true);const p=piece.getAttribute('position');if(!Number.isInteger(first)||first<0||count!==p.count||count%3)throw Error('Wrong support merged range');mergeGroup.updateWorldMatrix(true,true);const expectedMatrix=mergeGroup.matrixWorld.clone().invert().multiply(mesh.matrixWorld);if(!expectedMatrix.equals(applied))throw Error('Wrong native merge operation');const reconstructed=s.geometry.index?s.geometry.toNonIndexed():s.geometry.clone();try{reconstructed.applyMatrix4(applied);for(const[n,a]of Object.entries(reconstructed.attributes)){const b=piece.getAttribute(n);if(!b||b.itemSize!==a.itemSize||b.array.length!==a.array.length)throw Error('Missing native merge attribute');for(let i=0;i<a.array.length;i++)if(!Object.is(a.array[i],b.array[i]))throw Error('Packed native source differs');}}finally{reconstructed.dispose();}
  const range=Object.freeze({id:s.id,first,count}),expected=new Map<string,Float32Array>();for(const[n,a]of Object.entries(piece.attributes)){if(a.itemSize!==3||!(a.array instanceof Float32Array))throw Error('Support attributes must be Float32 triples');expected.set(n,a.array.slice());}let actualRecord=this.actuals.get(actual);if(!actualRecord){actualRecord=source('merged',actual,this.home);this.actuals.set(actual,actualRecord);}const b={source:s,actual:actualRecord,first,count,expected,relative:relativeSupportFrame(actual,this.home).toArray()};ranges.set(range,b);this.issued.push(range);assertNativeRange(range,true);return range;}
 dispose():void{for(const s of this.sources.values())s.revoked=true;for(const s of this.actuals.values())s.revoked=true;this.sources.clear();this.actuals.clear();this.issued.length=0;this.sealed=true;}
 finish():readonly NativeRange[]{if(this.sealed)throw Error('Repeated native seal');if(this.issued.length!==this.sources.size)throw Error('Missing source-to-native range');for(const r of this.issued){const b=ranges.get(r)!;if(!relativeSupportFrame(b.actual.mesh,this.home).equals(new Matrix4().fromArray(b.relative)))throw Error('Final wrapper changed physical home');}for(const s of this.actuals.values())s.frames=frames(s.mesh,this.home);this.sealed=true;for(const r of this.issued)assertNativeRange(r,true);return Object.freeze([...this.issued]);}
}
/** Explicit enrollment/proof command, never a simulation/sample query. Deep=true
 * rejects undirty direct-array writes as well as versioned mutations. */
type CheckedSources = readonly [Set<Source>, Set<Source>];
function checkOnce(s: Source, detached: boolean, checked: CheckedSources): void {
 const seen = checked[detached ? 1 : 0];
 if (seen.has(s)) return;
 check(s, true, detached);
 seen.add(s); // A failed deep check never enters the invocation's successful set.
}
function assertRange(range:NativeRange,deep:boolean,checked?:CheckedSources):Bound{const b=ranges.get(range);if(!b)throw Error('Unissued native range');if(checked){checkOnce(b.source,true,checked);checkOnce(b.actual,false,checked);}else{check(b.source,deep,true);check(b.actual,deep,false);}if(deep)for(const[n,values]of b.expected){const a=b.actual.geometry.getAttribute(n);if((b.first+b.count)>a.count)throw Error('Truncated native support range');for(let i=0;i<values.length;i++)if(!Object.is(a.array[b.first*3+i],values[i]))throw Error('Wrong native range/content');}return b;}
export function assertNativeRange(range:NativeRange,deep=true):void{assertRange(range,deep);}
/** One synchronous deep pass in original range order. Only successful private
 * (Source, detached mode) checks are shared, for this invocation alone. Every
 * range slice and optional authored-home assertion remains independent. There
 * is no callback, yield, issuance or retained memo at this boundary. */
export function assertNativeRanges(batch:readonly NativeRange[],atHome=false):void{
 const checked:CheckedSources=[new Set(),new Set()];
 for(const range of batch){const b=assertRange(range,true,checked);if(atHome)assertHome(b);}
}
function readFacets(range:NativeRange):readonly Tri[]{const b=ranges.get(range)!;const g=b.actual.geometry,m=relativeSupportFrame(b.actual.mesh,b.actual.home);if(!m.equals(new Matrix4()))throw Error('Native static piece not in authored common home');if(!m.equals(new Matrix4().fromArray(b.relative)))throw Error('Changed native relative frame');return Array.from({length:b.count/3},(_,i)=>triangleAt(g,b.first/3+i));}
function readSource(range:NativeRange):{readonly mesh:Mesh;readonly proxy:readonly Tri[]|undefined;readonly home:Object3D;readonly originalGeometry:BufferGeometry}{const b=ranges.get(range)!;return{mesh:b.actual.mesh,proxy:b.source.closedProxy,originalGeometry:b.source.geometry,home:b.actual.home};}

/** One deep read supplies both operands for a single synchronous operation.
 * Separate calls retain independent full native validation. */
export function nativePiece(range:NativeRange):ReturnType<typeof readSource>&{readonly facets:readonly Tri[]}{assertNativeRange(range,true);return{...readSource(range),facets:readFacets(range)};}
export function nativeFacets(range:NativeRange):readonly Tri[]{assertNativeRange(range,true);return readFacets(range);}
export function nativeSource(range:NativeRange):ReturnType<typeof readSource>{assertNativeRange(range,true);return readSource(range);}
/** Background-proof snapshot: one deep read with readFacets' home-frame tests. The positions are
 * the issued range bytes, equal to the drawn merged buffer, 9 values per facet. */
export function nativeProofSnapshot(range:NativeRange):{readonly mesh:Mesh;readonly originalGeometry:BufferGeometry;readonly positions:Float32Array}{nativeRangeAtHome(range);const b=ranges.get(range)!;return{mesh:b.actual.mesh,originalGeometry:b.source.geometry,positions:b.expected.get('position')!.slice()};}
/** Acceptance recheck: the same deep content and frame tests as nativePiece, without copying facets. */
function assertHome(b:Bound):void{const m=relativeSupportFrame(b.actual.mesh,b.actual.home);if(!m.equals(new Matrix4()))throw Error('Native static piece not in authored common home');if(!m.equals(new Matrix4().fromArray(b.relative)))throw Error('Changed native relative frame');}
export function nativeRangeAtHome(range:NativeRange):void{assertRange(range,true);assertHome(ranges.get(range)!);}


export interface NativeGround {readonly home:Object3D}
const grounds=new WeakMap<NativeGround,{source:Source;fields:readonly unknown[]}>();
const groundFields=(mesh:Mesh)=>{const t=nativeTerrainOwnership(mesh).terrain;return[t.columns,t.rows,t.originX,t.originZ,t.cellWidth,t.cellDepth,...t.heights,...t.paint,...t.cells];};
export function bindStaticGround(mesh:Mesh,home:Object3D):NativeGround{nativeTerrainOwnership(mesh);if(!relativeSupportFrame(mesh,home).equals(new Matrix4()))throw Error('Actual ground left authored home');const ticket=Object.freeze({home});grounds.set(ticket,{source:source('native-ground',mesh,home),fields:groundFields(mesh)});return ticket;}
export function staticGroundMesh(ticket:NativeGround,home:Object3D):Mesh{const record=grounds.get(ticket),s=record?.source;if(!record||!s||ticket.home!==home)throw Error('Wrong actual ground/home');check(s,true);const fields=groundFields(s.mesh);if(fields.length!==record.fields.length||fields.some((v,i)=>!Object.is(v,record.fields[i])))throw Error('Stale ground topology descriptor');nativeTerrainOwnership(s.mesh);return s.mesh;}
/** Ownership-ordered land triangles of the checked ground, 9 Float32 values each. */
export function nativeLandSnapshot(ticket:NativeGround,home:Object3D):Float32Array{const mesh=staticGroundMesh(ticket,home),land=nativeTerrainOwnership(mesh).land,p=mesh.geometry.getAttribute('position'),out=new Float32Array(land.length*9);land.forEach((t,i)=>{for(let k=0;k<3;k++){out[i*9+k*3]=p.getX(t*3+k);out[i*9+k*3+1]=p.getY(t*3+k);out[i*9+k*3+2]=p.getZ(t*3+k);}});return out;}
export function nativeComponent(parent:NativeRange,id:string,offset:number,count:number):NativeRange{assertNativeRange(parent,true);const b=ranges.get(parent)!;if(!Number.isInteger(offset)||!Number.isInteger(count)||offset<0||count<=0||count%3||offset%3||offset+count>parent.count)throw Error('Wrong closed native component');const ticket=Object.freeze({id,first:b.first+offset,count}),expected=new Map([...b.expected].map(([n,a])=>[n,a.slice(offset*3,(offset+count)*3)]));ranges.set(ticket,{...b,first:ticket.first,count,expected});closed(nativeFacets(ticket));return ticket;}
