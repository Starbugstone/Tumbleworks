import{Box3,Mesh,Ray,Triangle,Vector3}from'three';import type{SurfaceTriangle}from'./surface-overlap';
/** Same2mm physical boundary convention as the existing triangle/sphere guards.
 * No expanded design-margin box participates in containment. */
const boundary=.002;
class Tree{
 readonly box=new Box3();readonly children:Tree[]=[];
 constructor(readonly faces:readonly SurfaceTriangle[]){for(const f of faces)this.box.union(f.bounds);if(faces.length>20){const s=this.box.getSize(new Vector3()),axis=s.x>s.y&&s.x>s.z?0:s.y>s.z?1:2,ordered=[...faces].sort((a,b)=>a.bounds.min.getComponent(axis)+a.bounds.max.getComponent(axis)-b.bounds.min.getComponent(axis)-b.bounds.max.getComponent(axis)),mid=ordered.length>>>1;this.children=[new Tree(ordered.slice(0,mid)),new Tree(ordered.slice(mid))];}}
 near(p:Vector3):boolean{if(this.box.distanceToPoint(p)>boundary)return false;if(this.children.length)return this.children.some(t=>t.near(p));return this.faces.some(f=>new Triangle(f.a,f.b,f.c).closestPointToPoint(p,new Vector3()).distanceTo(p)<=boundary);}
 hits(ray:Ray,out:Set<number>){if(!ray.intersectBox(this.box,new Vector3()))return;if(this.children.length){for(const t of this.children)t.hits(ray,out);return;}for(const f of this.faces){const p=ray.intersectTriangle(f.a,f.b,f.c,false,new Vector3());if(p)out.add(p.distanceTo(ray.origin));}}
 inside(p:Vector3):boolean|'unknown'{if(!this.box.containsPoint(p)||this.near(p))return false;const parity=[new Vector3(1,.371,.529),new Vector3(-.313,1,.719),new Vector3(.681,.577,-1)].map(d=>{const hits=new Set<number>();this.hits(new Ray(p,d.normalize()),hits);return hits.size%2;});return parity.every(x=>x===1)?true:parity.every(x=>x===0)?false:'unknown';}
}
interface Body{mesh:Mesh;faces:SurfaceTriangle[];matrix:number[];tree:Tree;vertices:Vector3[]}
export class SourceContainment{
 private readonly bodies:Body[]=[];private readonly pairs=new Map<string,unknown>();
 constructor(faces:readonly SurfaceTriangle[],readonly source:ReadonlySet<Mesh>){const grouped=new Map<Mesh,SurfaceTriangle[]>();for(const f of faces){const fs=grouped.get(f.mesh)??[];fs.push(f);grouped.set(f.mesh,fs);}for(const[mesh,fs]of grouped)this.bodies.push(this.body(mesh,fs));}
 private body(mesh:Mesh,faces:SurfaceTriangle[]):Body{const points=new Map<string,Vector3>();for(const f of faces)for(const p of[f.a,f.b,f.c])points.set(p.toArray().join(','),p);return{mesh,faces,matrix:mesh.matrixWorld.toArray(),tree:new Tree(faces),vertices:[...points.values()]};}
 check(){const changed=new Set<Mesh>();for(let i=0;i<this.bodies.length;i++){const b=this.bodies[i]!;if(b.matrix.some((v,k)=>!Object.is(v,b.mesh.matrixWorld.elements[k]))){this.bodies[i]=this.body(b.mesh,b.faces);changed.add(b.mesh);}}
 const failures=[];for(const a of this.bodies.filter(b=>this.source.has(b.mesh)))for(const b of this.bodies){if(a===b)continue;const key=[a.mesh.id,b.mesh.id].sort().join('/');if(this.pairs.has(key)&&!changed.has(a.mesh)&&!changed.has(b.mesh)){const old=this.pairs.get(key);if(old)failures.push(old);continue;}let result:unknown;
 if(a.tree.box.intersectsBox(b.tree.box))for(const[container,other]of[[a,b],[b,a]]){for(const p of other!.vertices){if(!container!.tree.box.containsPoint(p))continue;const state=container!.tree.inside(p);if(state!==false){result={container:container!.mesh.name,other:other!.mesh.name,point:p.toArray(),state:state===true?'contained-solid':'unsupported-parity'};break;}}if(result)break;}
 this.pairs.set(key,result);if(result)failures.push(result);
 }return failures;}
}
