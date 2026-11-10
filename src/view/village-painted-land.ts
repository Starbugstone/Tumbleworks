// Constructor-only exact representation; no terrain/query mutation.
import{BufferAttribute,BufferGeometry,type BufferAttribute as Attribute}from'three';
import{pointInPolygon,type VillageTerrain}from'../world/village-terrain';
import type{LandFace,FlatLandRun}from'./village-flat-land';
export interface PaintedLandRectangle{
 readonly firstRow:number;readonly lastRow:number;readonly firstColumn:number;readonly lastColumn:number;
 readonly paint:number;readonly winningPaintFeature:number;
 /** All source indexes refer to ORIGINAL geometry, before unpainted64 merges. */
 readonly sourceStarts:readonly number[];readonly boundarySources:readonly number[];readonly removedInteriorSources:readonly number[];
 readonly sourceTriangles:readonly number[];readonly baseStart:number;readonly outputStart:number;readonly triangleCount:number;
 readonly normalZeros:'numeric IEEE ±0 only; copied boundary occurrence bits retained';
}
const bits=new DataView(new ArrayBuffer(4));
/** Float32 -> exact integer in units2^-149. Used only for predicates, NEVER
 * for generated positions, colours, normals or physics/query values. */
function dyadic(value:number):bigint{bits.setFloat32(0,value);const b=bits.getUint32(0),e=(b>>>23)&255;if(e===255)throw new Error('Nonfinite packed land coordinate');const m=(b&0x7fffff)+(e?0x800000:0);return(BigInt(m)<<BigInt(e?e-1:0))*(b>>>31?-1n:1n);}
const floatKey=(n:number)=>{bits.setFloat32(0,n);return bits.getUint32(0).toString(16);};
function requireFields(g:BufferGeometry){const names=Object.keys(g.attributes).sort();if(g.index||names.join('/')!=='color/normal/position')return;const attributes={position:g.getAttribute('position'),normal:g.getAttribute('normal'),color:g.getAttribute('color')};for(const a of Object.values(attributes))if(!(a instanceof BufferAttribute)||!(a.array instanceof Float32Array)||a.itemSize!==3||a.normalized||a.count!==attributes.position.count)return;return attributes as Record<'position'|'normal'|'color',Attribute>;}
/** Convex rectangle boundary with ALL collinear boundary nodes retained.
 * Exact ear tests forbid zero-area triangles or a diagonal through another
 * boundary node. No epsilon, coordinate interpolation or corner-only fan. */
export function triangulatePaintedBoundary(g:BufferGeometry,boundary:readonly number[]):number[]{
 const p=g.getAttribute('position'),coords=new Map<number,readonly[bigint,bigint]>();for(const i of boundary)coords.set(i,[dyadic(p.getX(i)),dyadic(p.getZ(i))]);
 const cross=(a:number,b:number,c:number)=>{const A=coords.get(a)!,B=coords.get(b)!,C=coords.get(c)!;return(B[0]-A[0])*(C[1]-A[1])-(B[1]-A[1])*(C[0]-A[0]);};
 const inside=(i:number,a:number,b:number,c:number)=>cross(a,b,i)<=0n&&cross(b,c,i)<=0n&&cross(c,a,i)<=0n;
 const remaining=[...boundary],out:number[]=[];if(new Set(boundary).size!==boundary.length||boundary.length<4)throw new Error('Incomplete rectangle boundary');
 while(remaining.length>3){let found=false;for(let i=0;i<remaining.length;i++){const a=remaining[(i+remaining.length-1)%remaining.length]!,b=remaining[i]!,c=remaining[(i+1)%remaining.length]!;if(cross(a,b,c)>=0n||remaining.some(v=>v!==a&&v!==b&&v!==c&&inside(v,a,b,c)))continue;out.push(a,b,c);remaining.splice(i,1);found=true;break;}if(!found)throw new Error('Exact painted boundary has no nondegenerate ear');}
 if(cross(remaining[0]!,remaining[1]!,remaining[2]!)>=0n)throw new Error('Degenerate/folded final painted triangle');out.push(...remaining);return out;
}
/** Replay the legacy stream, verifying actual bytes and output offsets. Original
 * painted face offsets must never be applied directly to the already-shortened
 * unpainted result. Existing selected unpainted vertex values/order stay literal. */
