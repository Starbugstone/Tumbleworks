import { Box3, Vector3 } from 'three';
import { triangleCrossing } from './village-geometry';
import type { SurfaceTriangle } from './surface-overlap';

/** Actual line segment shared by two noncoplanar crossing triangles. */
function intersection(a:SurfaceTriangle,b:SurfaceTriangle):readonly Vector3[]{
 const direction=a.normal.clone().cross(b.normal).normalize();
 const cuts=(face:SurfaceTriangle,plane:SurfaceTriangle)=>{
  const vertices=[face.a,face.b,face.c],result:Vector3[]=[];
  for(let i=0;i<3;i++){
   const p=vertices[i]!,q=vertices[(i+1)%3]!,d=p.clone().sub(plane.a).dot(plane.normal),e=q.clone().sub(plane.a).dot(plane.normal);
   if(d===0)result.push(p.clone());
   if(d*e<0)result.push(p.clone().lerp(q,d/(d-e)));
  }
  return result;
 };
 const first=cuts(a,b),second=cuts(b,a);if(first.length<2||second.length<2)return [];
 const projection=(p:Vector3)=>p.dot(direction);
 const lo=Math.max(Math.min(...first.map(projection)),Math.min(...second.map(projection)));
 const hi=Math.min(Math.max(...first.map(projection)),Math.max(...second.map(projection)));
 if(hi<lo)return [];
 return [lo,hi].map(s=>first[0]!.clone().addScaledVector(direction,s-projection(first[0]!)));
}
/** Explicit rigid welds in the declared composite inventory. The exemption is
 * the actual triangle-intersection segment within a finite endpoint patch;
 * neither mesh names, parent body nor a clear marble centre grants an exemption.
 */
export function retainedEndpointWeld(a:SurfaceTriangle,b:SurfaceTriangle):boolean{
 if(a.mesh.parent!==b.mesh.parent||!a.mesh.parent?.name.endsWith('-fork'))return false;
 const first:unknown=a.mesh.userData.retainerPart?.id,second:unknown=b.mesh.userData.retainerPart?.id;
 if(typeof first!=='string'||typeof second!=='string')return false;
 const pair=[first,second].sort().join('/');
 let centre:Vector3;
 if(pair==='leading-return/leading-sleeve')centre=new Vector3(0,0,-.26);
 else if(pair==='trailing-return/trailing-sleeve')centre=new Vector3(-.68,0,-.26);
 else if(pair==='leading-return/tie'||pair==='journal/tie'||pair==='journal/leading-return')centre=new Vector3(0,0,-.7);
 else if(pair==='tie/trailing-return')centre=new Vector3(-.68,0,-.7);
 else return false;
 const segment=intersection(a,b);if(segment.length!==2)return false;
 const inverse=a.mesh.parent.matrixWorld.clone().invert();
 // A 120mm endpoint cube encloses the .04 sleeve/.025 return or
 // .025 tie/.02 journal weld ends. It is a finite construction patch.
 return segment.every(p=>{const q=p.clone().applyMatrix4(inverse).sub(centre);return Math.max(Math.abs(q.x),Math.abs(q.y),Math.abs(q.z))<=.06;});
}

/** Every candidate pair is visited even after an intended weld was found. */
export function profileHardwareCrossings(hardware:readonly SurfaceTriangle[],all:readonly SurfaceTriangle[]){
 const grid=new Map<string,SurfaceTriangle[]>(),visit=(box:Box3,fn:(key:string)=>void)=>{
  for(let x=Math.floor(box.min.x/2);x<=Math.floor(box.max.x/2);x++)for(let y=Math.floor(box.min.y/2);y<=Math.floor(box.max.y/2);y++)for(let z=Math.floor(box.min.z/2);z<=Math.floor(box.max.z/2);z++)fn(`${x}/${y}/${z}`);
 };
 for(const face of all)visit(face.bounds,key=>{const cell=grid.get(key);if(cell)cell.push(face);else grid.set(key,[face]);});
 const result:{a:string;b:string;at:number[];parts:unknown[];local:number[][]}[]=[];
 for(const a of hardware){
  const nearby=new Set<SurfaceTriangle>();visit(a.bounds,key=>{for(const face of grid.get(key)??[])nearby.add(face);});
  for(const b of nearby)if(a!==b&&(triangleCrossing(a,b)||triangleCrossing(b,a))&&!retainedEndpointWeld(a,b))result.push({a:a.mesh.name,b:b.mesh.name,at:a.a.toArray(),parts:[a.mesh.userData.retainerPart,b.mesh.userData.retainerPart],local:intersection(a,b).map(p=>p.applyMatrix4(a.mesh.parent!.matrixWorld.clone().invert()).toArray())});
 }
 return result;
}
