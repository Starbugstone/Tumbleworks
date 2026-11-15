import {it,expect,vi} from 'vitest';
import {BoxGeometry,Mesh,MeshBasicMaterial,Vector3} from 'three';
import {cinematicWorld} from './cinematic-world-fixture';
import {CinematicHardwareAudit} from './cinematic-hardware';
import type {VillageCinematic} from '../../src/world/village-cinematic';

for(let chapter=0;chapter<6;chapter++)it(`cinematic ${chapter}: all moving hardware clears foreign solids at 60Hz and event knots`,()=>{
 const f=cinematicWorld(chapter,true);try{
  const r=f.machine.route as VillageCinematic,audit=new CinematicHardwareAudit(f.machine,f.world.scene),times=new Set([0,r.duration,...r.phases.flatMap(p=>[p.start,p.end])]);
  for(let i=0;i<r.duration*60;i++)times.add(i/60);
  for(const t of [...times].sort((a,b)=>a-b)){f.machine.apply(t);expect(audit.check().slice(0,6),`foreign moving hardware at ${t}`).toEqual([]);}
 }finally{f.dispose();}
},180000);

it('keeps the captive fork on its pin while its separate front leaf opens',()=>{
 const f=cinematicWorld(1,true),r=f.machine.route as VillageCinematic,crossing=r.contacts.find(c=>c.stop===5)!;
 try{
  // The carriage is crossed without a stop now: its leaf is open and its fork swung aside throughout.
  // The old defect is the closed fork starting to lift off its pin with the leaf (0.017 at the old instant).
  const t=crossing.contact;f.machine.apply(t);expect(new CinematicHardwareAudit(f.machine,f.world.scene).check()).toEqual([]);
  const original=r.auxiliaryPose.bind(r),old=vi.spyOn(r,'auxiliaryPose').mockImplementation((stop,part,time,out)=>{original(stop,part,time,out);if(stop===5&&part==='fork'){out.y=.017;out.angle=0;}});
  try{f.machine.apply(t);expect(new CinematicHardwareAudit(f.machine,f.world.scene).check().some(x=>x.a.includes('fork')&&x.b.includes('head-frame')||x.b.includes('fork')&&x.a.includes('head-frame'))).toBe(true);}finally{old.mockRestore();}
 }finally{f.dispose();}
});

it('rejects the old cable-bank pylon in the diagonal carrier corridor',()=>{
 const f=cinematicWorld(4,true);try{
  // The same point of the long carry as before the films were quickened: 15% of the way across.
  f.machine.apply(1.951111111111111);expect(new CinematicHardwareAudit(f.machine,f.world.scene).check()).toEqual([]);
  const pylons=f.world.scene.getObjectsByProperty('name','village-bank-pylon-9');expect(pylons).toHaveLength(2);
  for(const p of pylons){p.matrix.identity();p.matrixWorldNeedsUpdate=true;p.children[0]!.position.z+=1.2;}
  expect(new CinematicHardwareAudit(f.machine,f.world.scene).check().some(x=>x.a==='village-track-carrier-9'||x.b==='village-track-carrier-9')).toBe(true);
 }finally{f.dispose();}
});

it('does not classify a foreign block as an axle joint',()=>{
 const f=cinematicWorld(0,true),g=new BoxGeometry(.4,.4,.4),material=new MeshBasicMaterial();try{
  const r=f.machine.route as VillageCinematic,ride=r.phases.find(p=>p.kind==='ride')!,t=(ride.start+ride.end)/2,p=new Vector3();f.machine.apply(t);r.sample(t,p);
  const block=new Mesh(g,material);block.name='foreign-block';block.position.copy(p).add(new Vector3(0,-.3,0));f.world.scene.add(block);
  expect(new CinematicHardwareAudit(f.machine,f.world.scene).check().some(x=>x.a==='foreign-block'||x.b==='foreign-block')).toBe(true);
 }finally{f.dispose();g.dispose();material.dispose();}
});

it('keeps the long-carry counterweight outside the travelling yoke',()=>{
 const f=cinematicWorld(4,true);try{
  f.machine.apply(2.125277777777778);expect(new CinematicHardwareAudit(f.machine,f.world.scene).check()).toEqual([]);
  const weight=f.world.scene.getObjectByName('village-9-weight')!;weight.matrix.elements[12]!-=1.8;weight.matrixWorldNeedsUpdate=true;
  expect(new CinematicHardwareAudit(f.machine,f.world.scene).check().some(x=>x.a.includes('carrier')&&x.b.includes('weight')||x.b.includes('carrier')&&x.a.includes('weight'))).toBe(true);
 }finally{f.dispose();}
});
