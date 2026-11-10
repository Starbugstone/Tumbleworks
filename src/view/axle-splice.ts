import * as T from'three';
import{villageChannelGeometry}from'./machine-primitives';
import type{VillagePort}from'../world/village-plan';
import{exact,add,sub,mul,cmp,rat,type R}from'../world/rocker-foot';
const RING=8;
export interface DockRingFacts{
 readonly ring:number;readonly dock:'home'|'top';readonly matrix:readonly number[];   // actual 16 dock-matrix doubles
 readonly deckEndLocalX:number;                                                       // stored deck local end x (all 8 equal)
 readonly nativeDeviation:string;                                                     // m, exact rational n/d
 readonly points:readonly{readonly height:number;readonly plain:readonly[number,number];readonly stored:readonly[number,number];readonly d:string}[];
 readonly maximumLocalXSeparation:string; // upper projection bound, NOT a Euclidean floor-gap bound
 readonly crack:string;                                                               // exact min over static points of -d - m
 readonly topFloor?:{readonly rule:'floor-down-first-141';readonly profile:readonly[5,6];readonly plain:readonly[number,number];readonly stored:readonly[number,number];readonly normalShift:string;readonly nextNormalShift:string;readonly d:string;readonly frameNormal:readonly[number,number];readonly nextFrameNormal:readonly[number,number]};
 readonly model:'directed-dock-end-ring-131';
}
const up=(v:number)=>{if(!Number.isFinite(v))throw new Error('Nonfinite dock store');const f=Math.fround(v);if(!Number.isFinite(f))throw new Error('Overflowing dock store');if(f>v)return f;const b=new Float32Array([f]),u=new Uint32Array(b.buffer);if(f===0)u[0]=1;else u[0]=f>0?u[0]!+1:u[0]!-1;const next=b[0]!;if(!Number.isFinite(next))throw new Error('Overflowing adjacent dock store');return next;};
const down=(v:number)=>-up(-v);
/** Exact signed distance numerator along the deck's local x: (M^-1 w)_x - c, using the actual
 *  double matrix entries as exact rationals (rotation about z plus translation, column-major). */
function signedLocalX(M:readonly number[],c:number,wx:number,wy:number,wz:number):R{
 const e=M.map(exact),[a,b,,,cc,d]=[e[0]!,e[1]!,e[2]!,e[3]!,e[4]!,e[5]!];               // [a cc; b d] in-plane block
 if(cmp(e[2]!,rat(0n))!==0||cmp(e[6]!,rat(0n))!==0||cmp(e[8]!,rat(0n))!==0||cmp(e[9]!,rat(0n))!==0||cmp(e[10]!,rat(1n))!==0)throw new Error('Dock matrix is not the selected planar pose');
 const det=sub(mul(a,d),mul(cc,b)),dx=sub(exact(wx),e[12]!),dy=sub(exact(wy),e[13]!);   // local x = ( d*dx - cc*dy)/det
 void wz;return sub(mul(sub(mul(d,dx),mul(cc,dy)),rat(det.d,det.n)),exact(c));          // sign of det verified positive below
}
/** The actual nine-store selector used by the compositor. This returns construction
 * facts only; source, native range and full correspondence checks remain mandatory. */
