// The legacy producer file is deliberately untouched.
import type {LeverState} from './village-gravity-roll';
export interface RockerAssembly {readonly stop:number;readonly pivot:readonly[number,number,number];readonly angle:number;readonly deckPitch:number;readonly entryX:number;readonly exitX:number;readonly radius:number;readonly inertiaFactor:number}
export interface CoupledBody {readonly marbleMass:number;readonly bodyMass:number;readonly bodyCentre:readonly[number,number,number];readonly bearingTorque:number}
/** Arithmetic order of the free/docked legacy evaluate equations is retained.
 * Constraints are selected explicitly by phase; no near-home epsilon/latch. */
export function gravityKernel(assembly:RockerAssembly,spec:CoupledBody,ib:number){
 const {marbleMass:m,bodyMass:mb,bearingTorque:drag}=spec;
 const {pivot:p,deckPitch:phi,radius:r,inertiaFactor:k}=assembly;
 const direction=Math.sign(assembly.angle),c=Math.cos(phi),s=Math.sin(phi),g=9.81;
 const bx=c*spec.bodyCentre[0]-s*spec.bodyCentre[1]-p[0],by=s*spec.bodyCentre[0]+c*spec.bodyCentre[1]-p[1];
 const bodyPivotInertia=ib,mxx=m*k,cross=m*(p[1]*c-p[0]*s-(k-1)*r);
 const evaluate=(state:LeverState,held=false,bearing=-drag*(Math.sign(state.angularVelocity)||direction))=>{
  const co=Math.cos(state.angle),si=Math.sin(state.angle),ex=co*c-si*s,ey=si*c+co*s;
  const ax=c*state.x-p[0],ay=s*state.x-p[1],wx=co*ax-si*ay,wy=si*ax+co*ay;
  const bodyX=co*bx-si*by,bodyY=si*bx+co*by;
  const q=state.x-p[0]*c-p[1]*s;
  const mtt=m*(ax*ax+ay*ay+(k-1)*r*r)+bodyPivotInertia;
  const rhsX=m*q*state.angularVelocity**2-m*g*ey;
  const rhsT=-2*m*q*state.velocity*state.angularVelocity-m*g*wx-mb*g*bodyX+bearing;
  const det=mxx*mtt-cross*cross;
  let acceleration=(rhsX*mtt-cross*rhsT)/det,angularAcceleration=(mxx*rhsT-cross*rhsX)/det;
  const freeAngularAcceleration=angularAcceleration;
  if(held){angularAcceleration=0;acceleration=rhsX/mxx;}
  const axWorld=ex*acceleration-wy*angularAcceleration-2*ey*state.angularVelocity*state.velocity-wx*state.angularVelocity**2;
  const ayWorld=ey*acceleration+wx*angularAcceleration+2*ex*state.angularVelocity*state.velocity-wy*state.angularVelocity**2;
  const reaction=-ey*axWorld+ex*(ayWorld+g),tangent=ex*axWorld+ey*(ayWorld+g);
  const energy=.5*mxx*state.velocity**2+cross*state.velocity*state.angularVelocity+.5*mtt*state.angularVelocity**2+m*g*wy+mb*g*bodyY;
  return {acceleration,angularAcceleration,freeAngularAcceleration,reaction,tangent,energy,normalArm:q,traction:Math.abs(tangent)/reaction,mtt,det,rhsX,rhsT,seatTorque:cross*acceleration-rhsT,axWorld,ayWorld,bodyX,bodyY,wx,wy,ex,ey,bearing};
 };
 return {evaluate,pivot:p,mxx,cross,bx,by,I:ib,m,mb,drag,bodyPotential:(angle:number)=>mb*g*(Math.sin(angle)*bx+Math.cos(angle)*by)};
}
export type GravityKernel=ReturnType<typeof gravityKernel>;
export type GravityRate=ReturnType<GravityKernel['evaluate']>;
