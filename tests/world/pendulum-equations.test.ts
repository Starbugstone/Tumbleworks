import { expect,it } from 'vitest';
import { PendulumCore } from '../../src/world/pendulum-core';
import { flatSlip } from '../../src/world/pendulum-slip';
import { blankBarContact,type PendulumRate,type PendulumDrive } from '../../src/world/pendulum-types';
import { pendulumParts } from '../../src/view/pendulum-parts';
import { PendulumProfile } from '../../src/world/pendulum-profile';
import { pendulumStation } from './pendulum-fixture';
// Independent equation solve: Newton/Euler, geometric acceleration, normal
// balance and Coulomb equation. No reuse of the reduced scalar denominator.
function solve(a:number[][]):number[]{
 const n=a.length;
 for(let j=0;j<n;j++){
  let pivot=j;for(let i=j+1;i<n;i++)if(Math.abs(a[i]![j]!)>Math.abs(a[pivot]![j]!))pivot=i;
  [a[j],a[pivot]]=[a[pivot]!,a[j]!];const d=a[j]![j]!;if(d===0)throw new Error('Singular reference');
  for(let k=j;k<=n;k++)a[j]![k]=a[j]![k]!/d;
  for(let i=0;i<n;i++)if(i!==j){const f=a[i]![j]!;for(let k=j;k<=n;k++)a[i]![k]=a[i]![k]!-f*a[j]![k]!;}
 }
 return a.map(r=>r[n]!);
}
it('signed push equations agree with an independent coupled matrix and contact power cancels',()=>{
 const station=pendulumStation;
 const d:PendulumDrive={kind:'pendulum',mass:.001,legacyGuideWork:{friction:.008,stroke:.5},axle:{origin:[7.1,3.1,7.5],axis:[0,0,1]},bar:{arm:1.6,radius:.04,length:.56,facets:16},stopAngle:.7,dress:'harbour-bell',footings:[]};
 const parts=pendulumParts(station,d,()=>0);
 try{
  const p=new PendulumProfile(parts.bar,-.3,1.6),core=new PendulumCore(1,d,parts,p),c=blankBarContact();
  for(const q of [.01,.05,.13])for(const sign of [-1,1] as const){
   const state={q,u:1,w:sign===1?.5:2,angle:0,slipWork:0,contactWork:0};p.sample(q,c);
   const out:PendulumRate={q:0,u:0,w:0,angle:0,slipWork:0,contactWork:0,lambda:0,normal:0,friction:0,acceleration:0,slip:0};
   core.rate(state,{kind:'slip',sign},out);
   const H=-c.J,U=core.potentialSlope(q)+core.torque,I=parts.axleInertia;
   const [a,udot,lambda,f,N]=solve([[.02,0,-c.nx,-1,0,0],[0,I,-H,0,0,-U],[1,-c.first,0,0,0,c.second],[0,0,c.ny,0,1,.02*9.81],[0,0,0,1,.8*sign,0]]);
   expect(out.acceleration).toBeCloseTo(a!,11);expect(out.u).toBeCloseTo(udot!,11);expect(out.lambda).toBeCloseTo(lambda!,11);expect(out.friction).toBeCloseTo(f!,11);expect(out.normal).toBeCloseTo(N!,11);
   const v=c.first*state.u,energyRate=.02*v*out.acceleration+.02*.4*state.w*out.w+I*state.u*out.u+core.potentialSlope(q)*state.u;
   expect(energyRate).toBeCloseTo(-out.slipWork-core.torque*state.u,12);
  }
 }finally{parts.parts.forEach(p=>p.geometry.dispose());}
});
it('exact free slip preserves spin/angular history and rejects a too-short straight deck',()=>{
 const s=flatSlip(1,1,2,1);expect(s.duration).toBeGreaterThan(0);expect(s.loss).toBeGreaterThan(0);expect(s.endSpin).toBeCloseTo(s.endSpeed,14);expect(Math.abs(s.residual)).toBeLessThan(128*Number.EPSILON);
 expect(()=>flatSlip(1,1,2,s.distance/2)).toThrow(/striker-slip stroke/);
 expect(s.angle).toBeCloseTo((2*s.duration-.5*s.acceleration*s.duration**2/.4)/.3,14);
});
