import * as T from'three';
import{prism,prismLineage,prismUnion}from'./axle-solid';
interface Source{readonly boss:T.BufferGeometry;readonly source:ReturnType<typeof prismLineage>;readonly stores:string;readonly attributes:readonly{readonly name:string;readonly attribute:T.BufferAttribute;readonly array:object;readonly count:number;readonly size:number;readonly normalized:boolean;readonly version:number;readonly values:readonly number[]}[];readonly cuts:readonly[number,number];}
const sources=new WeakMap<T.BufferGeometry,Source>();
const fingerprint=(source:ReturnType<typeof prismLineage>,tick:()=>void)=>JSON.stringify(source,(_,v:unknown)=>{if(typeof v==='number'){tick();return Object.is(v,-0)?'-0':v;}return v;});
export function spokeArmSource(g:T.BufferGeometry,boss:T.BufferGeometry,tick:()=>void){const source=sources.get(g);if(!source||source.boss!==boss||boss.index||prismLineage(boss)!==source.source||fingerprint(source.source,tick)!==source.stores)throw Error('Changed actual boss/spoke source');for(const a of source.attributes){const p=boss.getAttribute(a.name);if(p!==a.attribute||p.array!==a.array||p.count!==a.count||p.itemSize!==a.size||p.normalized!==a.normalized||p.version!==a.version)throw Error('Changed actual boss attribute');for(let i=0;i<a.values.length;i++){tick();if(!Object.is(p.array[i],a.values[i]))throw Error('Changed actual boss buffer');}}if(Object.keys(boss.attributes).length!==source.attributes.length)throw Error('Changed actual boss attribute set');return source;}
/** Two closed arms; selected rows are read through their actual boss source records. */
export function spokeThroughBoss146(boss:T.BufferGeometry,tick:()=>void){
 tick();const source=prismLineage(boss),p=boss.getAttribute('position'),outer=source.loops[0],hole=source.loops[1];
 if(boss.index||!(p instanceof T.BufferAttribute)||!(p.array instanceof Float32Array)||p.itemSize!==3||p.normalized||source.loops.length!==2||outer?.length!==8||hole?.length!==8||source.stores.length!==p.count||source.vertices.length!==p.count)throw Error('Actual canonical octagonal boss required');
 for(let i=0;i<p.count;i++)for(let j=0;j<3;j++){tick();if(!Object.is(p.getComponent(i,j),source.stores[i]!.packed[j]))throw Error('Changed actual boss store');}
 const vertex=(loop:readonly(readonly[number,number])[],at:number)=>{
  const nominal=loop[at]!,found:number[]=[];
  for(let i=0;i<source.stores.length;i++){tick();const s=source.stores[i]!;if(Object.is(s.nominal[0],nominal[0])&&Object.is(s.nominal[1],nominal[1]))found.push(i);}
  if(!found.length)throw Error('Missing actual boss vertex');
  const first=found[0]!,x=p.getX(first),y=p.getY(first);
  for(const i of found){tick();if(!Object.is(p.getX(i),x)||!Object.is(p.getY(i),y))throw Error('Ambiguous actual boss vertex');}
  return[x,y]as const;
 };
 const a=vertex(outer,1),b=vertex(outer,7),y45=a[1],y315=b[1],half=Math.fround(.035),bore=hole.map((_,i)=>vertex(hole,i));
 if(!(a[0]>half&&b[0]>half&&y45>Math.max(...bore.map(v=>v[1]))&&y315<Math.min(...bore.map(v=>v[1]))&&y315<y45&&y45<Math.fround(-.08)&&y315>Math.fround(-2.07)))throw Error('No selected finite arm ends');
 // Ordering above is a constructor guard, not exact occupied-set/weld authority.
 // That separate native proof checks ALL stored octagon halfspaces and components.
 const pieces:T.BufferGeometry[]=[];let consumed=false;
 try{
  pieces.push(prism([[-half,y45],[half,y45],[half,-.08],[-half,-.08]],[],-3.855,-3.805));
  pieces.push(prism([[-half,-2.07],[half,-2.07],[half,y315],[-half,y315]],[],-3.855,-3.805));
  consumed=true;const g=prismUnion(pieces,tick);try{const attributes=Object.entries(boss.attributes).map(([name,raw])=>{const attribute=raw as T.BufferAttribute;return Object.freeze({name,attribute,array:attribute.array,count:attribute.count,size:attribute.itemSize,normalized:attribute.normalized,version:attribute.version,values:Object.freeze(Array.from(attribute.array,x=>{tick();return x;}))});});sources.set(g,Object.freeze({boss,source,stores:fingerprint(source,tick),attributes:Object.freeze(attributes),cuts:Object.freeze([y45,y315]as const)}));return g;}catch(error){g.dispose();throw error;}
 }finally{if(!consumed)for(const g of pieces)g.dispose();}
}
