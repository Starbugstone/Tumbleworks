// Mill125: selected117 finite timber-floor tenon, guarded by118.
// capB only: a finite tenon inside the ACTUAL central timber floor of the supported channel.
// No tolerance, inset, area cutoff or search: every coordinate is either an unchanged support
// literal (x, halfLength, bottom) or a value READ from the actual villageChannelGeometry buffer.
import * as T from 'three';
import {villageChannelGeometry} from './machine-primitives';
import{VILLAGE_RADIUS,type VillagePort}from'../world/village-plan';

/** villageChannelGeometry timber profile: 8 vertices per ring, pushed ring by ring.
 * Edge e joins vertex e and (e+1)%8; its quad is triangles 2e and 2e+1 of a segment.
 * Edge 1 = underside (-.65,-.14)->(.65,-.14); edge 5 = floor top (.4,0)->(-.4,0);
 * vertices 5 and 6 = the inner wall bases bounding the central floor ribbon. */
const RING=8,UNDERSIDE=1,FLOOR_TOP=5,BASE=[5,6]as const;
export interface FloorCapLineage{
 readonly source:'villageChannelGeometry(track,timber)';readonly segment:number;
 readonly undersideTriangles:readonly[number,number];readonly floorTriangles:readonly[number,number];
 readonly innerBaseZ:readonly[number,number];readonly x:readonly[number,number];readonly bottom:number;
 /** Float32 tops at (x0,z0),(x0,z1),(x1,z0),(x1,z1) = fround((y_underside+y_floor)/2) on those cells. */
 readonly top:readonly[number,number,number,number];readonly model:'finite-floor-tenon-117';
}
interface PrivateCap {readonly lineage:FloorCapLineage;readonly position:T.BufferAttribute;readonly normal:T.BufferAttribute;readonly positions:Float32Array;readonly normals:Float32Array;readonly track:readonly VillagePort[];readonly refs:readonly VillagePort[];readonly values:readonly(readonly number[])[]}
const produced=new WeakMap<T.BufferGeometry,PrivateCap>();
/** Read-only producer fact, NEVER a native/support certificate or caller lineage input. */
export function floorCapProvenance(g:T.BufferGeometry):FloorCapLineage|undefined{const f=produced.get(g);if(!f||g.index||g.getAttribute('position')!==f.position||g.getAttribute('normal')!==f.normal||f.position.count!==36||f.track.length!==f.refs.length)return undefined;for(const[a,b]of[[f.position.array,f.positions],[f.normal.array,f.normals]]as const)if(a.length!==b.length||Array.from(a).some((v,i)=>!Object.is(v,b[i])))return undefined;for(let i=0;i<f.refs.length;i++){const p=f.track[i];if(p!==f.refs[i]||!p||[...p.position,...p.tangent,...p.normal,p.width].some((v,j)=>!Object.is(v,f.values[i]![j])))return undefined;}return f.lineage;}
type V=readonly[number,number,number];
function yOn(t:readonly[V,V,V],x:number,z:number){const[a,b,c]=t,ux=b[0]-a[0],uy=b[1]-a[1],uz=b[2]-a[2],vx=c[0]-a[0],vy=c[1]-a[1],vz=c[2]-a[2],nx=uy*vz-uz*vy,ny=uz*vx-ux*vz,nz=ux*vy-uy*vx;if(!(ny!==0))throw new Error('Floor cap cell is vertical');return a[1]-(nx*(x-a[0])+nz*(z-a[2]))/ny;}
function inXZ(t:readonly[V,V,V],x:number,z:number){const s=[0,1,2].map(i=>{const p=t[i]!,q=t[(i+1)%3]!;return(q[0]-p[0])*(z-p[2])-(q[2]-p[2])*(x-p[0]);});return s.every(v=>v>=0)||s.every(v=>v<=0);}

