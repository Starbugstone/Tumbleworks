import{BoxGeometry,BufferGeometry,FrontSide,Mesh,Vector3}from'three';
import{compactCylinderCaps}from'./cylinder-caps';
import{captiveLiftArmGeometry,captiveLeadingSleeveGeometry}from'./captive-leaf-parts';
type Cap='start'|'end';
export interface EnclosedCapReport{readonly cap:Cap;readonly cover:'leading-sleeve'|'leaf-shoe';readonly removedTriangles:2;readonly rimEdges:4;readonly minimumMargin:number;readonly requiredMargin:number;readonly closedManifoldOutwardConvexCover:true;readonly exposedUnionBoundaryExact:true}
const same=(a:ArrayLike<number>,b:ArrayLike<number>)=>a.length===b.length&&Array.from(a).every((v,i)=>Object.is(v,b[i]));
const key=(p:Vector3)=>p.toArray().map(v=>v===0?0:v).join('/');
function rows(g:BufferGeometry){const p=g.getAttribute('position'),ix=g.index,result=[];for(let i=0;i<(ix?.count??p.count);i+=3){const ids=[0,1,2].map(k=>ix?ix.getX(i+k):i+k),points=ids.map(id=>new Vector3().fromBufferAttribute(p,id)),normal=points[1]!.clone().sub(points[0]!).cross(points[2]!.clone().sub(points[0]!));if(!(normal.lengthSq()>0))throw new Error('Enclosed cap: degenerate actual face');result.push({offset:i,ids,points,normal:normal.normalize()});}return result;}
/** Packed coordinate identity only. Even an exact selected producer's nominal
 * seam is NOT a closed packed edge when its endpoint coordinates differ. No
 * storage-bound or same-body welding is substituted for actual closure. */
function closedOutward(g:BufferGeometry){const fs=rows(g),p=g.getAttribute('position'),normals=g.getAttribute('normal'),edges=new Map<string,{from:string;to:string;face:number}[]>();let volume=0;
 const id=key;
 fs.forEach((f,face)=>{volume+=f.points[0]!.dot(f.points[1]!.clone().cross(f.points[2]!))/6;for(let j=0;j<3;j++){const from=id(f.points[j]!),to=id(f.points[(j+1)%3]!);if(from===to)throw new Error('Collapsed boundary edge');const k=[from,to].sort().join('|'),entries=edges.get(k)??[];entries.push({from,to,face});edges.set(k,entries);const n=new Vector3().fromBufferAttribute(normals,f.ids[j]!);if(!n.toArray().every(Number.isFinite)||n.dot(f.normal)<=0)throw new Error('Nonfinite/inward actual normal');}});
 if(!(volume>0))throw new Error('Cover/source outward volume is not positive');const adjacent=fs.map(()=>new Set<number>());
 for(const e of edges.values()){if(e.length!==2||e[0]!.from!==e[1]!.to||e[0]!.to!==e[1]!.from)throw new Error('Actual source/cover is open, nonmanifold or inconsistently wound');adjacent[e[0]!.face]!.add(e[1]!.face);adjacent[e[1]!.face]!.add(e[0]!.face);}
 const visited=new Set<number>(),visit=[0];while(visit.length){const f=visit.pop()!;if(visited.has(f))continue;visited.add(f);visit.push(...adjacent[f]!);}if(visited.size!==fs.length)throw new Error('Disconnected closed cover/source');
 return{faces:fs,volume,positions:p};
}
function referenceCover(cap:Cap){if(cap==='start'){const g=captiveLeadingSleeveGeometry();compactCylinderCaps(g);return g;}return new BoxGeometry(.04,.04,.04).translate(0,0,-.95);}
function assertReference(actual:BufferGeometry,expected:BufferGeometry){if(!same(actual.getAttribute('position').array,expected.getAttribute('position').array)||!!actual.index!==!!expected.index||actual.index&&!same(actual.index.array,expected.index!.array))throw new Error('Enclosed cap cover differs from selected actual closed producer');}
function assertContext(arm:Mesh,cover:Mesh,cap:Cap){const a:unknown=arm.userData.retainerPart,b:unknown=cover.userData.retainerPart;
 if(!a||!b||typeof a!=='object'||typeof b!=='object'||!('id'in a)||!('body'in a)||!('id'in b)||!('body'in b)||a.id!=='lift-arm'||a.body!=='capture-head'||b.body!=='capture-head'||b.id!==(cap==='start'?'leading-sleeve':'leaf-shoe')||!arm.parent||arm.parent!==cover.parent)throw new Error('E1/E2 requires the exact permanent same-body weld');
 arm.updateMatrix();cover.updateMatrix();arm.updateWorldMatrix(true,false);cover.updateWorldMatrix(true,false);
 for(const matrix of[arm.matrix,cover.matrix,arm.matrixWorld,cover.matrixWorld]){const x=new Vector3().setFromMatrixColumn(matrix,0),y=new Vector3().setFromMatrixColumn(matrix,1),z=new Vector3().setFromMatrixColumn(matrix,2);if(Math.max(Math.abs(x.lengthSq()-1),Math.abs(y.lengthSq()-1),Math.abs(z.lengthSq()-1),Math.abs(x.dot(y)),Math.abs(x.dot(z)),Math.abs(y.dot(z)),Math.abs(matrix.determinant()-1))>64*Number.EPSILON)throw new Error('Enclosed weld transform is not rigid');}
 if(!arm.matrix.equals(cover.matrix)||!arm.matrixWorld.equals(cover.matrixWorld))throw new Error('Enclosed cover/arm rigid transforms differ');
 const m=arm.material;if(Array.isArray(m)||Array.isArray(cover.material)||m!==cover.material||m.transparent||m.opacity!==1||!m.depthWrite||m.side!==FrontSide||m.polygonOffset)throw new Error('Enclosed caps require the SAME actual opaque FrontSide depth-writing material');
}
/** E1/E2 only. All remaining faces and normal buffers are literally unchanged.
 * Closed convex opaque coverage hides every removed point AND open rim from any
 * outside eye/light. Hence the EXPOSED union boundary is identical, without a
 * generic interior-face deletion or any moving/contact exclusion. */
