import { BoxGeometry, FrontSide, Mesh, Vector3, type Object3D } from 'three';
import { groundedGuideGeometry, sourceMountLayout, counterweightGeometry } from '../../src/view/counterweight';
import { compileTerrain, terrainHeightAt } from '../../src/world/village-terrain';
import { villageScenePlan } from '../../src/world/village-plans';
import type { VillageMachine } from '../../src/view/village-machine';
import { surfaceTriangles } from './surface-overlap';
type P=readonly[number,number];
const area=(ps:readonly P[])=>Math.abs(ps.reduce((a,p,i)=>{const q=ps[(i+1)%ps.length]!;return a+(p[0]-ps[0]![0])*(q[1]-ps[0]![1])-(q[0]-ps[0]![0])*(p[1]-ps[0]![1]);},0))/2;
function coverage(root:Object3D,rect:readonly P[],height:number,sign:1|-1){let covered=0,foreign=0;const pieces=[];
 for(const face of surfaceTriangles(root)){if(face.normal.y*sign<=0)continue;const tri=[face.a,face.b,face.c].map(p=>[p.x,p.z]as P);if((tri[1]![0]-tri[0]![0])*(tri[2]![1]-tri[0]![1])-(tri[1]![1]-tri[0]![1])*(tri[2]![0]-tri[0]![0])<0)tri.reverse();let poly=[...rect];
 for(let i=0;i<3&&poly.length;i++){const a=tri[i]!,b=tri[(i+1)%3]!,side=(p:P)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]),out:P[]=[];for(let j=0;j<poly.length;j++){const p=poly[j]!,q=poly[(j+1)%poly.length]!,s=side(p),t=side(q);if(s>=0)out.push(p);if(s*t<0){const u=s/(s-t);out.push([p[0]+(q[0]-p[0])*u,p[1]+(q[1]-p[1])*u]);}}poly=out;}
 const n=poly.length>=3?area(poly):0;if(!n)continue;if([face.a,face.b,face.c].every(p=>Object.is(p.y,height))){covered+=n;pieces.push({name:face.mesh.name,triangle:face.index,area:n,polygon:poly});}else foreign+=n;
 }const expected=area(rect),bound=512*Number.EPSILON*Math.max(1,...rect.flat().map(Math.abs))**2;if(foreign!==0||Math.abs(covered-expected)>bound)throw new Error('Actual complete source patch coverage failed');return{covered,expected,bound,foreign,pieces};}
const position=(m:Mesh)=>{m.updateWorldMatrix(true,false);const p=m.geometry.getAttribute('position');return Array.from({length:p.count},(_,i)=>new Vector3().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld));};
const bounds=(m:Mesh)=>{const p=position(m);return{min:[0,1,2].map(k=>Math.min(...p.map(v=>v.getComponent(k))))as[number,number,number],max:[0,1,2].map(k=>Math.max(...p.map(v=>v.getComponent(k))))as[number,number,number]};};
function exact(a:ArrayLike<number>,b:ArrayLike<number>){return a.length===b.length&&Array.from(a).every((v,i)=>Object.is(v,b[i]));}
/** S71-F is a NEW ideal/unrated bilateral6D fixed site. W71 is its finite
 * packed column/beam patch. Neither discharges the UNMODELLED train branch.
 * These flush contacts NEVER excuse an actual triangle crossing. */
