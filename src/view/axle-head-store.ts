import type{AxleKinematics}from'../world/axle-kinematics';
import type{Part}from'../world/axle-types';
import{VILLAGE_RADIUS}from'../world/village-plan';
import{rat,exact,add,sub,mul,div,cmp,number,type R}from'../world/rocker-foot';
const scratch=new ArrayBuffer(4),f=new Float32Array(scratch),u=new Uint32Array(scratch);
/** Positive finite binary32 neighbour; no allocation in absolute-pose queries. */
export function headStoreUp(x:number){if(!(x>0&&Number.isFinite(x)&&Math.fround(x)===x))throw Error('Head store requires positive binary32');f[0]=x;u[0]=u[0]!+1;return f[0]!;}
const Z=rat(0n),O=rat(1n),abs=(x:R)=>rat(x.n<0n?-x.n:x.n,x.d),sum=(...x:R[])=>x.reduce(add,Z),gamma=(n:number)=>{const a=mul(rat(BigInt(n)),exact(Number.EPSILON/2));return div(a,sub(O,a));};
/** Constructor-only conditional operator bound for BOTH real pose images.
 * Includes non-unit c/s and head post-translation; F32 storage is separate. */
export function headOperatorObservation(k:AxleKinematics,sourceL1:number,headMaximum:number){
 const trig=exact(8*Number.EPSILON),scale=add(O,trig),S=exact(sourceL1),H=exact(headMaximum),sphere=exact(.8),origin=sum(...k.O.map(x=>abs(exact(x)))),pin=sum(...k.pin.map(x=>abs(exact(x)))),translation=sum(origin,mul(rat(2n),exact(k.R)),mul(rat(2n),mul(scale,pin))),translationError=mul(gamma(8),translation),translationBound=add(translation,translationError),post=mul(gamma(2),sum(translationBound,mul(rat(2n),mul(scale,H)))),pointHead=mul(gamma(6),sum(translationBound,post,mul(rat(3n),mul(scale,add(S,H))))),pointSphere=mul(gamma(6),sum(translationBound,mul(rat(3n),mul(scale,sphere)))),rotation=sum(mul(rat(2n),mul(trig,sum(S,H,sphere))),mul(gamma(4),sum(S,H,sphere))),E=sum(mul(rat(2n),translationError),post,pointHead,pointSphere,rotation);
 return Object.freeze({E,rigorous:false as const,sourceL1,headMaximum,trace:'L1 dominates Euclidean. gamma8 carrier translation, gamma2 head post-translation, gamma6 each affine point; both 8-adjacent c/s columns compared with the same ideal orthogonal rotation, including non-unit columns. Actual identity ancestors and literal affine Z/w rows must bind at native issue. No Float32 error is included in E.'});
}
/** Three authorized origin stores only. Monotone fround implies every head
 * vertex stays on/outside its contact-edge store plane. Selection compares a
 * Sterbenz-exact origin difference against an upward binary64 observation. */
export class AxleHeadStores {
 readonly observation;readonly #E:number;readonly #lo:number;readonly #hi:number;
 get E(){return this.#E;}get lo(){return this.#lo;}get hi(){return this.#hi;}
 constructor(k:AxleKinematics,parts:readonly Part[],lo:number,hi:number,tick:(n?:number)=>void){
  this.#lo=Math.min(lo,hi);this.#hi=Math.max(lo,hi);if(!(this.lo>0&&this.hi<1))throw Error('Unsupported finite head draw domain');let L=0;
  for(const part of parts.filter(p=>p.body==='capture-head')){const p=part.render.getAttribute('position');for(let i=0;i<p.count;i++){tick();const x=p.getX(i),y=p.getY(i),z=p.getZ(i);if(!(x>=0&&Number.isFinite(x+y+z)))throw Error('Head draw support plane missing');L=Math.max(L,x+Math.abs(y)+Math.abs(z));}}
  this.observation=headOperatorObservation(k,L,this.hi);let E=number(this.observation.E);let steps=0;while(cmp(exact(E),this.observation.E)<0&&steps++<8){E+=Number.EPSILON*E;tick();}if(cmp(exact(E),this.observation.E)<0)throw Error('Head operator observation rounding indeterminate');this.#E=E;
  // Every nearest cell has error >= -half its local spacing. One upward
  // neighbour therefore leaves >= half the minimum spacing on this domain.
  const low=Math.fround(this.lo/2),spacing=headStoreUp(low)-low;tick(16);if(!(spacing/2>E))throw Error('Finite head store family lacks a strict observed margin');
 }
 select(head:number){if(!(head>=this.lo&&head<=this.hi))throw Error('Head outside certified draw origin domain');let store=Math.fround(head);for(let choice=0;choice<3;choice++){if(store-head>this.E)return store;if(choice<2)store=headStoreUp(store);}throw Error('No strictly nonpenetrating finite head draw store');}
 get radius(){return VILLAGE_RADIUS;}
}
