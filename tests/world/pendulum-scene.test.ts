import{Box3,Mesh,Vector3}from'three';
import {readFileSync,writeFileSync} from 'node:fs';
import {expect,it} from 'vitest';
import {compileTerrain,terrainHeightAt} from '../../src/world/village-terrain';
import {pendulumParts} from '../../src/view/pendulum-parts';
import {footingHeight} from '../../src/world/pendulum-support';
import {actualFootPatch} from './pendulum-feet';
import {villageScenePlan} from '../../src/world/village-plans';
import {villageWorld} from './village-world-fixture';
import {surfaceTriangles} from './surface-overlap';
import {exposedOverlaps,triangleCrossing,visible} from './village-geometry';

it('Mill data migration preserves every scene field outside its one strikerDrive object',()=>{
 const before=JSON.parse(readFileSync('output/current/village-layouts/parallel44/kernel/pendulum-live/mill-plan-before.json','utf8'));
 const after=JSON.parse(JSON.stringify(villageScenePlan(2)));
 const a=after.plan.stations.find((s:{stop:number})=>s.stop===7),b=before.plan.stations.find((s:{stop:number})=>s.stop===7);
 expect(a.strikerDrive).toMatchObject({kind:'pendulum',mass:b.strikerDrive.mass,legacyGuideWork:{friction:b.strikerDrive.friction,stroke:b.strikerDrive.stroke}});
 a.strikerDrive=b.strikerDrive;expect(after).toEqual(before);
});
it('cheap actual Mill new assembly rest and intermediate poses expose every foreign solid crossing',()=>{
 const f=villageWorld(2,true),reports:unknown[]=[],swept=new Box3();
 try{
  const d=villageScenePlan(2).plan.stations.find(s=>s.stop===7)!.strikerDrive!;if(d.kind!=='pendulum')throw new Error('Actual new drive required');
  const mover=f.probe.machine.root.getObjectByName('village-7-striker')!,fixed=f.probe.machine.groups[7]!.children.find(o=>o.name.endsWith('-static'))!;
  const connectorIndex=fixed.children.findIndex(o=>o.name==='village-track-connector-7-6');expect(connectorIndex).toBeGreaterThan(0);const stationFixed=new Set(fixed.children.slice(0,connectorIndex));
  for(const q of [0,.35,.7]){
   mover.matrix.makeRotationZ(q).setPosition(...d.axle.origin);mover.matrixWorldNeedsUpdate=true;f.world.scene.updateMatrixWorld(true);
   const all=surfaceTriangles(f.world.scene).filter(s=>visible(s.mesh)&&s.mesh!==f.probe.marble?.mesh),hardware=all.filter(s=>s.mesh.userData.pendulumPart);
   const pairs=new Map<string,unknown>();
   for(const a of hardware)for(const b of all){if(a.mesh===b.mesh||!a.bounds.intersectsBox(b.bounds))continue;
    if(triangleCrossing(a,b)||triangleCrossing(b,a)){
     const key=[a.mesh.name,b.mesh.name].sort().join('/');if(!pairs.has(key))pairs.set(key,{a:a.mesh.name,b:b.mesh.name,aPart:a.mesh.userData.pendulumPart,bPart:b.mesh.userData.pendulumPart,point:a.a.toArray(),aTriangle:[a.a,a.b,a.c].map(v=>v.toArray()),bTriangle:[b.a,b.b,b.c].map(v=>v.toArray())});
    }
   }
   const bounds=new Box3();f.probe.machine.contactBounds(7,bounds);
   for(const face of all){let owned=false;for(let parent:import('three').Object3D|null=face.mesh;parent;parent=parent.parent)if(parent===mover||stationFixed.has(parent))owned=true;if(!owned)continue;for(const p of[face.a,face.b,face.c]){expect(bounds.containsPoint(p),face.mesh.name).toBe(true);swept.expandByPoint(p);}}
   reports.push({q,pairs:[...pairs.values()]});
  }
  // Independent dense angular envelope plus its analytic between-sample sag
  // bound. Contact bounds include the pre-existing deck/support and marble
  // radius, while outgoing connector parts belong to the whole-machine bounds.
  let maximumRadius=0;const p=new Vector3();
  mover.traverse(o=>{if(!(o instanceof Mesh))return;const a=o.geometry.getAttribute('position');for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i);maximumRadius=Math.max(maximumRadius,Math.hypot(x,y));for(let j=0;j<=1000;j++){const q=d.stopAngle*j/1000;swept.expandByPoint(p.set(d.axle.origin[0]+x*Math.cos(q)-y*Math.sin(q),d.axle.origin[1]+x*Math.sin(q)+y*Math.cos(q),d.axle.origin[2]+z));}}});
  const station=villageScenePlan(2).plan.stations.find(s=>s.stop===7)!;swept.expandByPoint(new Vector3(...station.entry.position)).expandByPoint(new Vector3(...station.exit.position)).expandByScalar(.3);
  const envelope=new Box3();f.probe.machine.contactBounds(7,envelope);const sag=maximumRadius*(d.stopAngle/1000)**2/8+128*Number.EPSILON*Math.max(1,envelope.max.length());
  for(let i=0;i<3;i++){expect(Math.abs(envelope.min.getComponent(i)-swept.min.getComponent(i))).toBeLessThanOrEqual(sag);expect(Math.abs(envelope.max.getComponent(i)-swept.max.getComponent(i))).toBeLessThanOrEqual(sag);}

  writeFileSync('output/current/village-layouts/parallel44/kernel/ks54/mill-cheap-geometry.json',JSON.stringify(reports,null,2));
  const foreign=reports.flatMap((r:any)=>r.pairs.filter((p:any)=>!p.aPart||!p.bPart));expect(foreign).toEqual([]);
  expect(reports.flatMap((r:any)=>r.pairs.filter((p:any)=>[p.aPart?.id,p.bPart?.id].sort().join('/')==='frame-cap/hammer-hub'))).toEqual([]);
 }finally{f.dispose();}
},120000);

