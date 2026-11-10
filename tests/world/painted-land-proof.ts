// Painted81 exact representation proof. Independent exact proof: do NOT import production predicate,
// planner, triangulator or composition helper here.
import{expect}from'vitest';import type{BufferGeometry}from'three';
import type{PaintedLandRectangle}from'../../src/view/village-painted-land';
import type{VillageTerrain,TerrainVec2}from'../../src/world/village-terrain';
import{exact,cmp,add,sub,mul,div}from'./painted-land-rational';
const f32=new Float32Array(1),u32=new Uint32Array(f32.buffer);
/** Independent binary decomposition, common scale2^149; no tolerance. */
function Q(x:number):bigint{f32[0]=x;const b=u32[0]!,sign=b>>>31?-1n:1n,exponent=b>>>23&255,fraction=b&0x7fffff;if(exponent===255)throw new Error('Nonfinite proof vertex');return sign*BigInt(fraction+(exponent?8388608:0))*(1n<<BigInt(exponent?exponent-1:0));}
type P=readonly[bigint,bigint];const orient=(a:P,b:P,c:P)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const K=(p:P)=>p[0]+'/'+p[1];
function chain(g:BufferGeometry,starts:readonly number[]){const p=g.getAttribute('position'),edges=new Map<string,bigint>();let area=0n;const vertices=new Map<string,P>();for(const start of starts){const tri=[0,1,2].map(j=>[Q(p.getX(start+j)),Q(p.getZ(start+j))]as const);const det=orient(tri[0]!,tri[1]!,tri[2]!);expect(det).toBeLessThan(0n);area+=det;for(let j=0;j<3;j++){const a=tri[j]!,b=tri[(j+1)%3]!,ka=K(a),kb=K(b);vertices.set(ka,a);vertices.set(kb,b);const forward=ka+'>'+kb,reverse=kb+'>'+ka;if(edges.has(reverse)){const v=edges.get(reverse)!-1n;if(v===0n)edges.delete(reverse);else edges.set(reverse,v);}else edges.set(forward,(edges.get(forward)??0n)+1n);}}
 return{area,edges,vertices};}
function overlapInterior(a:readonly P[],b:readonly P[]):boolean{
 // Separating axis theorem for clockwise triangles. Strict interior overlap
 // iff no complete edge separates/touches; no float clipping arithmetic.
 for(const polygon of[a,b])for(let i=0;i<3;i++){const p=polygon[i]!,q=polygon[(i+1)%3]!,other=polygon===a?b:a;if(other.every(v=>orient(p,q,v)>=0n))return false;}return true;
}
/** Independent exact ray-crossing on the stored authored polygon. The cell
 * centre is the existing JS value; no producer pointInPolygon is imported. */
