import * as T from 'three';
import {keyedHeadParts} from './retainer-parts';
import {VILLAGE_RADIUS} from '../world/village-plan';
import {exact,add,cmp} from '../world/rocker-foot';

const radius=.04,segments=16,half=.56/2;
type Tick=(n?:number)=>void;
interface Seal {readonly attributes:ReadonlyMap<string,{attribute:T.BufferAttribute;version:number;data:Float32Array}>;readonly index:T.BufferAttribute|null;readonly indices:Uint16Array|Uint32Array|null;readonly groups:readonly {start:number;count:number;materialIndex?:number}[];readonly maxRestore:number;}
const seals=new WeakMap<T.BufferGeometry,Seal>();
/** The existing marble model owns rho. Only the axle uses this origin law. */
export function axleHeadOrigin(x:number){return x+VILLAGE_RADIUS;}
export function assertAxleHeadDomain(lo:number,hi:number){
 if(!(Number.isFinite(lo)&&Number.isFinite(hi)&&lo<=hi&&lo>=-2*VILLAGE_RADIUS&&hi<=-VILLAGE_RADIUS/2))throw Error('Axle head contact domain outside Sterbenz subtraction interval');
 for(const x of[lo,hi])if(cmp(exact(axleHeadOrigin(x)),add(exact(x),exact(VILLAGE_RADIUS)))!==0)throw Error('Axle head origin is not exact');
 return Object.freeze({lo,hi,rho:VILLAGE_RADIUS,identity:'Sterbenz: rho and -x within factor two; every represented x in the closed interval, not sampled motion.'});
}
function seal(g:T.BufferGeometry,maxRestore:number,tick:Tick){
 const attributes=new Map<string,{attribute:T.BufferAttribute;version:number;data:Float32Array}>();
 for(const[name,a]of Object.entries(g.attributes)){const attribute=a as T.BufferAttribute;tick(attribute.count);attributes.set(name,{attribute,version:attribute.version,data:new Float32Array(attribute.array)});}
 tick(g.index?.count??0);seals.set(g,{attributes,index:g.index,indices:g.index?.array.slice() as Uint16Array|Uint32Array|null??null,groups:g.groups.map(a=>({...a})),maxRestore});
}
/** Called after final painting. A public description never grants private ownership. */
export function sealAxleHeadColor(g:T.BufferGeometry,tick:Tick){const s=seals.get(g);if(!s)return;if(s.attributes.has('color'))throw Error('Head color already sealed');const a=g.getAttribute('color')as T.BufferAttribute,c=new T.Color(0x657578);if(!a||a.itemSize!==3||a.normalized||a.count!==g.getAttribute('position').count)throw Error('Missing head paint');tick(a.count);for(let i=0;i<a.count;i++)if(a.getX(i)!==Math.fround(c.r)||a.getY(i)!==Math.fround(c.g)||a.getZ(i)!==Math.fround(c.b))throw Error('Wrong head paint');const attributes=new Map(s.attributes);attributes.set('color',{attribute:a,version:a.version,data:new Float32Array(a.array)});seals.set(g,{...s,attributes});}
export function assertAxleHeadSource(g:T.BufferGeometry,tick:Tick){
 const s=seals.get(g);if(!s||g.index!==s.index||g.drawRange.start!==0||g.drawRange.count!==Infinity||Object.keys(g.attributes).length!==s.attributes.size||g.groups.length!==s.groups.length)throw Error('Missing/foreign/trimmed head source');
 for(const[name,f]of s.attributes){const a=g.getAttribute(name) as T.BufferAttribute;tick(f.data.length);if(a!==f.attribute||a.version!==f.version||a.itemSize!==(name==='uv'?2:3)||a.normalized||a.array.length!==f.data.length||f.data.some((v,i)=>!Object.is(v,a.array[i])))throw Error('Changed final head attribute '+name);}
 tick((s.indices?.length??0)+g.groups.length);if(s.indices?.some((v,i)=>v!==g.index!.array[i])||s.groups.some((v,i)=>Object.keys(v).some(k=>v[k as keyof typeof v]!==g.groups[i]![k as keyof typeof v])))throw Error('Changed head topology');
 return Object.freeze({radius,segments,half,maxRestore:s.maxRestore,model:'HCR159 exact-quadrant contact edge; root160 common-frame physical model' as const});
}
/** Pinned CylinderGeometry ordering/UV/groups, nominal quadrant and rotation map.
 * The two side rings and cap rings share exactly the same stored perimeter. */
function sleeve(tick:Tick){
 const g=new T.CylinderGeometry(radius,radius,2*half,segments);try{
  const p=g.getAttribute('position'),trig=(i:number):readonly[number,number]=>i%4===0?([[0,1],[1,0],[0,-1],[-1,0],[0,1]]as const)[i/4]!:[Math.sin(i/segments*Math.PI*2),Math.cos(i/segments*Math.PI*2)];
  const put=(i:number,j:number,z:number)=>{tick();const[s,c]=trig(j);p.setXYZ(i,radius*s+radius,-radius*c,-z);};
  for(let row=0;row<2;row++)for(let j=0;j<=segments;j++)put(row*(segments+1)+j,j,row===0?half:-half);
  let offset=2*(segments+1);for(const z of[half,-half]){for(let j=0;j<segments;j++){tick();p.setXYZ(offset+j,radius,0,-z);}offset+=segments;for(let j=0;j<=segments;j++)put(offset+j,j,z);offset+=segments+1;}
  if(offset!==p.count)throw Error('Pinned cylinder layout changed');
  const ids=Array.from(g.index!.array);for(let i=0;i<ids.length;i+=3){tick();[ids[i+1],ids[i+2]]=[ids[i+2]!,ids[i+1]!];}g.setIndex(ids);g.computeVertexNormals();tick(p.count);return g;
 }catch(e){g.dispose();throw e;}
}
/** Each geometry has one owner on success; every partially built result is disposed on throw. */
export function axleHeadParts(tick:Tick){
 const parts=keyedHeadParts('timber',1);try{
  for(const part of parts){let delta=0;if(part.id==='leading-sleeve'){const next=sleeve(tick);part.geometry.dispose();(part as {geometry:T.BufferGeometry}).geometry=next;}else{const p=part.geometry.getAttribute('position');for(let i=0;i<p.count;i++){tick();const x=p.getX(i)+radius,v=Math.fround(x);delta=Math.max(delta,Math.abs(v-x));p.setX(i,v);}part.geometry.computeVertexNormals();tick(p.count);}
   seal(part.geometry,delta,tick);
  }return parts;
 }catch(e){for(const p of parts)p.geometry.dispose();throw e;}
}
