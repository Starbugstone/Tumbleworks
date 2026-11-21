import {describe,it,expect,vi} from 'vitest';
import {Mesh,Vector3} from 'three';
import {cinematicWorld} from './cinematic-world-fixture';
import {solidProbes,sphereCollision,sphereSupported,trackCrossings,exposedOverlaps,visible} from './village-geometry';
import {surfaceTriangles} from './surface-overlap';
import { handoffSurfaces } from './handoff-surfaces';
import {VillageCinematic} from '../../src/world/village-cinematic';
import {villageChannelGeometry} from '../../src/view/machine-primitives';
import {CLOUD_BRIDGE} from '../../src/world/villages/cloud-bridge';
import {connect} from '../../src/world/villages/author';

for(let chapter=0;chapter<6;chapter++)describe(`cinematic scene ${chapter}`,()=>{
 it('plays immediately with all earned additions and fits the fixed geometry budgets',()=>{
  const f=cinematicWorld(chapter);try{
   expect(f.machine.program).toBeUndefined();expect(f.world.filmReadiness()).toBe('ready');
   for(const phase of['map','film']){if(phase==='film')f.world.film(0);let meshes=0,triangles=0;
    f.world.scene.traverse(o=>{if(o instanceof Mesh&&visible(o)){meshes++;triangles+=(o.geometry.index?.count??o.geometry.getAttribute('position').count)/3;}});
    // One mesh and 384 triangles of each budget are the sea the village stands in.
    expect(meshes).toBeLessThanOrEqual(phase==='map'?30:31);expect(triangles).toBeLessThanOrEqual(phase==='map'?36544:37608);
   }
  }finally{f.dispose();}
 });
 it('keeps the actual sphere clear and supported at 120Hz and every phase knot',()=>{
  const f=cinematicWorld(chapter),p=new Vector3(),n=new Vector3();try{
   const probes=solidProbes(f.world.scene,.3),r=f.machine.route as VillageCinematic;
   const times=new Set([0,r.duration,...r.phases.flatMap(p=>[p.start,p.end])]);for(let i=0;i<Math.ceil(r.duration*120);i++)times.add(i/120);
   for(const t of times){f.world.film(t);r.sample(t,p);r.normalAt(t,n);expect(sphereCollision(probes,p,.3),`sphere at ${t}: ${p.toArray()}`).toBeNull();expect(sphereSupported(probes,p,n,.3),`support at ${t}`).toBe(true);}
  }finally{f.dispose();}
 },60000);
 it('checks complete track width and exposed surfaces at moving handoffs',()=>{
  const f=cinematicWorld(chapter,true);try{
   const r=f.machine.route as VillageCinematic,times=new Set([0,r.duration,...r.phases.filter(p=>p.kind==='ride').flatMap(p=>[p.start,(p.start+p.end)/2,p.end]),...r.transfers.filter(t=>t.kind==='carry').flatMap(t=>[t.start,(t.start+t.end)/2,t.end])]);
   for(const sample of handoffSurfaces(f.world.scene,times,t=>f.machine.apply(t))){
    expect(sample.crossings.slice(0,8),`full width at ${sample.time}`).toEqual([]);
    expect(sample.exposed.slice(0,8).map(o=>({a:o.a.mesh.name,b:o.b.mesh.name,faces:[o.a.index,o.b.index],point:o.point.toArray(),area:o.area})),`exposed faces at ${sample.time}`).toEqual([]);
   }
  }finally{f.dispose();}
 },180000);
});

it('keeps the old unsupported airborne arrival as a regression',()=>{
 const f=cinematicWorld(1),r=f.machine.route,t=.3,u=t*t*(3-2*t),p=new Vector3(...r.handoff.entry.position).addScaledVector(new Vector3(...r.handoff.entry.tangent),-7*(1-u));p.y+=.8*(1-u);
 try{expect(sphereSupported(solidProbes(f.world.scene,.3),p,new Vector3(0,1,0),.3)).toBe(false);}finally{f.dispose();}
});

it('keeps the old Cloud Bridge fold and Clockmakers brace as collision regressions',()=>{
 const from=CLOUD_BRIDGE.plan.stations.find(s=>s.stop===9)!,to=CLOUD_BRIDGE.plan.stations.find(s=>s.stop===8)!;
 const old=connect(from,to,3.2,3.2,[0,0],{lead:.8,steps:64}),geometry=villageChannelGeometry(old.points,'girder'),mesh=new Mesh(geometry);mesh.name='old-cloud-fold';
 try{const faces=surfaceTriangles(mesh);expect(trackCrossings(faces,faces).length).toBeGreaterThan(0);expect(exposedOverlaps(faces).length).toBeGreaterThan(0);}finally{geometry.dispose();}
 const side=vi.spyOn(VillageCinematic.prototype,'retainedSide').mockReturnValue(-1);let f:ReturnType<typeof cinematicWorld>;
 try{f=cinematicWorld(3,true);}finally{side.mockRestore();}
 try{
  f.machine.apply(0);
  const connector=f.world.scene.getObjectByName('village-track-connector-2-1');
  const bearing=f.world.scene.getObjectByName('village-2-fork-bearing');
  if (!(connector instanceof Mesh) || !(bearing instanceof Mesh)) throw new Error('The posed connector and its fork bearing must be rendered meshes');
  expect(trackCrossings(surfaceTriangles(connector),surfaceTriangles(bearing)).length).toBeGreaterThan(0);
 }finally{f.dispose();}
});

