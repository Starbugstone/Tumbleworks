import type {VillageProgram} from '../../src/world/village-program';
import {expect,it} from 'vitest';
import {writeFileSync} from 'node:fs';
import {Box3,Mesh,Vector3} from 'three';
import {villageWorld} from './village-world-fixture';
import {surfaceTriangles} from './surface-overlap';
import {trackCrossings,exposedOverlaps} from './village-geometry';
import {villageChannelGeometry} from '../../src/view/machine-primitives';
import {villagePort} from '../../src/world/village-plan';

// Preserve the original G23 carrier poses after upstream route retiming.
function originalPumpPose(route:VillageProgram,time:number):number {
 const carry=route.transfers.find(p=>p.stop===1&&p.kind==='carry')!;
 return carry.start+(time-25.312149737967488)/(26.924601287627198-25.312149737967488)*(carry.end-carry.start);
}
const names = new Set(['village-track-carrier-1','village-track-connector-1-0','village-track-connector-2-1']);
it.each([['outlet',26.52148840021227,1],['inlet',25.807561512288355,2]] as const)('rejects the original %s joint at its actual crossing pose',(_end,time,from)=>{
 const {world,probe,dispose}=villageWorld(1,true);
 try {
  world.film(originalPumpPose(probe.machine.route,time));
  const carrier=world.scene.getObjectByName('village-track-carrier-1') as Mesh;
  const outlet=world.scene.getObjectByName(`village-track-connector-${from}-${from-1}`) as Mesh;
  const current=[carrier.geometry,outlet.geometry];
  carrier.geometry=villageChannelGeometry([villagePort([-.8,0,0]),villagePort([.8,0,0])],'terracotta');
  outlet.geometry=villageChannelGeometry(probe.plan.connectors.find(c=>c.from===from)!.points,'terracotta');
  const faces=surfaceTriangles(world.scene).filter(f=>f.mesh===carrier||f.mesh===outlet);
  expect(trackCrossings(faces,faces).length).toBeGreaterThan(0);
  carrier.geometry.dispose();outlet.geometry.dispose();
  [carrier.geometry,outlet.geometry]=current as [typeof carrier.geometry,typeof outlet.geometry];
 } finally {dispose();}
});
it('has coincident real floor edges at docking without changing the floor height or face count',()=>{
 const {world,probe,dispose}=villageWorld(1,true);
 try {
  const phase=probe.machine.route.transfers.find(p=>p.stop===1&&p.kind==='release')!;
  world.film(phase.start);
  world.scene.updateMatrixWorld(true);
  const carrier=world.scene.getObjectByName('village-track-carrier-1') as Mesh;
  const outlet=world.scene.getObjectByName('village-track-connector-1-0') as Mesh;
  const port=probe.plan.stations.find(s=>s.stop===1)!.exit;
  const floor=new Vector3(...port.position).addScaledVector(new Vector3(...port.normal),-.3);
  const a=carrier.geometry.getAttribute('position'),b=outlet.geometry.getAttribute('position');
  for(const i of [12,23]) {
   const pa=new Vector3().fromBufferAttribute(a,i).applyMatrix4(carrier.matrixWorld);
   const pb=new Vector3().fromBufferAttribute(b,i-12).applyMatrix4(outlet.matrixWorld);
   expect(pa.distanceTo(pb)).toBeLessThan(1e-6);
   expect(Math.abs(pa.clone().sub(floor).dot(new Vector3(...port.normal)))).toBeLessThan(1e-6);
  }
  expect(carrier.geometry.index!.count).toBe(72);
  expect(outlet.geometry.index!.count).toBe(2304);
 } finally {dispose();}
});
it.each([false,true])('clears all nearby faces across actual pump approach, lift, dock and release (reduced=%s)',(reduced)=>{
 const {world,probe,dispose}=villageWorld(1,true),route=probe.machine.route;
 try {
  const contact=route.contacts.find(c=>c.stop===1)!;
  const times=new Set([0,contact.start,contact.contact,contact.end,originalPumpPose(route,26.52148840021227)]);
  for(const phase of route.transfers.filter(p=>p.stop===1))for(const f of [0,.25,.5,.75,1])times.add(phase.start+(phase.end-phase.start)*f);
  for(let i=0;i<=Math.ceil((contact.end-contact.start)*120);i++)times.add(Math.min(contact.end,contact.start+i/120));
  const whole=new Box3(),station=new Box3();probe.machine.bounds(whole);probe.machine.contactBounds(1,station);
  for(const time of times){
   world.film(time);probe.machine.apply(time,reduced);
   const faces=surfaceTriangles(world.scene).filter(f=>f.mesh!==probe.marble?.mesh);
   const joint=faces.filter(f=>names.has(f.mesh.name));
   const region=new Box3();for(const f of joint)region.union(f.bounds);
   const nearby=faces.filter(f=>f.bounds.intersectsBox(region));
   const matrices=joint.map(f=>f.mesh.matrixWorld.toArray());
   probe.machine.bounds(new Box3());probe.machine.contactBounds(1,new Box3());
   expect(joint.map(f=>f.mesh.matrixWorld.toArray())).toEqual(matrices);
   const crossings=trackCrossings(joint,nearby);
   if(crossings.length)writeFileSync(`output/current/village-layouts/pump-joint-repair/dense-crossing-${reduced}-${Date.now()}.json`,JSON.stringify({time,reduced,crossings},null,2),{flag:'wx'});
   expect(crossings,JSON.stringify({time,reduced})).toEqual([]);
   const overlaps=exposedOverlaps(nearby).filter(o=>names.has(o.a.mesh.name)||names.has(o.b.mesh.name));
   expect(overlaps.map(o=>({a:o.a.mesh.name,b:o.b.mesh.name,point:o.point.toArray()})),JSON.stringify({time,reduced})).toEqual([]);
   for(const f of joint)for(const p of [f.a,f.b,f.c]){
    expect(whole.containsPoint(p)).toBe(true);
    if(f.mesh.name==='village-track-carrier-1')expect(station.containsPoint(p)).toBe(true);
   }
  }
 } finally {dispose();}
},180000);

