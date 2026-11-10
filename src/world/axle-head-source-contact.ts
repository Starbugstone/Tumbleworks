import type{Part,V}from'./axle-types';
import{assertAxleHeadSource}from'../view/axle-head-source';
import{exact,rat,add,sub,mul,cmp,type R}from'./rocker-foot';
import{VILLAGE_RADIUS}from'./village-plan';
const Z=rat(0n),dot=(a:readonly R[],b:readonly R[])=>a.reduce((s,v,i)=>add(s,mul(v,b[i]!)),Z),cross=(a:readonly R[],b:readonly R[])=>[sub(mul(a[1]!,b[2]!),mul(a[2]!,b[1]!)),sub(mul(a[2]!,b[0]!),mul(a[0]!,b[2]!)),sub(mul(a[0]!,b[1]!),mul(a[1]!,b[0]!))],difference=(a:readonly R[],b:readonly R[])=>a.map((v,i)=>sub(v,b[i]!));
/** Exact local surface + actual packed cone. Closure is checked independently
 * for the additive material integrals, not inferred from sphere distance. */
export function axleHeadSourceContact(parts:readonly Part[],tick:(n?:number)=>void){
 const head=parts.filter(p=>p.body==='capture-head'),wanted=['stator+','key-pin+','slider+','leading-sleeve+'];
 if(head.length!==4||head.some(p=>!wanted.includes(p.id)||p.frame!=='head-local'||p.solid!==p.render)||new Set(head.map(p=>p.id)).size!==4)throw Error('Complete disjoint four-part head ownership required');
 const cone: R[][]=[],closed=[];let low=Infinity,high=-Infinity;
 for(const part of head){assertAxleHeadSource(part.render,tick);const p=part.render.getAttribute('position'),I=part.render.index,N=I?.count??p.count,edges=new Map<string,number>();
  for(let i=0;i<p.count;i++){tick();if(!(p.getX(i)>=0))throw Error('Head source penetrates its supporting plane');}
  for(let i=0;i<N;i+=3){tick();const vs=[0,1,2].map(j=>{const v=I?I.getX(i+j):i+j;return[p.getX(v),p.getY(v),p.getZ(v)]as V;}),A=vs.map(v=>v.map(exact)),n=cross(difference(A[1]!,A[0]!),difference(A[2]!,A[0]!));if(cmp(dot(n,n),Z)<=0)throw Error('Degenerate actual head facet');
   for(let j=0;j<3;j++){tick();const a=vs[j]!.join('/'),b=vs[(j+1)%3]!.join('/'),key=a<b?a+'|'+b:b+'|'+a;edges.set(key,(edges.get(key)??0)+(a<b?1:-1));}
   const contact=vs.filter(p=>p[0]===0&&p[1]===0);if(part.id==='leading-sleeve+'&&contact.length===2&&n[2]!.n===0n){cone.push(n);for(const v of contact){low=Math.min(low,v[2]);high=Math.max(high,v[2]);}}
  }
  for(const balance of edges.values()){tick();if(balance!==0)throw Error('Open actual head material '+part.id);}closed.push({id:part.id,edges:edges.size});
 }
 if(cone.length!==2||!(low<0&&high>0)||cone.some(n=>cmp(n[0]!,Z)>=0)||cmp(mul(cone[0]![1]!,cone[1]![1]!),Z)>=0)throw Error('Missing finite sleeve contact edge/actual normal cone');
 const [a,b]=cone as[R[],R[]],wa=b[1]!.n<0n?rat(-b[1]!.n,b[1]!.d):b[1]!,wb=a[1]!.n<0n?rat(-a[1]!.n,a[1]!.d):a[1]!,nx=add(mul(wa,a[0]!),mul(wb,b[0]!)),ny=add(mul(wa,a[1]!),mul(wb,b[1]!));
 if(ny.n!==0n||cmp(nx,Z)>=0)throw Error('Actual compressive -X force is outside packed feature cone');tick(12);
 return Object.freeze({rho:VILLAGE_RADIUS,contact:Object.freeze([0,0,0]as V),span:Object.freeze([low,high]),closed:Object.freeze(closed),cone:Object.freeze(cone.map(n=>Object.freeze(n))),normal:Object.freeze([-1,0,0]as V),proof:'Every triangular surface point has x>=0. Sphere centre(-rho,0,0) lies in x<0; closest finite sleeve edge contains(0,0,0), exactly distance rho. Real two-face normal cone positively spans -X. Separate edge-chain closure supports additive material integration.'});
}
