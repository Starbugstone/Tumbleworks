import * as carry from '../../src/world/village-carry';
import * as lock from '../../src/world/village-lock';
import{it,expect,vi}from'vitest';import{Mesh,Vector3,Box3,Triangle,CylinderGeometry,TubeGeometry}from'three';
import * as contact from'../../src/world/village-contact';import{villageWorld}from'./village-world-fixture';import{retainedKernels,barEvidence}from'./active-retainer-probe';import{surfaceTriangles}from'./surface-overlap';import{triangleCrossing}from'./village-geometry';
function poseControlledWorld(){const spy=vi.spyOn(carry,'assertCarryGovernor').mockImplementation(()=>{}),joint=vi.spyOn(lock,'assertOpenLock').mockImplementation(()=>{});try{return villageWorld(1,true);}finally{spy.mockRestore();joint.mockRestore();}}
it('pose-controlled keyed heads keep original contact geometry and loaded closure while the trailing fork closes',()=>{
 const f=poseControlledWorld();try{for(const k of retainedKernels(f.probe.machine).filter(k=>k.head)){
  const m=k.motion,head=k.head!.children.find((o):o is Mesh=>o instanceof Mesh&&o.geometry instanceof CylinderGeometry&&o.geometry.parameters.radiusTop===.04)!;
  expect(head).toBeDefined();expect(f.probe.machine.route.contacts.find(c=>c.stop===m.station.stop)!.moverIds).toContain(k.head!.name);
  const positions=head.geometry.getAttribute('position'),before=Array.from(positions.array);
  for(const cameraMotion of [true,false])for(let i=0;i<=64;i++){
   const t=m.closureStart+(m.closureEnd-m.closureStart)*i/64;f.world.film(t,cameraMotion);const center=new Vector3();f.probe.machine.sample(t,center);
   const candidates=[...k.fork.children,...k.head!.children].filter((o):o is Mesh=>o instanceof Mesh),faces=candidates.flatMap(o=>surfaceTriangles(o));
   const evidence=barEvidence(f.probe.machine.route,k,t,center,faces,candidates,m.station.stop).find(e=>e.role==='leading')!;
   expect(evidence).toBeDefined();expect(evidence.contact.gap).toBeLessThan(2e-8);expect(evidence.equilibrium.kind).toBe('equilibrium');
   const a=surfaceTriangles(k.head!),b=surfaceTriangles(k.fork);const pairs=a.flatMap(a=>b.filter(b=>triangleCrossing(a,b)||triangleCrossing(b,a)).map(b=>({stop:m.station.stop,t,a:a.mesh.name,b:b.mesh.name,ai:a.index,bi:b.index,va:[a.a,a.b,a.c].map(p=>p.clone().applyMatrix4(k.head!.matrixWorld.clone().invert()).toArray()),vb:[b.a,b.b,b.c].map(p=>p.clone().applyMatrix4(k.head!.matrixWorld.clone().invert()).toArray())})));expect(pairs).toEqual([]);
  }
  expect(Array.from(positions.array)).toEqual(before);
  f.world.film(m.closureStart);f.probe.machine.root.updateWorldMatrix(true,true);
  const source=retainedKernels(f.probe.machine).find(k=>k.motion.station.stop===9)!;
  const original=source.fork.children.find((o):o is Mesh<TubeGeometry>=>o instanceof Mesh&&o.geometry instanceof TubeGeometry)!;
  const oldRoot=new Mesh(original.geometry);oldRoot.matrixAutoUpdate=false;oldRoot.matrix.copy(k.fork.matrixWorld);oldRoot.matrixWorldNeedsUpdate=true;
  const oldFaces=surfaceTriangles(oldRoot),headFaces=surfaceTriangles(head);
  expect(headFaces.some(a=>oldFaces.some(b=>triangleCrossing(a,b)||triangleCrossing(b,a)))).toBe(true);

  const mutant=new Mesh(head.geometry.clone().rotateZ(Math.PI/16)),sphere=new Vector3(-.34,0,0),point=new Vector3();
  const gap=Math.min(...surfaceTriangles(mutant).map(t=>new Triangle(t.a,t.b,t.c).closestPointToPoint(sphere,point).distanceTo(sphere)))-.3;
  expect(gap).toBeGreaterThan(.0007);expect(()=>contact.assertRotatingHeadClosure(m.station.stop,.04,16,.1)).toThrow(/fork-closure/);mutant.geometry.dispose();
 }}finally{f.dispose();}
});
it('pose-controlled whole/contact bounds contain the keyed geometry without seeking',()=>{
 const f=poseControlledWorld();try{for(const t of [0,2,8,16,22,25]){f.world.film(t);f.probe.machine.root.updateWorldMatrix(true,true);const before=f.probe.machine.root.children.map(o=>o.matrixWorld.toArray()),whole=new Box3();f.probe.machine.bounds(whole);
 for(const stop of [5,1]){const group=f.probe.machine.root.getObjectByName(`village-${stop}-capture-head`)!;expect(group).toBeDefined();const bounds=new Box3();f.probe.machine.contactBounds(stop,bounds);for(const face of surfaceTriangles(group))for(const p of [face.a,face.b,face.c]){expect(whole.containsPoint(p)).toBe(true);expect(bounds.containsPoint(p)).toBe(true);}}
 expect(f.probe.machine.root.children.map(o=>o.matrixWorld.toArray())).toEqual(before);
 }}finally{f.dispose();}
});
