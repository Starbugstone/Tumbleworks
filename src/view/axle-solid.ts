// Mill111 selected axle implementation. Builders preserve nominal inputs and every actual Float32 store.
import * as T from 'three';
export function box(x:number,y:number,z:number,w:number,h:number,d:number){const g=new T.BoxGeometry(w,h,d),p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setXYZ(i,x+(p.getX(i)<0?-w:w)/2,y+(p.getY(i)<0?-h:h)/2,z+(p.getZ(i)<0?-d:d)/2);return g;}
export interface PrismLineage {readonly vertices:readonly(readonly[number,number,number])[];readonly stores:readonly Store[];readonly loops:readonly(readonly(readonly[number,number])[])[]}
const prismSources=new WeakMap<T.BufferGeometry,PrismLineage>();
export function prismLineage(g:T.BufferGeometry){const source=prismSources.get(g);if(!source)throw new Error('No actual prism construction lineage');return source;}
export function prism(outline:readonly (readonly[number,number])[],holes:readonly (readonly (readonly[number,number])[])[],z0:number,z1:number){
 if(!(z1>z0))throw new Error('Positive finite prism depth required');
 const orient=(loop:readonly(readonly[number,number])[],ccw:boolean)=>{const p=loop.map(a=>new T.Vector2(a[0],a[1]));if((T.ShapeUtils.area(p)>0)!==ccw)p.reverse();return p;},outer=orient(outline,true),inner=holes.map(h=>orient(h,false)),all=[...outer,...inner.flat()],caps=T.ShapeUtils.triangulateShape(outer,inner),vertices:(readonly[number,number,number])[]=[],add=(a:T.Vector2,z:number)=>vertices.push([a.x,a.y,z]);
 for(const ids of caps){const a=all[ids[0]!]!,b=all[ids[1]!]!,c=all[ids[2]!]!;add(a,z0);add(c,z0);add(b,z0);add(a,z1);add(b,z1);add(c,z1);}
 for(const loop of[outer,...inner])for(let i=0;i<loop.length;i++){const a=loop[i]!,b=loop[(i+1)%loop.length]!;add(a,z0);add(b,z0);add(b,z1);add(a,z0);add(b,z1);add(a,z1);}
 const g=new T.BufferGeometry();try{const packed=new Float32Array(vertices.length*3),stores:Store[]=[];for(let i=0;i<vertices.length;i++){const v=vertices[i]!;for(let j=0;j<3;j++)packed[3*i+j]=v[j]!;const p=[packed[3*i]!,packed[3*i+1]!,packed[3*i+2]!]as const;stores.push({nominal:v,packed:p,error:[p[0]-v[0],p[1]-v[1],p[2]-v[2]],materialDirection:[0,0,0]});}g.setAttribute('position',new T.BufferAttribute(packed,3));g.computeVertexNormals();prismSources.set(g,{vertices,stores,loops:[outer,...inner].map(l=>l.map(v=>[v.x,v.y]as const))});return g;}catch(error){g.dispose();throw error;}
}
export interface PrismComponent147 {
 readonly first:number;
 readonly count:number;
 readonly source:PrismLineage;
}
interface PrismComposite147 {
 readonly position:T.BufferAttribute;
 readonly array:object;
 readonly version:number;
 readonly count:number;
 readonly normal:T.BufferAttribute;
 readonly normalArray:object;
 readonly normalVersion:number;
 readonly normalValues:Float32Array;
 readonly packed:Float32Array;
 readonly components:readonly PrismComponent147[];
}
const compositePrisms147=new WeakMap<T.BufferGeometry,PrismComposite147>();
const copyLineage147=(s:PrismLineage,tick:()=>void):PrismLineage=>{
 const v3=(v:readonly[number,number,number])=>Object.freeze(v.map(x=>{tick();return x;})as[number,number,number]);
 const v2=(v:readonly[number,number])=>Object.freeze(v.map(x=>{tick();return x;})as[number,number]);
 return Object.freeze({
 vertices:Object.freeze(s.vertices.map(v3)),
 stores:Object.freeze(s.stores.map(v=>Object.freeze({
  nominal:v3(v.nominal),
  packed:v3(v.packed),
  error:v3(v.error),
  materialDirection:v3(v.materialDirection),
 }))),
 loops:Object.freeze(s.loops.map(l=>Object.freeze(l.map(v2)))),
 });
};
export function prismComponentRanges(g:T.BufferGeometry,tick:()=>void){
 tick();const r=compositePrisms147.get(g),p=g.getAttribute('position');
 if(!r||g.index||g.groups.length||g.drawRange.start!==0||g.drawRange.count!==Infinity||p!==r.position||p.array!==r.array||p.itemSize!==3||p.normalized||p.version!==r.version||p.count!==r.count||p.array.length!==r.packed.length)throw Error('Changed actual composite prism');
 for(let i=0;i<r.packed.length;i++){tick();if(!Object.is(p.array[i],r.packed[i]))throw Error('Changed actual composite store');}
 const n=g.getAttribute('normal');if(n!==r.normal||n.array!==r.normalArray||n.version!==r.normalVersion||n.itemSize!==3||n.normalized||n.count!==r.count)throw Error('Changed composite normals');for(let i=0;i<r.normalValues.length;i++){tick();if(!Object.is(n.array[i],r.normalValues[i]))throw Error('Changed composite normal');}
 return r.components;
}
/** Consumes temporary pieces on success AND failure. This is concatenation of
 * disconnected closed prisms, not a Boolean union or a native certificate. */
