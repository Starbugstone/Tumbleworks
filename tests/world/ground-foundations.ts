import { Mesh,Vector3,type Object3D } from 'three';
import { surfaceTriangles } from './surface-overlap';

/** Find actual downward ground-contact surfaces, including union meshes and
 * fitted sloping feet. The caller still audits each complete footprint and
 * checks fixed solids against terrain; shape type and centre height prove neither.
 */
export function groundFoundations(roots:readonly Object3D[],height:(x:number,z:number)=>number|undefined){
 const result:{name:string;centre:number[];ground:number;bottom:[Vector3,Vector3,Vector3][]}[]=[];
 for(const root of roots)root.traverse(mesh=>{
  if(!(mesh instanceof Mesh))return;
  const bottom=surfaceTriangles(mesh).filter(t=>t.normal.y<0&&
   [t.a,t.b,t.c].some(p=>{const h=height(p.x,p.z);return h!==undefined&&Math.abs(p.y-h)<=.002;}));
  if(!bottom.length)return;
  const centre=bottom.reduce((v,t)=>v.add(t.a).add(t.b).add(t.c),new Vector3()).multiplyScalar(1/(bottom.length*3));
  const ground=height(centre.x,centre.z);if(ground===undefined)throw new Error(`Foundation centre is over void: ${mesh.name}`);
  result.push({name:mesh.name,centre:centre.toArray(),ground,bottom:bottom.map(t=>[t.a,t.b,t.c])});
 });
 return result;
}
