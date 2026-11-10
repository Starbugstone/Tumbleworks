// G-R scope: immutable factoring with mandatory CURRENT raw parity.
import type{CaptiveJoints}from'./captive-joint-probe';
import{retainedEndpointWeld}from'./village-profile-joints';
import {Box3,Mesh,Ray,Vector3,type Object3D} from 'three';
import {surfaceTriangles,coplanarOverlap,type SurfaceTriangle,type SurfaceOverlap} from './surface-overlap';
import {triangleCrossing,exposedOverlaps,visible} from './village-geometry';
class Index {
 private readonly cells=new Map<string,SurfaceTriangle[]>();
 constructor(faces:readonly SurfaceTriangle[]){for(const face of faces)this.cellsFor(face.bounds,key=>{const rows=this.cells.get(key);if(rows)rows.push(face);else this.cells.set(key,[face]);});}
 private cellsFor(bounds:Box3,visit:(key:string)=>void){for(let x=Math.floor(bounds.min.x/2);x<=Math.floor(bounds.max.x/2);x++)for(let y=Math.floor(bounds.min.y/2);y<=Math.floor(bounds.max.y/2);y++)for(let z=Math.floor(bounds.min.z/2);z<=Math.floor(bounds.max.z/2);z++)visit(`${x}/${y}/${z}`);}
 nearby(face:SurfaceTriangle){const result=new Set<SurfaceTriangle>();this.cellsFor(face.bounds,key=>{for(const row of this.cells.get(key)??[])result.add(row);});return result;}
}
const track=(f:SurfaceTriangle)=>f.mesh.name.startsWith('village-track-');
const observation=(o:SurfaceOverlap)=>({a:o.a.mesh.name,b:o.b.mesh.name,point:o.point.toArray(),area:o.area});
const crossing=(a:SurfaceTriangle,b:SurfaceTriangle)=>({a:a.mesh.name,b:b.mesh.name,indices:[a.index,b.index],points:[a.a,a.b,a.c,b.a,b.b,b.c].map(p=>p.toArray())});
export class RayTree {
 private readonly bounds=new Box3();private readonly children:RayTree[]=[];private readonly faces:readonly SurfaceTriangle[];
 constructor(faces:readonly SurfaceTriangle[]){this.faces=faces;for(const face of faces)this.bounds.union(face.bounds);if(faces.length){const magnitude=Math.max(1,...this.bounds.min.toArray().map(Math.abs),...this.bounds.max.toArray().map(Math.abs));this.bounds.expandByScalar(64*Number.EPSILON*magnitude);}if(faces.length>16){const size=this.bounds.getSize(new Vector3()),axis=size.x>=size.y&&size.x>=size.z?0:size.y>=size.z?1:2;const sorted=[...faces].sort((a,b)=>a.bounds.min.getComponent(axis)+a.bounds.max.getComponent(axis)-b.bounds.min.getComponent(axis)-b.bounds.max.getComponent(axis));const middle=sorted.length>>>1;this.children.push(new RayTree(sorted.slice(0,middle)),new RayTree(sorted.slice(middle)));}}
 private hit(ray:Ray):boolean{if(!ray.intersectBox(this.bounds,new Vector3()))return false;if(this.children.length)return this.children.some(child=>child.hit(ray));return this.faces.some(face=>{const hit=ray.intersectTriangle(face.a,face.b,face.c,false,new Vector3());return hit!==null&&hit.distanceTo(ray.origin)>.0001;});}
 blocked(point:Vector3,normal:Vector3){return this.hit(new Ray(point.clone().addScaledVector(normal,.0001),normal));}
}
function openPoints(overlap:SurfaceOverlap,tree:RayTree){return [overlap.point,...overlap.polygon.map(p=>p.clone().lerp(overlap.point,.05))].filter(point=>!tree.blocked(point,overlap.a.normal));}
export class MotionAudit {
 readonly fixed:SurfaceTriangle[]=[];
 readonly moving:SurfaceTriangle[]=[];
 readonly fixedOpen:{overlap:SurfaceOverlap;points:Vector3[]}[]=[];
 private readonly fixedIndex:Index;
 private readonly previous=new Map<Mesh,number[]>();
 private readonly changed=new Set<Mesh>();
 private widthPrevious:ReturnType<typeof crossing>[]=[];
 private exposedPrevious:ReturnType<typeof observation>[]=[];
 private widthChecked=false;private exposedChecked=false;
 private pending=false;private widthConsumed=true;private exposedConsumed=true;
 private readonly overlaps=new Map<string,{overlap:SurfaceOverlap;points:Vector3[]}>();
 private readonly fixedTree:RayTree;
 private readonly meshes:{mesh:Mesh;matrix:number[];geometry:Mesh['geometry'];version:number;index:Mesh['geometry']['index'];indexVersion:number}[]=[];
 private readonly dynamic:{mesh:Mesh;geometry:Mesh['geometry'];positionVersion:number;index:Mesh['geometry']['index'];indexVersion:number;faces:{surface:SurfaceTriangle;local:readonly Vector3[]}[]}[]=[];
 constructor(readonly root:Object3D,moverNames:Set<string>,excluded?:Mesh,private readonly returns=new Set<Mesh>(),private readonly joints?:CaptiveJoints){
 root.updateWorldMatrix(true,true);
 root.traverse(o=>{if(!(o instanceof Mesh)||o===excluded||!visible(o))return;let moving=false;for(let p:Object3D|null=o;p;p=p.parent)if(moverNames.has(p.name))moving=true;
 if(!moving){this.fixed.push(...surfaceTriangles(o));this.meshes.push({mesh:o,matrix:o.matrixWorld.toArray(),geometry:o.geometry,version:o.geometry.getAttribute('position').version,index:o.geometry.index,indexVersion:o.geometry.index?.version??0});return;}
 const positions=o.geometry.getAttribute('position'),indices=o.geometry.index,faces=[];
 for(let i=0;i<(indices?.count??positions.count);i+=3){const local=[0,1,2].map(k=>new Vector3().fromBufferAttribute(positions,indices?indices.getX(i+k):i+k));const[a,b,c]=local.map(p=>p.clone().applyMatrix4(o.matrixWorld)) as [Vector3,Vector3,Vector3],normal=b.clone().sub(a).cross(c.clone().sub(a));if(normal.lengthSq()<1e-20)continue;
 const surface={a,b,c,normal:normal.normalize(),bounds:new Box3().setFromPoints([a,b,c]),mesh:o,index:i/3};faces.push({surface,local});this.moving.push(surface);}
 this.dynamic.push({mesh:o,geometry:o.geometry,positionVersion:o.geometry.getAttribute('position').version,index:o.geometry.index,indexVersion:o.geometry.index?.version??0,faces});this.previous.set(o,o.matrixWorld.toArray());});
 this.fixedIndex=new Index(this.fixed);this.fixedTree=new RayTree(this.fixed);
 for(const overlap of exposedOverlaps(this.fixed)){const points=openPoints(overlap,this.fixedTree);if(points.length)this.fixedOpen.push({overlap,points});}
 }
 update(){
 if(this.pending&&(!this.widthConsumed||!this.exposedConsumed))throw new Error('Both geometry guards must consume each update before another pose');
 this.pending=true;this.widthConsumed=false;this.exposedConsumed=false;this.changed.clear();
 this.root.updateWorldMatrix(true,true);
 for(const{mesh,matrix,geometry,version,index,indexVersion}of this.meshes){if(!visible(mesh)||mesh.geometry!==geometry||mesh.geometry.index!==index||(mesh.geometry.index?.version??0)!==indexVersion||(mesh.geometry.getAttribute('position') as import('three').BufferAttribute).version!==version||mesh.matrixWorld.elements.some((n,i)=>n!==matrix[i]))throw new Error(`Static factoring invariant changed: ${mesh.name}`);}
 for(const{mesh,geometry,positionVersion,index,indexVersion,faces}of this.dynamic){if(mesh.geometry!==geometry||(mesh.geometry.getAttribute('position') as import('three').BufferAttribute).version!==positionVersion||mesh.geometry.index!==index||(mesh.geometry.index?.version??0)!==indexVersion)throw new Error(`Dynamic geometry invariant changed: ${mesh.name}`);if(!visible(mesh))throw new Error(`Moving visibility changed: ${mesh.name}`);const previous=this.previous.get(mesh)!;if(mesh.matrixWorld.elements.every((n,i)=>n===previous[i]))continue;this.changed.add(mesh);this.previous.set(mesh,mesh.matrixWorld.toArray());for(const{surface:f,local}of faces){f.a.copy(local[0]!).applyMatrix4(mesh.matrixWorld);f.b.copy(local[1]!).applyMatrix4(mesh.matrixWorld);f.c.copy(local[2]!).applyMatrix4(mesh.matrixWorld);f.normal.subVectors(f.b,f.a).cross(new Vector3().subVectors(f.c,f.a));if(f.normal.lengthSq()<1e-20)throw new Error('Moving triangle became degenerate');f.normal.normalize();f.bounds.setFromPoints([f.a,f.b,f.c]);}}
 }
 private affected(f:SurfaceTriangle){return track(f)||this.returns.has(f.mesh);}
 private pair(a:SurfaceTriangle,b:SurfaceTriangle){return track(a)||track(b)||(this.returns.has(a.mesh)||this.returns.has(b.mesh))&&!retainedEndpointWeld(a,b);}
 width(){this.widthConsumed=true;if(this.widthChecked&&!this.changed.size)return this.widthPrevious;
 const all=!this.widthChecked||this.widthPrevious.length>0,failures:ReturnType<typeof crossing>[]=[];const dynamicIndex=new Index(this.moving);
 for(const a of this.moving){if(all||this.changed.has(a.mesh))for(const b of this.fixedIndex.nearby(a))if(this.pair(a,b)&&(triangleCrossing(a,b)||triangleCrossing(b,a))&&!this.joints?.allows(a,b))failures.push(crossing(a,b));if(this.affected(a))for(const b of dynamicIndex.nearby(a))if(a!==b&&this.pair(a,b)&&(all||this.changed.has(a.mesh)||this.changed.has(b.mesh))&&(triangleCrossing(a,b)||triangleCrossing(b,a))&&!this.joints?.allows(a,b))failures.push(crossing(a,b));}
 this.widthChecked=true;this.widthPrevious=failures;return failures;}
 exposed(){this.exposedConsumed=true;if(this.exposedChecked&&!this.changed.size)return this.exposedPrevious;
 const failures:ReturnType<typeof observation>[]=[],movingTree=new RayTree(this.moving),dynamicIndex=new Index(this.moving),seen=new Set<SurfaceTriangle>(),all=!this.exposedChecked;
 for(const[key,value]of this.overlaps)if(this.changed.has(value.overlap.a.mesh)||this.changed.has(value.overlap.b.mesh))this.overlaps.delete(key);
 const inspect=(a:SurfaceTriangle,b:SurfaceTriangle)=>{const overlap=coplanarOverlap(a,b);if(!overlap)return;const points=openPoints(overlap,this.fixedTree);if(points.length)this.overlaps.set([`${a.mesh.id}/${a.index}`,`${b.mesh.id}/${b.index}`].sort().join('|'),{overlap,points});};
 for(const a of this.moving){if(all||this.changed.has(a.mesh))for(const b of this.fixedIndex.nearby(a))inspect(a,b);for(const b of dynamicIndex.nearby(a))if(a!==b&&!seen.has(b)&&(all||this.changed.has(a.mesh)||this.changed.has(b.mesh)))inspect(a,b);seen.add(a);}
 for(const{overlap,points}of[...this.fixedOpen,...this.overlaps.values()])if(points.some(point=>!movingTree.blocked(point,overlap.a.normal)))failures.push(observation(overlap));
 this.exposedChecked=true;this.exposedPrevious=failures;return failures;}
 all(){return[...this.fixed,...this.moving];}
}
