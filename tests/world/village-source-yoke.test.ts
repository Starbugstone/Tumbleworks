import {expect,it} from 'vitest';
import {Box3,BoxGeometry,Mesh,MeshBasicMaterial,Ray,Triangle,Vector3} from 'three';
import {villageWorld} from './village-world-fixture';
import {surfaceTriangles} from './surface-overlap';
import {trackCrossings} from './village-geometry';
it.each([9,5,1])('retains actual deck/portal/guide connections throughout stop %s travel',stop=>{
 const {world,probe,dispose}=villageWorld(1,true);
 try{
 const station=probe.plan.stations.find(s=>s.stop===stop)!;const mechanism=station.mechanism;if(!('travel'in mechanism)||typeof mechanism.travel==='number')throw new Error('Expected travel frame');const vertical=mechanism.travel[0]===0&&mechanism.travel[2]===0;
 const times=new Set([0,probe.machine.route.contacts.find(c=>c.stop===stop)!.contact]);for(const p of probe.machine.route.transfers.filter(p=>p.stop===stop))for(const f of [0,.25,.5,.75,1])times.add(p.start+(p.end-p.start)*f);
 for(const reduced of [false,true])for(const time of times){world.film(time,!reduced);const carrier=world.scene.getObjectByName(`village-${stop}-carrier`)!;
 const faces=surfaceTriangles(carrier),bound=new Box3(),whole=new Box3(),before=carrier.matrix.toArray();probe.machine.contactBounds(stop,bound);probe.machine.bounds(whole);expect(carrier.matrix.toArray()).toEqual(before);
 for(const f of faces)for(const p of [f.a,f.b,f.c]){expect(bound.containsPoint(p)).toBe(true);expect(whole.containsPoint(p)).toBe(true);}
 if(!vertical){const inverse=carrier.matrixWorld.clone().invert(),allFaces=surfaceTriangles(world.scene);
 const shoeMeshes=new Set(faces.filter(f=>{
  const a=f.mesh.geometry.getAttribute('position');let lo=Infinity,hi=-Infinity;for(let i=0;i<a.count;i++){lo=Math.min(lo,a.getY(i));hi=Math.max(hi,a.getY(i));}return Math.abs(lo-1.75)<1e-7&&hi>1.8;
 }).map(f=>f.mesh));expect(shoeMeshes.size).toBe(1);
 const roof=faces.filter(f=>shoeMeshes.has(f.mesh)&&[f.a,f.b,f.c].every(p=>p.clone().applyMatrix4(inverse).y>1.750001));expect(roof.length).toBe(2);
 for(const face of roof){const p=face.a.clone().add(face.b).add(face.c).divideScalar(3);expect(allFaces.some(f=>!shoeMeshes.has(f.mesh)&&f.normal.dot(face.normal)<-.999&&new Triangle(f.a,f.b,f.c).closestPointToPoint(p,new Vector3()).distanceTo(p)<1e-6)).toBe(true);}
 }else{
 const guideCentre=new Vector3(0,1.7,-1.2).applyMatrix4(carrier.matrixWorld),post=world.scene.getObjectByName(`village-rim-post-${stop}`)!;expect(post).toBeDefined();expect(new Box3().setFromObject(post).containsPoint(guideCentre)).toBe(true);
 const collars=new Set(faces.filter(f=>{f.mesh.geometry.computeBoundingBox();const b=f.mesh.geometry.boundingBox!;return Math.abs(b.min.y-1.61)<1e-6&&Math.abs(b.max.y-1.79)<1e-6&&b.max.z< -1;}).map(f=>f.mesh));expect(collars.size).toBe(4);
 expect(trackCrossings(faces.filter(f=>collars.has(f.mesh)),surfaceTriangles(post))).toEqual([]);
 const weld=new Vector3(0,1.7,-1.08);expect(new Set(faces.filter(f=>{f.mesh.geometry.computeBoundingBox();return f.mesh.geometry.type==='BoxGeometry'&&f.mesh.geometry.boundingBox!.containsPoint(weld);}).map(f=>f.mesh)).size).toBeGreaterThanOrEqual(2);
 }
 for(const local of [[0,-.4,0],[0,-.44,-.6],[0,1.65,-.65],...(!vertical?[[0,1.75,-.65]]:[])]){
 const p=new Vector3(...local as [number,number,number]).applyMatrix4(carrier.matrixWorld);
 const touching=faces.filter(f=>new Triangle(f.a,f.b,f.c).closestPointToPoint(p,new Vector3()).distanceTo(p)<1e-7);
 expect(new Set(touching.map(f=>f.mesh)).size,JSON.stringify({time,local})).toBeGreaterThanOrEqual(2);
 expect(touching.some(a=>touching.some(b=>a.mesh!==b.mesh&&a.normal.dot(b.normal)<-.999))).toBe(true);
 }
 }
 }finally{dispose();}
});
it.each([9,5,1])('rejects the original foreign front upright of stop %s',stop=>{
 const {world,probe,dispose}=villageWorld(1,true);
 try{const carry=probe.machine.route.transfers.find(p=>p.stop===stop&&p.kind==='carry')!;world.film(stop===9?.9:(carry.start+carry.end)/2);const centre=new Vector3();probe.machine.sample(stop===9?.9:(carry.start+carry.end)/2,centre);const view=centre.clone().sub(world.camera.position),distance=view.length();view.normalize();const right=view.clone().cross(world.camera.up).normalize(),up=right.clone().cross(view).normalize();
 const carrier=world.scene.getObjectByName(`village-${stop}-carrier`)!;const old=new Mesh(new BoxGeometry(.08,2.13,.08).translate(0,.585,.64),new MeshBasicMaterial());carrier.add(old);world.scene.updateMatrixWorld(true);let hits=0;
 for(let i=0;i<16;i++){const r=.3*Math.sqrt(1-.09/distance**2),target=centre.clone().addScaledVector(view,-.09/distance).addScaledVector(right,r*Math.cos(i*Math.PI/8)).addScaledVector(up,r*Math.sin(i*Math.PI/8));const ray=new Ray(world.camera.position,target.clone().sub(world.camera.position).normalize());
 hits+=surfaceTriangles(old).filter(f=>{const hit=ray.intersectTriangle(f.a,f.b,f.c,false,new Vector3());return hit&&hit.distanceTo(world.camera.position)<target.distanceTo(world.camera.position)-.002;}).length;}
 expect(hits).toBeGreaterThan(0);carrier.remove(old);old.geometry.dispose();(old.material as MeshBasicMaterial).dispose();
 }finally{dispose();}
});
it.each([9,5,1].flatMap(stop=>[false,true].map(reduced=>({stop,reduced}))))('checks rear cantilever $stop against every solid at120Hz (reduced=$reduced)',({stop,reduced})=>{
 const{world,probe,dispose}=villageWorld(1,true);try{const contact=probe.machine.route.contacts.find(c=>c.stop===stop)!,start=stop===9?0:contact.start,end=contact.end;
 for(let i=0;i<=Math.ceil((end-start)*120);i++){const time=Math.min(end,start+i/120);world.film(time,!reduced);const faces=surfaceTriangles(world.scene).filter(f=>f.mesh!==probe.marble?.mesh),portal=faces.filter(f=>f.mesh.name===`village-rim-yoke-${stop}`);expect(portal.length).toBeGreaterThan(0);const hits=trackCrossings(portal,faces);if(hits.length)console.log(JSON.stringify({time,reduced,hits}));expect(hits,`time ${time}`).toEqual([]);}
 }finally{dispose();}
},180000);
