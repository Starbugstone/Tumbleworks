import { BufferGeometry, Float32BufferAttribute, Matrix4, Mesh, type Object3D } from 'three';
import { nativeTerrainOwnership } from './village-terrain';
import { terrainHeightAt } from '../world/village-terrain';

interface R { n: bigint; d: bigint }
type P = readonly [R,R];
type V = readonly [number,number,number];
const abs=(a:bigint)=>a<0n?-a:a;
function rational(n:bigint,d=1n):R { if(!d)throw Error('Zero terrain-foot denominator');if(d<0n){n=-n;d=-d;}let a=abs(n),b=d;while(b){const t=a%b;a=b;b=t;}return {n:n/(a||1n),d:d/(a||1n)}; }
const Z=rational(0n),ONE=rational(1n),add=(a:R,b:R)=>rational(a.n*b.d+b.n*a.d,a.d*b.d),neg=(a:R)=>({n:-a.n,d:a.d}),sub=(a:R,b:R)=>add(a,neg(b)),mul=(a:R,b:R)=>rational(a.n*b.n,a.d*b.d),div=(a:R,b:R)=>rational(a.n*b.d,a.d*b.n),sign=(a:R)=>a.n<0n?-1:a.n>0n?1:0,cmp=(a:R,b:R)=>sign(sub(a,b)),num=(a:R)=>Number(a.n)/Number(a.d);
const bits64=new DataView(new ArrayBuffer(8));
function exact(v:number):R {if(!Number.isFinite(v))throw Error('Nonfinite terrain-foot coordinate');bits64.setFloat64(0,v);const hi=bits64.getUint32(0),lo=bits64.getUint32(4),e=hi>>>20&2047,m=(BigInt(hi&0xfffff)<<32n)+BigInt(lo)+(e?1n<<52n:0n),p=(e?e-1023:-1022)-52,s=hi>>>31?-1n:1n;return p>=0?rational(s*m*(1n<<BigInt(p))):rational(s*m,1n<<BigInt(-p));}
const point=(x:number,z:number):P=>[exact(x),exact(z)],orient=(a:P,b:P,c:P)=>sub(mul(sub(b[0],a[0]),sub(c[1],a[1])),mul(sub(b[1],a[1]),sub(c[0],a[0]))),key=(p:P)=>p.map(v=>v.n+'/'+v.d).join('|');
function signedArea(p:readonly P[]):R {let a=Z;for(let i=0;i<p.length;i++){const b=p[(i+1)%p.length]!;a=add(a,sub(mul(p[i]![0],b[1]),mul(p[i]![1],b[0])));}return div(a,rational(2n));}
const magnitude=(a:R)=>({n:abs(a.n),d:a.d});
function onSegment(p:P,a:P,b:P):boolean {return sign(orient(a,b,p))===0&&cmp(mul(sub(p[0],a[0]),sub(p[0],b[0])),Z)<=0&&cmp(mul(sub(p[1],a[1]),sub(p[1],b[1])),Z)<=0;}
function inPolygon(p:P,poly:readonly P[]):boolean {let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j]!,b=poly[i]!;if(onSegment(p,a,b))return true;if((cmp(a[1],p[1])>0)===(cmp(b[1],p[1])>0))continue;const x=add(a[0],div(mul(sub(b[0],a[0]),sub(p[1],a[1])),sub(b[1],a[1])));if(cmp(p[0],x)<0)inside=!inside;}return inside;}
function inTriangle(p:P,t:readonly P[]):boolean {const s=sign(orient(t[0]!,t[1]!,t[2]!));return s!==0&&[0,1,2].every(i=>sign(orient(t[i]!,t[(i+1)%3]!,p))*s>=0);}
function clip(poly:readonly P[],t:readonly P[]):P[] {let out=[...poly];const s=sign(orient(t[0]!,t[1]!,t[2]!));if(!s)throw Error('Degenerate native land');for(let i=0;i<3;i++){const a=t[i]!,b=t[(i+1)%3]!,next:P[]=[];for(let j=0;j<out.length;j++){const p=out[j]!,q=out[(j+1)%out.length]!,u=mul(orient(a,b,p),rational(BigInt(s))),v=mul(orient(a,b,q),rational(BigInt(s)));if(sign(u)>=0)next.push(p);if((sign(u)>=0)!==(sign(v)>=0)){const f=div(u,sub(u,v));next.push([add(p[0],mul(f,sub(q[0],p[0]))),add(p[1],mul(f,sub(q[1],p[1])))]);}}out=next;}return out;}
const word=new Float32Array(1),wordBits=new Uint32Array(word.buffer);
function neighbour(v:number,up:boolean):number {word[0]=v;if(word[0]===0){wordBits[0]=1;return up?word[0]!:-word[0]!;}wordBits[0]=wordBits[0]!+((v>0)===up?1:-1);return word[0]!;}
function adjacent(q:R):readonly[number,number] {let v=Math.fround(num(q));if(!Number.isFinite(v))throw Error('Terrain-foot storage overflow');for(let i=0;i<4;i++){if(cmp(exact(v),q)>0){v=neighbour(v,false);continue;}const n=neighbour(v,true);if(cmp(exact(n),q)<=0){v=n;continue;}return cmp(exact(v),q)===0?[v,v]:[v,n];}throw Error('Terrain-foot neighbour bound exceeded');}
function ceilHeight(q:R):number {return adjacent(q)[1];}
interface Land { readonly id:number;readonly points:readonly P[];readonly coefficients:readonly[R,R,R];readonly plane:string;readonly bounds:readonly[number,number,number,number] }
function height(l:Land,p:P):R{return add(l.coefficients[2],add(mul(l.coefficients[0],p[0]),mul(l.coefficients[1],p[1])));}
const ID=new Matrix4();
function visibleHome(mesh:Object3D):void {mesh.updateWorldMatrix(true,true);for(let p:Object3D|null=mesh;p;p=p.parent)if(!p.visible)throw Error('Hidden terrain-foot provider');if(!mesh.matrixWorld.equals(ID))throw Error('Terrain-foot provider left the village home frame');}
/** Actual producer-owned native land, not a recompiled terrain surrogate. */
export class TerrainFootGround {
 readonly land:readonly Land[];
 private readonly fields:readonly number[];
 private readonly geometry:BufferGeometry;
 private readonly attributes:Readonly<Record<string,unknown>>;
 constructor(readonly mesh:Mesh,private readonly query:(x:number,z:number)=>number|undefined){
  visibleHome(mesh);this.geometry=mesh.geometry;this.attributes={...mesh.geometry.attributes};const own=nativeTerrainOwnership(mesh),t=own.terrain;
  if(!Number.isInteger(t.columns)||!Number.isInteger(t.rows)||t.columns<1||t.rows<1||t.columns>256||t.rows>256||![t.cellWidth,t.cellDepth].every(v=>v>=2**-8&&v<=8&&Number.isInteger(Math.log2(v)))||![t.originX/t.cellWidth,t.originZ/t.cellDepth].every(Number.isInteger))throw Error('Unsupported terrain-foot grid domain');
  const p=mesh.geometry.getAttribute('position'),land:Land[]=[];
  for(const id of own.land){const v=[0,1,2].map(j=>[p.getX(id*3+j),p.getY(id*3+j),p.getZ(id*3+j)]as V);for(const q of v)for(const x of q)if(!Number.isFinite(x)||Math.fround(x)!==x||Math.abs(x)>128||(x!==0&&Math.abs(x)<2**-32))throw Error('Unsupported terrain-foot coordinate/exponent domain');
   const [a,b,c]=v,points=v.map(q=>point(q[0],q[2])),den=orient(points[0]!,points[1]!,points[2]!);if(!sign(den))throw Error('Degenerate native land');
   const A=div(sub(mul(sub(exact(b![1]),exact(a![1])),sub(points[2]![1],points[0]![1])),mul(sub(exact(c![1]),exact(a![1])),sub(points[1]![1],points[0]![1]))),den),B=div(sub(mul(sub(points[1]![0],points[0]![0]),sub(exact(c![1]),exact(a![1]))),mul(sub(points[2]![0],points[0]![0]),sub(exact(b![1]),exact(a![1])))),den),C=sub(exact(a![1]),add(mul(A,points[0]![0]),mul(B,points[0]![1])));
   land.push({id,points,coefficients:[A,B,C],plane:[A,B,C].map(q=>q.n+'/'+q.d).join('|'),bounds:[Math.min(...v.map(q=>q[0])),Math.max(...v.map(q=>q[0])),Math.min(...v.map(q=>q[2])),Math.max(...v.map(q=>q[2]))]});
  }
  this.land=land;this.fields=[t.columns,t.rows,t.originX,t.originZ,t.cellWidth,t.cellDepth,...t.heights,...t.paint,...t.cells.map(c=>c==='land'?1:c==='water'?2:3)];
 }
 assertCurrent():void {visibleHome(this.mesh);if(this.mesh.geometry!==this.geometry||Object.entries(this.attributes).some(([n,a])=>this.mesh.geometry.getAttribute(n)!==a))throw Error('Replaced terrain-foot ground attribute');const own=nativeTerrainOwnership(this.mesh),t=own.terrain,fields=[t.columns,t.rows,t.originX,t.originZ,t.cellWidth,t.cellDepth,...t.heights,...t.paint,...t.cells.map(c=>c==='land'?1:c==='water'?2:3)];if(fields.length!==this.fields.length||fields.some((v,i)=>!Object.is(v,this.fields[i])))throw Error('Stale terrain-foot ground descriptor');}
 checkQuery(p:P):void {const x=num(p[0]),z=num(p[1]),actual=this.query(x,z),expected=terrainHeightAt(nativeTerrainOwnership(this.mesh).terrain,x,z);if(!Number.isFinite(actual)||!Object.is(actual,expected))throw Error('Terrain-foot ground callback disagreement');}
}
export interface TerrainFootCut {readonly edge:number;readonly line:readonly (readonly[number,number])[];readonly exact:readonly string[];readonly stored:readonly[number,number];readonly displacementSquared:string;readonly freeAxis:0|1;readonly freeStorageStep:string}
export interface TerrainFootDescriptor {
 readonly owner:string;readonly originalBoundary:readonly V[];readonly boundary:readonly V[];readonly top:readonly V[];readonly bottom:readonly number[];
 readonly cuts:readonly TerrainFootCut[];readonly lostArea:string;readonly originalArea:string;readonly area:string;
}
const descriptors=new WeakMap<BufferGeometry,TerrainFootDescriptor>();
/** Construction descriptor only; final native ranges require a separate binding. */
export const terrainFootDescriptor=(g:BufferGeometry):TerrainFootDescriptor|undefined=>descriptors.get(g);
/** Proper ears include closed-triangle occupancy, preserving collinear constraints. */
export function terrainFootTriangulate(points:readonly (readonly[number,number])[]):readonly(readonly[number,number,number])[]{return ears(points.map(p=>point(p[0],p[1])));}
function ears(poly:readonly P[]):[number,number,number][]{if(poly.length<3)throw Error('Terrain-foot polygon missing');const direction=sign(signedArea(poly));if(!direction)throw Error('Degenerate terrain-foot polygon');const ring=poly.map((_,i)=>i),out:[number,number,number][]=[];let attempts=0;
 while(ring.length>3){let found=false;for(let k=0;k<ring.length;k++){const a=ring[(k+ring.length-1)%ring.length]!,b=ring[k]!,c=ring[(k+1)%ring.length]!,tri=[poly[a]!,poly[b]!,poly[c]!];if(sign(orient(...tri as[P,P,P]))!==direction||ring.some(i=>i!==a&&i!==b&&i!==c&&inTriangle(poly[i]!,tri)))continue;out.push([a,b,c]);ring.splice(k,1);found=true;break;}if(!found||++attempts>512)throw Error('Terrain-foot constrained ear failure');}
 if(sign(orient(poly[ring[0]!]!,poly[ring[1]!]!,poly[ring[2]!]!))!==direction)throw Error('Terrain-foot final ear is degenerate');out.push([ring[0]!,ring[1]!,ring[2]!]);return out;
}
function ordered(points:readonly P[]):P[]{const unique=[...new Map(points.map(p=>[key(p),p])).values()];if(unique.length<3)return[];const center=unique.reduce((p,q)=>[add(p[0],q[0]),add(p[1],q[1])]as P,[Z,Z]);const result=unique.sort((a,b)=>Math.atan2(num(a[1])-num(center[1])/unique.length,num(a[0])-num(center[0])/unique.length)-Math.atan2(num(b[1])-num(center[1])/unique.length,num(b[0])-num(center[0])/unique.length));if(!sign(signedArea(result)))return[];if(sign(signedArea(result))<0)result.reverse();for(let i=0;i<result.length;i++)if(sign(orient(result[i]!,result[(i+1)%result.length]!,result[(i+2)%result.length]!))<0)throw Error('Nonconvex terrain-foot land piece');return result;}
/** Rebuild a packed post in its original final home frame. No inverse yaw is used. */
export function terrainPlankPile(owner:string,source:BufferGeometry,ground:TerrainFootGround):BufferGeometry {
 ground.assertCurrent();const p=source.getAttribute('position'),ix=source.index;if(ix||p.count!==84)throw Error('Terrain foot needs the actual compacted packed post');
 const at=(i:number):V=>[p.getX(i),p.getY(i),p.getZ(i)];for(let i=0;i<p.count;i++)for(const v of at(i))if(!Number.isFinite(v)||Math.fround(v)!==v||Math.abs(v)>128||(v!==0&&Math.abs(v)<2**-32))throw Error('Terrain-foot post domain');
 // The compacted post has16 side,6 top and6 bottom triangles. Extract its
 // independently produced bottom boundary by oriented cap edges.
 const cap=Array.from({length:6},(_,i)=>[at(66+i*3),at(67+i*3),at(68+i*3)]as const),edges=new Map<string,{a:V;b:V}>(),K=(v:V)=>v.join('/');
 for(const tri of cap)for(let j=0;j<3;j++){const a=tri[j]!,b=tri[(j+1)%3]!,reverse=K(b)+'>'+K(a);if(edges.has(reverse))edges.delete(reverse);else edges.set(K(a)+'>'+K(b),{a,b});}
 if(edges.size!==8)throw Error('Terrain-foot original rim topology');const first=edges.values().next().value!;const original:V[]=[first.a];let next=first.b;while(K(next)!==K(original[0]!)){if(original.length>=8)throw Error('Terrain-foot rim is not closed');original.push(next);const edge=[...edges.values()].find(e=>K(e.a)===K(next));if(!edge)throw Error('Terrain-foot rim link missing');next=edge.b;}
 // Bottom outward winding is counterclockwise in XZ; use the opposite order
 // for the side construction so its top-to-bottom generators stay paired.
 original.reverse();const rim=original.map(v=>point(v[0],v[2])),direction=sign(signedArea(rim));if(!direction)throw Error('Terrain-foot original area');
 const topFaces=Array.from({length:18},(_,i)=>at(48+i)),topPoints=[...new Map(topFaces.map(v=>[K(v),v])).values()];if(topPoints.length!==8)throw Error('Terrain-foot top ring topology');
 const tops=original.map(v=>topPoints.reduce((a,b)=>Math.hypot(a[0]-v[0],a[2]-v[2])<Math.hypot(b[0]-v[0],b[2]-v[2])?a:b));if(new Set(tops.map(K)).size!==8)throw Error('Terrain-foot generator pairing');
 const loX=Math.min(...original.map(v=>v[0])),hiX=Math.max(...original.map(v=>v[0])),loZ=Math.min(...original.map(v=>v[2])),hiZ=Math.max(...original.map(v=>v[2])),lands=ground.land.filter(l=>l.bounds[0]<=hiX&&l.bounds[1]>=loX&&l.bounds[2]<=hiZ&&l.bounds[3]>=loZ&&sign(signedArea(clip(rim,l.points)))!==0);
 if(!lands.length||lands.length>64)throw Error('Terrain-foot land domain');let covered=Z;for(const l of lands)covered=add(covered,magnitude(signedArea(clip(rim,l.points))));const oldArea=magnitude(signedArea(rim));if(cmp(covered,oldArea)!==0)throw Error('Terrain-foot footprint crosses water or void');const onePlane=new Set(lands.map(l=>l.plane)).size===1;
 const cuts:TerrainFootCut[]=[],boundary:{p:P;edge:number;t:R}[]=[];
 const inRim=(q:P)=>rim.every((a,i)=>sign(orient(a,rim[(i+1)%8]!,q))*direction>=0);
 for(let e=0;e<8;e++){const a=rim[e]!,b=rim[(e+1)%8]!,events=new Map<string,{p:P;t:R}>();if(!onePlane)for(const l of lands)for(let j=0;j<3;j++){const u=l.points[j]!,v=l.points[(j+1)%3]!,sa=orient(u,v,a),sb=orient(u,v,b);if(sign(sa)*sign(sb)>=0)continue;const t=div(sa,sub(sa,sb)),intersection:P=[add(a[0],mul(t,sub(b[0],a[0]))),add(a[1],mul(t,sub(b[1],a[1])))];if(!onSegment(intersection,u,v))continue;
   const candidates:{p:P;free:0|1;step:R}[]=[];
   // A stored point must be Float32 in BOTH coordinates. Examine the two
   // adjacent free-coordinate stores for either nonconstant terrain-line axis.
   // There is no offset search and no inverse/forward coordinate round trip.
   for(const free of [0,1]as const){const other=free===0?1:0;if(cmp(u[free],v[free])===0)continue;const choices=adjacent(intersection[free]);
    for(const value of [...new Set(choices)]){const q=[Z,Z]as[R,R];q[free]=exact(value);q[other]=add(u[other],mul(div(sub(q[free],u[free]),sub(v[free],u[free])),sub(v[other],u[other])));if(cmp(exact(Math.fround(num(q[other]))),q[other])!==0||!onSegment(q,u,v)||!inRim(q))continue;candidates.push({p:q,free,step:sub(exact(choices[1]),exact(choices[0]))});}
   }
   if(!candidates.length)throw new Error('Terrain-foot inward storage conflict: '+JSON.stringify({owner,edge:e,line:[u,v].map(p=>p.map(v=>v.n+'/'+v.d)),rim:rim.map(p=>p.map(v=>v.n+'/'+v.d)),intersection:intersection.map(v=>v.n+'/'+v.d),adjacent:[0,1].map(i=>adjacent(intersection[i]!))}));
   candidates.sort(({p},{p:q})=>cmp(add(mul(sub(p[0],intersection[0]),sub(p[0],intersection[0])),mul(sub(p[1],intersection[1]),sub(p[1],intersection[1]))),add(mul(sub(q[0],intersection[0]),sub(q[0],intersection[0])),mul(sub(q[1],intersection[1]),sub(q[1],intersection[1])))));
   const choice=candidates[0]!,stored=choice.p,id=key(stored),delta=add(mul(sub(stored[0],intersection[0]),sub(stored[0],intersection[0])),mul(sub(stored[1],intersection[1]),sub(stored[1],intersection[1]))),step=choice.step;if(!events.has(id)){events.set(id,{p:stored,t});cuts.push({edge:e,line:[u,v].map(p=>p.map(num)as[number,number]),exact:intersection.map(v=>v.n+'/'+v.d),stored:stored.map(num)as[number,number],displacementSquared:delta.n+'/'+delta.d,freeAxis:choice.free,freeStorageStep:step.n+'/'+step.d});}
  }
  const sorted=[...events.values()].sort((p,q)=>cmp(p.t,q.t));let previous=Z;for(const event of sorted){const d:P=[sub(b[0],a[0]),sub(b[1],a[1])],projection=div(add(mul(sub(event.p[0],a[0]),d[0]),mul(sub(event.p[1],a[1]),d[1])),add(mul(d[0],d[0]),mul(d[1],d[1])));if(cmp(projection,previous)<=0||cmp(projection,ONE)>=0)throw Error('Terrain-foot stored parameter order');previous=projection;}
  boundary.push({p:a,edge:e,t:Z},...sorted.map(p=>({...p,edge:e})));
 }
 const poly=boundary.map(q=>q.p),newArea=magnitude(signedArea(poly));if(cmp(newArea,oldArea)>0||poly.some(p=>!inRim(p)))throw Error('Terrain-foot gained footprint');
 const nodes=[...new Map(lands.flatMap(l=>l.points).filter(q=>inPolygon(q,poly)&&!poly.some(p=>key(p)===key(q))).map(q=>[key(q),q])).values()],bottomY=new Map<string,number>();
 const heightAt=(q:P)=>{ground.checkQuery(q);const providers=lands.filter(l=>inTriangle(q,l.points));if(!providers.length)throw Error('Terrain-foot vertex lacks native land');const h=height(providers[0]!,q);if(providers.some(l=>cmp(height(l,q),h)!==0))throw Error('Discontinuous terrain-foot native ground');return ceilHeight(h);};
 for(const q of [...poly,...nodes])bottomY.set(key(q),heightAt(q));
 const positions:number[]=[],bottom:number[]=[],emit=(a:V,b:V,c:V)=>{positions.push(...a,...b,...c);};for(let i=0;i<topFaces.length;i+=3)emit(topFaces[i]!,topFaces[i+1]!,topFaces[i+2]!);
 const B=(q:P):V=>[num(q[0]),bottomY.get(key(q))!,num(q[1])];
 for(let e=0;e<8;e++){const points=[...boundary.filter(q=>q.edge===e).map(q=>q.p),rim[(e+1)%8]!],half=Math.ceil((points.length-1)/2);for(let i=0;i+1<points.length;i++)emit(tops[i<half?e:(e+1)%8]!,B(points[i]!),B(points[i+1]!));emit(tops[e]!,B(points[half]!),tops[(e+1)%8]!);}
 const pieces: {poly:readonly P[];land:Land}[]=onePlane?[{poly:[...rim].reverse(),land:lands[0]!}]:lands.map(l=>({poly:ordered([...poly.filter(q=>inTriangle(q,l.points)),...nodes.filter(q=>inTriangle(q,l.points))]),land:l})).filter(p=>p.poly.length>=3);
 let pieceArea=Z;for(const piece of pieces){pieceArea=add(pieceArea,magnitude(signedArea(piece.poly)));for(const tri of ears(piece.poly)){let [a,b,c]=tri.map(i=>B(piece.poly[i]!))as[V,V,V];if(sign(orient(point(a[0],a[2]),point(b[0],b[2]),point(c[0],c[2])))<0)[b,c]=[c,b];bottom.push(positions.length/9);emit(a,b,c);}}
 if(cmp(pieceArea,newArea)!==0)throw new Error('Terrain-foot packed piece union mismatch '+owner);
 const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();
 // All arithmetic decisions above use rationals. Pinned Three stores the
 // Float64 facet cross into Float32, normalizes that stored vector, and stores
 // Float32 again. Real merge applies its normal matrix/normalize/store once
 // more. No smoothing across the side/cap/terrain creases is introduced.
 const normals=geometry.getAttribute('normal');for(let i=0;i<normals.count;i++)if(![normals.getX(i),normals.getY(i),normals.getZ(i)].every(Number.isFinite)||Math.hypot(normals.getX(i),normals.getY(i),normals.getZ(i))<.99){geometry.dispose();throw Error('Degenerate terrain-foot emitted facet');}
 const loss=sub(oldArea,newArea);descriptors.set(geometry,Object.freeze({owner,originalBoundary:original,boundary:poly.map(B),top:topFaces,bottom,cuts,lostArea:loss.n+'/'+loss.d,originalArea:oldArea.n+'/'+oldArea.d,area:newArea.n+'/'+newArea.d}));return geometry;
}
export interface TerrainFootBinding {readonly owner:string;readonly mesh:Mesh;readonly geometry:BufferGeometry;readonly first:number;readonly count:number;readonly descriptor:TerrainFootDescriptor;readonly attributes:Readonly<Record<string,{readonly attribute:unknown;readonly array:unknown;readonly values:Float32Array;readonly count:number;readonly itemSize:number;readonly normalized:boolean}>>;readonly matrix:readonly number[]}
export function bindTerrainFoot(owner:string,mesh:Mesh,first:number,count:number,descriptor:TerrainFootDescriptor):TerrainFootBinding {return Object.freeze({owner,mesh,geometry:mesh.geometry,first,count,descriptor,matrix:mesh.matrixWorld.toArray(),attributes:Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([name,a])=>[name,{attribute:a,array:a.array,count:a.count,itemSize:a.itemSize,normalized:a.normalized,values:new Float32Array(a.array.slice(first*3,(first+count)*3))}]))});}
export function verifyTerrainFoot(binding:TerrainFootBinding,ground:TerrainFootGround):void {ground.assertCurrent();visibleHome(binding.mesh);if(binding.mesh.geometry!==binding.geometry||binding.mesh.geometry.index)throw Error('Replaced terrain-foot native geometry');for(const[name,snapshot]of Object.entries(binding.attributes)){const a=binding.mesh.geometry.getAttribute(name);if(!a||a!==snapshot.attribute||a.array!==snapshot.array||a.count!==snapshot.count||a.itemSize!==snapshot.itemSize||a.normalized!==snapshot.normalized)throw Error('Replaced terrain-foot native attribute');for(let i=0;i<snapshot.values.length;i++)if(!Object.is(a.array[binding.first*3+i],snapshot.values[i]))throw Error('Mutated terrain-foot native stream');}if(binding.mesh.matrixWorld.elements.some((v,i)=>!Object.is(v,binding.matrix[i])))throw Error('Moved terrain-foot native frame');}