it('actual Mill full foot rectangles cover real terrain triangle interiors and pure-plan buffers match Scene ground',()=>{
 const scene=villageScenePlan(2),station=scene.plan.stations.find(s=>s.stop===7)!,d=station.strikerDrive!;if(d.kind!=='pendulum')throw new Error('new drive required');
 const terrain=compileTerrain(scene.terrain),reports=d.footings.map(p=>actualFootPatch(terrain,p));
 for(const r of reports){expect(Math.abs(r.area-r.expectedArea)).toBeLessThan(128*Number.EPSILON);expect(r.maximumHeightError).toBe(0);expect(r.polygons.length).toBeGreaterThan(0);}
 const a=pendulumParts(station,d,(x,z)=>terrainHeightAt(terrain,x,z)),b=pendulumParts(station,d,(x,z)=>footingHeight(d,x,z));
 try{for(let i=0;i<a.parts.length;i++)expect(Array.from(a.parts[i]!.geometry.getAttribute('position').array)).toEqual(Array.from(b.parts[i]!.geometry.getAttribute('position').array));}
 finally{a.parts.forEach(p=>p.geometry.dispose());b.parts.forEach(p=>p.geometry.dispose());}
 writeFileSync('output/current/village-layouts/parallel44/kernel/ks54/mill-full-feet.json',JSON.stringify(reports,null,2));
});

it('new Mill assembly has no same-facing exposed overlap at rest',()=>{
 const f=villageWorld(2,true);
 try{
  f.world.scene.updateMatrixWorld(true);const all=surfaceTriangles(f.world.scene).filter(s=>visible(s.mesh)&&s.mesh!==f.probe.marble?.mesh),hardware=all.filter(s=>s.mesh.userData.pendulumPart),near=all.filter(s=>hardware.some(h=>h.bounds.intersectsBox(s.bounds)));
  const overlaps=exposedOverlaps(near).filter(o=>hardware.includes(o.a)||hardware.includes(o.b)).map(o=>({a:o.a.mesh.name,b:o.b.mesh.name,point:o.point.toArray(),area:o.area,triangles:[[o.a.a,o.a.b,o.a.c],[o.b.a,o.b.b,o.b.c]].map(t=>t.map(v=>v.toArray()))}));
  writeFileSync('output/current/village-layouts/parallel44/kernel/ks54/mill-rest-exposed.json',JSON.stringify(overlaps,null,2));expect(overlaps).toEqual([]);
 }finally{f.dispose();}
},120000);
