import {afterAll,expect,it,vi} from 'vitest';
import {Mesh,MeshBasicMaterial,Vector3,Line3,Triangle,Matrix4,Box3} from 'three';
import {mkdirSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import * as live from '../../src/view/machine-primitives';
import {villageBearingCap as referenceCap} from './fixtures/village-cap-reference';
import {straight,turn} from '../../src/world/villages/author';
import type {VillagePort,VillageProfile} from '../../src/world/village-plan';
import {surfaceTriangles,type SurfaceTriangle} from './surface-overlap';
import {villageWorld} from './village-world-fixture';
import {trackCrossings} from './village-geometry';

const material=new MeshBasicMaterial();
afterAll(()=>material.dispose());
function surfaces(geometry:import('three').BufferGeometry){return surfaceTriangles(new Mesh(geometry,material));}
function area(face:SurfaceTriangle){return new Triangle(face.a,face.b,face.c).getArea();}
// Float32 world vertices on a rotated, constructed cap side can give a very
// thin triangle a noisy normal. Recover only the four known clipping planes
// and the constructed horizontal bottom in the cap's local basis. This does
// not infer planarity from a roof's shape or project any roof interior.
function constructionSurfaces(geometry:import('three').BufferGeometry,frame:VillagePort,centre:readonly number[]){
 const yaw=Math.atan2(-frame.tangent[2],frame.tangent[0]);
 const matrix=new Matrix4().makeRotationY(-yaw).multiply(new Matrix4().makeTranslation(-centre[0]!,0,-centre[2]!));
 const raw=surfaces(geometry),bottom=geometry.boundingBox!.min.y;
 const rounding=Math.max(1,...raw.flatMap(f=>[f.a,f.b,f.c].flatMap(p=>p.toArray().map(Math.abs))))*2**-23;
 return raw.map(face=>{
 const points=[face.a,face.b,face.c].map(p=>p.clone().applyMatrix4(matrix));
 const normal=face.normal.clone().transformDirection(matrix);
 for(const [axis,limit]of [[0,-.13],[0,.13],[2,-.56],[2,.56],[1,bottom]] as const){
 if(Math.abs(normal.getComponent(axis))>.99&&points.every(p=>Math.abs(p.getComponent(axis)-limit)<=rounding))for(const p of points)p.setComponent(axis,limit);
 }
 const[a,b,c]=points as [Vector3,Vector3,Vector3];
 return {...face,a,b,c,normal:b.clone().sub(a).cross(c.clone().sub(a)).normalize(),bounds:new Box3().setFromPoints(points)};
 });
}
// Integrate triangle intersections in double precision, in both directions.
function overlap(face:SurfaceTriangle,other:SurfaceTriangle){
 if(face.normal.dot(other.normal)<1-1e-8||[other.a,other.b,other.c].some(p=>Math.abs(p.clone().sub(face.a).dot(face.normal))>1e-6))return 0;
 const axis=face.normal.toArray().map(Math.abs).indexOf(Math.max(...face.normal.toArray().map(Math.abs)));
 const[u,v]=axis===0?[1,2]:axis===1?[0,2]:[0,1];
 const point=(p:Vector3)=>[p.getComponent(u!),p.getComponent(v!)] as const;
 const clip=[other.a,other.b,other.c].map(point);let polygon=[face.a,face.b,face.c].map(point);
 const cross=(a:readonly number[],b:readonly number[],p:readonly number[]) =>(b[0]!-a[0]!)*(p[1]!-a[1]!)-(b[1]!-a[1]!)*(p[0]!-a[0]!);
 const sign=Math.sign(cross(clip[0]!,clip[1]!,clip[2]!));
 for(let i=0;i<3&&polygon.length;i++){
 const a=clip[i]!,b=clip[(i+1)%3]!,next:typeof polygon=[];
 for(let j=0;j<polygon.length;j++){
 const p=polygon[j]!,q=polygon[(j+1)%polygon.length]!,dp=sign*cross(a,b,p),dq=sign*cross(a,b,q);
 if(dp>=-1e-14)next.push(p);
 if((dp>=-1e-14)!==(dq>=-1e-14)){const t=dp/(dp-dq);next.push([p[0]+(q[0]-p[0])*t,p[1]+(q[1]-p[1])*t]);}
 }polygon=next;
 }
 return Math.abs(polygon.reduce((s,p,i)=>s+p[0]*polygon[(i+1)%polygon.length]![1]-p[1]*polygon[(i+1)%polygon.length]![0],0))/2/Math.abs(face.normal.getComponent(axis));
}
function coverage(a:readonly SurfaceTriangle[],b:readonly SurfaceTriangle[]){
 for(const face of a){const covered=b.reduce((sum,other)=>sum+overlap(face,other),0);
 expect(Math.abs(covered-area(face)),'same oriented surface coverage and area').toBeLessThan(2e-6);}
}
function creases(faces:readonly SurfaceTriangle[]){
 const key=(p:Vector3)=>p.toArray().map(x=>x.toFixed(6)).join('/');
 const edges=new Map<string,{a:Vector3;b:Vector3;normals:Vector3[]}>();
 for(const f of faces)for(const[a,b]of[[f.a,f.b],[f.b,f.c],[f.c,f.a]]){
 const id=[key(a!),key(b!)].sort().join('|'),old=edges.get(id);
 if(old)old.normals.push(f.normal);else edges.set(id,{a:a!,b:b!,normals:[f.normal]});}
 return [...edges.values()].filter(e=>e.normals.length===1||e.normals.some(n=>e.normals.some(m=>n.dot(m)<1-1e-6)));
}
function sameBoundary(a:readonly SurfaceTriangle[],b:readonly SurfaceTriangle[]){
 const edges=creases(b);for(const edge of creases(a))for(const p of[edge.a,edge.b,edge.a.clone().lerp(edge.b,.5)]){
 let nearest=Infinity;for(const other of edges)nearest=Math.min(nearest,new Line3(other.a,other.b).closestPointToPoint(p,true,new Vector3()).distanceTo(p));
 expect(nearest,'sharp/profile and hole boundary preserved').toBeLessThan(3e-6);}
}
const graded=turn([0,4,0],2,0,Math.PI/3,-.3,48);
const banked=graded.map(p=>({...p,normal:new Vector3(...p.normal).applyAxisAngle(new Vector3(...p.tangent),.3).toArray() as [number,number,number]}));
const fixtures:[string,readonly VillagePort[]][]=[['flat',straight([-2,4,0],[2,4,0],32)],['curve',turn([0,4,0],2,0,Math.PI/3,0,48)],['grade-bank',banked],['width-transition',graded.map((p,i)=>({...p,width:.8+.1*i/(graded.length-1)}))]];
for(const profile of ['plank','terracotta','timber','twinrail','girder','steel'] satisfies VillageProfile[])for(const[label,points]of fixtures){
 it(`${profile} ${label}: exact planar cap compaction retains surfaces, holes, winding and sharp edges`,()=>{
 const frame=points[Math.floor(points.length/2)]!,centre=frame.position;
 const a=referenceCap(points,profile,frame,centre),b=live.villageBearingCap(points,profile,frame,centre);
 const cb=live.villageChannelGeometry(points,profile);
 try{const before=constructionSurfaces(a,frame,centre),after=constructionSurfaces(b,frame,centre);coverage(after,before);coverage(before,after);sameBoundary(before,after);sameBoundary(after,before);
 expect(b.getAttribute('position').count).toBeLessThanOrEqual(a.getAttribute('position').count);
 const track=surfaces(cb);for(const cap of [surfaces(a),surfaces(b)]){expect(trackCrossings(cap,track),'cap floor/wall contact has no interior crossing').toEqual([]);for(const p of points){
 const centre=new Vector3(...p.position);let closest=Infinity;
 for(const face of cap)closest=Math.min(closest,new Triangle(face.a,face.b,face.c).closestPointToPoint(centre,new Vector3()).distanceTo(centre));
 expect(closest,'cap remains outside the rolling sphere').toBeGreaterThanOrEqual(.3-1e-6);
 }}expect(track.length).toBeGreaterThan(0);
 }finally{a.dispose();b.dispose();cb.dispose();}
 });
}
it('rejects treating a deliberately bent roof as a plane while compacting only its real planar bottom',()=>{
 const flat=straight([-1,4,0],[1,4,0],32),warped=flat.map((p,i)=>({...p,position:[p.position[0],p.position[1]+(i===16?.003:0),p.position[2]] as const}));
 const frame=warped[16]!,reference=referenceCap(warped,'terracotta',frame,frame.position),actual=live.villageBearingCap(warped,'terracotta',frame,frame.position),bad=live.villageBearingCap(flat,'terracotta',flat[16]!,frame.position);
 try{const before=constructionSurfaces(reference,frame,frame.position),after=constructionSurfaces(actual,frame,frame.position);coverage(before,after);coverage(after,before);expect(()=>coverage(before,constructionSurfaces(bad,frame,frame.position))).toThrow();
 expect(actual.boundingBox!.max.y).toBe(reference.boundingBox!.max.y);
 }finally{reference.dispose();actual.dispose();bad.dispose();}
});
it('records alternating same-scene constructor costs and exact triangle attribution without changing route input',()=>{
 const rows:{reference:boolean;constructorMs:number;mapTriangles:number;duration:number;routeFingerprint:string}[]=[];
 for(let i=0;i<6;i++){
 const reference=i%2===0;const spy=reference?vi.spyOn(live,'villageBearingCap').mockImplementation(referenceCap):null;
 const started=performance.now();const{world,probe,dispose}=villageWorld(1);const constructorMs=performance.now()-started;
 try{let count=0;world.scene.traverse(o=>{if(o instanceof Mesh){for(let p:import('three').Object3D|null=o;p;p=p.parent)if(!p.visible)return;count+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;}});
 const route=probe.machine.route,point=new Vector3(),normal=new Vector3(),samples=[];
 for(let frame=0;frame<=Math.ceil(route.duration*120);frame++){const time=Math.min(route.duration,frame/120);route.sample(time,point);route.normalAt(time,normal);samples.push([time,...point.toArray(),...normal.toArray()]);}
 const routeFingerprint=createHash('sha256').update(JSON.stringify({duration:route.duration,contacts:route.contacts,transfers:route.transfers,samples})).digest('hex');
 rows.push({reference,constructorMs,mapTriangles:count,duration:route.duration,routeFingerprint});
 }finally{dispose();spy?.mockRestore();}
 }
 const label=process.env['CAP_COMPARISON_LABEL'];if(label){const directory='output/current/village-layouts/gardens-finalize';mkdirSync(directory,{recursive:true});writeFileSync(`${directory}/cap-compaction-constructor-${label}.json`,JSON.stringify(rows,null,2),{flag:'wx'});}
 expect(rows.every(r=>r.duration===rows[0]!.duration&&r.routeFingerprint===rows[0]!.routeFingerprint)).toBe(true);
 expect(rows[1]!.mapTriangles).toBeLessThan(rows[0]!.mapTriangles);
});
