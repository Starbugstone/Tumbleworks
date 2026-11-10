import { Mesh, Triangle, Vector3 } from 'three';
import { expect, it, vi } from 'vitest';
import * as lockParts from '../../src/view/open-lock-parts';
import { OpenAngleGuide, assertOpenLock, openLockReceipt } from '../../src/world/village-lock';
import { openFollowerGeometry, openGuideGeometry, OPEN_FOLLOWER_HALF } from '../../src/view/open-lock-parts';
import { VillageCapture } from '../../src/world/village-capture';
import { VILLAGE_CONTACT, VILLAGE_HEAD } from '../../src/world/village-contact';
import { retainedInventory } from '../../src/world/village-inventory';
import { GLASSHOUSE_GARDENS } from '../../src/world/villages/glasshouse-gardens';
import { VillageProgram } from '../../src/world/village-program';
import { retainedKernels } from './active-retainer-probe';
import { villageWorld } from './village-world-fixture';
import { surfaceTriangles } from './surface-overlap';
import { triangleCrossing } from './village-geometry';

it('actual captured carries use a passive normal couple and release at centre stop', () => {
 const fixture = villageWorld(1, true);
 try {
  const kernels = retainedKernels(fixture.probe.machine).filter(k => k.head);
  expect(kernels.map(k => k.motion.station.stop).sort()).toEqual([1,5]);
  for (const k of kernels) {
   const m=k.motion, lock=m.openGuide!;
   expect(OpenAngleGuide.certified(lock,m.station.stop)).toBe(true);
   expect(lock.releaseTime).toBe(m.closureStart);
   expect(m.carryStart).toBeGreaterThanOrEqual(m.start+m.capture!.settledAt);
   expect(m.carryStart).toBeGreaterThanOrEqual(m.closureEnd);
   expect(lock.impulse.lever).toBeLessThanOrEqual(OPEN_FOLLOWER_HALF);
   expect(lock.impulse.lever).toBeLessThanOrEqual(m.capture!.stroke-OPEN_FOLLOWER_HALF+1e-16);
   for(const load of[lock.impulse,...lock.braking,lock.rest]){
    expect(load.normal).toBeGreaterThan(0);
    expect(Math.abs(load.torque+load.lever*load.normal)).toBeLessThan(64*Number.EPSILON);
   }
   const guide=fixture.probe.machine.root.getObjectByName(`village-open-guide-${m.station.stop}`) as Mesh;
   const follower=k.fork.children.find(o=>o instanceof Mesh&&o.userData.retainerPart?.id==='open-follower') as Mesh;
   expect(guide).toBeDefined();expect(follower).toBeDefined();
   const localFollower=openFollowerGeometry(),localGuide=openGuideGeometry(lock.first,lock.last);
   try {
    const hit=new Vector3(),guideFaces=surfaceTriangles(new Mesh(localGuide));
    // The leading patch exists only early; the trailing edge remains supported
    // throughout capture. Exact endpoint contact is intentional.
    for(let i=0;i<=120;i++){
     const time=m.capture!.centreStop*i/120, state={distance:0,speed:0,spin:0,angle:0};m.capture!.sample(time,state);
     const axle=lock.first+state.distance;
     const x=axle-OPEN_FOLLOWER_HALF;
     const point=new Vector3(x,-.075,-.86);
     const d=guideFaces.map(t=>new Triangle(t.a,t.b,t.c).closestPointToPoint(point,hit).distanceTo(point));
     // The endpoint is an edge, so a ray infinitesimally outside its Float32
     // rounding goes through the next face. Nearest-surface distance retains
     // that endpoint, with a bound derived only from coordinate storage.
     expect(Math.min(...d)).toBeLessThan(8*2**-24*Math.max(1,Math.abs(lock.first),Math.abs(lock.last)));
    }
    for(let i=1;i<=256;i++){
     const theta=Math.PI/2*i/256;
     // Every follower point moves ahead of the finite guide end; the arm is
     // farther forward in z. This is a geometric release, without a new DOF.
     const released=lock.last-OPEN_FOLLOWER_HALF*Math.cos(theta)+.075*Math.sin(theta);
     expect(released).toBeGreaterThan(lock.last-OPEN_FOLLOWER_HALF);
     const moving=new Mesh(localFollower);moving.matrixAutoUpdate=false;
     moving.matrix.makeRotationZ(-Math.PI/2+theta).setPosition(lock.last,0,0);moving.updateMatrixWorld(true);
     const faces=surfaceTriangles(moving);
     expect(faces.some(a=>guideFaces.some(b=>triangleCrossing(a,b)||triangleCrossing(b,a)))).toBe(false);
    }
   }finally{localFollower.dispose();localGuide.dispose();}
  }
  const route=fixture.probe.machine.route;
  expect(route.admissibility).toBeUndefined();expect(()=>route.requirePhysical()).not.toThrow();
 }finally{fixture.dispose();}
});