export function selectDockStore(wx:number,wy:number,M:readonly number[],c:number,m:R,ring:number,ids:readonly number[],dock:{readonly which:'home'|'top';readonly normals?:readonly[readonly[number,number],readonly[number,number]];readonly tick?:(n?:number)=>void}){
 dock.tick?.(24); // Input/domain comparisons are part of this invocation's work.
 if(!Number.isFinite(wx)||!Number.isFinite(wy)||Math.fround(wx)!==wx||Math.fround(wy)!==wy||!Number.isFinite(c)||m.n<0n||m.d<=0n||M.length!==16||M.some(v=>!Number.isFinite(v))||M[3]!==0||M[7]!==0||M[11]!==0||M[15]!==1||!(M[0]!*M[5]!-M[4]!*M[1]!>0))throw Error('Indeterminate dock-store input');
 const sideSign=-1;let topFloor:DockRingFacts['topFloor'];
   const candidates=[[wx,wy],[down(wx),wy],[up(wx),wy],[wx,down(wy)],[wx,up(wy)],[down(wx),down(wy)],[down(wx),up(wy)],[up(wx),down(wy)],[up(wx),up(wy)]] as const;
   let best:{s:readonly[number,number];d:R;dist:number}|undefined;
   const floor=dock.which==='top'&&ring===0&&ids.length===2&&ids.includes(5)&&ids.includes(6);
   const normals=dock.normals;if(floor&&(!normals||normals.some(n=>n.some(v=>!Number.isFinite(v))||!(n[1]>0))))throw Error('F141 normal domain is zero/nonplanar/indeterminate');
   let lowest:{s:readonly[number,number];d:R;nu:R;next:R}|undefined;
   for(const s of candidates){dock.tick?.();const d=signedLocalX(M,c,s[0],s[1],0);const outside=sideSign*cmp(d,rat(-m.n,m.d))>0&&cmp(d,rat(0n))!==0;
    if(!outside)continue;
    if(floor){dock.tick?.(2);const dx=sub(exact(s[0]),exact(wx)),dy=sub(exact(s[1]),exact(wy)),shift=(n:readonly[number,number])=>add(mul(exact(n[0]),dx),mul(exact(n[1]),dy)),nu=shift(normals![0]),next=shift(normals![1]);if(cmp(nu,rat(0n))>0||cmp(next,rat(0n))>0)continue;
     if(!lowest||cmp(nu,lowest.nu)<0||cmp(nu,lowest.nu)===0&&(cmp(d,lowest.d)>0||cmp(d,lowest.d)===0&&(s[0]<lowest.s[0]||s[0]===lowest.s[0]&&s[1]<lowest.s[1])))lowest={s,d,nu,next};continue;}
    const dist=Math.hypot(s[0]-wx,s[1]-wy);if(!best||dist<best.dist||dist===best.dist&&(s[0]<best.s[0]||s[0]===best.s[0]&&s[1]<best.s[1]))best={s,d,dist};}
   if(floor){if(!lowest)throw Error('F141 no fixed-side nonraising floor store in the SAME nine choices');best={s:lowest.s,d:lowest.d,dist:Math.hypot(lowest.s[0]-wx,lowest.s[1]-wy)};topFloor=Object.freeze({rule:'floor-down-first-141',profile:Object.freeze([5,6]as const),plain:Object.freeze([wx,wy]as const),stored:Object.freeze([...lowest.s])as readonly[number,number],normalShift:lowest.nu.n+'/'+lowest.nu.d,nextNormalShift:lowest.next.n+'/'+lowest.next.d,d:lowest.d.n+'/'+lowest.d.d,frameNormal:Object.freeze([...normals![0]])as readonly[number,number],nextFrameNormal:Object.freeze([...normals![1]])as readonly[number,number]});}
   if(!best)throw new Error('No adjacent Float32 store lies strictly on the static side of the actual deck end plane');
 return{best,topFloor};
}

