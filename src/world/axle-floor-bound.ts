import{exact,rat,add,sub,mul,div,cmp,number,type R}from'./rocker-foot';
export type V=readonly[number,number,number];export type FloorPoint=readonly(number|R)[];const floorCoordinate=(v:number|R)=>typeof v==='number'?exact(v):v;type E=readonly R[];
const Z=rat(0n),O=rat(1n),abs=(x:R)=>x.n<0n?rat(-x.n,x.d):x, max=(xs:R[])=>xs.reduce((a,b)=>cmp(a,b)>0?a:b),dot=(a:E,b:E)=>a.reduce((r,v,i)=>add(r,mul(v,b[i]!)),Z),minus=(a:E,b:E)=>a.map((v,i)=>sub(v,b[i]!)),plus=(a:E,b:E)=>a.map((v,i)=>add(v,b[i]!)),times=(a:E,s:R)=>a.map(v=>mul(v,s)),cross=(a:E,b:E)=>[sub(mul(a[1]!,b[2]!),mul(a[2]!,b[1]!)),sub(mul(a[2]!,b[0]!),mul(a[0]!,b[2]!)),sub(mul(a[0]!,b[1]!),mul(a[1]!,b[0]!))];
const view=new DataView(new ArrayBuffer(8));function next(x:number,up:boolean){if(x===0)return up?Number.MIN_VALUE:-Number.MIN_VALUE;view.setFloat64(0,x);const u=view.getBigUint64(0);view.setBigUint64(0,u+((x>0)===up?1n:-1n));return view.getFloat64(0);}
function root(q:R,tick:()=>void){tick();if(q.n<0n)throw Error('Negative exact squared norm');if(!q.n)return{lo:Z,hi:Z};let lo=Math.sqrt(number(q)),hi=lo;if(!Number.isFinite(lo)||lo===0)throw Error('Unconditioned squared norm');for(let i=0;i<8;i++){lo=next(lo,false);hi=next(hi,true);}const L=exact(lo),H=exact(hi);if(cmp(mul(L,L),q)>0||cmp(mul(H,H),q)<0)throw Error('Square root outside unchanged8-adjacent observation');return{lo:L,hi:H};}
const text=(x:R)=>x.n+'/'+x.d;
/** Every point Q(u) lies on the actual coplanar floor quad. For D=C-r*N/|N|-Q,
 * ||D''|| <=6*r*||N'||^2/min|N|^2. Vector linear-interpolation remainder bounds
 * max||D|| by the max enclosed endpoint norm + M*h^2/8 on EACH parameter cell.
 * Thus the grid is used with an analytical remainder, never as an absence proof. */
export function ordinaryUpper(a:{position:V;normal:V},b:{position:V;normal:V},F0:FloorPoint,F1:FloorPoint,lo:number,hi:number,count:number,tick:()=>void){
 if(!Number.isInteger(count)||count<1||!(lo>=0&&hi<=1&&hi>lo))throw Error('Invalid bounded MC domain');
 const P=a.position.map(exact),dP=minus(b.position.map(exact),P),N=a.normal.map(exact),dN=minus(b.normal.map(exact),N),F=F0.map(floorCoordinate),dF=minus(F1.map(floorCoordinate),F),radius=exact(.3),minY=exact(Math.min(a.normal[1],b.normal[1]));if(cmp(minY,Z)<=0)throw Error('MC normal conditioning');
 const M=div(mul(mul(rat(6n),radius),dot(dN,dN)),mul(minY,minY)),h=div(sub(exact(hi),exact(lo)),rat(BigInt(count))),remainder=div(mul(M,mul(h,h)),rat(8n));let nodeMax=Z;
 for(let j=0;j<=count;j++){tick();const u=add(exact(lo),mul(h,rat(BigInt(j)))),n=plus(N,times(dN,u)),norm=root(dot(n,n),tick),c=plus(P,times(dP,u)),f=plus(F,times(dF,u));let sq=Z;
 for(let k=0;k<3;k++){const A=sub(c[k]!,f[k]!),x=mul(radius,n[k]!),left=sub(A,div(x,norm.lo)),right=sub(A,div(x,norm.hi)),component=max([abs(left),abs(right)]);sq=add(sq,mul(component,component));}nodeMax=max([nodeMax,root(sq,tick).hi]);}
 // Conditional binary64 query model.64 roundoff factors conservatively cover
 // three lerps, length-squared,8-adjacent sqrt, reciprocal/normal scaling and C-r*n.
 // L1 sums dominate Euclidean error; |N|>=minY prevents denominator amplification.
 const unit=rat(1n,1n<<53n),gamma=div(mul(rat(64n),unit),sub(O,mul(rat(64n),unit))),coordinate=P.reduce((r,p,i)=>add(r,add(abs(p),abs(dP[i]!))),Z),normal=N.reduce((r,n,i)=>add(r,add(abs(n),abs(dN[i]!))),Z),operator=mul(gamma,add(coordinate,mul(radius,add(O,div(normal,minY))))),upper=add(add(nodeMax,remainder),operator);
 return{upper,nodeMax,remainder,operator,M,h,report:{upper:text(upper),upperValue:number(upper),nodeMax:number(nodeMax),remainder:number(remainder),operator:number(operator),M:number(M),cells:count,domain:[lo,hi],rigorous:false,assumptions:'Analytical C-r*N/|N| interpolation enclosure plus explicit binary64 arithmetic/8-adjacent norm observation model. Actual world/native constants are exact dyadics. No physical tolerance or unconditional libm theorem.'}};
}
/** Exact constrained point/triangle minimization: all vertices, all finite edges,
 * and the plane projection only when its exact barycentrics lie in the triangle. */
export function triangleDistanceSquared(point:V,triangle:readonly V[],tick:()=>void):R{tick();const p=point.map(exact),A=triangle.map(v=>v.map(exact)),candidates:R[]=[];for(let j=0;j<3;j++){const a=A[j]!,b=A[(j+1)%3]!,d=minus(b,a),w=minus(p,a),ll=dot(d,d);candidates.push(dot(w,w));if(ll.n){const u=div(dot(w,d),ll);if(cmp(u,Z)>=0&&cmp(u,O)<=0){const r=minus(w,times(d,u));candidates.push(dot(r,r));}}}
 const a=A[0]!,u=minus(A[1]!,a),v=minus(A[2]!,a),w=minus(p,a),uu=dot(u,u),vv=dot(v,v),uv=dot(u,v),wu=dot(w,u),wv=dot(w,v),D=sub(mul(uu,vv),mul(uv,uv));if(D.n>0n){const b=div(sub(mul(wu,vv),mul(wv,uv)),D),c=div(sub(mul(wv,uu),mul(wu,uv)),D);if(cmp(b,Z)>=0&&cmp(c,Z)>=0&&cmp(add(b,c),O)<=0){const n=cross(u,v),d=dot(w,n);candidates.push(div(mul(d,d),dot(n,n)));}}
 return candidates.reduce((a,b)=>cmp(a,b)<0?a:b);
}
export function floorDistanceSquared(point:V,triangles:readonly(readonly V[])[],tick:()=>void){if(!triangles.length)throw Error('Empty floor domain');return triangles.map(t=>triangleDistanceSquared(point,t,tick)).reduce((a,b)=>cmp(a,b)<0?a:b);}
export{number,cmp,mul,sub,text};