export function embeddedFloorCap(track:readonly VillagePort[],x:number,halfLength:number,bottom:number):{geometry:T.BufferGeometry;lineage:FloorCapLineage}{
 if(![x,halfLength,bottom].every(Number.isFinite)||!(halfLength>0))throw new Error('Floor cap requires finite inputs and positive length');
 const source=villageChannelGeometry(track,'timber');
 try{
  const p=source.getAttribute('position'),ix=source.getIndex(),rings=p.count/RING;
  if(!(p.array instanceof Float32Array)||p.itemSize!==3||p.normalized||!ix||ix.itemSize!==1||ix.normalized||!Number.isInteger(rings)||rings<2||ix.count!==(rings-1)*RING*6)throw new Error('Floor cap needs the plain timber channel source (no fan/lip/docking cut)');
  // Reconstruct each actual ring from an actual authored frame and the selected
  // timber material profile. Counts/cell IDs alone do not identify a floor.
  const profile=[[-.65,.2],[-.65,-.14],[.65,-.14],[.65,.2],[.4,.2],[.4,0],[-.4,0],[-.4,.2]]as const;
  for(let ring=0;ring<rings;ring++){let matches=0;for(const frame of track){const side=new T.Vector3().crossVectors(new T.Vector3(...frame.tangent),new T.Vector3(...frame.normal)).normalize();let same=true;for(let i=0;i<8&&same;i++)for(let axis=0;axis<3;axis++){const [across,height]=profile[i]!,expected=Math.fround(frame.position[axis]!+side.getComponent(axis)*across*frame.width+frame.normal[axis]!*(height-VILLAGE_RADIUS));if(!Object.is(p.getComponent(ring*8+i,axis),expected)){same=false;break;}}if(same)matches++;}if(matches!==1)throw new Error('Actual ring has no unique selected timber-profile source frame');}
  const v=(i:number):V=>[p.getX(i),p.getY(i),p.getZ(i)],tri=(t:number):[V,V,V]=>[v(ix.getX(3*t)),v(ix.getX(3*t+1)),v(ix.getX(3*t+2))];
  const x0=Math.fround(x-halfLength),x1=Math.fround(x+halfLength),y0=Math.fround(bottom);
  if(![x0,x1,y0].every(Number.isFinite)||!(x0<x1))throw new Error('Floor cap stored ends must be finite, distinct and ordered');
  for(let segment=0;segment<rings-1;segment++)for(let edge=0;edge<RING;edge++){const a=segment*RING+edge,b=segment*RING+(edge+1)%RING,c=a+RING,d=b+RING;for(const[j,v]of[a,c,b,b,c,d].entries())if(ix.getX(segment*48+edge*6+j)!==v)throw new Error('Changed plain timber surface cell topology');}
  for(let s=0;s<rings-1;s++){
   const lo=Math.min(v(s*RING)[0],v((s+1)*RING)[0]),hi=Math.max(v(s*RING)[0],v((s+1)*RING)[0]);
   if(!(x0>lo&&x1<hi))continue;
   const zs=BASE.map(k=>v(s*RING+k)[2]);if(BASE.some((k,j)=>v((s+1)*RING+k)[2]!==zs[j]))throw new Error('Floor ribbon boundary is not one constant stored z on this segment');
   const z0=Math.min(...zs),z1=Math.max(...zs);if(![z0,z1].every(Number.isFinite)||!(z0<z1))throw new Error('Floor cap ribbon must have positive stored width');const base=s*RING*2,under=[base+2*UNDERSIDE,base+2*UNDERSIDE+1]as const,floor=[base+2*FLOOR_TOP,base+2*FLOOR_TOP+1]as const;
   for(const cells of[under,floor])for(const id of cells){const t=tri(id),n=new T.Vector3(...t[1]).sub(new T.Vector3(...t[0])).cross(new T.Vector3(...t[2]).sub(new T.Vector3(...t[0])));if(!(cells===under?n.y<0:n.y>0))throw new Error('Actual source cells do not bound a timber floor');}
   const height=(cells:readonly[number,number],px:number,pz:number)=>{const hit=cells.map(tri).find(t=>inXZ(t,px,pz));if(!hit)throw new Error('Floor cap corner outside its incident cell');return yOn(hit,px,pz);};
   const top=([[x0,z0],[x0,z1],[x1,z0],[x1,z1]]as const).map(([px,pz])=>Math.fround((height(under,px,pz)+height(floor,px,pz))/2))as unknown as readonly[number,number,number,number];
   for(const[k,[px,pz]]of([[x0,z0],[x0,z1],[x1,z0],[x1,z1]]as const).entries())if(!(top[k]!>height(under,px,pz)&&top[k]!<height(floor,px,pz)&&y0<height(under,px,pz)))throw new Error('Floor cap top leaves the floor material or bottom does not reach below it');
   // Closed box, outward winding, NON-indexed so each face keeps a flat normal.
   const P=(i:number,j:number,up:boolean):V=>[i?x1:x0,up?top[i*2+j]!:y0,j?z1:z0];
   const quads:[V,V,V,V][]=[
    [P(0,0,true),P(0,1,true),P(1,1,true),P(1,0,true)],      // top (inside the floor)
    [P(0,0,false),P(1,0,false),P(1,1,false),P(0,1,false)],  // bottom (girder embed)
    [P(0,0,false),P(0,1,false),P(0,1,true),P(0,0,true)],    // x0 end
    [P(1,0,false),P(1,0,true),P(1,1,true),P(1,1,false)],    // x1 end
    [P(0,0,false),P(0,0,true),P(1,0,true),P(1,0,false)],    // z0 side (inner wall-base plane)
    [P(0,1,false),P(1,1,false),P(1,1,true),P(0,1,true)],    // z1 side (inner wall-base plane)
   ];
   const values:number[]=[];for(const[a,b,c,d]of quads)values.push(...a,...b,...c,...a,...c,...d);
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(values,3));geometry.computeVertexNormals();geometry.computeBoundingBox();
   const lineage:FloorCapLineage=Object.freeze({source:'villageChannelGeometry(track,timber)',segment:s,undersideTriangles:Object.freeze(under),floorTriangles:Object.freeze(floor),innerBaseZ:Object.freeze([z0,z1]as const),x:Object.freeze([x0,x1]as const),bottom:y0,top:Object.freeze(top),model:'finite-floor-tenon-117'});const position=geometry.getAttribute('position')as T.BufferAttribute,normal=geometry.getAttribute('normal')as T.BufferAttribute;produced.set(geometry,{lineage,position,normal,positions:new Float32Array(position.array),normals:new Float32Array(normal.array),track,refs:[...track],values:track.map(p=>[...p.position,...p.tangent,...p.normal,p.width])});return{geometry,lineage};
  }
  throw new Error('No single actual timber segment carries the whole cap footprint');
 }finally{source.dispose();}
}
// Winding: HAND cross products give outward normals +y, -y, -x, +x, -z, +z for the six quads
// (DESIGN.md section 3). The native exact closure/orientation check must still prove it.