export class SourceMountProof {
 readonly column:Mesh;readonly beam:Mesh;readonly weight:Mesh;readonly report:unknown;
 private readonly fixed:{mesh:Mesh;matrix:number[];position:number[];index:number[]|null}[]=[];
 constructor(machine:VillageMachine,land:Object3D){
 const station=machine.plan.stations.find(s=>s.sourceMount)!;if(!station||station.sourceMount?.guide!=='grounded')throw new Error('Actual opt-in source missing');
 const terrain=compileTerrain(villageScenePlan(machine.plan.chapter).terrain),layout=sourceMountLayout(station,station.retention!.weightDrop,(x,z)=>terrainHeightAt(terrain,x,z));if(layout.guide.kind!=='grounded')throw new Error('Source not grounded');
 const fixed=machine.staticSolids[station.stop]!,parts=fixed.children.filter(o=>o instanceof Mesh);this.column=parts[0]as Mesh;this.beam=parts[1]as Mesh;
 const mover=(machine as unknown as{movers:{group:Object3D;auxiliary?:string;station:unknown}[]}).movers.find(m=>m.station===station&&m.auxiliary==='weight')?.group;
 this.weight=mover?.children.find(m=>m instanceof Mesh)as Mesh;if(!this.weight||this.column.parent!==fixed||this.beam.parent!==fixed)throw new Error('Actual producer ownership missing');
 const refs=[groundedGuideGeometry(layout.guide),new BoxGeometry(...layout.beam.size).translate(...layout.beam.centre),counterweightGeometry()];
 try{for(const[i,m]of[this.column,this.beam,this.weight].entries()){const g=refs[i]!,a=m.geometry.getAttribute('position'),b=g.getAttribute('position');if(!exact(a.array,b.array)||!exact(m.geometry.index?.array??[],g.index?.array??[]))throw new Error('Source actual packed producer mismatch');const material=m.material;if(Array.isArray(material)||material.transparent||material.opacity!==1||!material.depthWrite||material.side!==FrontSide)throw new Error('Source opaque material required');if(i<2){m.updateWorldMatrix(true,false);this.fixed.push({mesh:m,matrix:m.matrixWorld.toArray(),position:Array.from(a.array),index:m.geometry.index?Array.from(m.geometry.index.array):null});}}}finally{refs.forEach(g=>g.dispose());}
 const c=bounds(this.column),b=bounds(this.beam),rect:P[]=[[c.min[0],c.min[2]],[c.max[0],c.min[2]],[c.max[0],c.max[2]],[c.min[0],c.max[2]]];
 if(!Object.is(c.max[1],b.min[1])||b.min[0]>=c.min[0]||b.max[0]<=c.max[0]||b.min[2]>=c.min[2]||b.max[2]<=c.max[2])throw new Error('Disconnected actual W71 patch');
 const foot=coverage(land,rect,c.min[1],1),columnFoot=coverage(this.column,rect,c.min[1],-1),columnTop=coverage(this.column,rect,c.max[1],1),beamBottom=coverage(this.beam,rect,c.max[1],-1);
 const w=position(this.weight),centre=this.weight.getWorldPosition(new Vector3()),local=this.weight.geometry.getAttribute('position'),inner=Array.from({length:local.count},(_,i)=>new Vector3().fromBufferAttribute(local,i)).filter(p=>Math.abs(p.x)<.1&&Math.abs(p.z)<.1);
 const bore={minX:Math.min(...inner.map(p=>p.x))+centre.x,maxX:Math.max(...inner.map(p=>p.x))+centre.x,minZ:Math.min(...inner.map(p=>p.z))+centre.z,maxZ:Math.max(...inner.map(p=>p.z))+centre.z};
 const clearance=Math.min(c.min[0]-bore.minX,bore.maxX-c.max[0],c.min[2]-bore.minZ,bore.maxZ-c.max[2]);if(!(clearance>0))throw new Error('Bore intersects actual column');
 this.report={S71F:{model:'NEW ideal/unrated bilateral six-component ground anchor',doesWork:false,foot,actualColumnFoot:columnFoot},W71:{columnTop,beamBottom},column:c,beam:b,bore,clearance,weightTopPackingDifference:Math.max(...w.map(p=>p.y))-b.min[1],trainBranch:'UNMODELLED pulley-to-carriage transmission/reaction path; no complete physical source acceptance'};
 this.validate();
 }
 validate(){for(const r of this.fixed){r.mesh.updateWorldMatrix(true,false);if(!exact(r.matrix,r.mesh.matrixWorld.elements)||!exact(r.position,r.mesh.geometry.getAttribute('position').array)||!exact(r.index??[],r.mesh.geometry.index?.array??[]))throw new Error('Source fixed buffer/rigid pose changed');}const c=bounds(this.column),p=this.weight.getWorldPosition(new Vector3());if(Math.abs((c.min[0]+c.max[0])/2-p.x)>8*2**-24||Math.abs((c.min[2]+c.max[2])/2-p.z)>8*2**-24)throw new Error('Weight/column identity or axis displaced');}
}