export function prismUnion(pieces:readonly T.BufferGeometry[],tick:()=>void){
 let g:T.BufferGeometry|undefined;
 try{
  tick();if(pieces.length<2||new Set(pieces).size!==pieces.length)throw Error('Distinct actual prism components required');
  const records=pieces.map(piece=>{
   tick();const source=prismLineage(piece),p=piece.getAttribute('position');
   if(piece.index||!(p instanceof T.BufferAttribute)||!(p.array instanceof Float32Array)||p.itemSize!==3||p.normalized||p.count%3||p.count===0||source.stores.length!==p.count||source.vertices.length!==p.count)throw Error('Non-indexed actual Float32 prism required');
   for(let i=0;i<p.count;i++)for(let j=0;j<3;j++){tick();if(!Number.isFinite(p.getComponent(i,j))||!Object.is(p.getComponent(i,j),source.stores[i]!.packed[j]))throw Error('Changed prism component store');}
   return{p,source:copyLineage147(source,tick)};
  });
  const total=records.reduce((n,r)=>{tick();return n+r.p.count;},0),packed=new Float32Array(total*3),components:PrismComponent147[]=[];let at=0;
  for(const r of records){for(let i=0;i<r.p.array.length;i++){tick();packed[at*3+i]=r.p.array[i]!;}components.push(Object.freeze({first:at,count:r.p.count,source:r.source}));at+=r.p.count;}
  g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(packed,3));g.computeVertexNormals();
  // Deliberately NOT added to prismSources: loops[1] must never impersonate a hole.
  const position=g.getAttribute('position')as T.BufferAttribute;
  const expected=new Float32Array(packed.length);for(let i=0;i<packed.length;i++){tick();expected[i]=packed[i]!;}
  const normal=g.getAttribute('normal')as T.BufferAttribute,normalValues=new Float32Array(normal.array.length);for(let i=0;i<normalValues.length;i++){tick();normalValues[i]=normal.array[i]!;}compositePrisms147.set(g,{position,array:position.array,version:position.version,count:position.count,normal,normalArray:normal.array,normalVersion:normal.version,normalValues,packed:expected,components:Object.freeze(components)});
  return g;
 }catch(error){g?.dispose();throw error;}
 finally{for(const p of new Set(pieces))p.dispose();}
}