// Mill129: selected common-band tenon, corrected126/127. Existing capB producer stays literal.
export interface FloorCoreLineage{
 readonly source:'villageChannelGeometry(track,timber)';
 readonly underSegments:readonly number[];readonly floorSegments:readonly number[];
 readonly undersideTriangles:readonly number[];readonly floorTriangles:readonly number[];
 readonly innerBaseZ:readonly[number,number];readonly x:readonly[number,number];readonly bottom:number;
 /** Float64 evaluations of STORED cells, used only to build. The exact rational proof is native. */
 readonly underMax:number;readonly floorMin:number;
 readonly branch:'common-band';
 /** Ascending (x, stored top) breakpoints of the top edge. common-band: exactly [[x0,t],[x1,t]]. */
 readonly tops:readonly(readonly[number,number])[];
 readonly model:'finite-floor-tenon-126';
}
interface PrivateCore{readonly lineage:FloorCoreLineage;readonly position:T.BufferAttribute;readonly normal:T.BufferAttribute;readonly positions:Float32Array;readonly normals:Float32Array;readonly positionArray:object;readonly normalArray:object;readonly track:readonly VillagePort[];readonly refs:readonly VillagePort[];readonly values:readonly(readonly number[])[]}
const producedCore=new WeakMap<T.BufferGeometry,PrivateCore>();
/** Read-only producer fact. NEVER a native/support certificate, and never accepted as caller input. */
export function floorCoreProvenance(g:T.BufferGeometry):FloorCoreLineage|undefined{
 const f=producedCore.get(g);if(!f||g.index||g.getAttribute('position')!==f.position||g.getAttribute('normal')!==f.normal||f.position.array!==f.positionArray||f.normal.array!==f.normalArray||!(f.position.array instanceof Float32Array)||!(f.normal.array instanceof Float32Array)||f.position.itemSize!==3||f.normal.itemSize!==3||f.position.normalized||f.normal.normalized||f.position.count!==f.positions.length/3||f.normal.count!==f.normals.length/3||f.track.length!==f.refs.length)return undefined;
 for(const[a,b]of[[f.position.array,f.positions],[f.normal.array,f.normals]]as const)if(a.length!==b.length||Array.from(a).some((v,i)=>!Object.is(v,b[i])))return undefined;
 for(let i=0;i<f.refs.length;i++){const p=f.track[i];if(p!==f.refs[i]||!p||[...p.position,...p.tangent,...p.normal,p.width].some((v,j)=>!Object.is(v,f.values[i]![j])))return undefined;}
 return f.lineage;
}

