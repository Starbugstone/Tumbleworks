import {Vector3,type BufferGeometry}from'three';
import type{RetainerPart}from'./retainer-parts';
import{CAPTIVE_TRIMS,type CaptiveTrim}from'./captive-leaf-parts';
type P=readonly[number,number];
const cross=(a:P,b:P,c:P)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const area=(p:readonly P[])=>Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length]!;return s+a[0]*b[1]-a[1]*b[0];},0))/2;
function clipped(subject:readonly P[],clip:readonly P[]):P[]{let p=[...subject];const sign=Math.sign(cross(clip[0]!,clip[1]!,clip[2]!));for(let i=0;i<3&&p.length;i++){const a=clip[i]!,b=clip[(i+1)%3]!,next:P[]=[];for(let j=0;j<p.length;j++){const x=p[j]!,y=p[(j+1)%p.length]!,d=sign*cross(a,b,x),e=sign*cross(a,b,y);if(d>=0)next.push(x);if((d>=0)!==(e>=0)){const t=d/(d-e);next.push([x[0]+t*(y[0]-x[0]),x[1]+t*(y[1]-x[1])]);}}p=next;}return p;}
function triangles(g:BufferGeometry){const p=g.getAttribute('position'),ix=g.index,result=[];for(let i=0;i<(ix?.count??p.count);i+=3){const ids=[0,1,2].map(k=>ix?ix.getX(i+k):i+k),points=ids.map(id=>new Vector3().fromBufferAttribute(p,id));result.push({offset:i,ids,points,normal:points[1]!.clone().sub(points[0]!).cross(points[2]!.clone().sub(points[0]!)).normalize()});}return result;}
/** Exact planar SAME-BODY weld coverage only. Never a name/group exemption and
 * never "the whole arm is inside intended contact". Inventory uses originals. */
export function trimCoveredPlanes(source:BufferGeometry,cover:BufferGeometry,trim:Extract<CaptiveTrim,{kind:'coplanar'}>):BufferGeometry {
 const n=new Vector3(...trim.normal).normalize(),a=Math.abs(n.x)<.9?new Vector3(1,0,0):new Vector3(0,1,0),u=a.addScaledVector(n,-a.dot(n)).normalize(),v=n.clone().cross(u);
 const project=(p:Vector3):P=>[p.dot(u),p.dot(v)],all=[...triangles(source),...triangles(cover)];
 const magnitude=Math.max(1,...all.flatMap(t=>t.points.flatMap(p=>p.toArray().map(Math.abs)))),packing=8*2**-24*magnitude;
 const on=(p:Vector3)=>Math.abs(p.dot(n)-trim.plane)<=packing;
 const covers=triangles(cover).filter(t=>t.points.every(on));let dropped=0;
 const indices:number[]=[];
 for(const t of triangles(source)){
  if(!t.points.every(on)){indices.push(...t.ids);continue;}
  const subject=t.points.map(project),target=area(subject),perimeter=t.points.reduce((s,p,i)=>s+p.distanceTo(t.points[(i+1)%3]!),0);
  const covered=covers.filter(c=>c.normal.dot(t.normal)<-.99999).reduce((sum,c)=>sum+area(clipped(subject,c.points.map(project))),0);
  if(!(target>0)||Math.abs(covered-target)>packing*perimeter)throw new Error(`Uncertified coplanar weld coverage by ${trim.coveredBy}; interior containment is insufficient`);
  dropped++;
 }
 if(dropped===0)throw new Error('Declared trim has no actual packed face');
 const g=source.clone();g.setIndex(indices);g.clearGroups();g.userData={...source.userData,retainerRenderTrim:true};g.computeVertexNormals();return g;
}
export function captiveRenderGeometry(part:RetainerPart,parts:readonly RetainerPart[]):BufferGeometry {
 let g=part.geometry;try{for(const trim of CAPTIVE_TRIMS[part.id]??[]){if(trim.kind==='enclosed-cap')continue;const cover=parts.find(p=>p.id===trim.coveredBy);if(!cover||cover.body!==part.body)throw new Error('Trim requires permanent same-body covering identity');const next=trimCoveredPlanes(g,cover.geometry,trim);if(g!==part.geometry)g.dispose();g=next;}return g;}catch(e){if(g!==part.geometry)g.dispose();throw e;}
}