export const polygon=(r:number,n:number,x=0,y=0,phase=0)=>Array.from({length:n},(_,i)=>[x+r*Math.cos(phase+2*Math.PI*i/n),y+r*Math.sin(phase+2*Math.PI*i/n)]as const);
export const annulus=(inner:number,outer:number,n:number,z0:number,z1:number,x=0,y=0)=>prism(polygon(outer,n,x,y),[polygon(inner,n,x,y)],z0,z1);
export function beam(a:T.Vector3,b:T.Vector3,width:number,depth:number){const d=b.clone().sub(a),g=new T.BoxGeometry(width,d.length(),depth);g.applyQuaternion(new T.Quaternion().setFromUnitVectors(new T.Vector3(0,1,0),d.normalize()));return g.translate((a.x+b.x)/2,(a.y+b.y)/2,(a.z+b.z)/2);}
export function reflected(g:T.BufferGeometry){const h=g.clone().scale(1,1,-1);if(h.index){const a=Array.from(h.index.array);for(let i=0;i<a.length;i+=3)[a[i+1],a[i+2]]=[a[i+2]!,a[i+1]!];h.setIndex(a);}else{for(const attr of Object.values(h.attributes))for(let i=0;i<attr.count;i+=3)for(let j=0;j<attr.itemSize;j++){const a=attr.array as Float32Array,k=(i+1)*attr.itemSize+j,l=(i+2)*attr.itemSize+j;[a[k],a[l]]=[a[l]!,a[k]!];}}h.computeVertexNormals();return h;}
export function closeChannel(render:T.BufferGeometry){const g=render.clone(),p=g.getAttribute('position'),n=p.count/2;if(n!==8)throw new Error('Exact two-ring timber profile expected');const profile=Array.from({length:n},(_,i)=>new T.Vector2(p.getZ(i),p.getY(i))),caps=T.ShapeUtils.triangulateShape(profile,[]),indices=Array.from(g.index!.array),start=indices.length,normal=new T.Vector3();for(const ring of[0,1])for(const ids of caps){const a=ring*n+ids[0]!,b=ring*n+ids[1]!,c=ring*n+ids[2]!,va=new T.Vector3().fromBufferAttribute(p,a),vb=new T.Vector3().fromBufferAttribute(p,b),vc=new T.Vector3().fromBufferAttribute(p,c);normal.crossVectors(vb.sub(va),vc.sub(va));if(normal.x*(ring===0?-1:1)<0)indices.push(a,c,b);else indices.push(a,b,c);}g.setIndex(indices);return{geometry:g,caps:indices.slice(start),renderTriangles:start/3};}
export interface Store {readonly nominal:readonly[number,number,number];readonly packed:readonly[number,number,number];readonly error:readonly[number,number,number];readonly materialDirection:readonly[number,number,number]}
export function directed32(x:number,direction:number){let y=Math.fround(x);if((y-x)*direction>=0||direction===0)return y;const buffer=new ArrayBuffer(4),v=new DataView(buffer);v.setFloat32(0,y);let b=v.getUint32(0);b+=((y>0)===(direction>0))?1:-1;v.setUint32(0,b);return v.getFloat32(0);}

/** One closed mitred planar girder, preserving the selected centre path. */
export function mitredGirder(path:readonly(readonly[number,number])[],width:number,bottom:number,top:number){const half=width/2,edge=(i:number)=>{const a=path[i]!,b=path[i+1]!,dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);if(!(l>0))throw new Error('Zero girder span');return[dx/l,dz/l]as const;},left:(readonly[number,number])[]=[],right:(readonly[number,number])[]=[];for(let i=0;i<path.length;i++){const p=path[i]!,a=edge(Math.max(0,i-1)),b=edge(Math.min(path.length-2,i)),nx=-a[1]-b[1],nz=a[0]+b[0],l=Math.hypot(nx,nz),den=l?(-b[1]*nx+b[0]*nz)/l:0;if(den<.2)throw new Error('Girder miter has no finite supported width');const x=half*nx/l/den,z=half*nz/l/den;left.push([p[0]+x,p[1]+z]);right.push([p[0]-x,p[1]-z]);}const g=prism([...left,...right.reverse()],[],-top,-bottom),m=new T.Matrix4().makeBasis(new T.Vector3(1,0,0),new T.Vector3(0,0,1),new T.Vector3(0,-1,0));return g.applyMatrix4(m);}
export function caliperYoke(ox:number,oy:number,angle:number){const profile=[[2.09,-3.76],[2.26,-3.76],[2.26,-3.90],[2.09,-3.90],[2.09,-3.88],[2.20,-3.88],[2.20,-3.78],[2.09,-3.78]]as const,g=prism(profile,[],-.03,.03),c=Math.cos(angle),s=Math.sin(angle),m=new T.Matrix4().makeBasis(new T.Vector3(c,s,0),new T.Vector3(0,0,1),new T.Vector3(s,-c,0));m.setPosition(ox,oy,0);return g.applyMatrix4(m);}