function originalToBase(original:BufferGeometry,base:BufferGeometry):Int32Array{
 const a=requireFields(original),b=requireFields(base);if(!a||!b)throw new Error('Unsupported composition fields');const starts=new Map<number,number[]>(),removed=new Set<number>(),runs=(base.userData.flatLandRuns??[])as readonly FlatLandRun[];
 for(const run of runs){const[A,B,C,D]=run.sourceCorners;if(run.sourceStarts.length<2||run.sourceCorners.length!==4||starts.has(run.sourceStarts[0]!))throw new Error('Invalid unpainted source lineage');starts.set(run.sourceStarts[0]!,[A!,D!,B!,A!,C!,D!]);for(const s of run.sourceStarts.slice(1))removed.add(s);}
 const map=new Int32Array(a.position.count).fill(-1);let output=0;
 for(let input=0;input<a.position.count;){if(removed.has(input)){input+=6;continue;}const replacement=starts.get(input),ids=replacement??[input];if(replacement){const run=runs.find(r=>r.sourceStarts[0]===input)!;if(run.outputStart!==output)throw new Error('Stale legacy output offset');}
  for(const i of ids){if(i<0||i>=a.position.count||output>=b.position.count)throw new Error('Bad source range');for(const name of['position','normal','color']as const)for(let k=0;k<3;k++)if(!Object.is(a[name].getComponent(i,k),b[name].getComponent(output,k)))throw new Error('Legacy composition bytes differ');if(map[i]===-1)map[i]=output;output++;}input+=replacement?6:1;
 }
 if(output!==b.position.count)throw new Error('Legacy composition has unaccounted tail');return map;
}
interface Cell{readonly face:LandFace;readonly corners:readonly number[];readonly paint:number;readonly feature:number;readonly y:number}
/** protectedSourceVertices are actual original-stream attachment references,
 * never generated positions. No authored attachment/property field is added.
 * Any referenced strictly interior node vetoes its proposed rectangle. */
