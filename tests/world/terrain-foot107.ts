import{add,sub,mul,div,cmp,exact,rat,number,type R}from'./painted-land-rational';
import{footArea,footClip,footNeighbour,footPlane,type FootPoint,type FootFacet}from'./complete-foot105';
type P=readonly[R,R,R];const z=rat(0n),q=(p:FootPoint):P=>p.map(exact)as unknown as P;
const cross=(a:P,b:P,c:P)=>sub(mul(sub(b[0],a[0]),sub(c[2],a[2])),mul(sub(b[2],a[2]),sub(c[0],a[0])));
const key=(p:P)=>[p[0],p[2]].map(x=>x.n+'/'+x.d).join('|');
/** Independent expected boundary from ORIGINAL packed cap and native terrain.
 * Does not read the builder's cuts, boundary, bottom facets or descriptor. */
export function expectedTerrainBoundary107(original:readonly FootPoint[],land:readonly FootFacet[]):FootPoint[]{
 const rim=original.map(q),direction=cmp(cross(rim[0]!,rim[1]!,rim[2]!),z),bounds=[Math.min(...original.map(p=>p[0])),Math.max(...original.map(p=>p[0])),Math.min(...original.map(p=>p[2])),Math.max(...original.map(p=>p[2]))];
 const relevant=land.filter(t=>Math.max(...t.map(p=>p[0]))>=bounds[0]!&&Math.min(...t.map(p=>p[0]))<=bounds[1]!&&Math.max(...t.map(p=>p[2]))>=bounds[2]!&&Math.min(...t.map(p=>p[2]))<=bounds[3]!).map(t=>t.map(q)as unknown as readonly[P,P,P]).filter(t=>cmp(footArea(footClip(rim,t)),z)>0);
 const planes=relevant.map(t=>[footPlane(...t,z,z),sub(footPlane(...t,rat(1n),z),footPlane(...t,z,z)),sub(footPlane(...t,z,rat(1n)),footPlane(...t,z,z))].map(x=>x.n+'/'+x.d).join('|'));
 if(new Set(planes).size===1)return original.map(p=>[...p]);
 function adjacent(x:R):number[]{let f=Math.fround(number(x));if(cmp(exact(f),x)>0)f=footNeighbour(f,false);const upper=footNeighbour(f,true);if(cmp(exact(f),x)>0||cmp(exact(upper),x)<=0)throw Error('Independent adjacent bracket failure');return cmp(exact(f),x)===0?[f]:[f,upper];}
 const result:FootPoint[]=[];
 for(let i=0;i<rim.length;i++){const a=rim[i]!,b=rim[(i+1)%rim.length]!,events=new Map<string,{point:P;t:R}>();
  for(const t of relevant)for(let j=0;j<3;j++){const u=t[j]!,v=t[(j+1)%3]!,da=cross(u,v,a),db=cross(u,v,b);if(cmp(da,z)*cmp(db,z)>=0)continue;const at=div(da,sub(da,db)),intersection=a.map((x,k)=>add(x,mul(at,sub(b[k]!,x))))as unknown as P;
   if([0,2].some(k=>cmp(mul(sub(intersection[k]!,u[k]!),sub(intersection[k]!,v[k]!)),z)>0))continue;
   const candidates:P[]=[];for(const free of[0,2]as const){const other=free===0?2:0;if(cmp(u[free],v[free])===0)continue;for(const stored of adjacent(intersection[free])){const p=[z,z,z];p[free]=exact(stored);p[other]=add(u[other],mul(div(sub(p[free]!,u[free]),sub(v[free],u[free])),sub(v[other],u[other])));if(cmp(exact(Math.fround(number(p[other]!))),p[other]!)||rim.some((a,k)=>cmp(cross(a,rim[(k+1)%rim.length]!,p as unknown as P),z)*direction<0)||[0,2].some(k=>cmp(mul(sub(p[k]!,u[k]!),sub(p[k]!,v[k]!)),z)>0))continue;candidates.push(p as unknown as P);}}
   const distance=(p:P)=>[0,2].reduce((s,k)=>add(s,mul(sub(p[k]!,intersection[k]!),sub(p[k]!,intersection[k]!))),z);candidates.sort((a,b)=>cmp(distance(a),distance(b)));if(!candidates.length)throw Error('Independent inward boundary has no stored point');const p=candidates[0]!;events.set(key(p),{point:p,t:at});
  }
  result.push(original[i]!,...[...events.values()].sort((a,b)=>cmp(a.t,b.t)).map(e=>[number(e.point[0]),0,number(e.point[2])]as FootPoint));
 }
 return result;
}