function contains(poly:readonly TerrainVec2[],x:number,z:number){let inside=false;const X=exact(x),Z=exact(z);for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,zi]=poly[i]!,[xj,zj]=poly[j]!;if((zi>z)===(zj>z))continue;const crossing=add(exact(xi),div(mul(sub(exact(xj),exact(xi)),sub(Z,exact(zi))),sub(exact(zj),exact(zi))));if(cmp(X,crossing)<0)inside=!inside;}return inside;}
function proveEligibility(g:BufferGeometry,t:VillageTerrain,r:PaintedLandRectangle){
 const p=g.getAttribute('position'),n=g.getAttribute('normal'),color=g.getAttribute('color'),w=r.lastColumn-r.firstColumn+1,h=r.lastRow-r.firstRow+1;expect(w).toBeGreaterThanOrEqual(2);expect(h).toBeGreaterThanOrEqual(2);expect(r.sourceStarts.length).toBe(w*h);expect(new Set(r.sourceStarts).size).toBe(w*h);
 const first=r.sourceStarts[0]!,plane=p.getY(first);let at=0;const boundary=new Set<string>(),interior=new Set<string>();
 for(let row=r.firstRow;row<=r.lastRow;row++)for(let col=r.firstColumn;col<=r.lastColumn;col++){
  expect(row>=0&&row<t.rows&&col>=0&&col<t.columns).toBe(true);const id=row*t.columns+col;expect(t.cells[id]).toBe('land');expect(t.paint[id]).toBe(r.paint);expect(r.paint).not.toBe(0);let winner=-1;t.spec.features.forEach((f,i)=>{if(f.kind==='paint'&&contains(f.polygon,t.originX+(col+.5)*t.cellWidth,t.originZ+(row+.5)*t.cellDepth))winner=i;});expect(winner).toBe(r.winningPaintFeature);expect(winner).toBeGreaterThanOrEqual(0);
  const paint=t.spec.features[winner]!;expect(paint.kind).toBe('paint');if(paint.kind==='paint')expect(paint.color).toBe(r.paint);
  const start=r.sourceStarts[at++]!,corners=[0,1].flatMap(dr=>[0,1].map(dc=>{const x=Math.fround(t.originX+(col+dc)*t.cellWidth),z=Math.fround(t.originZ+(row+dr)*t.cellDepth),y=t.heights[(row+dr)*(t.columns+1)+col+dc]!;expect(Object.is(y,plane)).toBe(true);const key=K([Q(x),Q(z)]);if(col+dc===r.firstColumn||col+dc===r.lastColumn+1||row+dr===r.firstRow||row+dr===r.lastRow+1)boundary.add(key);else interior.add(key);return[x,y,z]as const;}));
  // Independent documented checkerboard split, not production cellDiagonal.
  const sequence=(col+row)%2===0?[0,3,1,0,2,3]:[0,2,1,1,2,3];for(let j=0;j<6;j++){const i=start+j,c=corners[sequence[j]!]!;for(let k=0;k<3;k++){expect(Object.is(p.getComponent(i,k),c[k])).toBe(true);expect(Object.is(color.getComponent(i,k),color.getComponent(first,k))).toBe(true);}expect(n.getX(i)===0).toBe(true);expect(n.getY(i)).toBe(1);expect(n.getZ(i)===0).toBe(true);}
 }
 const coordinates=(ids:readonly number[])=>ids.map(i=>K([Q(p.getX(i)),Q(p.getZ(i))])).sort();expect(coordinates(r.boundarySources)).toEqual([...boundary].sort());expect(coordinates(r.removedInteriorSources)).toEqual([...interior].sort());
}
export function provePaintedReplacement(original:BufferGeometry,base:BufferGeometry,next:BufferGeometry,terrain:VillageTerrain){
 const rectangles=next.userData.paintedLandRectangles as readonly PaintedLandRectangle[]|undefined;expect(rectangles?.length).toBeGreaterThan(0);const old=original.getAttribute('position'),out=next.getAttribute('position'),removed=new Set<number>(),replacements=new Map<number,PaintedLandRectangle>();let saving=0;
 for(const rect of rectangles!){proveEligibility(original,terrain,rect);const source=rect.sourceStarts.flatMap(i=>[i,i+3]),target=Array.from({length:rect.triangleCount},(_,i)=>rect.outputStart+3*i),a=chain(original,source),b=chain(next,target);expect(b.area).toBe(a.area);expect([...b.edges].sort()).toEqual([...a.edges].sort());expect([...b.edges.values()].every(v=>v===1n)).toBe(true);
  const tri=target.map(i=>[0,1,2].map(j=>[Q(out.getX(i+j)),Q(out.getZ(i+j))]as const));for(let i=0;i<tri.length;i++)for(let j=i+1;j<tri.length;j++)expect(overlapInterior(tri[i]!,tri[j]!)).toBe(false);
  // Every original boundary node survives as a real output vertex. Interior
  // nodes alone may disappear, and each output attribute is an actual source.
  const boundaryNodes=new Set([...a.edges.keys()].flatMap(e=>e.split('>'))),outputNodes=new Set(target.flatMap(i=>[0,1,2].map(j=>K([Q(out.getX(i+j)),Q(out.getZ(i+j))]))));for(const k of boundaryNodes)expect(outputNodes.has(k)).toBe(true);
  const originals=new Map<string,number[]>();for(const start of rect.sourceStarts)for(let j=0;j<6;j++){const i=start+j,k=old.getX(i)+'/'+old.getY(i)+'/'+old.getZ(i),ids=originals.get(k)??[];ids.push(i);originals.set(k,ids);}
  for(const start of target)for(let j=0;j<3;j++){const i=start+j,ids=originals.get(out.getX(i)+'/'+out.getY(i)+'/'+out.getZ(i));expect(ids?.length).toBeGreaterThan(0);expect(ids!.some(src=>['position','color'].every(name=>[0,1,2].every(k=>Object.is(original.getAttribute(name).getComponent(src,k),next.getAttribute(name).getComponent(i,k))))&&[0,1,2].every(k=>original.getAttribute('normal').getComponent(src,k)===next.getAttribute('normal').getComponent(i,k)))).toBe(true);expect(out.getY(i)).toBe(old.getY(rect.sourceStarts[0]!));}
  saving+=source.length-target.length;replacements.set(rect.baseStart,rect);for(const start of rect.sourceStarts.slice(1)){// Locate exact unchanged six-vertex base faces independently by full fields.
   const bp=base.getAttribute('position');let found=-1;for(let i=0;i+6<=bp.count;i+=3)if(Array.from({length:6},(_,j)=>['position','normal','color'].every(name=>[0,1,2].every(k=>Object.is(base.getAttribute(name).getComponent(i+j,k),original.getAttribute(name).getComponent(start+j,k))))).every(Boolean)){expect(found).toBe(-1);found=i;}expect(found).toBeGreaterThanOrEqual(0);removed.add(found);
  }
 }
 // Literal base stream order/attribute bytes outside painted replacements,
 // including every unpainted selected run, skirt/water face and later tail.
 let output=0;for(let i=0;i<base.getAttribute('position').count;){if(removed.has(i)){i+=6;continue;}const replacement=replacements.get(i);if(replacement){expect(output).toBe(replacement.outputStart);output+=3*replacement.triangleCount;i+=6;continue;}for(const name of['position','normal','color'])for(let k=0;k<3;k++)expect(Object.is(next.getAttribute(name).getComponent(output,k),base.getAttribute(name).getComponent(i,k))).toBe(true);i++;output++;}expect(output).toBe(out.count);expect(base.getAttribute('position').count/3-next.getAttribute('position').count/3).toBe(saving);
 const oldRuns=base.userData.flatLandRuns??[],newRuns=next.userData.flatLandRuns??[];expect(newRuns.length).toBe(oldRuns.length);for(let i=0;i<oldRuns.length;i++){expect(newRuns[i].sourceStarts).toEqual(oldRuns[i].sourceStarts);expect(newRuns[i].sourceCorners).toEqual(oldRuns[i].sourceCorners);for(let j=0;j<6;j++)for(const name of['position','normal','color'])for(let k=0;k<3;k++)expect(Object.is(next.getAttribute(name).getComponent(newRuns[i].outputStart+j,k),base.getAttribute(name).getComponent(oldRuns[i].outputStart+j,k))).toBe(true);}
 return{rectangles:rectangles!.length,savedTriangles:saving};
}