function applyDirected(g:T.BufferGeometry,dock:{readonly which:'home'|'top';readonly ring:'first'|'last';readonly deckLocal:T.BufferAttribute;readonly deckEndRing:readonly number[];readonly matrix:T.Matrix4;readonly normals?:readonly[readonly[number,number],readonly[number,number]];readonly tick?:(n?:number)=>void}){
 const p=g.getAttribute('position'),rings=p.count/RING;
  if(!(p.array instanceof Float32Array)||!Number.isInteger(rings)||rings<2||g.getIndex()?.count!==(rings-1)*RING*6)throw new Error('Dock ring needs the plain timber channel source');
  const M=dock.matrix.elements.slice();if(M.length!==16||M.some(v=>!Number.isFinite(v))||M[3]!==0||M[7]!==0||M[11]!==0||M[15]!==1)throw new Error('Non-affine dock matrix');const ring=dock.ring==='first'?0:rings-1;
  const e=M.map(exact),det=sub(mul(e[0]!,e[5]!),mul(e[4]!,e[1]!));if(cmp(det,rat(0n))<=0)throw new Error('Dock matrix has no positive planar orientation');
  // Actual deck end ring: 8 stored local vertices sharing one stored local x.
  const L=dock.deckLocal;if(!(L.array instanceof Float32Array)||L.itemSize!==3||L.normalized||dock.deckEndRing.length!==RING||new Set(dock.deckEndRing).size!==RING||dock.deckEndRing.some(i=>!Number.isInteger(i)||i<0||i>=L.count))throw new Error('Deck end ring must be 8 distinct actual Float32 profile vertices');
  const c=L.getX(dock.deckEndRing[0]!);if(dock.deckEndRing.some(i=>!Object.is(L.getX(i),c)))throw new Error('Deck end ring is not one stored local plane');
  // m: deviation of the ACTUAL native world deck ring (same applyMatrix4 operator as the draw/native path) from E.
  let m=rat(0n);const v=new T.Vector3();
  for(const i of dock.deckEndRing){v.fromBufferAttribute(L,i).applyMatrix4(dock.matrix);const s=signedLocalX(M,c,v.x,v.y,v.z),abs=cmp(s,rat(0n))<0?rat(-s.n,s.d):s;if(cmp(abs,m)>0)m=abs;}
  // Static side: the half-space away from the deck body (deck interior is local x > c).
  const groups=new Map<string,number[]>();for(let k=0;k<RING;k++){const i=ring*RING+k,key=p.getX(i)+'/'+p.getY(i);groups.set(key,[...(groups.get(key)??[]),i]);}
  const facts:DockRingFacts['points'][number][]=[];let crack:R|undefined,maximumGap:R|undefined;let topFloor:DockRingFacts['topFloor'];
  for(const ids of groups.values()){
   const wx=p.getX(ids[0]!),wy=p.getY(ids[0]!);
   const{best,topFloor:selectedFloor}=selectDockStore(wx,wy,M,c,m,ring,ids,dock);if(selectedFloor)topFloor=selectedFloor;
   for(const i of ids){p.setX(i,best.s[0]);p.setY(i,best.s[1]);}
   const gap=sub(rat(-best.d.n,best.d.d),m),upper=add(rat(-best.d.n,best.d.d),m);crack=crack&&cmp(crack,gap)<=0?crack:gap;maximumGap=maximumGap&&cmp(maximumGap,upper)>=0?maximumGap:upper;
   facts.push(Object.freeze({height:ids.length,plain:Object.freeze([wx,wy]as const),stored:Object.freeze([...best.s])as readonly[number,number],d:best.d.n+'/'+best.d.d}));
  }

  const out:DockRingFacts=Object.freeze({ring,dock:dock.which,matrix:Object.freeze(M),deckEndLocalX:c,nativeDeviation:m.n+'/'+m.d,points:Object.freeze(facts),maximumLocalXSeparation:maximumGap!.n+'/'+maximumGap!.d,crack:crack!.n+'/'+crack!.d,model:'directed-dock-end-ring-131',...(topFloor?{topFloor}:{})});
  return out;
}


