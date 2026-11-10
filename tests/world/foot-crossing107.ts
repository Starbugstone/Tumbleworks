import{add,sub,mul,div,cmp,exact,rat,type R}from'./painted-land-rational';import type{FootFacet,FootPoint}from'./complete-foot105';
type V=readonly[R,R,R];const zero=rat(0n),q=(p:FootPoint):V=>p.map(exact)as unknown as V,minus=(a:V,b:V):V=>a.map((x,i)=>sub(x,b[i]!))as unknown as V,dot=(a:V,b:V)=>a.reduce((s,x,i)=>add(s,mul(x,b[i]!)),zero),cross=(a:V,b:V):V=>[sub(mul(a[1],b[2]),mul(a[2],b[1])),sub(mul(a[2],b[0]),mul(a[0],b[2])),sub(mul(a[0],b[1]),mul(a[1],b[0]))];
/** Strict interior plane/interval crossing of actual dyadic triangles. No epsilon.
 * Flush joints/endpoints return false. No mesh-name or material exemption. */
export function footCrossing107(a:FootFacet,b:FootFacet){const A=a.map(q),B=b.map(q),na=cross(minus(A[1]!,A[0]!),minus(A[2]!,A[0]!)),nb=cross(minus(B[1]!,B[0]!),minus(B[2]!,B[0]!)),da=A.map(p=>dot(minus(p,B[0]!),nb)),db=B.map(p=>dot(minus(p,A[0]!),na));if(![da,db].every(d=>d.some(x=>cmp(x,zero)<0)&&d.some(x=>cmp(x,zero)>0)))return false;
 const direction=cross(na,nb),axis=direction.findIndex(x=>cmp(x,zero)!==0);if(axis<0)return false;
 const cuts=(t:V[],d:R[])=>{const points:V[]=[];for(let i=0;i<3;i++){const j=(i+1)%3;if(cmp(d[i]!,zero)===0)points.push(t[i]!);if(cmp(d[i]!,zero)*cmp(d[j]!,zero)<0){const u=div(d[i]!,sub(d[i]!,d[j]!));points.push(t[i]!.map((x,k)=>add(x,mul(u,sub(t[j]![k]!,x))))as unknown as V);}}return points.sort((a,b)=>cmp(a[axis]!,b[axis]!));};
 const ac=cuts(A,da),bc=cuts(B,db),lo=cmp(ac[0]![axis]!,bc[0]![axis]!)>0?ac[0]!:bc[0]!,hi=cmp(ac.at(-1)![axis]!,bc.at(-1)![axis]!)<0?ac.at(-1)!:bc.at(-1)!;if(cmp(lo[axis]!,hi[axis]!)>=0)return false;
 const str=(x:R)=>x.n+'/'+x.d;return{axis,interval:[lo.map(str),hi.map(str)],planeSidesA:da.map(str),planeSidesB:db.map(str),axisLength:str(sub(hi[axis]!,lo[axis]!))};}
