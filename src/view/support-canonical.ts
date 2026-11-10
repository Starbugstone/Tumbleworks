import{Z,cmp,exact,add,sub,mul,area2,mag,ccw,ears,closed,type Q,type P,type V,type Tri}from'./support-exact';
export interface CanonicalProxy {readonly facets:readonly Tri[];readonly lineage:readonly{readonly source:number;readonly pieces:readonly number[];readonly projectedTwiceArea:Q}[]}
/** Split ONLY along actual collinear native vertices on existing facet edges.
 * Adds no material or render faces. Both sides of a T-junction receive the same
 * constrained nodes; each replacement exactly covers its original plane/area. */
export function canonicalSolidProxy(source:readonly Tri[]):CanonicalProxy{
 const vertices=[...new Map(source.flat().map(p=>[p.join('/'),p])).values()],facets:Tri[]=[],lineage:{source:number;pieces:number[];projectedTwiceArea:Q}[]=[];
 for(let face=0;face<source.length;face++){const tri=source[face]!,ring:V[]=[];for(let i=0;i<3;i++){const a=tri[i]!,b=tri[(i+1)%3]!,d=a.map((x,k)=>sub(exact(b[k]!),exact(x))),axis=d.findIndex(x=>cmp(x,Z)),on:V[]=[];if(axis<0)throw Error('Collapsed native edge');for(const p of vertices){const e=a.map((x,k)=>sub(exact(p[k]!),exact(x)));if([sub(mul(d[1]!,e[2]!),mul(d[2]!,e[1]!)),sub(mul(d[2]!,e[0]!),mul(d[0]!,e[2]!)),sub(mul(d[0]!,e[1]!),mul(d[1]!,e[0]!))].some(x=>cmp(x,Z)))continue;if(cmp(mul(e[axis]!,sub(exact(p[axis]!),exact(b[axis]!))),Z)>0)continue;on.push(p);}on.sort((p,r)=>(p[axis]!-r[axis]!)*cmp(d[axis]!,Z));ring.push(...on.slice(0,-1));}
  const A=tri[0],B=tri[1],C=tri[2],e=B.map((x,k)=>sub(exact(x),exact(A[k]!))),f=C.map((x,k)=>sub(exact(x),exact(A[k]!))),n=[sub(mul(e[1]!,f[2]!),mul(e[2]!,f[1]!)),sub(mul(e[2]!,f[0]!),mul(e[0]!,f[2]!)),sub(mul(e[0]!,f[1]!),mul(e[1]!,f[0]!))],drop=n.reduce<number>((best,x,k)=>cmp(mag(x),mag(n[best]!))>0?k:best,0),project=(v:V)=>v.filter((_,k)=>k!==drop).map(exact)as unknown as P,original=area2(tri.map(project)),positive=ccw(ring.map(project)),ordered=cmp(area2(ring.map(project)),Z)>0?ring:[...ring].reverse(),pieces:number[]=[];let total=Z;
  for(const[a,b,c]of ears(positive)){let t:Tri=[ordered[a]!,ordered[b]!,ordered[c]!];if(cmp(original,Z)<0)t=[t[0],t[2],t[1]];total=add(total,mag(area2(t.map(project))));pieces.push(facets.length);facets.push(t);}if(cmp(total,mag(original)))throw Error('Canonical material area changed');lineage.push({source:face,pieces,projectedTwiceArea:total});
 }
 closed(facets);return{facets,lineage};
}