export function mergePaintedFlatLand(original:BufferGeometry,base:BufferGeometry,terrain:VillageTerrain,faces:readonly LandFace[],protectedSourceVertices:readonly number[]=[]):BufferGeometry{
 const a=requireFields(original),b=requireFields(base);if(!a||!b)return base;const p=a.position,n=a.normal,color=a.color;
 const coordinateKey=(i:number)=>[0,1,2].map(k=>floatKey(p.getComponent(i,k))).join('/');
 const samePoint=(i:number,j:number)=>[0,1,2].every(k=>Object.is(p.getComponent(i,k),p.getComponent(j,k))&&Object.is(color.getComponent(i,k),color.getComponent(j,k))&&n.getComponent(i,k)===n.getComponent(j,k));
 const cellMap=new Map<string,Cell>(),sourceStarts=new Set<number>();
 for(const face of faces){if(!Number.isInteger(face.row)||!Number.isInteger(face.column)||face.row<0||face.column<0||face.row>=terrain.rows||face.column>=terrain.columns||!Number.isInteger(face.start)||face.start%3||face.start<0||face.start+6>p.count||sourceStarts.has(face.start))throw new Error('Invalid actual land-face lineage');sourceStarts.add(face.start);const id=face.row*terrain.columns+face.column,paint=terrain.paint[id]!;if(terrain.cells[id]!=='land'||paint===0)continue;
  const x=terrain.originX+(face.column+.5)*terrain.cellWidth,z=terrain.originZ+(face.row+.5)*terrain.cellDepth;let feature=-1;terrain.spec.features.forEach((f,i)=>{if(f.kind==='paint'&&pointInPolygon(f.polygon,x,z))feature=i;});if(feature<0||terrain.spec.features[feature]!.kind!=='paint'||(terrain.spec.features[feature]as{color:number}).color!==paint)continue;
  const ids=Array.from({length:6},(_,i)=>face.start+i),y=p.getY(face.start);if(ids.some(i=>!Number.isFinite(p.getX(i))||!Number.isFinite(p.getY(i))||!Number.isFinite(p.getZ(i))||!Object.is(p.getY(i),y)||n.getX(i)!==0||n.getY(i)!==1||n.getZ(i)!==0||[0,1,2].some(k=>!Number.isFinite(color.getComponent(i,k))||!Object.is(color.getComponent(i,k),color.getComponent(face.start,k)))))continue;
  const x0=Math.fround(terrain.originX+face.column*terrain.cellWidth),x1=Math.fround(terrain.originX+(face.column+1)*terrain.cellWidth),z0=Math.fround(terrain.originZ+face.row*terrain.cellDepth),z1=Math.fround(terrain.originZ+(face.row+1)*terrain.cellDepth);if(!(x0<x1&&z0<z1))continue;
  const corners=[[x0,z0],[x1,z0],[x0,z1],[x1,z1]].map(([x,z])=>ids.find(i=>Object.is(p.getX(i),x)&&Object.is(p.getZ(i),z)));if(corners.some(i=>i===undefined)||ids.some(i=>!corners.some(j=>j!==undefined&&samePoint(i,j))))continue;
  const expected=[terrain.heights[face.row*(terrain.columns+1)+face.column],terrain.heights[face.row*(terrain.columns+1)+face.column+1],terrain.heights[(face.row+1)*(terrain.columns+1)+face.column],terrain.heights[(face.row+1)*(terrain.columns+1)+face.column+1]];if(expected.some(h=>!Object.is(h,y)))continue;
  const det=(i:number,j:number,k:number)=>(dyadic(p.getX(j))-dyadic(p.getX(i)))*(dyadic(p.getZ(k))-dyadic(p.getZ(i)))-(dyadic(p.getZ(j))-dyadic(p.getZ(i)))*(dyadic(p.getX(k))-dyadic(p.getX(i))),area=(dyadic(x1)-dyadic(x0))*(dyadic(z1)-dyadic(z0));if(det(ids[0]!,ids[1]!,ids[2]!)!==-area||det(ids[3]!,ids[4]!,ids[5]!)!==-area)continue;
  const edges=new Map<string,number>();for(let t=0;t<6;t+=3)for(let j=0;j<3;j++){const A=coordinateKey(ids[t+j]!),B=coordinateKey(ids[t+(j+1)%3]!),key=A+'>'+B;edges.set(key,(edges.get(key)??0)+1);}if(edges.size!==6||[...edges.keys()].filter(e=>edges.has(e.split('>').reverse().join('>'))).length!==2)continue;
  const key=face.row+'/'+face.column;if(cellMap.has(key))throw new Error('Duplicate painted grid cell');cellMap.set(key,{face,corners:corners as number[],paint,feature,y});
 }
 const same=(a:Cell,b:Cell)=>a.paint===b.paint&&a.feature===b.feature&&Object.is(a.y,b.y)&&[0,1,2].every(k=>Object.is(color.getComponent(a.face.start,k),color.getComponent(b.face.start,k)));
 const horizontal=(a:Cell,b:Cell)=>same(a,b)&&samePoint(a.corners[1]!,b.corners[0]!)&&samePoint(a.corners[3]!,b.corners[2]!);
 const vertical=(a:Cell,b:Cell)=>same(a,b)&&samePoint(a.corners[2]!,b.corners[0]!)&&samePoint(a.corners[3]!,b.corners[1]!);
 const used=new Set<Cell>(),plans:{cells:Cell[];boundary:number[];interior:number[];triangles:number[]}[]=[];
 for(const first of [...cellMap.values()].sort((a,b)=>a.face.row-b.face.row||a.face.column-b.face.column)){
  if(used.has(first))continue;const top=[first];let last=first;
  for(let col=first.face.column+1;col<terrain.columns;col++){const next=cellMap.get(first.face.row+'/'+col);if(!next||used.has(next)||!horizontal(last,next))break;top.push(next);last=next;}
  if(top.length<2)continue;const rows=[top];
  for(let row=first.face.row+1;row<terrain.rows;row++){const next=top.map(c=>cellMap.get(row+'/'+c.face.column));if(next.some((c,j)=>!c||used.has(c)||!vertical(rows.at(-1)![j]!,c))||next.some((c,j)=>j>0&&!horizontal(next[j-1]!,c!)))break;rows.push(next as Cell[]);}
  if(rows.length<2)continue;
  const nodes=new Map<string,number>(),cells=rows.flat();for(const c of cells){const{row,column}=c.face;for(const[dc,dr,corner]of[[0,0,0],[1,0,1],[0,1,2],[1,1,3]]){const key=(column+dc!)+'/'+(row+dr!),idx=c.corners[corner!]!,prior=nodes.get(key);if(prior!==undefined&&!samePoint(prior,idx))throw new Error('Discontinuous actual packed grid node');if(prior===undefined)nodes.set(key,idx);}}
  const c0=first.face.column,r0=first.face.row,c1=c0+top.length,r1=r0+rows.length,node=(c:number,r:number)=>nodes.get(c+'/'+r)!,boundary:number[]=[],interior:number[]=[];
  for(let row=r0;row<r1;row++)boundary.push(node(c0,row));for(let col=c0;col<c1;col++)boundary.push(node(col,r1));for(let row=r1;row>r0;row--)boundary.push(node(c1,row));for(let col=c1;col>c0;col--)boundary.push(node(col,r0));for(let row=r0+1;row<r1;row++)for(let col=c0+1;col<c1;col++)interior.push(node(col,row));
  const interiorKeys=new Set(interior.map(coordinateKey)),selected=new Set(cells.flatMap(c=>Array.from({length:6},(_,i)=>c.face.start+i)));let attachment=false;
  for(let i=0;i<p.count;i++)if((!selected.has(i)||protectedSourceVertices.includes(i))&&interiorKeys.has(coordinateKey(i))){attachment=true;break;}if(attachment)continue;
  const triangles=triangulatePaintedBoundary(original,boundary);if(triangles.length>=cells.length*6)continue;plans.push({cells,boundary,interior,triangles});cells.forEach(c=>used.add(c));
 }
 if(!plans.length)return base;const sourceToBase=originalToBase(original,base),replacements=new Map<number,{plan:typeof plans[number];indices:number[]}>(),removed=new Set<number>();
 for(const plan of plans){for(const c of plan.cells)if(Array.from({length:6},(_,i)=>sourceToBase[c.face.start+i]!).some((v,i)=>v<0||v!==sourceToBase[c.face.start]!+i))throw new Error('Painted source face was changed by another pass');const start=sourceToBase[plan.cells[0]!.face.start]!,indices=plan.triangles.map(i=>sourceToBase[i]!);if(indices.some(i=>i<0))throw new Error('Painted boundary source missing');replacements.set(start,{plan,indices});for(const c of plan.cells.slice(1))removed.add(sourceToBase[c.face.start]!);}
 const values={position:[]as number[],normal:[]as number[],color:[]as number[]},baseToFinal=new Int32Array(b.position.count).fill(-1),rectangles:PaintedLandRectangle[]=[];
 for(let i=0;i<b.position.count;){if(removed.has(i)){i+=6;continue;}const replacement=replacements.get(i),output=values.position.length/3,ids=replacement?.indices??[i];for(const j of ids){if(baseToFinal[j]===-1)baseToFinal[j]=values.position.length/3;for(const name of['position','normal','color']as const)for(let k=0;k<3;k++)values[name].push(b[name].getComponent(j,k));}if(replacement){const q=replacement.plan,first=q.cells[0]!,last=q.cells.at(-1)!;rectangles.push({firstRow:first.face.row,lastRow:last.face.row,firstColumn:first.face.column,lastColumn:last.face.column,paint:first.paint,winningPaintFeature:first.feature,sourceStarts:q.cells.map(c=>c.face.start),boundarySources:q.boundary,removedInteriorSources:q.interior,sourceTriangles:q.triangles,baseStart:i,outputStart:output,triangleCount:ids.length/3,normalZeros:'numeric IEEE ±0 only; copied boundary occurrence bits retained'});}i+=replacement?6:1;}
 const runs=(base.userData.flatLandRuns??[])as FlatLandRun[],mappedRuns=runs.map(run=>{const outputStart=baseToFinal[run.outputStart]!;if(outputStart<0)throw new Error('Painted pass removed an unpainted selected vertex');return{...run,outputStart};});
 const result=new BufferGeometry();for(const name of['position','normal','color']as const)result.setAttribute(name,new BufferAttribute(new Float32Array(values[name]),3));result.boundingSphere=base.boundingSphere?.clone()??null;result.boundingBox=base.boundingBox?.clone()??null;result.userData={...base.userData,flatLandRuns:mappedRuns,paintedLandRectangles:rectangles,paintedLandComposition:{unpaintedRuns:runs.map(run=>({sourceStart:run.sourceStarts[0],beforeOutputStart:run.outputStart,afterOutputStart:baseToFinal[run.outputStart]})),source:'original packed geometry',nonselected:'literal base stream order/fields',signedZero:'only numerical upward-normal equivalence'}};
 return result;
}
