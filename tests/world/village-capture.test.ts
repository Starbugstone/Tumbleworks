import {expect,it} from 'vitest';
import {VillageCapture,VillagePush} from '../../src/world/village-capture';
import {VILLAGE_CONTACT,VILLAGE_HEAD,VillageAdmissibilityError,assertTangentImpact,assertContact} from '../../src/world/village-contact';
const body={mass:.02,radius:.3,centralInertia:.4*.02*.3**2};
const spec={incomingSpeed:5,headMass:.001,brakeForce:5,downhillAcceleration:0,normalAcceleration:9.81,availableStroke:.25};
const make=(values:Partial<typeof spec>={})=>new VillageCapture({...spec,...values},body,VILLAGE_CONTACT,VILLAGE_HEAD,5);
it.each([5.182446379599384,4.436429230767871])('retains spin and balances impulse, force, angular momentum and work at arrival %s',v=>{
 const c=make({incomingSpeed:v,downhillAcceleration:1.7562801153073353,normalAcceleration:9.651506626251471,availableStroke:.3});
 expect(c.impact.spin).toBe(v);expect(c.impact.floorTangentImpulse).toBe(0);expect(c.impact.floorNormalImpulse).toBe(0);
 expect(.02*(c.impact.vAfter-v)).toBeCloseTo(-c.impact.headImpulse,14);expect(.001*c.impact.vAfter).toBeCloseTo(c.impact.headImpulse,14);
 let impulse=0;
 for(const e of c.events){
  expect(.02*e.a).toBeCloseTo(.02*c.spec.downhillAcceleration+e.floorFriction-e.headReaction,13);
  expect(.001*e.a).toBeCloseTo(.001*c.spec.downhillAcceleration+e.headReaction-e.brake,13);
  expect(.02*.4*e.spinRate).toBeCloseTo(-e.floorFriction,13);
  expect(e.headReaction).toBeGreaterThanOrEqual(0);expect(Math.abs(e.brake)).toBeLessThanOrEqual(5);expect(Math.abs(e.floorFriction)).toBeLessThanOrEqual(.8*e.floorNormal);
  for(const u of [.25,.5,.75]){const t=e.start+(e.end-e.start)*u;c.sample(t);expect(e.floorFriction*(c.speed-c.spin)).toBeLessThanOrEqual(1e-13);}
  impulse+=e.floorFriction*(e.end-e.start);
 }
 expect(impulse).toBeCloseTo(.02*.4*v,13);expect(c.work.residual).toBeCloseTo(0,13);
 expect(c.settledAt).toBeCloseTo(v*.4/(.8*c.spec.normalAcceleration),13);
 const u=.02*v/.021,a=c.spec.downhillAcceleration+(.8*.02*c.spec.normalAcceleration-5)/.021;
 expect(c.centreStop).toBeCloseTo(-u/a,13);expect(c.stroke).toBeCloseTo(-u*u/(2*a),13);
 c.sample(c.centreStop);expect(c.speed).toBe(0);expect(c.spin).toBeGreaterThan(0);
 c.sample(c.settledAt);expect(c.speed).toBe(0);expect(c.spin).toBe(0);
 expect(Object.isFrozen(c.events)).toBe(true);expect(Object.isFrozen(c.work)).toBe(true);
});
it('seeks identically in reverse and repeated order, and checks finite support/stroke/hold',()=>{
 const c=make(),times=[0,c.centreStop/2,c.centreStop,c.settledAt/2,c.settledAt,100];
 const sample=(t:number)=>{const p={distance:0,speed:0,spin:0,angle:0};c.sample(t,p);return p;};
 const rows=times.map(sample);for(const i of [5,1,3,0,4,2,1])expect(sample(times[i]!)).toEqual(rows[i]);
 expect(()=>make({incomingSpeed:20,brakeForce:1})).toThrow(VillageAdmissibilityError);
 expect(()=>make({normalAcceleration:0})).toThrow(/support-normal/);
 expect(()=>make({downhillAcceleration:-1})).toThrow(/head-compressive/);
});
it('has real zero-arrival/head-limit and admissible rolling controls',()=>{
 expect(make({incomingSpeed:0}).settledAt).toBe(0);
 const limit=make({headMass:0});expect(limit.impact.headImpulse).toBe(0);expect(limit.impact.loss).toBe(0);
 const rolling=make({headMass:0,incomingSpeed:.1,brakeForce:.01,availableStroke:1});expect(rolling.events[0]!.kind).toBe('braking-roll');expect(rolling.work.residual).toBeCloseTo(0,14);
});
it.each([
 [5,'floor-cone',1.3691360324354607,.15442410602002354],
 [1,'floor-cone',1.3691360324354607,.15442410602002354],
 [5,'impact-cone',.001429640380579144,0],
 [1,'impact-cone',.0012238425464187227,0],
 [0,'impact-cone',.0009898325393726066,0],
 [0,'floor-cone',.5411453453058759,.14080847234757926],
] as const)('rejects preserved G29 stop%s %s witness', (stop,check,required,available)=>{
 expect(()=>assertContact(stop,'historical-G29',check,required,available)).toThrow(VillageAdmissibilityError);
 try{assertContact(stop,'historical-G29',check,required,available);}catch(e){expect(e).toMatchObject({stop,check,required,available});}
});
it('rejects the old energy-consistent no-slip impact formula independently',()=>{
 const v=5,u=.028*v/.029;expect(()=>assertTangentImpact(5,.02,.4,v,u,0,.8)).toThrow(/impact-cone/);
 for(const [m,k,h] of [[.02,.4,.001],[.04,.4,.002],[.02,1,.001]]){const u=m!*(1+k!)*v/(m!*(1+k!)+h!);expect(()=>assertTangentImpact(5,m!,k!,v,u,0,.8)).toThrow();}
 expect(()=>assertTangentImpact(5,.02,.4,v,v,0,.8)).not.toThrow();
});
it('cannot restart a retained marble without backed work',()=>{
 expect(()=>new VillagePush(.02,1.4,1,.5,0,0)).toThrow('cannot pay');
 const p=new VillagePush(.02,1.4,1,.5,0,.5);expect(.5*.02*1.4*p.exitSpeed**2).toBeCloseTo(p.work,12);
});
