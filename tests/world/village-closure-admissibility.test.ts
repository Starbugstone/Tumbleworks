import {expect,it} from 'vitest';
import {Mesh,Triangle,Vector3} from 'three';
import {villageWorld} from './village-world-fixture';
import {surfaceTriangles} from './surface-overlap';
import {assertRotatingHeadClosure,VILLAGE_CONTACT,VILLAGE_HEAD} from '../../src/world/village-contact';
import {VillageCapture} from '../../src/world/village-capture';
import {VillageOrientation} from '../../src/world/village-orientation';
import {Quaternion} from 'three';
const capture=()=>new VillageCapture({incomingSpeed:5.182446379599384,headMass:.001,brakeForce:5,downhillAcceleration:1.7562801153073353,normalAcceleration:9.651506626251471,availableStroke:.3},{mass:.02,radius:.3,centralInertia:.4*.02*.3**2},VILLAGE_CONTACT,VILLAGE_HEAD,5);
it('actual rendered uniform leading 16-gon loses fixed-centre contact while its fork turns',()=>{
 const{world,dispose}=villageWorld(1,true);try{
 const bar=world.scene.getObjectByName('village-9-fork-CylinderGeometry-0');expect(bar).toBeInstanceOf(Mesh);
 if(!(bar instanceof Mesh))throw Error('Actual bar missing');
 const sphere=new Vector3(-.34,0,0),point=new Vector3();
 const distance=(angle:number)=>{
  const geometry=bar.geometry.clone().rotateZ(angle),mesh=new Mesh(geometry);mesh.updateMatrixWorld(true);
  try{return Math.min(...surfaceTriangles(mesh).map(f=>new Triangle(f.a,f.b,f.c).closestPointToPoint(sphere,point).distanceTo(sphere)));}finally{geometry.dispose();}
 };
 expect(distance(0)).toBeCloseTo(.3,8);
 const gap=distance(Math.PI/16)-.3;expect(gap).toBeGreaterThan(.0007);expect(gap).toBeCloseTo(.04*(1-Math.cos(Math.PI/16)),8);
 const c=capture(),phase=c.eventAt(c.centreStop+.05);expect(phase.headReaction).toBeGreaterThan(0);
 expect(()=>assertRotatingHeadClosure(5,.04,16,phase.headReaction)).toThrow(/fork-closure/);
 // The zero-load control does not invent a positive per-bar holding force.
 expect(()=>assertRotatingHeadClosure(5,.04,16,0)).not.toThrow();
 }finally{dispose();}
});
it('isolated planar event orientation preserves spin; this does not enrol the rejected faceted closure',()=>{
 const c=capture(),duration=c.settledAt,q=new Quaternion(),axis=new Vector3(0,0,-1);
 // Compile just the mathematical stationary-head capture trajectory, using
 // current solver angle samples independently of unsupported fork geometry.
 const times=new Set([0,duration,c.centreStop]);for(let i=1;i<Math.ceil(duration*120);i++)times.add(i/120);
 let previous=0;const reference=new Quaternion();
 for(const t of [...times].sort((a,b)=>a-b)){c.sample(t);const angle=c.angle;reference.premultiply(new Quaternion().setFromAxisAngle(axis,angle-previous));previous=angle;}
 c.sample(duration);q.setFromAxisAngle(axis,c.angle);expect(reference.angleTo(q)).toBeLessThan(1e-7);
 // The generic fixed-floor table remains pure and supports its settled endpoint.
 const table=new VillageOrientation(1,.3,(t,p,n)=>{p.set(t,0,0);n.set(0,1,0);},[],()=>{});table.sample(1,q);
 expect(q.angleTo(new Quaternion().setFromAxisAngle(axis,1/.3))).toBeLessThan(1e-7);
});