it('keeps unsupported, short-stroke, borrowed and friction-shoe locks rejected',()=>{
 const station=GLASSHOUSE_GARDENS.plan.stations.find(s=>s.stop===5)!,spec=station.retention!;
 const inventory=retainedInventory(spec,'terracotta','keyed-split');
 const capture=new VillageCapture({incomingSpeed:4,headMass:inventory.translatingMass,brakeForce:5,
  downhillAcceleration:9.81*Math.sin(.18),normalAcceleration:9.81*Math.cos(.18),availableStroke:.3},
  {mass:.02,radius:.3,centralInertia:.4*.02*.3**2},VILLAGE_CONTACT,VILLAGE_HEAD,5);
 const receipt=openLockReceipt(.003,inventory.fork.centre,1,capture.impact.vAfter,capture.events[0]!.a,-.18);
 const first=spec.captureStart+.34,last=spec.captureStart+capture.stroke+.34;
 const lock=OpenAngleGuide.enrol(station,'terracotta',first,last,0,capture,inventory.fork.centre,1)!;
 expect(()=>assertOpenLock(5,receipt)).toThrow();
 expect(()=>assertOpenLock(5,receipt,{...lock} as OpenAngleGuide)).toThrow();
 expect(()=>assertOpenLock(1,receipt,lock)).toThrow();
 expect(()=>OpenAngleGuide.enrol(station,'terracotta',first,last+.001,0,capture,inventory.fork.centre,1)).toThrow();
 expect(()=>OpenAngleGuide.enrol(station,'terracotta',0,.019,0,capture,inventory.fork.centre,1)).toThrow();
 expect(OpenAngleGuide.enrol(station,'twinrail',0,capture.stroke,0,capture,inventory.fork.centre,1)).toBeUndefined();
 const impossible=[-inventory.fork.centre[0],inventory.fork.centre[1],inventory.fork.centre[2]] as const;
 expect(()=>OpenAngleGuide.enrol(station,'terracotta',first,last,0,capture,impossible,1)).toThrow();
 const route=new VillageProgram(GLASSHOUSE_GARDENS.plan);expect(()=>route.requirePhysical()).not.toThrow();
});


it('a missing guide step or separated follower cannot enrol a lock',()=>{
 const station=GLASSHOUSE_GARDENS.plan.stations.find(s=>s.stop===5)!,spec=station.retention!;
 const inv=retainedInventory(spec,'terracotta','keyed-split');
 const capture=new VillageCapture({incomingSpeed:4,headMass:inv.translatingMass,brakeForce:spec.brakeForce,
  downhillAcceleration:9.81*Math.sin(.18),normalAcceleration:9.81*Math.cos(.18),availableStroke:spec.captureStroke},
  {mass:.02,radius:.3,centralInertia:.4*.02*.3**2},VILLAGE_CONTACT,VILLAGE_HEAD,5);
 const first=spec.captureStart+.34,last=spec.captureStart+capture.stroke+.34;
 const guideFactory=lockParts.openGuideGeometry,followerFactory=lockParts.openFollowerGeometry;
 for(const role of['guide','follower']){
  const spy=role==='guide'?vi.spyOn(lockParts,'openGuideGeometry').mockImplementation((a,b)=>guideFactory(a,b).translate(0,.005,0)):
   vi.spyOn(lockParts,'openFollowerGeometry').mockImplementation(()=>followerFactory().translate(.005,0,0));
  try{expect(()=>OpenAngleGuide.enrol(station,'terracotta',first,last,0,capture,inv.fork.centre,1)).toThrow(/open-angle-lock/);}
  finally{spy.mockRestore();}
 }
});