export interface AxleSpliceInput {readonly dock:'home'|'top';readonly deckLocal:T.BufferAttribute;readonly deckEndRing:readonly number[];readonly matrix:T.Matrix4;readonly neighbour:T.Mesh;readonly home:T.Group;readonly neighbourEnd:'first'|'last';readonly tick?:(n?:number)=>void}
interface AttributeSeal {readonly attribute:T.BufferAttribute;readonly array:object;readonly values:readonly number[];readonly version:number;readonly size:number;readonly normalized:boolean;readonly count:number}
const seal=(a:T.BufferAttribute):AttributeSeal=>({attribute:a,array:a.array,values:Array.from(a.array),version:a.version,size:a.itemSize,normalized:a.normalized,count:a.count});
const intact=(a:T.BufferAttribute|undefined,s:AttributeSeal)=>a===s.attribute&&a.array===s.array&&a.version===s.version&&a.itemSize===s.size&&a.normalized===s.normalized&&a.count===s.count&&a.array.length===s.values.length&&s.values.every((v,i)=>Object.is(v,a.array[i]));
interface Source {readonly facts:DockRingFacts;readonly shared:readonly{vertex:number;before:readonly number[];after:readonly number[]}[];readonly p:AttributeSeal;readonly n:AttributeSeal;readonly i:AttributeSeal;readonly points:readonly VillagePort[];readonly refs:readonly VillagePort[];readonly pointValues:readonly(readonly number[])[];readonly deck:T.BufferAttribute;readonly deckSeal:AttributeSeal;readonly matrix:T.Matrix4;readonly matrixValues:readonly number[];readonly neighbour:T.Mesh;readonly neighbourGeometry:T.BufferGeometry;readonly neighbourP:AttributeSeal;readonly neighbourN:AttributeSeal;readonly neighbourI:AttributeSeal;readonly publicFacts:{readonly facts:DockRingFacts;readonly shared:Source['shared'];readonly neighbourMatrix:readonly number[];readonly neighbourRing:readonly number[];readonly ordinary:{readonly positions:readonly number[];readonly indices:readonly number[]}}}
const finalSources=new WeakMap<T.BufferGeometry,Source>();
let validationBatch:WeakMap<T.BufferGeometry,Source['publicFacts']>|undefined;
/** Only the synchronous native gate batches repeated checks; no state survives
 * the call, failure or exception. Independent observations remain deep. */
export function withAxleSpliceValidation<V>(run:()=>V):V{if(validationBatch)throw Error('Nested axle source validation');validationBatch=new WeakMap();try{return run();}finally{validationBatch=undefined;}}
export function axleSpliceSource(g:T.BufferGeometry,tick?:(n?:number)=>void){const cached=validationBatch?.get(g);if(cached){tick?.(1);return cached;}const f=finalSources.get(g);if(f)tick?.(f.p.values.length+f.n.values.length+f.i.values.length+f.deckSeal.values.length+f.neighbourP.values.length+f.neighbourN.values.length+f.neighbourI.values.length+f.points.length);if(!f||g.drawRange.start!==0||g.drawRange.count!==Infinity||g.groups.length!==0||!intact(g.getAttribute('position')as T.BufferAttribute,f.p)||!intact(g.getAttribute('normal')as T.BufferAttribute,f.n)||!intact(g.index??undefined,f.i)||Object.keys(g.attributes).some(k=>!['position','normal','color'].includes(k)))return undefined;
 if(!intact(f.deck,f.deckSeal)||f.matrix.elements.some((v,i)=>!Object.is(v,f.matrixValues[i]))||f.neighbour.geometry!==f.neighbourGeometry||!intact(f.neighbourGeometry.getAttribute('position')as T.BufferAttribute,f.neighbourP)||!intact(f.neighbourGeometry.getAttribute('normal')as T.BufferAttribute,f.neighbourN)||!intact(f.neighbourGeometry.index??undefined,f.neighbourI))return undefined;
 if(f.points.length!==f.refs.length||f.points.some((p,j)=>p!==f.refs[j]||[...p.position,...p.tangent,...p.normal,p.width].some((v,k)=>!Object.is(v,f.pointValues[j]![k]))))return undefined;validationBatch?.set(g,f.publicFacts);return f.publicFacts;}
