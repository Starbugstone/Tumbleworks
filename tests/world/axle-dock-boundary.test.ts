import{it,expect,vi}from'vitest';
import*as floorCap from'../../src/view/axle-floor-cap';
import{oldAxleCap}from'./axle-old-cap';
import{Mesh,Vector3,Box3}from'three';
import{axleCandidateFixture}from'./axle-candidate-fixture';
import{villageChannelGeometry}from'../../src/view/machine-primitives';
import{exactJointIntersection}from'./axle-exact-joint-oracle';
import{rawTriangles}from'./axle-weld-oracle';
import{coplanarOverlap}from'./surface-overlap';
import{exactAxleSurfaceClosure,assertNoAxleExposedJoint,matchAxleNativeSource}from'../../src/world/axle-native';
import{exact}from'../../src/world/rocker-foot';
import{closeFixedChannel}from'../../src/view/axle-solid';
import type{Part,NativePart}from'../../src/world/axle-types';
import type{VillagePort}from'../../src/world/village-plan';

it('actual capB exposed boundary rejects despite a real embedded weld and the old thin-seam false negative',()=>{
 const real=floorCap.embeddedFloorCap,spy=vi.spyOn(floorCap,'embeddedFloorCap').mockImplementation((track,x,h,bottom)=>{const cap=real(track,x,h,bottom);cap.geometry.dispose();return{...cap,geometry:oldAxleCap(track,x,bottom)};});let x:ReturnType<typeof axleCandidateFixture>;try{x=axleCandidateFixture();}finally{spy.mockRestore();}const station=x.machine.plan.stations.find(s=>s.stop===5)!,geometry=villageChannelGeometry((station.mechanism as{points:readonly VillagePort[]}).points,'timber');
 try{
  const cap=x.binding.parts.find(p=>p.id==='dock-cap-b')!,native=x.binding.nativeParts().find(p=>p.id===cap.id)!,A=rawTriangles(native.geometry,native.toWorld,native.first,native.count),B=rawTriangles(geometry),counter=exactJointIntersection(A[12]!,B[4]!);
  expect(counter.kind).toBe('coplanar');if(counter.kind!=='coplanar')throw new Error('Expected actual source witness');expect(counter.sameFacing).toBe(true);expect(counter.value).toBeGreaterThan(4e-9);const all=A.flatMap((a,ia)=>B.map((b,ib)=>({ia,ib,hit:exactJointIntersection(a,b)}))).filter(r=>r.hit.kind==='coplanar'&&r.hit.sameFacing&&r.hit.value>0);expect(all).toHaveLength(3);expect(all.reduce((sum,r)=>sum+(r.hit.kind==='coplanar'?r.hit.value:0),0)).toBe(8.188953757366494e-9);
  const surface=(t:number[][])=>{const[a,b,c]=t.map(v=>new Vector3(...v))as[Vector3,Vector3,Vector3];return{a,b,c,normal:b.clone().sub(a).cross(c.clone().sub(a)).normalize(),bounds:new Box3().setFromPoints([a,b,c]),mesh:native.mesh as Mesh,index:0};};
  expect(coplanarOverlap(surface(A[12]!),surface(B[4]!))).toBeUndefined();expect(coplanarOverlap(surface(A[12]!),surface(B[4]!),0)?.area).toBeGreaterThan(4e-9);
  const closed=closeFixedChannel(geometry),material:Part={id:'actual-old-capB-flume',body:'static',frame:'world',render:geometry,solid:closed,nominal:{}},matches:NativePart[]=[];try{x.machine.groups[5]!.traverse(o=>{if(o instanceof Mesh)matches.push(...matchAxleNativeSource(x.motion.station,material,o));});expect(matches).toHaveLength(1);expect(()=>assertNoAxleExposedJoint(x.motion.station,cap,native,material,matches[0]!)).toThrow(/exposed-overlap/);}finally{closed.dispose();}
  const input=()=>({parts:x.binding.nativeParts(),land:x.land,sceneRoot:x.f.world.scene,canonical:x.binding.parts,model:x.motion,binding:x.binding,machine:x.machine});
  expect(()=>x.motion.certifyNative(input())).toThrow(/exposed-overlap/);expect(x.motion.proof.state).toBe('pending');expect(x.machine.route.motionStatus.state).toBe('authoring');
  expect(()=>x.motion.certifyNative({...input(),parts:input().parts.filter(p=>p.id!==cap.id)})).toThrow(/complete/);
  expect(()=>x.motion.certifyNative({...input(),canonical:input().canonical.filter(p=>p.id!==cap.id)})).toThrow(/owned carrier/);
  const foreign=new Mesh(native.geometry);expect(()=>x.motion.certifyNative({...input(),parts:input().parts.map(p=>p.id===cap.id?{...p,mesh:foreign}:p)})).toThrow(/foreign/);
  const raised=cap.render.clone().translate(0,.001,0);const rn=raised.getAttribute('normal'),sn=cap.render.getAttribute('normal');for(let i=0;i<rn.count;i++)rn.setXYZ(i,sn.getX(i),sn.getY(i),sn.getZ(i));const p=native.geometry.getAttribute('position'),saved=Array.from({length:native.count},(_,i)=>p.getY(native.first+i));
  try{for(let i=0;i<native.count;i++)p.setY(native.first+i,saved[i]!+.001);expect(()=>x.motion.certifyNative({...input(),canonical:input().canonical.map(part=>part===cap?{...part,render:raised,solid:raised}:part)})).toThrow(/owned carrier/);}finally{for(let i=0;i<native.count;i++)p.setY(native.first+i,saved[i]!);raised.dispose();}
  // Restoration is local; repeating an already-rejected complete issue would spend the same shared work again.
  expect(()=>x.machine.axleSpliceInspection(x.machine.plan.connectors.find(c=>c.from===7)!)).not.toThrow();
 }finally{geometry.dispose();x.dispose();}
},60000);

it('exact geometric edge partition accepts a real T junction and rejects a near-match, missing face and duplicate face',()=>{
 const A=[0,0,0],B=[2,0,0],C=[0,2,0],D=[0,0,2],M=[1,0,0],faces=[[A,C,M],[M,C,B],[A,B,D],[A,D,C],[B,C,D]],run=(ts:readonly(readonly(readonly number[])[])[])=>exactAxleSurfaceClosure(ts.map(t=>t.map(p=>p.map(exact))));
 expect(run(faces).closed).toBe(true);expect(run(faces).splitEdges).toBeGreaterThan(0);expect(run(faces.slice(1)).closed).toBe(false);expect(run([...faces,faces[0]!]).closed).toBe(false);expect(run(faces.map(t=>t.map(p=>p===M?[1,0,2**-40]:p))).closed).toBe(false);
});
