import{add,sub,mul,div,cmp,number,rat,exact,type R}from'./painted-land-rational';
export type FootPoint=readonly[number,number,number];
export type FootFacet=readonly[FootPoint,FootPoint,FootPoint];
type Q=readonly[R,R,R];
const zero=rat(0n),cross=(a:Q,b:Q,c:Q)=>sub(mul(sub(b[0],a[0]),sub(c[2],a[2])),mul(sub(b[2],a[2]),sub(c[0],a[0])));
const q=(p:FootPoint):Q=>[exact(p[0]),exact(p[1]),exact(p[2])];
/** Independent exact shoelace, including quadrilateral/larger clips. */
export function footArea(poly:readonly Q[]):R{let twice=zero;for(let i=0;i<poly.length;i++){const a=poly[i]!,b=poly[(i+1)%poly.length]!;twice=add(twice,sub(mul(a[0],b[2]),mul(a[2],b[0])));}return div(rat(twice.n<0n?-twice.n:twice.n,twice.d),rat(2n));}
export function footClip(poly:readonly Q[],tri:readonly Q[]):Q[]{const orientation=cmp(cross(tri[0]!,tri[1]!,tri[2]!),zero);if(!orientation)throw Error('Degenerate land projection');let out=[...poly];for(let e=0;e<3;e++){const a=tri[e]!,b=tri[(e+1)%3]!,next:Q[]=[];for(let i=0;i<out.length;i++){const p=out[i]!,r=out[(i+1)%out.length]!,dp=mul(cross(a,b,p),rat(BigInt(orientation))),dr=mul(cross(a,b,r),rat(BigInt(orientation)));if(cmp(dp,zero)>=0)next.push(p);if((cmp(dp,zero)>=0)!==(cmp(dr,zero)>=0)){const t=div(dp,sub(dp,dr));next.push(p.map((v,k)=>add(v,mul(t,sub(r[k]!,v))))as unknown as Q);}}out=next;}return out;}
export function footPlane(a:Q,b:Q,c:Q,x:R,z:R):R{const den=cross(a,b,c),s=div(sub(mul(sub(x,a[0]),sub(c[2],a[2])),mul(sub(z,a[2]),sub(c[0],a[0]))),den),t=div(sub(mul(sub(b[0],a[0]),sub(z,a[2])),mul(sub(b[2],a[2]),sub(x,a[0]))),den);return add(a[1],add(mul(s,sub(b[1],a[1])),mul(t,sub(c[1],a[1]))));}
/** Signed IEEE neighbour. No global ULP allowance. */
export function footNeighbour(y:number,up:boolean):number{if(!Number.isFinite(y)||Math.fround(y)!==y)throw Error('Stored finite Float32 required');const f=new Float32Array([y]),u=new Uint32Array(f.buffer);if(y===0){u[0]=1;return up?f[0]!:-f[0]!;}u[0]=u[0]!+((y>0)===up?1:-1);return f[0]!;}
export interface CompleteFootInput{readonly facets:readonly FootFacet[];readonly bottom:readonly number[];readonly expectedBoundary:readonly FootPoint[];readonly land:readonly FootFacet[]}
export interface CompleteFootAudit{readonly area:number;readonly covered:number;readonly minGap:number;readonly maxGap:number;readonly bottomFacets:number;readonly intersections:number;readonly leastFailures:readonly {point:FootPoint;soil:number;stored:number;previous:number}[];readonly violations:readonly string[];readonly clear:boolean}
/** Whole declared solid, independent expected rim, exact union once, every land plane.
 * No surfaceTriangles, 3D bounds, ground-nearness or nonzero-facet-area filter. */
