import {Vector3} from 'three';
/** Feasible compressive Coulomb forces at the two actual rail normals.
 * The returned witness is checked explicitly; a failed iterative solve never
 * silently supplies lateral force or relaxes the coefficient of friction. */
export function railContactForces(force:Vector3,normal:Vector3,side:Vector3,mu:number):readonly [Vector3,Vector3]|undefined {
 const sin=.22/.355,cos=Math.sqrt(1-sin*sin);
 const left=normal.clone().multiplyScalar(cos).addScaledVector(side,sin),right=normal.clone().multiplyScalar(cos).addScaledVector(side,-sin);
 const project=(value:Vector3,axis:Vector3)=>{
  const axial=value.dot(axis),tangent=value.clone().addScaledVector(axis,-axial),length=tangent.length();
  if(axial>=0&&length<=mu*axial)return value.clone();
  if(axial+mu*length<=0)return new Vector3();
  const n=(axial+mu*length)/(1+mu*mu);
  return axis.clone().multiplyScalar(n).addScaledVector(tangent,length?mu*n/length:0);
 };
 const valid=(value:Vector3,axis:Vector3)=>{const n=value.dot(axis);return n>=0&&value.clone().addScaledVector(axis,-n).length()<=mu*n+1e-9;};
 let a=force.clone().multiplyScalar(.5);
 for(let iteration=0;iteration<256;iteration++){
  a=project(a,left);
  const b=force.clone().sub(a);
  if(valid(a,left)&&valid(b,right))return [a,b];
  a=force.clone().sub(project(b,right));
 }
 return undefined;
}
