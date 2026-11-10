import { expect, it } from 'vitest';
import { DEG, REST_ELEVATION } from '../../src/world/villages/author';
import { GLASSHOUSE_GARDENS } from '../../src/world/villages/glasshouse-gardens';
import type { VillageCameraShot } from '../../src/world/village-plan';
const expected=[[0,2.7,0,2.6,0,0,66],[2.7,4.8,-5,5.3,-8,0,22],[4.8,7.45,-3.6,4.9,-2.6,0,22],[7.45,11.45,.5,3.9,-4,0,22],[11.45,15.45,4.4,3.5,-7.4,0,24],[15.45,17.55,6.2,2.6,-6,0,24],[17.55,25,0,2.6,0,0,66]];
function contract(camera:readonly VillageCameraShot[]){return camera.length===7&&camera.every((s,i)=>[s.start,s.end,...s.target,s.yaw,s.radius].every((v,k)=>Object.is(v,expected[i]![k]))&&Object.is(s.elevation,[REST_ELEVATION,40*DEG,REST_ELEVATION,REST_ELEVATION,40*DEG,40*DEG,REST_ELEVATION][i]));}
it('changes only the selected7.45 reduced still, preserving all other literal camera fields',()=>{expect(contract(GLASSHOUSE_GARDENS.plan.camera)).toBe(true);});
it('rejects wrong elevation/target/radius/timing/yaw/selected-field and removed4.8 mutants',()=>{
 const camera=GLASSHOUSE_GARDENS.plan.camera.map((s,i)=>({...s,elevation:i===3?REST_ELEVATION:s.elevation}));expect(contract(camera)).toBe(true);
 for(const mutate of[(s:VillageCameraShot[])=>{s[3]={...s[3]!,elevation:40.01*DEG};},(s:VillageCameraShot[])=>{s[3]={...s[3]!,target:[.51,3.9,-4]};},(s:VillageCameraShot[])=>{s[3]={...s[3]!,radius:22.1};},(s:VillageCameraShot[])=>{s[3]={...s[3]!,start:7.46};},(s:VillageCameraShot[])=>{s[3]={...s[3]!,yaw:.01};},(s:VillageCameraShot[])=>{s[3]={...s[3]!,elevation:40*DEG};s[4]={...s[4]!,elevation:REST_ELEVATION};},(s:VillageCameraShot[])=>{s[2]={...s[2]!,elevation:40*DEG};}]){const copy=camera.map(s=>({...s}));mutate(copy);expect(contract(copy)).toBe(false);}
 expect(Object.is(50*DEG,REST_ELEVATION)).toBe(true);
});

import { Mesh, MeshBasicMaterial, PerspectiveCamera, Ray, Vector3 } from 'three';
import { VillageFilmCamera } from '../../src/view/village-film-camera';
import { villageChannelGeometry } from '../../src/view/machine-primitives';
import { villageWorld } from './village-world-fixture';
import { surfaceTriangles, type SurfaceTriangle } from './surface-overlap';
import { intendedFloorHit, contactSectionRadius } from './active-retainer-floors';
it('clears the actual native crest ray at50 while retaining the old40 outside-slab wall negative',()=>{
 const f=villageWorld(1),material=new MeshBasicMaterial();let geometry:import('three').BufferGeometry|undefined;
 try{f.resize(1280,800);const route=f.probe.machine.route;route.requirePhysical();const t=15.958432439855628;f.world.film(t,false);
 const old=new VillageFilmCamera(f.probe.machine,{duration:route.duration,plan:route.plan,authoredPlan:{...route.authoredPlan,camera:route.authoredPlan.camera.map((s,i)=>i===3?{...s,elevation:40*DEG}:s)},contacts:route.contacts,transfers:route.transfers,boundaries:route.boundaries}),oldCamera=new PerspectiveCamera();old.resize(1280/800);old.apply(oldCamera,t,false);
 const link=f.probe.plan.connectors.find(c=>c.from===6&&c.to===5)!;geometry=villageChannelGeometry(link.points,f.probe.plan.profile,{start:undefined,end:undefined});const model=new Mesh(geometry,material);model.matrixAutoUpdate=false;model.matrix.copy(f.probe.machine.staticSolids[6]!.matrixWorld);model.matrixWorldNeedsUpdate=true;
 const key=(a:SurfaceTriangle)=>{const p=[a.a,a.b,a.c].map(v=>v.toArray().join('/'));return[p.join('|'),[p[1],p[2],p[0]].join('|'),[p[2],p[0],p[1]].join('|')].sort()[0]!;},expected=surfaceTriangles(model),keys=new Set(expected.map(key)),native=surfaceTriangles(f.world.scene).filter(a=>keys.has(key(a)));expect(native.length).toBe(expected.length);expect(new Set(native.map(key)).size).toBe(expected.length);
 const center=new Vector3(),before=new Vector3(),after=new Vector3();route.sample(t,center);route.sample(t-.0001,before);route.sample(t+.0001,after);const tangent=after.sub(before).normalize(),section=contactSectionRadius(f.probe.plan.profile,f.probe.plan.stations.find(s=>s.stop===6)!.entry.width),floorNames=new Set(['village-track-connector-6-5']);
 const hits=(camera:PerspectiveCamera)=>{const view=center.clone().sub(camera.position),d=view.length();view.normalize();const right=view.clone().cross(camera.up).normalize(),up=right.clone().cross(view).normalize(),circle=center.clone().addScaledVector(view,-.09/d),radius=.3*Math.sqrt(1-.09/d**2),target=circle.addScaledVector(right,radius*Math.cos(9*Math.PI/8)).addScaledVector(up,radius*Math.sin(9*Math.PI/8)),delta=target.clone().sub(camera.position),distance=delta.length(),ray=new Ray(camera.position,delta.divideScalar(distance));return native.flatMap(a=>{const point=ray.intersectTriangle(a.a,a.b,a.c,false,new Vector3());return point&&point.distanceTo(camera.position)<distance-.002?[{index:a.index,floor:intendedFloorHit('village-track-connector-6-5',point,center,tangent,floorNames,section)}]:[];});};
 expect(oldCamera.position.toArray()).toEqual([.5,18.04132741310386,12.852977748617516]);const negative=hits(oldCamera);expect(negative.some(h=>h.floor)).toBe(true);expect(negative.some(h=>!h.floor)).toBe(true);expect(hits(f.world.camera)).toEqual([]);
 }finally{geometry?.dispose();material.dispose();f.dispose();}
});
