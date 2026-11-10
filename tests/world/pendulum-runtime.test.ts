import{readFileSync,writeFileSync}from'node:fs';
import{expect,it}from'vitest';
import{Box3,Matrix4,Mesh,Quaternion,Vector3}from'three';
import{VillageRollingPrefix}from'../../src/world/village-prefix';
import{villageScenePlan}from'../../src/world/village-plans';
import{villageWorld}from'./village-world-fixture';
import{surfaceTriangles}from'./surface-overlap';
const root='output/current/village-layouts/parallel44/kernel/ks54';
it('actual Mill cached poses, full spin, mover identities and bounds survive seek/mode changes without owned query allocation helpers',()=>{
 const f=villageWorld(2,true);try{
  const machine=f.probe.machine,motion=new VillageRollingPrefix(villageScenePlan(2).plan).strikes.find(s=>s.stop===7)!.motion,receipt=JSON.parse(readFileSync(root+'/mill-geometry4.json','utf8')),times=[...new Set<number>(receipt.reports.map((r:{time:number})=>r.time))].sort((a,b)=>a-b),snapshots=new Map<number,number[]>(),quaternion=new Quaternion(),point=new Vector3(),witness={phase:'',floorNormal:0,floorFriction:0,leadingReaction:0,trailingReaction:0,brake:0};
  const mover=machine.root.getObjectByName('village-7-striker')!;expect(mover).toBeDefined();expect(machine.route.contacts.find(c=>c.stop===7)!.moverIds).toEqual(['village-7-striker']);
  const parts:Mesh[]=[];machine.root.traverse(o=>{if(o instanceof Mesh&&o.userData.pendulumPart)parts.push(o);});expect(parts).toHaveLength(11);
  for(const reduced of[false,true])for(const time of reduced?[...times].reverse():times){f.world.film(time,!reduced);f.world.scene.updateMatrixWorld(true);const value=parts.flatMap(p=>p.matrixWorld.toArray());machine.marbleOrientation(time,quaternion);value.push(...quaternion.toArray());if(reduced)expect(value).toEqual(snapshots.get(time));else snapshots.set(time,value);}
  for(const time of [...times].reverse()){machine.apply(time);machine.marbleOrientation(time,quaternion);expect(quaternion.toArray()).toEqual(snapshots.get(time)!.slice(-4));}
  const map=Array.prototype.map,v=Vector3.prototype.clone,q=Quaternion.prototype.clone,m=Matrix4.prototype.clone;let allocations=0;
  Array.prototype.map=function<T,U>(this:T[],callback:(value:T,index:number,array:T[])=>U,thisArg?:unknown):U[]{allocations++;return map.call(this,callback,thisArg)as U[];};Vector3.prototype.clone=function(){allocations++;return v.call(this);};Quaternion.prototype.clone=function(){allocations++;return q.call(this);};Matrix4.prototype.clone=function(){allocations++;return m.call(this);};
  try{for(let i=0;i<10000;i++){const time=motion.contact+(motion.end-motion.contact)*(i%997)/996;motion.sample(time,point);motion.relativeAngle(time);motion.partnerAngle(time);motion.contactWitness(time,witness);machine.marbleOrientation(time,quaternion);}}
  finally{Array.prototype.map=map;Vector3.prototype.clone=v;Quaternion.prototype.clone=q;Matrix4.prototype.clone=m;}
  expect(allocations).toBe(0);
  // Exact angular extrema of every rendered hammer vertex plus all station
  // fixed geometry. Compare tightness as well as containment: no inflated
  // world/local double transform may silently enlarge camera-follow bounds.
  const fixed=machine.groups[7]!.children.find(o=>o.name.endsWith('-static'))!,connector=fixed.children.findIndex(o=>o.name==='village-track-connector-7-6'),owned=new Set(fixed.children.slice(0,connector)),expected=new Box3(),actual=new Box3(),tmp=new Vector3();expect(connector).toBeGreaterThan(0);
  machine.apply(motion.contact);f.world.scene.updateMatrixWorld(true);
  for(const face of surfaceTriangles(f.world.scene)){let keep=false;for(let p:import('three').Object3D|null=face.mesh;p;p=p.parent)if(owned.has(p))keep=true;if(keep)for(const p of[face.a,face.b,face.c])expected.expandByPoint(p);}
  mover.traverse(o=>{if(!(o instanceof Mesh))return;const a=o.geometry.getAttribute('position');for(let i=0;i<a.count;i++){const x=a.getX(i),y=a.getY(i),z=a.getZ(i),angles=[0,motion.drive.stopAngle];for(const phase of[Math.atan2(-y,x),Math.atan2(x,y)])for(let turn=-2;turn<=2;turn++){const q=phase+turn*Math.PI;if(q>0&&q<motion.drive.stopAngle)angles.push(q);}for(const q of angles)expected.expandByPoint(tmp.set(motion.drive.axle.origin[0]+x*Math.cos(q)-y*Math.sin(q),motion.drive.axle.origin[1]+x*Math.sin(q)+y*Math.cos(q),motion.drive.axle.origin[2]+z).applyMatrix4(machine.root.matrixWorld));}});
  expected.expandByPoint(new Vector3(...motion.station.entry.position)).expandByPoint(new Vector3(...motion.station.exit.position)).expandByScalar(.3);machine.contactBounds(7,actual);const round=256*Number.EPSILON*Math.max(1,actual.max.length());for(let i=0;i<3;i++){expect(Math.abs(actual.min.getComponent(i)-expected.min.getComponent(i))).toBeLessThanOrEqual(round);expect(Math.abs(actual.max.getComponent(i)-expected.max.getComponent(i))).toBeLessThanOrEqual(round);}
  writeFileSync(root+'/runtime2.json',JSON.stringify({poses:times.length,modes:2,parts:parts.map(p=>p.name),queries:10000,allocationHelpersCalled:allocations,allocationScope:'Array.map and Three clone hooks plus source inspection of owned query bodies; not a VM-wide allocation or physical-phone performance claim',actualBounds:actual,exactEnvelope:expected,actorEnd:motion.actorEnd,marbleExit:motion.end,filmDuration:machine.route.duration},null,2),{flag:'wx'});
 }finally{f.dispose();}
},120000);
