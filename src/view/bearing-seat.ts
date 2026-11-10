// Actual stored per-cell bearing construction; each pad retains its own source plane.
import{BufferGeometry,Float32BufferAttribute}from'three';
import{channelSurface}from'./machine-primitives';
import{Z,cmp,add,sub,exact,value,mag,str,xz,plane,clip,ccw,area2,inward,ears,greatest,neighbour,closed,triangleAt,type P,type V,type Tri,type Q,type Inward}from'./support-exact';
export interface BearingBand {readonly owner:string;readonly geometry:BufferGeometry;readonly triangle:number}
export interface BearingPad {readonly source:BearingBand;readonly original:Tri;readonly footprint:Inward;readonly bottom:readonly number[];readonly roof:readonly number[];readonly first:number;readonly count:number;readonly roofGap:readonly[Q,Q]}
export interface BearingSeatDescriptor {readonly id:string;readonly post:BufferGeometry;readonly postTop:readonly P[];readonly topY:number;readonly pads:readonly BearingPad[];readonly exactBandTwiceArea:Q;readonly constructedTwiceArea:Q;readonly lostTwiceArea:Q;readonly maximumRoofGap:Q}
const descriptors=new WeakMap<BufferGeometry,BearingSeatDescriptor>();
export const bearingSeatDescriptor=(g:BufferGeometry)=>descriptors.get(g);
/** Actual top cap boundary: cancel internal cap edges; no angular sort or guessed
 * child/cylinder ordinal. This also works for107 rebuilt posts. */
export function packedPostTop(g:BufferGeometry):{ring:readonly P[];y:number}{const p=g.getAttribute('position'),count=(g.index?.count??p.count)/3;let y=-Infinity;for(let i=0;i<p.count;i++)y=Math.max(y,p.getY(i));const faces:Tri[]=[],edge=new Map<string,{a:V;b:V}>(),K=(p:V)=>p.join('/');for(let t=0;t<count;t++){const tri=triangleAt(g,t);if(tri.every(v=>v[1]===y))faces.push(tri);}for(const t of faces)for(let i=0;i<3;i++){const a=t[i]!,b=t[(i+1)%3]!,back=K(b)+'>'+K(a);if(edge.has(back))edge.delete(back);else edge.set(K(a)+'>'+K(b),{a,b});}if(edge.size!==8)throw Error('Actual post top must be an eight-edge cap');const first=edge.values().next().value!,ring:V[]=[first.a];let next=first.b;while(K(next)!==K(ring[0]!)){if(ring.length>=8)throw Error('Post cap not one closed ring');ring.push(next);const e=[...edge.values()].find(e=>K(e.a)===K(next));if(!e)throw Error('Missing post cap edge');next=e.b;}const poly=ccw(ring.map(xz));for(let i=0;i<8;i++){const local=area2([poly[i]!,poly[(i+1)%8]!,poly[(i+2)%8]!]);if(cmp(local,Z)<=0)throw Error('Nonconvex actual post top');}return{ring:poly,y};}
/** Each positive exact convex cell yields its OWN closed pad, with its OWN plane.
 * Never assign a displaced crease to another cell. No internal face trimming. */