/** The selected square guide is copied from its unchanged canonical bore planes. */
export function squareGuidePlanes(block:T.BufferGeometry,z:number){const p=block.getAttribute('position'),xs=[...new Set(Array.from({length:p.count},(_,i)=>p.getX(i)).filter(x=>Math.abs(x)<.03))].sort((a,b)=>a-b),zs=[...new Set(Array.from({length:p.count},(_,i)=>p.getZ(i)).filter(v=>Math.abs(v-z)<.03))].sort((a,b)=>a-b);if(xs.length!==2||zs.length!==2||!(xs[1]!>xs[0]!&&zs[1]!>zs[0]!))throw new Error('Actual selected square-bore planes missing');return{x0:xs[0]!,x1:xs[1]!,z0:zs[0]!,z1:zs[1]!};}
export function matchedSquareGuide(planes:ReturnType<typeof squareGuidePlanes>,bottom:number,top:number){const g=new T.BoxGeometry(1,1,1),p=g.getAttribute('position');for(let i=0;i<p.count;i++)p.setXYZ(i,p.getX(i)<0?planes.x0:planes.x1,p.getY(i)<0?bottom:top,p.getZ(i)<0?planes.z0:planes.z1);g.computeVertexNormals();return g;}

/** Closed physical ends for a plain fixed timber source of any ring count.
 * This adds hidden end faces only; every native visible facet remains literal. */
export function closeFixedChannel(render:T.BufferGeometry){
 const g=render.clone(),p=g.getAttribute('position'),count=p.count,ix=g.index;if(count<16||count%8||!ix||ix.count!==(count/8-1)*48||!Array.from(p.array).every(Number.isFinite)){g.dispose();throw new Error('Plain finite fixed timber source required');}
 const indices=Array.from(ix.array),caps=T.ShapeUtils.triangulateShape(Array.from({length:8},(_,i)=>new T.Vector2(p.getZ(i),p.getY(i))),[]),centre=(base:number)=>{const c=new T.Vector3();for(let i=0;i<8;i++)c.add(new T.Vector3().fromBufferAttribute(p,base+i));return c.multiplyScalar(1/8);};
 for(const ring of[0,count-8]){const direction=ring===0?centre(0).sub(centre(8)):centre(count-8).sub(centre(count-16));for(const face of caps){const[a,b,c]=face.map(i=>ring+i)as[number,number,number],A=new T.Vector3().fromBufferAttribute(p,a),N=new T.Vector3().fromBufferAttribute(p,b).sub(A).cross(new T.Vector3().fromBufferAttribute(p,c).sub(A)),d=N.dot(direction);if(d===0){g.dispose();throw new Error('Degenerate fixed timber end');}if(d>0)indices.push(a,b,c);else indices.push(a,c,b);}}g.setIndex(indices);return g;
}