it('partitions both dock joints into disjoint half-spaces parallel to the complete actual translation',()=>{
 const {world,probe,dispose}=villageWorld(1,true);
 try {
  const station=probe.plan.stations.find(s=>s.stop===1)!;
  const release=probe.machine.route.transfers.find(p=>p.stop===1&&p.kind==='release')!.start;
  const m=station.mechanism;if(m.kind!=='translating')throw new Error('Expected actual translation');
  for(const end of [false,true]){
   const p=end?station.exit:station.entry,normal=new Vector3(...p.normal),tangent=new Vector3(...p.tangent);
   const side=tangent.clone().cross(normal).normalize();
   const plane=side.clone().cross(new Vector3(...m.travel)).normalize();if(plane.dot(tangent)<0)plane.negate();
   const floor=new Vector3(...p.position).addScaledVector(normal,-.3);
   expect(Math.abs(plane.dot(new Vector3(...m.travel)))).toBeLessThan(1e-12);
   for(const time of [0,release]){
    world.film(time);const faces=surfaceTriangles(world.scene);
    for(const name of ['village-track-carrier-1',end?'village-track-connector-1-0':'village-track-connector-2-1']){
     const sign=name==='village-track-carrier-1'?(end?-1:1):(end?1:-1);
     const selected=faces.filter(f=>f.mesh.name===name);expect(selected.length).toBeGreaterThan(0);
     for(const f of selected)for(const v of [f.a,f.b,f.c])expect(sign*v.clone().sub(floor).dot(plane)).toBeGreaterThan(-1e-6);
    }
   }
   world.film(end?release:0);world.scene.updateMatrixWorld(true);
   for(const name of ['village-track-carrier-1',end?'village-track-connector-1-0':'village-track-connector-2-1']){
    const mesh=world.scene.getObjectByName(name) as Mesh,positions=mesh.geometry.getAttribute('position');
    for(const sign of [-1,1]){
     const edge=floor.clone().addScaledVector(side,sign*.4*p.width);
     let nearest=Infinity;
     for(let i=0;i<positions.count;i++)nearest=Math.min(nearest,new Vector3().fromBufferAttribute(positions,i).applyMatrix4(mesh.matrixWorld).distanceTo(edge));
     expect(nearest).toBeLessThan(1e-6);
    }
   }
  }
 } finally {dispose();}
});