export function bearingSeat(input:{readonly id:string;readonly post:BufferGeometry;readonly band:readonly BearingBand[]}):BufferGeometry{const top=packedPostTop(input.post),positions:number[]=[],pads:BearingPad[]=[];let exactTotal=Z,storedTotal=Z,maximum=Z;
 const emit=(a:V,b:V,c:V)=>positions.push(...a,...b,...c);
 for(const source of input.band){const provenance=channelSurface(source.geometry);if(!provenance||!provenance.underside.includes(source.triangle))throw Error('Stale/non-underside pad source');const original=triangleAt(source.geometry,source.triangle),h=plane(original),intersection=clip(top.ring,original.map(xz));if(intersection.length<3||!cmp(mag(area2(intersection)),Z))continue;
  const footprint=(()=>{try{return inward(intersection);}catch(cause){throw new Error('Actual bearing cell store failed: '+JSON.stringify({id:input.id,owner:source.owner,triangle:source.triangle,source:original,top:top.ring.map(p=>p.map(str))}),{cause});}})(),poly=footprint.stored,triangles=ears(poly),first=positions.length/3,bottom:number[]=[],roof:number[]=[],lo=Z;let min:Q|undefined,max=Z;
  const heights=poly.map(p=>greatest(h(p))),B=(i:number):V=>[value(poly[i]![0]),top.y,value(poly[i]![1])],R=(i:number):V=>[value(poly[i]![0]),heights[i]!,value(poly[i]![1])];
  for(let i=0;i<poly.length;i++){const exactHeight=h(poly[i]!),y=exact(heights[i]!);if(cmp(y,exactHeight)>0||cmp(exact(neighbour(heights[i]!,true)),exactHeight)<=0||heights[i]!<=top.y)throw Error('Pad roof greatest-store/positive-height failure');const gap=sub(exactHeight,y);if(!min||cmp(gap,min)<0)min=gap;if(cmp(gap,max)>0)max=gap;}
  for(const[a,b,c]of triangles){roof.push(positions.length/9);emit(R(a),R(c),R(b));bottom.push(positions.length/9);emit(B(a),B(b),B(c));}
  // CCW XZ ring has outward wall orientation B_i,R_i,B_next.
  for(let i=0;i<poly.length;i++){const j=(i+1)%poly.length;emit(B(i),R(i),B(j));emit(B(j),R(i),R(j));}
  const count=positions.length/3-first;closed(Array.from({length:count/3},(_,i)=>[positions.slice((first+i*3)*3,(first+i*3+1)*3),positions.slice((first+i*3+1)*3,(first+i*3+2)*3),positions.slice((first+i*3+2)*3,(first+i*3+3)*3)]as unknown as Tri));
  // Each affine roof triangle's full minimum/maximum is attained at its
  // vertices, all inside THIS source cell. No ULP allowance substitutes for it.
  pads.push({source,original,footprint,bottom,roof,first,count,roofGap:[min??lo,max]});exactTotal=add(exactTotal,mag(area2(intersection)));storedTotal=add(storedTotal,area2(poly));if(cmp(max,maximum)>0)maximum=max;
 }
 if(!pads.length)throw Error('Bearing band has no positive pad');for(let i=0;i<pads.length;i++)for(let j=0;j<i;j++){const overlap=clip(pads[i]!.footprint.stored,pads[j]!.footprint.stored);if(overlap.length>=3&&cmp(mag(area2(overlap)),Z)>0)throw Error('Distinct source pads overlap in volume');}
 const geometry=new BufferGeometry().setAttribute('position',new Float32BufferAttribute(positions,3));geometry.computeVertexNormals();geometry.computeBoundingBox();geometry.computeBoundingSphere();const n=geometry.getAttribute('normal');for(let i=0;i<n.count;i++)if(![n.getX(i),n.getY(i),n.getZ(i)].every(Number.isFinite)||Math.hypot(n.getX(i),n.getY(i),n.getZ(i))<.99){geometry.dispose();throw Error('Invalid stored facet normal');}
 descriptors.set(geometry,Object.freeze({id:input.id,post:input.post,postTop:top.ring,topY:top.y,pads,exactBandTwiceArea:exactTotal,constructedTwiceArea:storedTotal,lostTwiceArea:sub(exactTotal,storedTotal),maximumRoofGap:maximum}));return geometry;
}
export function bearingSummary(g:BufferGeometry){const d=descriptors.get(g);if(!d)throw Error('Not producer bearing geometry');return{id:d.id,pads:d.pads.length,exactTwiceArea:str(d.exactBandTwiceArea),storedTwiceArea:str(d.constructedTwiceArea),loss:str(d.lostTwiceArea),actualMaximumGap:str(d.maximumRoofGap)};}
