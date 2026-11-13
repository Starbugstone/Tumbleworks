import {describe,it,expect,vi} from 'vitest';
import {Mesh,Quaternion,Vector3} from 'three';
import {cinematicWorld} from './cinematic-world-fixture';
import {solidProbes,sphereCollision,sphereSupported,trackCrossings,exposedOverlaps,visible} from './village-geometry';
import {surfaceTriangles} from './surface-overlap';
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
   const r=f.machine.route as VillageCinematic,times=new Set([0,r.duration,...r.phases.filter(p=>p.kind==='ride').flatMap(p=>[p.start,(p.start+p.end)/2,p.end])]);
   for(const t of times){f.machine.apply(t);const all=surfaceTriangles(f.world.scene).filter(s=>visible(s.mesh)),tracks=all.filter(s=>s.mesh.name.startsWith('village-track-'));
    expect(trackCrossings(tracks,all).slice(0,8),`full width at ${t}`).toEqual([]);
    expect(exposedOverlaps(all).slice(0,8).map(o=>({a:o.a.mesh.name,b:o.b.mesh.name,area:o.area})),`exposed faces at ${t}`).toEqual([]);
   }
  }finally{f.dispose();}
 },180000);
});

for(let chapter=0;chapter<6;chapter++)it(`cinematic ${chapter}: the previous-village preview uses its real supported source`,()=>{
 const f=cinematicWorld(chapter),r=f.machine.route,p=new Vector3(),n=new Vector3(),q=new Quaternion();try{
  const probes=solidProbes(f.world.scene,.3);
  for(let i=0;i<=300;i++){const t=i/120;f.world.handoff(t);const actor=(f.world as unknown as{marble:{mesh:Mesh}}).marble.mesh;r.sample(t,p);r.normalAt(t,n);r.marbleOrientation(t,q);expect(actor.position.toArray()).toEqual(p.toArray());expect(actor.quaternion.toArray()).toEqual(q.toArray());expect(sphereCollision(probes,p,.3)).toBeNull();expect(sphereSupported(probes,p,n,.3)).toBe(true);}
 }finally{f.dispose();}
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
 try{f.machine.apply(0);const all=surfaceTriangles(f.world.scene),tracks=all.filter(s=>s.mesh.name==='village-track-connector-2-1');expect(trackCrossings(tracks,all).some(p=>p.solid==='village-2-fork-bearing')).toBe(true);}finally{f.dispose();}
});

it('rejects a striker that remains across the marble after impact',()=>{
 const f=cinematicWorld(0),r=f.machine.route;const original=r.auxiliaryPose.bind(r);
 const stuck=vi.spyOn(r,'auxiliaryPose').mockImplementation((stop,part,t,out)=>{original(stop,part,t,out);if(stop===1&&part==='striker')out.angle=0;});
 try{const probes=solidProbes(f.world.scene,.3),p=new Vector3(),c=r.contacts.find(c=>c.stop===1)!;let collision=false;
  for(let t=c.start;t<=c.end;t+=1/120){f.machine.apply(t);r.sample(t,p);if(sphereCollision(probes,p,.3)){collision=true;break;}}
  expect(collision).toBe(true);
 }finally{stuck.mockRestore();f.dispose();}
});
