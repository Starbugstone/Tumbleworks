import {expect,it} from 'vitest';
import {VillageGravityCarrier} from '../../src/world/village-gravity-carrier';
import {compileMovingRoll,type SurfaceDrive} from '../../src/world/village-moving-contact';
import {LITTLE_HARBOUR} from '../../src/world/villages/little-harbour';
it('matches independent rolling dynamics before and after local reversal, before the hinge stop',()=>{
 const station=LITTLE_HARBOUR.plan.stations.find(s=>s.stop===7)!,m=station.mechanism;
 if(!('pivot' in m))throw new Error('Expected a rocker');
 const coupled=new VillageGravityCarrier(station,0,.75,1.4),rows=coupled.rows;
 const impact=rows.findIndex((row,i)=>i>0&&row.time===rows[i-1]!.time),before=rows[impact-1]!,after=rows[impact]!;
 expect(impact).toBeGreaterThan(0);expect(after.energy).toBeLessThan(before.energy);
 const drive:SurfaceDrive={sourceId:'finite-body-gravity',acceptsOutlet:()=>true,sample:seconds=>{
   const time=Math.min(before.time,seconds);let lo=0,hi=impact-1;
   while(lo+1<hi){const mid=(lo+hi)>>>1;if(rows[mid]!.time<=time)lo=mid;else hi=mid;}
   const a=rows[lo]!,b=rows[hi]!,dt=b.time-a.time,u=(time-a.time)/dt,u2=u*u,u3=u2*u;
   const theta=(2*u3-3*u2+1)*a.angle+(u3-2*u2+u)*dt*a.angularVelocity+(-2*u3+3*u2)*b.angle+(u3-u2)*dt*b.angularVelocity;
   const omega=((6*u2-6*u)*a.angle+(3*u2-4*u+1)*dt*a.angularVelocity+(-6*u2+6*u)*b.angle+(3*u2-2*u)*dt*b.angularVelocity)/dt;
   const alpha=((12*u-6)*a.angle+(6*u-4)*dt*a.angularVelocity+(-12*u+6)*b.angle+(6*u-2)*dt*b.angularVelocity)/(dt*dt);
   const co=Math.cos(theta),si=Math.sin(theta),px=co*m.pivot[0]-si*m.pivot[1],py=si*m.pivot[0]+co*m.pivot[1],angle=theta+(m.deckPitch??0);
   return {origin:[station.anchor[0]+m.pivot[0]-px,station.anchor[1]+m.pivot[1]-py,station.anchor[2]],tangent:[Math.cos(angle),Math.sin(angle),0],normal:[-Math.sin(angle),Math.cos(angle),0],originVelocity:[py*omega,-px*omega,0],originAcceleration:[py*alpha+px*omega*omega,-px*alpha+py*omega*omega,0],angularVelocity:[0,0,omega],angularAcceleration:[0,0,alpha]};
 }};
 for (const [from,to] of [[0,Math.floor(impact/2)],[Math.floor(impact*.8),impact-1]]) {
  const a=rows[from!]!,b=rows[to!]!;
  const independent=compileMovingRoll({...drive,acceptsOutlet:time=>Math.abs(time-b.time)<1e-5},{mass:.02,radius:.3,inertiaFactor:1.4,gravity:9.81,friction:.8},{seconds:a.time,x:a.x,velocity:a.velocity},b.x,b.time+.001,.00025);
  expect(independent.exit.seconds).toBeCloseTo(b.time,5);expect(independent.exit.velocity).toBeCloseTo(b.velocity,5);
 }
});
