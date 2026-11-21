import {it,expect}from'vitest';
import {Box3,PerspectiveCamera,Vector3,type Matrix4}from'three';
import {writeFileSync}from'node:fs';
import {cinematicMachine,cinematicWorld}from'./cinematic-world-fixture';
import {VillageFilmCamera}from'../../src/view/village-film-camera';
import {VillageFilmCamera as PreviousCamera}from'./village-camera-before';
import {sphereFramed}from'./village-camera-probe';

function expectSameMatrix(actual: Matrix4, expected: Matrix4, context: string): void {
 if (actual.elements.some((value, index) => !Object.is(value, expected.elements[index]))) {
  expect(actual.elements, context).toEqual(expected.elements);
 }
}

it('keeps complete-map/reduced/physical framing while the cinematic cargo stays trackable',()=>{
 const report=[];
 for(let chapter=0;chapter<6;chapter++){
  const f=cinematicMachine(chapter),r=f.machine.route,env=new VillageFilmCamera(f.machine,r),cargo=new VillageFilmCamera(f.machine,r,'cargo'),previous=new PreviousCamera(f.machine,r),a=new PerspectiveCamera(),b=new PerspectiveCamera(),p=new Vector3(),right=new Vector3(),left=new Vector3(),upper=new Vector3(),box=new Box3();
  try{
   expect(env.followDistance).toBe(previous.followDistance);expect(env.restDistance).toBe(previous.restDistance);
   if (chapter === 0) {
    const finale = r.finale!;
    const end = r.contacts.find(c => c.stop === 0)!.end;
    expect(finale.seat).toBeCloseTo(end, 8);
    expect(finale.strike-finale.seat).toBeGreaterThan(.15);
    expect(finale.pullback-finale.strike).toBeGreaterThan(.5);
    const holdCamera = new PerspectiveCamera();
    cargo.apply(holdCamera,finale.seat,false);
    const duringSeat = holdCamera.matrixWorld.clone();
    cargo.apply(holdCamera,finale.strike+.25,false);
    expect(holdCamera.matrixWorld.equals(duringSeat)).toBe(true);
   } else expect(r.finale).toBeUndefined();
   const minmax={min:Infinity,max:0};
   for(const aspect of[375/690,1280/800]){
    env.resize(aspect);cargo.resize(aspect);previous.resize(aspect);
    const context=`chapter ${chapter}, aspect ${aspect}`;
    for(let t=0;t<=r.duration;t+=.25){env.apply(a,t);previous.apply(b,t);expectSameMatrix(b.matrixWorld,a.matrixWorld,`${context}, envelope at ${t}s`);}
    for(const shot of cargo.shots){const t=(shot.start+shot.end)/2;env.apply(a,t,false);cargo.apply(b,t,false);expectSameMatrix(b.matrixWorld,a.matrixWorld,`${context}, reduced-motion shot at ${t}s`);}
    for(const t of[0,r.duration]){env.apply(a,t);cargo.apply(b,t);expectSameMatrix(b.matrixWorld,a.matrixWorld,`${context}, endpoint at ${t}s`);}
    for(let t=4;t<r.duration-4;t+=1/30){cargo.apply(b,t);r.sample(t,p);
     if(!sphereFramed(b,p))throw new Error(`${context}: cargo leaves its frame at ${t}s`);
     if(aspect===375/690){right.set(1,0,0).applyQuaternion(b.quaternion).multiplyScalar(.3);left.copy(p).sub(right).project(b);upper.copy(p).add(right).project(b);const px=Math.abs(upper.x-left.x)*375/2;minmax.min=Math.min(minmax.min,px);minmax.max=Math.max(minmax.max,px);}
    }
   }
   expect(minmax.min,`chapter ${chapter} minimum phone diameter`).toBeGreaterThanOrEqual(10);
   expect(minmax.max,`chapter ${chapter} maximum phone diameter`).toBeLessThanOrEqual(30);
   // A far bank still belongs to whole-map fitting, even when it leaves a travelling shot.
   f.machine.bounds(box);expect(box.isEmpty()).toBe(false);
   env.resize(375/690);cargo.resize(375/690);report.push({chapter,before:env.followDistance,after:cargo.followDistance,phoneDiameter:minmax});
  }finally{f.dispose();}
 }
 if(process.env.CINE_CAMERA_REPORT)writeFileSync(process.env.CINE_CAMERA_REPORT,JSON.stringify({scope:'Actual camera projection; not frame-time or physical-phone performance',report},null,2));
});

it('a 16m carry no longer forces a panorama throughout a cinematic film',()=>{
 const f=cinematicWorld(4);try{const whole=new VillageFilmCamera(f.machine,f.machine.route),near=new VillageFilmCamera(f.machine,f.machine.route,'cargo');expect(near.followDistance).toBeLessThan(whole.followDistance);expect(near.restDistance).toBe(whole.restDistance);}finally{f.dispose();}
});

it('hits the bronze bell at the authored sound frame and springs clear of its lip',async()=>{
 const {Mesh,Ray} = await import('three');
 const {PIER_HINGE,hammerAngle,pierBellShell,pierHammerGeometry} = await import('../../src/view/pier-bell');
 const {surfaceTriangles} = await import('./surface-overlap');
 const shell=new Mesh(pierBellShell()),hammer=new Mesh(pierHammerGeometry());
 const shellFaces=surfaceTriangles(shell);
 const edge=new Vector3(),at=new Vector3(),ray=new Ray();
 const cuts=(a:Vector3,b:Vector3,c:Vector3,p:Vector3,q:Vector3)=>{
  edge.subVectors(q,p);const length=edge.length();if(!length)return false;
  ray.set(p,edge.divideScalar(length));return ray.intersectTriangle(a,b,c,false,at)!==null && at.distanceTo(p)<length;
 };
 const hits=(angle:number)=>{
  const g=hammer.geometry.clone();
  g.translate(-PIER_HINGE.x,-PIER_HINGE.y,-PIER_HINGE.z).rotateZ(angle).translate(PIER_HINGE.x,PIER_HINGE.y,PIER_HINGE.z);
  const faces=surfaceTriangles(new Mesh(g));g.dispose();
  return faces.some(h=>shellFaces.some(b=>h.bounds.intersectsBox(b.bounds) && (
    cuts(b.a,b.b,b.c,h.a,h.b)||cuts(b.a,b.b,b.c,h.b,h.c)||cuts(b.a,b.b,b.c,h.c,h.a)||
    cuts(h.a,h.b,h.c,b.a,b.b)||cuts(h.a,h.b,h.c,b.b,b.c)||cuts(h.a,h.b,h.c,b.c,b.a))));
 };
 try {
  const seat=1,strike=1.24,impact=hammerAngle(strike,seat,strike);
  // Bracket first physical contact to within a thousandth of a radian. Earlier and rebound poses clear the bronze.
  expect(hits(impact+.0005)).toBe(false);expect(hits(impact-.0005)).toBe(true);
  expect(hits(hammerAngle(strike-.02,seat,strike))).toBe(false);
  expect(hits(hammerAngle(strike+.10,seat,strike))).toBe(false);
 }finally{shell.geometry.dispose();hammer.geometry.dispose();}
});