export function completeFoot105(input:CompleteFootInput):CompleteFootAudit{
 const {facets,bottom,expectedBoundary,land}=input,violations:string[]=[],edge=new Map<string,number>(),key=(p:FootPoint)=>p.map(v=>Object.is(v,-0)?0:v).join('/'),triangles=facets.map(f=>f.map(q)as unknown as readonly[Q,Q,Q]);
 const expected=expectedBoundary.map(q),sign=cmp(expected.reduce((s,a,i)=>add(s,sub(mul(a[0],expected[(i+1)%expected.length]![2]),mul(a[2],expected[(i+1)%expected.length]![0]))),zero),zero);
 if(!sign||expected.length<3)throw Error('Independent footprint is degenerate');
 // Independently triangulate the expected simple polygon, including inward
 // constrained notches. Convex half-plane membership is insufficient for these.
 const ring=expected.map((_,i)=>i),expectedPieces:Q[][]=[];
 while(ring.length>3){let removed=false;for(let k=0;k<ring.length;k++){const a=ring[(k+ring.length-1)%ring.length]!,b=ring[k]!,c=ring[(k+1)%ring.length]!,t=[expected[a]!,expected[b]!,expected[c]!];if(cmp(cross(...t as[Q,Q,Q]),zero)!==sign||ring.some(i=>i!==a&&i!==b&&i!==c&&[0,1,2].every(j=>cmp(cross(t[j]!,t[(j+1)%3]!,expected[i]!),zero)*sign>=0)))continue;expectedPieces.push(t);ring.splice(k,1);removed=true;break;}if(!removed)throw Error('Independent expected polygon is not simple');}
 expectedPieces.push(ring.map(i=>expected[i]!));
 for(const [i,f]of facets.entries()){const [a,b,c]=triangles[i]!,normal=[sub(mul(sub(b[1],a[1]),sub(c[2],a[2])),mul(sub(b[2],a[2]),sub(c[1],a[1]))),sub(mul(sub(b[2],a[2]),sub(c[0],a[0])),mul(sub(b[0],a[0]),sub(c[2],a[2]))),sub(mul(sub(b[0],a[0]),sub(c[1],a[1])),mul(sub(b[1],a[1]),sub(c[0],a[0])))];if(normal.every(v=>cmp(v,zero)===0))violations.push(`collapsed facet ${i}`);
  for(let j=0;j<3;j++){const k=key(f[j]!)+'>'+key(f[(j+1)%3]!);edge.set(k,(edge.get(k)??0)+1);}}
 for(const[k,count]of edge)if(count!==1||edge.get(k.split('>').reverse().join('>'))!==1)violations.push('oriented closed edge');
 if(new Set(bottom).size!==bottom.length||bottom.some(i=>!Number.isInteger(i)||i<0||i>=facets.length))throw Error('Invalid declared bottom topology');
 const selected=bottom.map(i=>triangles[i]!);let area=zero,covered=zero,minGap:R|undefined,maxGap:R|undefined,intersections=0;const leastFailures: {point:FootPoint;soil:number;stored:number;previous:number}[]=[];
 const lands=land.map(f=>({f,q:f.map(q)as unknown as readonly[Q,Q,Q],minX:Math.min(...f.map(p=>p[0])),maxX:Math.max(...f.map(p=>p[0])),minZ:Math.min(...f.map(p=>p[2])),maxZ:Math.max(...f.map(p=>p[2]))}));
 for(const [i,tri]of selected.entries()){const det=cross(...tri);if(cmp(det,zero)<=0)violations.push(`inverted/collapsed bottom ${i}`);area=add(area,footArea(tri));if(cmp(det,zero)===0)continue;let inside=zero;for(const piece of expectedPieces)inside=add(inside,footArea(footClip(tri,piece)));if(cmp(inside,footArea(tri))!==0)violations.push('changed boundary outside expected footprint');
  for(let j=0;j<i;j++)if(cmp(cross(...selected[j]!),zero)!==0&&cmp(footArea(footClip(tri,selected[j]!)),zero)>0)violations.push('duplicate/overlapping bottom area');
  const intersected:typeof lands=[];const xs=tri.map(p=>number(p[0])),zs=tri.map(p=>number(p[2]));for(const l of lands){if(l.maxX<Math.min(...xs)||l.minX>Math.max(...xs)||l.maxZ<Math.min(...zs)||l.minZ>Math.max(...zs))continue;const piece=footClip(tri,l.q),a=footArea(piece);if(cmp(a,zero)===0)continue;covered=add(covered,a);intersections++;intersected.push(l);
   for(const p of piece){const gap=sub(footPlane(...tri,p[0],p[2]),footPlane(...l.q,p[0],p[2]));if(!minGap||cmp(gap,minGap)<0)minGap=gap;if(!maxGap||cmp(gap,maxGap)>0)maxGap=gap;}
  }
  for(const l of intersected){for(const vertex of tri){const x=number(vertex[0]),z=number(vertex[2]);const provider=lands.find(m=>x>=m.minX&&x<=m.maxX&&z>=m.minZ&&z<=m.maxZ&&[0,1,2].every(k=>cmp(mul(cross(m.q[k]!,m.q[(k+1)%3]!,vertex),rat(BigInt(cmp(cross(...m.q),zero)))),zero)>=0));if(provider&&cmp(footPlane(...provider.q,vertex[0],vertex[2]),footPlane(...l.q,vertex[0],vertex[2]))!==0)violations.push('unconstrained terrain crease');}}
  for(const [j,p]of tri.entries()){const raw=facets[bottom[i]!]![j]!,previous=footNeighbour(raw[1],false);let providers=0;for(const l of lands){if(raw[0]<l.minX||raw[0]>l.maxX||raw[2]<l.minZ||raw[2]>l.maxZ)continue;const orientation=cmp(cross(...l.q),zero);if([0,1,2].some(k=>cmp(mul(cross(l.q[k]!,l.q[(k+1)%3]!,p),rat(BigInt(orientation))),zero)<0))continue;providers++;const soil=footPlane(...l.q,p[0],p[2]);if(cmp(p[1],soil)<0||cmp(exact(previous),soil)>=0)leastFailures.push({point:raw,soil:number(soil),stored:raw[1],previous});}if(!providers)violations.push('bottom vertex lacks land');}
 }
 if(cmp(area,footArea(expected))!==0)violations.push('incomplete independent footprint');if(cmp(covered,area)!==0)violations.push('water/void or duplicate land coverage');if(!minGap||!maxGap)violations.push('no land coverage');if(minGap&&cmp(minGap,zero)<0)violations.push('facet penetrates native land');if(leastFailures.length)violations.push('not least stored height');
 return{area:number(area),covered:number(covered),minGap:minGap?number(minGap):NaN,maxGap:maxGap?number(maxGap):NaN,bottomFacets:bottom.length,intersections,leastFailures,violations:[...new Set(violations)],clear:violations.length===0};
}
