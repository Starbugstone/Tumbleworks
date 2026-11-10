import {expect,it} from 'vitest';
import {Box3} from 'three';
import {villageWorld} from './village-world-fixture';
import {surfaceTriangles} from './surface-overlap';
import {trackCrossings,exposedOverlaps} from './village-geometry';
it('checks retained contact bars and connected returns on actual Gardens matrices',()=>{
 const {world,probe,dispose}=villageWorld(1,true),route=probe.machine.route;
 try{route.requirePhysical();for(const stop of [9,5,1])expect(world.scene.getObjectByName(`village-rim-yoke-${stop}`)).toBeDefined();const cases:unknown[]=[];let checked=0;
 for(const stop of [9,5,1,0]){
 const c=route.contacts.find(c=>c.stop===stop)!;
 const times=[0,c.start,c.contact,...route.transfers.filter(t=>t.stop===stop).flatMap(t=>[0,.25,.5,.75,1].map(u=>t.start+(t.end-t.start)*u))];
 for(const reduced of [false,true])for(const time of [...new Set(times)]){
  world.film(time);probe.machine.apply(time,reduced);
  const faces=surfaceTriangles(world.scene),tracks=faces.filter(f=>f.mesh.name.startsWith('village-track-'));
  const parts=faces.filter(f=>f.mesh.parent?.name===`village-${stop}-${stop===0?'damper':'fork'}`||f.mesh.name.startsWith('village-rim-')&&f.mesh.name.endsWith(`-${stop}`));
  expect(parts.length).toBeGreaterThan(0);checked++;
  const contactBounds=new Box3(),wholeBounds=new Box3();probe.machine.contactBounds(stop,contactBounds);probe.machine.bounds(wholeBounds);
  for(const f of parts)for(const p of [f.a,f.b,f.c]){expect(contactBounds.containsPoint(p)).toBe(true);expect(wholeBounds.containsPoint(p)).toBe(true);}
  const others=faces.filter(f=>!parts.includes(f)&&f.mesh!==probe.marble?.mesh);
  const crossings=[...trackCrossings(tracks,parts),...trackCrossings(parts,others)];
  const region=new Box3();for(const f of parts)region.union(f.bounds);region.expandByScalar(1e-5);
  const overlaps=exposedOverlaps(faces.filter(f=>f.bounds.intersectsBox(region))).filter(o=>parts.includes(o.a)||parts.includes(o.b)).map(o=>({a:o.a.mesh.name,b:o.b.mesh.name,at:o.point.toArray(),area:o.area}));
  if(crossings.length||overlaps.length)cases.push({stop,time,reduced,crossings,overlaps});
 }
 }expect(checked).toBeGreaterThan(80);expect(cases).toEqual([]);
 }finally{dispose();}
},180000);
