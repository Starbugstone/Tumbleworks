// UNUSED / UNRUN. Original JSON remains byte-identical; this NEW historical
// regression never asks the newly extended producer to remain single-episode.
import{readFileSync}from'node:fs';
import{Matrix4,Mesh,Triangle,Vector3}from'three';
import{expect,it}from'vitest';
import{surfaceTriangles}from'./surface-overlap';
import{manualPendulumPose}from'./pendulum-fixture';
import{recontactFixture}from'./pendulum-recontact-fixture';
function simpson(a:number,b:number,n:number,f:(q:number)=>number){const h=(b-a)/n;let sum=f(a)+f(b);for(let i=1;i<n;i++)sum+=(i%2?4:2)*f(a+i*h);return sum*h/3;}
it('the original actual single-episode continuation still penetrates the unchanged packed bar',()=>{
 const receipt=JSON.parse(readFileSync('tests/world/fixtures/pendulum-single-episode-negative.json','utf8')),f=recontactFixture();
 try{
  const sep=receipt.separation,E=.5*f.parts.axleInertia*sep.u**2+f.core.potential(sep.q),elapsed=receipt.time-sep.time,inv=(q:number)=>1/Math.sqrt(2*(E-f.core.potential(q)-f.core.torque*(q-sep.q))/f.parts.axleInertia);
  const reference=(n:number)=>{let lo=sep.q,hi=f.drive.stopAngle;for(let i=0;i<60;i++){const mid=(lo+hi)/2;if(mid===lo||mid===hi)break;if(simpson(sep.q,mid,n,inv)<elapsed)lo=mid;else hi=mid;}return(lo+hi)/2;};
  const a=reference(256),b=reference(512);expect(Math.abs(a-b)).toBeLessThan(1e-12);
  const mesh=new Mesh(f.parts.bar);manualPendulumPose(mesh,new Matrix4().makeRotationZ(b).setPosition(-2.1999999999999997,3.2,-3));
  const sphere=new Vector3(...receipt.sphere),triangle=new Triangle(),closest=new Vector3();let distance=Infinity;
  for(const face of surfaceTriangles(mesh)){triangle.set(face.a,face.b,face.c).closestPointToPoint(sphere,closest);distance=Math.min(distance,closest.distanceTo(sphere));}
  expect(.3-distance).toBeGreaterThan(.00001);expect(Math.abs(distance-receipt.distance)).toBeLessThan(1e-12);
 }finally{f.dispose();}
});
