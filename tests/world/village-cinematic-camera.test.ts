import {it,expect}from'vitest';
import {Box3,PerspectiveCamera,Vector3}from'three';
import {writeFileSync}from'node:fs';
import {cinematicWorld}from'./cinematic-world-fixture';
import {VillageFilmCamera}from'../../src/view/village-film-camera';
import {VillageFilmCamera as PreviousCamera}from'./village-camera-before';
import {sphereFramed}from'./village-camera-probe';

it('keeps complete-map/reduced/physical framing while the cinematic cargo stays trackable',()=>{
 const report=[];
 for(let chapter=0;chapter<6;chapter++){
  const f=cinematicWorld(chapter),r=f.machine.route,env=new VillageFilmCamera(f.machine,r),cargo=new VillageFilmCamera(f.machine,r,'cargo'),previous=new PreviousCamera(f.machine,r),a=new PerspectiveCamera(),b=new PerspectiveCamera(),p=new Vector3(),right=new Vector3(),left=new Vector3(),upper=new Vector3(),box=new Box3();
  try{
   expect(env.followDistance).toBe(previous.followDistance);expect(env.restDistance).toBe(previous.restDistance);
   const minmax={min:Infinity,max:0};
   for(const aspect of[375/690,1280/800]){
    env.resize(aspect);cargo.resize(aspect);previous.resize(aspect);
    for(let t=0;t<=r.duration;t+=.25){env.apply(a,t);previous.apply(b,t);expect(b.matrixWorld.elements).toEqual(a.matrixWorld.elements);}
    for(const shot of cargo.shots){const t=(shot.start+shot.end)/2;env.apply(a,t,false);cargo.apply(b,t,false);expect(b.matrixWorld.elements).toEqual(a.matrixWorld.elements);}
    for(const t of[0,r.duration]){env.apply(a,t);cargo.apply(b,t);expect(b.matrixWorld.elements).toEqual(a.matrixWorld.elements);}
    for(let t=4;t<r.duration-4;t+=1/30){cargo.apply(b,t);r.sample(t,p);expect(sphereFramed(b,p)).toBe(true);
     if(aspect===375/690){right.set(1,0,0).applyQuaternion(b.quaternion).multiplyScalar(.3);left.copy(p).sub(right).project(b);upper.copy(p).add(right).project(b);const px=Math.abs(upper.x-left.x)*375/2;minmax.min=Math.min(minmax.min,px);minmax.max=Math.max(minmax.max,px);expect(px).toBeGreaterThanOrEqual(10);expect(px).toBeLessThanOrEqual(30);}
    }
   }
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