export function trimEnclosedCaps(arm:Mesh,coverById:ReadonlyMap<string,Mesh>):{geometry:BufferGeometry;reports:readonly EnclosedCapReport[]}{
 const original=arm.geometry,referenceArm=captiveLiftArmGeometry();try{assertReference(original,referenceArm);closedOutward(original);const all=rows(original),remove=new Set<number>(),reports:EnclosedCapReport[]=[];
 for(const cap of['start','end']as const){const id=cap==='start'?'leading-sleeve':'leaf-shoe',cover=coverById.get(id);if(!cover)throw new Error('Missing declared E1/E2 cover');assertContext(arm,cover,cap);
 const reference=referenceCover(cap);try{assertReference(cover.geometry,reference);const body=closedOutward(cover.geometry),magnitude=Math.max(1,...Array.from(body.positions.array,Math.abs)),storage=8*2**-24*magnitude+64*Number.EPSILON*magnitude,margin=16*storage;
 for(const f of body.faces)for(let i=0;i<body.positions.count;i++)if(new Vector3().fromBufferAttribute(body.positions,i).sub(f.points[0]!).dot(f.normal)>storage)throw new Error('Actual cover is not convex');
 const normal=new Vector3(Math.SQRT1_2,Math.SQRT1_2,0),plane=cap==='start'?.02:-.01,target=all.filter(f=>f.points.every(v=>Math.abs(v.dot(normal)-plane)<=storage));if(target.length!==2)throw new Error('E1/E2 must select exactly two declared cap triangles');
 let minimum=Infinity;const rim=new Map<string,number>();
 for(const f of target){for(const v of f.points)for(const p of body.faces){const clearance=-v.clone().sub(p.points[0]!).dot(p.normal);minimum=Math.min(minimum,clearance);if(!(clearance>margin))throw new Error('Cap/open rim is not strictly enclosed beyond derived storage margin');}
 for(let i=0;i<3;i++){const k=[key(f.points[i]!),key(f.points[(i+1)%3]!)].sort().join('|');rim.set(k,(rim.get(k)??0)+1);}remove.add(f.offset);}
 const boundary=[...rim.values()].filter(n=>n===1);if(boundary.length!==4||[...rim.values()].some(n=>n!==1&&n!==2))throw new Error('Unexpected cap open-rim topology');
 reports.push(Object.freeze({cap,cover:id,removedTriangles:2,rimEdges:4,minimumMargin:minimum,requiredMargin:margin,closedManifoldOutwardConvexCover:true,exposedUnionBoundaryExact:true}));
 }finally{reference.dispose();}}
 if(remove.size!==4)throw new Error('Exactly FOUR E1/E2 triangles per station are allowed');
 const geometry=original.clone(),indices=all.filter(f=>!remove.has(f.offset)).flatMap(f=>f.ids);geometry.setIndex(indices);geometry.clearGroups();geometry.userData={...original.userData,retainerRenderTrim:true};
 if(!same(geometry.getAttribute('position').array,original.getAttribute('position').array)||!same(geometry.getAttribute('normal').array,original.getAttribute('normal').array)||indices.length!==(original.index?.count??original.getAttribute('position').count)-12)throw new Error('An exposed source face/normal/position changed');
 return{geometry,reports:Object.freeze(reports)};
 }finally{referenceArm.dispose();}}
