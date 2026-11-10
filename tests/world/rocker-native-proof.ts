// UNUSED / UNRUN. Test-only attribution from actual source buffers into final
// merged native faces. No names/body-wide collision exemption.
import{Mesh,Matrix4,Vector3,Box3}from'three';
import{surfaceTriangles,type SurfaceTriangle}from'./surface-overlap';
import{triangleCrossing,visible,exposedOverlaps}from'./village-geometry';
import{pendulumIntersection}from'./pendulum-proof-geometry';
import type{VillageMachine}from'../../src/view/village-machine';
const key=(f:SurfaceTriangle)=>[f.a,f.b,f.c].map(p=>p.toArray().join('/')).sort().join('|');
export function rawRockerChecks(machine:VillageMachine,scene:import('three').Object3D,stop:number,angle:number){
 const b=machine.rockerInspection(stop),all=surfaceTriangles(scene).filter(f=>visible(f.mesh)),partMap=new Map<string,string>(),source=new Map<string,SurfaceTriangle[]>(),bounds=new Map<string,Box3>();
 for(const part of b.parts){const mesh=new Mesh(part.geometry);mesh.matrixAutoUpdate=false;mesh.matrix.copy((part.owner as import('three').Group).matrixWorld);mesh.matrixWorld.copy(mesh.matrix);const faces=surfaceTriangles(mesh);source.set(part.id,faces);const box=new Box3();for(const f of faces){partMap.set(key(f),part.id);box.union(f.bounds);}bounds.set(part.id,box);}
 const nativeKeys=new Set(all.map(key));for(const k of partMap.keys())if(!nativeKeys.has(k))throw new Error('Raw part face missing from final actual native geometry');
 const hardware=all.filter(f=>partMap.has(key(f))),foreign:unknown[]=[];const inverse=new Matrix4().copy(machine.root.matrixWorld).invert(),station=machine.plan.stations.find(s=>s.stop===stop)!;
 const joint=(a:SurfaceTriangle,c:SurfaceTriangle)=>{
  const ai=partMap.get(key(a)),ci=partMap.get(key(c));if(!ai||!ci)return false;
  const post=ai.startsWith('hinge-post')?ai:ci.startsWith('hinge-post')?ci:undefined,bar=post===ai?ci:ai;if(!post||!['hinge-pin','home-seat','dock-seat'].includes(bar))return false;
  const points=pendulumIntersection(a,c),box=bounds.get(post)!;if(points.length!==2)return false;
  // Actual finite embedded intersections only; both endpoints must also be on
  // the declared bar's current triangles. No whole-rigid-composite exemption.
  return points.every(p=>{if(!box.containsPoint(p))return false;const q=p.clone().applyMatrix4(inverse).sub(new Vector3(...station.anchor));return post==='hinge-post-neg'?q.z>=-.61&&q.z<=-.52:q.z>=.52&&q.z<=.61;});
 };
 for(const a of hardware)for(const c of all){if(key(a)===key(c)||!a.bounds.intersectsBox(c.bounds))continue;const crossing=triangleCrossing(a,c,128*Number.EPSILON*Math.max(1,a.a.length(),c.a.length()));if(crossing&&!joint(a,c))foreign.push({a:partMap.get(key(a)),b:c.mesh.name,point:crossing,angle});}
 // Ground/seat zero-dimensional endpoint packing requires a separate exact
 // finite phase/anchor patch certificate; no blanket exception is installed.
 // A native run may fail here until those witnessed patches are integrated.
 const exposed=exposedOverlaps(all).filter(p=>partMap.has(key(p.a))||partMap.has(key(p.b)));
 return{foreign,exposed,hardware,source};
}
