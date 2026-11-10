import{expect,it}from'vitest';
import{Vector3}from'three';
import{PendulumFoundation,tractionWitness,anchorComponent,type GroundForce,type Component,type Traction}from'../../src/world/pendulum-foundation';
import{PendulumSupport}from'../../src/world/pendulum-support';
import{blankBarContact}from'../../src/world/pendulum-types';
import{recontactFixture}from'./pendulum-recontact-fixture';
import{pendulumStation}from'./pendulum-fixture';
function integrate(c:Component,t:Traction){const force=new Vector3(),moment=new Vector3();let magnitude=0;for(const a of c.anchors)for(const sx of[-1,1])for(const sz of[-1,1]){const x=a.centre[0]-c.reference[0]+sx*a.halfX/Math.sqrt(3),y=a.centre[1]-c.reference[1],z=a.centre[2]-c.reference[2]+sz*a.halfZ/Math.sqrt(3),f=new Vector3(t.b0-t.g*z,t.a0+t.a1*x+t.a2*z,t.c0+t.g*x).multiplyScalar(a.area/4);force.add(f);const torque=new Vector3(x,y,z).cross(f);moment.add(torque);magnitude+=f.length()+torque.length();}return{force,moment,roundoff:256*Number.EPSILON*Math.max(1,magnitude)};}
const scratch=():GroundForce=>({kind:'force',time:0,component:'journal-frame',source:'free',coulomb:0,force:[0,0,0],moment:[0,0,0],minimumNormalTraction:0,tensile:false,traction:{a0:0,a1:0,a2:0,b0:0,c0:0,g:0}});
it('O2 finite signed traction reconstructs all6 loads, including noncoplanar and mixed moments',()=>{
 const f=recontactFixture();try{const support=PendulumSupport.enrol(pendulumStation,f.drive,f.parts),foundation=PendulumFoundation.enrol(pendulumStation,f.drive,f.parts,support);
  const components=[...foundation.components];const original=components[0]!;components.push(anchorComponent('journal-frame',original.parts,original.anchors.map((a,i)=>({...a,centre:[a.centre[0]+i*.2,a.centre[1]+i*.1,a.centre[2]]as const,corners:a.corners.map(p=>[p[0]+i*.2,p[1]+i*.1,p[2]]as const)}))));
  for(const c of components)for(let i=0;i<7;i++){const F=[i===0?1:i===6?-2:0,i===1?1:i===6?-3:0,i===2?1:i===6?4:0]as const,M=[i===3?1:i===6?5:0,i===4?1:i===6?-6:0,i===5?1:i===6?7:0]as const,t={a0:0,a1:0,a2:0,b0:0,c0:0,g:0};tractionWitness(c,F,M,t);const r=integrate(c,t);if(i===4){const wrong=integrate(c,{...t,g:-t.g});expect(wrong.moment.distanceTo(new Vector3(...M))).toBeGreaterThan(r.roundoff);}expect(r.force.distanceTo(new Vector3(...F))).toBeLessThan(r.roundoff);expect(r.moment.distanceTo(new Vector3(...M))).toBeLessThan(r.roundoff);}
 }finally{f.dispose();}});
it('O1/O3 independent total momentum includes COMz, spin, floor recipient and finite stop family',()=>{
 const f=recontactFixture();try{
  const foundation=PendulumFoundation.enrol(pendulumStation,f.drive,f.parts,PendulumSupport.enrol(pendulumStation,f.drive,f.parts));
  const atO=(receipts:ReturnType<PendulumFoundation['groundImpulse']>)=>{
   const force=new Vector3(),moment=new Vector3();for(const r of receipts){const c=foundation.components.find(c=>c.id===r.component)!;force.add(new Vector3(...r.impulse));moment.add(new Vector3(...r.angularImpulse)).add(new Vector3(...c.reference).sub(new Vector3(...f.drive.axle.origin)).cross(new Vector3(...r.impulse)));}return{force,moment};
  };
  const hammer=(q:number,du:number)=>{
   const c=Math.cos(q),s=Math.sin(q),[x,y]=f.parts.centre,[xz,yz]=f.parts.axialProducts;
   return{force:new Vector3(-f.parts.mass*du*(s*x+c*y),f.parts.mass*du*(c*x-s*y),0),moment:new Vector3(-(c*xz-s*yz)*du,-(s*xz+c*yz)*du,f.parts.axleInertia*du)};
  };
  for(const q of[0,.2,.413]){
   const c=blankBarContact();expect(f.profile.sample(q,c)).toBe(true);
   const before={v:6,w:6,u:q===0?0:1},r=f.core.impactAt(q,before.v,before.w,before.u,'roll',{gamma:0,slip:0,coneSlope:0,impulse:0},c),du=r.uAfter-before.u;
   const receipt=foundation.groundImpulse(0,'strike-impact',f.core.bearingImpulse(q,du,r.barImpulse,0)),ground=atO(receipt),h=hammer(q,du);
   // The sphere centre is on the real flat deck; its impulse includes the floor.
   const centre=new Vector3(c.x+.3,-f.drive.bar.arm,0),sphereF=new Vector3(.02*(r.vAfter-before.v),0,0),sphereM=centre.clone().cross(sphereF).add(new Vector3(0,0,-.02*.4*.3*(r.wAfter-before.w))),floor=new Vector3(r.floorTangentImpulse,r.floorNormalImpulse,0),floorM=centre.clone().add(new Vector3(0,-.3,0)).cross(floor);
   expect(ground.force.clone().add(floor).distanceTo(h.force.clone().add(sphereF))).toBeLessThan(256*Number.EPSILON);
   expect(ground.moment.clone().add(floorM).distanceTo(h.moment.clone().add(sphereM))).toBeLessThan(256*Number.EPSILON);
   // Assigning the floor to the anchored frame, omitting COMz or freezing spin
   // fails these independent momentum equations for the tilted impacts.
   if(q!==0){expect(floor.length()).toBeGreaterThan(0);expect(ground.force.distanceTo(h.force.clone().add(sphereF))).toBeGreaterThan(1e-8);expect(h.moment.x*h.moment.x+h.moment.y*h.moment.y).toBeGreaterThan(1e-8);}
  }
  const q=f.drive.stopAngle,normal=[Math.cos(q),Math.sin(q)]as const,du=-1,h=hammer(q,du),family=foundation.stopFamily;
  for(const[delta,z]of[[0,-.22],...family.delta.flatMap(d=>family.z.map(z=>[d,z]))]as readonly(readonly number[])[]){
   const P=-f.parts.axleInertia*du/(f.drive.bar.arm-delta!),r=foundation.groundImpulse(0,'bell',f.core.bearingImpulse(q,du,[-P*normal[0],-P*normal[1]],z!),{impulse:P,normal,delta:delta!,z:z!,angle:q,member:delta===0?'declared':'family-corner'}),ground=atO(r);
   expect(ground.force.distanceTo(h.force)).toBeLessThan(256*Number.EPSILON);expect(ground.moment.distanceTo(h.moment)).toBeLessThan(256*Number.EPSILON);
   expect(r[1]!.impulse[1]).toBeLessThan(0);for(const mu of[0,.8,1e6])expect(r[1]!.impulse[1]>=0&&Math.abs(r[1]!.impulse[0])<=mu*r[1]!.impulse[1]).toBe(false);
  }
 }finally{f.dispose();}});