it('rejects a striker that remains across the marble after impact',()=>{
 const f=cinematicWorld(0),r=f.machine.route;const original=r.auxiliaryPose.bind(r);
 const stuck=vi.spyOn(r,'auxiliaryPose').mockImplementation((stop,part,t,out)=>{original(stop,part,t,out);if(stop===1&&part==='striker')out.angle=0;});
 try{const probes=solidProbes(f.world.scene,.3),p=new Vector3(),c=r.contacts.find(c=>c.stop===1)!;let collision=false;
  for(let t=c.start;t<=c.end;t+=1/120){f.machine.apply(t);r.sample(t,p);if(sphereCollision(probes,p,.3)){collision=true;break;}}
  expect(collision).toBe(true);
 }finally{stuck.mockRestore();f.dispose();}
});

it('rejects a clock gate that has not lifted when the rolling marble reaches it',()=>{
 // The marble no longer waits at the gate, so a late gate is a collision, not a pause.
 const f=cinematicWorld(3),r=f.machine.route;const original=r.auxiliaryPose.bind(r);
 const shut=vi.spyOn(r,'auxiliaryPose').mockImplementation((stop,part,t,out)=>{original(stop,part,t,out);if(stop===8&&part==='gate')out.y=0;});
 try{const probes=solidProbes(f.world.scene,.3),p=new Vector3(),c=r.contacts.find(c=>c.stop===8)!;let collision=false;
  for(let t=c.start;t<=c.end;t+=1/120){f.machine.apply(t);r.sample(t,p);if(sphereCollision(probes,p,.3)){collision=true;break;}}
  expect(collision).toBe(true);
 }finally{shut.mockRestore();f.dispose();}
});

it('checks moving occlusion, changed geometry and crossings against exhaustive posed triangles', async () => {
  const { BoxGeometry, MeshBasicMaterial, PlaneGeometry, Group, Ray } = await import('three');
  const { surfaceOverlaps } = await import('./surface-overlap');
  const root = new Group(), material = new MeshBasicMaterial();
  const plate = new Mesh(new PlaneGeometry(2, 2), material);
  plate.name = 'village-track-control';
  const duplicate = new Mesh(plate.geometry.clone(), material);
  const shield = new Mesh(new PlaneGeometry(4, 4), material);
  const beam = new Mesh(new BoxGeometry(.2, 3, .2), material);
  root.add(plate, duplicate, shield, beam);
  const pose = (t: number) => {
    duplicate.visible = t !== 3;
    shield.position.set(t ? 5 : 0, 0, .5);
    beam.position.set(t === 2 ? 0 : 5, 0, 0);
    const vertices = duplicate.geometry.getAttribute('position');
    for (let i = 0; i < vertices.count; i++) vertices.setZ(i, t === 2 ? .2 : 0);
  };
  try {
    const times = [0, 1, 2, 3, 4];
    const expected = times.map(t => {
      pose(t);
      const faces = surfaceTriangles(root).filter(face => visible(face.mesh));
      const covered = surfaceOverlaps(faces).filter(pair => {
        const samples = [pair.point, ...pair.polygon.map(v => v.clone().lerp(pair.point,.05))];
        return samples.some(point => {
          const ray = new Ray(point.clone().addScaledVector(pair.a.normal,.0001),pair.a.normal);
          return !faces.some(f => {
            const hit = ray.intersectTriangle(f.a,f.b,f.c,false,new Vector3());
            return hit !== null && hit.distanceTo(ray.origin) > .0001;
          });
        });
      });
      return { crossing:trackCrossings(faces.filter(f=>f.mesh===plate),faces).length>0, count:covered.length };
    });
    const actual = [...handoffSurfaces(root,times,pose)].map(s=>({crossing:s.crossings.length>0,count:s.exposed.length}));
    expect(expected[0]!.count).toBe(0); expect(expected[1]!.count).toBeGreaterThan(0);
    expect(expected[2]!.crossing).toBe(true);
    expect(expected[3]!.count).toBe(0); expect(expected[4]!.count).toBe(expected[1]!.count);
    expect(actual).toEqual(expected);
  } finally {
    for (const mesh of [plate,duplicate,shield,beam]) mesh.geometry.dispose();
    material.dispose();
  }
});