type V3=readonly[number,number,number];
export function embeddedFloorCoreCap(track:readonly VillagePort[],x:number,halfLength:number,bottom:number):{geometry:T.BufferGeometry;lineage:FloorCoreLineage}{
 if(![x,halfLength,bottom].every(Number.isFinite)||!(halfLength>0))throw new Error('Floor core cap requires finite inputs and positive length');
 const source=villageChannelGeometry(track,'timber');
 try{
  const p=source.getAttribute('position'),ix=source.getIndex(),rings=p.count/RING;
  if(!(p.array instanceof Float32Array)||p.itemSize!==3||p.normalized||!ix||ix.itemSize!==1||ix.normalized||!Number.isInteger(rings)||rings<2||ix.count!==(rings-1)*RING*6)throw new Error('Floor core cap needs the plain timber channel source (no fan/lip/docking cut)');
  // Profile semantics, as 125's capB guard: every stored ring equals exactly one authored frame
  // under the timber profile. Counts or cell IDs alone never identify the floor.
  const profile=[[-.65,.2],[-.65,-.14],[.65,-.14],[.65,.2],[.4,.2],[.4,0],[-.4,0],[-.4,.2]]as const;
  for(let ring=0;ring<rings;ring++){let matches=0;for(const frame of track){const side=new T.Vector3().crossVectors(new T.Vector3(...frame.tangent),new T.Vector3(...frame.normal)).normalize();let same=true;for(let i=0;i<8&&same;i++)for(let axis=0;axis<3;axis++){const[across,height]=profile[i]!,expected=Math.fround(frame.position[axis]!+side.getComponent(axis)*across*frame.width+frame.normal[axis]!*(height-VILLAGE_RADIUS));if(!Object.is(p.getComponent(ring*8+i,axis),expected)){same=false;break;}}if(same)matches++;}if(matches!==1)throw new Error('Actual ring has no unique selected timber-profile source frame');}
  for(let segment=0;segment<rings-1;segment++)for(let edge=0;edge<RING;edge++){const a=segment*RING+edge,b=segment*RING+(edge+1)%RING,c=a+RING,d=b+RING;for(const[j,w]of[a,c,b,b,c,d].entries())if(ix.getX(segment*48+edge*6+j)!==w)throw new Error('Changed plain timber surface cell topology');}
  const v=(i:number):V3=>[p.getX(i),p.getY(i),p.getZ(i)];
  const x0=Math.fround(x-halfLength),x1=Math.fround(x+halfLength),y0=Math.fround(bottom);
  if(![x0,x1,y0].every(Number.isFinite)||!(x0<x1))throw new Error('Floor core cap stored ends must be finite, distinct and ordered');
  // Rows: underside = profile vertices 1/2, floor top = 5/6. Each strip must be z-independent
  // (both vertices of a ring share stored x and y), so its height is one function of x.
  const row=(a:number,b:number)=>Array.from({length:rings},(_,r)=>{const A=v(r*RING+a),B=v(r*RING+b);if(!Object.is(A[0],B[0])||!Object.is(A[1],B[1]))throw new Error('Floor strip is not z-independent on ring '+r);return[A[0],A[1]]as const;});
  const under=row(1,2),floor=row(5,6);
  for(const r of[under,floor]){const s=Math.sign(r[1]![0]-r[0]![0]);if(!s||r.some((q,i)=>i>0&&Math.sign(q[0]-r[i-1]![0])!==s))throw new Error('Floor row x domain is not strictly ordered');}
  const span=(r:readonly(readonly[number,number])[])=>[Math.min(...r.map(q=>q[0])),Math.max(...r.map(q=>q[0]))]as const;
  for(const r of[under,floor]){const[lo,hi]=span(r);if(!(x0>lo&&x1<hi))throw new Error('Cap footprint leaves the actual floor rows (void)');}
  const incident=(r:readonly(readonly[number,number])[])=>{const out:number[]=[];for(let s=0;s<rings-1;s++){const lo=Math.min(r[s]![0],r[s+1]![0]),hi=Math.max(r[s]![0],r[s+1]![0]);if(hi>x0&&lo<x1)out.push(s);}return out;};
  const us=incident(under),fs=incident(floor);
  const at=(r:readonly(readonly[number,number])[],segs:readonly number[],px:number)=>{for(const s of segs){const a=r[s]!,b=r[s+1]!,lo=Math.min(a[0],b[0]),hi=Math.max(a[0],b[0]);if(px>=lo&&px<=hi)return a[1]+(b[1]-a[1])*(px-a[0])/(b[0]-a[0]);}throw new Error('Breakpoint outside incident cells');};
  // Lateral: intersection of stored inner-base domains of every incident ring; strictly inside exterior.
  const ringsUsed=[...new Set([...us,...fs].flatMap(s=>[s,s+1]))];let z0=-Infinity,z1=Infinity;
  for(const r of ringsUsed){const zb=BASE.map(k=>v(r*RING+k)[2]),ze=[v(r*RING+1)[2],v(r*RING+2)[2]];z0=Math.max(z0,Math.min(...zb));z1=Math.min(z1,Math.max(...zb));if(!(Math.min(...zb)>Math.min(...ze)&&Math.max(...zb)<Math.max(...ze)))throw new Error('Inner ribbon not strictly inside exterior walls');}
  if(![z0,z1].every(Number.isFinite)||!(z0<z1))throw new Error('Floor core cap ribbon must have positive common stored width');
  // Breakpoints: footprint ends plus every stored row x strictly inside the footprint.
  const breaks=[...new Set([x0,x1,...[...under,...floor].map(q=>q[0]).filter(q=>q>x0&&q<x1)])].sort((a,b)=>a-b);
  const U=Math.max(...breaks.map(q=>at(under,us,q))),F=Math.min(...breaks.map(q=>at(floor,fs,q)));
  if(!(y0<Math.min(...breaks.map(q=>at(under,us,q)))))throw new Error('Cap bottom does not reach below the actual underside');
  if(!(U<F))throw new Error('Selected capA has no positive common floor-material band');
  const t=Math.fround((U+F)/2);if(!(t>U&&t<F))throw new Error('Common floor band has no stored interior midpoint');
  const branch='common-band' as const,tops:(readonly[number,number])[]=[[x0,t],[x1,t]];
  // Closed prism along z over the x-y outline [(x0,y0),(x1,y0),tops reversed]; outward winding;
  // NON-indexed flat facets. common-band reduces to the same 6-quad box as capB (12 triangles).
  const values:number[]=[],quad=(a:V3,b:V3,c:V3,d:V3)=>values.push(...a,...b,...c,...a,...c,...d);
  const n=tops.length,Tp=(i:number,z:number):V3=>[tops[i]![0],tops[i]![1],z],Bt=(i:number,z:number):V3=>[tops[i]![0],y0,z];
  for(let i=0;i+1<n;i++){
   quad(Tp(i,z0),Tp(i,z1),Tp(i+1,z1),Tp(i+1,z0));     // top strip (+y, inside the floor material)
   quad(Bt(i,z0),Bt(i+1,z0),Bt(i+1,z1),Bt(i,z1));     // bottom strip (-y, girder embed)
   quad(Bt(i,z0),Tp(i,z0),Tp(i+1,z0),Bt(i+1,z0));     // z0 side trapezoid (-z, inner-base plane)
   quad(Bt(i,z1),Bt(i+1,z1),Tp(i+1,z1),Tp(i,z1));     // z1 side trapezoid (+z, inner-base plane)
  }
  quad(Bt(0,z0),Bt(0,z1),Tp(0,z1),Tp(0,z0));           // x0 end (-x)
  quad(Bt(n-1,z0),Tp(n-1,z0),Tp(n-1,z1),Bt(n-1,z1));   // x1 end (+x)
  // The selected common-band emits 6 outward quads, 12 triangles and 36 positions; its facet order is its own.
  const geometry=new T.BufferGeometry(),position=new T.Float32BufferAttribute(values,3);geometry.setAttribute('position',position);geometry.computeVertexNormals();geometry.computeBoundingBox();
  const normal=geometry.getAttribute('normal')as T.BufferAttribute;
  const lineage:FloorCoreLineage=Object.freeze({source:'villageChannelGeometry(track,timber)',underSegments:Object.freeze(us),floorSegments:Object.freeze(fs),
   undersideTriangles:Object.freeze(us.flatMap(s=>[s*16+2,s*16+3])),floorTriangles:Object.freeze(fs.flatMap(s=>[s*16+10,s*16+11])),
   innerBaseZ:Object.freeze([z0,z1]as const),x:Object.freeze([x0,x1]as const),bottom:y0,underMax:U,floorMin:F,branch,tops:Object.freeze(tops.map(q=>Object.freeze(q))),model:'finite-floor-tenon-126'});
  producedCore.set(geometry,{lineage,position,normal,positions:new Float32Array(position.array),normals:new Float32Array(normal.array),positionArray:position.array,normalArray:normal.array,track,refs:[...track],values:track.map(q=>[...q.position,...q.tangent,...q.normal,q.width])});
  return{geometry,lineage};
 }finally{source.dispose();}
}
// Winding (HAND): every quad repeats the vertex order of 117's capB box, whose outward normals
// were hand-checked (+y,-y,-x,+x,-z,+z). Strip splitting keeps all edges matched (no T-junction).
// The native exact closure/orientation proof decides; this comment is not evidence.
