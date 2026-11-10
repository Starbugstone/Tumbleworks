// Reused native triangle index; film tests add no mesh-name visibility exemptions.
import { Box3, Mesh, Ray, Vector3 } from 'three';
import { surfaceTriangles, type SurfaceTriangle } from './surface-overlap';
import { visible } from './village-geometry';
interface Entry {mesh:Mesh;geometry:Mesh['geometry'];version:number;index:Mesh['geometry']['index'];indexVersion:number;matrix:number[];faces:{world:SurfaceTriangle;local:Vector3[]}[]}
export class NativeRayScene{
 readonly entries:Entry[]=[];readonly fixed:SurfaceTriangle[]=[];readonly moving:SurfaceTriangle[]=[];
 constructor(readonly root:import('three').Object3D,names:ReadonlySet<string>,excluded?:Mesh){root.updateWorldMatrix(true,true);root.traverse(o=>{if(!(o instanceof Mesh)||o===excluded||!visible(o))return;let moves=false;for(let p:import('three').Object3D|null=o;p;p=p.parent)if(names.has(p.name))moves=true;
 const world=surfaceTriangles(o);if(!moves){this.fixed.push(...world);this.entries.push({mesh:o,geometry:o.geometry,version:o.geometry.getAttribute('position').version,index:o.geometry.index,indexVersion:o.geometry.index?.version??0,matrix:o.matrixWorld.toArray(),faces:[]});return;}
 const inverse=o.matrixWorld.clone().invert(),faces=world.map(w=>({world:w,local:[w.a,w.b,w.c].map(p=>p.clone().applyMatrix4(inverse))}));
 // Read ORIGINAL local packed coordinates, rather than inverse-rounding world vertices.
 const p=o.geometry.getAttribute('position'),ix=o.geometry.index;for(const {world:w,local}of faces)for(let k=0;k<3;k++)local[k]!.fromBufferAttribute(p,ix?ix.getX(w.index*3+k):w.index*3+k);
 this.moving.push(...world);this.entries.push({mesh:o,geometry:o.geometry,version:p.version,index:ix,indexVersion:ix?.version??0,matrix:o.matrixWorld.toArray(),faces});});}
 update(){this.root.updateWorldMatrix(true,true);for(const e of this.entries){const m=e.mesh,p=m.geometry.getAttribute('position');if(!('version'in p))throw Error('Unsupported interleaved native position');if(!visible(m)||m.geometry!==e.geometry||p.version!==e.version||m.geometry.index!==e.index||(m.geometry.index?.version??0)!==e.indexVersion)throw Error('Native ray geometry invariant changed');if(m.matrixWorld.elements.every((v,i)=>Object.is(v,e.matrix[i])))continue;if(!e.faces.length)throw Error('Native ray fixed transform changed');e.matrix=m.matrixWorld.toArray();for(const{world:w,local}of e.faces){w.a.copy(local[0]!).applyMatrix4(m.matrixWorld);w.b.copy(local[1]!).applyMatrix4(m.matrixWorld);w.c.copy(local[2]!).applyMatrix4(m.matrixWorld);w.normal.subVectors(w.b,w.a).cross(new Vector3().subVectors(w.c,w.a)).normalize();w.bounds.setFromPoints([w.a,w.b,w.c]);}}}
 all(){return[...this.fixed,...this.moving];}
}
export class NativeRayTree{
 readonly bounds=new Box3();readonly children:NativeRayTree[]=[];
 constructor(readonly faces:readonly SurfaceTriangle[]){for(const f of faces)this.bounds.union(f.bounds);if(faces.length){const magnitude=Math.max(1,...this.bounds.min.toArray().map(Math.abs),...this.bounds.max.toArray().map(Math.abs));this.bounds.expandByScalar(64*Number.EPSILON*magnitude);}if(faces.length>16){const size=this.bounds.getSize(new Vector3()),axis=size.x>=size.y&&size.x>=size.z?0:size.y>=size.z?1:2,ordered=[...faces].sort((a,b)=>a.bounds.min.getComponent(axis)+a.bounds.max.getComponent(axis)-b.bounds.min.getComponent(axis)-b.bounds.max.getComponent(axis)),mid=ordered.length>>>1;this.children=[new NativeRayTree(ordered.slice(0,mid)),new NativeRayTree(ordered.slice(mid))];}}
 hits(ray:Ray,length:number,out:{face:SurfaceTriangle;point:Vector3;distance:number}[]=[]){if(!ray.intersectBox(this.bounds,new Vector3()))return out;if(this.children.length){for(const child of this.children)child.hits(ray,length,out);return out;}for(const face of this.faces){const point=ray.intersectTriangle(face.a,face.b,face.c,false,new Vector3());if(!point)continue;const distance=point.distanceTo(ray.origin);if(distance<length)out.push({face,point,distance});}return out;}
}