/** One base, BOTH endpoint operations, one final seal. Producer fact only, never native eligibility. */
export function axleSpliceGeometry(points:readonly VillagePort[],input:AxleSpliceInput){const g=villageChannelGeometry(points,'timber'),p=g.getAttribute('position')as T.BufferAttribute,ix=g.index;input.tick?.(points.length+p.count+(ix?.count??0)/3);let baked:T.BufferGeometry|undefined;try{if(!(p.array instanceof Float32Array)||!ix||p.count<16||p.count%8||ix.count!==(p.count/8-1)*48)throw Error('Selected plain timber splice required');
 input.home.updateWorldMatrix(true,true);input.neighbour.updateWorldMatrix(true,false);input.tick?.(3);const M=input.home.matrixWorld.clone().invert().multiply(input.neighbour.matrixWorld);baked=input.neighbour.geometry.clone();baked.applyMatrix4(M);input.tick?.(baked.getAttribute('position').count*2);const bp=baked.getAttribute('position'),count=bp.count;if(count<16||count%8)throw Error('Actual neighbour plain timber rings required');const nr=input.neighbourEnd==='first'?0:count-8,ring=new Float32Array(24);for(let k=0;k<8;k++)for(let a=0;a<3;a++)ring[3*k+a]=bp.getComponent(nr+k,a);
 input.tick?.(p.array.length+ix.array.length);const ordinary=Object.freeze({positions:Object.freeze(Array.from(p.array)),indices:Object.freeze(Array.from(ix.array))});
 const staticRing=input.dock==='home'?0:p.count-8,shared=[];for(let k=0;k<8;k++){input.tick?.(1);const before=[p.getX(staticRing+k),p.getY(staticRing+k),p.getZ(staticRing+k)],after=Array.from(ring.slice(k*3,k*3+3));for(let a=0;a<3;a++){const x=before[a]!,y=after[a]!;if(y!==x&&y!==down(x)&&y!==up(x))throw Error('Actual static neighbour exceeds ONE adjacent Float32 at vertex '+k+' axis '+a+': '+x+' -> '+y);}p.setXYZ(staticRing+k,after[0]!,after[1]!,after[2]!);shared.push(Object.freeze({vertex:k,before:Object.freeze(before),after:Object.freeze(after)}));}
 input.tick?.(8);if(input.dock==='top'&&(points[0]!.normal[2]!==0||points[1]!.normal[2]!==0))throw Error('F141 requires actual planar endpoint normals');const facts=applyDirected(g,{tick:input.tick,...(input.dock==='top'?{normals:[[points[0]!.normal[0],points[0]!.normal[1]],[points[1]!.normal[0],points[1]!.normal[1]]]as const}:{}),which:input.dock,ring:input.dock==='home'?'last':'first',deckLocal:input.deckLocal,deckEndRing:input.deckEndRing,matrix:input.matrix});p.needsUpdate=true;g.computeVertexNormals();g.computeBoundingBox();input.tick?.(ix.count/3+2*p.count);const n=g.getAttribute('normal')as T.BufferAttribute,i=g.index!;
 const sharedFacts=Object.freeze(shared),publicFacts=Object.freeze({facts,shared:sharedFacts,neighbourMatrix:Object.freeze(M.toArray()),neighbourRing:Object.freeze(Array.from(ring)),ordinary});
 input.tick?.(2*p.array.length+i.array.length+input.deckLocal.array.length+input.neighbour.geometry.getAttribute('position').array.length+input.neighbour.geometry.getAttribute('normal').array.length+input.neighbour.geometry.index!.array.length+points.length);
 finalSources.set(g,{facts,shared:sharedFacts,p:seal(p),n:seal(n),i:seal(i),points,refs:[...points],pointValues:points.map(p=>[...p.position,...p.tangent,...p.normal,p.width]),deck:input.deckLocal,deckSeal:seal(input.deckLocal),matrix:input.matrix,matrixValues:input.matrix.toArray(),neighbour:input.neighbour,neighbourGeometry:input.neighbour.geometry,neighbourP:seal(input.neighbour.geometry.getAttribute('position')as T.BufferAttribute),neighbourN:seal(input.neighbour.geometry.getAttribute('normal')as T.BufferAttribute),neighbourI:seal(input.neighbour.geometry.index!),publicFacts});return g;
 }catch(e){g.dispose();throw e;}finally{baked?.dispose();}}
