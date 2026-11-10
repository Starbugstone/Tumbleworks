// Painted81 exact representation proof. Independent exact rational clipping/ray oracle. No production
// merge/triangulation/predicate imports, epsilon, raster samples or area rounding.
export interface R{readonly n:bigint;readonly d:bigint}
const abs=(a:bigint)=>a<0n?-a:a;function gcd(a:bigint,b:bigint):bigint{a=abs(a);b=abs(b);while(b){const t=a%b;a=b;b=t;}return a||1n;}
export function rat(n:bigint,d=1n):R{if(d===0n)throw new Error('Zero exact denominator');if(d<0n){n=-n;d=-d;}const g=gcd(n,d);return{n:n/g,d:d/g};}
const view=new DataView(new ArrayBuffer(8));
export function exact(x:number):R{if(!Number.isFinite(x))throw new Error('Nonfinite oracle input');view.setFloat64(0,x);const hi=view.getUint32(0),lo=view.getUint32(4),e=(hi>>>20)&2047,m=(BigInt(hi&0xfffff)<<32n)+BigInt(lo)+(e?1n<<52n:0n),power=(e?e-1023:1-1023)-52,sign=hi>>>31?-1n:1n;return power>=0?rat(sign*m*(1n<<BigInt(power))):rat(sign*m,1n<<BigInt(-power));}
export const add=(a:R,b:R)=>rat(a.n*b.d+b.n*a.d,a.d*b.d),neg=(a:R)=>rat(-a.n,a.d),sub=(a:R,b:R)=>add(a,neg(b)),mul=(a:R,b:R)=>rat(a.n*b.n,a.d*b.d),div=(a:R,b:R)=>rat(a.n*b.d,a.d*b.n),cmp=(a:R,b:R)=>{const d=a.n*b.d-b.n*a.d;return d<0n?-1:d>0n?1:0;},number=(a:R)=>Number(a.n)/Number(a.d);
export type P=readonly[R,R];export type V=readonly[R,R,R];
const zero=rat(0n),one=rat(1n);const cross2=(a:P,b:P,c:P)=>sub(mul(sub(b[0],a[0]),sub(c[1],a[1])),mul(sub(b[1],a[1]),sub(c[0],a[0])));
export function intersectionArea(subject:readonly P[],triangle:readonly P[]):R{let points=[...subject];const orient=cmp(cross2(triangle[0]!,triangle[1]!,triangle[2]!),zero);if(!orient)throw new Error('Degenerate oracle ground triangle');for(let i=0;i<3&&points.length;i++){const a=triangle[i]!,b=triangle[(i+1)%3]!,out:P[]=[];for(let j=0;j<points.length;j++){const p=points[j]!,q=points[(j+1)%points.length]!,dp=mul(cross2(a,b,p),rat(BigInt(orient))),dq=mul(cross2(a,b,q),rat(BigInt(orient))),inside=cmp(dp,zero)>=0,nextInside=cmp(dq,zero)>=0;if(inside)out.push(p);if(inside!==nextInside){const t=div(dp,sub(dp,dq));out.push([add(p[0],mul(t,sub(q[0],p[0]))),add(p[1],mul(t,sub(q[1],p[1])))]);}}points=out;}
 let twice=zero;for(let i=0;i<points.length;i++){const a=points[i]!,b=points[(i+1)%points.length]!;twice=add(twice,sub(mul(a[0],b[1]),mul(a[1],b[0])));}return div(rat(abs(twice.n),twice.d),rat(2n));}
const minus=(a:V,b:V):V=>[sub(a[0],b[0]),sub(a[1],b[1]),sub(a[2],b[2])],cross=(a:V,b:V):V=>[sub(mul(a[1],b[2]),mul(a[2],b[1])),sub(mul(a[2],b[0]),mul(a[0],b[2])),sub(mul(a[0],b[1]),mul(a[1],b[0]))],dot=(a:V,b:V)=>add(add(mul(a[0],b[0]),mul(a[1],b[1])),mul(a[2],b[2]));
/** Exact two-sided ray/triangle, including edges. First distance can therefore
 * be compared independently of a different triangulation's chosen face ID. */
export function rayTriangle(origin:V,direction:V,a:V,b:V,c:V):R|undefined{const e1=minus(b,a),e2=minus(c,a),p=cross(direction,e2),det=dot(e1,p);if(cmp(det,zero)===0)return;const t=minus(origin,a),u=div(dot(t,p),det);if(cmp(u,zero)<0||cmp(u,one)>0)return;const q=cross(t,e1),v=div(dot(direction,q),det);if(cmp(v,zero)<0||cmp(add(u,v),one)>0)return;const distance=div(dot(e2,q),det);if(cmp(distance,zero)<0)return;return distance;}
