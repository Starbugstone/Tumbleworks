import{CylinderGeometry,Vector3}from'three';
import{PendulumCore}from'../../src/world/pendulum-core';
import{PendulumProfile}from'../../src/world/pendulum-profile';
import { expect,it } from 'vitest';
import { PendulumSupport } from '../../src/world/pendulum-support';
import { pendulumParts } from '../../src/view/pendulum-parts';
import { VillagePendulum } from '../../src/world/village-pendulum';
import { proposedPendulum } from './pendulum-fields';
import { pendulumStation } from './pendulum-fixture';

it('old striker shape keeps the exact typed impact rejection; names cannot forge support',()=>{
 const old={...pendulumStation,strikerDrive:{mass:.001,inertia:.000095,friction:.008,stroke:.5}};
 expect(()=>new VillagePendulum(old,0,2,2,'plank')).toThrow(/striker-impact unsupported-contact-geometry/);
 expect(PendulumSupport.certified({stop:1,kind:'ideal-revolute',supports:()=>true},1)).toBe(false);
});
it('actual bearing/frame/stop certificate must succeed before the producer gate can open',()=>{
 const authored=proposedPendulum({...pendulumStation,strikerDrive:{mass:.001,inertia:.000095,friction:.008,stroke:.5}},'harbour-bell',()=>0);
 const parts=pendulumParts(pendulumStation,authored,()=>0);
 try{
  // A real finite common-cylinder certificate is required; missing hardware
  // and names-only objects never enrol. Scene terrain is checked separately.
  const support=PendulumSupport.enrol(pendulumStation,authored,parts);expect(PendulumSupport.certified(support,1)).toBe(true);
  const missing={...parts,parts:parts.parts.filter(p=>p.id!=='fixed-axle')};
  expect(()=>PendulumSupport.enrol(pendulumStation,authored,missing)).toThrow(/striker/);
 }finally{parts.parts.forEach(p=>p.geometry.dispose());}
});

it('nominal common cylinder rejects extra clearance, wrong/moved/tilted axis, missing bore, span and foreign cap',()=>{
 const d=proposedPendulum({...pendulumStation,strikerDrive:{mass:.001,inertia:.000095,friction:.008,stroke:.5}},'harbour-bell',()=>0),parts=pendulumParts(pendulumStation,d,()=>0);
 try{
  const support=PendulumSupport.enrol(pendulumStation,d,parts);expect(support.certificate.model).toBe('nominal-common-cylinder');
  expect(Math.abs(support.certificate.nominalMismatch)).toBeLessThanOrEqual(support.certificate.storageBound);
  expect(support.certificate.shaftChordDeviation).toBeGreaterThan(.0004);expect(support.certificate.boreChordDeviation).toBeGreaterThan(.0004);
  const change=(id:string,mutate:(g:import('three').BufferGeometry)=>void)=>{
   const original=parts.parts.find(p=>p.id===id)!,g=original.geometry.clone();mutate(g);
   try{expect(()=>PendulumSupport.enrol(pendulumStation,d,{...parts,parts:parts.parts.map(p=>p===original?{...p,geometry:g}:p)})).toThrow(/striker-bearing-certificate/);}finally{g.dispose();}
  };
  change('hammer-hub',g=>g.scale(1.001,1.001,1));change('fixed-axle',g=>g.scale(1.001,1.001,1));
  change('fixed-axle',g=>g.translate(.001,0,0));change('fixed-axle',g=>g.rotateY(.01));
  change('hammer-hub',g=>g.scale(1,1,.01));change('frame-cap',g=>g.translate(0,-.1,0));
  const noBore=new CylinderGeometry(.055,.055,.12,16).rotateX(Math.PI/2).translate(0,0,-.36);
  try{expect(()=>PendulumSupport.enrol(pendulumStation,d,{...parts,parts:parts.parts.map(p=>p.id==='hammer-hub'?{...p,geometry:noBore}:p)})).toThrow(/striker-bearing-certificate/);}finally{noBore.dispose();}
  expect(()=>support.reactions({force:[0,0,1],moment:[0,0,0],axialTerms:[1]})).toThrow(/axial/);
  expect(()=>support.reactions({force:[0,0,0],moment:[0,0,0],axialTerms:[1,-1]})).toThrow(/axial/);
 }finally{parts.parts.forEach(p=>p.geometry.dispose());}
});
it('actual offset inventory requires and receives radial force and transverse bearing moments',()=>{
 const d=proposedPendulum({...pendulumStation,strikerDrive:{mass:.001,inertia:.000095,friction:.008,stroke:.5}},'harbour-bell',()=>0),parts=pendulumParts(pendulumStation,d,()=>0);
 try{
  expect(parts.centre[1]).toBe(-1.0381898377321408);expect(parts.axleInertia).toBe(.0014463873893668683);
  const yz=parts.inventory.reduce((a,p)=>a+p.mass*p.centre[1]*p.centre[2],0);expect(Math.abs(parts.axialProducts[1]-yz)).toBeLessThan(1e-18);
  const support=PendulumSupport.enrol(pendulumStation,d,parts),core=new PendulumCore(1,d,parts,new PendulumProfile(parts.bar,-.3,1.6));
  for(const q of[0,.1,.35,.7])for(const u of[0,1,3]){
   const wrench=core.bearingWrench(q,u,-1.3,0),reactions=support.reactions(wrench),force=new Vector3(),moment=new Vector3();
   expect(wrench.axialTerms.every(x=>x===0)).toBe(true);expect(Math.abs(wrench.moment[0])+Math.abs(wrench.moment[1])).toBeGreaterThan(0);
   for(const r of reactions){expect(r.force).toBeGreaterThanOrEqual(0);const f=new Vector3(...r.normal).multiplyScalar(r.force);force.add(f);moment.add(new Vector3(...r.at).cross(f));}
   expect(force.distanceTo(new Vector3(...wrench.force))).toBeLessThan(1e-14);expect(moment.distanceTo(new Vector3(...wrench.moment))).toBeLessThan(1e-14);
  }
 }finally{parts.parts.forEach(p=>p.geometry.dispose());}
});
