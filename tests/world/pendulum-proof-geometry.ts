// UNUSED / UNRUN: finite same-rigid-composite weld patches only.
import{Box3,Matrix4,Vector3,type Mesh}from'three';
import type{SurfaceTriangle}from'./surface-overlap';
import type{PendulumDrive}from'../../src/world/pendulum-types';
import{triangleCrossing}from'./village-geometry';
export function pendulumPackedBounds(mesh:Mesh):Box3{const b=new Box3(),p=mesh.geometry.getAttribute('position'),v=new Vector3();for(let i=0;i<p.count;i++)b.expandByPoint(v.set(p.getX(i),p.getY(i),p.getZ(i)));return b;}
export function pendulumIntersection(a:SurfaceTriangle,b:SurfaceTriangle):Vector3[]{
 const direction=a.normal.clone().cross(b.normal).normalize(),cuts=(f:SurfaceTriangle,p:SurfaceTriangle)=>{const v=[f.a,f.b,f.c],r:Vector3[]=[];for(let i=0;i<3;i++){const x=v[i]!,y=v[(i+1)%3]!,dx=x.clone().sub(p.a).dot(p.normal),dy=y.clone().sub(p.a).dot(p.normal);if(dx===0)r.push(x.clone());if(dx*dy<0)r.push(x.clone().lerp(y,dx/(dx-dy)));}return r;};
 const aa=cuts(a,b),bb=cuts(b,a);if(aa.length<2||bb.length<2)return[];const dot=(p:Vector3)=>p.dot(direction),lo=Math.max(Math.min(...aa.map(dot)),Math.min(...bb.map(dot))),hi=Math.min(Math.max(...aa.map(dot)),Math.max(...bb.map(dot)));return hi<lo?[]:[lo,hi].map(t=>aa[0]!.clone().addScaledVector(direction,t-dot(aa[0]!)));
}
export function pendulumWeld(a:SurfaceTriangle,b:SurfaceTriangle,d:PendulumDrive,barSupport:number):boolean{
 const pa=a.mesh.userData.pendulumPart,pb=b.mesh.userData.pendulumPart;if(!pa||!pb||pa.body!==pb.body||a.mesh.parent!==b.mesh.parent)return false;
 const pair=[pa.id,pb.id].sort().join('/');let center:Vector3|undefined,half:Vector3|undefined;
 if(pair==='bar-return/striking-bar'){center=new Vector3(0,-d.bar.arm+.03,-.265);half=new Vector3(.03,.05,.05);}
 if(pair==='bar-return/hammer-arm'){center=new Vector3(0,-d.bar.arm+.06,-.35);half=new Vector3(.03,.04,.05);}
 if(pair==='hammer-arm/hammer-hub'){center=new Vector3(0,-.045,-.36);half=new Vector3(.03,.02,.065);}
 for(const side of[-1,1])if(pair===`fixed-axle/frame-post-${side}`){center=new Vector3(0,0,side*.65);half=new Vector3(.03,.03,.075);}
 // Only fixed bell-return endpoint welds, derived from the same closed bar
 // support face. Neither bar↔bell nor shaft↔hub is a blanket crossing exception.
 const cq=Math.cos(d.stopAngle),sq=Math.sin(d.stopAngle),support=barSupport,x=d.bar.arm*sq+(support+.04)*cq,y=-d.bar.arm*cq+(support+.04)*sq;
 if(pair==='bell-foot/bell-return'){center=new Vector3(x,y-.32,-.62);half=new Vector3(.06,.06,.06);}
 if(pair==='bell-return/bell-stop'){center=new Vector3(x+.06*sq,y-.06*cq,-.31);half=new Vector3(.06,.06,.06);}
 if(pair==='frame-cap/frame-post--1'||pair==='frame-cap/frame-post-1'){const intersection=pendulumPackedBounds(a.mesh).intersect(pendulumPackedBounds(b.mesh)),points=pendulumIntersection(a,b),inverse=a.mesh.matrixWorld.clone().invert();return !intersection.isEmpty()&&points.length===2&&points.every(p=>intersection.containsPoint(p.applyMatrix4(inverse)));}
 if(!center||!half)return false;const points=pendulumIntersection(a,b);if(points.length!==2)return false;
 const frame=pa.body==='hammer'?a.mesh.parent!.matrixWorld:new Matrix4().multiplyMatrices(a.mesh.parent!.matrixWorld,new Matrix4().makeTranslation(...d.axle.origin)),inverse=frame.clone().invert();
 return points.every(v=>{v.applyMatrix4(inverse).sub(center!);return Math.abs(v.x)<=half!.x&&Math.abs(v.y)<=half!.y&&Math.abs(v.z)<=half!.z;});
}
export function pendulumCrossings(hardware:readonly SurfaceTriangle[],all:readonly SurfaceTriangle[],d:PendulumDrive,barSupport:number,ground?:(a:SurfaceTriangle,b:SurfaceTriangle)=>boolean){
 const result:{a:string;b:string;point:number[];aTriangle:number[][];bTriangle:number[][]}[]=[],grid=new Map<string,SurfaceTriangle[]>();
 const visit=(s:SurfaceTriangle,f:(key:string)=>void)=>{for(let x=Math.floor(s.bounds.min.x/2);x<=Math.floor(s.bounds.max.x/2);x++)for(let y=Math.floor(s.bounds.min.y/2);y<=Math.floor(s.bounds.max.y/2);y++)for(let z=Math.floor(s.bounds.min.z/2);z<=Math.floor(s.bounds.max.z/2);z++)f(`${x}/${y}/${z}`);};
 for(const face of all)visit(face,key=>{const cell=grid.get(key);if(cell)cell.push(face);else grid.set(key,[face]);});
 for(const a of hardware){const nearby=new Set<SurfaceTriangle>();visit(a,key=>{for(const b of grid.get(key)??[])nearby.add(b);});for(const b of nearby)if(a.mesh!==b.mesh&&a.bounds.intersectsBox(b.bounds)&&(triangleCrossing(a,b,128*Number.EPSILON*Math.max(1,a.a.length(),b.a.length()))||triangleCrossing(b,a,128*Number.EPSILON*Math.max(1,a.a.length(),b.a.length())))&&!pendulumWeld(a,b,d,barSupport)&&!ground?.(a,b))result.push({a:a.mesh.name,b:b.mesh.name,point:(pendulumIntersection(a,b)[0]??a.a).toArray(),aTriangle:[a.a,a.b,a.c].map(p=>p.toArray()),bTriangle:[b.a,b.b,b.c].map(p=>p.toArray())});}return result;
}
