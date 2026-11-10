import {Vector3,Triangle} from 'three';
import type{groundFoundations}from'./ground-foundations';
import {terrainHeightAt,terrainVertex,cellDiagonal,type VillageTerrain} from '../../src/world/village-terrain';
type Point=readonly[number,number];
function clip(subject:readonly Point[],triangle:readonly Point[]):Point[]{
 const cross=(a:Point,b:Point,p:Point)=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
 const sign=Math.sign(cross(triangle[0]!,triangle[1]!,triangle[2]!));let polygon=[...subject];
 for(let i=0;i<3&&polygon.length;i++){const a=triangle[i]!,b=triangle[(i+1)%3]!,next:Point[]=[];
 for(let j=0;j<polygon.length;j++){const p=polygon[j]!,q=polygon[(j+1)%polygon.length]!,dp=sign*cross(a,b,p),dq=sign*cross(a,b,q);if(dp>=0)next.push(p);if((dp>=0)!==(dq>=0)){const t=dp/(dp-dq);next.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])]);}}polygon=next;
 }return polygon;
}
function area(p:readonly Point[]){return Math.abs(p.reduce((s,a,i)=>{const b=p[(i+1)%p.length]!;return s+a[0]*b[1]-a[1]*b[0];},0))/2;}
export function terrainTriangles(terrain:VillageTerrain){const result=[];for(let row=0;row<terrain.rows;row++)for(let column=0;column<terrain.columns;column++)if(terrain.cells[row*terrain.columns+column]==='land'){
 const a=terrainVertex(terrain,column,row),b=terrainVertex(terrain,column+1,row),c=terrainVertex(terrain,column,row+1),d=terrainVertex(terrain,column+1,row+1);
 for(const t of cellDiagonal(column,row)==='main'?[[a,d,b],[a,c,d]]:[[a,c,b],[b,c,d]])result.push(t as [typeof a,typeof a,typeof a]);}return result;}
export function footprintAudit(feet:ReturnType<typeof groundFoundations>,terrain:VillageTerrain,projectBase=false){
 const land=terrainTriangles(terrain);return feet.map(foot=>{const centreGround=terrainHeightAt(terrain,foot.centre[0]!,foot.centre[2]!);let covered=0,expected=0,minimum=Infinity,maximum=-Infinity,samples=0;const witnesses=[];
 for(const tri of foot.bottom){const polygon=tri.map(p=>[p.x,p.z] as Point);expected+=area(polygon);const normal=new Triangle(...tri).getNormal(new Vector3());
 for(const groundTri of land){const clipped=clip(polygon,groundTri.map(p=>[p[0],p[2]] as Point));const surfaceArea=area(clipped);if(surfaceArea<1e-14)continue;covered+=surfaceArea;
 for(const[x,z]of clipped){const ground=terrainHeightAt(terrain,x,z);if(ground===undefined){witnesses.push({x,z,void:true});continue;}const base=projectBase?centreGround!:tri[0].y-(normal.x*(x-tri[0].x)+normal.z*(z-tri[0].z))/normal.y;const delta=base-ground;minimum=Math.min(minimum,delta);maximum=Math.max(maximum,delta);samples++;if(Math.abs(delta)>.002&&witnesses.length<12)witnesses.push({x,z,base,ground,delta});}
 }}return{name:foot.name,centre:foot.centre,covered,expected,minimum,maximum,samples,witnesses,clear:Math.abs(covered-expected)<1e-8&&minimum>=-.002&&maximum<=.002&&witnesses.every(w=>!('void'in w))};});
}
