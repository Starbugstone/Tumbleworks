import {it,expect} from 'vitest';
import {Ray,Vector3} from 'three';
import {writeFileSync} from 'node:fs';
import {cinematicWorld} from './cinematic-world-fixture';
import {NativeRayScene,NativeRayTree} from './cinematic-rays';
import type {VillageCinematic} from '../../src/world/village-cinematic';

interface Episode {start:number;end:number;firstFrame:number;lastFrame:number;duration:number;minVisible:number;occluders:string[]}
const report:unknown[]=[];
for(let chapter=0;chapter<6;chapter++)it(`cinematic ${chapter}: the marble stays trackable in four actual views`,()=>{
 const f=cinematicWorld(chapter,true),r=f.machine.route as VillageCinematic,p=new Vector3(),target=new Vector3(),right=new Vector3(),up=new Vector3();
 try{
  const names=new Set((f.machine as unknown as{movers:{group:import('three').Object3D}[]}).movers.map(m=>m.group.name));names.add('workshop-hammer-sign');
  const scene=new NativeRayScene(f.world.scene,names),fixed=new NativeRayTree(scene.fixed),clips=[...new Set(r.phases.flatMap(p=>'clip'in p?[p.clip]:[]))];
  for(const[width,height]of[[375,690],[1280,800]])for(const normal of[true,false]){
   f.resize(width!,height!);const frames:{frame:number;t:number;visible:number;lost:boolean;occluders:string[];protected:boolean}[]=[];
   for(let frame=0;frame<=Math.ceil(r.duration*30);frame++){
    const t=Math.min(r.duration,frame/30);f.world.film(t,normal);r.sample(t,p);scene.update();const moving=new NativeRayTree(scene.moving),camera=f.world.camera,projected=p.clone().project(camera);
    expect(Math.max(Math.abs(projected.x),Math.abs(projected.y)),`marble outside ${width} ${normal} at ${t}`).toBeLessThanOrEqual(1);expect(projected.z).toBeGreaterThanOrEqual(-1);expect(projected.z).toBeLessThanOrEqual(1);
    right.set(1,0,0).applyQuaternion(camera.quaternion);up.set(0,1,0).applyQuaternion(camera.quaternion);let visible=0;const occluders=new Set<string>();
    for(let i=0;i<17;i++){
     const band=i===0?0:i<=8?.5:.85,angle=((i-1)%8)*Math.PI/4,weight=i===0?.06:i<=8?.43/8:.51/8;
     target.copy(p).addScaledVector(right,.3*band*Math.cos(angle)).addScaledVector(up,.3*band*Math.sin(angle));
     const direction=target.clone().sub(camera.position).normalize(),toCentre=p.clone().sub(camera.position),along=toCentre.dot(direction),perpendicular=toCentre.lengthSq()-along*along,front=along-Math.sqrt(Math.max(0,.09-perpendicular)),ray=new Ray(camera.position,direction);
     const hits=[...fixed.hits(ray,front-.002),...moving.hits(ray,front-.002)];
     if(!hits.length)visible+=weight;else hits.forEach(h=>occluders.add(h.face.mesh.name));
    }
    frames.push({frame,t,visible,lost:visible<.5,occluders:[...occluders],protected:clips.some(c=>t>=c.catch-.3&&t<=c.release)});
   }
   const episodes:Episode[]=[];let current:Episode|undefined;
   for(const frame of frames)if(frame.lost){if(!current||frame.frame-current.lastFrame>=7.5){current={start:frame.t,end:frame.t,firstFrame:frame.frame,lastFrame:frame.frame,duration:1/30,minVisible:frame.visible,occluders:[]};episodes.push(current);}current.end=frame.t;current.lastFrame=frame.frame;current.duration=(current.lastFrame-current.firstFrame+1)/30;current.minVisible=Math.min(current.minVisible,frame.visible);current.occluders=[...new Set([...current.occluders,...frame.occluders])];}
   let window=0,maxFrames=0;for(let i=0;i<frames.length;i++){window+=frames[i]!.lost?1:0;if(i>=60)window-=frames[i-60]!.lost?1:0;maxFrames=Math.max(maxFrames,window);}const maxWindow=maxFrames/30;
   report.push({chapter,width,height,normal,minimumVisible:Math.min(...frames.map(f=>f.visible)),episodes,maxLostSecondsInTwoSeconds:maxWindow,protectedLosses:frames.filter(f=>f.lost&&f.protected)});
   if(process.env.CINE_VISIBILITY_REPORT)writeFileSync(process.env.CINE_VISIBILITY_REPORT,JSON.stringify(report,null,2));
   expect(frames.filter(f=>f.lost&&f.protected).slice(0,8),`loaded catch/carry/release ${width} ${normal}`).toEqual([]);
   expect(episodes.filter(e=>e.lastFrame-e.firstFrame+1>15),`lost marble ${width} ${normal}`).toEqual([]);expect(maxFrames).toBeLessThanOrEqual(18);
  }
 }finally{f.dispose();}
},180000);