// This additive builder owns its private source and final-frame lineage. None
// of the legacy prism/annulus/translate entry points changes its store path.
import{AxleKinematics as JournalKinematics}from'../world/axle-kinematics';
import type{AxleStation}from'../world/axle-types';
import{reject as journalReject}from'../world/axle-types';
import{journalOperatorBound}from'../world/axle-journal-bound';
import{journalNine,selectJournalStores,JournalConstructionError,type JournalPoint}from'./axle-journal-family';
import{rat as journalRat}from'../world/rocker-foot';
export type JournalId156='J1-shaft'|'J3-shaft'|'J3'|'J1a'|'J1b';
type JournalSelection156=ReturnType<typeof selectJournalStores>;
interface JournalSource156{readonly owner:DirectedJournalConstruction156;readonly kind:JournalId156;readonly lineage:PrismLineage;readonly position:T.BufferAttribute;readonly positionArray:object;readonly positionVersion:number;readonly normal:T.BufferAttribute;readonly normalArray:object;readonly normalVersion:number;readonly positions:Float32Array;readonly normals:Float32Array;readonly original:PrismLineage;readonly localPlain:Float32Array;readonly finalPlain:Float32Array;readonly facts:Readonly<{kind:JournalId156;frame:'world'|'rotor-local'|'carrier-local';centre:JournalPoint;radius:number;loop:number;nominalLocal:readonly JournalPoint[];plainLocal:readonly JournalPoint[];nominalFinal:readonly JournalPoint[];plainFinal:readonly JournalPoint[];selected:readonly JournalPoint[];selection:JournalSelection156;bound:ReturnType<typeof journalOperatorBound>;translateCalls:number;reuse:boolean;inputs:readonly(number|string)[]}>;color?:{attribute:T.BufferAttribute;array:object;version:number};}
const directedJournalSources156=new WeakMap<T.BufferGeometry,JournalSource156>();
const journalInputs156=(k:JournalKinematics)=>[...k.station.anchor,...k.O,...k.pin,k.R,k.theta,k.entry,k.delta,k.spec.tilt.window,k.spec.tilt.profile,k.spec.rotor.axle.radius,...k.spec.rotor.axle.z,k.spec.rotor.boss.outer,k.spec.rotor.boss.bore,...k.spec.rotor.boss.z,...k.spec.journals.flatMap(j=>[j.id,j.z])];
const journalPair156=(a:JournalPoint,tick:(n?:number)=>void)=>Object.freeze(a.map(v=>{tick();return v;})as[number,number]);
const journalCopy156=(a:ArrayLike<number>,tick:(n?:number)=>void)=>{const b=new Float32Array(a.length);for(let i=0;i<b.length;i++){tick();b[i]=a[i]!;}return b;};
export class DirectedJournalConstruction156{
 #inputs;#cache=new Map<JournalId156,{nominal:readonly JournalPoint[];selection:JournalSelection156}>();#bounds;
 get bounds(){return this.#bounds;}
 constructor(readonly station:AxleStation,k:JournalKinematics,tick:(n?:number)=>void){this.#inputs=Object.freeze(journalInputs156(k).map(v=>{tick();return v;}));if(k.pin[0]!==-.3||k.pin[1]!==0||k.spec.rotor.axle.radius!==.03||k.spec.rotor.boss.bore!==.025||k.spec.journals.length!==2||k.spec.journals[0].id!=='J1a'||k.spec.journals[1].id!=='J1b'||k.spec.tilt.profile!=='late-cubic-smoothstep')journalReject(station,'numerical-indeterminate','Unsupported declared journal source/axis/radius');
  const candidates=(points:readonly JournalPoint[])=>points.flatMap(p=>journalNine(p,tick).map(c=>c.store)),live=candidates(polygon(.03,8)),pin=candidates(polygon(.025,8,-.3,0)),world=candidates(polygon(.03/Math.cos(Math.PI/8),8,k.O[0],k.O[1])),boss=candidates(polygon(.025/Math.cos(Math.PI/8),8,0,-k.R));this.#bounds=Object.freeze({J1:journalOperatorBound(k,'J1',live,world),J3:journalOperatorBound(k,'J3',pin,boss)});
 }
 assertInputs(k:JournalKinematics,tick:(n?:number)=>void){const actual=journalInputs156(k);if(actual.length!==this.#inputs.length)journalReject(this.station,'numerical-indeterminate','Changed journal source shape');for(let i=0;i<actual.length;i++){tick();if(!Object.is(actual[i],this.#inputs[i]))journalReject(this.station,'numerical-indeterminate','Changed journal source input/frame');}}
 build(k:JournalKinematics,kind:JournalId156,tick:(n?:number)=>void){if(!['J1-shaft','J3-shaft','J3','J1a','J1b'].includes(kind))journalReject(this.station,'numerical-indeterminate','Invalid journal part kind');this.assertInputs(k,tick);const p=k.spec,j=kind==='J1b'?p.journals[1]:p.journals[0],square=[[-.08,-.08],[.08,-.08],[.08,.08],[-.08,.08]]as const,world=kind==='J1a'||kind==='J1b',shaft=kind.endsWith('shaft'),localZ=(z:number)=>z-k.station.anchor[2],loop=shaft?0:1,centre:JournalPoint=kind==='J1-shaft'?[0,0]:kind==='J3-shaft'?[-.3,0]:kind==='J3'?[0,-k.R]:[k.O[0],k.O[1]],radius=(kind==='J1-shaft'||world) ? .03 : .025;
  const g=kind==='J1-shaft'?prism(polygon(p.rotor.axle.radius,8),[],...p.rotor.axle.z):kind==='J3-shaft'?prism(polygon(.025,8,-.3,0),[],localZ(-3.95),localZ(-3.54)):kind==='J3'?prism(polygon(p.rotor.boss.outer,8,0,-k.R),[polygon(p.rotor.boss.bore/Math.cos(Math.PI/8),8,0,-k.R)],...p.rotor.boss.z):prism(square,[polygon(.03/Math.cos(Math.PI/8),8)],j.z-.05,j.z+.05);
  try{const L=prismLineage(g),P=g.getAttribute('position')as T.BufferAttribute,local=journalCopy156(P.array,tick),sourceLoop=L.loops[loop]!;if(sourceLoop.length!==8)throw new JournalConstructionError('indeterminate','Actual journal loop is not eight vertices');let translateCalls=0;if(world){g.translate(k.O[0],k.O[1],0);tick(2*P.count);translateCalls++;}const plain=journalCopy156(P.array,tick),shift:JournalPoint=world?[k.O[0],k.O[1]]:[0,0],nominal=Object.freeze(sourceLoop.map(v=>journalPair156([v[0]+shift[0],v[1]+shift[1]],tick))),bound=kind==='J1-shaft'||world?this.#bounds.J1:this.#bounds.J3,cacheKind=kind==='J1b'?'J1a':kind;let prior=this.#cache.get(cacheKind);tick();const reuse=!!prior;if(prior){for(let i=0;i<8;i++)for(let a=0;a<2;a++){tick();if(!Object.is(prior.nominal[i]![a],nominal[i]![a]))throw new JournalConstructionError('indeterminate','Changed reused actual journal inputs');}}else{const selection=selectJournalStores(nominal,centre,radius,shaft?'inward':'outward',shaft?bound.total:journalRat(0n),tick);prior={nominal,selection};this.#cache.set(cacheKind,prior);}const selection=prior.selection,key=(x:number,y:number)=>(Object.is(x,-0)?'-0':String(x))+'/'+(Object.is(y,-0)?'-0':String(y)),indices=new Map(sourceLoop.map((v,i)=>{tick();return[key(v[0],v[1]),i]as const;})),find=(v:readonly[number,number,number])=>{tick();return indices.get(key(v[0],v[1]))??-1;},locations=sourceLoop.map(()=>-1);
   for(let i=0;i<P.count;i++){const at=find(L.vertices[i]!);if(at>=0){tick();P.setXY(i,selection.selected[at]![0],selection.selected[at]![1]);locations[at]=i;}}
   P.needsUpdate=true;tick(P.count);g.computeVertexNormals();
   const finalVertices=Object.freeze(L.vertices.map(v=>{tick();return Object.freeze([v[0]+shift[0],v[1]+shift[1],v[2]]as const);})),stores=Object.freeze(finalVertices.map((nominal,i)=>{const at=find(L.vertices[i]!),packed=Object.freeze([P.getX(i),P.getY(i),P.getZ(i)]as const),error=Object.freeze(packed.map((v,a)=>{tick();return v-nominal[a]!;})as[number,number,number]);let direction:readonly[number,number,number]=[0,0,0];if(at>=0){const x=nominal[0]-centre[0],y=nominal[1]-centre[1],l=Math.hypot(x,y),sign=shaft?-1:1;if(!(l>0))throw new JournalConstructionError('indeterminate','Zero radial diagnostic');direction=Object.freeze([sign*x/l,sign*y/l,0]as const);}tick(6);return Object.freeze({nominal,packed,error,materialDirection:direction});})),lineage=Object.freeze({vertices:finalVertices,stores,loops:Object.freeze(L.loops.map(l=>Object.freeze(l.map(v=>journalPair156([v[0]+shift[0],v[1]+shift[1]],tick)))))});prismSources.set(g,lineage);
   const facts=Object.freeze({kind,frame:world?'world'as const:kind==='J3-shaft'?'carrier-local'as const:'rotor-local'as const,centre:journalPair156(centre,tick),radius,loop,nominalLocal:Object.freeze(sourceLoop.map(v=>journalPair156(v,tick))),plainLocal:Object.freeze(locations.map(i=>journalPair156([local[3*i]!,local[3*i+1]!],tick))),nominalFinal:nominal,plainFinal:Object.freeze(locations.map(i=>journalPair156([plain[3*i]!,plain[3*i+1]!],tick))),selected:selection.selected,selection,bound,translateCalls,reuse,inputs:this.#inputs});const N=g.getAttribute('normal')as T.BufferAttribute;directedJournalSources156.set(g,{owner:this,kind,lineage,position:P,positionArray:P.array,positionVersion:P.version,normal:N,normalArray:N.array,normalVersion:N.version,positions:journalCopy156(P.array,tick),normals:journalCopy156(N.array,tick),original:L,localPlain:local,finalPlain:plain,facts});return g;
  }catch(error){g.dispose();if(error instanceof JournalConstructionError)journalReject(this.station,error.kind==='infeasible'?'journal-store':'numerical-indeterminate',error.message);throw error;}
 }
}
/** Inspection only; callers cannot create this private record. */
export function directedJournalFacts156(g:T.BufferGeometry){return directedJournalSources156.get(g)?.facts;}
function checkDirectedJournal156(g:T.BufferGeometry,k:JournalKinematics,tick:(n?:number)=>void){tick();const S=directedJournalSources156.get(g);if(!S)throw new JournalConstructionError('indeterminate','No private directed journal source');S.owner.assertInputs(k,tick);const P=g.getAttribute('position'),N=g.getAttribute('normal');if(g.index||g.groups.length||g.drawRange.start!==0||g.drawRange.count!==Infinity||P!==S.position||N!==S.normal||P.array!==S.positionArray||N.array!==S.normalArray||P.version!==S.positionVersion||N.version!==S.normalVersion||P.itemSize!==3||N.itemSize!==3||P.normalized||N.normalized||P.array.length!==S.positions.length||N.array.length!==S.normals.length||prismLineage(g)!==S.lineage)throw new JournalConstructionError('indeterminate','Changed directed journal stores/attributes/index/frame');for(const[a,b]of[[P.array,S.positions],[N.array,S.normals]]as const)for(let i=0;i<a.length;i++){tick();if(!Object.is(a[i],b[i]))throw new JournalConstructionError('indeterminate','Dirty directed journal array');}return S;}
export function sealDirectedJournalColor156(g:T.BufferGeometry,k:JournalKinematics,tick:(n?:number)=>void){tick();if(!directedJournalSources156.has(g))return;const S=directedJournalSources156.get(g)!;S.owner.assertInputs(k,tick);const C=g.getAttribute('color')as T.BufferAttribute,color=new T.Color(S.kind==='J1a'||S.kind==='J1b'?0x65543f:0x657578),expected=[Math.fround(color.r),Math.fround(color.g),Math.fround(color.b)];if(S.color||!C||C.itemSize!==3||C.normalized||C.count!==S.position.count||C.version!==0)throw new JournalConstructionError('indeterminate','Invalid directed journal color seal');for(let i=0;i<C.array.length;i++){tick();if(!Object.is(C.array[i],expected[i%3]))throw new JournalConstructionError('indeterminate','Changed journal color');}S.color={attribute:C,array:C.array,version:C.version};}
export function directedJournalSource156(g:T.BufferGeometry,k:JournalKinematics,tick:(n?:number)=>void,owner?:DirectedJournalConstruction156){const S=checkDirectedJournal156(g,k,tick);tick();if(owner&&S.owner!==owner)throw new JournalConstructionError('indeterminate','Foreign physical-model journal construction owner');const C=g.getAttribute('color');if(!S.color||C!==S.color.attribute||C.array!==S.color.array||C.version!==S.color.version||Object.keys(g.attributes).sort().join(',')!=='color,normal,position')throw new JournalConstructionError('indeterminate','Unsealed/changed full directed journal attributes');const color=new T.Color(S.kind==='J1a'||S.kind==='J1b'?0x65543f:0x657578),expected=[Math.fround(color.r),Math.fround(color.g),Math.fround(color.b)];for(let i=0;i<C.array.length;i++){tick();if(!Object.is(C.array[i],expected[i%3]))throw new JournalConstructionError('indeterminate','Dirty directed journal color');}return S.facts;}
