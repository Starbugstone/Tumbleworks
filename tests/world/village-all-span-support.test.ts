import {expect,it} from 'vitest';
import {villagePort} from '../../src/world/village-plan';
import {VillageRollingRun} from '../../src/world/village-rolling';
const crest=Array.from({length:41},(_,i)=>{const x=(i-20)/20,y=1-x*x/2;return villagePort([x,y,0],[1/Math.hypot(1,x),-x/Math.hypot(1,x),0],[x/Math.hypot(1,x),1/Math.hypot(1,x),0]);});
it('rejects an unpowered convex hump even though energy reaches its supported-looking floor',()=>{
 expect(()=>new VillageRollingRun([{stop:7,kind:'contact',points:crest}],5)).toThrow(/support/);
});
it('cannot bypass crest support by splitting at an ordinary inter-span seam',()=>{
 expect(()=>new VillageRollingRun([{stop:7,kind:'contact',points:crest.slice(0,21)},{stop:7,kind:'connector',points:crest.slice(20)}],5)).toThrow(/support/);
});
it('rejects lateral traction demand through an unbanked floor bend',()=>{
 const points=Array.from({length:41},(_,i)=>{const a=i*Math.PI/80;return villagePort([Math.sin(a),0,Math.cos(a)],[Math.cos(a),0,-Math.sin(a)]);});
 expect(()=>new VillageRollingRun([{stop:7,kind:'connector',points}],5)).toThrow(/traction/);
});
it('accepts the same crest at supported low speed with real energy to cross it',()=>{
 expect(()=>new VillageRollingRun([{stop:7,kind:'contact',points:crest}],2.8)).not.toThrow();
});

import {Vector3} from 'three';
import {railContactForces} from '../../src/world/village-rail-contact';
it('resolves both real rail friction cones, including lateral force beyond normal-only support',()=>{
 const normal=new Vector3(0,1,0),side=new Vector3(0,0,1),sin=.22/.355,cos=Math.sqrt(1-sin*sin);
 const a=normal.clone().multiplyScalar(cos).addScaledVector(side,sin),b=normal.clone().multiplyScalar(cos).addScaledVector(side,-sin);
 const force=a.clone().multiplyScalar(10).addScaledVector(new Vector3(0,-sin,cos),5).addScaledVector(b,.1);
 const witness=railContactForces(force,normal,side,.8);expect(witness).toBeDefined();
 expect(witness![0].clone().add(witness![1]).distanceTo(force)).toBeLessThan(1e-8);
 for(const [f,n] of [[witness![0],a],[witness![1],b]]){const load=f!.dot(n!);expect(load).toBeGreaterThanOrEqual(0);expect(f!.clone().addScaledVector(n!,-load).length()).toBeLessThanOrEqual(.8*load+1e-9);}
 expect(railContactForces(new Vector3(100,1,0),normal,side,.8)).toBeUndefined();
});
it('checks the seam when adjacent rolling pieces are compiled separately',()=>{
 const a=villagePort([-1,-.1,0]),b=villagePort([0,0,0]),c=villagePort([1,-.1,0]);
 const left=new VillageRollingRun([{stop:8,kind:'contact',points:[a,b]}],8);
 expect(()=>new VillageRollingRun([{stop:8,kind:'connector',points:[b,c]}],left.exitSpeed)).not.toThrow();
 expect(()=>new VillageRollingRun([{stop:8,kind:'connector',points:[b,c]}],left.exitSpeed,0,9.81,0,1.4,{precedingPoint:a})).toThrow(/support/);
});
it('uses the rail contact radius for rolling inertia instead of silently accepting floor inertia',()=>{
 const points=[villagePort([0,1,0]),villagePort([1,.9,0])],span={stop:9,kind:'contact' as const,points};
 expect(()=>new VillageRollingRun([span],1,0,9.81,0,1.4,{profile:'twinrail'})).toThrow(/inertia/);
 expect(()=>new VillageRollingRun([span],1,0,9.81,0,1+.4/(1-(.22/.355)**2),{profile:'twinrail'})).not.toThrow();
});