it('O4 signed Coulomb torque is included once, and transported to the finite component reference',()=>{
 const f=recontactFixture();try{const foundation=PendulumFoundation.enrol(pendulumStation,f.drive,f.parts,PendulumSupport.enrol(pendulumStation,f.drive,f.parts)),out=scratch();
 for(const q of[0,.1,.35,.7])for(const phase of['free','return','rest']as const)for(const speed of[0,1,3]){const u=phase==='return'?-speed:phase==='rest'?0:speed,Tb=phase==='free'?-f.core.torque:phase==='return'?f.core.torque:f.core.potentialSlope(q),alpha=phase==='rest'?0:(-f.core.potentialSlope(q)+Tb)/f.parts.axleInertia,w=f.core.bearingWrench(q,u,alpha,0);foundation.groundForce(0,phase,w,Tb,out);const r=integrate(foundation.components[0]!,out.traction);expect(r.force.distanceTo(new Vector3(...out.force))).toBeLessThan(r.roundoff);expect(r.moment.distanceTo(new Vector3(...out.moment))).toBeLessThan(r.roundoff);const OminusC=new Vector3(...f.drive.axle.origin).sub(new Vector3(...foundation.components[0]!.reference)),atO=new Vector3(...out.moment).sub(OminusC.cross(new Vector3(...out.force)));expect(Math.abs(atO.z-Tb)).toBeLessThan(128*Number.EPSILON*Math.max(1,out.moment[2],OminusC.length()*new Vector3(...out.force).length()));}
 }finally{f.dispose();}});
it('O5 invalid attachment/height/graph, forged certification and nonfinite or wrong-kind loads reject',()=>{
 const f=recontactFixture();try{const support=PendulumSupport.enrol(pendulumStation,f.drive,f.parts),foundation=PendulumFoundation.enrol(pendulumStation,f.drive,f.parts,support);expect(PendulumFoundation.certified({},1)).toBe(false);
 for(const id of['bell-foot','frame-cap','bell-return']){const original=f.parts.parts.find(p=>p.id===id)!,g=original.geometry.clone().translate(0,.01,0);try{expect(()=>PendulumFoundation.enrol(pendulumStation,f.drive,{...f.parts,parts:f.parts.parts.map(p=>p===original?{...p,geometry:g}:p)},support)).toThrow(/striker/);}finally{g.dispose();}}
 expect(()=>PendulumFoundation.enrol(pendulumStation,{...f.drive,footings:[f.drive.footings[1]!,f.drive.footings[0]!,f.drive.footings[2]!]},f.parts,support)).toThrow(/striker/);
 expect(()=>foundation.groundForce(0,'free',{force:[NaN,0,0],moment:[0,0,0],axialTerms:[]},0,scratch())).toThrow(/Nonfinite/);
 const wrench={force:[0,0,0]as const,moment:[0,0,0]as const,axialTerms:[]};const before=JSON.stringify(wrench);foundation.groundForce(0,'rest',wrench,0,scratch());expect(JSON.stringify(wrench)).toBe(before);expect(()=>foundation.groundImpulse(0,'bell',wrench)).toThrow(/recipient/);
 const bad={...scratch(),kind:'impulse'}as unknown as GroundForce;expect(()=>foundation.groundForce(0,'free',{force:[0,0,0],moment:[0,0,0],axialTerms:[]},0,bad)).toThrow(/Wrong force/);
 }finally{f.dispose();}});
