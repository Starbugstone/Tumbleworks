import { Mesh, Triangle, Vector3 } from 'three';
import { expect,it } from 'vitest';
import { retainerParts } from '../../src/view/retainer-parts';
import { pendulumBar } from '../../src/view/pendulum-parts';
import { PendulumProfile } from '../../src/world/pendulum-profile';
import { blankBarContact,type PendulumDrive } from '../../src/world/pendulum-types';
import { surfaceTriangles } from './surface-overlap';
const fixture:PendulumDrive={kind:'pendulum',mass:.001,legacyGuideWork:{friction:.008,stroke:.5},axle:{origin:[-.3,1.6,0],axis:[0,0,1]},bar:{arm:1.6,radius:.04,length:.56,facets:16},stopAngle:1.4*.5,dress:'harbour-bell',footings:[]};
function distance(mesh:Mesh,point:Vector3){mesh.updateWorldMatrix(true,false,true);const nearest=new Vector3();return Math.min(...surfaceTriangles(mesh).map(f=>new Triangle(f.a,f.b,f.c).closestPointToPoint(point,nearest).distanceTo(point)));}
it('FIRST: actual packed profile touches the sphere at intermediate facet poses, without circle substitution',()=>{
 const geometry=pendulumBar(fixture),mesh=new Mesh(geometry);mesh.matrixAutoUpdate=false;
 try{
  const profile=new PendulumProfile(geometry,-.3,1.6),contact=blankBarContact();let checked=0,smoothGap=0;
  for(let i=0;i<=192;i++){
   const q=fixture.stopAngle*i/192;mesh.matrix.makeRotationZ(q).setPosition(-.3,1.6,0);mesh.updateWorldMatrix(true,false);
   if(!profile.sample(q,contact))continue;
   const sphere=new Vector3(contact.x,0,0),storage=8*2**-24*Math.max(1,fixture.bar.arm);
   expect(Math.abs(distance(mesh,sphere)-.3)).toBeLessThan(storage);checked++;
   const bx=-.3+1.6*Math.sin(q),by=1.6*(1-Math.cos(q));
   if(Math.abs(by)<.34){const wrong=new Vector3(bx-Math.sqrt(.34**2-by**2),0,0);smoothGap=Math.max(smoothGap,Math.abs(distance(mesh,wrong)-.3));}
  }
  expect(checked).toBeGreaterThan(50);expect(smoothGap).toBeGreaterThan(.0001);
 }finally{geometry.dispose();}
});
it('retains the old16gon rotating-head gap negative rather than adding a global faceting tolerance',()=>{
 const original=retainerParts('terracotta','rigid-gate'),geometry=original.find(p=>p.id==='leading-sleeve')!.geometry,mesh=new Mesh(geometry);mesh.matrixAutoUpdate=false;mesh.matrix.makeRotationZ(Math.PI/16);
 try{expect(distance(mesh,new Vector3(-.34,0,0))-.3).toBeGreaterThan(.0007);}finally{original.forEach(p=>p.geometry.dispose());}
});
it('packed oracle analytic derivatives agree with an independent finite-difference reference away from feature events',()=>{
 const geometry=pendulumBar(fixture),p=new PendulumProfile(geometry,-.3,1.6),a=blankBarContact(),b=blankBarContact(),c=blankBarContact();
 try{for(const q of [.01,.07,.19,.31,.47]){
  const h=1e-5;if(!p.sample(q,a)||!p.sample(q-h,b)||!p.sample(q+h,c)||a.feature!==b.feature||a.feature!==c.feature)continue;
  expect(a.first).toBeCloseTo((c.x-b.x)/(2*h),6);expect(a.second).toBeCloseTo((c.x-2*a.x+b.x)/(h*h),4);
 }}finally{geometry.dispose();}
});
