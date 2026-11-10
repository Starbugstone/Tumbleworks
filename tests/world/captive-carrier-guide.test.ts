import{it,expect,vi}from'vitest';import{Matrix4,Vector3,Mesh}from'three';
import{VillageProgram}from'../../src/world/village-program';import{VillageRollingPrefix}from'../../src/world/village-prefix';
import{villageScenePlan}from'../../src/world/village-plans';import{CarriageBrake}from'../../src/world/village-carriage-guide';
import*as welds from'../../src/world/village-captive-welds';import{VillageCapture}from'../../src/world/village-capture';
import{villageWorld}from'./village-world-fixture';import{legacyGarden}from'./captive-leaf-fixture';import{record55}from'./captive-leaf-record';
function prefix(route:VillageProgram){const p:unknown=(route as unknown as{prefix?:unknown}).prefix;if(!(p instanceof VillageRollingPrefix))throw new Error('Actual cached prefix missing');return p;}
function sum(rows:readonly{point:readonly number[];force:readonly number[];torque:readonly number[]}[],origin=new Vector3()){
 const f=new Vector3(),m=new Vector3();let scale=1;for(const r of rows){const q=new Vector3(...r.force as[number,number,number]),p=new Vector3(...r.point as[number,number,number]).sub(origin);f.add(q);m.add(p.clone().cross(q)).add(new Vector3(...r.torque as[number,number,number]));scale+=q.length()*(1+p.length());}return{f,m,bound:128*Number.EPSILON*scale};
}
it('keeps pure opt-in compilation pending until ACTUAL native welds and stop1 fixed post have certified',()=>{
 const pure=new VillageProgram(villageScenePlan(1).plan);record55('gr58-before-native-readiness',{status:pure.motionStatus,admissibility:pure.admissibility});
 expect(pure.motionStatus.state).toBe('authoring');expect(()=>pure.requirePhysical()).toThrow();
 const captured:Parameters<typeof welds.certifyCarrierWelds>[]=[];const original=welds.certifyCarrierWelds,spy=vi.spyOn(welds,'certifyCarrierWelds').mockImplementation((...args)=>{captured.push(args);return original(...args);});
 let f:ReturnType<typeof villageWorld>|undefined;try{f=villageWorld(1,true);const r=f.probe.machine.route;r.requirePhysical();expect(r.motionStatus.state).toBe('ready');expect(captured).toHaveLength(2);
 for(const[owner,parts,last,profile,vertical]of captured){expect(welds.carrierWeldsCertified(owner)).toBe(true);expect(()=>original({},new Map([...parts].filter(([id])=>id!=='yoke')),last,profile,vertical)).toThrow('Missing');
  const beam=parts.get('beam')!,saved=beam.mesh.position.x;try{beam.mesh.position.x+=.001;expect(()=>original({},parts,last,profile,vertical)).toThrow('transform');}finally{beam.mesh.position.x=saved;beam.mesh.updateMatrix();}
  const source=beam.mesh.geometry,shift=source.clone().translate(.001,0,0);try{beam.mesh.geometry=shift;expect(()=>original({},parts,last,profile,vertical)).toThrow('positions');}finally{beam.mesh.geometry=source;shift.dispose();}
 }
 const m=prefix(r).retained.find(m=>m.station.stop===1)!;const post=f.world.scene.getObjectByName('village-rim-post-1'),collar=f.world.scene.getObjectByName('village-carriage-caliper-1');if(!(post instanceof Mesh)||!(collar instanceof Mesh))throw new Error('Actual unbatched fixed post/collar missing');
 const rest=new Matrix4();r.carrierPose(1,m.start,rest);post.updateWorldMatrix(true,false);const b=CarriageBrake.enrol(m.station,'terracotta')!;expect(CarriageBrake.fixedSideCertified(b,1)).toBe(false);
 const shifted=post.geometry.clone().translate(.001,0,0);try{expect(()=>b.certifyRenderedPost(m.station,'terracotta',shifted,post.matrixWorld,collar.geometry,rest)).toThrow();expect(CarriageBrake.fixedSideCertified(b,1)).toBe(false);}finally{shifted.dispose();}
 expect(()=>b.certifyRenderedPost(m.station,'terracotta',post.geometry,post.matrixWorld,collar.geometry,rest)).not.toThrow();expect(CarriageBrake.fixedSideCertified(b,1)).toBe(true);
 record55('gr58-native-load-path',{status:r.motionStatus,owners:captured.map(([,parts])=>[...parts].map(([id,p])=>({id,mesh:p.mesh.name,local:p.mesh.matrix.toArray(),triangles:(p.mesh.geometry.index?.count??p.mesh.geometry.getAttribute('position').count)/3}))),fixedPost:{name:post.name,world:post.matrixWorld.toArray()},collarRest:rest.toArray()});
 }finally{f?.dispose();spy.mockRestore();}
});
it('independently reconstructs CURRENT capture/closure/carry/leaf release wrenches and retains source9 exact',()=>{
 const f=villageWorld(1,true);try{const route=f.probe.machine.route;route.requirePhysical();const now=prefix(route),old=legacyGarden().prefix,current9=now.retained.find(m=>m.station.stop===9)!,old9=old.retained.find(m=>m.station.stop===9)!;
 const data=(m:typeof current9)=>({inventory:m.inventory,capture:m.capture,start:m.start,carryStart:m.carryStart,carryEnd:m.carryEnd,end:m.end,opening:m.opening,closing:m.closing,carryAudit:m.carryAudit,ledger:m.physicalLedger,source:{sources:m.ledger.sources,draws:m.ledger.draws,remaining:m.ledger.available(m.sourceId)}});
 expect(JSON.parse(JSON.stringify(data(current9)))).toEqual(JSON.parse(JSON.stringify(data(old9))));
 for(const m of now.retained.filter(m=>m.inventory.layout==='keyed-prismatic')){
  const c=m.capture!,replay=new VillageCapture(c.spec,c.body,c.contact,c.head,m.station.stop);for(const key of['spec','impact','events','centreStop','settledAt','stroke','work']as const)expect(replay[key]).toEqual(c[key]);
  const times=new Set([m.start,m.closureStart,m.closureEnd,m.carryStart,m.carryEnd,m.openingEnd,m.end,...c.events.flatMap(e=>[m.start+e.start,m.start+e.end])]);for(let i=0;i<=Math.ceil((m.end-m.start)*240);i++)times.add(Math.min(m.end,m.start+i/240));
  const rows=[];for(const time of[...times].sort((a,b)=>a-b)){const w=m.captiveWitness(time),pose={localX:0,progress:0,forkX:0,forkAngle:0,forkLift:0,headLift:0,weightDrop:0};m.state(time,pose);
   for(const [body,reactions,origin]of[[w.leaf,w.leafReactions,new Vector3(0,pose.headLift,-.95)],[w.frame,w.frameReactions,new Vector3()]]as const){const a=sum(reactions,origin);expect(a.f.distanceTo(new Vector3(...body.force).negate())).toBeLessThanOrEqual(a.bound);expect(a.m.distanceTo(new Vector3(...body.moment).negate())).toBeLessThanOrEqual(a.bound);}
   const j=sum(w.forkReactions);expect(j.f.distanceTo(new Vector3(...w.forkJointForce))).toBeLessThanOrEqual(j.bound);expect(j.m.distanceTo(new Vector3(...w.forkJointMoment))).toBeLessThanOrEqual(j.bound);
   expect(w.frameReactions.filter(r=>r.joint==='J3').length).toBeLessThanOrEqual(1);if(time>=m.carryEnd){expect(pose.forkLift).toBe(0);expect(pose.forkAngle).toBe(0);}
   rows.push({time,phase:w.phase,frameBrake:w.frameBrakeUse,leafBrake:w.leafBrakeUse,preOpeningHold:w.preOpeningHold,pose});
  }
  record55(`gr58-current-phase-witness-${m.station.stop}`,{capture:c.impact,opening:m.opening,carry:m.carryAudit,ledger:m.physicalLedger,rows});
 }
 }finally{f.dispose();}
},120000);
